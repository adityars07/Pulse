import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionStatus } from '@prisma/client';

/**
 * BillingService — wraps the Stripe API for metered per-message billing.
 *
 * Flow:
 * 1. Tenant clicks "Subscribe" in the dashboard → createCheckoutSession()
 * 2. Stripe redirects back → syncSubscription() via webhook
 * 3. Every AI message → reportUsage() (1 event to Stripe Meters API)
 * 4. Tenant visits dashboard → createBillingPortalSession() for invoices/cancel
 *
 * NOTE: Uses Stripe Billing Meter Events API (v17+) for usage reporting.
 * Configure a meter in Stripe Dashboard with event_name = 'groundeddesk_messages'.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe;
  private readonly METER_EVENT = 'groundeddesk_messages';

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY') || 'sk_test_placeholder',
    );
  }

  // ---------------------------------------------------------------------------
  // Checkout
  // ---------------------------------------------------------------------------

  /**
   * Create a Stripe Checkout session for a tenant to subscribe.
   * Uses a metered price (STRIPE_PRICE_ID) billed per usage event.
   */
  async createCheckoutSession(tenantId: string, successUrl: string, cancelUrl: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException('Tenant not found');

    // Reuse existing Stripe customer or create a new one
    let customerId: string;
    const existing = await this.prisma.stripeCustomer.findUnique({ where: { tenantId } });

    if (existing) {
      customerId = existing.customerId;
    } else {
      const customer = await this.stripe.customers.create({
        name: tenant.name,
        metadata: { tenantId },
      });
      customerId = customer.id;

      await this.prisma.stripeCustomer.create({
        data: { tenantId, customerId, status: SubscriptionStatus.INCOMPLETE },
      });
    }

    const priceId = this.configService.get<string>('STRIPE_PRICE_ID');
    if (!priceId) {
      throw new BadRequestException('STRIPE_PRICE_ID is not configured');
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { tenantId },
    });

    return { url: session.url };
  }

  // ---------------------------------------------------------------------------
  // Webhook sync
  // ---------------------------------------------------------------------------

  /**
   * Sync subscription state from a Stripe webhook event.
   * Called by StripeWebhookController on subscription lifecycle events.
   */
  async syncSubscription(subscription: Stripe.Subscription) {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : (subscription.customer as any).id;

    const stripeRecord = await this.prisma.stripeCustomer.findFirst({
      where: { customerId },
    });

    if (!stripeRecord) {
      this.logger.warn(`No StripeCustomer found for customer ${customerId}`);
      return;
    }

    const item = subscription.items.data[0];
    const status = this.mapStripeStatus(subscription.status);

    await this.prisma.stripeCustomer.update({
      where: { id: stripeRecord.id },
      data: {
        subscriptionId: subscription.id,
        subscriptionItemId: item?.id,
        priceId: item?.price?.id,
        status,
        // Stripe v17: use trial_end or next billing cycle as period end approximation
        currentPeriodEnd: subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null,
      },
    });

    this.logger.log(`Synced subscription ${subscription.id} → ${status}`);
  }

  // ---------------------------------------------------------------------------
  // Metered usage (Stripe Billing Meter Events)
  // ---------------------------------------------------------------------------

  /**
   * Report 1 usage event to Stripe's Billing Meters API.
   * This is the Stripe v17+ replacement for legacy usage records.
   * Set up a meter in Stripe Dashboard with:
   *   - Event name: 'groundeddesk_messages'
   *   - Aggregation: COUNT
   *
   * Silently no-ops if the tenant is not subscribed.
   */
  async reportUsage(tenantId: string, quantity: number = 1) {
    try {
      const stripeRecord = await this.prisma.stripeCustomer.findUnique({
        where: { tenantId },
      });

      if (!stripeRecord?.customerId || stripeRecord.status !== SubscriptionStatus.ACTIVE) {
        // Tenant not subscribed — skip silently
        return;
      }

      // Stripe Meters API: send a billing_portal meter event
      await (this.stripe as any).billing.meterEvents.create({
        event_name: this.METER_EVENT,
        payload: {
          stripe_customer_id: stripeRecord.customerId,
          value: String(quantity),
        },
      });
    } catch (err: any) {
      // Non-fatal — log but don't throw so chat still works
      this.logger.warn(`Stripe meter event failed for tenant ${tenantId}: ${err?.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Billing portal
  // ---------------------------------------------------------------------------

  /**
   * Create a Stripe Billing Portal session for subscription management.
   */
  async createBillingPortalSession(tenantId: string, returnUrl: string) {
    const stripeRecord = await this.prisma.stripeCustomer.findUnique({ where: { tenantId } });
    if (!stripeRecord) throw new BadRequestException('No billing account found');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: stripeRecord.customerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private mapStripeStatus(status: Stripe.Subscription['status']): SubscriptionStatus {
    const map: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      unpaid: SubscriptionStatus.PAST_DUE,
      trialing: SubscriptionStatus.TRIALING,
      incomplete: SubscriptionStatus.INCOMPLETE,
      incomplete_expired: SubscriptionStatus.CANCELED,
      paused: SubscriptionStatus.PAST_DUE,
    };
    return map[status] ?? SubscriptionStatus.INCOMPLETE;
  }
}

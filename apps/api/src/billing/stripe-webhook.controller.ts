import {
  Controller,
  Post,
  Req,
  Headers,
  RawBodyRequest,
  Logger,
  HttpCode,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import Stripe from 'stripe';
import { BillingService } from './billing.service';

/**
 * StripeWebhookController — receives Stripe webhook events.
 *
 * IMPORTANT: This endpoint must receive the raw request body (not parsed JSON)
 * for signature verification. NestJS is configured with rawBody: true in main.ts.
 *
 * Handled events:
 *  - customer.subscription.created
 *  - customer.subscription.updated
 *  - customer.subscription.deleted
 *  - invoice.payment_failed
 */
@Controller('api/webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly billingService: BillingService,
    private readonly configService: ConfigService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY') || 'sk_test_placeholder',
    );
  }

  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        req.rawBody!,
        signature,
        webhookSecret || '',
      );
    } catch (err: any) {
      this.logger.warn(`Stripe webhook signature verification failed: ${err.message}`);
      // Return 200 to avoid Stripe retrying — but don't process
      return { received: true };
    }

    this.logger.log(`Stripe event: ${event.type}`);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.billingService.syncSubscription(event.data.object as any);
        break;

      case 'customer.subscription.deleted':
        await this.billingService.syncSubscription(event.data.object as any);
        break;

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        this.logger.warn(`Payment failed for customer: ${invoice.customer}`);
        break;
      }

      default:
        // Ignore unhandled events
        break;
    }

    return { received: true };
  }
}

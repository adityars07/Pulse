import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

interface CheckoutDto {
  successUrl: string;
  cancelUrl: string;
}

interface PortalDto {
  returnUrl: string;
}

/**
 * BillingController — dashboard-facing endpoints for billing management.
 * All routes require JWT authentication.
 */
@Controller('api/billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /** Create a Stripe Checkout session to start a subscription. */
  @Post('checkout')
  async createCheckout(@Body() dto: CheckoutDto, @Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.billingService.createCheckoutSession(tenantId, dto.successUrl, dto.cancelUrl);
  }

  /** Create a Stripe Billing Portal session (manage subscription / invoices). */
  @Post('portal')
  async createPortal(@Body() dto: PortalDto, @Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.billingService.createBillingPortalSession(tenantId, dto.returnUrl);
  }
}

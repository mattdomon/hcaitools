/**
 * Payment Processing
 * Stripe payment processing, subscriptions, and billing system
 */

export {
  PaymentMethodType,
  SubscriptionStatus,
  BillingCycle,
  PricingModel,
  PaymentStatus,
  TransactionType,
  Price,
  Product,
  PaymentMethod,
  Invoice,
  InvoiceLineItem,
  Subscription,
  SubscriptionItem,
  UsageRecord,
  Customer,
  Charge,
  Refund,
  Dispute,
  CheckoutSession,
  BillingPortalSession,
  WebhookEvent,
  PricingTier,
  PricingPlan,
  BillingReport,
  PaymentProcessor,
} from './types';

export { StripePaymentProcessor } from './stripeProcessor';

import { StripePaymentProcessor } from './stripeProcessor';
import { PaymentMethodType, BillingReport } from './types';

/**
 * StripeManus
 * Main class for payment processing and subscription management
 */
export class StripeManus {
  private processor: StripePaymentProcessor;

  constructor() {
    this.processor = new StripePaymentProcessor();
  }

  /**
   * Create a new customer
   */
  async createCustomer(email: string, name: string, phone?: string) {
    return this.processor.createCustomer({
      email,
      name,
      phoneNumber: phone,
    });
  }

  /**
   * Add a payment method to customer
   */
  async addPaymentMethod(customerId: string, type: string, last4?: string) {
    return this.processor.addPaymentMethod(customerId, {
      type: type as PaymentMethodType,
      isDefault: false,
      last4,
    });
  }

  /**
   * Create a product
   */
  async createProduct(name: string, description?: string) {
    return this.processor.createProduct({
      name,
      description,
      prices: [],
      active: true,
    });
  }

  /**
   * Create a price for a product
   */
  async createPrice(productId: string, amount: number, billingCycle: string) {
    return this.processor.createPrice({
      productId,
      amount,
      currency: 'usd',
      billingCycle: billingCycle as any,
      pricingModel: 'fixed',
      isRecurring: true,
    });
  }

  /**
   * Create a subscription for a customer
   */
  async createSubscription(customerId: string, priceId: string) {
    return this.processor.createSubscription({
      customerId,
      priceId,
      status: 'active',
    } as any);
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string, atPeriodEnd: boolean = true) {
    return this.processor.cancelSubscription(subscriptionId, atPeriodEnd);
  }

  /**
   * Create a charge
   */
  async createCharge(customerId: string, amount: number, description?: string) {
    return this.processor.createCharge({
      customerId,
      amount,
      currency: 'usd',
      description,
      status: 'pending',
    } as any);
  }

  /**
   * Create a refund
   */
  async refundCharge(chargeId: string, amount?: number, reason?: string) {
    return this.processor.createRefund(chargeId, amount, reason);
  }

  /**
   * Create a checkout session
   */
  async createCheckout(lineItems: Array<{ priceId: string; quantity: number }>, successUrl: string, cancelUrl: string) {
    return this.processor.createCheckoutSession({
      lineItems,
      mode: 'payment',
      paymentMethodTypes: ['credit_card', 'apple_pay', 'google_pay'] as any,
      successUrl,
      cancelUrl,
      status: 'open',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    } as any);
  }

  /**
   * Get billing report
   */
  async generateReport(startDate: Date, endDate: Date): Promise<BillingReport> {
    return this.processor.generateBillingReport(startDate, endDate);
  }

  /**
   * Get metrics
   */
  async getMetrics() {
    return this.processor.getMetrics();
  }

  /**
   * Example: SaaS Subscription Setup
   */
  async setupSaaSSubscription(email: string, customerName: string) {
    // Create customer
    const customer = await this.createCustomer(email, customerName);

    // Create product
    const product = await this.createProduct('Professional Plan', 'Full access to all features');

    // Create pricing tiers
    const monthlyPrice = await this.createPrice(product.productId, 9900, 'monthly'); // $99/month

    // Add payment method
    const paymentMethod = await this.addPaymentMethod(customer.customerId, 'credit_card', '4242');

    // Create subscription
    const subscription = await this.createSubscription(customer.customerId, monthlyPrice.priceId);

    return {
      customer,
      product,
      monthlyPrice,
      paymentMethod,
      subscription,
    };
  }

  /**
   * Example: E-commerce Checkout
   */
  async createEcommerceCheckout(items: Array<{ priceId: string; quantity: number }>) {
    return this.createCheckout(items, 'https://example.com/success', 'https://example.com/cancel');
  }

  /**
   * Example: Usage-based Billing
   */
  async setupUsageBasedBilling(customerId: string, productName: string) {
    const product = await this.createProduct(productName, 'Usage-based pricing');

    // Create a metered price (simulated)
    const price = await this.createPrice(product.productId, 1, 'monthly'); // $0.01 per unit

    const subscription = await this.createSubscription(customerId, price.priceId);

    return {
      product,
      price,
      subscription,
    };
  }
}

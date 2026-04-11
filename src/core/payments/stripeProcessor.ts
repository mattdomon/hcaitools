/**
 * Stripe Payment Processor Implementation
 * Handles payment processing, subscriptions, and billing
 */

import crypto from 'crypto';
import {
  Customer,
  PaymentMethod,
  Charge,
  Subscription,
  Invoice,
  Product,
  Price,
  CheckoutSession,
  Refund,
  Dispute,
  BillingPortalSession,
  WebhookEvent,
  UsageRecord,
  PaymentProcessor,
  BillingReport,
} from './types';

export class StripePaymentProcessor implements PaymentProcessor {
  private customers: Map<string, Customer> = new Map();
  private charges: Map<string, Charge> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
  private invoices: Map<string, Invoice> = new Map();
  private products: Map<string, Product> = new Map();
  private prices: Map<string, Price> = new Map();
  private refunds: Map<string, Refund> = new Map();
  private disputes: Map<string, Dispute> = new Map();
  private usageRecords: Map<string, UsageRecord[]> = new Map();
  private webhookHandlers: Map<string, Array<(event: WebhookEvent) => Promise<void>>> = new Map();

  async createCustomer(
    customer: Omit<Customer, 'customerId' | 'createdAt' | 'paymentMethods' | 'subscriptions'>
  ): Promise<Customer> {
    const customerId = this.generateId('cus');
    const now = new Date();

    const newCustomer: Customer = {
      ...customer,
      customerId,
      paymentMethods: [],
      subscriptions: [],
      createdAt: now,
    };

    this.customers.set(customerId, newCustomer);
    return newCustomer;
  }

  async getCustomer(customerId: string): Promise<Customer | null> {
    return this.customers.get(customerId) || null;
  }

  async updateCustomer(customerId: string, updates: Partial<Customer>): Promise<Customer> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer ${customerId} not found`);
    }

    const updated: Customer = {
      ...customer,
      ...updates,
      customerId,
      createdAt: customer.createdAt,
    };

    this.customers.set(customerId, updated);
    return updated;
  }

  async deleteCustomer(customerId: string): Promise<void> {
    this.customers.delete(customerId);
  }

  async addPaymentMethod(
    customerId: string,
    paymentMethod: Omit<PaymentMethod, 'paymentMethodId' | 'createdAt'>
  ): Promise<PaymentMethod> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer ${customerId} not found`);
    }

    const paymentMethodId = this.generateId('pm');
    const now = new Date();

    const newPaymentMethod: PaymentMethod = {
      ...paymentMethod,
      paymentMethodId,
      createdAt: now,
    };

    customer.paymentMethods.push(newPaymentMethod);

    if (paymentMethod.isDefault) {
      customer.defaultPaymentMethodId = paymentMethodId;
    }

    this.customers.set(customerId, customer);
    return newPaymentMethod;
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer ${customerId} not found`);
    }

    const paymentMethod = customer.paymentMethods.find((pm) => pm.paymentMethodId === paymentMethodId);
    if (!paymentMethod) {
      throw new Error(`Payment method ${paymentMethodId} not found`);
    }

    customer.defaultPaymentMethodId = paymentMethodId;
    this.customers.set(customerId, customer);
  }

  async removePaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer ${customerId} not found`);
    }

    customer.paymentMethods = customer.paymentMethods.filter((pm) => pm.paymentMethodId !== paymentMethodId);

    if (customer.defaultPaymentMethodId === paymentMethodId) {
      customer.defaultPaymentMethodId = customer.paymentMethods[0]?.paymentMethodId;
    }

    this.customers.set(customerId, customer);
  }

  async createProduct(product: Omit<Product, 'productId'>): Promise<Product> {
    const productId = this.generateId('prod');

    const newProduct: Product = {
      ...product,
      productId,
    };

    this.products.set(productId, newProduct);
    return newProduct;
  }

  async getProduct(productId: string): Promise<Product | null> {
    return this.products.get(productId) || null;
  }

  async createPrice(price: Omit<Price, 'priceId'>): Promise<Price> {
    const priceId = this.generateId('price');

    const newPrice: Price = {
      ...price,
      priceId,
    };

    this.prices.set(priceId, newPrice);

    const product = this.products.get(price.productId);
    if (product) {
      product.prices.push(newPrice);
      this.products.set(price.productId, product);
    }

    return newPrice;
  }

  async createCheckoutSession(
    session: Omit<CheckoutSession, 'sessionId' | 'createdAt'>
  ): Promise<CheckoutSession> {
    const sessionId = this.generateId('cs');
    const now = new Date();

    const newSession: CheckoutSession = {
      ...session,
      sessionId,
      createdAt: now,
      url: `https://checkout.stripe.com/pay/${sessionId}`,
    };

    return newSession;
  }

  async getCheckoutSession(_sessionId: string): Promise<CheckoutSession | null> {
    // In a real implementation, this would fetch from Stripe
    return null;
  }

  async createCharge(charge: Omit<Charge, 'chargeId' | 'createdAt'>): Promise<Charge> {
    const chargeId = this.generateId('ch');
    const now = new Date();

    // Simulate payment processing
    const status = Math.random() > 0.05 ? 'succeeded' : 'failed';

    const newCharge: Charge = {
      ...charge,
      chargeId,
      status,
      createdAt: now,
      receiptUrl: status === 'succeeded' ? `https://receipt.stripe.com/${chargeId}` : undefined,
    };

    this.charges.set(chargeId, newCharge);

    // Emit webhook event
    await this.processWebhook({
      eventId: this.generateId('evt'),
      type: status === 'succeeded' ? 'charge.succeeded' : 'charge.failed',
      data: newCharge as unknown as Record<string, unknown>,
      createdAt: now,
    });

    return newCharge;
  }

  async getCharge(chargeId: string): Promise<Charge | null> {
    return this.charges.get(chargeId) || null;
  }

  async createSubscription(
    subscription: Omit<Subscription, 'subscriptionId' | 'createdAt'>
  ): Promise<Subscription> {
    const subscriptionId = this.generateId('sub');
    const now = new Date();

    const newSubscription: Subscription = {
      ...subscription,
      subscriptionId,
      createdAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: this.getNextBillingDate(now, subscription.status === 'active' ? 'monthly' : 'monthly'),
    };

    this.subscriptions.set(subscriptionId, newSubscription);

    const customer = this.customers.get(subscription.customerId);
    if (customer) {
      customer.subscriptions.push(newSubscription);
      this.customers.set(subscription.customerId, customer);
    }

    // Emit webhook event
    await this.processWebhook({
      eventId: this.generateId('evt'),
      type: 'customer.subscription.created',
      data: newSubscription as unknown as Record<string, unknown>,
      createdAt: now,
    });

    return newSubscription;
  }

  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    return this.subscriptions.get(subscriptionId) || null;
  }

  async updateSubscription(subscriptionId: string, updates: Partial<Subscription>): Promise<Subscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    const updated: Subscription = {
      ...subscription,
      ...updates,
      subscriptionId,
      createdAt: subscription.createdAt,
    };

    this.subscriptions.set(subscriptionId, updated);
    return updated;
  }

  async cancelSubscription(subscriptionId: string, atPeriodEnd: boolean = true): Promise<Subscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    if (atPeriodEnd) {
      subscription.cancelAtPeriodEnd = true;
    } else {
      subscription.status = 'canceled';
      subscription.canceledAt = new Date();
      subscription.endedAt = new Date();
    }

    this.subscriptions.set(subscriptionId, subscription);
    return subscription;
  }

  async pauseSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    subscription.status = 'paused';
    this.subscriptions.set(subscriptionId, subscription);
    return subscription;
  }

  async resumeSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    subscription.status = 'active';
    this.subscriptions.set(subscriptionId, subscription);
    return subscription;
  }

  async recordUsage(subscriptionItemId: string, quantity: number, action: 'set' | 'increment'): Promise<UsageRecord> {
    const recordId = this.generateId('usage');
    const now = new Date();

    const record: UsageRecord = {
      recordId,
      subscriptionItemId,
      quantity,
      timestamp: now,
      action,
    };

    const records = this.usageRecords.get(subscriptionItemId) || [];
    records.push(record);
    this.usageRecords.set(subscriptionItemId, records);

    return record;
  }

  async getUsageRecords(subscriptionItemId: string, _startDate: Date, _endDate: Date): Promise<UsageRecord[]> {
    return this.usageRecords.get(subscriptionItemId) || [];
  }

  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    return this.invoices.get(invoiceId) || null;
  }

  async listInvoices(customerId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter((inv) => inv.customerId === customerId);
  }

  async retryInvoice(invoiceId: string): Promise<Invoice> {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    invoice.status = 'succeeded';
    invoice.paidAt = new Date();
    this.invoices.set(invoiceId, invoice);

    return invoice;
  }

  async createRefund(chargeId: string, amount?: number, reason?: string): Promise<Refund> {
    const charge = this.charges.get(chargeId);
    if (!charge) {
      throw new Error(`Charge ${chargeId} not found`);
    }

    const refundId = this.generateId('ref');
    const refundAmount = amount || charge.amount;

    const refund: Refund = {
      refundId,
      chargeId,
      amount: refundAmount,
      reason,
      status: 'succeeded',
      createdAt: new Date(),
    };

    this.refunds.set(refundId, refund);

    charge.status = 'refunded';
    this.charges.set(chargeId, charge);

    return refund;
  }

  async getRefund(refundId: string): Promise<Refund | null> {
    return this.refunds.get(refundId) || null;
  }

  async createDispute(chargeId: string, reason: string): Promise<Dispute> {
    const _charge = this.charges.get(chargeId);
    if (!_charge) {
      throw new Error(`Charge ${chargeId} not found`);
    }

    const disputeId = this.generateId('dp');

    const dispute: Dispute = {
      disputeId,
      chargeId,
      amount: _charge.amount,
      reason,
      status: 'warning_under_review',
      evidenceDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    };

    this.disputes.set(disputeId, dispute);
    return dispute;
  }

  async createBillingPortalSession(customerId: string): Promise<BillingPortalSession> {
    const _customer = this.customers.get(customerId);
    if (!_customer) {
      throw new Error(`Customer ${customerId} not found`);
    }

    const sessionId = this.generateId('bps');
    const now = new Date();

    const session: BillingPortalSession = {
      sessionId,
      customerId,
      url: `https://billing.stripe.com/session/${sessionId}`,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      createdAt: now,
    };

    return session;
  }

  registerWebhookHandler(eventType: string, handler: (event: WebhookEvent) => Promise<void>): void {
    const handlers = this.webhookHandlers.get(eventType) || [];
    handlers.push(handler);
    this.webhookHandlers.set(eventType, handlers);
  }

  async processWebhook(event: WebhookEvent): Promise<void> {
    const handlers = this.webhookHandlers.get(event.type) || [];

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Error processing webhook ${event.type}:`, error);
      }
    }
  }

  async generateBillingReport(periodStart: Date, periodEnd: Date): Promise<BillingReport> {
    const charges = Array.from(this.charges.values()).filter(
      (c) => c.createdAt >= periodStart && c.createdAt <= periodEnd
    );

    const successfulCharges = charges.filter((c) => c.status === 'succeeded');
    const totalRevenue = successfulCharges.reduce((sum, c) => sum + c.amount, 0);

    const refundsInPeriod = Array.from(this.refunds.values()).filter(
      (r) => r.createdAt >= periodStart && r.createdAt <= periodEnd
    );
    const totalRefunds = refundsInPeriod.reduce((sum, r) => sum + r.amount, 0);

    const activeSubscriptions = Array.from(this.subscriptions.values()).filter((s) => s.status === 'active').length;

    const topProducts = Array.from(this.products.values())
      .map((p) => ({
        productId: p.productId,
        name: p.name,
        revenue: 0, // Would calculate from charges
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      reportId: this.generateId('rpt'),
      generatedAt: new Date(),
      periodStart,
      periodEnd,
      totalRevenue,
      totalCharges: charges.length,
      successfulCharges: successfulCharges.length,
      failedCharges: charges.length - successfulCharges.length,
      totalRefunds,
      refundCount: refundsInPeriod.length,
      activeSubscriptions,
      newSubscriptions: 0,
      canceledSubscriptions: 0,
      churnRate: 0,
      averageOrderValue: successfulCharges.length > 0 ? totalRevenue / successfulCharges.length : 0,
      topProducts,
    };
  }

  async getMetrics(): Promise<{ mrr: number; arr: number; churnRate: number; ltv: number }> {
    const activeSubscriptions = Array.from(this.subscriptions.values()).filter((s) => s.status === 'active');

    // Calculate MRR (Monthly Recurring Revenue)
    let mrr = 0;
    for (const sub of activeSubscriptions) {
      const price = this.prices.get(sub.priceId);
      if (price && price.billingCycle === 'monthly') {
        mrr += price.amount;
      } else if (price && price.billingCycle === 'annual') {
        mrr += price.amount / 12;
      }
    }

    // Calculate ARR (Annual Recurring Revenue)
    const arr = mrr * 12;

    // Estimate LTV (Customer Lifetime Value) as ARR / active customers
    const activeCustomers = new Set(activeSubscriptions.map((s) => s.customerId)).size;
    const ltv = activeCustomers > 0 ? arr / activeCustomers : 0;

    return {
      mrr,
      arr,
      churnRate: 0, // Would calculate from canceled subscriptions
      ltv,
    };
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private getNextBillingDate(from: Date, billingCycle: string): Date {
    const date = new Date(from);
    if (billingCycle === 'monthly') {
      date.setMonth(date.getMonth() + 1);
    } else if (billingCycle === 'annual') {
      date.setFullYear(date.getFullYear() + 1);
    }
    return date;
  }
}

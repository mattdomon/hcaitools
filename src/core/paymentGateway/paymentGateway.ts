import crypto from 'crypto';
import type {
  PaymentProviderType,
  PaymentState,
  DisputeReason,
  PaymentMethod,
  PaymentMetadata,
  Payment,
  Refund,
  Dispute,
  WebhookEvent,
  Subscription,
  Plan,
  Customer,
  PaymentIntent,
  RefundOptions,
  DisputeEvidence,
  PaymentGatewayConfig,
  IPaymentProvider,
} from './types';
import {
  generateWebhookEventId,
  calculateSubscriptionEndDate,
} from './types';

function createMockPaymentMethodId(): string {
  return `pm_${crypto.randomBytes(8).toString('hex')}`;
}

function createMockCustomerId(): string {
  return `cust_${crypto.randomBytes(8).toString('hex')}`;
}

function createMockPlanId(): string {
  return `plan_${crypto.randomBytes(8).toString('hex')}`;
}

function createMockSubscriptionId(): string {
  return `sub_${crypto.randomBytes(8).toString('hex')}`;
}

function createMockPaymentId(): string {
  return `pay_${crypto.randomBytes(8).toString('hex')}`;
}

function createMockRefundId(): string {
  return `ref_${crypto.randomBytes(8).toString('hex')}`;
}

function createMockDisputeId(): string {
  return `disp_${crypto.randomBytes(8).toString('hex')}`;
}

function createMockIntentId(): string {
  return `int_${crypto.randomBytes(8).toString('hex')}`;
}

abstract class BasePaymentProvider implements IPaymentProvider {
  abstract readonly type: PaymentProviderType;
  protected customers: Map<string, Customer> = new Map();
  protected payments: Map<string, Payment> = new Map();
  protected refunds: Map<string, Refund> = new Map();
  protected disputes: Map<string, Dispute> = new Map();
  protected subscriptions: Map<string, Subscription> = new Map();
  protected plans: Map<string, Plan> = new Map();
  protected paymentIntents: Map<string, PaymentIntent> = new Map();
  protected webhookEvents: Map<string, WebhookEvent> = new Map();

  async createCustomer(email: string, name: string, metadata: Record<string, string> = {}): Promise<Customer> {
    const customer: Customer = {
      id: createMockCustomerId(),
      email,
      name,
      paymentMethods: [],
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.customers.set(customer.id, customer);
    return customer;
  }

  async getCustomer(customerId: string): Promise<Customer | null> {
    return this.customers.get(customerId) ?? null;
  }

  async updateCustomer(
    customerId: string,
    updates: Partial<Pick<Customer, 'email' | 'name' | 'billingAddress' | 'metadata'>>
  ): Promise<Customer> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }
    const updated: Customer = {
      ...customer,
      ...updates,
      metadata: { ...customer.metadata, ...updates.metadata },
      updatedAt: new Date(),
    };
    this.customers.set(customerId, updated);
    return updated;
  }

  async deleteCustomer(customerId: string): Promise<boolean> {
    return this.customers.delete(customerId);
  }

  async addPaymentMethod(customerId: string, paymentMethod: Omit<PaymentMethod, 'id'>): Promise<PaymentMethod> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }
    const newMethod: PaymentMethod = {
      ...paymentMethod,
      id: createMockPaymentMethodId(),
    };
    if (newMethod.isDefault && customer.paymentMethods.length > 0) {
      customer.paymentMethods.forEach((m) => (m.isDefault = false));
    }
    if (customer.paymentMethods.length === 0) {
      newMethod.isDefault = true;
    }
    customer.paymentMethods.push(newMethod);
    customer.updatedAt = new Date();
    return newMethod;
  }

  async getPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    const customer = this.customers.get(customerId);
    return customer?.paymentMethods ?? [];
  }

  async removePaymentMethod(customerId: string, paymentMethodId: string): Promise<boolean> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }
    const index = customer.paymentMethods.findIndex((m) => m.id === paymentMethodId);
    if (index === -1) return false;
    const [removed] = customer.paymentMethods.splice(index, 1);
    if (removed.isDefault && customer.paymentMethods.length > 0) {
      customer.paymentMethods[0].isDefault = true;
    }
    customer.updatedAt = new Date();
    return true;
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<boolean> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }
    const method = customer.paymentMethods.find((m) => m.id === paymentMethodId);
    if (!method) return false;
    customer.paymentMethods.forEach((m) => (m.isDefault = m.id === paymentMethodId));
    customer.defaultPaymentMethodId = paymentMethodId;
    customer.updatedAt = new Date();
    return true;
  }

  abstract authorizePayment(
    paymentMethodId: string,
    amount: number,
    currency: string,
    metadata?: PaymentMetadata
  ): Promise<Payment>;

  abstract capturePayment(paymentId: string, amount?: number): Promise<Payment>;

  abstract chargePayment(
    paymentMethodId: string,
    amount: number,
    currency: string,
    metadata?: PaymentMetadata
  ): Promise<Payment>;

  async refundPayment(options: RefundOptions): Promise<Refund> {
    const payment = this.payments.get(options.paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${options.paymentId}`);
    }
    const refundAmount = options.amount ?? payment.amount;
    const refund: Refund = {
      id: createMockRefundId(),
      paymentId: options.paymentId,
      provider: this.type,
      amount: refundAmount,
      currency: payment.currency,
      reason: options.reason,
      status: 'pending',
      createdAt: new Date(),
    };
    this.refunds.set(refund.id, refund);
    await new Promise<void>((resolve) => setTimeout(() => {
      refund.status = 'completed';
      refund.completedAt = new Date();
      payment.refundIds.push(refund.id);
      payment.state = 'refunded';
      payment.updatedAt = new Date();
      resolve();
    }, 100));
    return refund;
  }

  async getPayment(paymentId: string): Promise<Payment | null> {
    return this.payments.get(paymentId) ?? null;
  }

  async listPayments(customerId?: string, limit: number = 100): Promise<Payment[]> {
    let payments = Array.from(this.payments.values());
    if (customerId) {
      payments = payments.filter((p) => p.metadata.customerId === customerId);
    }
    return payments.slice(0, limit);
  }

  async createDispute(paymentId: string, reason: DisputeReason): Promise<Dispute> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }
    const dispute: Dispute = {
      id: createMockDisputeId(),
      paymentId,
      provider: this.type,
      amount: payment.amount,
      currency: payment.currency,
      reason,
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.disputes.set(dispute.id, dispute);
    payment.disputeIds.push(dispute.id);
    payment.updatedAt = new Date();
    return dispute;
  }

  async getDispute(disputeId: string): Promise<Dispute | null> {
    return this.disputes.get(disputeId) ?? null;
  }

  async submitDisputeEvidence(disputeId: string, _evidence: DisputeEvidence): Promise<Dispute> {
    const dispute = this.disputes.get(disputeId);
    if (!dispute) {
      throw new Error(`Dispute not found: ${disputeId}`);
    }
    dispute.updatedAt = new Date();
    return dispute;
  }

  async acceptDispute(disputeId: string): Promise<Dispute> {
    const dispute = this.disputes.get(disputeId);
    if (!dispute) {
      throw new Error(`Dispute not found: ${disputeId}`);
    }
    dispute.status = 'lost';
    dispute.closedAt = new Date();
    dispute.updatedAt = new Date();
    return dispute;
  }

  abstract createSubscription(
    customerId: string,
    planId: string,
    paymentMethodId?: string,
    couponCode?: string
  ): Promise<Subscription>;

  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    return this.subscriptions.get(subscriptionId) ?? null;
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true): Promise<Subscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }
    if (cancelAtPeriodEnd) {
      subscription.cancelAtPeriodEnd = true;
    } else {
      subscription.status = 'canceled';
      subscription.canceledAt = new Date();
    }
    subscription.updatedAt = new Date();
    return subscription;
  }

  async pauseSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }
    subscription.status = 'paused';
    subscription.pausedAt = new Date();
    subscription.updatedAt = new Date();
    return subscription;
  }

  async resumeSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }
    subscription.status = 'active';
    subscription.pausedAt = undefined;
    subscription.updatedAt = new Date();
    return subscription;
  }

  async updateSubscription(
    subscriptionId: string,
    updates: Partial<Pick<Subscription, 'paymentMethodId' | 'couponCode'>>
  ): Promise<Subscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }
    Object.assign(subscription, updates);
    subscription.updatedAt = new Date();
    return subscription;
  }

  async createPlan(plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>): Promise<Plan> {
    const newPlan: Plan = {
      ...plan,
      id: createMockPlanId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.plans.set(newPlan.id, newPlan);
    return newPlan;
  }

  async getPlan(planId: string): Promise<Plan | null> {
    return this.plans.get(planId) ?? null;
  }

  async updatePlan(planId: string, updates: Partial<Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Plan> {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }
    const updated: Plan = { ...plan, ...updates, updatedAt: new Date() };
    this.plans.set(planId, updated);
    return updated;
  }

  async deletePlan(planId: string): Promise<boolean> {
    return this.plans.delete(planId);
  }

  async listPlans(activeOnly: boolean = true): Promise<Plan[]> {
    let plans = Array.from(this.plans.values());
    if (activeOnly) {
      plans = plans.filter((p) => p.isActive);
    }
    return plans;
  }

  abstract processWebhook(payload: Record<string, unknown>, headers: Record<string, string>): Promise<WebhookEvent>;

  validateWebhookSignature(payload: string, signature: string, _secret?: string): boolean {
    const hash = crypto.createHash('sha256').update(payload).digest('hex');
    return signature === hash;
  }

  abstract createPaymentIntent(
    amount: number,
    currency: string,
    customerId?: string,
    metadata?: PaymentMetadata
  ): Promise<PaymentIntent>;

  async getPaymentIntent(intentId: string): Promise<PaymentIntent | null> {
    return this.paymentIntents.get(intentId) ?? null;
  }

  abstract confirmPaymentIntent(
    intentId: string,
    paymentMethodId: string,
    returnUrl?: string
  ): Promise<PaymentIntent>;

  async cancelPaymentIntent(intentId: string): Promise<PaymentIntent> {
    const intent = this.paymentIntents.get(intentId);
    if (!intent) {
      throw new Error(`Payment intent not found: ${intentId}`);
    }
    intent.state = 'failed';
    intent.updatedAt = new Date();
    return intent;
  }

  protected createPayment(
    paymentMethodId: string,
    amount: number,
    currency: string,
    metadata: PaymentMetadata,
    state: PaymentState = 'pending'
  ): Payment {
    const payment: Payment = {
      id: createMockPaymentId(),
      provider: this.type,
      amount,
      currency,
      state,
      paymentMethod: {
        id: paymentMethodId,
        type: 'card',
        isDefault: true,
      },
      metadata,
      refundIds: [],
      disputeIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.payments.set(payment.id, payment);
    return payment;
  }
}

class StripePaymentProvider extends BasePaymentProvider {
  public readonly type: PaymentProviderType = 'stripe';

  async authorizePayment(
    paymentMethodId: string,
    amount: number,
    currency: string,
    metadata?: PaymentMetadata
  ): Promise<Payment> {
    const payment = this.createPayment(paymentMethodId, amount, currency, metadata ?? {}, 'authorized');
    payment.authorizationCode = `auth_${crypto.randomBytes(8).toString('hex')}`;
    payment.updatedAt = new Date();
    return payment;
  }

  async capturePayment(paymentId: string, amount?: number): Promise<Payment> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }
    if (payment.state !== 'authorized') {
      throw new Error(`Payment not in authorized state: ${payment.state}`);
    }
    payment.state = 'captured';
    payment.captureId = `cap_${crypto.randomBytes(8).toString('hex')}`;
    payment.capturedAt = new Date();
    payment.updatedAt = new Date();
    if (amount && amount < payment.amount) {
      payment.amount = amount;
    }
    return payment;
  }

  async chargePayment(
    paymentMethodId: string,
    amount: number,
    currency: string,
    metadata?: PaymentMetadata
  ): Promise<Payment> {
    const payment = this.createPayment(paymentMethodId, amount, currency, metadata ?? {}, 'captured');
    payment.captureId = `cap_${crypto.randomBytes(8).toString('hex')}`;
    payment.capturedAt = new Date();
    payment.authorizationCode = `auth_${crypto.randomBytes(8).toString('hex')}`;
    return payment;
  }

  async createSubscription(
    customerId: string,
    planId: string,
    paymentMethodId?: string,
    _couponCode?: string
  ): Promise<Subscription> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }
    const now = new Date();
    const subscription: Subscription = {
      id: createMockSubscriptionId(),
      customerId,
      provider: this.type,
      planId,
      planName: plan.name,
      billingCycle: plan.billingCycle,
      amount: plan.amount,
      currency: plan.currency,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: calculateSubscriptionEndDate(now, plan.billingCycle),
      cancelAtPeriodEnd: false,
      paymentMethodId: paymentMethodId ?? customer.defaultPaymentMethodId,
      createdAt: now,
      updatedAt: now,
    };
    this.subscriptions.set(subscription.id, subscription);
    return subscription;
  }

  async processWebhook(payload: Record<string, unknown>, _headers: Record<string, string>): Promise<WebhookEvent> {
    const eventType = (payload.type as string) ?? 'unknown';
    const eventId = (payload.id as string) ?? generateWebhookEventId();
    const event: WebhookEvent = {
      id: eventId,
      provider: this.type,
      type: eventType,
      paymentId: payload.payment_id as string | undefined,
      subscriptionId: payload.subscription_id as string | undefined,
      data: payload,
      createdAt: new Date(),
      processed: false,
    };
    this.webhookEvents.set(event.id, event);
    await new Promise<void>((resolve) => setTimeout(() => {
      event.processed = true;
      event.processedAt = new Date();
      resolve();
    }, 100));
    return event;
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    customerId?: string,
    metadata?: PaymentMetadata
  ): Promise<PaymentIntent> {
    const intent: PaymentIntent = {
      id: createMockIntentId(),
      provider: this.type,
      amount,
      currency,
      state: 'pending',
      customerId,
      metadata: metadata ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.paymentIntents.set(intent.id, intent);
    return intent;
  }

  async confirmPaymentIntent(
    intentId: string,
    _paymentMethodId: string,
    _returnUrl?: string
  ): Promise<PaymentIntent> {
    const intent = this.paymentIntents.get(intentId);
    if (!intent) {
      throw new Error(`Payment intent not found: ${intentId}`);
    }
    intent.state = 'captured';
    intent.updatedAt = new Date();
    const payment = this.createPayment(
      intent.paymentMethodId ?? 'pm_unknown',
      intent.amount,
      intent.currency,
      intent.metadata,
      'captured'
    );
    intent.metadata.orderId = payment.id;
    return intent;
  }
}

class PayPalPaymentProvider extends BasePaymentProvider {
  public readonly type: PaymentProviderType = 'paypal';

  async authorizePayment(
    paymentMethodId: string,
    amount: number,
    currency: string,
    metadata?: PaymentMetadata
  ): Promise<Payment> {
    const payment = this.createPayment(paymentMethodId, amount, currency, metadata ?? {}, 'authorized');
    payment.authorizationCode = `AUTH-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    return payment;
  }

  async capturePayment(paymentId: string, amount?: number): Promise<Payment> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }
    payment.state = 'captured';
    payment.captureId = `CAPTURE-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    payment.capturedAt = new Date();
    payment.updatedAt = new Date();
    if (amount && amount < payment.amount) {
      payment.amount = amount;
    }
    return payment;
  }

  async chargePayment(
    paymentMethodId: string,
    amount: number,
    currency: string,
    metadata?: PaymentMetadata
  ): Promise<Payment> {
    const payment = this.createPayment(paymentMethodId, amount, currency, metadata ?? {}, 'captured');
    payment.captureId = `CAPTURE-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    payment.capturedAt = new Date();
    payment.authorizationCode = `AUTH-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    return payment;
  }

  async createSubscription(
    customerId: string,
    planId: string,
    paymentMethodId?: string,
    _couponCode?: string
  ): Promise<Subscription> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }
    const now = new Date();
    const subscription: Subscription = {
      id: createMockSubscriptionId(),
      customerId,
      provider: this.type,
      planId,
      planName: plan.name,
      billingCycle: plan.billingCycle,
      amount: plan.amount,
      currency: plan.currency,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: calculateSubscriptionEndDate(now, plan.billingCycle),
      cancelAtPeriodEnd: false,
      paymentMethodId: paymentMethodId ?? customer.defaultPaymentMethodId,
      createdAt: now,
      updatedAt: now,
    };
    this.subscriptions.set(subscription.id, subscription);
    return subscription;
  }

  async processWebhook(payload: Record<string, unknown>, _headers: Record<string, string>): Promise<WebhookEvent> {
    const eventType = (payload.event_type as string) ?? 'unknown';
    const event: WebhookEvent = {
      id: generateWebhookEventId(),
      provider: this.type,
      type: eventType,
      data: payload,
      createdAt: new Date(),
      processed: false,
    };
    this.webhookEvents.set(event.id, event);
    return event;
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    customerId?: string,
    metadata?: PaymentMetadata
  ): Promise<PaymentIntent> {
    const intent: PaymentIntent = {
      id: createMockIntentId(),
      provider: this.type,
      amount,
      currency,
      state: 'pending',
      customerId,
      metadata: metadata ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.paymentIntents.set(intent.id, intent);
    return intent;
  }

  async confirmPaymentIntent(
    intentId: string,
    _paymentMethodId: string,
    _returnUrl?: string
  ): Promise<PaymentIntent> {
    const intent = this.paymentIntents.get(intentId);
    if (!intent) {
      throw new Error(`Payment intent not found: ${intentId}`);
    }
    intent.state = 'captured';
    intent.updatedAt = new Date();
    return intent;
  }
}

class SquarePaymentProvider extends BasePaymentProvider {
  public readonly type: PaymentProviderType = 'square';

  async authorizePayment(
    paymentMethodId: string,
    amount: number,
    currency: string,
    metadata?: PaymentMetadata
  ): Promise<Payment> {
    const payment = this.createPayment(paymentMethodId, amount, currency, metadata ?? {}, 'authorized');
    payment.authorizationCode = `L${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    return payment;
  }

  async capturePayment(paymentId: string, amount?: number): Promise<Payment> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }
    payment.state = 'captured';
    payment.captureId = `CAP-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    payment.capturedAt = new Date();
    payment.updatedAt = new Date();
    if (amount && amount < payment.amount) {
      payment.amount = amount;
    }
    return payment;
  }

  async chargePayment(
    paymentMethodId: string,
    amount: number,
    currency: string,
    metadata?: PaymentMetadata
  ): Promise<Payment> {
    const payment = this.createPayment(paymentMethodId, amount, currency, metadata ?? {}, 'captured');
    payment.captureId = `CAP-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    payment.capturedAt = new Date();
    payment.authorizationCode = `L${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    return payment;
  }

  async createSubscription(
    customerId: string,
    planId: string,
    paymentMethodId?: string,
    _couponCode?: string
  ): Promise<Subscription> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }
    const now = new Date();
    const subscription: Subscription = {
      id: createMockSubscriptionId(),
      customerId,
      provider: this.type,
      planId,
      planName: plan.name,
      billingCycle: plan.billingCycle,
      amount: plan.amount,
      currency: plan.currency,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: calculateSubscriptionEndDate(now, plan.billingCycle),
      cancelAtPeriodEnd: false,
      paymentMethodId: paymentMethodId ?? customer.defaultPaymentMethodId,
      createdAt: now,
      updatedAt: now,
    };
    this.subscriptions.set(subscription.id, subscription);
    return subscription;
  }

  async processWebhook(payload: Record<string, unknown>, _headers: Record<string, string>): Promise<WebhookEvent> {
    const eventType = (payload.event_type as string) ?? 'unknown';
    const event: WebhookEvent = {
      id: generateWebhookEventId(),
      provider: this.type,
      type: eventType,
      data: payload,
      createdAt: new Date(),
      processed: false,
    };
    this.webhookEvents.set(event.id, event);
    return event;
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    customerId?: string,
    metadata?: PaymentMetadata
  ): Promise<PaymentIntent> {
    const intent: PaymentIntent = {
      id: createMockIntentId(),
      provider: this.type,
      amount,
      currency,
      state: 'pending',
      customerId,
      metadata: metadata ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.paymentIntents.set(intent.id, intent);
    return intent;
  }

  async confirmPaymentIntent(
    intentId: string,
    _paymentMethodId: string,
    _returnUrl?: string
  ): Promise<PaymentIntent> {
    const intent = this.paymentIntents.get(intentId);
    if (!intent) {
      throw new Error(`Payment intent not found: ${intentId}`);
    }
    intent.state = 'captured';
    intent.updatedAt = new Date();
    return intent;
  }
}

class AdyenPaymentProvider extends BasePaymentProvider {
  public readonly type: PaymentProviderType = 'adyen';

  async authorizePayment(
    paymentMethodId: string,
    amount: number,
    currency: string,
    metadata?: PaymentMetadata
  ): Promise<Payment> {
    const payment = this.createPayment(paymentMethodId, amount, currency, metadata ?? {}, 'authorized');
    payment.authorizationCode = crypto.randomBytes(6).toString('hex').toUpperCase();
    return payment;
  }

  async capturePayment(paymentId: string, amount?: number): Promise<Payment> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }
    payment.state = 'captured';
    payment.captureId = crypto.randomBytes(8).toString('hex').toUpperCase();
    payment.capturedAt = new Date();
    payment.updatedAt = new Date();
    if (amount && amount < payment.amount) {
      payment.amount = amount;
    }
    return payment;
  }

  async chargePayment(
    paymentMethodId: string,
    amount: number,
    currency: string,
    metadata?: PaymentMetadata
  ): Promise<Payment> {
    const payment = this.createPayment(paymentMethodId, amount, currency, metadata ?? {}, 'captured');
    payment.captureId = crypto.randomBytes(8).toString('hex').toUpperCase();
    payment.capturedAt = new Date();
    payment.authorizationCode = crypto.randomBytes(6).toString('hex').toUpperCase();
    return payment;
  }

  async createSubscription(
    customerId: string,
    planId: string,
    paymentMethodId?: string,
    _couponCode?: string
  ): Promise<Subscription> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }
    const now = new Date();
    const subscription: Subscription = {
      id: createMockSubscriptionId(),
      customerId,
      provider: this.type,
      planId,
      planName: plan.name,
      billingCycle: plan.billingCycle,
      amount: plan.amount,
      currency: plan.currency,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: calculateSubscriptionEndDate(now, plan.billingCycle),
      cancelAtPeriodEnd: false,
      paymentMethodId: paymentMethodId ?? customer.defaultPaymentMethodId,
      createdAt: now,
      updatedAt: now,
    };
    this.subscriptions.set(subscription.id, subscription);
    return subscription;
  }

  async processWebhook(payload: Record<string, unknown>, _headers: Record<string, string>): Promise<WebhookEvent> {
    const eventType = (payload.eventCode as string) ?? 'unknown';
    const event: WebhookEvent = {
      id: generateWebhookEventId(),
      provider: this.type,
      type: eventType,
      data: payload,
      createdAt: new Date(),
      processed: false,
    };
    this.webhookEvents.set(event.id, event);
    return event;
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    customerId?: string,
    metadata?: PaymentMetadata
  ): Promise<PaymentIntent> {
    const intent: PaymentIntent = {
      id: createMockIntentId(),
      provider: this.type,
      amount,
      currency,
      state: 'pending',
      customerId,
      metadata: metadata ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.paymentIntents.set(intent.id, intent);
    return intent;
  }

  async confirmPaymentIntent(
    intentId: string,
    _paymentMethodId: string,
    _returnUrl?: string
  ): Promise<PaymentIntent> {
    const intent = this.paymentIntents.get(intentId);
    if (!intent) {
      throw new Error(`Payment intent not found: ${intentId}`);
    }
    intent.state = 'captured';
    intent.updatedAt = new Date();
    return intent;
  }
}

export function createPaymentProvider(type: PaymentProviderType): IPaymentProvider {
  switch (type) {
    case 'stripe':
      return new StripePaymentProvider();
    case 'paypal':
      return new PayPalPaymentProvider();
    case 'square':
      return new SquarePaymentProvider();
    case 'adyen':
      return new AdyenPaymentProvider();
    default:
      throw new Error(`Unsupported payment provider type: ${type}`);
  }
}

export function createPaymentGateway(initialConfig: Partial<PaymentGatewayConfig> = {}) {
  const providers = new Map<PaymentProviderType, IPaymentProvider>();

  providers.set('stripe', new StripePaymentProvider());
  providers.set('paypal', new PayPalPaymentProvider());
  providers.set('square', new SquarePaymentProvider());
  providers.set('adyen', new AdyenPaymentProvider());

  const gatewayConfig: PaymentGatewayConfig = {
    defaultProvider: initialConfig.defaultProvider ?? 'stripe',
    providers,
    webhookSecret: initialConfig.webhookSecret,
    apiVersion: initialConfig.apiVersion ?? '2024-01-01',
  };

  const getProvider = (type?: PaymentProviderType): IPaymentProvider => {
    const providerType = type ?? gatewayConfig.defaultProvider;
    const provider = providers.get(providerType);
    if (!provider) {
      throw new Error(`Provider not found for type: ${providerType}`);
    }
    return provider;
  };

  const addProvider = (type: PaymentProviderType, provider: IPaymentProvider): void => {
    providers.set(type, provider);
  };

  const createCustomer = async (
    email: string,
    name: string,
    metadata?: Record<string, string>
  ): Promise<Customer> => {
    const provider = getProvider();
    return provider.createCustomer(email, name, metadata);
  };

  const getCustomer = async (customerId: string): Promise<Customer | null> => {
    const provider = getProvider();
    return provider.getCustomer(customerId);
  };

  const updateCustomer = async (
    customerId: string,
    updates: Partial<Pick<Customer, 'email' | 'name' | 'billingAddress' | 'metadata'>>
  ): Promise<Customer> => {
    const provider = getProvider();
    return provider.updateCustomer(customerId, updates);
  };

  const deleteCustomer = async (customerId: string): Promise<boolean> => {
    const provider = getProvider();
    return provider.deleteCustomer(customerId);
  };

  const addPaymentMethod = async (
    customerId: string,
    paymentMethod: Omit<PaymentMethod, 'id'>
  ): Promise<PaymentMethod> => {
    const provider = getProvider();
    return provider.addPaymentMethod(customerId, paymentMethod);
  };

  const getPaymentMethods = async (customerId: string): Promise<PaymentMethod[]> => {
    const provider = getProvider();
    return provider.getPaymentMethods(customerId);
  };

  const removePaymentMethod = async (customerId: string, paymentMethodId: string): Promise<boolean> => {
    const provider = getProvider();
    return provider.removePaymentMethod(customerId, paymentMethodId);
  };

  const setDefaultPaymentMethod = async (
    customerId: string,
    paymentMethodId: string
  ): Promise<boolean> => {
    const provider = getProvider();
    return provider.setDefaultPaymentMethod(customerId, paymentMethodId);
  };

  const authorizePayment = async (
    paymentMethodId: string,
    amount: number,
    currency: string,
    metadata?: PaymentMetadata
  ): Promise<Payment> => {
    const provider = getProvider();
    return provider.authorizePayment(paymentMethodId, amount, currency, metadata);
  };

  const capturePayment = async (paymentId: string, amount?: number): Promise<Payment> => {
    const provider = getProvider();
    return provider.capturePayment(paymentId, amount);
  };

  const chargePayment = async (
    paymentMethodId: string,
    amount: number,
    currency: string,
    metadata?: PaymentMetadata
  ): Promise<Payment> => {
    const provider = getProvider();
    return provider.chargePayment(paymentMethodId, amount, currency, metadata);
  };

  const refundPayment = async (options: RefundOptions): Promise<Refund> => {
    const provider = getProvider();
    return provider.refundPayment(options);
  };

  const getPayment = async (paymentId: string): Promise<Payment | null> => {
    const provider = getProvider();
    return provider.getPayment(paymentId);
  };

  const listPayments = async (customerId?: string, limit?: number): Promise<Payment[]> => {
    const provider = getProvider();
    return provider.listPayments(customerId, limit);
  };

  const createDispute = async (paymentId: string, reason: DisputeReason): Promise<Dispute> => {
    const provider = getProvider();
    return provider.createDispute(paymentId, reason);
  };

  const getDispute = async (disputeId: string): Promise<Dispute | null> => {
    const provider = getProvider();
    return provider.getDispute(disputeId);
  };

  const submitDisputeEvidence = async (
    disputeId: string,
    evidence: DisputeEvidence
  ): Promise<Dispute> => {
    const provider = getProvider();
    return provider.submitDisputeEvidence(disputeId, evidence);
  };

  const acceptDispute = async (disputeId: string): Promise<Dispute> => {
    const provider = getProvider();
    return provider.acceptDispute(disputeId);
  };

  const createSubscription = async (
    customerId: string,
    planId: string,
    paymentMethodId?: string,
    couponCode?: string
  ): Promise<Subscription> => {
    const provider = getProvider();
    return provider.createSubscription(customerId, planId, paymentMethodId, couponCode);
  };

  const getSubscription = async (subscriptionId: string): Promise<Subscription | null> => {
    const provider = getProvider();
    return provider.getSubscription(subscriptionId);
  };

  const cancelSubscription = async (
    subscriptionId: string,
    cancelAtPeriodEnd?: boolean
  ): Promise<Subscription> => {
    const provider = getProvider();
    return provider.cancelSubscription(subscriptionId, cancelAtPeriodEnd);
  };

  const pauseSubscription = async (subscriptionId: string): Promise<Subscription> => {
    const provider = getProvider();
    return provider.pauseSubscription(subscriptionId);
  };

  const resumeSubscription = async (subscriptionId: string): Promise<Subscription> => {
    const provider = getProvider();
    return provider.resumeSubscription(subscriptionId);
  };

  const updateSubscription = async (
    subscriptionId: string,
    updates: Partial<Pick<Subscription, 'paymentMethodId' | 'couponCode'>>
  ): Promise<Subscription> => {
    const provider = getProvider();
    return provider.updateSubscription(subscriptionId, updates);
  };

  const createPlan = async (
    plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Plan> => {
    const provider = getProvider();
    return provider.createPlan(plan);
  };

  const getPlan = async (planId: string): Promise<Plan | null> => {
    const provider = getProvider();
    return provider.getPlan(planId);
  };

  const updatePlan = async (
    planId: string,
    updates: Partial<Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Plan> => {
    const provider = getProvider();
    return provider.updatePlan(planId, updates);
  };

  const deletePlan = async (planId: string): Promise<boolean> => {
    const provider = getProvider();
    return provider.deletePlan(planId);
  };

  const listPlans = async (activeOnly?: boolean): Promise<Plan[]> => {
    const provider = getProvider();
    return provider.listPlans(activeOnly);
  };

  const processWebhook = async (
    providerType: PaymentProviderType,
    payload: Record<string, unknown>,
    headers: Record<string, string>
  ): Promise<WebhookEvent> => {
    const provider = getProvider(providerType);
    return provider.processWebhook(payload, headers);
  };

  const validateWebhookSignature = async (
    providerType: PaymentProviderType,
    payload: string,
    signature: string,
    secret?: string
  ): Promise<boolean> => {
    const provider = getProvider(providerType);
    return provider.validateWebhookSignature(payload, signature, secret);
  };

  const createPaymentIntent = async (
    amount: number,
    currency: string,
    customerId?: string,
    metadata?: PaymentMetadata
  ): Promise<PaymentIntent> => {
    const provider = getProvider();
    return provider.createPaymentIntent(amount, currency, customerId, metadata);
  };

  const getPaymentIntent = async (intentId: string): Promise<PaymentIntent | null> => {
    const provider = getProvider();
    return provider.getPaymentIntent(intentId);
  };

  const confirmPaymentIntent = async (
    intentId: string,
    paymentMethodId: string,
    returnUrl?: string
  ): Promise<PaymentIntent> => {
    const provider = getProvider();
    return provider.confirmPaymentIntent(intentId, paymentMethodId, returnUrl);
  };

  const cancelPaymentIntent = async (intentId: string): Promise<PaymentIntent> => {
    const provider = getProvider();
    return provider.cancelPaymentIntent(intentId);
  };

  return {
    config: gatewayConfig,
    getProvider,
    addProvider,
    createCustomer,
    getCustomer,
    updateCustomer,
    deleteCustomer,
    addPaymentMethod,
    getPaymentMethods,
    removePaymentMethod,
    setDefaultPaymentMethod,
    authorizePayment,
    capturePayment,
    chargePayment,
    refundPayment,
    getPayment,
    listPayments,
    createDispute,
    getDispute,
    submitDisputeEvidence,
    acceptDispute,
    createSubscription,
    getSubscription,
    cancelSubscription,
    pauseSubscription,
    resumeSubscription,
    updateSubscription,
    createPlan,
    getPlan,
    updatePlan,
    deletePlan,
    listPlans,
    processWebhook,
    validateWebhookSignature,
    createPaymentIntent,
    getPaymentIntent,
    confirmPaymentIntent,
    cancelPaymentIntent,
  };
}

export type PaymentGateway = ReturnType<typeof createPaymentGateway>;

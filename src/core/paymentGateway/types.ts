import crypto from 'crypto';

export type PaymentProviderType = 'stripe' | 'paypal' | 'square' | 'adyen';

export type PaymentState = 'pending' | 'authorized' | 'captured' | 'refunded' | 'failed';

export type BillingCycle = 'monthly' | 'yearly' | 'weekly';

export type DisputeReason = 'fraudulent' | 'duplicate' | 'product_not_received' | 'product_unacceptable' | 'subscription_canceled';

export type DisputeStatus = 'open' | 'won' | 'lost' | 'closed';

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'paypal' | 'other';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

export interface BillingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface PaymentMetadata {
  customerId?: string;
  orderId?: string;
  invoiceId?: string;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, string>;
}

export interface Payment {
  id: string;
  provider: PaymentProviderType;
  amount: number;
  currency: string;
  state: PaymentState;
  paymentMethod: PaymentMethod;
  billingAddress?: BillingAddress;
  metadata: PaymentMetadata;
  authorizationCode?: string;
  captureId?: string;
  refundIds: string[];
  disputeIds: string[];
  createdAt: Date;
  updatedAt: Date;
  capturedAt?: Date;
  failedAt?: Date;
}

export interface AuthorizationDetails {
  authorizationCode: string;
  authorizedAmount: number;
  expiresAt: Date;
}

export interface CaptureDetails {
  captureId: string;
  capturedAmount: number;
  capturedAt: Date;
}

export interface Refund {
  id: string;
  paymentId: string;
  provider: PaymentProviderType;
  amount: number;
  currency: string;
  reason?: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

export interface Dispute {
  id: string;
  paymentId: string;
  provider: PaymentProviderType;
  amount: number;
  currency: string;
  reason: DisputeReason;
  status: DisputeStatus;
  evidenceDeadline?: Date;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

export interface WebhookEvent {
  id: string;
  provider: PaymentProviderType;
  type: string;
  paymentId?: string;
  subscriptionId?: string;
  data: Record<string, unknown>;
  createdAt: Date;
  processedAt?: Date;
  processed: boolean;
}

export interface Subscription {
  id: string;
  customerId: string;
  provider: PaymentProviderType;
  planId: string;
  planName: string;
  billingCycle: BillingCycle;
  amount: number;
  currency: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  paymentMethodId?: string;
  couponCode?: string;
  createdAt: Date;
  updatedAt: Date;
  canceledAt?: Date;
  pausedAt?: Date;
}

export interface Plan {
  id: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  trialDays: number;
  metadata: Record<string, string>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  paymentMethods: PaymentMethod[];
  defaultPaymentMethodId?: string;
  billingAddress?: BillingAddress;
  metadata: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentIntent {
  id: string;
  provider: PaymentProviderType;
  amount: number;
  currency: string;
  state: PaymentState;
  customerId?: string;
  paymentMethodId?: string;
  returnUrl?: string;
  metadata: PaymentMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefundOptions {
  paymentId: string;
  amount?: number;
  reason?: string;
  isPartial?: boolean;
}

export interface DisputeEvidence {
  disputeId: string;
  productDescription?: string;
  customerEmail?: string;
  customerName?: string;
  customerSignature?: string;
  billingAddress?: BillingAddress;
  receipt?: string;
  shippingDocumentation?: string;
  communication?: string;
}

export interface PaymentGatewayConfig {
  defaultProvider: PaymentProviderType;
  providers: Map<PaymentProviderType, IPaymentProvider>;
  webhookSecret?: string;
  apiVersion?: string;
}

export interface PaymentProviderCredentials {
  apiKey: string;
  apiSecret?: string;
  merchantId?: string;
  environment?: 'sandbox' | 'production';
  webhookSigningSecret?: string;
}

export interface ChargebackOptions {
  paymentId: string;
  amount?: number;
  reason: DisputeReason;
  evidence?: DisputeEvidence;
}

export interface IPaymentProvider {
  readonly type: PaymentProviderType;

  createCustomer(email: string, name: string, metadata?: Record<string, string>): Promise<Customer>;
  getCustomer(customerId: string): Promise<Customer | null>;
  updateCustomer(customerId: string, updates: Partial<Pick<Customer, 'email' | 'name' | 'billingAddress' | 'metadata'>>): Promise<Customer>;
  deleteCustomer(customerId: string): Promise<boolean>;

  addPaymentMethod(customerId: string, paymentMethod: Omit<PaymentMethod, 'id'>): Promise<PaymentMethod>;
  getPaymentMethods(customerId: string): Promise<PaymentMethod[]>;
  removePaymentMethod(customerId: string, paymentMethodId: string): Promise<boolean>;
  setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<boolean>;

  authorizePayment(paymentMethodId: string, amount: number, currency: string, metadata?: PaymentMetadata): Promise<Payment>;
  capturePayment(paymentId: string, amount?: number): Promise<Payment>;
  chargePayment(paymentMethodId: string, amount: number, currency: string, metadata?: PaymentMetadata): Promise<Payment>;
  refundPayment(options: RefundOptions): Promise<Refund>;

  getPayment(paymentId: string): Promise<Payment | null>;
  listPayments(customerId?: string, limit?: number): Promise<Payment[]>;

  createDispute(paymentId: string, reason: DisputeReason): Promise<Dispute>;
  getDispute(disputeId: string): Promise<Dispute | null>;
  submitDisputeEvidence(disputeId: string, evidence: DisputeEvidence): Promise<Dispute>;
  acceptDispute(disputeId: string): Promise<Dispute>;

  createSubscription(customerId: string, planId: string, paymentMethodId?: string, couponCode?: string): Promise<Subscription>;
  getSubscription(subscriptionId: string): Promise<Subscription | null>;
  cancelSubscription(subscriptionId: string, cancelAtPeriodEnd?: boolean): Promise<Subscription>;
  pauseSubscription(subscriptionId: string): Promise<Subscription>;
  resumeSubscription(subscriptionId: string): Promise<Subscription>;
  updateSubscription(subscriptionId: string, updates: Partial<Pick<Subscription, 'paymentMethodId' | 'couponCode'>>): Promise<Subscription>;

  createPlan(plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>): Promise<Plan>;
  getPlan(planId: string): Promise<Plan | null>;
  updatePlan(planId: string, updates: Partial<Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Plan>;
  deletePlan(planId: string): Promise<boolean>;
  listPlans(activeOnly?: boolean): Promise<Plan[]>;

  processWebhook(payload: Record<string, unknown>, headers: Record<string, string>): Promise<WebhookEvent>;
  validateWebhookSignature(payload: string, signature: string, secret?: string): boolean;

  createPaymentIntent(amount: number, currency: string, customerId?: string, metadata?: PaymentMetadata): Promise<PaymentIntent>;
  getPaymentIntent(intentId: string): Promise<PaymentIntent | null>;
  confirmPaymentIntent(intentId: string, paymentMethodId: string, returnUrl?: string): Promise<PaymentIntent>;
  cancelPaymentIntent(intentId: string): Promise<PaymentIntent>;
}

export function generatePaymentId(): string {
  return `pay_${crypto.randomBytes(8).toString('hex')}`;
}

export function generateRefundId(): string {
  return `ref_${crypto.randomBytes(8).toString('hex')}`;
}

export function generateDisputeId(): string {
  return `disp_${crypto.randomBytes(8).toString('hex')}`;
}

export function generateSubscriptionId(): string {
  return `sub_${crypto.randomBytes(8).toString('hex')}`;
}

export function generatePlanId(): string {
  return `plan_${crypto.randomBytes(8).toString('hex')}`;
}

export function generateCustomerId(): string {
  return `cust_${crypto.randomBytes(8).toString('hex')}`;
}

export function generatePaymentMethodId(): string {
  return `pm_${crypto.randomBytes(8).toString('hex')}`;
}

export function generateIntentId(): string {
  return `int_${crypto.randomBytes(8).toString('hex')}`;
}

export function generateWebhookEventId(): string {
  return `wh_${crypto.randomBytes(8).toString('hex')}`;
}

export function formatCurrency(amount: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${(amount / 100).toFixed(2)}`;
}

function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    usd: '$',
    eur: '€',
    gbp: '£',
    jpy: '¥',
    cad: 'C$',
    aud: 'A$',
    chf: 'CHF',
  };
  return symbols[currency.toLowerCase()] ?? currency.toUpperCase() + ' ';
}

export function calculateRefundAmount(payment: Payment, refundOptions?: RefundOptions): number {
  if (!refundOptions?.isPartial || !refundOptions.amount) {
    return payment.amount;
  }
  return Math.min(refundOptions.amount, payment.amount);
}

export function isValidPaymentState(state: string): state is PaymentState {
  return ['pending', 'authorized', 'captured', 'refunded', 'failed'].includes(state);
}

export function isValidBillingCycle(cycle: string): cycle is BillingCycle {
  return ['monthly', 'yearly', 'weekly'].includes(cycle);
}

export function isValidPaymentProvider(type: string): type is PaymentProviderType {
  return ['stripe', 'paypal', 'square', 'adyen'].includes(type);
}

export function isValidDisputeReason(reason: string): reason is DisputeReason {
  return ['fraudulent', 'duplicate', 'product_not_received', 'product_unacceptable', 'subscription_canceled'].includes(reason);
}

export function isValidDisputeStatus(status: string): status is DisputeStatus {
  return ['open', 'won', 'lost', 'closed'].includes(status);
}

export function isPayment(obj: unknown): obj is Payment {
  if (typeof obj !== 'object' || obj === null) return false;
  const payment = obj as Record<string, unknown>;
  return (
    typeof payment.id === 'string' &&
    isValidPaymentProvider(payment.provider as string) &&
    typeof payment.amount === 'number' &&
    typeof payment.currency === 'string' &&
    isValidPaymentState(payment.state as string) &&
    isPaymentMethod(payment.paymentMethod)
  );
}

export function isPaymentMethod(obj: unknown): obj is PaymentMethod {
  if (typeof obj !== 'object' || obj === null) return false;
  const method = obj as Record<string, unknown>;
  return (
    typeof method.id === 'string' &&
    typeof method.type === 'string' &&
    typeof method.isDefault === 'boolean'
  );
}

export function isRefund(obj: unknown): obj is Refund {
  if (typeof obj !== 'object' || obj === null) return false;
  const refund = obj as Record<string, unknown>;
  return (
    typeof refund.id === 'string' &&
    typeof refund.paymentId === 'string' &&
    typeof refund.amount === 'number' &&
    typeof refund.currency === 'string' &&
    typeof refund.status === 'string'
  );
}

export function isDispute(obj: unknown): obj is Dispute {
  if (typeof obj !== 'object' || obj === null) return false;
  const dispute = obj as Record<string, unknown>;
  return (
    typeof dispute.id === 'string' &&
    typeof dispute.paymentId === 'string' &&
    typeof dispute.amount === 'number' &&
    typeof dispute.reason === 'string' &&
    isValidDisputeStatus(dispute.status as string)
  );
}

export function isSubscription(obj: unknown): obj is Subscription {
  if (typeof obj !== 'object' || obj === null) return false;
  const sub = obj as Record<string, unknown>;
  return (
    typeof sub.id === 'string' &&
    typeof sub.customerId === 'string' &&
    typeof sub.planId === 'string' &&
    typeof sub.amount === 'number' &&
    isValidBillingCycle(sub.billingCycle as string) &&
    typeof sub.status === 'string'
  );
}

export function isPlan(obj: unknown): obj is Plan {
  if (typeof obj !== 'object' || obj === null) return false;
  const plan = obj as Record<string, unknown>;
  return (
    typeof plan.id === 'string' &&
    typeof plan.name === 'string' &&
    typeof plan.amount === 'number' &&
    typeof plan.currency === 'string' &&
    isValidBillingCycle(plan.billingCycle as string)
  );
}

export function isCustomer(obj: unknown): obj is Customer {
  if (typeof obj !== 'object' || obj === null) return false;
  const customer = obj as Record<string, unknown>;
  return (
    typeof customer.id === 'string' &&
    typeof customer.email === 'string' &&
    typeof customer.name === 'string' &&
    Array.isArray(customer.paymentMethods)
  );
}

export function isWebhookEvent(obj: unknown): obj is WebhookEvent {
  if (typeof obj !== 'object' || obj === null) return false;
  const event = obj as Record<string, unknown>;
  return (
    typeof event.id === 'string' &&
    typeof event.type === 'string' &&
    isValidPaymentProvider(event.provider as string)
  );
}

export function isPaymentIntent(obj: unknown): obj is PaymentIntent {
  if (typeof obj !== 'object' || obj === null) return false;
  const intent = obj as Record<string, unknown>;
  return (
    typeof intent.id === 'string' &&
    typeof intent.amount === 'number' &&
    typeof intent.currency === 'string' &&
    isValidPaymentState(intent.state as string)
  );
}

export function calculateSubscriptionEndDate(startDate: Date, billingCycle: BillingCycle): Date {
  const endDate = new Date(startDate);
  switch (billingCycle) {
    case 'weekly':
      endDate.setDate(endDate.getDate() + 7);
      break;
    case 'monthly':
      endDate.setMonth(endDate.getMonth() + 1);
      break;
    case 'yearly':
      endDate.setFullYear(endDate.getFullYear() + 1);
      break;
  }
  return endDate;
}

export function calculateTrialEndDate(startDate: Date, trialDays: number): Date {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + trialDays);
  return endDate;
}

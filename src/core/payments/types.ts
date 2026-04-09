/**
 * Stripe Payment Processing Types
 * Types for payment processing, subscriptions, and billing operations
 */

export type PaymentMethodType = 'credit_card' | 'apple_pay' | 'google_pay' | 'bank_transfer';
export type SubscriptionStatus = 'active' | 'paused' | 'canceled' | 'past_due' | 'incomplete';
export type BillingCycle = 'monthly' | 'annual' | 'quarterly' | 'weekly';
export type PricingModel = 'fixed' | 'per_unit' | 'tiered' | 'metered';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded' | 'disputed';
export type TransactionType = 'charge' | 'refund' | 'subscription_payment' | 'proration';

export interface Price {
  priceId: string;
  productId: string;
  amount: number; // in cents
  currency: string; // e.g., 'usd'
  billingCycle: BillingCycle;
  pricingModel: PricingModel;
  isRecurring: boolean;
  metadata?: Record<string, unknown>;
}

export interface Product {
  productId: string;
  name: string;
  description?: string;
  prices: Price[];
  metadata?: Record<string, unknown>;
  active: boolean;
}

export interface PaymentMethod {
  paymentMethodId: string;
  type: PaymentMethodType;
  isDefault: boolean;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  cardholderName?: string;
  brand?: string; // visa, mastercard, etc.
  createdAt: Date;
}

export interface Invoice {
  invoiceId: string;
  customerId: string;
  subscriptionId?: string;
  amount: number; // in cents
  currency: string;
  status: PaymentStatus;
  paidAt?: Date;
  dueDate: Date;
  items: InvoiceLineItem[];
  pdfUrl?: string;
  createdAt: Date;
}

export interface InvoiceLineItem {
  itemId: string;
  description: string;
  quantity: number;
  unitPrice: number; // in cents
  amount: number; // in cents (quantity * unitPrice)
  priceId?: string;
}

export interface Subscription {
  subscriptionId: string;
  customerId: string;
  priceId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  endedAt?: Date;
  nextBillingDate?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface SubscriptionItem {
  itemId: string;
  subscriptionId: string;
  priceId: string;
  quantity: number;
  billingThresholds?: {
    usageGte: number;
  };
}

export interface UsageRecord {
  recordId: string;
  subscriptionItemId: string;
  quantity: number;
  timestamp: Date;
  action: 'set' | 'increment'; // increment adds to existing, set replaces
}

export interface Customer {
  customerId: string;
  email: string;
  name: string;
  phoneNumber?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  paymentMethods: PaymentMethod[];
  defaultPaymentMethodId?: string;
  subscriptions: Subscription[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface Charge {
  chargeId: string;
  customerId: string;
  amount: number; // in cents
  currency: string;
  status: PaymentStatus;
  description?: string;
  paymentMethodId?: string;
  receiptUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface Refund {
  refundId: string;
  chargeId: string;
  amount: number; // in cents
  reason?: string;
  status: PaymentStatus;
  createdAt: Date;
}

export interface Dispute {
  disputeId: string;
  chargeId: string;
  amount: number; // in cents
  reason: string;
  status: 'warning_under_review' | 'under_review' | 'warning_needs_response' | 'needs_response' | 'won' | 'lost';
  evidenceDeadline?: Date;
  createdAt: Date;
}

export interface CheckoutSession {
  sessionId: string;
  customerId?: string;
  lineItems: Array<{ priceId: string; quantity: number }>;
  mode: 'payment' | 'subscription' | 'setup';
  paymentMethodTypes: PaymentMethod[];
  successUrl: string;
  cancelUrl: string;
  expiresAt: Date;
  status: 'open' | 'complete' | 'expired';
  url: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface BillingPortalSession {
  sessionId: string;
  customerId: string;
  url: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface WebhookEvent {
  eventId: string;
  type: string; // e.g., 'charge.succeeded', 'customer.subscription.updated'
  data: Record<string, unknown>;
  processedAt?: Date;
  createdAt: Date;
}

export interface PricingTier {
  upTo: number | null; // null means unlimited
  unitPrice: number; // in cents
}

export interface PricingPlan {
  planId: string;
  name: string;
  description?: string;
  tiers: PricingTier[];
  currency: string;
  billingCycle: BillingCycle;
  trialDays?: number;
}

export interface BillingReport {
  reportId: string;
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  totalRevenue: number; // in cents
  totalCharges: number;
  successfulCharges: number;
  failedCharges: number;
  totalRefunds: number; // in cents
  refundCount: number;
  activeSubscriptions: number;
  newSubscriptions: number;
  canceledSubscriptions: number;
  churnRate: number; // percentage
  averageOrderValue: number; // in cents
  topProducts: Array<{ productId: string; name: string; revenue: number }>;
}

export interface PaymentProcessor {
  // Customer management
  createCustomer(customer: Omit<Customer, 'customerId' | 'createdAt' | 'paymentMethods' | 'subscriptions'>): Promise<Customer>;
  getCustomer(customerId: string): Promise<Customer | null>;
  updateCustomer(customerId: string, updates: Partial<Customer>): Promise<Customer>;
  deleteCustomer(customerId: string): Promise<void>;

  // Payment methods
  addPaymentMethod(customerId: string, paymentMethod: Omit<PaymentMethod, 'paymentMethodId' | 'createdAt'>): Promise<PaymentMethod>;
  setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>;
  removePaymentMethod(customerId: string, paymentMethodId: string): Promise<void>;

  // Products and pricing
  createProduct(product: Omit<Product, 'productId'>): Promise<Product>;
  getProduct(productId: string): Promise<Product | null>;
  createPrice(price: Omit<Price, 'priceId'>): Promise<Price>;

  // Checkout and payments
  createCheckoutSession(session: Omit<CheckoutSession, 'sessionId' | 'createdAt'>): Promise<CheckoutSession>;
  getCheckoutSession(sessionId: string): Promise<CheckoutSession | null>;
  createCharge(charge: Omit<Charge, 'chargeId' | 'createdAt'>): Promise<Charge>;
  getCharge(chargeId: string): Promise<Charge | null>;

  // Subscriptions
  createSubscription(subscription: Omit<Subscription, 'subscriptionId' | 'createdAt'>): Promise<Subscription>;
  getSubscription(subscriptionId: string): Promise<Subscription | null>;
  updateSubscription(subscriptionId: string, updates: Partial<Subscription>): Promise<Subscription>;
  cancelSubscription(subscriptionId: string, atPeriodEnd?: boolean): Promise<Subscription>;
  pauseSubscription(subscriptionId: string): Promise<Subscription>;
  resumeSubscription(subscriptionId: string): Promise<Subscription>;

  // Usage-based billing
  recordUsage(subscriptionItemId: string, quantity: number, action: 'set' | 'increment'): Promise<UsageRecord>;
  getUsageRecords(subscriptionItemId: string, startDate: Date, endDate: Date): Promise<UsageRecord[]>;

  // Invoices
  getInvoice(invoiceId: string): Promise<Invoice | null>;
  listInvoices(customerId: string): Promise<Invoice[]>;
  retryInvoice(invoiceId: string): Promise<Invoice>;

  // Refunds and disputes
  createRefund(chargeId: string, amount?: number, reason?: string): Promise<Refund>;
  getRefund(refundId: string): Promise<Refund | null>;
  createDispute(chargeId: string, reason: string): Promise<Dispute>;

  // Billing portal
  createBillingPortalSession(customerId: string): Promise<BillingPortalSession>;

  // Webhooks
  registerWebhookHandler(eventType: string, handler: (event: WebhookEvent) => Promise<void>): void;
  processWebhook(event: WebhookEvent): Promise<void>;

  // Reporting
  generateBillingReport(periodStart: Date, periodEnd: Date): Promise<BillingReport>;
  getMetrics(): Promise<{ mrr: number; arr: number; churnRate: number; ltv: number }>;
}

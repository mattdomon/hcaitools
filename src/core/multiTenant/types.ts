/**
 * Multi-Tenant Architecture Types
 * Tenant management, isolation, configuration, billing, and analytics
 */

export type TenantStatus = 'active' | 'suspended' | 'cancelled';
export type SubscriptionTier = 'free' | 'starter' | 'professional' | 'enterprise';
export type BillingCycle = 'monthly' | 'yearly';
export type IsolationLevel = 'strict' | 'shared';
export type ResourceType = 'users' | 'storage' | 'api_calls';

export interface ResourceQuota {
  users: number;
  storage: number;
  apiCalls: number;
}

export interface TenantConfig {
  isolationLevel: IsolationLevel;
  dedicatedResources: boolean;
  customBranding: boolean;
  ssoEnabled: boolean;
  apiRateLimit: number;
  maxFileSize: number;
  allowedOrigins: string[];
  metadata: Record<string, unknown>;
}

export interface TenantBilling {
  billingId: string;
  tenantId: string;
  subscriptionTier: SubscriptionTier;
  billingCycle: BillingCycle;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  monthlyPrice: number;
  yearlyPrice: number;
  isPaid: boolean;
  autoRenew: boolean;
  paymentMethod?: string;
  billingEmail: string;
  taxId?: string;
  invoiceHistory: Invoice[];
}

export interface Invoice {
  invoiceId: string;
  tenantId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  issuedAt: Date;
  paidAt?: Date;
  description: string;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface TenantUsage {
  usageId: string;
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  usersCount: number;
  storageUsed: number;
  apiCallsCount: number;
  computeHours: number;
  bandwidthGb: number;
}

export interface TenantMetrics {
  tenantId: string;
  activeUsers: number;
  totalStorage: number;
  apiCallsToday: number;
  apiCallsMonth: number;
  bandwidthToday: number;
  computeHoursToday: number;
  avgResponseTime: number;
  uptimePercentage: number;
  errorRate: number;
}

export interface CrossTenantAnalytics {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  cancelledTenants: number;
  totalUsers: number;
  totalStorage: number;
  totalApiCalls: number;
  revenue: {
    monthly: number;
    yearly: number;
    mrr: number;
  };
  tierDistribution: Record<SubscriptionTier, number>;
  growthRate: number;
  churnRate: number;
}

export interface Tenant {
  tenantId: string;
  name: string;
  slug: string;
  status: TenantStatus;
  subscriptionTier: SubscriptionTier;
  isolationLevel: IsolationLevel;
  createdAt: Date;
  updatedAt: Date;
  suspendedAt?: Date;
  cancelledAt?: Date;
  ownerId: string;
  ownerEmail: string;
  config: TenantConfig;
  quotas: ResourceQuota;
  billing: TenantBilling | null;
  usage: TenantUsage | null;
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  ownerId: string;
  ownerEmail: string;
  subscriptionTier?: SubscriptionTier;
  isolationLevel?: IsolationLevel;
  config?: Partial<TenantConfig>;
}

export interface UpdateTenantInput {
  name?: string;
  status?: TenantStatus;
  subscriptionTier?: SubscriptionTier;
  isolationLevel?: IsolationLevel;
  config?: Partial<TenantConfig>;
}

export interface TenantNotification {
  notificationId: string;
  tenantId: string;
  type: 'quota_warning' | 'quota_exceeded' | 'billing_reminder' | 'subscription_change' | 'suspension' | 'reinstatement';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
}

export interface TenantSubscription {
  subscriptionId: string;
  tenantId: string;
  tier: SubscriptionTier;
  billingCycle: BillingCycle;
  startedAt: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date;
  features: string[];
}

export interface TenantQuotaUsage {
  tenantId: string;
  quotas: ResourceQuota;
  usage: ResourceQuota;
  percentUsed: ResourceQuota;
  isExceeded: boolean;
  warnings: ResourceType[];
}

export interface TenantEvent {
  eventId: string;
  tenantId: string;
  eventType: string;
  eventData: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface TenantManager {
  createTenant(input: CreateTenantInput): Promise<Tenant>;
  getTenant(tenantId: string): Promise<Tenant | null>;
  getTenantBySlug(slug: string): Promise<Tenant | null>;
  updateTenant(tenantId: string, input: UpdateTenantInput): Promise<Tenant>;
  deleteTenant(tenantId: string): Promise<void>;
  listTenants(filters?: {
    status?: TenantStatus;
    tier?: SubscriptionTier;
    limit?: number;
    offset?: number;
  }): Promise<Tenant[]>;
  suspendTenant(tenantId: string, reason: string): Promise<Tenant>;
  reactivateTenant(tenantId: string): Promise<Tenant>;
  cancelTenant(tenantId: string, reason: string): Promise<Tenant>;

  checkQuota(tenantId: string): Promise<TenantQuotaUsage>;
  updateQuotas(tenantId: string, quotas: Partial<ResourceQuota>): Promise<Tenant>;

  getSubscription(tenantId: string): Promise<TenantSubscription | null>;
  changeSubscription(tenantId: string, tier: SubscriptionTier, billingCycle: BillingCycle): Promise<TenantSubscription>;
  cancelSubscription(tenantId: string, immediately: boolean): Promise<TenantSubscription>;

  getBillingInfo(tenantId: string): Promise<TenantBilling | null>;
  updateBillingInfo(tenantId: string, billing: Partial<TenantBilling>): Promise<TenantBilling>;
  processPayment(tenantId: string, amount: number): Promise<boolean>;
  generateInvoice(tenantId: string): Promise<Invoice>;

  getUsage(tenantId: string, periodStart: Date, periodEnd: Date): Promise<TenantUsage>;
  recordUsage(tenantId: string, usage: Partial<TenantUsage>): Promise<void>;
  getMetrics(tenantId: string): Promise<TenantMetrics>;

  getCrossTenantAnalytics(): Promise<CrossTenantAnalytics>;

  addNotification(tenantId: string, notification: Omit<TenantNotification, 'notificationId' | 'createdAt' | 'isRead'>): Promise<TenantNotification>;
  getNotifications(tenantId: string, unreadOnly?: boolean): Promise<TenantNotification[]>;
  markNotificationRead(tenantId: string, notificationId: string): Promise<void>;
  markAllNotificationsRead(tenantId: string): Promise<void>;

  logEvent(tenantId: string, eventType: string, eventData: Record<string, unknown>, context?: { ipAddress?: string; userAgent?: string }): Promise<TenantEvent>;
  getEvents(tenantId: string, limit?: number): Promise<TenantEvent[]>;

  isolationCheck(tenantId: string, resourceType: string, resourceId: string): Promise<boolean>;
}

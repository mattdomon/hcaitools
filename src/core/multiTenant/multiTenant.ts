/**
 * Multi-Tenant Architecture Implementation
 * Tenant management with isolation, configuration, billing, and analytics
 */

import crypto from 'crypto';
import {
  Tenant,
  TenantStatus,
  SubscriptionTier,
  BillingCycle,
  ResourceQuota,
  TenantBilling,
  TenantUsage,
  TenantMetrics,
  CrossTenantAnalytics,
  CreateTenantInput,
  UpdateTenantInput,
  TenantNotification,
  TenantSubscription,
  TenantQuotaUsage,
  TenantEvent,
  TenantManager,
  Invoice,
} from './types';

const TIER_FEATURES: Record<SubscriptionTier, string[]> = {
  free: ['basic_features', 'community_support', '5_users', '1gb_storage'],
  starter: ['advanced_features', 'email_support', '25_users', '50gb_storage', 'api_access'],
  professional: ['all_features', 'priority_support', '100_users', '500gb_storage', 'api_access', 'custom_integrations'],
  enterprise: ['all_features', 'dedicated_support', 'unlimited_users', 'unlimited_storage', 'api_access', 'custom_integrations', 'sso', 'dedicated_resources', 'sla'],
};

const TIER_PRICES: Record<SubscriptionTier, { monthly: number; yearly: number }> = {
  free: { monthly: 0, yearly: 0 },
  starter: { monthly: 29, yearly: 290 },
  professional: { monthly: 99, yearly: 990 },
  enterprise: { monthly: 299, yearly: 2990 },
};

const DEFAULT_QUOTAS: Record<SubscriptionTier, ResourceQuota> = {
  free: { users: 5, storage: 1 * 1024 * 1024 * 1024, apiCalls: 1000 },
  starter: { users: 25, storage: 50 * 1024 * 1024 * 1024, apiCalls: 10000 },
  professional: { users: 100, storage: 500 * 1024 * 1024 * 1024, apiCalls: 100000 },
  enterprise: { users: -1, storage: -1, apiCalls: -1 },
};

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export class MultiTenantManager implements TenantManager {
  private tenants: Map<string, Tenant> = new Map();
  private subscriptions: Map<string, TenantSubscription> = new Map();
  private notifications: Map<string, TenantNotification[]> = new Map();
  private events: Map<string, TenantEvent[]> = new Map();
  private usage: Map<string, TenantUsage> = new Map();

  async createTenant(input: CreateTenantInput): Promise<Tenant> {
    const tenantId = generateId('tenant');
    const now = new Date();

    const tier = input.subscriptionTier || 'free';
    const tierPrices = TIER_PRICES[tier];

    const tenant: Tenant = {
      tenantId,
      name: input.name,
      slug: input.slug,
      status: 'active',
      subscriptionTier: tier,
      isolationLevel: input.isolationLevel || 'shared',
      createdAt: now,
      updatedAt: now,
      ownerId: input.ownerId,
      ownerEmail: input.ownerEmail,
      config: {
        isolationLevel: input.isolationLevel || 'shared',
        dedicatedResources: tier === 'enterprise',
        customBranding: tier === 'professional' || tier === 'enterprise',
        ssoEnabled: tier === 'enterprise',
        apiRateLimit: tier === 'enterprise' ? -1 : tier === 'professional' ? 1000 : tier === 'starter' ? 500 : 100,
        maxFileSize: tier === 'enterprise' ? 100 * 1024 * 1024 : tier === 'professional' ? 50 * 1024 * 1024 : 10 * 1024 * 1024,
        allowedOrigins: ['*'],
        metadata: {},
        ...input.config,
      },
      quotas: { ...DEFAULT_QUOTAS[tier] },
      billing: tier !== 'free' ? {
        billingId: generateId('billing'),
        tenantId,
        subscriptionTier: tier,
        billingCycle: 'monthly',
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        monthlyPrice: tierPrices.monthly,
        yearlyPrice: tierPrices.yearly,
        isPaid: false,
        autoRenew: true,
        billingEmail: input.ownerEmail,
        invoiceHistory: [],
      } : null,
      usage: null,
    };

    this.tenants.set(tenantId, tenant);

    await this.createSubscription(tenantId, tier, 'monthly');
    await this.initializeUsage(tenantId);

    return tenant;
  }

  async getTenant(tenantId: string): Promise<Tenant | null> {
    return this.tenants.get(tenantId) || null;
  }

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    for (const tenant of this.tenants.values()) {
      if (tenant.slug === slug) {
        return tenant;
      }
    }
    return null;
  }

  async updateTenant(tenantId: string, input: UpdateTenantInput): Promise<Tenant> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    if (input.name !== undefined) tenant.name = input.name;
    if (input.status !== undefined) {
      tenant.status = input.status;
      if (input.status === 'suspended') {
        tenant.suspendedAt = new Date();
      } else if (input.status === 'active') {
        tenant.suspendedAt = undefined;
      } else if (input.status === 'cancelled') {
        tenant.cancelledAt = new Date();
      }
    }
    if (input.subscriptionTier !== undefined) {
      tenant.subscriptionTier = input.subscriptionTier;
      tenant.quotas = { ...DEFAULT_QUOTAS[input.subscriptionTier] };
    }
    if (input.isolationLevel !== undefined) {
      tenant.isolationLevel = input.isolationLevel;
      tenant.config.isolationLevel = input.isolationLevel;
    }
    if (input.config !== undefined) {
      tenant.config = { ...tenant.config, ...input.config };
    }

    tenant.updatedAt = new Date();
    this.tenants.set(tenantId, tenant);

    return tenant;
  }

  async deleteTenant(tenantId: string): Promise<void> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    tenant.status = 'cancelled';
    tenant.cancelledAt = new Date();
    tenant.updatedAt = new Date();
    this.tenants.set(tenantId, tenant);
  }

  async listTenants(filters?: {
    status?: TenantStatus;
    tier?: SubscriptionTier;
    limit?: number;
    offset?: number;
  }): Promise<Tenant[]> {
    let result = Array.from(this.tenants.values());

    if (filters?.status) {
      result = result.filter(t => t.status === filters.status);
    }
    if (filters?.tier) {
      result = result.filter(t => t.subscriptionTier === filters.tier);
    }

    const offset = filters?.offset || 0;
    const limit = filters?.limit || result.length;

    return result.slice(offset, offset + limit);
  }

  async suspendTenant(tenantId: string, _reason: string): Promise<Tenant> {
    return this.updateTenant(tenantId, { status: 'suspended' });
  }

  async reactivateTenant(tenantId: string): Promise<Tenant> {
    return this.updateTenant(tenantId, { status: 'active' });
  }

  async cancelTenant(tenantId: string, _reason: string): Promise<Tenant> {
    return this.updateTenant(tenantId, { status: 'cancelled' });
  }

  async checkQuota(tenantId: string): Promise<TenantQuotaUsage> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const usage = this.usage.get(tenantId);
    const currentUsage = usage || { usersCount: 0, storageUsed: 0, apiCallsCount: 0 };

    const percentUsed: ResourceQuota = {
      users: tenant.quotas.users === -1 ? 0 : (currentUsage.usersCount / tenant.quotas.users) * 100,
      storage: tenant.quotas.storage === -1 ? 0 : (currentUsage.storageUsed / tenant.quotas.storage) * 100,
      apiCalls: tenant.quotas.apiCalls === -1 ? 0 : (currentUsage.apiCallsCount / tenant.quotas.apiCalls) * 100,
    };

    const isExceeded = tenant.quotas.users !== -1 && currentUsage.usersCount > tenant.quotas.users ||
      tenant.quotas.storage !== -1 && currentUsage.storageUsed > tenant.quotas.storage ||
      tenant.quotas.apiCalls !== -1 && currentUsage.apiCallsCount > tenant.quotas.apiCalls;

    const warnings: ('users' | 'storage' | 'api_calls')[] = [];
    if (percentUsed.users >= 80) warnings.push('users');
    if (percentUsed.storage >= 80) warnings.push('storage');
    if (percentUsed.apiCalls >= 80) warnings.push('api_calls');

    return {
      tenantId,
      quotas: tenant.quotas,
      usage: {
        users: currentUsage.usersCount,
        storage: currentUsage.storageUsed,
        apiCalls: currentUsage.apiCallsCount,
      },
      percentUsed,
      isExceeded,
      warnings,
    };
  }

  async updateQuotas(tenantId: string, quotas: Partial<ResourceQuota>): Promise<Tenant> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    tenant.quotas = { ...tenant.quotas, ...quotas };
    tenant.updatedAt = new Date();
    this.tenants.set(tenantId, tenant);

    return tenant;
  }

  private async createSubscription(tenantId: string, tier: SubscriptionTier, billingCycle: BillingCycle): Promise<TenantSubscription> {
    const now = new Date();
    const periodEnd = billingCycle === 'monthly'
      ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const subscription: TenantSubscription = {
      subscriptionId: generateId('sub'),
      tenantId,
      tier,
      billingCycle,
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      features: TIER_FEATURES[tier],
    };

    this.subscriptions.set(tenantId, subscription);
    return subscription;
  }

  async getSubscription(tenantId: string): Promise<TenantSubscription | null> {
    return this.subscriptions.get(tenantId) || null;
  }

  async changeSubscription(tenantId: string, tier: SubscriptionTier, billingCycle: BillingCycle): Promise<TenantSubscription> {
    const existing = this.subscriptions.get(tenantId);
    if (existing) {
      existing.tier = tier;
      existing.billingCycle = billingCycle;
      existing.features = TIER_FEATURES[tier];
      this.subscriptions.set(tenantId, existing);
      return existing;
    }
    return this.createSubscription(tenantId, tier, billingCycle);
  }

  async cancelSubscription(tenantId: string, immediately: boolean): Promise<TenantSubscription> {
    const subscription = this.subscriptions.get(tenantId);
    if (!subscription) {
      throw new Error(`Subscription not found for tenant: ${tenantId}`);
    }

    if (immediately) {
      subscription.cancelledAt = new Date();
    } else {
      subscription.cancelAtPeriodEnd = true;
    }

    this.subscriptions.set(tenantId, subscription);
    return subscription;
  }

  async getBillingInfo(tenantId: string): Promise<TenantBilling | null> {
    const tenant = this.tenants.get(tenantId);
    return tenant?.billing || null;
  }

  async updateBillingInfo(tenantId: string, billing: Partial<TenantBilling>): Promise<TenantBilling> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant || !tenant.billing) {
      throw new Error(`Billing info not found for tenant: ${tenantId}`);
    }

    tenant.billing = { ...tenant.billing, ...billing };
    this.tenants.set(tenantId, tenant);

    return tenant.billing;
  }

  async processPayment(tenantId: string, _amount: number): Promise<boolean> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant || !tenant.billing) {
      throw new Error(`Tenant billing not found: ${tenantId}`);
    }

    tenant.billing.isPaid = true;
    this.tenants.set(tenantId, tenant);

    return true;
  }

  async generateInvoice(tenantId: string): Promise<Invoice> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant || !tenant.billing) {
      throw new Error(`Tenant billing not found: ${tenantId}`);
    }

    const invoiceId = generateId('invoice');
    const amount = tenant.billing.billingCycle === 'monthly'
      ? tenant.billing.monthlyPrice
      : tenant.billing.yearlyPrice;

    const invoice: Invoice = {
      invoiceId,
      tenantId,
      amount,
      currency: 'USD',
      status: 'pending',
      issuedAt: new Date(),
      description: `${tenant.subscriptionTier} subscription - ${tenant.billing.billingCycle}`,
      items: [
        {
          description: `${tenant.subscriptionTier} plan (${tenant.billing.billingCycle})`,
          quantity: 1,
          unitPrice: amount,
          total: amount,
        },
      ],
    };

    tenant.billing.invoiceHistory.push(invoice);
    this.tenants.set(tenantId, tenant);

    return invoice;
  }

  private async initializeUsage(tenantId: string): Promise<void> {
    const now = new Date();
    const usage: TenantUsage = {
      usageId: generateId('usage'),
      tenantId,
      periodStart: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      periodEnd: now,
      usersCount: 0,
      storageUsed: 0,
      apiCallsCount: 0,
      computeHours: 0,
      bandwidthGb: 0,
    };
    this.usage.set(tenantId, usage);
  }

  async getUsage(tenantId: string, periodStart: Date, periodEnd: Date): Promise<TenantUsage> {
    const existing = this.usage.get(tenantId);
    if (!existing) {
      await this.initializeUsage(tenantId);
      return this.usage.get(tenantId)!;
    }

    return {
      ...existing,
      periodStart,
      periodEnd,
    };
  }

  async recordUsage(tenantId: string, usageUpdate: Partial<TenantUsage>): Promise<void> {
    let usage = this.usage.get(tenantId);
    if (!usage) {
      await this.initializeUsage(tenantId);
      usage = this.usage.get(tenantId);
    }

    usage = { ...usage!, ...usageUpdate };
    this.usage.set(tenantId, usage);
  }

  async getMetrics(tenantId: string): Promise<TenantMetrics> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const usage = this.usage.get(tenantId);

    return {
      tenantId,
      activeUsers: usage?.usersCount || 0,
      totalStorage: usage?.storageUsed || 0,
      apiCallsToday: usage?.apiCallsCount || 0,
      apiCallsMonth: usage?.apiCallsCount || 0,
      bandwidthToday: usage?.bandwidthGb || 0,
      computeHoursToday: usage?.computeHours || 0,
      avgResponseTime: 120,
      uptimePercentage: 99.9,
      errorRate: 0.1,
    };
  }

  async getCrossTenantAnalytics(): Promise<CrossTenantAnalytics> {
    const allTenants = Array.from(this.tenants.values());

    const analytics: CrossTenantAnalytics = {
      totalTenants: allTenants.length,
      activeTenants: allTenants.filter(t => t.status === 'active').length,
      suspendedTenants: allTenants.filter(t => t.status === 'suspended').length,
      cancelledTenants: allTenants.filter(t => t.status === 'cancelled').length,
      totalUsers: 0,
      totalStorage: 0,
      totalApiCalls: 0,
      revenue: { monthly: 0, yearly: 0, mrr: 0 },
      tierDistribution: { free: 0, starter: 0, professional: 0, enterprise: 0 },
      growthRate: 0,
      churnRate: 0,
    };

    for (const tenant of allTenants) {
      analytics.tierDistribution[tenant.subscriptionTier]++;
      const usage = this.usage.get(tenant.tenantId);
      if (usage) {
        analytics.totalUsers += usage.usersCount;
        analytics.totalStorage += usage.storageUsed;
        analytics.totalApiCalls += usage.apiCallsCount;
      }
      if (tenant.billing) {
        analytics.revenue.mrr += tenant.billing.monthlyPrice;
        analytics.revenue.yearly += tenant.billing.yearlyPrice;
      }
    }

    analytics.revenue.monthly = analytics.revenue.mrr;

    return analytics;
  }

  async addNotification(
    tenantId: string,
    notification: Omit<TenantNotification, 'notificationId' | 'createdAt' | 'isRead' | 'tenantId'>
  ): Promise<TenantNotification> {
    const fullNotification: TenantNotification = {
      ...notification,
      tenantId,
      notificationId: generateId('notif'),
      createdAt: new Date(),
      isRead: false,
    };

    const existing = this.notifications.get(tenantId) || [];
    existing.push(fullNotification);
    this.notifications.set(tenantId, existing);

    return fullNotification;
  }

  async getNotifications(tenantId: string, unreadOnly: boolean = false): Promise<TenantNotification[]> {
    const notifications = this.notifications.get(tenantId) || [];
    return unreadOnly ? notifications.filter(n => !n.isRead) : notifications;
  }

  async markNotificationRead(tenantId: string, notificationId: string): Promise<void> {
    const notifications = this.notifications.get(tenantId) || [];
    const notification = notifications.find(n => n.notificationId === notificationId);
    if (notification) {
      notification.isRead = true;
      notification.readAt = new Date();
    }
  }

  async markAllNotificationsRead(tenantId: string): Promise<void> {
    const notifications = this.notifications.get(tenantId) || [];
    for (const notification of notifications) {
      notification.isRead = true;
      notification.readAt = new Date();
    }
  }

  async logEvent(
    tenantId: string,
    eventType: string,
    eventData: Record<string, unknown>,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<TenantEvent> {
    const event: TenantEvent = {
      eventId: generateId('evt'),
      tenantId,
      eventType,
      eventData,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      timestamp: new Date(),
    };

    const existing = this.events.get(tenantId) || [];
    existing.push(event);
    this.events.set(tenantId, existing);

    return event;
  }

  async getEvents(tenantId: string, limit: number = 100): Promise<TenantEvent[]> {
    const events = this.events.get(tenantId) || [];
    return events.slice(-limit);
  }

  async isolationCheck(tenantId: string, _resourceType: string, _resourceId: string): Promise<boolean> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      return false;
    }

    return tenant.isolationLevel === 'strict';
  }
}

export class TenantContext {
  private static currentTenantId: string | null = null;

  static setTenant(tenantId: string): void {
    this.currentTenantId = tenantId;
  }

  static getTenant(): string | null {
    return this.currentTenantId;
  }

  static clear(): void {
    this.currentTenantId = null;
  }
}

export function isTenantActive(tenant: Tenant): boolean {
  return tenant.status === 'active';
}

export function isSubscriptionValid(subscription: TenantSubscription): boolean {
  const now = new Date();
  return !subscription.cancelledAt && subscription.currentPeriodEnd > now;
}

export function hasFeature(subscription: TenantSubscription, feature: string): boolean {
  return subscription.features.includes(feature);
}

export function getQuotaLimit(tier: SubscriptionTier, resource: keyof ResourceQuota): number {
  return DEFAULT_QUOTAS[tier][resource];
}

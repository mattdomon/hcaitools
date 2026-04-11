/**
 * Multi-Tenant Architecture
 * Tenant management with isolation, configuration, billing, and analytics
 */

export {
  TenantStatus,
  SubscriptionTier,
  BillingCycle,
  IsolationLevel,
  ResourceType,
  ResourceQuota,
  TenantConfig,
  TenantBilling,
  TenantUsage,
  TenantMetrics,
  CrossTenantAnalytics,
  Tenant,
  CreateTenantInput,
  UpdateTenantInput,
  TenantNotification,
  TenantSubscription,
  TenantQuotaUsage,
  TenantEvent,
  Invoice,
  InvoiceItem,
} from './types';

export {
  MultiTenantManager,
  TenantContext,
  isTenantActive,
  isSubscriptionValid,
  hasFeature,
  getQuotaLimit,
} from './multiTenant';

import { MultiTenantManager } from './multiTenant';
import {
  Tenant,
  CreateTenantInput,
  UpdateTenantInput,
  TenantQuotaUsage,
  TenantSubscription,
  TenantBilling,
  TenantMetrics,
  CrossTenantAnalytics,
  TenantNotification,
  TenantEvent,
  SubscriptionTier,
  ResourceQuota,
  Invoice,
} from './types';

export class TenantManagerService {
  private manager: MultiTenantManager;

  constructor() {
    this.manager = new MultiTenantManager();
  }

  async createTenant(input: CreateTenantInput): Promise<Tenant> {
    return this.manager.createTenant(input);
  }

  async getTenant(tenantId: string): Promise<Tenant | null> {
    return this.manager.getTenant(tenantId);
  }

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    return this.manager.getTenantBySlug(slug);
  }

  async updateTenant(tenantId: string, input: UpdateTenantInput): Promise<Tenant> {
    return this.manager.updateTenant(tenantId, input);
  }

  async deleteTenant(tenantId: string): Promise<void> {
    return this.manager.deleteTenant(tenantId);
  }

  async listTenants(filters?: {
    status?: 'active' | 'suspended' | 'cancelled';
    tier?: SubscriptionTier;
    limit?: number;
    offset?: number;
  }): Promise<Tenant[]> {
    return this.manager.listTenants(filters);
  }

  async suspendTenant(tenantId: string, reason: string): Promise<Tenant> {
    return this.manager.suspendTenant(tenantId, reason);
  }

  async reactivateTenant(tenantId: string): Promise<Tenant> {
    return this.manager.reactivateTenant(tenantId);
  }

  async cancelTenant(tenantId: string, reason: string): Promise<Tenant> {
    return this.manager.cancelTenant(tenantId, reason);
  }

  async checkQuota(tenantId: string): Promise<TenantQuotaUsage> {
    return this.manager.checkQuota(tenantId);
  }

  async updateQuotas(tenantId: string, quotas: Partial<ResourceQuota>): Promise<Tenant> {
    return this.manager.updateQuotas(tenantId, quotas);
  }

  async getSubscription(tenantId: string): Promise<TenantSubscription | null> {
    return this.manager.getSubscription(tenantId);
  }

  async changeSubscription(tenantId: string, tier: SubscriptionTier, billingCycle: 'monthly' | 'yearly'): Promise<TenantSubscription> {
    return this.manager.changeSubscription(tenantId, tier, billingCycle);
  }

  async cancelSubscription(tenantId: string, immediately: boolean): Promise<TenantSubscription> {
    return this.manager.cancelSubscription(tenantId, immediately);
  }

  async getBillingInfo(tenantId: string): Promise<TenantBilling | null> {
    return this.manager.getBillingInfo(tenantId);
  }

  async updateBillingInfo(tenantId: string, billing: Partial<TenantBilling>): Promise<TenantBilling> {
    return this.manager.updateBillingInfo(tenantId, billing);
  }

  async processPayment(tenantId: string, amount: number): Promise<boolean> {
    return this.manager.processPayment(tenantId, amount);
  }

  async generateInvoice(tenantId: string): Promise<Invoice> {
    return this.manager.generateInvoice(tenantId);
  }

  async getUsage(tenantId: string, periodStart: Date, periodEnd: Date) {
    return this.manager.getUsage(tenantId, periodStart, periodEnd);
  }

  async recordUsage(tenantId: string, usage: Partial<{
    usersCount: number;
    storageUsed: number;
    apiCallsCount: number;
    computeHours: number;
    bandwidthGb: number;
  }>): Promise<void> {
    return this.manager.recordUsage(tenantId, usage as Parameters<typeof this.manager.recordUsage>[1]);
  }

  async getMetrics(tenantId: string): Promise<TenantMetrics> {
    return this.manager.getMetrics(tenantId);
  }

  async getCrossTenantAnalytics(): Promise<CrossTenantAnalytics> {
    return this.manager.getCrossTenantAnalytics();
  }

  async addNotification(tenantId: string, notification: {
    type: 'quota_warning' | 'quota_exceeded' | 'billing_reminder' | 'subscription_change' | 'suspension' | 'reinstatement';
    title: string;
    message: string;
    priority: 'low' | 'medium' | 'high';
  }): Promise<TenantNotification> {
    return this.manager.addNotification(tenantId, notification);
  }

  async getNotifications(tenantId: string, unreadOnly?: boolean): Promise<TenantNotification[]> {
    return this.manager.getNotifications(tenantId, unreadOnly);
  }

  async markNotificationRead(tenantId: string, notificationId: string): Promise<void> {
    return this.manager.markNotificationRead(tenantId, notificationId);
  }

  async markAllNotificationsRead(tenantId: string): Promise<void> {
    return this.manager.markAllNotificationsRead(tenantId);
  }

  async logEvent(
    tenantId: string,
    eventType: string,
    eventData: Record<string, unknown>,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<TenantEvent> {
    return this.manager.logEvent(tenantId, eventType, eventData, context);
  }

  async getEvents(tenantId: string, limit?: number): Promise<TenantEvent[]> {
    return this.manager.getEvents(tenantId, limit);
  }

  async isolationCheck(tenantId: string, resourceType: string, resourceId: string): Promise<boolean> {
    return this.manager.isolationCheck(tenantId, resourceType, resourceId);
  }
}

export function createTenantManager(): TenantManagerService {
  return new TenantManagerService();
}

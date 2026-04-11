/**
 * Multi-Tenant Architecture Tests
 */

import {
  MultiTenantManager,
  TenantContext,
  isTenantActive,
  isSubscriptionValid,
  hasFeature,
  getQuotaLimit,
} from '../src/core/multiTenant/multiTenant';
import {
  Tenant,
  TenantStatus,
  SubscriptionTier,
  ResourceQuota,
  TenantQuotaUsage,
} from '../src/core/multiTenant/types';

describe('MultiTenantManager', () => {
  let manager: MultiTenantManager;

  beforeEach(() => {
    manager = new MultiTenantManager();
  });

  describe('Tenant Creation', () => {
    test('should create a tenant with default settings', async () => {
      const tenant = await manager.createTenant({
        name: 'Test Company',
        slug: 'test-company',
        ownerId: 'user_123',
        ownerEmail: 'owner@testcompany.com',
      });

      expect(tenant.tenantId).toMatch(/^tenant_[a-f0-9]+/);
      expect(tenant.name).toBe('Test Company');
      expect(tenant.slug).toBe('test-company');
      expect(tenant.status).toBe('active');
      expect(tenant.subscriptionTier).toBe('free');
      expect(tenant.ownerEmail).toBe('owner@testcompany.com');
      expect(tenant.isolationLevel).toBe('shared');
      expect(tenant.config.dedicatedResources).toBe(false);
    });

    test('should create tenant with professional tier', async () => {
      const tenant = await manager.createTenant({
        name: 'Pro Company',
        slug: 'pro-company',
        ownerId: 'user_456',
        ownerEmail: 'owner@procompany.com',
        subscriptionTier: 'professional',
      });

      expect(tenant.subscriptionTier).toBe('professional');
      expect(tenant.config.customBranding).toBe(true);
      expect(tenant.config.ssoEnabled).toBe(false);
      expect(tenant.config.apiRateLimit).toBe(1000);
    });

    test('should create tenant with enterprise tier', async () => {
      const tenant = await manager.createTenant({
        name: 'Enterprise Corp',
        slug: 'enterprise-corp',
        ownerId: 'user_789',
        ownerEmail: 'owner@enterprise.com',
        subscriptionTier: 'enterprise',
        isolationLevel: 'strict',
      });

      expect(tenant.subscriptionTier).toBe('enterprise');
      expect(tenant.isolationLevel).toBe('strict');
      expect(tenant.config.dedicatedResources).toBe(true);
      expect(tenant.config.ssoEnabled).toBe(true);
      expect(tenant.config.apiRateLimit).toBe(-1);
    });

    test('should set correct quotas for each tier', async () => {
      const tiers: SubscriptionTier[] = ['free', 'starter', 'professional', 'enterprise'];

      for (const tier of tiers) {
        const tenant = await manager.createTenant({
          name: `Tenant ${tier}`,
          slug: `tenant-${tier}`,
          ownerId: `user_${tier}`,
          ownerEmail: `${tier}@test.com`,
          subscriptionTier: tier,
        });

        if (tier === 'free') {
          expect(tenant.quotas.users).toBe(5);
          expect(tenant.quotas.storage).toBe(1 * 1024 * 1024 * 1024);
        } else if (tier === 'starter') {
          expect(tenant.quotas.users).toBe(25);
        } else if (tier === 'professional') {
          expect(tenant.quotas.users).toBe(100);
        } else if (tier === 'enterprise') {
          expect(tenant.quotas.users).toBe(-1);
          expect(tenant.quotas.storage).toBe(-1);
        }
      }
    });

    test('should initialize usage for new tenant', async () => {
      const tenant = await manager.createTenant({
        name: 'Usage Test',
        slug: 'usage-test',
        ownerId: 'user_usage',
        ownerEmail: 'usage@test.com',
      });

      const usage = await manager.getUsage(tenant.tenantId, new Date(Date.now() - 86400000), new Date());

      expect(usage.tenantId).toBe(tenant.tenantId);
      expect(usage.usersCount).toBe(0);
      expect(usage.storageUsed).toBe(0);
      expect(usage.apiCallsCount).toBe(0);
    });

    test('should create subscription for new tenant', async () => {
      const tenant = await manager.createTenant({
        name: 'Subscription Test',
        slug: 'subscription-test',
        ownerId: 'user_sub',
        ownerEmail: 'sub@test.com',
        subscriptionTier: 'starter',
      });

      const subscription = await manager.getSubscription(tenant.tenantId);

      expect(subscription).not.toBeNull();
      expect(subscription!.tier).toBe('starter');
      expect(subscription!.features).toContain('advanced_features');
      expect(subscription!.features).toContain('email_support');
    });
  });

  describe('Tenant Retrieval', () => {
    test('should get tenant by ID', async () => {
      const created = await manager.createTenant({
        name: 'Find Me',
        slug: 'find-me',
        ownerId: 'user_find',
        ownerEmail: 'find@test.com',
      });

      const found = await manager.getTenant(created.tenantId);

      expect(found).not.toBeNull();
      expect(found!.tenantId).toBe(created.tenantId);
      expect(found!.name).toBe('Find Me');
    });

    test('should return null for non-existent tenant', async () => {
      const found = await manager.getTenant('tenant_nonexistent');

      expect(found).toBeNull();
    });

    test('should get tenant by slug', async () => {
      await manager.createTenant({
        name: 'Slug Test',
        slug: 'unique-slug',
        ownerId: 'user_slug',
        ownerEmail: 'slug@test.com',
      });

      const found = await manager.getTenantBySlug('unique-slug');

      expect(found).not.toBeNull();
      expect(found!.name).toBe('Slug Test');
    });

    test('should return null for non-existent slug', async () => {
      const found = await manager.getTenantBySlug('nonexistent-slug');

      expect(found).toBeNull();
    });
  });

  describe('Tenant Updates', () => {
    test('should update tenant name', async () => {
      const tenant = await manager.createTenant({
        name: 'Original Name',
        slug: 'original-slug',
        ownerId: 'user_update',
        ownerEmail: 'update@test.com',
      });

      const updated = await manager.updateTenant(tenant.tenantId, { name: 'Updated Name' });

      expect(updated.name).toBe('Updated Name');
      expect(updated.tenantId).toBe(tenant.tenantId);
    });

    test('should update tenant status', async () => {
      const tenant = await manager.createTenant({
        name: 'Status Test',
        slug: 'status-test',
        ownerId: 'user_status',
        ownerEmail: 'status@test.com',
      });

      const updated = await manager.updateTenant(tenant.tenantId, { status: 'suspended' });

      expect(updated.status).toBe('suspended');
      expect(updated.suspendedAt).toBeDefined();
    });

    test('should update subscription tier and quotas', async () => {
      const tenant = await manager.createTenant({
        name: 'Tier Test',
        slug: 'tier-test',
        ownerId: 'user_tier',
        ownerEmail: 'tier@test.com',
        subscriptionTier: 'free',
      });

      const updated = await manager.updateTenant(tenant.tenantId, { subscriptionTier: 'professional' });

      expect(updated.subscriptionTier).toBe('professional');
      expect(updated.quotas.users).toBe(100);
      expect(updated.quotas.storage).toBe(500 * 1024 * 1024 * 1024);
    });

    test('should update tenant isolation level', async () => {
      const tenant = await manager.createTenant({
        name: 'Isolation Test',
        slug: 'isolation-test',
        ownerId: 'user_iso',
        ownerEmail: 'iso@test.com',
        isolationLevel: 'shared',
      });

      const updated = await manager.updateTenant(tenant.tenantId, { isolationLevel: 'strict' });

      expect(updated.isolationLevel).toBe('strict');
      expect(updated.config.isolationLevel).toBe('strict');
    });

    test('should throw error when updating non-existent tenant', async () => {
      await expect(
        manager.updateTenant('tenant_nonexistent', { name: 'New Name' })
      ).rejects.toThrow('Tenant not found');
    });
  });

  describe('Tenant Lifecycle', () => {
    test('should suspend tenant', async () => {
      const tenant = await manager.createTenant({
        name: 'Suspend Test',
        slug: 'suspend-test',
        ownerId: 'user_suspend',
        ownerEmail: 'suspend@test.com',
      });

      const suspended = await manager.suspendTenant(tenant.tenantId, 'Policy violation');

      expect(suspended.status).toBe('suspended');
      expect(suspended.suspendedAt).toBeDefined();
    });

    test('should reactivate suspended tenant', async () => {
      const tenant = await manager.createTenant({
        name: 'Reactivate Test',
        slug: 'reactivate-test',
        ownerId: 'user_reactivate',
        ownerEmail: 'reactivate@test.com',
      });

      await manager.suspendTenant(tenant.tenantId, 'Temporary suspension');
      const reactivated = await manager.reactivateTenant(tenant.tenantId);

      expect(reactivated.status).toBe('active');
      expect(reactivated.suspendedAt).toBeUndefined();
    });

    test('should cancel tenant', async () => {
      const tenant = await manager.createTenant({
        name: 'Cancel Test',
        slug: 'cancel-test',
        ownerId: 'user_cancel',
        ownerEmail: 'cancel@test.com',
      });

      const cancelled = await manager.cancelTenant(tenant.tenantId, 'Customer request');

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.cancelledAt).toBeDefined();
    });
  });

  describe('Tenant Listing', () => {
    test('should list all tenants', async () => {
      await manager.createTenant({
        name: 'Tenant 1',
        slug: 'tenant-1',
        ownerId: 'user_1',
        ownerEmail: 'tenant1@test.com',
      });
      await manager.createTenant({
        name: 'Tenant 2',
        slug: 'tenant-2',
        ownerId: 'user_2',
        ownerEmail: 'tenant2@test.com',
      });

      const tenants = await manager.listTenants();

      expect(tenants.length).toBeGreaterThanOrEqual(2);
    });

    test('should filter tenants by status', async () => {
      const tenant1 = await manager.createTenant({
        name: 'Active Tenant',
        slug: 'active-tenant',
        ownerId: 'user_active',
        ownerEmail: 'active@test.com',
      });
      await manager.createTenant({
        name: 'Suspended Tenant',
        slug: 'suspended-tenant',
        ownerId: 'user_suspended',
        ownerEmail: 'suspended@test.com',
      });

      await manager.suspendTenant(tenant1.tenantId, 'Test suspension');

      const suspended = await manager.listTenants({ status: 'suspended' });
      const active = await manager.listTenants({ status: 'active' });

      expect(suspended.length).toBeGreaterThanOrEqual(1);
      expect(active.length).toBeGreaterThanOrEqual(1);
    });

    test('should filter tenants by tier', async () => {
      await manager.createTenant({
        name: 'Free Tenant',
        slug: 'free-tenant',
        ownerId: 'user_free',
        ownerEmail: 'free@test.com',
        subscriptionTier: 'free',
      });
      await manager.createTenant({
        name: 'Pro Tenant',
        slug: 'pro-tenant',
        ownerId: 'user_pro',
        ownerEmail: 'pro@test.com',
        subscriptionTier: 'professional',
      });

      const freeTenants = await manager.listTenants({ tier: 'free' });
      const proTenants = await manager.listTenants({ tier: 'professional' });

      expect(freeTenants.length).toBeGreaterThanOrEqual(1);
      expect(proTenants.length).toBeGreaterThanOrEqual(1);
    });

    test('should paginate tenants', async () => {
      for (let i = 0; i < 5; i++) {
        await manager.createTenant({
          name: `Paginated Tenant ${i}`,
          slug: `paginated-tenant-${i}`,
          ownerId: `user_paginated_${i}`,
          ownerEmail: `paginated${i}@test.com`,
        });
      }

      const page1 = await manager.listTenants({ limit: 2, offset: 0 });
      const page2 = await manager.listTenants({ limit: 2, offset: 2 });

      expect(page1.length).toBe(2);
      expect(page2.length).toBe(2);
    });
  });

  describe('Quota Management', () => {
    test('should check quota usage', async () => {
      const tenant = await manager.createTenant({
        name: 'Quota Test',
        slug: 'quota-test',
        ownerId: 'user_quota',
        ownerEmail: 'quota@test.com',
      });

      await manager.recordUsage(tenant.tenantId, {
        usersCount: 3,
        storageUsed: 500 * 1024 * 1024,
        apiCallsCount: 500,
      });

      const quotaUsage = await manager.checkQuota(tenant.tenantId);

      expect(quotaUsage.tenantId).toBe(tenant.tenantId);
      expect(quotaUsage.usage.users).toBe(3);
      expect(quotaUsage.percentUsed.users).toBe(60);
    });

    test('should detect quota exceeded', async () => {
      const tenant = await manager.createTenant({
        name: 'Exceeded Test',
        slug: 'exceeded-test',
        ownerId: 'user_exceeded',
        ownerEmail: 'exceeded@test.com',
      });

      await manager.recordUsage(tenant.tenantId, {
        usersCount: 10,
        storageUsed: 10 * 1024 * 1024 * 1024,
        apiCallsCount: 2000,
      });

      const quotaUsage = await manager.checkQuota(tenant.tenantId);

      expect(quotaUsage.isExceeded).toBe(true);
    });

    test('should generate warnings at 80% quota', async () => {
      const tenant = await manager.createTenant({
        name: 'Warning Test',
        slug: 'warning-test',
        ownerId: 'user_warning',
        ownerEmail: 'warning@test.com',
      });

      await manager.recordUsage(tenant.tenantId, {
        usersCount: 4,
        storageUsed: 4 * 1024 * 1024 * 1024,
        apiCallsCount: 800,
      });

      const quotaUsage = await manager.checkQuota(tenant.tenantId);

      expect(quotaUsage.warnings.length).toBeGreaterThan(0);
    });

    test('should update quotas', async () => {
      const tenant = await manager.createTenant({
        name: 'Update Quota Test',
        slug: 'update-quota-test',
        ownerId: 'user_update_quota',
        ownerEmail: 'updatequota@test.com',
      });

      const updated = await manager.updateQuotas(tenant.tenantId, {
        users: 50,
        storage: 100 * 1024 * 1024 * 1024,
      });

      expect(updated.quotas.users).toBe(50);
      expect(updated.quotas.storage).toBe(100 * 1024 * 1024 * 1024);
    });
  });

  describe('Subscription Management', () => {
    test('should change subscription', async () => {
      const tenant = await manager.createTenant({
        name: 'Change Sub Test',
        slug: 'change-sub-test',
        ownerId: 'user_change_sub',
        ownerEmail: 'changesub@test.com',
        subscriptionTier: 'starter',
      });

      const subscription = await manager.changeSubscription(tenant.tenantId, 'professional', 'yearly');

      expect(subscription.tier).toBe('professional');
      expect(subscription.billingCycle).toBe('yearly');
    });

    test('should cancel subscription at period end', async () => {
      const tenant = await manager.createTenant({
        name: 'Cancel Sub Test',
        slug: 'cancel-sub-test',
        ownerId: 'user_cancel_sub',
        ownerEmail: 'cancelsub@test.com',
        subscriptionTier: 'starter',
      });

      const subscription = await manager.cancelSubscription(tenant.tenantId, false);

      expect(subscription.cancelAtPeriodEnd).toBe(true);
      expect(subscription.cancelledAt).toBeUndefined();
    });

    test('should cancel subscription immediately', async () => {
      const tenant = await manager.createTenant({
        name: 'Immediate Cancel Test',
        slug: 'immediate-cancel-test',
        ownerId: 'user_immediate',
        ownerEmail: 'immediate@test.com',
        subscriptionTier: 'starter',
      });

      const subscription = await manager.cancelSubscription(tenant.tenantId, true);

      expect(subscription.cancelledAt).toBeDefined();
    });
  });

  describe('Billing Operations', () => {
    test('should get billing info for paid tenant', async () => {
      const tenant = await manager.createTenant({
        name: 'Billing Test',
        slug: 'billing-test',
        ownerId: 'user_billing',
        ownerEmail: 'billing@test.com',
        subscriptionTier: 'professional',
      });

      const billing = await manager.getBillingInfo(tenant.tenantId);

      expect(billing).not.toBeNull();
      expect(billing!.subscriptionTier).toBe('professional');
      expect(billing!.monthlyPrice).toBe(99);
      expect(billing!.yearlyPrice).toBe(990);
    });

    test('should update billing info', async () => {
      const tenant = await manager.createTenant({
        name: 'Update Billing Test',
        slug: 'update-billing-test',
        ownerId: 'user_update_billing',
        ownerEmail: 'updatebilling@test.com',
        subscriptionTier: 'starter',
      });

      const updated = await manager.updateBillingInfo(tenant.tenantId, {
        autoRenew: false,
        billingEmail: 'newbilling@test.com',
      });

      expect(updated.autoRenew).toBe(false);
      expect(updated.billingEmail).toBe('newbilling@test.com');
    });

    test('should process payment', async () => {
      const tenant = await manager.createTenant({
        name: 'Payment Test',
        slug: 'payment-test',
        ownerId: 'user_payment',
        ownerEmail: 'payment@test.com',
        subscriptionTier: 'starter',
      });

      const result = await manager.processPayment(tenant.tenantId, 29);

      expect(result).toBe(true);
      const billing = await manager.getBillingInfo(tenant.tenantId);
      expect(billing!.isPaid).toBe(true);
    });

    test('should generate invoice', async () => {
      const tenant = await manager.createTenant({
        name: 'Invoice Test',
        slug: 'invoice-test',
        ownerId: 'user_invoice',
        ownerEmail: 'invoice@test.com',
        subscriptionTier: 'professional',
      });

      const invoice = await manager.generateInvoice(tenant.tenantId);

      expect(invoice.invoiceId).toMatch(/^invoice_[a-f0-9]+/);
      expect(invoice.tenantId).toBe(tenant.tenantId);
      expect(invoice.amount).toBe(99);
      expect(invoice.status).toBe('pending');
      expect(invoice.items.length).toBe(1);
    });

    test('should return null billing for free tier', async () => {
      const tenant = await manager.createTenant({
        name: 'Free Billing Test',
        slug: 'free-billing-test',
        ownerId: 'user_free_billing',
        ownerEmail: 'freebilling@test.com',
        subscriptionTier: 'free',
      });

      const billing = await manager.getBillingInfo(tenant.tenantId);

      expect(billing).toBeNull();
    });
  });

  describe('Usage Tracking', () => {
    test('should record usage', async () => {
      const tenant = await manager.createTenant({
        name: 'Record Usage Test',
        slug: 'record-usage-test',
        ownerId: 'user_record_usage',
        ownerEmail: 'recordusage@test.com',
      });

      await manager.recordUsage(tenant.tenantId, {
        usersCount: 5,
        storageUsed: 1024 * 1024 * 1024,
        apiCallsCount: 1000,
        computeHours: 10,
        bandwidthGb: 5,
      });

      const usage = await manager.getUsage(
        tenant.tenantId,
        new Date(Date.now() - 86400000),
        new Date()
      );

      expect(usage.usersCount).toBe(5);
      expect(usage.storageUsed).toBe(1024 * 1024 * 1024);
      expect(usage.apiCallsCount).toBe(1000);
    });

    test('should get tenant metrics', async () => {
      const tenant = await manager.createTenant({
        name: 'Metrics Test',
        slug: 'metrics-test',
        ownerId: 'user_metrics',
        ownerEmail: 'metrics@test.com',
      });

      await manager.recordUsage(tenant.tenantId, {
        usersCount: 10,
        storageUsed: 50 * 1024 * 1024 * 1024,
        apiCallsCount: 5000,
      });

      const metrics = await manager.getMetrics(tenant.tenantId);

      expect(metrics.tenantId).toBe(tenant.tenantId);
      expect(metrics.activeUsers).toBe(10);
      expect(metrics.totalStorage).toBe(50 * 1024 * 1024 * 1024);
      expect(metrics.uptimePercentage).toBe(99.9);
    });
  });

  describe('Cross-Tenant Analytics', () => {
    test('should get cross-tenant analytics', async () => {
      await manager.createTenant({
        name: 'Analytics Tenant 1',
        slug: 'analytics-tenant-1',
        ownerId: 'user_analytics_1',
        ownerEmail: 'analytics1@test.com',
        subscriptionTier: 'starter',
      });
      await manager.createTenant({
        name: 'Analytics Tenant 2',
        slug: 'analytics-tenant-2',
        ownerId: 'user_analytics_2',
        ownerEmail: 'analytics2@test.com',
        subscriptionTier: 'professional',
      });

      const analytics = await manager.getCrossTenantAnalytics();

      expect(analytics.totalTenants).toBeGreaterThanOrEqual(2);
      expect(analytics.activeTenants).toBeGreaterThanOrEqual(2);
      expect(analytics.tierDistribution.starter).toBeGreaterThanOrEqual(1);
      expect(analytics.tierDistribution.professional).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Notifications', () => {
    test('should add notification', async () => {
      const tenant = await manager.createTenant({
        name: 'Notification Test',
        slug: 'notification-test',
        ownerId: 'user_notification',
        ownerEmail: 'notification@test.com',
      });

      const notification = await manager.addNotification(tenant.tenantId, {
        type: 'quota_warning',
        title: 'Quota Warning',
        message: 'You are approaching your storage limit',
        priority: 'high',
      });

      expect(notification.notificationId).toMatch(/^notif_[a-f0-9]+/);
      expect(notification.tenantId).toBe(tenant.tenantId);
      expect(notification.title).toBe('Quota Warning');
      expect(notification.isRead).toBe(false);
    });

    test('should get notifications', async () => {
      const tenant = await manager.createTenant({
        name: 'Get Notifications Test',
        slug: 'get-notifications-test',
        ownerId: 'user_get_notifications',
        ownerEmail: 'getnotifications@test.com',
      });

      await manager.addNotification(tenant.tenantId, {
        type: 'billing_reminder',
        title: 'Billing Reminder',
        message: 'Your subscription renews tomorrow',
        priority: 'medium',
      });

      const notifications = await manager.getNotifications(tenant.tenantId);

      expect(notifications.length).toBeGreaterThanOrEqual(1);
    });

    test('should get unread notifications only', async () => {
      const tenant = await manager.createTenant({
        name: 'Unread Notifications Test',
        slug: 'unread-notifications-test',
        ownerId: 'user_unread',
        ownerEmail: 'unread@test.com',
      });

      const notification = await manager.addNotification(tenant.tenantId, {
        type: 'quota_exceeded',
        title: 'Quota Exceeded',
        message: 'You have exceeded your storage quota',
        priority: 'high',
      });

      await manager.markNotificationRead(tenant.tenantId, notification.notificationId);

      const unreadOnly = await manager.getNotifications(tenant.tenantId, true);

      expect(unreadOnly.every(n => n.isRead === false)).toBe(true);
    });

    test('should mark notification as read', async () => {
      const tenant = await manager.createTenant({
        name: 'Mark Read Test',
        slug: 'mark-read-test',
        ownerId: 'user_mark_read',
        ownerEmail: 'markread@test.com',
      });

      const notification = await manager.addNotification(tenant.tenantId, {
        type: 'subscription_change',
        title: 'Plan Changed',
        message: 'Your subscription has been updated',
        priority: 'low',
      });

      await manager.markNotificationRead(tenant.tenantId, notification.notificationId);

      const notifications = await manager.getNotifications(tenant.tenantId);
      const marked = notifications.find(n => n.notificationId === notification.notificationId);

      expect(marked!.isRead).toBe(true);
      expect(marked!.readAt).toBeDefined();
    });

    test('should mark all notifications as read', async () => {
      const tenant = await manager.createTenant({
        name: 'Mark All Read Test',
        slug: 'mark-all-read-test',
        ownerId: 'user_mark_all_read',
        ownerEmail: 'markallread@test.com',
      });

      await manager.addNotification(tenant.tenantId, {
        type: 'quota_warning',
        title: 'Warning 1',
        message: 'First warning',
        priority: 'high',
      });
      await manager.addNotification(tenant.tenantId, {
        type: 'quota_warning',
        title: 'Warning 2',
        message: 'Second warning',
        priority: 'medium',
      });

      await manager.markAllNotificationsRead(tenant.tenantId);

      const notifications = await manager.getNotifications(tenant.tenantId);
      expect(notifications.every(n => n.isRead)).toBe(true);
    });
  });

  describe('Event Logging', () => {
    test('should log event', async () => {
      const tenant = await manager.createTenant({
        name: 'Event Log Test',
        slug: 'event-log-test',
        ownerId: 'user_event',
        ownerEmail: 'event@test.com',
      });

      const event = await manager.logEvent(
        tenant.tenantId,
        'user_created',
        { userId: 'user_123', email: 'newuser@test.com' },
        { ipAddress: '192.168.1.1', userAgent: 'Mozilla/5.0' }
      );

      expect(event.eventId).toMatch(/^evt_[a-f0-9]+/);
      expect(event.tenantId).toBe(tenant.tenantId);
      expect(event.eventType).toBe('user_created');
      expect(event.ipAddress).toBe('192.168.1.1');
      expect(event.userAgent).toBe('Mozilla/5.0');
    });

    test('should get events', async () => {
      const tenant = await manager.createTenant({
        name: 'Get Events Test',
        slug: 'get-events-test',
        ownerId: 'user_get_events',
        ownerEmail: 'getevents@test.com',
      });

      await manager.logEvent(tenant.tenantId, 'event_1', { data: 1 });
      await manager.logEvent(tenant.tenantId, 'event_2', { data: 2 });

      const events = await manager.getEvents(tenant.tenantId);

      expect(events.length).toBeGreaterThanOrEqual(2);
    });

    test('should limit events', async () => {
      const tenant = await manager.createTenant({
        name: 'Limit Events Test',
        slug: 'limit-events-test',
        ownerId: 'user_limit_events',
        ownerEmail: 'limitevents@test.com',
      });

      for (let i = 0; i < 10; i++) {
        await manager.logEvent(tenant.tenantId, `event_${i}`, { index: i });
      }

      const events = await manager.getEvents(tenant.tenantId, 5);

      expect(events.length).toBe(5);
    });
  });

  describe('Isolation Checks', () => {
    test('should return true for strict isolation', async () => {
      const tenant = await manager.createTenant({
        name: 'Strict Isolation Test',
        slug: 'strict-isolation-test',
        ownerId: 'user_strict',
        ownerEmail: 'strict@test.com',
        isolationLevel: 'strict',
      });

      const result = await manager.isolationCheck(tenant.tenantId, 'data', 'resource_123');

      expect(result).toBe(true);
    });

    test('should return false for shared isolation', async () => {
      const tenant = await manager.createTenant({
        name: 'Shared Isolation Test',
        slug: 'shared-isolation-test',
        ownerId: 'user_shared',
        ownerEmail: 'shared@test.com',
        isolationLevel: 'shared',
      });

      const result = await manager.isolationCheck(tenant.tenantId, 'data', 'resource_123');

      expect(result).toBe(false);
    });

    test('should return false for non-existent tenant', async () => {
      const result = await manager.isolationCheck('tenant_nonexistent', 'data', 'resource');

      expect(result).toBe(false);
    });
  });
});

describe('TenantContext', () => {
  test('should set and get current tenant', () => {
    TenantContext.setTenant('tenant_123');
    expect(TenantContext.getTenant()).toBe('tenant_123');
  });

  test('should clear current tenant', () => {
    TenantContext.setTenant('tenant_123');
    TenantContext.clear();
    expect(TenantContext.getTenant()).toBeNull();
  });
});

describe('Helper Functions', () => {
  describe('isTenantActive', () => {
    test('should return true for active tenant', () => {
      const tenant: Tenant = {
        tenantId: 'tenant_123',
        name: 'Test',
        slug: 'test',
        status: 'active',
        subscriptionTier: 'free',
        isolationLevel: 'shared',
        createdAt: new Date(),
        updatedAt: new Date(),
        ownerId: 'user_1',
        ownerEmail: 'test@test.com',
        config: {} as any,
        quotas: { users: 5, storage: 1024, apiCalls: 1000 },
        billing: null,
        usage: null,
      };

      expect(isTenantActive(tenant)).toBe(true);
    });

    test('should return false for suspended tenant', () => {
      const tenant: Tenant = {
        tenantId: 'tenant_123',
        name: 'Test',
        slug: 'test',
        status: 'suspended',
        subscriptionTier: 'free',
        isolationLevel: 'shared',
        createdAt: new Date(),
        updatedAt: new Date(),
        ownerId: 'user_1',
        ownerEmail: 'test@test.com',
        config: {} as any,
        quotas: { users: 5, storage: 1024, apiCalls: 1000 },
        billing: null,
        usage: null,
      };

      expect(isTenantActive(tenant)).toBe(false);
    });
  });

  describe('isSubscriptionValid', () => {
    test('should return true for valid subscription', () => {
      const subscription = {
        subscriptionId: 'sub_123',
        tenantId: 'tenant_123',
        tier: 'professional' as SubscriptionTier,
        billingCycle: 'monthly' as const,
        startedAt: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 86400000),
        cancelAtPeriodEnd: false,
        features: ['all_features'],
      };

      expect(isSubscriptionValid(subscription)).toBe(true);
    });

    test('should return false for expired subscription', () => {
      const subscription = {
        subscriptionId: 'sub_123',
        tenantId: 'tenant_123',
        tier: 'professional' as SubscriptionTier,
        billingCycle: 'monthly' as const,
        startedAt: new Date(),
        currentPeriodStart: new Date(Date.now() - 86400000),
        currentPeriodEnd: new Date(Date.now() - 1000),
        cancelAtPeriodEnd: false,
        features: ['all_features'],
      };

      expect(isSubscriptionValid(subscription)).toBe(false);
    });
  });

  describe('hasFeature', () => {
    test('should return true when feature exists', () => {
      const subscription = {
        subscriptionId: 'sub_123',
        tenantId: 'tenant_123',
        tier: 'professional' as SubscriptionTier,
        billingCycle: 'monthly' as const,
        startedAt: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 86400000),
        cancelAtPeriodEnd: false,
        features: ['sso', 'custom_integrations', 'api_access'],
      };

      expect(hasFeature(subscription, 'sso')).toBe(true);
    });

    test('should return false when feature does not exist', () => {
      const subscription = {
        subscriptionId: 'sub_123',
        tenantId: 'tenant_123',
        tier: 'starter' as SubscriptionTier,
        billingCycle: 'monthly' as const,
        startedAt: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 86400000),
        cancelAtPeriodEnd: false,
        features: ['advanced_features', 'email_support'],
      };

      expect(hasFeature(subscription, 'sso')).toBe(false);
    });
  });

  describe('getQuotaLimit', () => {
    test('should return correct limits for free tier', () => {
      expect(getQuotaLimit('free', 'users')).toBe(5);
      expect(getQuotaLimit('free', 'storage')).toBe(1 * 1024 * 1024 * 1024);
    });

    test('should return correct limits for enterprise tier', () => {
      expect(getQuotaLimit('enterprise', 'users')).toBe(-1);
      expect(getQuotaLimit('enterprise', 'storage')).toBe(-1);
    });
  });
});

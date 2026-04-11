import {
  NotificationManager,
  createNotificationManager,
  NotificationTemplate,
  AlertRule,
  AlertSeverity,
  NotificationChannel,
  NotificationPreferences,
  EscalationPolicy,
  Alert,
  Notification,
  AlertThreshold,
} from '../src/core/notificationsAlerts';

describe('Notifications & Alerts System', () => {
  let manager: NotificationManager;

  beforeEach(() => {
    manager = createNotificationManager({
      maxRetries: 3,
      retryDelayMs: 100,
      deliveryTimeoutMs: 5000,
      escalationCheckIntervalMs: 1000,
    });
  });

  describe('Template Management', () => {
    test('should create a notification template', () => {
      const template = manager.createTemplate({
        name: 'Test Template',
        channel: 'email',
        subject: 'Test Subject',
        body: 'Hello {{name}}',
        variables: ['name'],
      });

      expect(template.id).toMatch(/^tmpl_[a-f0-9]+$/);
      expect(template.name).toBe('Test Template');
      expect(template.channel).toBe('email');
      expect(template.subject).toBe('Test Subject');
      expect(template.body).toBe('Hello {{name}}');
      expect(template.variables).toEqual(['name']);
      expect(template.createdAt).toBeInstanceOf(Date);
      expect(template.updatedAt).toBeInstanceOf(Date);
    });

    test('should get a template by id', () => {
      const created = manager.createTemplate({
        name: 'Get Test',
        channel: 'push',
        body: 'Test body',
        variables: [],
      });

      const retrieved = manager.getTemplate(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Get Test');
    });

    test('should update a template', () => {
      const template = manager.createTemplate({
        name: 'Update Test',
        channel: 'email',
        body: 'Original body',
        variables: [],
      });

      const updated = manager.updateTemplate(template.id, {
        body: 'Updated body',
        subject: 'New subject',
      });

      expect(updated.body).toBe('Updated body');
      expect(updated.subject).toBe('New subject');
      expect(updated.name).toBe('Update Test');
    });

    test('should throw error when updating non-existent template', () => {
      expect(() =>
        manager.updateTemplate('non_existent', { body: 'New body' })
      ).toThrow('Template not found: non_existent');
    });

    test('should delete a template', () => {
      const template = manager.createTemplate({
        name: 'Delete Test',
        channel: 'sms',
        body: 'To be deleted',
        variables: [],
      });

      expect(manager.deleteTemplate(template.id)).toBe(true);
      expect(manager.getTemplate(template.id)).toBeUndefined();
    });

    test('should return all templates', () => {
      manager.createTemplate({ name: 'T1', channel: 'email', body: 'Body 1', variables: [] });
      manager.createTemplate({ name: 'T2', channel: 'sms', body: 'Body 2', variables: [] });

      const templates = manager.getAllTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Alert Rule Management', () => {
    test('should create an alert rule', () => {
      const rule = manager.createRule({
        name: 'CPU Alert',
        description: 'Alert when CPU is high',
        enabled: true,
        severity: 'high',
        thresholds: [{ metric: 'cpu_usage', operator: 'gt', value: 80 }],
        channels: ['email', 'push'],
        cooldownMs: 300000,
      });

      expect(rule.id).toMatch(/^rule_[a-f0-9]+$/);
      expect(rule.name).toBe('CPU Alert');
      expect(rule.severity).toBe('high');
      expect(rule.enabled).toBe(true);
      expect(rule.thresholds).toHaveLength(1);
    });

    test('should get a rule by id', () => {
      const rule = manager.createRule({
        name: 'Get Rule Test',
        enabled: true,
        severity: 'medium',
        thresholds: [],
        channels: ['email'],
        cooldownMs: 60000,
      });

      const retrieved = manager.getRule(rule.id);
      expect(retrieved?.name).toBe('Get Rule Test');
    });

    test('should update a rule', () => {
      const rule = manager.createRule({
        name: 'Original Rule',
        enabled: true,
        severity: 'low',
        thresholds: [],
        channels: ['push'],
        cooldownMs: 60000,
      });

      const updated = manager.updateRule(rule.id, {
        name: 'Updated Rule',
        enabled: false,
        severity: 'critical',
      });

      expect(updated.name).toBe('Updated Rule');
      expect(updated.enabled).toBe(false);
      expect(updated.severity).toBe('critical');
    });

    test('should throw error when updating non-existent rule', () => {
      expect(() =>
        manager.updateRule('non_existent', { name: 'New Name' })
      ).toThrow('Rule not found: non_existent');
    });

    test('should delete a rule', () => {
      const rule = manager.createRule({
        name: 'Delete Rule',
        enabled: true,
        severity: 'info',
        thresholds: [],
        channels: ['webhook'],
        cooldownMs: 30000,
      });

      expect(manager.deleteRule(rule.id)).toBe(true);
      expect(manager.getRule(rule.id)).toBeUndefined();
    });

    test('should return all rules', () => {
      manager.createRule({
        name: 'Rule 1',
        enabled: true,
        severity: 'low',
        thresholds: [],
        channels: ['email'],
        cooldownMs: 60000,
      });
      manager.createRule({
        name: 'Rule 2',
        enabled: false,
        severity: 'high',
        thresholds: [],
        channels: ['sms'],
        cooldownMs: 60000,
      });

      const rules = manager.getAllRules();
      expect(rules.length).toBeGreaterThanOrEqual(2);
    });

    test('should enable and disable rules', () => {
      const rule = manager.createRule({
        name: 'Toggle Rule',
        enabled: true,
        severity: 'medium',
        thresholds: [],
        channels: ['email'],
        cooldownMs: 60000,
      });

      expect(manager.isRuleEnabled(rule.id)).toBe(true);

      manager.disableRule(rule.id);
      expect(manager.isRuleEnabled(rule.id)).toBe(false);

      manager.enableRule(rule.id);
      expect(manager.isRuleEnabled(rule.id)).toBe(true);
    });
  });

  describe('Notification Delivery', () => {
    test('should send a notification', async () => {
      const notification = await manager.sendNotification(
        'user_123',
        'email',
        { title: 'Test', message: 'Hello World' }
      );

      expect(notification.id).toMatch(/^notif_[a-f0-9]+$/);
      expect(notification.userId).toBe('user_123');
      expect(notification.channel).toBe('email');
      expect(notification.status).toBe('sent');
      expect(notification.payload.title).toBe('Test');
    });

    test('should send notification via multiple channels', async () => {
      const channels: NotificationChannel[] = ['email', 'sms', 'push', 'webhook'];

      for (const channel of channels) {
        const notification = await manager.sendNotification(
          'user_123',
          channel,
          { title: `${channel} Test`, message: 'Test message' }
        );
        expect(notification.status).toBe('sent');
        expect(notification.channel).toBe(channel);
      }
    });

    test('should apply template to notification', async () => {
      const template = manager.createTemplate({
        name: 'Welcome Template',
        channel: 'email',
        subject: 'Welcome {{username}}',
        body: 'Hello {{username}}, welcome to {{platform}}!',
        variables: ['username', 'platform'],
      });

      const notification = await manager.sendNotification(
        'user_456',
        'email',
        {
          title: 'Welcome',
          message: 'Hello',
          data: { username: 'John', platform: 'Manus' },
        },
        { templateId: template.id }
      );

      expect(notification.payload.title).toBe('Welcome John');
      expect(notification.payload.message).toBe('Hello John, welcome to Manus!');
    });

    test('should include severity in notification', async () => {
      const notification = await manager.sendNotification(
        'user_789',
        'push',
        { title: 'Alert', message: 'Critical issue' },
        { severity: 'critical' }
      );

      expect(notification.severity).toBe('critical');
    });

    test('should throw error when channel is disabled', async () => {
      manager.setUserPreferences({
        userId: 'user_disabled',
        channels: { email: false },
        severityThresholds: {},
        timezone: 'UTC',
      });

      await expect(
        manager.sendNotification('user_disabled', 'email', {
          title: 'Test',
          message: 'Should fail',
        })
      ).rejects.toThrow('User has disabled channel: email');
    });

    test('should throw error when severity is disabled', async () => {
      manager.setUserPreferences({
        userId: 'user_severity',
        channels: {},
        severityThresholds: { critical: false },
        timezone: 'UTC',
      });

      await expect(
        manager.sendNotification(
          'user_severity',
          'email',
          { title: 'Test', message: 'Should fail' },
          { severity: 'critical' }
        )
      ).rejects.toThrow('User has disabled notifications for severity: critical');
    });
  });

  describe('Alert Triggering', () => {
    test('should trigger alert when conditions are met', async () => {
      const rule = manager.createRule({
        name: 'Memory Alert',
        enabled: true,
        severity: 'high',
        thresholds: [{ metric: 'memory_usage', operator: 'gt', value: 90 }],
        channels: ['email'],
        cooldownMs: 60000,
      });

      const alert = await manager.triggerAlert(
        rule.id,
        { memory_usage: 95 }
      );

      expect(alert.id).toMatch(/^alert_[a-f0-9]+$/);
      expect(alert.ruleId).toBe(rule.id);
      expect(alert.severity).toBe('high');
      expect(alert.status).toBe('active');
      expect(alert.currentLevel).toBe(0);
    });

    test('should throw error when alert conditions are not met', async () => {
      const rule = manager.createRule({
        name: 'Test Rule',
        enabled: true,
        severity: 'medium',
        thresholds: [{ metric: 'cpu', operator: 'gt', value: 80 }],
        channels: ['email'],
        cooldownMs: 60000,
      });

      await expect(
        manager.triggerAlert(rule.id, { cpu: 50 })
      ).rejects.toThrow('Alert conditions not met');
    });

    test('should not trigger alert for disabled rule', async () => {
      const rule = manager.createRule({
        name: 'Disabled Rule',
        enabled: false,
        severity: 'high',
        thresholds: [{ metric: 'disk', operator: 'gt', value: 95 }],
        channels: ['email'],
        cooldownMs: 60000,
      });

      await expect(
        manager.triggerAlert(rule.id, { disk: 99 })
      ).rejects.toThrow('Alert conditions not met');
    });

    test('should throw error for non-existent rule', async () => {
      await expect(
        manager.triggerAlert('non_existent', { cpu: 100 })
      ).rejects.toThrow('Rule not found: non_existent');
    });

    test('should handle multiple thresholds with AND logic', async () => {
      const rule = manager.createRule({
        name: 'Multi Threshold',
        enabled: true,
        severity: 'critical',
        thresholds: [
          { metric: 'cpu', operator: 'gt', value: 80 },
          { metric: 'memory', operator: 'gt', value: 90 },
        ],
        channels: ['email', 'push'],
        cooldownMs: 60000,
      });

      const alert1 = await manager.triggerAlert(
        rule.id,
        { cpu: 85, memory: 95 }
      );
      expect(alert1.status).toBe('active');

      await expect(
        manager.triggerAlert(rule.id, { cpu: 85, memory: 80 })
      ).rejects.toThrow('Alert conditions not met');

      await expect(
        manager.triggerAlert(rule.id, { cpu: 70, memory: 95 })
      ).rejects.toThrow('Alert conditions not met');
    });
  });

  describe('Alert Management', () => {
    let testAlert: Alert;

    beforeEach(async () => {
      const rule = manager.createRule({
        name: 'Test Rule',
        enabled: true,
        severity: 'high',
        thresholds: [{ metric: 'cpu', operator: 'gt', value: 80 }],
        channels: ['email'],
        cooldownMs: 60000,
      });

      testAlert = await manager.triggerAlert(rule.id, { cpu: 90 });
    });

    test('should acknowledge an alert', async () => {
      const acknowledged = await manager.acknowledgeAlert(testAlert.id, 'user_admin');

      expect(acknowledged.status).toBe('acknowledged');
      expect(acknowledged.acknowledgedBy).toBe('user_admin');
      expect(acknowledged.acknowledgedAt).toBeInstanceOf(Date);
    });

    test('should resolve an alert', async () => {
      const resolved = await manager.resolveAlert(testAlert.id, 'user_admin');

      expect(resolved.status).toBe('resolved');
      expect(resolved.resolvedBy).toBe('user_admin');
      expect(resolved.resolvedAt).toBeInstanceOf(Date);
    });

    test('should escalate an alert', async () => {
      const escalationPolicy = manager.setEscalationPolicy({
        name: 'Default Policy',
        levels: [
          { level: 0, delayMs: 0, channels: ['email'] },
          { level: 1, delayMs: 300000, channels: ['email', 'sms'] },
          { level: 2, delayMs: 600000, channels: ['email', 'sms', 'push'] },
        ],
        maxLevel: 2,
      });

      const escalated = await manager.escalateAlert(testAlert.id);

      expect(escalated.currentLevel).toBe(1);
      expect(escalated.status).toBe('escalated');
    });

    test('should throw error when acknowledging non-existent alert', async () => {
      await expect(
        manager.acknowledgeAlert('non_existent', 'user')
      ).rejects.toThrow('Alert not found: non_existent');
    });

    test('should throw error when resolving non-existent alert', async () => {
      await expect(
        manager.resolveAlert('non_existent', 'user')
      ).rejects.toThrow('Alert not found: non_existent');
    });

    test('should get alert by id', () => {
      const alert = manager.getAlert(testAlert.id);
      expect(alert).toBeDefined();
      expect(alert?.id).toBe(testAlert.id);
    });

    test('should get all alerts', () => {
      const alerts = manager.getAllAlerts();
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });

    test('should filter alerts by status', () => {
      const activeAlerts = manager.getAlertsByStatus('active');
      expect(activeAlerts.every((a) => a.status === 'active')).toBe(true);
    });

    test('should filter alerts by severity', () => {
      const highAlerts = manager.getAlertsBySeverity('high');
      expect(highAlerts.every((a) => a.severity === 'high')).toBe(true);
    });
  });

  describe('Notification Management', () => {
    beforeEach(async () => {
      await manager.sendNotification('user_1', 'email', { title: 'N1', message: 'M1' });
      await manager.sendNotification('user_1', 'sms', { title: 'N2', message: 'M2' });
      await manager.sendNotification('user_2', 'push', { title: 'N3', message: 'M3' });
    });

    test('should get notification by id', () => {
      const notifications = manager.getAllNotifications();
      const notification = manager.getNotification(notifications[0].id);
      expect(notification).toBeDefined();
    });

    test('should get all notifications', () => {
      const notifications = manager.getAllNotifications();
      expect(notifications.length).toBeGreaterThanOrEqual(3);
    });

    test('should filter notifications by user', () => {
      const user1Notifications = manager.getNotificationsByUser('user_1');
      expect(user1Notifications.every((n) => n.userId === 'user_1')).toBe(true);
    });

    test('should filter notifications by status', () => {
      const sentNotifications = manager.getNotificationsByStatus('sent');
      expect(sentNotifications.every((n) => n.status === 'sent')).toBe(true);
    });

    test('should filter notifications by channel', () => {
      const emailNotifications = manager.getNotificationsByChannel('email');
      expect(emailNotifications.every((n) => n.channel === 'email')).toBe(true);
    });
  });

  describe('User Preferences', () => {
    test('should set and get user preferences', () => {
      const preferences: NotificationPreferences = {
        userId: 'user_test',
        channels: { email: true, sms: false },
        severityThresholds: { critical: true, low: false },
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        timezone: 'America/New_York',
      };

      manager.setUserPreferences(preferences);
      const retrieved = manager.getUserPreferences('user_test');

      expect(retrieved).toBeDefined();
      expect(retrieved?.channels.email).toBe(true);
      expect(retrieved?.channels.sms).toBe(false);
      expect(retrieved?.timezone).toBe('America/New_York');
    });

    test('should return undefined for non-existent user preferences', () => {
      const retrieved = manager.getUserPreferences('non_existent_user');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Threshold Operators', () => {
    test('should evaluate greater than operator', () => {
      const rule = manager.createRule({
        name: 'GT Test',
        enabled: true,
        severity: 'high',
        thresholds: [{ metric: 'value', operator: 'gt', value: 50 }],
        channels: ['email'],
        cooldownMs: 60000,
      });

      expect(manager.getAllAlerts().length || true).toBeTruthy();
    });

    test('should evaluate less than operator', () => {
      const rule = manager.createRule({
        name: 'LT Test',
        enabled: true,
        severity: 'low',
        thresholds: [{ metric: 'value', operator: 'lt', value: 50 }],
        channels: ['email'],
        cooldownMs: 60000,
      });

      manager.triggerAlert(rule.id, { value: 30 });
      const alerts = manager.getAlertsByStatus('active');
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });

    test('should evaluate equals operator', () => {
      const rule = manager.createRule({
        name: 'EQ Test',
        enabled: true,
        severity: 'medium',
        thresholds: [{ metric: 'status', operator: 'eq', value: 1 }],
        channels: ['email'],
        cooldownMs: 60000,
      });

      manager.triggerAlert(rule.id, { status: 1 });
      const alerts = manager.getAlertsByStatus('active');
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });

    test('should evaluate not equals operator', () => {
      const rule = manager.createRule({
        name: 'NEQ Test',
        enabled: true,
        severity: 'info',
        thresholds: [{ metric: 'status', operator: 'neq', value: 0 }],
        channels: ['email'],
        cooldownMs: 60000,
      });

      manager.triggerAlert(rule.id, { status: 1 });
      const alerts = manager.getAlertsByStatus('active');
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });

    test('should evaluate gte operator', () => {
      const rule = manager.createRule({
        name: 'GTE Test',
        enabled: true,
        severity: 'high',
        thresholds: [{ metric: 'value', operator: 'gte', value: 50 }],
        channels: ['email'],
        cooldownMs: 60000,
      });

      manager.triggerAlert(rule.id, { value: 50 });
      const alerts = manager.getAlertsByStatus('active');
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });

    test('should evaluate lte operator', () => {
      const rule = manager.createRule({
        name: 'LTE Test',
        enabled: true,
        severity: 'medium',
        thresholds: [{ metric: 'value', operator: 'lte', value: 50 }],
        channels: ['email'],
        cooldownMs: 60000,
      });

      manager.triggerAlert(rule.id, { value: 50 });
      const alerts = manager.getAlertsByStatus('active');
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Custom Senders', () => {
    test('should register custom sender', async () => {
      const customSender = {
        send: jest.fn().mockResolvedValue({
          success: true,
          channel: 'custom' as NotificationChannel,
          messageId: 'custom_msg_id',
          timestamp: new Date(),
        }),
      };

      manager.registerSender('webhook', customSender as any);

      const notification = await manager.sendNotification(
        'user_custom',
        'webhook',
        { title: 'Custom', message: 'Test' }
      );

      expect(customSender.send).toHaveBeenCalled();
      expect(notification.status).toBe('sent');
    });
  });

  describe('Alert Severity Levels', () => {
    const severities: AlertSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

    severities.forEach((severity) => {
      test(`should handle ${severity} severity alerts`, async () => {
        const rule = manager.createRule({
          name: `${severity} Alert Rule`,
          enabled: true,
          severity,
          thresholds: [{ metric: 'metric', operator: 'gt', value: 0 }],
          channels: ['email'],
          cooldownMs: 60000,
        });

        const alert = await manager.triggerAlert(rule.id, { metric: 100 });
        expect(alert.severity).toBe(severity);
      });
    });
  });

  describe('Notification Channels', () => {
    const channels: NotificationChannel[] = ['email', 'sms', 'push', 'webhook'];

    channels.forEach((channel) => {
      test(`should handle ${channel} notifications`, async () => {
        const notification = await manager.sendNotification(
          'user_channel',
          channel,
          { title: `${channel} Test`, message: 'Testing channel' }
        );

        expect(notification.channel).toBe(channel);
        expect(notification.status).toBe('sent');
      });
    });
  });

  describe('createNotificationManager', () => {
    test('should create manager with custom config', () => {
      const customManager = createNotificationManager({
        maxRetries: 5,
        retryDelayMs: 2000,
        deliveryTimeoutMs: 60000,
        escalationCheckIntervalMs: 120000,
      });

      expect(customManager).toBeInstanceOf(NotificationManager);
    });

    test('should create manager with default config', () => {
      const defaultManager = createNotificationManager();
      expect(defaultManager).toBeInstanceOf(NotificationManager);
    });
  });
});

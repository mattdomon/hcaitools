import crypto from 'crypto';
import {
  Alert,
  AlertRule,
  AlertSeverity,
  DeliveryResult,
  EscalationLevel,
  EscalationPolicy,
  IAlertEvaluator,
  IEscalationManager,
  INotificationSender,
  Notification,
  NotificationChannel,
  NotificationManagerConfig,
  NotificationPreferences,
  NotificationStatus,
  NotificationTemplate,
  NotificationPayload,
} from './types';

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

class EmailSender implements INotificationSender {
  async send(_notification: Notification): Promise<DeliveryResult> {
    return {
      success: true,
      channel: 'email',
      messageId: generateId('email'),
      timestamp: new Date(),
    };
  }
}

class SmsSender implements INotificationSender {
  async send(_notification: Notification): Promise<DeliveryResult> {
    return {
      success: true,
      channel: 'sms',
      messageId: generateId('sms'),
      timestamp: new Date(),
    };
  }
}

class PushSender implements INotificationSender {
  async send(_notification: Notification): Promise<DeliveryResult> {
    return {
      success: true,
      channel: 'push',
      messageId: generateId('push'),
      timestamp: new Date(),
    };
  }
}

class WebhookSender implements INotificationSender {
  async send(_notification: Notification): Promise<DeliveryResult> {
    return {
      success: true,
      channel: 'webhook',
      messageId: generateId('webhook'),
      timestamp: new Date(),
    };
  }
}

class AlertEvaluator implements IAlertEvaluator {
  evaluate(rule: AlertRule, metrics: Record<string, number>): boolean {
    if (!rule.enabled) {
      return false;
    }

    return rule.thresholds.every((threshold) => {
      const metricValue = metrics[threshold.metric];
      if (metricValue === undefined) {
        return false;
      }

      const { operator, value } = threshold;

      switch (operator) {
        case 'gt':
          return metricValue > value;
        case 'lt':
          return metricValue < value;
        case 'gte':
          return metricValue >= value;
        case 'lte':
          return metricValue <= value;
        case 'eq':
          return metricValue === value;
        case 'neq':
          return metricValue !== value;
        default:
          return false;
      }
    });
  }
}

class EscalationManager implements IEscalationManager {
  private alerts: Map<string, Alert> = new Map();
  private policies: Map<string, EscalationPolicy> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private senders: Map<NotificationChannel, INotificationSender> = new Map();
  private preferences: Map<string, NotificationPreferences> = new Map();

  setEscalationPolicy(policy: EscalationPolicy): void {
    this.policies.set(policy.id, policy);
  }

  setTemplate(template: NotificationTemplate): void {
    this.templates.set(template.id, template);
  }

  setSender(channel: NotificationChannel, sender: INotificationSender): void {
    this.senders.set(channel, sender);
  }

  setUserPreferences(preferences: NotificationPreferences): void {
    this.preferences.set(preferences.userId, preferences);
  }

  private getSender(channel: NotificationChannel): INotificationSender | undefined {
    return this.senders.get(channel);
  }

  private getTemplate(templateId: string): NotificationTemplate | undefined {
    return this.templates.get(templateId);
  }

  private getUserPreferences(userId: string): NotificationPreferences | undefined {
    return this.preferences.get(userId);
  }

  async processAlert(alert: Alert): Promise<Alert> {
    const existingAlert = this.alerts.get(alert.id);
    if (!existingAlert) {
      this.alerts.set(alert.id, alert);
    }

    const currentAlert = this.alerts.get(alert.id)!;
    const policy = this.findPolicyForSeverity(currentAlert.severity);

    if (!policy) {
      return currentAlert;
    }

    const levelConfig = policy.levels.find((l) => l.level === currentAlert.currentLevel);
    if (!levelConfig) {
      return currentAlert;
    }

    if (currentAlert.currentLevel < policy.maxLevel) {
      const nextLevel = (currentAlert.currentLevel + 1) as EscalationLevel;
      const updatedAlert: Alert = {
        ...currentAlert,
        currentLevel: nextLevel,
        status: 'escalated',
      };
      this.alerts.set(alert.id, updatedAlert);
      return updatedAlert;
    }

    return currentAlert;
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<Alert> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    const updatedAlert: Alert = {
      ...alert,
      status: 'acknowledged',
      acknowledgedAt: new Date(),
      acknowledgedBy: userId,
    };
    this.alerts.set(alertId, updatedAlert);
    return updatedAlert;
  }

  async resolveAlert(alertId: string, userId: string): Promise<Alert> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    const updatedAlert: Alert = {
      ...alert,
      status: 'resolved',
      resolvedAt: new Date(),
      resolvedBy: userId,
    };
    this.alerts.set(alertId, updatedAlert);
    return updatedAlert;
  }

  async notifyChannels(
    alert: Alert,
    channels: NotificationChannel[],
    templateId?: string
  ): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = [];
    const template = templateId ? this.getTemplate(templateId) : undefined;

    for (const channel of channels) {
      const sender = this.getSender(channel);
      if (!sender) {
        results.push({
          success: false,
          channel,
          error: `No sender configured for channel: ${channel}`,
          timestamp: new Date(),
        });
        continue;
      }

      const notification: Notification = {
        id: generateId('notif'),
        userId: alert.metadata?.userId as string || 'system',
        channel,
        templateId,
        payload: {
          title: template?.subject || `Alert: ${alert.ruleName}`,
          message: template?.body || `Alert ${alert.id} requires attention`,
          data: { alertId: alert.id, severity: alert.severity },
        },
        status: 'pending',
        severity: alert.severity,
        createdAt: new Date(),
      };

      try {
        const result = await sender.send(notification);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          channel,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        });
      }
    }

    return results;
  }

  getAlert(alertId: string): Alert | undefined {
    return this.alerts.get(alertId);
  }

  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  getAlertsByStatus(status: Alert['status']): Alert[] {
    return this.getAllAlerts().filter((a) => a.status === status);
  }

  private findPolicyForSeverity(_severity: AlertSeverity): EscalationPolicy | undefined {
    const policies = Array.from(this.policies.values());
    return policies[0];
  }
}

export class NotificationManager {
  private templates: Map<string, NotificationTemplate> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private notifications: Map<string, Notification> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private escalationManager: EscalationManager;
  private alertEvaluator: AlertEvaluator;
  private senders: Map<NotificationChannel, INotificationSender> = new Map();
  private preferences: Map<string, NotificationPreferences> = new Map();
  private config: NotificationManagerConfig;

  constructor(config: Partial<NotificationManagerConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelayMs: 1000,
      deliveryTimeoutMs: 30000,
      escalationCheckIntervalMs: 60000,
      ...config,
    };

    this.escalationManager = new EscalationManager();
    this.alertEvaluator = new AlertEvaluator();

    this.registerDefaultSenders();
  }

  private registerDefaultSenders(): void {
    this.senders.set('email', new EmailSender());
    this.senders.set('sms', new SmsSender());
    this.senders.set('push', new PushSender());
    this.senders.set('webhook', new WebhookSender());

    this.senders.forEach((sender, channel) => {
      this.escalationManager.setSender(channel, sender);
    });
  }

  createTemplate(
    template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): NotificationTemplate {
    const now = new Date();
    const newTemplate: NotificationTemplate = {
      ...template,
      id: generateId('tmpl'),
      createdAt: now,
      updatedAt: now,
    };
    this.templates.set(newTemplate.id, newTemplate);
    this.escalationManager.setTemplate(newTemplate);
    return newTemplate;
  }

  updateTemplate(
    id: string,
    updates: Partial<Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>>
  ): NotificationTemplate {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`Template not found: ${id}`);
    }

    const updated: NotificationTemplate = {
      ...template,
      ...updates,
      id: template.id,
      createdAt: template.createdAt,
      updatedAt: new Date(),
    };
    this.templates.set(id, updated);
    this.escalationManager.setTemplate(updated);
    return updated;
  }

  getTemplate(id: string): NotificationTemplate | undefined {
    return this.templates.get(id);
  }

  deleteTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  getAllTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values());
  }

  createRule(
    rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>
  ): AlertRule {
    const now = new Date();
    const newRule: AlertRule = {
      ...rule,
      id: generateId('rule'),
      createdAt: now,
      updatedAt: now,
    };
    this.rules.set(newRule.id, newRule);
    return newRule;
  }

  updateRule(
    id: string,
    updates: Partial<Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>>
  ): AlertRule {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new Error(`Rule not found: ${id}`);
    }

    const updated: AlertRule = {
      ...rule,
      ...updates,
      id: rule.id,
      createdAt: rule.createdAt,
      updatedAt: new Date(),
    };
    this.rules.set(id, updated);
    return updated;
  }

  getRule(id: string): AlertRule | undefined {
    return this.rules.get(id);
  }

  deleteRule(id: string): boolean {
    return this.rules.delete(id);
  }

  getAllRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  setEscalationPolicy(policy: Omit<EscalationPolicy, 'id' | 'createdAt' | 'updatedAt'>): EscalationPolicy {
    const now = new Date();
    const newPolicy: EscalationPolicy = {
      ...policy,
      id: generateId('pol'),
      createdAt: now,
      updatedAt: now,
    };
    this.escalationManager.setEscalationPolicy(newPolicy);
    return newPolicy;
  }

  setUserPreferences(preferences: NotificationPreferences): void {
    this.preferences.set(preferences.userId, preferences);
    this.escalationManager.setUserPreferences(preferences);
  }

  getUserPreferences(userId: string): NotificationPreferences | undefined {
    return this.preferences.get(userId);
  }

  async sendNotification(
    userId: string,
    channel: NotificationChannel,
    payload: NotificationPayload,
    options?: {
      templateId?: string;
      severity?: AlertSeverity;
      metadata?: Record<string, unknown>;
    }
  ): Promise<Notification> {
    const sender = this.senders.get(channel);
    if (!sender) {
      throw new Error(`No sender configured for channel: ${channel}`);
    }

    const preferences = this.getUserPreferences(userId);
    if (preferences) {
      if (preferences.channels[channel] === false) {
        throw new Error(`User has disabled channel: ${channel}`);
      }

      if (options?.severity && preferences.severityThresholds[options.severity] === false) {
        throw new Error(`User has disabled notifications for severity: ${options.severity}`);
      }
    }

    const template = options?.templateId ? this.getTemplate(options.templateId) : undefined;

    const notification: Notification = {
      id: generateId('notif'),
      userId,
      channel,
      templateId: options?.templateId,
      payload: template
        ? {
            title: this.interpolateTemplate(template.subject || '', payload.data || {}),
            message: this.interpolateTemplate(template.body, payload.data || {}),
            data: payload.data,
          }
        : payload,
      status: 'pending',
      severity: options?.severity,
      createdAt: new Date(),
      metadata: options?.metadata,
    };

    this.notifications.set(notification.id, notification);

    const result = await this.deliverNotification(notification, sender);

    if (result.success) {
      notification.status = 'sent';
      notification.sentAt = result.timestamp;
    } else {
      notification.status = 'failed';
      notification.metadata = {
        ...notification.metadata,
        error: result.error,
      };
    }

    this.notifications.set(notification.id, notification);
    return notification;
  }

  private async deliverNotification(
    notification: Notification,
    sender: INotificationSender,
    attempt: number = 1
  ): Promise<DeliveryResult> {
    try {
      const result = await sender.send(notification);
      return result;
    } catch (error) {
      if (attempt < this.config.maxRetries) {
        await this.delay(this.config.retryDelayMs);
        return this.deliverNotification(notification, sender, attempt + 1);
      }

      return {
        success: false,
        channel: notification.channel,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  private interpolateTemplate(template: string, data: Record<string, unknown>): string {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return result;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async triggerAlert(
    ruleId: string,
    metrics: Record<string, number>,
    metadata?: Record<string, unknown>
  ): Promise<Alert> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    const isTriggered = this.alertEvaluator.evaluate(rule, metrics);
    if (!isTriggered) {
      throw new Error('Alert conditions not met');
    }

    const alert: Alert = {
      id: generateId('alert'),
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      status: 'active',
      currentLevel: 0 as EscalationLevel,
      triggeredAt: new Date(),
      metadata,
    };

    this.alerts.set(alert.id, alert);

    const results = await this.escalationManager.notifyChannels(alert, rule.channels, rule.templateId);

    const failedChannels = results.filter((r) => !r.success).map((r) => r.channel);
    if (failedChannels.length > 0) {
      alert.metadata = {
        ...alert.metadata,
        failedChannels,
      };
    }

    this.alerts.set(alert.id, alert);
    return alert;
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<Alert> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    const updated: Alert = {
      ...alert,
      status: 'acknowledged',
      acknowledgedAt: new Date(),
      acknowledgedBy: userId,
    };
    this.alerts.set(alertId, updated);
    return updated;
  }

  async resolveAlert(alertId: string, userId: string): Promise<Alert> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    const updated: Alert = {
      ...alert,
      status: 'resolved',
      resolvedAt: new Date(),
      resolvedBy: userId,
    };
    this.alerts.set(alertId, updated);
    return updated;
  }

  async escalateAlert(alertId: string): Promise<Alert> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    const updated = await this.escalationManager.processAlert(alert);
    this.alerts.set(alertId, updated);
    return updated;
  }

  getAlert(alertId: string): Alert | undefined {
    return this.alerts.get(alertId);
  }

  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  getAlertsByStatus(status: Alert['status']): Alert[] {
    return this.getAllAlerts().filter((a) => a.status === status);
  }

  getAlertsBySeverity(severity: AlertSeverity): Alert[] {
    return this.getAllAlerts().filter((a) => a.severity === severity);
  }

  getNotification(notificationId: string): Notification | undefined {
    return this.notifications.get(notificationId);
  }

  getAllNotifications(): Notification[] {
    return Array.from(this.notifications.values());
  }

  getNotificationsByUser(userId: string): Notification[] {
    return this.getAllNotifications().filter((n) => n.userId === userId);
  }

  getNotificationsByStatus(status: NotificationStatus): Notification[] {
    return this.getAllNotifications().filter((n) => n.status === status);
  }

  getNotificationsByChannel(channel: NotificationChannel): Notification[] {
    return this.getAllNotifications().filter((n) => n.channel === channel);
  }

  registerSender(channel: NotificationChannel, sender: INotificationSender): void {
    this.senders.set(channel, sender);
    this.escalationManager.setSender(channel, sender);
  }

  isRuleEnabled(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    return rule?.enabled ?? false;
  }

  enableRule(ruleId: string): void {
    this.updateRule(ruleId, { enabled: true });
  }

  disableRule(ruleId: string): void {
    this.updateRule(ruleId, { enabled: false });
  }
}

export function createNotificationManager(
  config?: Partial<NotificationManagerConfig>
): NotificationManager {
  return new NotificationManager(config);
}

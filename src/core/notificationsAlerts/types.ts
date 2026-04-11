export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type NotificationChannel = 'email' | 'sms' | 'push' | 'webhook';

export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

export type EscalationLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  subject?: string;
  body: string;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPayload {
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface Notification {
  id: string;
  userId: string;
  channel: NotificationChannel;
  templateId?: string;
  payload: NotificationPayload;
  status: NotificationStatus;
  severity?: AlertSeverity;
  createdAt: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface AlertThreshold {
  metric: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq';
  value: number;
  durationMs?: number;
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  severity: AlertSeverity;
  thresholds: AlertThreshold[];
  channels: NotificationChannel[];
  templateId?: string;
  cooldownMs: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EscalationPolicy {
  id: string;
  name: string;
  description?: string;
  levels: EscalationLevelConfig[];
  maxLevel: EscalationLevel;
  createdAt: Date;
  updatedAt: Date;
}

export interface EscalationLevelConfig {
  level: EscalationLevel;
  delayMs: number;
  channels: NotificationChannel[];
  templateId?: string;
  assignTo?: string[];
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  status: 'active' | 'acknowledged' | 'resolved' | 'escalated';
  currentLevel: EscalationLevel;
  triggeredAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationPreferences {
  userId: string;
  channels: Partial<Record<NotificationChannel, boolean>>;
  severityThresholds: Partial<Record<AlertSeverity, boolean>>;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone: string;
}

export interface DeliveryResult {
  success: boolean;
  channel: NotificationChannel;
  messageId?: string;
  error?: string;
  timestamp: Date;
}

export interface NotificationManagerConfig {
  maxRetries: number;
  retryDelayMs: number;
  deliveryTimeoutMs: number;
  escalationCheckIntervalMs: number;
}

export interface INotificationSender {
  send(notification: Notification): Promise<DeliveryResult>;
}

export interface IAlertEvaluator {
  evaluate(rule: AlertRule, metrics: Record<string, number>): boolean;
}

export interface IEscalationManager {
  processAlert(alert: Alert): Promise<Alert>;
  acknowledgeAlert(alertId: string, userId: string): Promise<Alert>;
  resolveAlert(alertId: string, userId: string): Promise<Alert>;
}

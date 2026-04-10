/**
 * Real-time Notification Types
 * WebSocket-based notifications with presence tracking
 */

export type NotificationChannel = 'websocket' | 'push' | 'email' | 'sms';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type UserPresence = 'online' | 'away' | 'busy' | 'offline';
export type NotificationGrouping = 'by_type' | 'by_time' | 'by_sender' | 'none';

export interface Notification {
  notificationId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  channel: NotificationChannel;
  metadata?: Record<string, unknown>;
  scheduledFor?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

export interface NotificationPreferences {
  userId: string;
  channels: Record<NotificationChannel, boolean>;
  byType: Record<string, boolean>;
  quietHoursStart?: string; // HH:MM format
  quietHoursEnd?: string;
  timezone: string;
  grouping: NotificationGrouping;
  maxPerDay: number;
  emailDigestFrequency?: 'realtime' | 'hourly' | 'daily' | 'weekly';
}

export interface UserPresenceState {
  userId: string;
  presence: UserPresence;
  lastSeenAt: Date;
  statusMessage?: string;
  customStatus?: string;
  clientInfo?: {
    ip?: string;
    userAgent?: string;
    deviceType?: string;
  };
}

export interface NotificationBatch {
  batchId: string;
  userId: string;
  notifications: Notification[];
  grouping: NotificationGrouping;
  createdAt: Date;
}

export interface PushSubscription {
  subscriptionId: string;
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  deviceInfo?: {
    deviceType: string;
    os: string;
    browser: string;
  };
  createdAt: Date;
  expiresAt?: Date;
}

export interface NotificationTemplate {
  templateId: string;
  name: string;
  type: string;
  subject?: string;
  body: string;
  channels: NotificationChannel[];
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationAnalytics {
  notificationId: string;
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  deliveryTimeMs?: number;
  readTimeMs?: number;
  channel: NotificationChannel;
}

export interface WebSocketMessage {
  messageId: string;
  type: 'notification' | 'presence_update' | 'typing_indicator' | 'ack' | 'error';
  payload: unknown;
  timestamp: Date;
}

export interface WebSocketConnection {
  connectionId: string;
  userId: string;
  socket: any; // WebSocket instance
  connectedAt: Date;
  lastActivityAt: Date;
  subscriptions: string[];
}

export interface NotificationService {
  // Sending
  send(notification: Omit<Notification, 'notificationId' | 'createdAt'>): Promise<Notification>;
  sendBatch(notifications: Omit<Notification, 'notificationId' | 'createdAt'>[]): Promise<Notification[]>;
  sendToUser(userId: string, notification: Omit<Notification, 'userId' | 'notificationId' | 'createdAt'>): Promise<Notification>;
  sendFromTemplate(userId: string, templateId: string, variables: Record<string, string>): Promise<Notification>;

  // Scheduling
  schedule(notification: Omit<Notification, 'notificationId' | 'createdAt'>, scheduledFor: Date): Promise<Notification>;
  cancelScheduled(notificationId: string): Promise<void>;
  reschedule(notificationId: string, newScheduledFor: Date): Promise<void>;

  // Reading
  getNotification(notificationId: string): Promise<Notification | null>;
  getUserNotifications(userId: string, options?: GetNotificationsOptions): Promise<Notification[]>;
  getUnreadCount(userId: string): Promise<number>;
  markAsRead(notificationId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;

  // Delivery
  retryDelivery(notificationId: string): Promise<void>;
  getDeliveryStatus(notificationId: string): Promise<NotificationAnalytics | null>;

  // Templates
  createTemplate(template: Omit<NotificationTemplate, 'templateId' | 'createdAt' | 'updatedAt'>): Promise<NotificationTemplate>;
  getTemplate(templateId: string): Promise<NotificationTemplate | null>;
  updateTemplate(templateId: string, updates: Partial<NotificationTemplate>): Promise<NotificationTemplate>;
  deleteTemplate(templateId: string): Promise<void>;
}

export interface GetNotificationsOptions {
  status?: NotificationStatus;
  type?: string;
  limit?: number;
  offset?: number;
  since?: Date;
  includeExpired?: boolean;
}

export interface PresenceService {
  // Presence management
  setPresence(userId: string, presence: UserPresence, statusMessage?: string): Promise<void>;
  getPresence(userId: string): Promise<UserPresenceState | null>;
  getPresenceList(userIds: string[]): Promise<Map<string, UserPresenceState>>;
  getOnlineUsers(): Promise<string[]>;

  // Status updates
  updateStatusMessage(userId: string, message: string): Promise<void>;
  setCustomStatus(userId: string, status: string, expiresAt?: Date): Promise<void>;
  clearCustomStatus(userId: string): Promise<void>;

  // Activity tracking
  recordActivity(userId: string): Promise<void>;
  getIdleTime(userId: string): Promise<number>; // in seconds
  setAwayAutomatically(userId: string, idleMinutes: number): Promise<void>;
}

export interface PushService {
  // Subscription management
  subscribe(userId: string, subscription: Omit<PushSubscription, 'subscriptionId' | 'userId' | 'createdAt'>): Promise<PushSubscription>;
  unsubscribe(subscriptionId: string): Promise<void>;
  getUserSubscriptions(userId: string): Promise<PushSubscription[]>;
  sendPush(notification: Notification): Promise<void>;

  // VAPID keys (in production, these would be environment variables)
  getVAPIDPublicKey(): string;
  sendVAPIDNotification(subscription: PushSubscription, payload: any): Promise<void>;
}

export interface NotificationAnalyticsService {
  trackSent(notification: Notification): Promise<void>;
  trackDelivered(notificationId: string): Promise<void>;
  trackRead(notificationId: string): Promise<void>;
  getAnalytics(notificationId: string): Promise<NotificationAnalytics | null>;
  getUserAnalytics(userId: string, period: { start: Date; end: Date }): Promise<UserNotificationAnalytics>;
  getAggregateAnalytics(period: { start: Date; end: Date }): Promise<AggregateNotificationAnalytics>;
}

export interface UserNotificationAnalytics {
  userId: string;
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  averageDeliveryTimeMs: number;
  averageReadTimeMs: number;
  byChannel: Record<NotificationChannel, number>;
  byType: Record<string, number>;
  readRate: number;
  deliveryRate: number;
}

export interface AggregateNotificationAnalytics {
  period: { start: Date; end: Date };
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  averageDeliveryTimeMs: number;
  averageReadTimeMs: number;
  byChannel: Record<NotificationChannel, number>;
  byType: Record<string, number>;
  topUsers: Array<{ userId: string; count: number }>;
  topNotificationTypes: Array<{ type: string; count: number }>;
  deliveryRate: number;
  readRate: number;
  peakHours: Array<{ hour: number; count: number }>;
}

export interface WebSocketManager {
  // Connection management
  connect(userId: string, socket: any): Promise<WebSocketConnection>;
  disconnect(connectionId: string): Promise<void>;
  getConnection(connectionId: string): Promise<WebSocketConnection | null>;
  getUserConnections(userId: string): Promise<WebSocketConnection[]>;

  // Messaging
  sendMessage(connectionId: string, message: WebSocketMessage): Promise<void>;
  broadcastToUser(userId: string, message: WebSocketMessage): Promise<void>;
  broadcastToUsers(userIds: string[], message: WebSocketMessage): Promise<void>;
  broadcastToAll(message: WebSocketMessage): Promise<void>;

  // Subscriptions
  subscribe(connectionId: string, eventType: string): Promise<void>;
  unsubscribe(connectionId: string, eventType: string): Promise<void>;

  // Heartbeat
  startHeartbeat(connectionId: string, intervalMs?: number): void;
  stopHeartbeat(connectionId: string): void;
  checkHeartbeat(connectionId: string): boolean;
}

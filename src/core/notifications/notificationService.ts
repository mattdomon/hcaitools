/**
 * Notification Service Implementation
 * Real-time notifications with WebSocket, presence, and delivery tracking
 */

import crypto from 'crypto';
import {
  Notification,
  NotificationPreferences,
  UserPresenceState,
  NotificationTemplate,
  NotificationAnalytics,
  WebSocketMessage,
  WebSocketConnection,
  NotificationService,
  PresenceService,
  WebSocketManager,
  GetNotificationsOptions,
  UserPresence,
} from './types';

export class NotificationServiceImpl implements NotificationService, PresenceService, WebSocketManager {
  private notifications: Map<string, Notification> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private preferences: Map<string, NotificationPreferences> = new Map();
  private presence: Map<string, UserPresenceState> = new Map();
  private connections: Map<string, WebSocketConnection> = new Map();
  private userConnections: Map<string, Set<string>> = new Map();
  private scheduledNotifications: Map<string, NodeJS.Timeout> = new Map();
  private heartbeats: Map<string, NodeJS.Timeout> = new Map();

  // NotificationService implementation
  async send(notification: Omit<Notification, 'notificationId' | 'createdAt'>): Promise<Notification> {
    const fullNotification: Notification = {
      ...notification,
      notificationId: this.generateId('notif'),
      createdAt: new Date(),
      status: 'sent',
      sentAt: new Date(),
    };

    this.notifications.set(fullNotification.notificationId, fullNotification);

    // Track analytics
    await this.trackSent(fullNotification);

    // Deliver via WebSocket if user is online
    await this.deliverViaWebSocket(fullNotification);

    return fullNotification;
  }

  async sendBatch(notifications: Omit<Notification, 'notificationId' | 'createdAt'>[]): Promise<Notification[]> {
    const results: Notification[] = [];
    for (const notification of notifications) {
      const result = await this.send(notification);
      results.push(result);
    }
    return results;
  }

  async sendToUser(
    userId: string,
    notification: Omit<Notification, 'userId' | 'notificationId' | 'createdAt'>
  ): Promise<Notification> {
    return this.send({
      ...notification,
      userId,
    });
  }

  async sendFromTemplate(
    userId: string,
    templateId: string,
    variables: Record<string, string>
  ): Promise<Notification> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    let body = template.body;

    for (const [key, value] of Object.entries(variables)) {
      body = body.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return this.sendToUser(userId, {
      type: template.type,
      title: template.name,
      message: body,
      priority: 'normal',
      status: 'pending',
      channel: template.channels[0] || 'websocket',
    });
  }

  async schedule(
    notification: Omit<Notification, 'notificationId' | 'createdAt'>,
    scheduledFor: Date
  ): Promise<Notification> {
    const fullNotification: Notification = {
      ...notification,
      notificationId: this.generateId('notif'),
      createdAt: new Date(),
      status: 'pending',
      scheduledFor,
    };

    this.notifications.set(fullNotification.notificationId, fullNotification);

    const delay = scheduledFor.getTime() - Date.now();
    if (delay > 0) {
      const timeout = setTimeout(() => {
        this.send(fullNotification);
      }, delay);
      this.scheduledNotifications.set(fullNotification.notificationId, timeout);
    }

    return fullNotification;
  }

  async cancelScheduled(notificationId: string): Promise<void> {
    const timeout = this.scheduledNotifications.get(notificationId);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduledNotifications.delete(notificationId);
    }

    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.status = 'failed';
      this.notifications.set(notificationId, notification);
    }
  }

  async reschedule(notificationId: string, newScheduledFor: Date): Promise<void> {
    await this.cancelScheduled(notificationId);
    const notification = this.notifications.get(notificationId);
    if (notification) {
      await this.schedule(notification, newScheduledFor);
    }
  }

  async getNotification(notificationId: string): Promise<Notification | null> {
    return this.notifications.get(notificationId) || null;
  }

  async getUserNotifications(userId: string, options?: GetNotificationsOptions): Promise<Notification[]> {
    let notifications = Array.from(this.notifications.values()).filter((n) => n.userId === userId);

    if (options?.status) {
      notifications = notifications.filter((n) => n.status === options.status);
    }

    if (options?.type) {
      notifications = notifications.filter((n) => n.type === options.type);
    }

    if (options?.since) {
      notifications = notifications.filter((n) => n.createdAt >= options.since!);
    }

    if (!options?.includeExpired) {
      const now = new Date();
      notifications = notifications.filter((n) => !n.expiresAt || n.expiresAt > now);
    }

    notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (options?.offset) {
      notifications = notifications.slice(options.offset);
    }

    if (options?.limit) {
      notifications = notifications.slice(0, options.limit);
    }

    return notifications;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const notifications = await this.getUserNotifications(userId, { status: 'delivered' });
    return notifications.filter((n) => !n.readAt).length;
  }

  async markAsRead(notificationId: string): Promise<void> {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.status = 'read';
      notification.readAt = new Date();
      this.notifications.set(notificationId, notification);
      await this.trackRead(notificationId);
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    const notifications = await this.getUserNotifications(userId, { status: 'delivered' });
    for (const notification of notifications) {
      if (!notification.readAt) {
        await this.markAsRead(notification.notificationId);
      }
    }
  }

  async retryDelivery(notificationId: string): Promise<void> {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.status = 'pending';
      await this.send(notification);
    }
  }

  async getDeliveryStatus(notificationId: string): Promise<NotificationAnalytics | null> {
    const notification = this.notifications.get(notificationId);
    if (!notification) return null;

    return {
      notificationId,
      sentAt: notification.sentAt!,
      deliveredAt: notification.deliveredAt,
      readAt: notification.readAt,
      deliveryTimeMs: notification.deliveredAt
        ? notification.deliveredAt.getTime() - notification.sentAt!.getTime()
        : undefined,
      readTimeMs:
        notification.readAt && notification.deliveredAt
          ? notification.readAt.getTime() - notification.deliveredAt.getTime()
          : undefined,
      channel: notification.channel,
    };
  }

  // Template management
  async createTemplate(
    template: Omit<NotificationTemplate, 'templateId' | 'createdAt' | 'updatedAt'>
  ): Promise<NotificationTemplate> {
    const fullTemplate: NotificationTemplate = {
      ...template,
      templateId: this.generateId('tmpl'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.templates.set(fullTemplate.templateId, fullTemplate);
    return fullTemplate;
  }

  async getTemplate(templateId: string): Promise<NotificationTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  async updateTemplate(
    templateId: string,
    updates: Partial<NotificationTemplate>
  ): Promise<NotificationTemplate> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const updated: NotificationTemplate = {
      ...template,
      ...updates,
      templateId,
      createdAt: template.createdAt,
      updatedAt: new Date(),
    };

    this.templates.set(templateId, updated);
    return updated;
  }

  async deleteTemplate(templateId: string): Promise<void> {
    this.templates.delete(templateId);
  }

  // PresenceService implementation
  async setPresence(userId: string, presence: UserPresence, statusMessage?: string): Promise<void> {
    const state: UserPresenceState = {
      userId,
      presence,
      lastSeenAt: new Date(),
      statusMessage,
    };

    this.presence.set(userId, state);
    await this.broadcastPresenceUpdate(userId);
  }

  async getPresence(userId: string): Promise<UserPresenceState | null> {
    return this.presence.get(userId) || null;
  }

  async getPresenceList(userIds: string[]): Promise<Map<string, UserPresenceState>> {
    const result = new Map<string, UserPresenceState>();
    for (const userId of userIds) {
      const state = this.presence.get(userId);
      if (state) {
        result.set(userId, state);
      }
    }
    return result;
  }

  async getOnlineUsers(): Promise<string[]> {
    const online: string[] = [];
    for (const [userId, state] of this.presence.entries()) {
      if (state.presence === 'online') {
        online.push(userId);
      }
    }
    return online;
  }

  async updateStatusMessage(userId: string, message: string): Promise<void> {
    const state = this.presence.get(userId);
    if (state) {
      state.statusMessage = message;
      state.lastSeenAt = new Date();
      this.presence.set(userId, state);
      await this.broadcastPresenceUpdate(userId);
    }
  }

  async setCustomStatus(userId: string, status: string, expiresAt?: Date): Promise<void> {
    const state = this.presence.get(userId);
    if (state) {
      state.customStatus = status;
      if (expiresAt) state.customStatus = status;
      this.presence.set(userId, state);
    }
  }

  async clearCustomStatus(userId: string): Promise<void> {
    const state = this.presence.get(userId);
    if (state) {
      state.customStatus = undefined;
      this.presence.set(userId, state);
    }
  }

  async recordActivity(userId: string): Promise<void> {
    const state = this.presence.get(userId);
    if (state) {
      state.lastSeenAt = new Date();
      if (state.presence === 'away') {
        state.presence = 'online';
      }
      this.presence.set(userId, state);
    }
  }

  async getIdleTime(userId: string): Promise<number> {
    const state = this.presence.get(userId);
    if (!state) return Infinity;
    return Math.floor((Date.now() - state.lastSeenAt.getTime()) / 1000);
  }

  async setAwayAutomatically(userId: string, idleMinutes: number): Promise<void> {
    const state = this.presence.get(userId);
    if (state && state.presence === 'online') {
      const idleSeconds = await this.getIdleTime(userId);
      if (idleSeconds >= idleMinutes * 60) {
        state.presence = 'away';
        this.presence.set(userId, state);
        await this.broadcastPresenceUpdate(userId);
      }
    }
  }

  // WebSocketManager implementation
  async connect(userId: string, socket: any): Promise<WebSocketConnection> {
    const connectionId = this.generateId('conn');

    const connection: WebSocketConnection = {
      connectionId,
      userId,
      socket,
      connectedAt: new Date(),
      lastActivityAt: new Date(),
      subscriptions: [],
    };

    this.connections.set(connectionId, connection);

    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    // Set user presence to online
    await this.setPresence(userId, 'online');

    return connection;
  }

  async disconnect(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection) {
      const userConns = this.userConnections.get(connection.userId);
      if (userConns) {
        userConns.delete(connectionId);
        if (userConns.size === 0) {
          this.userConnections.delete(connection.userId);
          // Set user presence to offline
          await this.setPresence(connection.userId, 'offline');
        }
      }
      this.connections.delete(connectionId);
    }

    // Stop heartbeat
    this.stopHeartbeat(connectionId);
  }

  async getConnection(connectionId: string): Promise<WebSocketConnection | null> {
    return this.connections.get(connectionId) || null;
  }

  async getUserConnections(userId: string): Promise<WebSocketConnection[]> {
    const connIds = this.userConnections.get(userId);
    if (!connIds) return [];
    return Array.from(connIds)
      .map((id) => this.connections.get(id))
      .filter((c) => c !== undefined) as WebSocketConnection[];
  }

  async sendMessage(connectionId: string, message: WebSocketMessage): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection?.socket) {
      connection.socket.send(JSON.stringify(message));
      connection.lastActivityAt = new Date();
    }
  }

  async broadcastToUser(userId: string, message: WebSocketMessage): Promise<void> {
    const connections = await this.getUserConnections(userId);
    for (const conn of connections) {
      await this.sendMessage(conn.connectionId, message);
    }
  }

  async broadcastToUsers(userIds: string[], message: WebSocketMessage): Promise<void> {
    for (const userId of userIds) {
      await this.broadcastToUser(userId, message);
    }
  }

  async broadcastToAll(message: WebSocketMessage): Promise<void> {
    for (const conn of this.connections.values()) {
      await this.sendMessage(conn.connectionId, message);
    }
  }

  async subscribe(connectionId: string, eventType: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection && !connection.subscriptions.includes(eventType)) {
      connection.subscriptions.push(eventType);
    }
  }

  async unsubscribe(connectionId: string, eventType: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.subscriptions = connection.subscriptions.filter((s) => s !== eventType);
    }
  }

  startHeartbeat(connectionId: string, intervalMs: number = 30000): void {
    this.stopHeartbeat(connectionId);

    const timeout = setInterval(() => {
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.lastActivityAt = new Date();
      }
    }, intervalMs);

    this.heartbeats.set(connectionId, timeout);
  }

  stopHeartbeat(connectionId: string): void {
    const timeout = this.heartbeats.get(connectionId);
    if (timeout) {
      clearInterval(timeout);
      this.heartbeats.delete(connectionId);
    }
  }

  checkHeartbeat(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    const timeout = 60000; // 60 seconds
    return Date.now() - connection.lastActivityAt.getTime() < timeout;
  }

  // Analytics
  async trackSent(_notification: Notification): Promise<void> {
    // In production, would write to analytics store
  }

  async trackDelivered(notificationId: string): Promise<void> {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.status = 'delivered';
      notification.deliveredAt = new Date();
      this.notifications.set(notificationId, notification);
    }
  }

  async trackRead(_notificationId: string): Promise<void> {
    // In production, would write to analytics store
  }

  // Private helpers
  private async deliverViaWebSocket(notification: Notification): Promise<void> {
    const message: WebSocketMessage = {
      messageId: this.generateId('msg'),
      type: 'notification',
      payload: notification,
      timestamp: new Date(),
    };

    await this.broadcastToUser(notification.userId, message);
    await this.trackDelivered(notification.notificationId);
  }

  private async broadcastPresenceUpdate(userId: string): Promise<void> {
    const state = this.presence.get(userId);
    if (!state) return;

    const message: WebSocketMessage = {
      messageId: this.generateId('msg'),
      type: 'presence_update',
      payload: state,
      timestamp: new Date(),
    };

    await this.broadcastToUser(userId, message);
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

// Factory
export function createNotificationService(): NotificationServiceImpl {
  return new NotificationServiceImpl();
}

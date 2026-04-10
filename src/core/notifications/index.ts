/**
 * Real-time Notifications
 * WebSocket-based notifications with presence tracking
 */

export {
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  UserPresence,
  NotificationGrouping,
  Notification,
  NotificationPreferences,
  UserPresenceState,
  NotificationBatch,
  PushSubscription,
  NotificationTemplate,
  NotificationAnalytics,
  WebSocketMessage,
  WebSocketConnection,
  NotificationService,
  GetNotificationsOptions,
  PresenceService,
  PushService,
  NotificationAnalyticsService,
  UserNotificationAnalytics,
  AggregateNotificationAnalytics,
  WebSocketManager,
} from './types';

export { NotificationServiceImpl, createNotificationService } from './notificationService';

import { NotificationServiceImpl } from './notificationService';

/**
 * NotificationManus
 * Main class for real-time notifications
 */
export class NotificationManus {
  private service: NotificationServiceImpl;

  constructor() {
    this.service = new NotificationServiceImpl();
  }

  /**
   * Send notification to user
   */
  async send(userId: string, type: string, title: string, message: string, priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal') {
    return this.service.sendToUser(userId, {
      type,
      title,
      message,
      priority,
      status: 'pending',
      channel: 'websocket',
    });
  }

  /**
   * Send urgent notification
   */
  async urgent(userId: string, title: string, message: string) {
    return this.send(userId, 'urgent', title, message, 'urgent');
  }

  /**
   * Send email notification
   */
  async email(userId: string, title: string, message: string) {
    return this.service.sendToUser(userId, {
      type: 'email',
      title,
      message,
      priority: 'normal',
      status: 'pending',
      channel: 'email',
    });
  }

  /**
   * Schedule notification for later
   */
  async schedule(userId: string, type: string, title: string, message: string, scheduledFor: Date) {
    return this.service.schedule(
      {
        userId,
        type,
        title,
        message,
        priority: 'normal',
        status: 'pending',
        channel: 'websocket',
      },
      scheduledFor
    );
  }

  /**
   * Get user notifications
   */
  async getNotifications(userId: string, limit: number = 50) {
    return this.service.getUserNotifications(userId, { limit });
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string) {
    return this.service.getUnreadCount(userId);
  }

  /**
   * Mark as read
   */
  async markAsRead(notificationId: string) {
    return this.service.markAsRead(notificationId);
  }

  /**
   * Mark all as read
   */
  async markAllAsRead(userId: string) {
    return this.service.markAllAsRead(userId);
  }

  /**
   * Set user presence
   */
  async setPresence(userId: string, presence: 'online' | 'away' | 'busy' | 'offline', statusMessage?: string) {
    return this.service.setPresence(userId, presence, statusMessage);
  }

  /**
   * Get user presence
   */
  async getPresence(userId: string) {
    return this.service.getPresence(userId);
  }

  /**
   * Get online users
   */
  async getOnlineUsers() {
    return this.service.getOnlineUsers();
  }

  /**
   * Create notification template
   */
  async createTemplate(name: string, type: string, body: string, channels: ('websocket' | 'push' | 'email' | 'sms')[] = ['websocket']) {
    return this.service.createTemplate({
      name,
      type,
      body,
      channels,
      variables: [],
    });
  }

  /**
   * Send from template
   */
  async sendFromTemplate(userId: string, templateId: string, variables: Record<string, string>) {
    return this.service.sendFromTemplate(userId, templateId, variables);
  }

  /**
   * Example: New message notification
   */
  async notifyNewMessage(userId: string, senderName: string, conversationName: string) {
    return this.send(userId, 'new_message', '💬 New Message', `${senderName} sent a message in ${conversationName}`);
  }

  /**
   * Example: Task assignment notification
   */
  async notifyTaskAssigned(userId: string, taskTitle: string, assignedBy: string) {
    return this.send(userId, 'task_assigned', '✅ Task Assigned', `You have been assigned to: ${taskTitle} by ${assignedBy}`);
  }

  /**
   * Example: Deadline reminder
   */
  async notifyDeadline(userId: string, taskTitle: string, deadline: string) {
    return this.send(userId, 'deadline_reminder', '⏰ Deadline Reminder', `${taskTitle} is due on ${deadline}`, 'high');
  }

  /**
   * Example: System alert
   */
  async notifyAlert(userId: string, alertType: 'error' | 'warning' | 'info', message: string) {
    const priority = alertType === 'error' ? 'urgent' : alertType === 'warning' ? 'high' : 'normal';
    const emoji = alertType === 'error' ? '🚨' : alertType === 'warning' ? '⚠️' : 'ℹ️';
    return this.send(userId, `system_${alertType}`, `${emoji} System ${alertType.charAt(0).toUpperCase() + alertType.slice(1)}`, message, priority);
  }

  /**
   * Example: Daily digest
   */
  async sendDailyDigest(userId: string, summary: { tasks: number; messages: number; mentions: number }) {
    const message = `📊 Your daily summary:\n• ${summary.tasks} tasks updated\n• ${summary.messages} new messages\n• ${summary.mentions} mentions`;
    return this.send(userId, 'daily_digest', '📋 Daily Digest', message);
  }
}

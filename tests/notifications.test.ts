/**
 * Notification Service Tests
 */

import { NotificationServiceImpl } from '../src/core/notifications/notificationService';
import { NotificationManus } from '../src/core/notifications';

describe('NotificationServiceImpl', () => {
  let service: NotificationServiceImpl;

  beforeEach(() => {
    service = new NotificationServiceImpl();
  });

  describe('Sending Notifications', () => {
    test('should send notification', async () => {
      const notification = await service.send({
        userId: 'user123',
        type: 'test',
        title: 'Test Notification',
        message: 'This is a test',
        priority: 'normal',
        status: 'pending',
        channel: 'websocket',
      });

      expect(notification.notificationId).toBeDefined();
      expect(notification.userId).toBe('user123');
      expect(notification.title).toBe('Test Notification');
      expect(notification.status).toBe('delivered');
    });

    test('should send to specific user', async () => {
      const notification = await service.sendToUser('user456', {
        type: 'direct',
        title: 'Direct Message',
        message: 'Hello there!',
        priority: 'high',
        status: 'pending',
        channel: 'websocket',
      });

      expect(notification.userId).toBe('user456');
      expect(notification.priority).toBe('high');
    });

    test('should send batch notifications', async () => {
      const notifications = await service.sendBatch([
        {
          userId: 'user1',
          type: 'batch',
          title: 'Batch 1',
          message: 'First',
          priority: 'normal',
          status: 'pending',
          channel: 'websocket',
        },
        {
          userId: 'user2',
          type: 'batch',
          title: 'Batch 2',
          message: 'Second',
          priority: 'normal',
          status: 'pending',
          channel: 'websocket',
        },
      ]);

      expect(notifications.length).toBe(2);
    });
  });

  describe('Retrieving Notifications', () => {
    beforeEach(async () => {
      await service.sendToUser('user123', {
        type: 'test',
        title: 'Notification 1',
        message: 'First',
        priority: 'normal',
        status: 'pending',
        channel: 'websocket',
      });
      await service.sendToUser('user123', {
        type: 'test',
        title: 'Notification 2',
        message: 'Second',
        priority: 'normal',
        status: 'pending',
        channel: 'websocket',
      });
    });

    test('should get user notifications', async () => {
      const notifications = await service.getUserNotifications('user123');

      expect(notifications.length).toBe(2);
    });

    test('should get notification by ID', async () => {
      const sent = await service.sendToUser('user123', {
        type: 'lookup',
        title: 'Lookup Test',
        message: 'Find me',
        priority: 'normal',
        status: 'pending',
        channel: 'websocket',
      });

      const retrieved = await service.getNotification(sent.notificationId);
      expect(retrieved?.title).toBe('Lookup Test');
    });

    test('should get unread count', async () => {
      await service.sendToUser('user123', {
        type: 'count',
        title: 'Count Test',
        message: 'Test',
        priority: 'normal',
        status: 'delivered',
        channel: 'websocket',
      });

      const count = await service.getUnreadCount('user123');
      expect(count).toBeGreaterThan(0);
    });

    test('should filter by type', async () => {
      await service.sendToUser('user123', {
        type: 'special',
        title: 'Special',
        message: 'Special notification',
        priority: 'normal',
        status: 'pending',
        channel: 'websocket',
      });

      const filtered = await service.getUserNotifications('user123', { type: 'special' });
      expect(filtered.every((n) => n.type === 'special')).toBe(true);
    });
  });

  describe('Marking as Read', () => {
    test('should mark notification as read', async () => {
      const notification = await service.sendToUser('user123', {
        type: 'read_test',
        title: 'Read Test',
        message: 'Mark me as read',
        priority: 'normal',
        status: 'pending',
        channel: 'websocket',
      });

      await service.markAsRead(notification.notificationId);

      const retrieved = await service.getNotification(notification.notificationId);
      expect(retrieved?.status).toBe('read');
      expect(retrieved?.readAt).toBeDefined();
    });

    test('should mark all as read', async () => {
      await service.sendToUser('user123', {
        type: 'mark_all',
        title: 'All Read',
        message: 'Mark all',
        priority: 'normal',
        status: 'pending',
        channel: 'websocket',
      });

      await service.markAllAsRead('user123');

      const notifications = await service.getUserNotifications('user123', { status: 'read' });
      expect(notifications.length).toBeGreaterThan(0);
    });
  });

  describe('Scheduling', () => {
    test('should schedule notification', async () => {
      const futureDate = new Date(Date.now() + 60000); // 1 minute from now

      const notification = await service.schedule(
        {
          userId: 'user123',
          type: 'scheduled',
          title: 'Scheduled',
          message: 'Future notification',
          priority: 'normal',
          status: 'pending',
          channel: 'websocket',
        },
        futureDate
      );

      expect(notification.scheduledFor).toBeDefined();
      expect(notification.status).toBe('pending');
    });

    test('should cancel scheduled notification', async () => {
      const futureDate = new Date(Date.now() + 60000);

      const notification = await service.schedule(
        {
          userId: 'user123',
          type: 'cancel_me',
          title: 'Cancel Me',
          message: 'Cancel this',
          priority: 'normal',
          status: 'pending',
          channel: 'websocket',
        },
        futureDate
      );

      await service.cancelScheduled(notification.notificationId);

      const retrieved = await service.getNotification(notification.notificationId);
      expect(retrieved?.status).toBe('failed');
    });
  });

  describe('Templates', () => {
    test('should create template', async () => {
      const template = await service.createTemplate({
        name: 'Welcome',
        type: 'welcome',
        body: 'Hello {{name}}, welcome to {{company}}!',
        channels: ['websocket', 'email'],
        variables: ['name', 'company'],
      });

      expect(template.templateId).toBeDefined();
      expect(template.name).toBe('Welcome');
      expect(template.variables).toContain('name');
    });

    test('should send from template', async () => {
      const template = await service.createTemplate({
        name: 'Greeting',
        type: 'greeting',
        body: 'Hello {{userName}}!',
        channels: ['websocket'],
        variables: ['userName'],
      });

      const notification = await service.sendFromTemplate('user123', template.templateId, {
        userName: 'John',
      });

      expect(notification.message).toBe('Hello John!');
    });

    test('should update template', async () => {
      const template = await service.createTemplate({
        name: 'Original',
        type: 'test',
        body: 'Original body',
        channels: ['websocket'],
        variables: [],
      });

      const updated = await service.updateTemplate(template.templateId, {
        name: 'Updated',
      });

      expect(updated.name).toBe('Updated');
    });

    test('should delete template', async () => {
      const template = await service.createTemplate({
        name: 'Delete Me',
        type: 'test',
        body: 'Body',
        channels: ['websocket'],
        variables: [],
      });

      await service.deleteTemplate(template.templateId);

      const retrieved = await service.getTemplate(template.templateId);
      expect(retrieved).toBeNull();
    });
  });

  describe('Presence', () => {
    test('should set presence', async () => {
      await service.setPresence('user123', 'online', 'Working');

      const presence = await service.getPresence('user123');
      expect(presence?.presence).toBe('online');
      expect(presence?.statusMessage).toBe('Working');
    });

    test('should get online users', async () => {
      await service.setPresence('user1', 'online');
      await service.setPresence('user2', 'online');
      await service.setPresence('user3', 'offline');

      const online = await service.getOnlineUsers();
      expect(online).toContain('user1');
      expect(online).toContain('user2');
      expect(online).not.toContain('user3');
    });

    test('should update status message', async () => {
      await service.setPresence('user123', 'online');
      await service.updateStatusMessage('user123', 'In a meeting');

      const presence = await service.getPresence('user123');
      expect(presence?.statusMessage).toBe('In a meeting');
    });

    test('should get presence list', async () => {
      await service.setPresence('user1', 'online');
      await service.setPresence('user2', 'away');

      const list = await service.getPresenceList(['user1', 'user2', 'user3']);
      expect(list.size).toBe(2);
      expect(list.get('user1')?.presence).toBe('online');
    });
  });

  describe('Delivery Status', () => {
    test('should get delivery status', async () => {
      const notification = await service.send({
        userId: 'user123',
        type: 'status',
        title: 'Status Check',
        message: 'Check delivery',
        priority: 'normal',
        status: 'pending',
        channel: 'websocket',
      });

      const status = await service.getDeliveryStatus(notification.notificationId);
      expect(status?.notificationId).toBe(notification.notificationId);
      expect(status?.sentAt).toBeDefined();
    });
  });
});

describe('NotificationManus', () => {
  let manus: NotificationManus;

  beforeEach(() => {
    manus = new NotificationManus();
  });

  test('should send notification', async () => {
    const notification = await manus.send('user123', 'test', 'Title', 'Message');
    expect(notification.userId).toBe('user123');
  });

  test('should send urgent notification', async () => {
    const notification = await manus.urgent('user123', 'Emergency', 'System down!');
    expect(notification.priority).toBe('urgent');
  });

  test('should send email notification', async () => {
    const notification = await manus.email('user123', 'Subject', 'Email content');
    expect(notification.channel).toBe('email');
  });

  test('should schedule notification', async () => {
    const future = new Date(Date.now() + 60000);
    const notification = await manus.schedule('user123', 'scheduled', 'Future', 'Message', future);
    expect(notification.scheduledFor).toBeDefined();
  });

  test('should get notifications', async () => {
    await manus.send('user123', 'test', 'Test', 'Test message');
    const notifications = await manus.getNotifications('user123');
    expect(notifications.length).toBeGreaterThan(0);
  });

  test('should get unread count', async () => {
    await manus.send('user123', 'unread', 'Unread', 'Count me');
    const count = await manus.getUnreadCount('user123');
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should mark as read', async () => {
    const notification = await manus.send('user123', 'mark', 'Mark', 'Read me');
    await manus.markAsRead(notification.notificationId);
    const retrieved = await manus.getNotifications('user123', 1);
    const found = retrieved.find((n) => n.notificationId === notification.notificationId);
    expect(found?.status).toBe('read');
  });

  test('should set presence', async () => {
    await manus.setPresence('user123', 'online', 'Available');
    const presence = await manus.getPresence('user123');
    expect(presence?.presence).toBe('online');
  });

  test('should get online users', async () => {
    await manus.setPresence('user1', 'online');
    const online = await manus.getOnlineUsers();
    expect(Array.isArray(online)).toBe(true);
  });

  test('should create template', async () => {
    const template = await manus.createTemplate('Welcome', 'welcome', 'Hello {{name}}!', ['websocket']);
    expect(template.name).toBe('Welcome');
  });

  test('should send from template', async () => {
    const template = await manus.createTemplate('Greet', 'greet', 'Hello {{name}}!', ['websocket']);
    const notification = await manus.sendFromTemplate('user123', template.templateId, { name: 'Alice' });
    expect(notification.message).toBe('Hello Alice!');
  });

  test('should notify new message', async () => {
    const notification = await manus.notifyNewMessage('user123', 'Alice', 'General');
    expect(notification.type).toBe('new_message');
    expect(notification.message).toContain('Alice');
  });

  test('should notify task assigned', async () => {
    const notification = await manus.notifyTaskAssigned('user123', 'Fix bug', 'Manager');
    expect(notification.type).toBe('task_assigned');
    expect(notification.message).toContain('Fix bug');
  });

  test('should notify deadline', async () => {
    const notification = await manus.notifyDeadline('user123', 'Submit report', 'Tomorrow');
    expect(notification.type).toBe('deadline_reminder');
    expect(notification.priority).toBe('high');
  });

  test('should send system alert', async () => {
    const notification = await manus.notifyAlert('user123', 'error', 'Database connection failed');
    expect(notification.priority).toBe('urgent');
    expect(notification.message).toContain('Database');
  });

  test('should send daily digest', async () => {
    const notification = await manus.sendDailyDigest('user123', {
      tasks: 5,
      messages: 12,
      mentions: 3,
    });
    expect(notification.message).toContain('5');
    expect(notification.message).toContain('12');
  });
});

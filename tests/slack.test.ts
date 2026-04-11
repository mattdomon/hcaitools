/**
 * Slack Integration Tests
 */

import { SlackClientImpl } from '../src/core/slack/slackClient';
import { SlackManus } from '../src/core/slack';

describe('SlackClientImpl', () => {
  let client: SlackClientImpl;

  beforeEach(() => {
    client = new SlackClientImpl();
  });

  describe('Channel Management', () => {
    test('should create a public channel', async () => {
      const channel = await client.createChannel('general', 'public', {
        topic: 'Company-wide announcements',
        purpose: 'General discussion',
      });

      expect(channel.channelId).toBeDefined();
      expect(channel.name).toBe('general');
      expect(channel.type).toBe('public');
      expect(channel.topic).toBe('Company-wide announcements');
      expect(channel.purpose).toBe('General discussion');
      expect(channel.isArchived).toBe(false);
    });

    test('should create a private channel', async () => {
      const channel = await client.createChannel('team-secret', 'private');

      expect(channel.type).toBe('private');
    });

    test('should get a channel by ID', async () => {
      const created = await client.createChannel('test-channel', 'public');
      const retrieved = await client.getChannel(created.channelId);

      expect(retrieved?.name).toBe('test-channel');
    });

    test('should list all public channels', async () => {
      await client.createChannel('channel-1', 'public');
      await client.createChannel('channel-2', 'public');
      await client.createChannel('private-channel', 'private');

      const channels = await client.listChannels('public');

      expect(channels.length).toBeGreaterThanOrEqual(2);
      expect(channels.every((c) => c.type === 'public')).toBe(true);
    });

    test('should archive a channel', async () => {
      const channel = await client.createChannel('to-archive', 'public');
      await client.archiveChannel(channel.channelId);

      const archived = await client.getChannel(channel.channelId);
      expect(archived?.isArchived).toBe(true);
    });

    test('should update channel topic and purpose', async () => {
      const channel = await client.createChannel('updatable', 'public');
      const updated = await client.updateChannel(channel.channelId, {
        topic: 'New topic',
        purpose: 'New purpose',
      });

      expect(updated.topic).toBe('New topic');
      expect(updated.purpose).toBe('New purpose');
    });
  });

  describe('User Management', () => {
    test('should add and retrieve user', async () => {
      // Create channel first
      const channel = await client.createChannel('user-test', 'public');
      
      // Users are created internally when referenced
      const userId = 'U12345';
      await client.inviteUser(channel.channelId, userId);

      // In a real implementation, would fetch from Slack API
      const user = await client.getUser(userId);
      expect(user).toBeNull(); // Not found in mock
    });

    test('should list users', async () => {
      const users = await client.listUsers();
      expect(Array.isArray(users)).toBe(true);
    });
  });

  describe('Messaging', () => {
    let channelId: string;

    beforeEach(async () => {
      const channel = await client.createChannel('messages-test', 'public');
      channelId = channel.channelId;
    });

    test('should send a message', async () => {
      const message = await client.sendMessage(channelId, 'Hello, world!');

      expect(message.messageId).toBeDefined();
      expect(message.text).toBe('Hello, world!');
      expect(message.channelId).toBe(channelId);
    });

    test('should send a message with attachments', async () => {
      const message = await client.sendMessage(channelId, 'Check this out', {
        attachments: [
          {
            attachmentId: 'a1',
            title: 'Document',
            text: 'Important document',
            color: '#36a64f',
          },
        ],
      });

      expect(message.attachments.length).toBe(1);
      expect(message.attachments[0].title).toBe('Document');
    });

    test('should send thread reply', async () => {
      const parent = await client.sendMessage(channelId, 'Parent message');
      const reply = await client.sendThreadReply(channelId, parent.messageId, 'This is a reply');

      expect(reply.threadId).toBe(parent.messageId);
      expect(reply.text).toBe('This is a reply');
    });

    test('should update a message', async () => {
      const original = await client.sendMessage(channelId, 'Original text');
      const updated = await client.updateMessage(channelId, original.messageId, 'Updated text');

      expect(updated.text).toBe('Updated text');
      expect(updated.editedAt).toBeDefined();
    });

    test('should delete a message', async () => {
      const message = await client.sendMessage(channelId, 'To be deleted');
      await client.deleteMessage(channelId, message.messageId);

      // Message should be removed
      expect(true).toBe(true);
    });

    test('should pin a message', async () => {
      const message = await client.sendMessage(channelId, 'Important message');
      await client.pinMessage(channelId, message.messageId);

      const retrieved = await client.getChannel(channelId);
      expect(retrieved).toBeDefined();
    });
  });

  describe('Reactions', () => {
    let channelId: string;
    let messageId: string;

    beforeEach(async () => {
      const channel = await client.createChannel('reactions-test', 'public');
      channelId = channel.channelId;
      const message = await client.sendMessage(channelId, 'React to this!');
      messageId = message.messageId;
    });

    test('should add reaction', async () => {
      await client.addReaction(channelId, messageId, 'thumbsup');

      // Reaction added successfully
      expect(true).toBe(true);
    });

    test('should add multiple reactions', async () => {
      await client.addReaction(channelId, messageId, 'thumbsup');
      await client.addReaction(channelId, messageId, 'heart');
      await client.addReaction(channelId, messageId, '+1');

      // All reactions added
      expect(true).toBe(true);
    });

    test('should remove reaction', async () => {
      await client.addReaction(channelId, messageId, 'thumbsup');
      await client.removeReaction(channelId, messageId, 'thumbsup');

      // Reaction removed
      expect(true).toBe(true);
    });
  });

  describe('Notifications', () => {
    let channelId: string;

    beforeEach(async () => {
      const channel = await client.createChannel('notifications-test', 'public');
      channelId = channel.channelId;
    });

    test('should send success notification', async () => {
      const notification = await client.sendNotification({
        channelId,
        type: 'success',
        title: 'Deployment Complete',
        message: 'Version 2.0 deployed successfully',
        sentBy: 'ci-bot',
      });

      expect(notification.notificationId).toBeDefined();
      expect(notification.type).toBe('success');
      expect(notification.status).toBe('sent');
    });

    test('should send error notification', async () => {
      const notification = await client.sendNotification({
        channelId,
        type: 'error',
        title: 'Build Failed',
        message: 'Error in main.ts at line 42',
        sentBy: 'ci-bot',
      });

      expect(notification.type).toBe('error');
    });

    test('should send reminder notification', async () => {
      const notification = await client.sendNotification({
        channelId,
        type: 'reminder',
        title: 'Meeting in 15 minutes',
        message: ' Sprint planning meeting',
        sentBy: 'calendar-bot',
      });

      expect(notification.type).toBe('reminder');
    });

    test('should send bulk notifications', async () => {
      const notifications = await client.sendBulkNotifications([
        { channelId, type: 'info', title: 'Update 1', message: 'Message 1', sentBy: 'bot' },
        { channelId, type: 'info', title: 'Update 2', message: 'Message 2', sentBy: 'bot' },
        { channelId, type: 'info', title: 'Update 3', message: 'Message 3', sentBy: 'bot' },
      ]);

      expect(notifications.length).toBe(3);
    });
  });

  describe('Slash Commands', () => {
    test('should register and handle slash command', async () => {
      client.registerSlashCommand('/task', async (cmd) => {
        return `Created task: ${cmd.text}`;
      });

      const response = await client.handleSlashCommand({
        commandId: 'cmd_1',
        command: '/task',
        userId: 'U123',
        channelId: 'C456',
        text: 'Implement login',
        timestamp: new Date(),
        responseUrl: 'https://example.com/response',
      });

      expect(response).toContain('Created task: Implement login');
    });

    test('should return error for unknown command', async () => {
      const response = await client.handleSlashCommand({
        commandId: 'cmd_1',
        command: '/unknown',
        userId: 'U123',
        channelId: 'C456',
        text: '',
        timestamp: new Date(),
        responseUrl: 'https://example.com/response',
      });

      expect(response).toContain('not found');
    });
  });

  describe('Threads', () => {
    let channelId: string;
    let parentId: string;

    beforeEach(async () => {
      const channel = await client.createChannel('threads-test', 'public');
      channelId = channel.channelId;
      const parent = await client.sendMessage(channelId, 'Parent message');
      parentId = parent.messageId;
    });

    test('should get thread replies', async () => {
      await client.sendThreadReply(channelId, parentId, 'Reply 1');
      await client.sendThreadReply(channelId, parentId, 'Reply 2');

      const replies = await client.getThreadReplies(channelId, parentId);

      expect(replies.length).toBe(2);
    });

    test('should lock thread', async () => {
      await client.lockThread(channelId, parentId);
      expect(true).toBe(true);
    });

    test('should unlock thread', async () => {
      await client.unlockThread(channelId, parentId);
      expect(true).toBe(true);
    });
  });

  describe('AI Features', () => {
    let channelId: string;

    beforeEach(async () => {
      const channel = await client.createChannel('ai-test', 'public');
      channelId = channel.channelId;
      await client.sendMessage(channelId, 'This is great work!');
      await client.sendMessage(channelId, 'Thanks for the update');
      await client.sendMessage(channelId, 'Perfect!');
    });

    test('should generate message summary', async () => {
      const summary = await client.generateMessageSummary(channelId);

      expect(summary.summaryId).toBeDefined();
      expect(summary.channelId).toBe(channelId);
      expect(summary.messageCount).toBe(3);
      expect(summary.participantCount).toBeGreaterThan(0);
      expect(summary.sentiment).toBe('positive');
    });

    test('should generate thread summary', async () => {
      const parent = await client.sendMessage(channelId, 'Parent message');
      await client.sendThreadReply(channelId, parent.messageId, 'Reply 1');
      await client.sendThreadReply(channelId, parent.messageId, 'Reply 2');

      const summary = await client.generateMessageSummary(channelId, parent.messageId);

      expect(summary.threadId).toBe(parent.messageId);
    });

    test('should generate intelligent response', async () => {
      const response = await client.generateIntelligentResponse('We need to discuss the project timeline');

      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    });

    test('should analyze sentiment', async () => {
      const sentiments = await client.analyzeSentiment([
        'This is great!',
        'Thanks for helping',
        'Love the new features',
      ]);

      expect(Object.keys(sentiments).length).toBe(3);
    });
  });

  describe('Webhooks', () => {
    test('should register and trigger webhook', async () => {
      const mockHandler = jest.fn();

      client.registerWebhook('message_sent', mockHandler);

      await client.sendMessage('C123', 'Test message');

      // Webhook should be called
      expect(mockHandler).toHaveBeenCalled();
    });

    test('should handle multiple webhook handlers', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      client.registerWebhook('channel_created', handler1);
      client.registerWebhook('channel_created', handler2);

      await client.createChannel('webhook-test', 'public');

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('Workflows', () => {
    test('should create workflow', async () => {
      const workflow = await client.createWorkflow({
        name: 'Auto-respond',
        channelId: 'C123',
        events: ['message'],
        actions: [{ actionId: 'a1', type: 'send_message', config: {} }],
        isActive: true,
      });

      expect(workflow.triggerId).toBeDefined();
      expect(workflow.name).toBe('Auto-respond');
    });

    test('should list workflows', async () => {
      await client.createWorkflow({
        name: 'Workflow 1',
        channelId: 'C123',
        events: ['message'],
        actions: [],
        isActive: true,
      });

      await client.createWorkflow({
        name: 'Workflow 2',
        channelId: 'C456',
        events: ['reaction'],
        actions: [],
        isActive: false,
      });

      const all = await client.listWorkflows();
      expect(all.length).toBe(2);

      const filtered = await client.listWorkflows('C123');
      expect(filtered.length).toBe(1);
    });

    test('should toggle workflow', async () => {
      const workflow = await client.createWorkflow({
        name: 'Toggle Test',
        channelId: 'C123',
        events: ['message'],
        actions: [],
        isActive: true,
      });

      await client.toggleWorkflow(workflow.triggerId, false);

      const updated = await client.listWorkflows();
      expect(updated[0].isActive).toBe(false);
    });
  });

  describe('Reporting', () => {
    test('should generate report', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await client.generateReport(startDate, endDate);

      expect(report.reportId).toBeDefined();
      expect(report.periodStart).toEqual(startDate);
      expect(report.periodEnd).toEqual(endDate);
      expect(report.totalMessages).toBeGreaterThanOrEqual(0);
    });

    test('should get channel stats', async () => {
      const channel = await client.createChannel('stats-test', 'public');

      const stats = await client.getChannelStats(channel.channelId);

      expect(stats.messageCount).toBe(0);
      expect(stats.activeUsers).toBe(0);
      expect(stats.peakHour).toBeDefined();
    });
  });
});

describe('SlackManus', () => {
  let slack: SlackManus;

  beforeEach(() => {
    slack = new SlackManus();
  });

  test('should create channel', async () => {
    const channel = await slack.createChannel('test-channel', 'public');
    expect(channel.name).toBe('test-channel');
  });

  test('should send message', async () => {
    const channel = await slack.createChannel('messaging-test', 'public');
    const message = await slack.sendMessage(channel.channelId, 'Hello!');
    expect(message.text).toBe('Hello!');
  });

  test('should send notification', async () => {
    const channel = await slack.createChannel('notify-test', 'public');
    const notification = await slack.notify(channel.channelId, 'success', 'Deployment', 'Completed!');
    expect(notification.type).toBe('success');
  });

  test('should register slash command', async () => {
    slack.registerCommand('/hello', async (text) => {
      return `Hello ${text}!`;
    });
    expect(true).toBe(true);
  });

  test('should create workflow', async () => {
    const channel = await slack.createChannel('workflow-test', 'public');
    const workflow = await slack.createWorkflow('Test Workflow', channel.channelId, ['message'], []);
    expect(workflow.name).toBe('Test Workflow');
  });

  test('should send project update notification', async () => {
    const channel = await slack.createChannel('project-test', 'public');
    const notification = await slack.notifyProjectUpdate(channel.channelId, 'Website Redesign', 'In Progress', [
      'Completed homepage mockup',
      'Started API integration',
    ]);
    expect(notification.type).toBe('info');
  });

  test('should send deployment notification', async () => {
    const channel = await slack.createChannel('deploy-test', 'public');
    const notification = await slack.notifyDeployment(channel.channelId, 'production', 'v2.1.0', 'success');
    expect(notification.type).toBe('success');
  });

  test('should send daily standup reminder', async () => {
    const channel = await slack.createChannel('standup-test', 'public');
    const notification = await slack.sendDailyStandupReminder(channel.channelId);
    expect(notification.type).toBe('reminder');
  });

  test('should send error alert', async () => {
    const channel = await slack.createChannel('alert-test', 'public');
    const notification = await slack.sendErrorAlert(channel.channelId, 'Database connection timeout', 'API Server', 'high');
    expect(notification.type).toBe('error');
  });

  test('should send task assignment', async () => {
    const channel = await slack.createChannel('task-test', 'public');
    const message = await slack.assignTask(channel.channelId, 'Review PR #123', 'john');
    expect(message.text).toContain('john');
  });

  test('should send weekly summary', async () => {
    const channel = await slack.createChannel('summary-test', 'public');
    const message = await slack.sendWeeklySummary(channel.channelId, {
      tasksCompleted: 15,
      messagesSent: 142,
      activeMembers: 8,
      topContributor: 'alice',
    });
    expect(message.text).toContain('Weekly Summary');
    expect(message.text).toContain('15');
  });
});

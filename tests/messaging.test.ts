/**
 * Messaging Service Tests
 */

import { MessagingServiceImpl } from '../src/core/messaging/messaging';
import { MessagingManus } from '../src/core/messaging';
import { MessageType, ConversationType, MessageStatus } from '../src/core/messaging/types';

describe('MessagingServiceImpl', () => {
  let service: MessagingServiceImpl;

  beforeEach(() => {
    service = new MessagingServiceImpl();
  });

  describe('Conversation Management', () => {
    test('should create a direct conversation', async () => {
      const conversation = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      expect(conversation.conversationId).toBeDefined();
      expect(conversation.type).toBe('direct');
      expect(conversation.participants).toContain('user1');
      expect(conversation.participants).toContain('user2');
    });

    test('should create a group conversation', async () => {
      const conversation = await service.createConversation({
        type: 'group',
        name: 'Test Group',
        participants: ['user1', 'user2', 'user3'],
        adminIds: ['user1'],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0, user3: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'admin',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      expect(conversation.name).toBe('Test Group');
      expect(conversation.type).toBe('group');
      expect(conversation.adminIds).toContain('user1');
    });

    test('should create a channel conversation', async () => {
      const conversation = await service.createConversation({
        type: 'channel',
        name: 'Test Channel',
        description: 'A test channel',
        participants: ['user1'],
        adminIds: ['user1'],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0 },
        settings: {
          allowSend: true,
          allowReply: false,
          allowReact: true,
          allowPin: false,
          allowDelete: 'owner',
          allowLeave: 'owner',
          notificationLevel: 'all',
        },
      });

      expect(conversation.type).toBe('channel');
      expect(conversation.description).toBe('A test channel');
    });

    test('should get conversation by ID', async () => {
      const created = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      const retrieved = await service.getConversation(created.conversationId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.conversationId).toBe(created.conversationId);
    });

    test('should return null for non-existent conversation', async () => {
      const retrieved = await service.getConversation('non_existent_id');
      expect(retrieved).toBeNull();
    });

    test('should update conversation', async () => {
      const conversation = await service.createConversation({
        type: 'group',
        name: 'Original Name',
        participants: ['user1'],
        adminIds: ['user1'],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'admin',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      const updated = await service.updateConversation(conversation.conversationId, {
        name: 'Updated Name',
        description: 'New description',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('New description');
    });

    test('should archive conversation', async () => {
      const conversation = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      await service.archiveConversation(conversation.conversationId);
      const retrieved = await service.getConversation(conversation.conversationId);

      expect(retrieved?.status).toBe('archived');
      expect(retrieved?.archivedAt).toBeDefined();
    });

    test('should unarchive conversation', async () => {
      const conversation = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      await service.archiveConversation(conversation.conversationId);
      await service.unarchiveConversation(conversation.conversationId);
      const retrieved = await service.getConversation(conversation.conversationId);

      expect(retrieved?.status).toBe('active');
    });
  });

  describe('Participant Management', () => {
    test('should add participant to conversation', async () => {
      const conversation = await service.createConversation({
        type: 'group',
        name: 'Test Group',
        participants: ['user1'],
        adminIds: ['user1'],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'admin',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      await service.addParticipant(conversation.conversationId, 'user2');
      const retrieved = await service.getConversation(conversation.conversationId);

      expect(retrieved?.participants).toContain('user2');
    });

    test('should remove participant from conversation', async () => {
      const conversation = await service.createConversation({
        type: 'group',
        name: 'Test Group',
        participants: ['user1', 'user2'],
        adminIds: ['user1'],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'admin',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      await service.removeParticipant(conversation.conversationId, 'user2');
      const retrieved = await service.getConversation(conversation.conversationId);

      expect(retrieved?.participants).not.toContain('user2');
    });
  });

  describe('Message Management', () => {
    test('should send text message', async () => {
      const conversation = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      const message = await service.sendMessage({
        conversationId: conversation.conversationId,
        senderId: 'user1',
        content: {
          type: 'text',
          text: 'Hello, World!',
          timestamp: new Date(),
        },
        status: 'sending',
        role: 'user',
        mentions: [],
      });

      expect(message.messageId).toBeDefined();
      expect(message.content.type).toBe('text');
      expect((message.content as any).text).toBe('Hello, World!');
    });

    test('should send image message', async () => {
      const conversation = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      const message = await service.sendMessage({
        conversationId: conversation.conversationId,
        senderId: 'user1',
        content: {
          type: 'image',
          url: 'https://example.com/image.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          timestamp: new Date(),
        },
        status: 'sending',
        role: 'user',
        mentions: [],
      });

      expect(message.content.type).toBe('image');
      expect((message.content as any).url).toBe('https://example.com/image.jpg');
    });

    test('should send video message', async () => {
      const conversation = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      const message = await service.sendMessage({
        conversationId: conversation.conversationId,
        senderId: 'user1',
        content: {
          type: 'video',
          url: 'https://example.com/video.mp4',
          duration: 120,
          mimeType: 'video/mp4',
          size: 10240,
          timestamp: new Date(),
        },
        status: 'sending',
        role: 'user',
        mentions: [],
      });

      expect(message.content.type).toBe('video');
      expect((message.content as any).duration).toBe(120);
    });

    test('should send audio message', async () => {
      const conversation = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      const message = await service.sendMessage({
        conversationId: conversation.conversationId,
        senderId: 'user1',
        content: {
          type: 'audio',
          url: 'https://example.com/audio.mp3',
          duration: 60,
          mimeType: 'audio/mpeg',
          size: 512,
          timestamp: new Date(),
        },
        status: 'sending',
        role: 'user',
        mentions: [],
      });

      expect(message.content.type).toBe('audio');
      expect((message.content as any).duration).toBe(60);
    });

    test('should send file message', async () => {
      const conversation = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      const message = await service.sendMessage({
        conversationId: conversation.conversationId,
        senderId: 'user1',
        content: {
          type: 'file',
          name: 'document.pdf',
          url: 'https://example.com/document.pdf',
          mimeType: 'application/pdf',
          size: 2048,
          timestamp: new Date(),
        },
        status: 'sending',
        role: 'user',
        mentions: [],
      });

      expect(message.content.type).toBe('file');
      expect((message.content as any).name).toBe('document.pdf');
    });

    test('should get message by ID', async () => {
      const conversation = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      const sent = await service.sendMessage({
        conversationId: conversation.conversationId,
        senderId: 'user1',
        content: {
          type: 'text',
          text: 'Test message',
          timestamp: new Date(),
        },
        status: 'sending',
        role: 'user',
        mentions: [],
      });

      const retrieved = await service.getMessage(sent.messageId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.messageId).toBe(sent.messageId);
    });

    test('should update message', async () => {
      const conversation = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      const message = await service.sendMessage({
        conversationId: conversation.conversationId,
        senderId: 'user1',
        content: {
          type: 'text',
          text: 'Original text',
          timestamp: new Date(),
        },
        status: 'sending',
        role: 'user',
        mentions: [],
      });

      const updated = await service.updateMessage(message.messageId, {
        type: 'text',
        text: 'Updated text',
        timestamp: new Date(),
      });

      expect(updated.content).toBeDefined();
      expect((updated.content as any).text).toBe('Updated text');
      expect(updated.isEdited).toBe(true);
    });

    test('should delete message', async () => {
      const conversation = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      const message = await service.sendMessage({
        conversationId: conversation.conversationId,
        senderId: 'user1',
        content: {
          type: 'text',
          text: 'Test',
          timestamp: new Date(),
        },
        status: 'sending',
        role: 'user',
        mentions: [],
      });

      await service.deleteMessage(message.messageId);
      const retrieved = await service.getMessage(message.messageId);
      expect(retrieved).not.toBeNull();
    });
  });

  describe('Reactions', () => {
    test('should add reaction to message', async () => {
      const conversation = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      const message = await service.sendMessage({
        conversationId: conversation.conversationId,
        senderId: 'user1',
        content: {
          type: 'text',
          text: 'Test',
          timestamp: new Date(),
        },
        status: 'sending',
        role: 'user',
        mentions: [],
      });

      await service.reactToMessage(message.messageId, '👍', 'user2');
      const retrieved = await service.getMessage(message.messageId);

      expect(retrieved?.reactions['👍']).toContain('user2');
    });

    test('should remove reaction from message', async () => {
      const conversation = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      const message = await service.sendMessage({
        conversationId: conversation.conversationId,
        senderId: 'user1',
        content: {
          type: 'text',
          text: 'Test',
          timestamp: new Date(),
        },
        status: 'sending',
        role: 'user',
        mentions: [],
      });

      await service.reactToMessage(message.messageId, '👍', 'user2');
      await service.unreactToMessage(message.messageId, '👍', 'user2');
      const retrieved = await service.getMessage(message.messageId);

      expect(retrieved?.reactions['👍']).toBeUndefined();
    });
  });

  describe('Pinning', () => {
    test('should pin message', async () => {
      const conversation = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      const message = await service.sendMessage({
        conversationId: conversation.conversationId,
        senderId: 'user1',
        content: {
          type: 'text',
          text: 'Test',
          timestamp: new Date(),
        },
        status: 'sending',
        role: 'user',
        mentions: [],
      });

      await service.pinMessage(message.messageId);
      const retrieved = await service.getMessage(message.messageId);

      expect(retrieved?.isPinned).toBe(true);
    });

    test('should unpin message', async () => {
      const conversation = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      const message = await service.sendMessage({
        conversationId: conversation.conversationId,
        senderId: 'user1',
        content: {
          type: 'text',
          text: 'Test',
          timestamp: new Date(),
        },
        status: 'sending',
        role: 'user',
        mentions: [],
      });

      await service.pinMessage(message.messageId);
      await service.unpinMessage(message.messageId);
      const retrieved = await service.getMessage(message.messageId);

      expect(retrieved?.isPinned).toBe(false);
    });
  });

  describe('Threading', () => {
    test('should create thread', async () => {
      const conversation = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      const message = await service.sendMessage({
        conversationId: conversation.conversationId,
        senderId: 'user1',
        content: {
          type: 'text',
          text: 'Parent message',
          timestamp: new Date(),
        },
        status: 'sending',
        role: 'user',
        mentions: [],
      });

      const thread = await service.createThread(message.messageId);

      expect(thread.threadId).toBeDefined();
      expect(thread.parentMessageId).toBe(message.messageId);
    });

    test('should reply to thread', async () => {
      const conversation = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      const message = await service.sendMessage({
        conversationId: conversation.conversationId,
        senderId: 'user1',
        content: {
          type: 'text',
          text: 'Parent message',
          timestamp: new Date(),
        },
        status: 'sending',
        role: 'user',
        mentions: [],
      });

      const thread = await service.createThread(message.messageId);
      const reply = await service.replyToThread(thread.threadId, {
        conversationId: conversation.conversationId,
        senderId: 'user2',
        content: {
          type: 'text',
          text: 'Thread reply',
          timestamp: new Date(),
        },
        status: 'sending',
        role: 'user',
        mentions: [],
      });

      expect(reply.messageId).toBeDefined();
      expect(reply.threadId).toBe(thread.threadId);
    });
  });

  describe('Read Status', () => {
    test('should mark message as read', async () => {
      const conversation = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 1 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      const message = await service.sendMessage({
        conversationId: conversation.conversationId,
        senderId: 'user1',
        content: {
          type: 'text',
          text: 'Test',
          timestamp: new Date(),
        },
        status: 'sending',
        role: 'user',
        mentions: [],
      });

      await service.markAsRead(conversation.conversationId, 'user2', message.messageId);
      const unread = await service.getUnreadCount(conversation.conversationId, 'user2');

      expect(unread).toBe(0);
    });

    test('should get total unread count', async () => {
      const conversation1 = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 5 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      await service.sendMessage({
        conversationId: conversation1.conversationId,
        senderId: 'user1',
        content: {
          type: 'text',
          text: 'Test',
          timestamp: new Date(),
        },
        status: 'sending',
        role: 'user',
        mentions: [],
      });

      const totalUnread = await service.getTotalUnreadCount('user2');
      expect(totalUnread).toBeGreaterThan(0);
    });
  });

  describe('Typing Indicators', () => {
    test('should start typing', async () => {
      const conversation = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      await service.startTyping(conversation.conversationId, 'user1', 'text');
      const typing = await service.getTypingUsers(conversation.conversationId);

      expect(typing.some((t) => t.userId === 'user1' && t.status === 'typing')).toBe(true);
    });

    test('should stop typing', async () => {
      const conversation = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      await service.startTyping(conversation.conversationId, 'user1');
      await service.stopTyping(conversation.conversationId, 'user1');
      const typing = await service.getTypingUsers(conversation.conversationId);

      expect(typing.some((t) => t.userId === 'user1' && t.status === 'typing')).toBe(false);
    });
  });

  describe('Search', () => {
    test('should search messages', async () => {
      const conversation = await service.createConversation({
        type: 'direct',
        participants: ['user1', 'user2'],
        adminIds: [],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'all',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      await service.sendMessage({
        conversationId: conversation.conversationId,
        senderId: 'user1',
        content: {
          type: 'text',
          text: 'Hello World',
          timestamp: new Date(),
        },
        status: 'sending',
        role: 'user',
        mentions: [],
      });

      const results = await service.searchMessages('Hello', 'user1');
      expect(results.length).toBeGreaterThan(0);
    });

    test('should search conversations', async () => {
      await service.createConversation({
        type: 'group',
        name: 'Engineering Team',
        participants: ['user1', 'user2'],
        adminIds: ['user1'],
        creatorId: 'user1',
        status: 'active',
        isPinned: false,
        unreadCount: { user1: 0, user2: 0 },
        settings: {
          allowSend: true,
          allowReply: true,
          allowReact: true,
          allowPin: true,
          allowDelete: 'admin',
          allowLeave: 'all',
          notificationLevel: 'all',
        },
      });

      const results = await service.searchConversations('Engineering', 'user1');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('MessagingManus', () => {
    let messaging: MessagingManus;

    beforeEach(() => {
      messaging = new MessagingManus();
    });

    test('should create direct conversation', async () => {
      const conversation = await messaging.createDirectConversation('user1', 'user2');
      expect(conversation.type).toBe('direct');
      expect(conversation.participants).toContain('user1');
      expect(conversation.participants).toContain('user2');
    });

    test('should create group conversation', async () => {
      const conversation = await messaging.createGroupConversation('Team', 'user1', ['user2', 'user3']);
      expect(conversation.type).toBe('group');
      expect(conversation.name).toBe('Team');
    });

    test('should create channel', async () => {
      const conversation = await messaging.createChannel('Announcements', 'Company updates', 'user1');
      expect(conversation.type).toBe('channel');
      expect(conversation.name).toBe('Announcements');
    });

    test('should send text message', async () => {
      const conversation = await messaging.createDirectConversation('user1', 'user2');
      const message = await messaging.sendTextMessage(conversation.conversationId, 'user1', 'Hello!');
      expect(message.content.type).toBe('text');
    });

    test('should send image message', async () => {
      const conversation = await messaging.createDirectConversation('user1', 'user2');
      const message = await messaging.sendImageMessage(
        conversation.conversationId,
        'user1',
        'https://example.com/image.jpg',
        'A nice image'
      );
      expect(message.content.type).toBe('image');
    });

    test('should send video message', async () => {
      const conversation = await messaging.createDirectConversation('user1', 'user2');
      const message = await messaging.sendVideoMessage(
        conversation.conversationId,
        'user1',
        'https://example.com/video.mp4',
        120
      );
      expect(message.content.type).toBe('video');
    });

    test('should send audio message', async () => {
      const conversation = await messaging.createDirectConversation('user1', 'user2');
      const message = await messaging.sendAudioMessage(
        conversation.conversationId,
        'user1',
        'https://example.com/audio.mp3',
        60
      );
      expect(message.content.type).toBe('audio');
    });

    test('should send file message', async () => {
      const conversation = await messaging.createDirectConversation('user1', 'user2');
      const message = await messaging.sendFileMessage(
        conversation.conversationId,
        'user1',
        'document.pdf',
        'https://example.com/document.pdf',
        'application/pdf',
        2048
      );
      expect(message.content.type).toBe('file');
    });

    test('should get user conversations', async () => {
      await messaging.createDirectConversation('user1', 'user2');
      await messaging.createGroupConversation('Team', 'user1', ['user3']);
      const conversations = await messaging.getUserConversations('user1');
      expect(conversations.conversations.length).toBe(2);
    });

    test('should archive conversation', async () => {
      const conversation = await messaging.createDirectConversation('user1', 'user2');
      await messaging.archiveConversation(conversation.conversationId);
      const retrieved = await messaging.getConversation(conversation.conversationId);
      expect(retrieved?.status).toBe('archived');
    });

    test('should create message thread', async () => {
      const conversation = await messaging.createDirectConversation('user1', 'user2');
      const message = await messaging.sendTextMessage(conversation.conversationId, 'user1', 'Parent');
      const thread = await messaging.createMessageThread(message.messageId);
      expect(thread.parentMessageId).toBe(message.messageId);
    });

    test('should reply to thread', async () => {
      const conversation = await messaging.createDirectConversation('user1', 'user2');
      const message = await messaging.sendTextMessage(conversation.conversationId, 'user1', 'Parent');
      const thread = await messaging.createMessageThread(message.messageId);
      const reply = await messaging.replyToThread(thread.threadId, conversation.conversationId, 'user2', 'Reply');
      expect(reply.threadId).toBe(thread.threadId);
    });

    test('should get unread count', async () => {
      const conversation = await messaging.createDirectConversation('user1', 'user2');
      const unread = await messaging.getUnreadCount(conversation.conversationId, 'user2');
      expect(unread).toBe(0);
    });

    test('should react to message', async () => {
      const conversation = await messaging.createDirectConversation('user1', 'user2');
      const message = await messaging.sendTextMessage(conversation.conversationId, 'user1', 'Test');
      await messaging.reactToMessage(message.messageId, '👍', 'user2');
      const retrieved = await messaging.getMessage(message.messageId);
      expect(retrieved?.reactions['👍']).toContain('user2');
    });

    test('should get typing users', async () => {
      const conversation = await messaging.createDirectConversation('user1', 'user2');
      await messaging.startTyping(conversation.conversationId, 'user1');
      const typing = await messaging.getTypingUsers(conversation.conversationId);
      expect(typing.length).toBeGreaterThan(0);
    });

    test('should search messages', async () => {
      const conversation = await messaging.createDirectConversation('user1', 'user2');
      await messaging.sendTextMessage(conversation.conversationId, 'user1', 'Hello World');
      const results = await messaging.searchMessages('Hello', 'user1');
      expect(results.length).toBeGreaterThan(0);
    });
  });
});

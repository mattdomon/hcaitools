/**
 * Messaging & Conversations Module
 * Complete messaging system with conversations, threading, and rich media
 */

export {
  MessageType,
  ConversationType,
  MessageStatus,
  ConversationStatus,
  MessageRole,
  TypingStatus,
  BaseMessageContent,
  TextMessageContent,
  ImageMessageContent,
  VideoMessageContent,
  AudioMessageContent,
  FileMessageContent,
  MessageContent,
  Message,
  Conversation,
  Thread,
  TypingIndicator,
  MessageSearchResult,
  ConversationSearchResult,
  UnreadCount,
  MessagePage,
  ConversationPage,
  MessagingService,
  GetConversationsOptions,
  GetMessagesOptions,
  SearchMessagesOptions,
  MessagingAnalytics,
  MessageDeliveryStatus,
  ConversationParticipant,
} from './types';

export { MessagingServiceImpl, createMessagingService } from './messaging';

import { MessagingServiceImpl } from './messaging';
import {
  Message,
  Conversation,
  Thread,
  TypingIndicator,
  MessagePage,
  ConversationPage,
  MessageSearchResult,
  ConversationSearchResult,
  MessageType,
} from './types';

/**
 * MessagingManus
 * Main class for messaging & conversations
 */
export class MessagingManus {
  private service: MessagingServiceImpl;

  constructor() {
    this.service = new MessagingServiceImpl();
  }

  async createDirectConversation(userId1: string, userId2: string): Promise<Conversation> {
    return this.service.createConversation({
      type: 'direct',
      participants: [userId1, userId2],
      adminIds: [],
      creatorId: userId1,
      status: 'active',
      isPinned: false,
      unreadCount: { [userId1]: 0, [userId2]: 0 },
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
  }

  async createGroupConversation(name: string, creatorId: string, participantIds: string[]): Promise<Conversation> {
    return this.service.createConversation({
      type: 'group',
      name,
      participants: [creatorId, ...participantIds],
      adminIds: [creatorId],
      creatorId,
      status: 'active',
      isPinned: false,
      unreadCount: Object.fromEntries([creatorId, ...participantIds].map((id) => [id, 0])),
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
  }

  async createChannel(name: string, description: string, creatorId: string): Promise<Conversation> {
    return this.service.createConversation({
      type: 'channel',
      name,
      description,
      participants: [creatorId],
      adminIds: [creatorId],
      creatorId,
      status: 'active',
      isPinned: false,
      unreadCount: { [creatorId]: 0 },
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
  }

  async sendTextMessage(conversationId: string, senderId: string, text: string, replyToId?: string): Promise<Message> {
    return this.service.sendMessage({
      conversationId,
      senderId,
      content: {
        type: 'text',
        text,
        timestamp: new Date(),
      },
      status: 'sending',
      role: 'user',
      replyToId,
      mentions: this.extractMentions(text),
    });
  }

  async sendImageMessage(
    conversationId: string,
    senderId: string,
    url: string,
    caption?: string,
    mimeType: string = 'image/jpeg',
    size: number = 0
  ): Promise<Message> {
    return this.service.sendMessage({
      conversationId,
      senderId,
      content: {
        type: 'image',
        url,
        caption,
        mimeType,
        size,
        timestamp: new Date(),
      },
      status: 'sending',
      role: 'user',
      mentions: [],
    });
  }

  async sendVideoMessage(
    conversationId: string,
    senderId: string,
    url: string,
    duration: number,
    caption?: string,
    mimeType: string = 'video/mp4',
    size: number = 0
  ): Promise<Message> {
    return this.service.sendMessage({
      conversationId,
      senderId,
      content: {
        type: 'video',
        url,
        duration,
        caption,
        mimeType,
        size,
        timestamp: new Date(),
      },
      status: 'sending',
      role: 'user',
      mentions: [],
    });
  }

  async sendAudioMessage(
    conversationId: string,
    senderId: string,
    url: string,
    duration: number,
    mimeType: string = 'audio/mpeg',
    size: number = 0
  ): Promise<Message> {
    return this.service.sendMessage({
      conversationId,
      senderId,
      content: {
        type: 'audio',
        url,
        duration,
        mimeType,
        size,
        timestamp: new Date(),
      },
      status: 'sending',
      role: 'user',
      mentions: [],
    });
  }

  async sendFileMessage(
    conversationId: string,
    senderId: string,
    name: string,
    url: string,
    mimeType: string,
    size: number,
    caption?: string
  ): Promise<Message> {
    return this.service.sendMessage({
      conversationId,
      senderId,
      content: {
        type: 'file',
        name,
        url,
        mimeType,
        size,
        caption,
        timestamp: new Date(),
      },
      status: 'sending',
      role: 'user',
      mentions: [],
    });
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    return this.service.getConversation(conversationId);
  }

  async getMessage(messageId: string): Promise<Message | null> {
    return this.service.getMessage(messageId);
  }

  async getUserConversations(userId: string, limit: number = 50): Promise<ConversationPage> {
    return this.service.getConversations(userId, { limit });
  }

  async getConversationMessages(conversationId: string, limit: number = 50): Promise<MessagePage> {
    return this.service.getMessages(conversationId, { limit });
  }

  async updateConversationName(conversationId: string, name: string): Promise<Conversation> {
    return this.service.updateConversation(conversationId, { name });
  }

  async archiveConversation(conversationId: string): Promise<void> {
    return this.service.archiveConversation(conversationId);
  }

  async unarchiveConversation(conversationId: string): Promise<void> {
    return this.service.unarchiveConversation(conversationId);
  }

  async deleteConversation(conversationId: string): Promise<void> {
    return this.service.deleteConversation(conversationId);
  }

  async addParticipant(conversationId: string, userId: string): Promise<void> {
    return this.service.addParticipant(conversationId, userId);
  }

  async removeParticipant(conversationId: string, userId: string): Promise<void> {
    return this.service.removeParticipant(conversationId, userId);
  }

  async deleteMessage(messageId: string): Promise<void> {
    return this.service.deleteMessage(messageId);
  }

  async reactToMessage(messageId: string, emoji: string, userId: string): Promise<void> {
    return this.service.reactToMessage(messageId, emoji, userId);
  }

  async unreactToMessage(messageId: string, emoji: string, userId: string): Promise<void> {
    return this.service.unreactToMessage(messageId, emoji, userId);
  }

  async pinMessage(messageId: string): Promise<void> {
    return this.service.pinMessage(messageId);
  }

  async unpinMessage(messageId: string): Promise<void> {
    return this.service.unpinMessage(messageId);
  }

  async createMessageThread(parentMessageId: string): Promise<Thread> {
    return this.service.createThread(parentMessageId);
  }

  async replyToThread(threadId: string, conversationId: string, senderId: string, text: string): Promise<Message> {
    return this.service.replyToThread(threadId, {
      conversationId,
      senderId,
      content: {
        type: 'text',
        text,
        timestamp: new Date(),
      },
      status: 'sending',
      role: 'user',
      mentions: this.extractMentions(text),
    });
  }

  async markAsRead(conversationId: string, userId: string, messageId: string): Promise<void> {
    return this.service.markAsRead(conversationId, userId, messageId);
  }

  async getUnreadCount(conversationId: string, userId: string): Promise<number> {
    return this.service.getUnreadCount(conversationId, userId);
  }

  async getTotalUnreadCount(userId: string): Promise<number> {
    return this.service.getTotalUnreadCount(userId);
  }

  async startTyping(conversationId: string, userId: string, messageType: MessageType = 'text'): Promise<void> {
    return this.service.startTyping(conversationId, userId, messageType);
  }

  async stopTyping(conversationId: string, userId: string): Promise<void> {
    return this.service.stopTyping(conversationId, userId);
  }

  async getTypingUsers(conversationId: string): Promise<TypingIndicator[]> {
    return this.service.getTypingUsers(conversationId);
  }

  async searchMessages(query: string, userId: string, limit: number = 50): Promise<MessageSearchResult[]> {
    return this.service.searchMessages(query, userId, { limit });
  }

  async searchConversations(query: string, userId: string): Promise<ConversationSearchResult[]> {
    return this.service.searchConversations(query, userId);
  }

  private extractMentions(text: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    return mentions;
  }
}

/**
 * Messaging Service Implementation
 * Complete messaging system with conversations, threading, and rich media
 */

import crypto from 'crypto';
import {
  Message,
  MessageContent,
  Conversation,
  Thread,
  TypingIndicator,
  MessageStatus,
  MessageType,
  MessagingService,
  GetConversationsOptions,
  GetMessagesOptions,
  SearchMessagesOptions,
  MessagePage,
  ConversationPage,
  MessageSearchResult,
  ConversationSearchResult,
  MessageDeliveryStatus,
  TextMessageContent,
  FileMessageContent,
} from './types';

export class MessagingServiceImpl implements MessagingService {
  private conversations: Map<string, Conversation> = new Map();
  private messages: Map<string, Message> = new Map();
  private threads: Map<string, Thread> = new Map();
  private typingIndicators: Map<string, TypingIndicator> = new Map();
  private conversationMessages: Map<string, Set<string>> = new Map();
  private threadMessages: Map<string, Set<string>> = new Map();
  private userConversations: Map<string, Set<string>> = new Map();
  private deliveryStatus: Map<string, Map<string, MessageDeliveryStatus>> = new Map();
  private deletedMessages: Set<string> = new Set();

  async createConversation(
    conversation: Omit<Conversation, 'conversationId' | 'createdAt' | 'updatedAt' | 'messageCount'>
  ): Promise<Conversation> {
    const fullConversation: Conversation = {
      ...conversation,
      conversationId: this.generateId('conv'),
      createdAt: new Date(),
      updatedAt: new Date(),
      messageCount: 0,
    };

    this.conversations.set(fullConversation.conversationId, fullConversation);
    this.conversationMessages.set(fullConversation.conversationId, new Set());

    for (const participantId of conversation.participants) {
      this.addUserConversation(participantId, fullConversation.conversationId);
    }

    return fullConversation;
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    return this.conversations.get(conversationId) || null;
  }

  async getConversations(userId: string, options?: GetConversationsOptions): Promise<ConversationPage> {
    const userConvIds = this.userConversations.get(userId);
    if (!userConvIds) {
      return {
        conversations: [],
        hasMore: false,
        totalCount: 0,
      };
    }

    let conversations = Array.from(userConvIds)
      .map((id) => this.conversations.get(id))
      .filter((c): c is Conversation => c !== undefined);

    if (!options?.includeArchived) {
      conversations = conversations.filter((c) => c.status === 'active');
    }

    if (options?.type) {
      conversations = conversations.filter((c) => c.type === options.type);
    }

    if (options?.status) {
      conversations = conversations.filter((c) => c.status === options.status);
    }

    const sortBy = options?.sortBy || 'lastMessageAt';
    const sortOrder = options?.sortOrder || 'desc';

    conversations.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'lastMessageAt') {
        const aTime = a.lastMessageAt?.getTime() || a.createdAt.getTime();
        const bTime = b.lastMessageAt?.getTime() || b.createdAt.getTime();
        comparison = aTime - bTime;
      } else if (sortBy === 'createdAt') {
        comparison = a.createdAt.getTime() - b.createdAt.getTime();
      } else if (sortBy === 'name') {
        comparison = (a.name || '').localeCompare(b.name || '');
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    const limit = options?.limit || 50;
    let cursorIndex = 0;

    if (options?.cursor) {
      cursorIndex = conversations.findIndex((c) => c.conversationId === options.cursor);
      if (cursorIndex !== -1) {
        cursorIndex++;
      }
    }

    const paginatedConversations = conversations.slice(cursorIndex, cursorIndex + limit);
    const hasMore = conversations.length > cursorIndex + limit;

    return {
      conversations: paginatedConversations,
      hasMore,
      totalCount: conversations.length,
      nextCursor: hasMore ? paginatedConversations[paginatedConversations.length - 1]?.conversationId : undefined,
    };
  }

  async updateConversation(conversationId: string, updates: Partial<Conversation>): Promise<Conversation> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const updated: Conversation = {
      ...conversation,
      ...updates,
      conversationId,
      createdAt: conversation.createdAt,
      updatedAt: new Date(),
    };

    this.conversations.set(conversationId, updated);
    return updated;
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.status = 'deleted';
      this.conversations.set(conversationId, conversation);
    }
  }

  async archiveConversation(conversationId: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conversation.status = 'archived';
    conversation.archivedAt = new Date();
    conversation.updatedAt = new Date();
    this.conversations.set(conversationId, conversation);
  }

  async unarchiveConversation(conversationId: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conversation.status = 'active';
    conversation.archivedAt = undefined;
    conversation.updatedAt = new Date();
    this.conversations.set(conversationId, conversation);
  }

  async addParticipant(conversationId: string, userId: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    if (!conversation.participants.includes(userId)) {
      conversation.participants.push(userId);
      conversation.unreadCount[userId] = 0;
      conversation.updatedAt = new Date();
      this.conversations.set(conversationId, conversation);
      this.addUserConversation(userId, conversationId);
    }
  }

  async removeParticipant(conversationId: string, userId: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conversation.participants = conversation.participants.filter((p) => p !== userId);
    delete conversation.unreadCount[userId];
    conversation.updatedAt = new Date();
    this.conversations.set(conversationId, conversation);

    const userConvs = this.userConversations.get(userId);
    if (userConvs) {
      userConvs.delete(conversationId);
    }
  }

  async sendMessage(
    message: Omit<Message, 'messageId' | 'createdAt' | 'updatedAt' | 'threadReplyCount' | 'reactions' | 'isEdited' | 'isPinned'>
  ): Promise<Message> {
    const fullMessage: Message = {
      ...message,
      messageId: this.generateId('msg'),
      createdAt: new Date(),
      updatedAt: new Date(),
      threadReplyCount: 0,
      reactions: {},
      isEdited: false,
      isPinned: false,
    };

    this.messages.set(fullMessage.messageId, fullMessage);

    const convMessages = this.conversationMessages.get(message.conversationId);
    if (convMessages) {
      convMessages.add(fullMessage.messageId);
    }

    const conversation = this.conversations.get(message.conversationId);
    if (conversation) {
      conversation.lastMessageId = fullMessage.messageId;
      conversation.lastMessagePreview = this.getMessagePreview(fullMessage.content);
      conversation.lastMessageAt = fullMessage.createdAt;
      conversation.messageCount++;
      conversation.updatedAt = new Date();
      this.conversations.set(message.conversationId, conversation);

      for (const participantId of conversation.participants) {
        if (participantId !== message.senderId) {
          conversation.unreadCount[participantId] = (conversation.unreadCount[participantId] || 0) + 1;
        }
      }
      this.conversations.set(message.conversationId, conversation);
    }

    this.setDeliveryStatus(fullMessage.messageId, message.senderId, 'sent');

    return fullMessage;
  }

  async getMessage(messageId: string): Promise<Message | null> {
    return this.messages.get(messageId) || null;
  }

  async getMessages(conversationId: string, options?: GetMessagesOptions): Promise<MessagePage> {
    const messageIds = this.conversationMessages.get(conversationId);
    if (!messageIds) {
      return {
        messages: [],
        hasMore: false,
        totalCount: 0,
      };
    }

    let messages = Array.from(messageIds)
      .map((id) => this.messages.get(id))
      .filter((m): m is Message => m !== undefined);

    if (!options?.includeDeleted) {
      messages = messages.filter((m) => !this.deletedMessages.has(m.messageId));
    }

    if (options?.senderId) {
      messages = messages.filter((m) => m.senderId === options.senderId);
    }

    if (options?.messageType) {
      messages = messages.filter((m) => m.content.type === options.messageType);
    }

    if (options?.before) {
      messages = messages.filter((m) => m.createdAt < options.before!);
    }

    if (options?.after) {
      messages = messages.filter((m) => m.createdAt > options.after!);
    }

    const sortOrder = options?.sortOrder || 'desc';
    messages.sort((a, b) => {
      return sortOrder === 'desc'
        ? b.createdAt.getTime() - a.createdAt.getTime()
        : a.createdAt.getTime() - b.createdAt.getTime();
    });

    const limit = options?.limit || 50;
    let cursorIndex = 0;

    if (options?.cursor) {
      cursorIndex = messages.findIndex((m) => m.messageId === options.cursor);
      if (cursorIndex !== -1) {
        cursorIndex++;
      }
    }

    const paginatedMessages = messages.slice(cursorIndex, cursorIndex + limit);
    const hasMore = messages.length > cursorIndex + limit;

    return {
      messages: paginatedMessages,
      hasMore,
      totalCount: messages.length,
      nextCursor: hasMore ? paginatedMessages[paginatedMessages.length - 1]?.messageId : undefined,
    };
  }

  async updateMessage(messageId: string, content: MessageContent): Promise<Message> {
    const message = this.messages.get(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    message.content = content;
    message.isEdited = true;
    message.editedAt = new Date();
    message.updatedAt = new Date();

    this.messages.set(messageId, message);
    return message;
  }

  async deleteMessage(messageId: string): Promise<void> {
    const message = this.messages.get(messageId);
    if (message) {
      const deletedContent: TextMessageContent = {
        type: 'text',
        text: '[deleted]',
        timestamp: new Date(),
      };
      message.content = deletedContent;
      message.updatedAt = new Date();
      this.messages.set(messageId, message);
      this.deletedMessages.add(messageId);
    }
  }

  async reactToMessage(messageId: string, emoji: string, userId: string): Promise<void> {
    const message = this.messages.get(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    if (!message.reactions[emoji]) {
      message.reactions[emoji] = [];
    }

    if (!message.reactions[emoji].includes(userId)) {
      message.reactions[emoji].push(userId);
      message.updatedAt = new Date();
      this.messages.set(messageId, message);
    }
  }

  async unreactToMessage(messageId: string, emoji: string, userId: string): Promise<void> {
    const message = this.messages.get(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    if (message.reactions[emoji]) {
      message.reactions[emoji] = message.reactions[emoji].filter((u) => u !== userId);
      if (message.reactions[emoji].length === 0) {
        delete message.reactions[emoji];
      }
      message.updatedAt = new Date();
      this.messages.set(messageId, message);
    }
  }

  async pinMessage(messageId: string): Promise<void> {
    const message = this.messages.get(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    message.isPinned = true;
    message.updatedAt = new Date();
    this.messages.set(messageId, message);
  }

  async unpinMessage(messageId: string): Promise<void> {
    const message = this.messages.get(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    message.isPinned = false;
    message.updatedAt = new Date();
    this.messages.set(messageId, message);
  }

  async createThread(parentMessageId: string): Promise<Thread> {
    const parentMessage = this.messages.get(parentMessageId);
    if (!parentMessage) {
      throw new Error(`Parent message ${parentMessageId} not found`);
    }

    const thread: Thread = {
      threadId: this.generateId('thrd'),
      parentMessageId,
      conversationId: parentMessage.conversationId,
      participantIds: [parentMessage.senderId],
      messageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.threads.set(thread.threadId, thread);
    this.threadMessages.set(thread.threadId, new Set());

    parentMessage.threadId = thread.threadId;
    this.messages.set(parentMessageId, parentMessage);

    return thread;
  }

  async getThread(threadId: string): Promise<Thread | null> {
    return this.threads.get(threadId) || null;
  }

  async getThreadMessages(threadId: string, options?: GetMessagesOptions): Promise<MessagePage> {
    const messageIds = this.threadMessages.get(threadId);
    if (!messageIds) {
      return {
        messages: [],
        hasMore: false,
        totalCount: 0,
      };
    }

    const messages = Array.from(messageIds)
      .map((id) => this.messages.get(id))
      .filter((m): m is Message => m !== undefined);

    const sortOrder = options?.sortOrder || 'desc';
    messages.sort((a, b) => {
      return sortOrder === 'desc'
        ? b.createdAt.getTime() - a.createdAt.getTime()
        : a.createdAt.getTime() - b.createdAt.getTime();
    });

    const limit = options?.limit || 50;
    let cursorIndex = 0;

    if (options?.cursor) {
      cursorIndex = messages.findIndex((m) => m.messageId === options.cursor);
      if (cursorIndex !== -1) {
        cursorIndex++;
      }
    }

    const paginatedMessages = messages.slice(cursorIndex, cursorIndex + limit);
    const hasMore = messages.length > cursorIndex + limit;

    return {
      messages: paginatedMessages,
      hasMore,
      totalCount: messages.length,
      nextCursor: hasMore ? paginatedMessages[paginatedMessages.length - 1]?.messageId : undefined,
    };
  }

  async replyToThread(
    threadId: string,
    message: Omit<Message, 'messageId' | 'createdAt' | 'updatedAt' | 'threadReplyCount' | 'reactions' | 'isEdited' | 'isPinned'>
  ): Promise<Message> {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error(`Thread ${threadId} not found`);
    }

    const parentMessage = this.messages.get(thread.parentMessageId);
    if (!parentMessage) {
      throw new Error(`Parent message ${thread.parentMessageId} not found`);
    }

    const fullMessage: Message = {
      ...message,
      messageId: this.generateId('msg'),
      createdAt: new Date(),
      updatedAt: new Date(),
      threadReplyCount: 0,
      reactions: {},
      isEdited: false,
      isPinned: false,
      threadId,
    };

    this.messages.set(fullMessage.messageId, fullMessage);

    const threadMessages = this.threadMessages.get(threadId);
    if (threadMessages) {
      threadMessages.add(fullMessage.messageId);
    }

    thread.messageCount++;
    thread.lastMessageId = fullMessage.messageId;
    thread.lastMessageAt = fullMessage.createdAt;
    thread.updatedAt = new Date();
    this.threads.set(threadId, thread);

    if (!thread.participantIds.includes(message.senderId)) {
      thread.participantIds.push(message.senderId);
    }

    parentMessage.threadReplyCount = thread.messageCount;
    this.messages.set(thread.parentMessageId, parentMessage);

    const conversation = this.conversations.get(message.conversationId);
    if (conversation) {
      conversation.lastMessageId = fullMessage.messageId;
      conversation.lastMessagePreview = this.getMessagePreview(fullMessage.content);
      conversation.lastMessageAt = fullMessage.createdAt;
      conversation.messageCount++;
      conversation.updatedAt = new Date();
      this.conversations.set(message.conversationId, conversation);
    }

    return fullMessage;
  }

  async markAsRead(conversationId: string, userId: string, messageId: string): Promise<void> {
    const message = this.messages.get(messageId);
    if (message && message.conversationId === conversationId) {
      message.status = 'read';
      message.updatedAt = new Date();
      this.messages.set(messageId, message);
    }

    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.unreadCount[userId] = 0;
      this.conversations.set(conversationId, conversation);
    }

    this.setDeliveryStatus(messageId, userId, 'read');
  }

  async markAsDelivered(conversationId: string, userId: string, messageId: string): Promise<void> {
    const message = this.messages.get(messageId);
    if (message && message.conversationId === conversationId) {
      message.status = 'delivered';
      message.updatedAt = new Date();
      this.messages.set(messageId, message);
    }

    this.setDeliveryStatus(messageId, userId, 'delivered');
  }

  async getUnreadCount(conversationId: string, userId: string): Promise<number> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return 0;
    return conversation.unreadCount[userId] || 0;
  }

  async getTotalUnreadCount(userId: string): Promise<number> {
    const userConvIds = this.userConversations.get(userId);
    if (!userConvIds) return 0;

    let total = 0;
    for (const convId of userConvIds) {
      const conversation = this.conversations.get(convId);
      if (conversation && conversation.status === 'active') {
        total += conversation.unreadCount[userId] || 0;
      }
    }
    return total;
  }

  async startTyping(conversationId: string, userId: string, messageType?: MessageType): Promise<void> {
    const key = `${conversationId}:${userId}`;
    const indicator: TypingIndicator = {
      conversationId,
      userId,
      status: 'typing',
      messageType,
      startedAt: new Date(),
    };
    this.typingIndicators.set(key, indicator);
  }

  async stopTyping(conversationId: string, userId: string): Promise<void> {
    const key = `${conversationId}:${userId}`;
    const indicator = this.typingIndicators.get(key);
    if (indicator) {
      indicator.status = 'stopped';
      this.typingIndicators.set(key, indicator);
    }
  }

  async getTypingUsers(conversationId: string): Promise<TypingIndicator[]> {
    const indicators: TypingIndicator[] = [];
    for (const indicator of this.typingIndicators.values()) {
      if (indicator.conversationId === conversationId && indicator.status === 'typing') {
        indicators.push(indicator);
      }
    }
    return indicators;
  }

  async searchMessages(query: string, userId: string, options?: SearchMessagesOptions): Promise<MessageSearchResult[]> {
    const userConvIds = this.userConversations.get(userId);
    if (!userConvIds) return [];

    const results: MessageSearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const convId of userConvIds) {
      if (options?.conversationId && convId !== options.conversationId) {
        continue;
      }

      const conversation = this.conversations.get(convId);
      if (!conversation || conversation.status === 'deleted') continue;

      const messageIds = this.conversationMessages.get(convId);
      if (!messageIds) continue;

      for (const msgId of messageIds) {
        const message = this.messages.get(msgId);
        if (!message) continue;

        if (options?.senderId && message.senderId !== options.senderId) continue;
        if (options?.messageTypes && !options.messageTypes.includes(message.content.type)) continue;

        let matchScore = 0;
        const highlights: string[] = [];

        if (message.content.type === 'text') {
          const textContent = message.content as TextMessageContent;
          if (textContent.text.toLowerCase().includes(lowerQuery)) {
            matchScore = this.calculateMatchScore(textContent.text, lowerQuery);
            highlights.push(...this.getHighlights(textContent.text, lowerQuery));
          }
        }

        if (matchScore > 0) {
          results.push({
            message,
            conversation,
            matchScore,
            highlights,
          });
        }
      }
    }

    results.sort((a, b) => b.matchScore - a.matchScore);

    if (options?.limit) {
      return results.slice(0, options.limit);
    }

    return results;
  }

  async searchConversations(query: string, userId: string): Promise<ConversationSearchResult[]> {
    const userConvIds = this.userConversations.get(userId);
    if (!userConvIds) return [];

    const results: ConversationSearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const convId of userConvIds) {
      const conversation = this.conversations.get(convId);
      if (!conversation || conversation.status === 'deleted') continue;

      let matchScore = 0;
      const highlights: string[] = [];

      if (conversation.name?.toLowerCase().includes(lowerQuery)) {
        matchScore = this.calculateMatchScore(conversation.name, lowerQuery);
        highlights.push(...this.getHighlights(conversation.name, lowerQuery));
      }

      if (conversation.description?.toLowerCase().includes(lowerQuery)) {
        const descScore = this.calculateMatchScore(conversation.description, lowerQuery);
        if (descScore > matchScore) matchScore = descScore;
        highlights.push(...this.getHighlights(conversation.description, lowerQuery));
      }

      if (matchScore > 0) {
        results.push({
          conversation,
          matchScore,
          highlights,
        });
      }
    }

    results.sort((a, b) => b.matchScore - a.matchScore);

    return results;
  }

  private setDeliveryStatus(messageId: string, userId: string, status: MessageStatus): void {
    if (!this.deliveryStatus.has(messageId)) {
      this.deliveryStatus.set(messageId, new Map());
    }
    const userDeliveries = this.deliveryStatus.get(messageId)!;
    const existing = userDeliveries.get(userId);

    userDeliveries.set(userId, {
      messageId,
      userId,
      status,
      deliveredAt: status === 'delivered' ? new Date() : existing?.deliveredAt,
      readAt: status === 'read' ? new Date() : existing?.readAt,
    });
  }

  private addUserConversation(userId: string, conversationId: string): void {
    if (!this.userConversations.has(userId)) {
      this.userConversations.set(userId, new Set());
    }
    this.userConversations.get(userId)!.add(conversationId);
  }

  private getMessagePreview(content: MessageContent): string {
    switch (content.type) {
      case 'text':
        return (content as TextMessageContent).text.substring(0, 100);
      case 'image':
        return '[Image]';
      case 'video':
        return '[Video]';
      case 'audio':
        return '[Audio]';
      case 'file':
        return `[File: ${(content as FileMessageContent).name}]`;
      default:
        return '';
    }
  }

  private calculateMatchScore(text: string, query: string): number {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    if (lowerText === lowerQuery) return 100;
    if (lowerText.startsWith(lowerQuery)) return 90;
    if (lowerText.includes(lowerQuery)) return 70 + (query.length / text.length) * 20;
    return 0;
  }

  private getHighlights(text: string, query: string): string[] {
    const highlights: string[] = [];
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    let index = 0;
    while ((index = lowerText.indexOf(lowerQuery, index)) !== -1) {
      const start = Math.max(0, index - 20);
      const end = Math.min(text.length, index + query.length + 20);
      let highlight = text.substring(start, end);
      if (start > 0) highlight = '...' + highlight;
      if (end < text.length) highlight = highlight + '...';
      highlights.push(highlight);
      index += query.length;
    }

    return highlights;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export function createMessagingService(): MessagingServiceImpl {
  return new MessagingServiceImpl();
}

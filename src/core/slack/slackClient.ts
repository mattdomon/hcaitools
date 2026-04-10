/**
 * Slack Client Implementation
 * Handles messaging, channels, notifications, and bot interactions
 */

import crypto from 'crypto';
import {
  SlackChannel,
  SlackUser,
  SlackMessage,
  SlackNotification,
  SlackSlashCommand,
  SlackMessageSummary,
  SlackReport,
  SlackWorkflowTrigger,
  SlackClient,
  SlackChannelType,
  SlackNotificationType,
  SlackReactionType,
  SlackMessageType,
  SlackEvent,
  SendMessageOptions,
  SlackChannelCreatedEvent,
  SlackMessageEvent,
  SlackReactionEvent,
  SlackMemberJoinedChannelEvent,
} from './types';

export class SlackClientImpl implements SlackClient {
  private channels: Map<string, SlackChannel> = new Map();
  private users: Map<string, SlackUser> = new Map();
  private messages: Map<string, SlackMessage> = new Map();
  private notifications: Map<string, SlackNotification> = new Map();
  private slashCommandHandlers: Map<string, (cmd: SlackSlashCommand) => Promise<string>> = new Map();
  private webhooks: Map<string, Array<(event: SlackEvent) => Promise<void>>> = new Map();
  private workflows: Map<string, SlackWorkflowTrigger> = new Map();
  private config: any = {};

  async createChannel(name: string, type: SlackChannelType, options?: { topic?: string; purpose?: string }): Promise<SlackChannel> {
    const channelId = this.generateId('C');
    const now = new Date();

    const channel: SlackChannel = {
      channelId,
      name,
      type,
      isArchived: false,
      topic: options?.topic,
      purpose: options?.purpose,
      memberCount: 0,
      createdAt: now,
    };

    this.channels.set(channelId, channel);

    // Emit webhook event
    await this.processWebhook({
      eventId: this.generateId('evt'),
      eventType: 'channel_created',
      channelId,
      timestamp: now,
      data: { channelName: name, type } as unknown as Record<string, unknown>,
    });

    return channel;
  }

  async getChannel(channelId: string): Promise<SlackChannel | null> {
    return this.channels.get(channelId) || null;
  }

  async listChannels(type?: SlackChannelType): Promise<SlackChannel[]> {
    const channels = Array.from(this.channels.values()).filter((ch) => !ch.isArchived);
    if (type) {
      return channels.filter((ch) => ch.type === type);
    }
    return channels;
  }

  async archiveChannel(channelId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.isArchived = true;
      this.channels.set(channelId, channel);
    }
  }

  async updateChannel(channelId: string, updates: Partial<Pick<SlackChannel, 'topic' | 'purpose'>>): Promise<SlackChannel> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    const updated: SlackChannel = {
      ...channel,
      ...updates,
    };

    this.channels.set(channelId, updated);
    return updated;
  }

  async getUser(userId: string): Promise<SlackUser | null> {
    return this.users.get(userId) || null;
  }

  async getUserByEmail(email: string): Promise<SlackUser | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async listUsers(): Promise<SlackUser[]> {
    return Array.from(this.users.values()).filter((u) => !u.isBot);
  }

  async inviteUser(channelId: string, userId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    channel.memberCount++;
    this.channels.set(channelId, channel);
  }

  async removeUser(channelId: string, userId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    if (channel && channel.memberCount > 0) {
      channel.memberCount--;
      this.channels.set(channelId, channel);
    }
  }

  async sendMessage(channelId: string, text: string, options?: SendMessageOptions): Promise<SlackMessage> {
    const messageId = this.generateId('m');
    const now = new Date();

    const message: SlackMessage = {
      messageId,
      channelId,
      threadId: options?.threadId,
      userId: options?.username || 'bot',
      text,
      timestamp: now,
      reactions: [],
      attachments: options?.attachments || [],
      isPinned: false,
      replyCount: options?.threadId ? 0 : undefined,
    };

    this.messages.set(messageId, message);

    // Process any attached reactions
    if (options?.reactions) {
      for (const reaction of options.reactions) {
        await this.addReaction(channelId, messageId, reaction);
      }
    }

    // Emit webhook event
    await this.processWebhook({
      eventId: this.generateId('evt'),
      eventType: 'message_sent',
      channelId,
      userId: message.userId,
      timestamp: now,
      data: { messageId, text, threadId: options?.threadId } as unknown as Record<string, unknown>,
    });

    return message;
  }

  async sendThreadReply(channelId: string, threadId: string, text: string): Promise<SlackMessage> {
    const parentMessage = this.messages.get(threadId);
    if (!parentMessage) {
      throw new Error(`Thread ${threadId} not found`);
    }

    const reply = await this.sendMessage(channelId, text, { threadId });
    parentMessage.replyCount = (parentMessage.replyCount || 0) + 1;
    this.messages.set(threadId, parentMessage);

    return reply;
  }

  async updateMessage(channelId: string, messageId: string, text: string): Promise<SlackMessage> {
    const message = this.messages.get(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    message.text = text;
    message.editedAt = new Date();
    this.messages.set(messageId, message);

    return message;
  }

  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    this.messages.delete(messageId);
  }

  async pinMessage(channelId: string, messageId: string): Promise<void> {
    const message = this.messages.get(messageId);
    if (message) {
      message.isPinned = true;
      this.messages.set(messageId, message);
    }
  }

  async unpinMessage(channelId: string, messageId: string): Promise<void> {
    const message = this.messages.get(messageId);
    if (message) {
      message.isPinned = false;
      this.messages.set(messageId, message);
    }
  }

  async addReaction(channelId: string, messageId: string, reaction: SlackReactionType): Promise<void> {
    const message = this.messages.get(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    let existingReaction = message.reactions.find((r) => r.reaction === reaction);
    if (existingReaction) {
      existingReaction.count++;
      if (!existingReaction.userIds.includes('bot')) {
        existingReaction.userIds.push('bot');
      }
    } else {
      message.reactions.push({
        reaction,
        userIds: ['bot'],
        count: 1,
      });
    }

    this.messages.set(messageId, message);

    // Emit webhook event
    await this.processWebhook({
      eventId: this.generateId('evt'),
      eventType: 'reaction_added',
      channelId,
      timestamp: new Date(),
      data: { messageId, reaction } as unknown as Record<string, unknown>,
    });
  }

  async removeReaction(channelId: string, messageId: string, reaction: SlackReactionType): Promise<void> {
    const message = this.messages.get(messageId);
    if (message) {
      message.reactions = message.reactions.filter((r) => r.reaction !== reaction);
      this.messages.set(messageId, message);
    }
  }

  async sendNotification(notification: Omit<SlackNotification, 'notificationId' | 'timestamp' | 'status'>): Promise<SlackNotification> {
    const notificationId = this.generateId('n');
    const now = new Date();

    const fullNotification: SlackNotification = {
      ...notification,
      notificationId,
      timestamp: now,
      status: 'sent',
    };

    this.notifications.set(notificationId, fullNotification);

    // Convert notification to message format and send
    const emoji = this.getNotificationEmoji(notification.type);
    const formattedText = `*${emoji} ${notification.title}*\n${notification.message}`;

    await this.sendMessage(notification.channelId, formattedText);

    return fullNotification;
  }

  async sendBulkNotifications(notifications: Omit<SlackNotification, 'notificationId' | 'timestamp' | 'status'>[]): Promise<SlackNotification[]> {
    const results: SlackNotification[] = [];
    for (const notification of notifications) {
      const result = await this.sendNotification(notification);
      results.push(result);
    }
    return results;
  }

  registerSlashCommand(command: string, handler: (cmd: SlackSlashCommand) => Promise<string>): void {
    this.slashCommandHandlers.set(command, handler);
  }

  async handleSlashCommand(command: SlackSlashCommand): Promise<string> {
    const handler = this.slashCommandHandlers.get(command.command);
    if (!handler) {
      return `Command ${command.command} not found`;
    }

    return handler(command);
  }

  async getThreadReplies(channelId: string, threadId: string): Promise<SlackMessage[]> {
    return Array.from(this.messages.values()).filter(
      (m) => m.channelId === channelId && m.threadId === threadId
    );
  }

  async lockThread(channelId: string, threadId: string): Promise<void> {
    const parentMessage = this.messages.get(threadId);
    if (parentMessage) {
      // In a real implementation, would set isLocked flag
      parentMessage.isPinned = true;
      this.messages.set(threadId, parentMessage);
    }
  }

  async unlockThread(channelId: string, threadId: string): Promise<void> {
    const parentMessage = this.messages.get(threadId);
    if (parentMessage) {
      parentMessage.isPinned = false;
      this.messages.set(threadId, parentMessage);
    }
  }

  async generateMessageSummary(channelId: string, threadId?: string): Promise<SlackMessageSummary> {
    const messages = Array.from(this.messages.values()).filter(
      (m) => m.channelId === channelId && (!threadId || m.threadId === threadId)
    );

    const participants = new Set(messages.map((m) => m.userId));

    // Simple AI simulation - in production would use OpenAI/Claude
    const keyPoints = this.extractKeyPoints(messages);
    const actionItems = this.extractActionItems(messages);
    const sentiment = this.analyzeSentimentSimple(messages);
    const topics = this.extractTopics(messages);

    return {
      summaryId: this.generateId('sum'),
      channelId,
      threadId,
      generatedAt: new Date(),
      messageCount: messages.length,
      participantCount: participants.size,
      keyPoints,
      actionItems,
      sentiment,
      topics,
    };
  }

  async generateIntelligentResponse(context: string): Promise<string> {
    // Simple simulation - in production would use AI
    const responses = [
      `Based on the context, I suggest focusing on the key aspects mentioned.`,
      `I've analyzed the information and here's my recommendation.`,
      `Here's a summary of what we discussed and next steps.`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  async analyzeSentiment(messages: string[]): Promise<Record<string, number>> {
    // Simple sentiment analysis simulation
    const results: Record<string, number> = {};
    for (const msg of messages) {
      const score = this.calculateSentimentScore(msg);
      results[msg] = score;
    }
    return results;
  }

  registerWebhook(eventType: string, handler: (event: SlackEvent) => Promise<void>): void {
    const handlers = this.webhooks.get(eventType) || [];
    handlers.push(handler);
    this.webhooks.set(eventType, handlers);
  }

  async processWebhook(event: SlackEvent): Promise<void> {
    const handlers = this.webhooks.get(event.eventType) || [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Webhook error for ${event.eventType}:`, error);
      }
    }
  }

  async createWorkflow(trigger: Omit<SlackWorkflowTrigger, 'triggerId' | 'createdAt'>): Promise<SlackWorkflowTrigger> {
    const triggerId = this.generateId('wf');
    const fullTrigger: SlackWorkflowTrigger = {
      ...trigger,
      triggerId,
      createdAt: new Date(),
    };

    this.workflows.set(triggerId, fullTrigger);
    return fullTrigger;
  }

  async listWorkflows(channelId?: string): Promise<SlackWorkflowTrigger[]> {
    const workflows = Array.from(this.workflows.values());
    if (channelId) {
      return workflows.filter((wf) => wf.channelId === channelId);
    }
    return workflows;
  }

  async toggleWorkflow(triggerId: string, isActive: boolean): Promise<void> {
    const workflow = this.workflows.get(triggerId);
    if (workflow) {
      workflow.isActive = isActive;
      this.workflows.set(triggerId, workflow);
    }
  }

  async generateReport(periodStart: Date, periodEnd: Date): Promise<SlackReport> {
    const messages = Array.from(this.messages.values()).filter(
      (m) => m.timestamp >= periodStart && m.timestamp <= periodEnd
    );

    const channelMessageCounts: Record<string, number> = {};
    const userMessageCounts: Record<string, number> = {};
    const dateMessageCounts: Record<string, number> = {};

    for (const msg of messages) {
      channelMessageCounts[msg.channelId] = (channelMessageCounts[msg.channelId] || 0) + 1;
      userMessageCounts[msg.userId] = (userMessageCounts[msg.userId] || 0) + 1;

      const dateKey = msg.timestamp.toISOString().split('T')[0];
      dateMessageCounts[dateKey] = (dateMessageCounts[dateKey] || 0) + 1;
    }

    const topChannels = Object.entries(channelMessageCounts)
      .map(([channelId, messageCount]) => ({ channelId, messageCount }))
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 10);

    const topContributors = Object.entries(userMessageCounts)
      .map(([userId, messageCount]) => ({ userId, messageCount }))
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 10);

    return {
      reportId: this.generateId('rpt'),
      generatedAt: new Date(),
      periodStart,
      periodEnd,
      totalMessages: messages.length,
      totalChannels: Object.keys(channelMessageCounts).length,
      activeUsers: Object.keys(userMessageCounts).length,
      topChannels,
      topContributors,
      messageTrend: Object.entries(dateMessageCounts).map(([date, count]) => ({ date, count })),
      sentimentBreakdown: {},
    };
  }

  async getChannelStats(channelId: string): Promise<{
    messageCount: number;
    activeUsers: number;
    peakHour: number;
    avgResponseTime: number;
  }> {
    const messages = Array.from(this.messages.values()).filter((m) => m.channelId === channelId);
    const uniqueUsers = new Set(messages.map((m) => m.userId));

    return {
      messageCount: messages.length,
      activeUsers: uniqueUsers.size,
      peakHour: 14, // Simulated
      avgResponseTime: 120, // Simulated in seconds
    };
  }

  configureBot(config: any): void {
    this.config = { ...this.config, ...config };
  }

  getBotConfig(): any {
    return this.config;
  }

  // Helper methods
  private generateId(prefix: string): string {
    return `${prefix}${crypto.randomBytes(8).toString('hex')}`;
  }

  private getNotificationEmoji(type: SlackNotificationType): string {
    const emojis: Record<SlackNotificationType, string> = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      reminder: '🔔',
    };
    return emojis[type] || 'ℹ️';
  }

  private extractKeyPoints(messages: SlackMessage[]): string[] {
    // Simple extraction - in production would use NLP
    return messages.slice(0, 3).map((m) => m.text.substring(0, 50) + '...');
  }

  private extractActionItems(messages: SlackMessage[]): Array<{ text: string; assignedTo?: string; dueDate?: Date }> {
    // Simple extraction - look for @mentions
    const actionItems: Array<{ text: string; assignedTo?: string; dueDate?: Date }> = [];
    for (const msg of messages) {
      if (msg.text.includes('@')) {
        const mentionMatch = msg.text.match(/@(\w+)/);
        actionItems.push({
          text: msg.text.substring(0, 100),
          assignedTo: mentionMatch ? mentionMatch[1] : undefined,
        });
      }
    }
    return actionItems.slice(0, 5);
  }

  private analyzeSentimentSimple(messages: SlackMessage[]): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['great', 'awesome', 'thanks', 'love', 'perfect', 'excellent'];
    const negativeWords = ['bad', 'terrible', 'hate', 'awful', 'wrong', 'problem'];

    let positiveCount = 0;
    let negativeCount = 0;

    for (const msg of messages) {
      const lower = msg.text.toLowerCase();
      for (const word of positiveWords) {
        if (lower.includes(word)) positiveCount++;
      }
      for (const word of negativeWords) {
        if (lower.includes(word)) negativeCount++;
      }
    }

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private extractTopics(messages: SlackMessage[]): string[] {
    // Simple topic extraction
    const words: Record<string, number> = {};
    for (const msg of messages) {
      const msgWords = msg.text.toLowerCase().split(/\s+/);
      for (const word of msgWords) {
        if (word.length > 4) {
          words[word] = (words[word] || 0) + 1;
        }
      }
    }
    return Object.entries(words)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  private calculateSentimentScore(text: string): number {
    // Simple sentiment score between -1 and 1
    const positive = ['great', 'awesome', 'thanks', 'love', 'perfect', 'excellent', 'good'];
    const negative = ['bad', 'terrible', 'hate', 'awful', 'wrong', 'problem', 'issue'];

    const lower = text.toLowerCase();
    let score = 0;

    for (const word of positive) {
      if (lower.includes(word)) score += 0.2;
    }
    for (const word of negative) {
      if (lower.includes(word)) score -= 0.2;
    }

    return Math.max(-1, Math.min(1, score));
  }
}

// Type helpers for webhook data
interface ChannelCreatedData {
  channelName: string;
  type: SlackChannelType;
}

interface MessageSentData {
  messageId: string;
  text: string;
  threadId?: string;
}

interface ReactionAddedData {
  messageId: string;
  reaction: SlackReactionType;
}

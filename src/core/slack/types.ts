/**
 * Slack Integration Types
 * Types for team collaboration, notifications, and bot interactions
 */

export type SlackChannelType = 'public' | 'private' | 'direct' | 'mpim';
export type SlackNotificationType = 'info' | 'success' | 'warning' | 'error' | 'reminder';
export type SlackCommandType = 'task_create' | 'task_update' | 'task_list' | 'task_complete' | 'status_update' | 'help';
export type SlackReactionType = 'thumbsup' | 'thumbsdown' | 'heart' | 'eyes' | '+1' | '-1';

export interface SlackChannel {
  channelId: string;
  name: string;
  type: SlackChannelType;
  isArchived: boolean;
  topic?: string;
  purpose?: string;
  memberCount: number;
  createdAt: Date;
}

export interface SlackUser {
  userId: string;
  username: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  status?: string;
  isBot: boolean;
  isAdmin: boolean;
  timezone?: string;
}

export interface SlackMessage {
  messageId: string;
  channelId: string;
  threadId?: string;
  userId: string;
  text: string;
  timestamp: Date;
  editedAt?: Date;
  reactions: SlackReaction[];
  attachments: SlackAttachment[];
  isPinned: boolean;
  replyCount?: number;
}

export interface SlackReaction {
  reaction: SlackReactionType;
  userIds: string[];
  count: number;
}

export interface SlackAttachment {
  attachmentId: string;
  title?: string;
  text?: string;
  pretext?: string;
  fallback?: string;
  imageUrl?: string;
  color?: string;
  fields?: Array<{ title: string; value: string; short: boolean }>;
  actions?: SlackAction[];
  footer?: string;
  timestamp?: Date;
}

export interface SlackAction {
  actionId: string;
  type: 'button' | 'select' | 'link';
  text: string;
  url?: string;
  style?: 'primary' | 'danger' | 'default';
  options?: Array<{ text: string; value: string }>;
  confirm?: {
    title: string;
    text: string;
    okText: string;
    cancelText: string;
  };
}

export interface SlackSlashCommand {
  commandId: string;
  command: string; // e.g., "/task"
  userId: string;
  channelId: string;
  text: string;
  timestamp: Date;
  responseUrl: string;
}

export interface SlackNotification {
  notificationId: string;
  channelId: string;
  type: SlackNotificationType;
  title: string;
  message: string;
  fields?: Array<{ title: string; value: string; short?: boolean }>;
  actions?: SlackAction[];
  timestamp: Date;
  sentBy: string;
  status: 'pending' | 'sent' | 'failed';
  errorMessage?: string;
}

export interface SlackThread {
  threadId: string;
  channelId: string;
  parentMessageId: string;
  replyCount: number;
  participantCount: number;
  latestReplyAt?: Date;
  isLocked: boolean;
}

export interface SlackChannelCreatedEvent {
  channelId: string;
  channelName: string;
  creatorId: string;
  timestamp: Date;
}

export interface SlackMessageEvent {
  messageId: string;
  channelId: string;
  userId: string;
  text: string;
  timestamp: Date;
  threadId?: string;
}

export interface SlackReactionEvent {
  userId: string;
  channelId: string;
  messageId: string;
  reaction: SlackReactionType;
  timestamp: Date;
}

export interface SlackMemberJoinedChannelEvent {
  userId: string;
  channelId: string;
  timestamp: Date;
  inviterId?: string;
}

export interface SlackBotConfig {
  botId: string;
  botName: string;
  botIcon?: string;
  defaultChannels: string[];
  notificationPreferences: Record<SlackNotificationType, boolean>;
}

export interface SlackWorkflowTrigger {
  triggerId: string;
  name: string;
  channelId: string;
  events: string[]; // e.g., ['message', 'reaction', 'member_joined']
  filter?: {
    keywords?: string[];
    users?: string[];
    channels?: string[];
  };
  actions: SlackWorkflowAction[];
  isActive: boolean;
  createdAt: Date;
}

export interface SlackWorkflowAction {
  actionId: string;
  type: 'send_message' | 'send_notification' | 'create_task' | 'update_status' | 'archive_channel';
  config: Record<string, unknown>;
}

export interface SlackMessageSummary {
  summaryId: string;
  channelId: string;
  threadId?: string;
  generatedAt: Date;
  messageCount: number;
  participantCount: number;
  keyPoints: string[];
  actionItems: Array<{ text: string; assignedTo?: string; dueDate?: Date }>;
  sentiment: 'positive' | 'neutral' | 'negative';
  topics: string[];
}

export interface SlackReport {
  reportId: string;
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  totalMessages: number;
  totalChannels: number;
  activeUsers: number;
  topChannels: Array<{ channelId: string; messageCount: number }>;
  topContributors: Array<{ userId: string; messageCount: number }>;
  messageTrend: Array<{ date: string; count: number }>;
  sentimentBreakdown: Record<string, number>;
}

export interface SlackClient {
  // Channel management
  createChannel(name: string, type: SlackChannelType, options?: { topic?: string; purpose?: string }): Promise<SlackChannel>;
  getChannel(channelId: string): Promise<SlackChannel | null>;
  listChannels(type?: SlackChannelType): Promise<SlackChannel[]>;
  archiveChannel(channelId: string): Promise<void>;
  updateChannel(channelId: string, updates: Partial<Pick<SlackChannel, 'topic' | 'purpose'>>): Promise<SlackChannel>;

  // User management
  getUser(userId: string): Promise<SlackUser | null>;
  getUserByEmail(email: string): Promise<SlackUser | null>;
  listUsers(): Promise<SlackUser[]>;
  inviteUser(channelId: string, userId: string): Promise<void>;
  removeUser(channelId: string, userId: string): Promise<void>;

  // Messaging
  sendMessage(channelId: string, text: string, options?: SendMessageOptions): Promise<SlackMessage>;
  sendThreadReply(channelId: string, threadId: string, text: string): Promise<SlackMessage>;
  updateMessage(channelId: string, messageId: string, text: string): Promise<SlackMessage>;
  deleteMessage(channelId: string, messageId: string): Promise<void>;
  pinMessage(channelId: string, messageId: string): Promise<void>;
  unpinMessage(channelId: string, messageId: string): Promise<void>;
  addReaction(channelId: string, messageId: string, reaction: SlackReactionType): Promise<void>;
  removeReaction(channelId: string, messageId: string, reaction: SlackReactionType): Promise<void>;

  // Notifications
  sendNotification(notification: Omit<SlackNotification, 'notificationId' | 'timestamp' | 'status'>): Promise<SlackNotification>;
  sendBulkNotifications(notifications: Omit<SlackNotification, 'notificationId' | 'timestamp' | 'status'>[]): Promise<SlackNotification[]>;

  // Slash commands
  registerSlashCommand(command: string, handler: (cmd: SlackSlashCommand) => Promise<string>): void;
  handleSlashCommand(command: SlackSlashCommand): Promise<string>;

  // Threads
  getThreadReplies(channelId: string, threadId: string): Promise<SlackMessage[]>;
  lockThread(channelId: string, threadId: string): Promise<void>;
  unlockThread(channelId: string, threadId: string): Promise<void>;

  // AI features
  generateMessageSummary(channelId: string, threadId?: string): Promise<SlackMessageSummary>;
  generateIntelligentResponse(context: string): Promise<string>;
  analyzeSentiment(messages: string[]): Promise<Record<string, number>>;

  // Webhooks
  registerWebhook(eventType: string, handler: (event: SlackEvent) => Promise<void>): void;
  processWebhook(event: SlackEvent): Promise<void>;

  // Workflows
  createWorkflow(trigger: Omit<SlackWorkflowTrigger, 'triggerId' | 'createdAt'>): Promise<SlackWorkflowTrigger>;
  listWorkflows(channelId?: string): Promise<SlackWorkflowTrigger[]>;
  toggleWorkflow(triggerId: string, isActive: boolean): Promise<void>;

  // Reporting
  generateReport(periodStart: Date, periodEnd: Date): Promise<SlackReport>;
  getChannelStats(channelId: string): Promise<{
    messageCount: number;
    activeUsers: number;
    peakHour: number;
    avgResponseTime: number;
  }>;

  // Configuration
  configureBot(config: Partial<SlackBotConfig>): void;
  getBotConfig(): SlackBotConfig;
}

export interface SendMessageOptions {
  threadId?: string;
  attachments?: SlackAttachment[];
  reactions?: SlackReactionType[];
  username?: string;
  iconUrl?: string;
  iconEmoji?: string;
  isBroadcast?: boolean;
}

export interface SlackEvent {
  eventId: string;
  eventType: string;
  channelId?: string;
  userId?: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

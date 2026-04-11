/**
 * Messaging & Conversations Types
 * Complete type definitions for messaging system
 */

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file';
export type ConversationType = 'direct' | 'group' | 'channel';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export type ConversationStatus = 'active' | 'archived' | 'deleted';
export type MessageRole = 'user' | 'assistant' | 'system';
export type TypingStatus = 'typing' | 'stopped';

export interface BaseMessageContent {
  type: MessageType;
  timestamp: Date;
}

export interface TextMessageContent extends BaseMessageContent {
  type: 'text';
  text: string;
  mentions?: string[];
}

export interface ImageMessageContent extends BaseMessageContent {
  type: 'image';
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  caption?: string;
  mimeType: string;
  size: number;
}

export interface VideoMessageContent extends BaseMessageContent {
  type: 'video';
  url: string;
  thumbnailUrl?: string;
  duration: number;
  width?: number;
  height?: number;
  caption?: string;
  mimeType: string;
  size: number;
}

export interface AudioMessageContent extends BaseMessageContent {
  type: 'audio';
  url: string;
  duration: number;
  mimeType: string;
  size: number;
  waveform?: number[];
}

export interface FileMessageContent extends BaseMessageContent {
  type: 'file';
  name: string;
  url: string;
  mimeType: string;
  size: number;
  caption?: string;
}

export type MessageContent = TextMessageContent | ImageMessageContent | VideoMessageContent | AudioMessageContent | FileMessageContent;

export interface Message {
  messageId: string;
  conversationId: string;
  senderId: string;
  content: MessageContent;
  status: MessageStatus;
  role: MessageRole;
  replyToId?: string;
  threadId?: string;
  threadReplyCount: number;
  reactions: Record<string, string[]>;
  mentions: string[];
  isEdited: boolean;
  editedAt?: Date;
  isPinned: boolean;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  conversationId: string;
  type: ConversationType;
  name?: string;
  description?: string;
  avatarUrl?: string;
  participants: string[];
  adminIds: string[];
  creatorId: string;
  status: ConversationStatus;
  isPinned: boolean;
  lastMessageId?: string;
  lastMessagePreview?: string;
  lastMessageAt?: Date;
  unreadCount: Record<string, number>;
  messageCount: number;
  settings: ConversationSettings;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
}

export interface ConversationSettings {
  allowSend: boolean;
  allowReply: boolean;
  allowReact: boolean;
  allowPin: boolean;
  allowDelete: 'owner' | 'admin' | 'all';
  allowLeave: 'owner' | 'admin' | 'all';
  notificationLevel: 'all' | 'mentions' | 'none';
}

export interface Thread {
  threadId: string;
  parentMessageId: string;
  conversationId: string;
  participantIds: string[];
  messageCount: number;
  lastMessageId?: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TypingIndicator {
  conversationId: string;
  userId: string;
  status: TypingStatus;
  messageType?: MessageType;
  startedAt: Date;
}

export interface MessageSearchResult {
  message: Message;
  conversation: Conversation;
  matchScore: number;
  highlights: string[];
}

export interface ConversationSearchResult {
  conversation: Conversation;
  matchScore: number;
  highlights: string[];
}

export interface UnreadCount {
  conversationId: string;
  userId: string;
  count: number;
  lastReadMessageId?: string;
}

export interface MessagePage {
  messages: Message[];
  nextCursor?: string;
  prevCursor?: string;
  hasMore: boolean;
  totalCount: number;
}

export interface ConversationPage {
  conversations: Conversation[];
  nextCursor?: string;
  prevCursor?: string;
  hasMore: boolean;
  totalCount: number;
}

export interface MessagingService {
  // Conversations
  createConversation(conversation: Omit<Conversation, 'conversationId' | 'createdAt' | 'updatedAt' | 'messageCount'>): Promise<Conversation>;
  getConversation(conversationId: string): Promise<Conversation | null>;
  getConversations(userId: string, options?: GetConversationsOptions): Promise<ConversationPage>;
  updateConversation(conversationId: string, updates: Partial<Conversation>): Promise<Conversation>;
  deleteConversation(conversationId: string): Promise<void>;
  archiveConversation(conversationId: string): Promise<void>;
  unarchiveConversation(conversationId: string): Promise<void>;
  addParticipant(conversationId: string, userId: string): Promise<void>;
  removeParticipant(conversationId: string, userId: string): Promise<void>;

  // Messages
  sendMessage(message: Omit<Message, 'messageId' | 'createdAt' | 'updatedAt' | 'threadReplyCount' | 'reactions' | 'isEdited' | 'isPinned'>): Promise<Message>;
  getMessage(messageId: string): Promise<Message | null>;
  getMessages(conversationId: string, options?: GetMessagesOptions): Promise<MessagePage>;
  updateMessage(messageId: string, content: MessageContent): Promise<Message>;
  deleteMessage(messageId: string): Promise<void>;
  reactToMessage(messageId: string, emoji: string, userId: string): Promise<void>;
  unreactToMessage(messageId: string, emoji: string, userId: string): Promise<void>;
  pinMessage(messageId: string): Promise<void>;
  unpinMessage(messageId: string): Promise<void>;

  // Threading
  createThread(parentMessageId: string): Promise<Thread>;
  getThread(threadId: string): Promise<Thread | null>;
  getThreadMessages(threadId: string, options?: GetMessagesOptions): Promise<MessagePage>;
  replyToThread(threadId: string, message: Omit<Message, 'messageId' | 'createdAt' | 'updatedAt' | 'threadReplyCount' | 'reactions' | 'isEdited' | 'isPinned'>): Promise<Message>;

  // Status
  markAsRead(conversationId: string, userId: string, messageId: string): Promise<void>;
  markAsDelivered(conversationId: string, userId: string, messageId: string): Promise<void>;
  getUnreadCount(conversationId: string, userId: string): Promise<number>;
  getTotalUnreadCount(userId: string): Promise<number>;

  // Typing
  startTyping(conversationId: string, userId: string, messageType?: MessageType): Promise<void>;
  stopTyping(conversationId: string, userId: string): Promise<void>;
  getTypingUsers(conversationId: string): Promise<TypingIndicator[]>;

  // Search
  searchMessages(query: string, userId: string, options?: SearchMessagesOptions): Promise<MessageSearchResult[]>;
  searchConversations(query: string, userId: string): Promise<ConversationSearchResult[]>;
}

export interface GetConversationsOptions {
  type?: ConversationType;
  status?: ConversationStatus;
  limit?: number;
  cursor?: string;
  includeArchived?: boolean;
  sortBy?: 'lastMessageAt' | 'createdAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface GetMessagesOptions {
  limit?: number;
  cursor?: string;
  before?: Date;
  after?: Date;
  senderId?: string;
  messageType?: MessageType;
  includeDeleted?: boolean;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchMessagesOptions {
  conversationId?: string;
  limit?: number;
  messageTypes?: MessageType[];
  senderId?: string;
  since?: Date;
  until?: Date;
}

export interface MessagingAnalytics {
  conversationId: string;
  totalMessages: number;
  messagesByType: Record<MessageType, number>;
  messagesByDay: Record<string, number>;
  activeParticipants: number;
  averageResponseTimeMs: number;
  peakHours: Array<{ hour: number; count: number }>;
}

export interface MessageDeliveryStatus {
  messageId: string;
  userId: string;
  status: MessageStatus;
  deliveredAt?: Date;
  readAt?: Date;
}

export interface ConversationParticipant {
  userId: string;
  joinedAt: Date;
  isAdmin: boolean;
  isOwner: boolean;
  lastReadAt?: Date;
  notificationSettings: 'all' | 'mentions' | 'none';
}

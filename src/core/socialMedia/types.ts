/**
 * Social Media Integration Types
 * Complete type definitions for social media API abstraction
 */

export type SocialPlatform = 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'tiktok';
export type PostType = 'text' | 'image' | 'video' | 'link' | 'story';
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';
export type MediaType = 'image' | 'video' | 'gif';
export type CommentStatus = 'pending' | 'approved' | 'spam' | 'deleted';
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';
export type EngagementType = 'like' | 'comment' | 'share' | 'save' | 'click';

export interface MediaAttachment {
  mediaId: string;
  type: MediaType;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  altText?: string;
  caption?: string;
}

export interface SocialPost {
  postId: string;
  platform: SocialPlatform;
  userId: string;
  content: string;
  postType: PostType;
  media?: MediaAttachment[];
  link?: {
    url: string;
    title?: string;
    description?: string;
    imageUrl?: string;
  };
  scheduledFor?: Date;
  publishedAt?: Date;
  status: PostStatus;
  tags?: string[];
  mentions?: string[];
  location?: {
    latitude: number;
    longitude: number;
    placeName?: string;
  };
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledPost extends SocialPost {
  scheduledFor: Date;
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    endDate?: Date;
  };
}

export interface PostAnalytics {
  postId: string;
  platform: SocialPlatform;
  impressions: number;
  reach: number;
  engagements: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  clickThroughRate: number;
  engagementRate: number;
  topEngagementType: EngagementType;
  demographicBreakdown?: Record<string, Record<string, number>>;
  timestamp: Date;
}

export interface Comment {
  commentId: string;
  postId: string;
  platform: SocialPlatform;
  userId: string;
  username: string;
  userAvatar?: string;
  content: string;
  status: CommentStatus;
  replies?: Comment[];
  likes: number;
  isLikedByOwner: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DirectMessage {
  messageId: string;
  platform: SocialPlatform;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  media?: MediaAttachment;
  status: MessageStatus;
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
}

export interface Conversation {
  conversationId: string;
  platform: SocialPlatform;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialAccount {
  accountId: string;
  platform: SocialPlatform;
  userId: string;
  username: string;
  displayName: string;
  profileImageUrl?: string;
  bio?: string;
  isBusiness: boolean;
  isConnected: boolean;
  permissions: string[];
  connectedAt: Date;
  expiresAt?: Date;
}

export interface SocialAnalytics {
  accountId: string;
  platform: SocialPlatform;
  period: { start: Date; end: Date };
  totalPosts: number;
  totalFollowers: number;
  newFollowers: number;
  lostFollowers: number;
  netGrowthRate: number;
  totalImpressions: number;
  totalEngagements: number;
  averageEngagementRate: number;
  topPosts: string[];
  topHashtags: Array<{ tag: string; count: number }>;
  audienceDemographics: Record<string, Record<string, number>>;
  reachByDay: Array<{ date: Date; reach: number }>;
  engagementByDay: Array<{ date: Date; engagements: number }>;
}

export interface EngagementStats {
  userId: string;
  platform: SocialPlatform;
  period: { start: Date; end: Date };
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  averageLikesPerPost: number;
  averageCommentsPerPost: number;
  averageSharesPerPost: number;
  bestPerformingPost?: string;
  worstPerformingPost?: string;
}

export interface Hashtag {
  hashtag: string;
  count: number;
  trending: boolean;
  relatedHashtags: string[];
}

export interface Mention {
  mentionId: string;
  platform: SocialPlatform;
  postId: string;
  mentionedUsername: string;
  mentionedUserId: string;
  content: string;
  authorUsername: string;
  authorAvatar?: string;
  createdAt: Date;
}

export interface CrossPlatformPost {
  crossPostId: string;
  userId: string;
  content: string;
  postType: PostType;
  media?: MediaAttachment[];
  platforms: SocialPlatform[];
  scheduledFor?: Date;
  status: PostStatus;
  individualPostIds: string[];
  createdAt: Date;
}

export interface SocialMediaService {
  // Account management
  connectAccount(userId: string, platform: SocialPlatform, accessToken: string): Promise<SocialAccount>;
  disconnectAccount(accountId: string): Promise<void>;
  getConnectedAccounts(userId: string): Promise<SocialAccount[]>;
  refreshAccount(accountId: string): Promise<SocialAccount>;
  getAccountAnalytics(accountId: string, period: { start: Date; end: Date }): Promise<SocialAnalytics>;

  // Post management
  createPost(accountId: string, post: Omit<SocialPost, 'postId' | 'createdAt' | 'updatedAt'>): Promise<SocialPost>;
  schedulePost(accountId: string, post: Omit<ScheduledPost, 'postId' | 'createdAt' | 'updatedAt'>): Promise<ScheduledPost>;
  publishPost(postId: string): Promise<SocialPost>;
  updatePost(postId: string, updates: Partial<SocialPost>): Promise<SocialPost>;
  deletePost(postId: string): Promise<void>;
  getPost(postId: string): Promise<SocialPost | null>;
  getAccountPosts(accountId: string, options?: GetPostsOptions): Promise<SocialPost[]>;

  // Cross-platform posting
  createCrossPlatformPost(crossPost: Omit<CrossPlatformPost, 'crossPostId' | 'createdAt'>): Promise<CrossPlatformPost>;
  publishCrossPlatformPost(crossPostId: string): Promise<SocialPost[]>;
  cancelCrossPlatformPost(crossPostId: string): Promise<void>;

  // Scheduling
  getScheduledPosts(accountId: string): Promise<ScheduledPost[]>;
  cancelScheduledPost(postId: string): Promise<void>;
  reschedulePost(postId: string, newScheduledFor: Date): Promise<void>;

  // Analytics
  getPostAnalytics(postId: string): Promise<PostAnalytics | null>;
  getMultiplePostAnalytics(postIds: string[]): Promise<Map<string, PostAnalytics>>;
  getEngagementStats(userId: string, platform: SocialPlatform, period: { start: Date; end: Date }): Promise<EngagementStats>;
  getTrendingHashtags(platform: SocialPlatform, limit?: number): Promise<Hashtag[]>;

  // Comments
  getComments(postId: string, options?: GetCommentsOptions): Promise<Comment[]>;
  createComment(postId: string, content: string, parentCommentId?: string): Promise<Comment>;
  updateComment(commentId: string, content: string): Promise<Comment>;
  deleteComment(commentId: string): Promise<void>;
  moderateComment(commentId: string, status: CommentStatus): Promise<void>;
  replyToComment(commentId: string, content: string): Promise<Comment>;

  // Messages
  getConversations(accountId: string): Promise<Conversation[]>;
  getConversationMessages(accountId: string, conversationId: string, limit?: number): Promise<DirectMessage[]>;
  sendMessage(accountId: string, conversationId: string, content: string, media?: MediaAttachment): Promise<DirectMessage>;
  markMessageAsRead(messageId: string): Promise<void>;
  markConversationAsRead(accountId: string, conversationId: string): Promise<void>;

  // Mentions
  getMentions(accountId: string, since?: Date): Promise<Mention[]>;
  getMentionAnalytics(accountId: string, period: { start: Date; end: Date }): Promise<{ totalMentions: number; mentionsByDay: Array<{ date: Date; count: number }> }>;
}

export interface GetPostsOptions {
  status?: PostStatus;
  postType?: PostType;
  limit?: number;
  offset?: number;
  since?: Date;
  until?: Date;
  tags?: string[];
}

export interface GetCommentsOptions {
  status?: CommentStatus;
  limit?: number;
  offset?: number;
  since?: Date;
}

export interface PlatformClient {
  platform: SocialPlatform;
  post(content: string, media?: MediaAttachment[]): Promise<{ postId: string; url: string }>;
  updatePost(postId: string, content: string): Promise<void>;
  deletePost(postId: string): Promise<void>;
  getPost(postId: string): Promise<SocialPost>;
  getComments(postId: string): Promise<Comment[]>;
  comment(postId: string, content: string): Promise<{ commentId: string }>;
  deleteComment(commentId: string): Promise<void>;
  sendMessage(receiverId: string, content: string, media?: MediaAttachment): Promise<{ messageId: string }>;
  getAnalytics(postId: string): Promise<PostAnalytics>;
}

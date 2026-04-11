import crypto from 'crypto';

export type CommentStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

export type ReviewRating = 1 | 2 | 3 | 4 | 5;

export type ReactionType = 'like' | 'dislike' | 'love' | 'laugh' | 'sad' | 'angry' | 'wow' | 'care';

export type SentimentLabel = 'positive' | 'neutral' | 'negative';

export type ReportReason = 'spam' | 'harassment' | 'hate_speech' | 'inappropriate' | 'off_topic' | 'misinformation' | 'copyright' | 'other';

export interface Reaction {
  type: ReactionType;
  count: number;
  userIds: string[];
}

export interface SentimentScore {
  label: SentimentLabel;
  confidence: number;
  positive: number;
  negative: number;
  neutral: number;
}

export interface Comment {
  id: string;
  content: string;
  authorId: string;
  targetId: string;
  targetType: 'post' | 'product' | 'video' | 'article' | 'comment';
  parentId?: string;
  rootId?: string;
  status: CommentStatus;
  reactions: Map<ReactionType, Reaction>;
  replyCount: number;
  mentions: string[];
  hashtags: string[];
  sentiment?: SentimentScore;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface Review {
  id: string;
  content: string;
  authorId: string;
  targetId: string;
  targetType: 'product' | 'service' | 'video' | 'article';
  rating: ReviewRating;
  title?: string;
  pros?: string[];
  cons?: string[];
  images?: string[];
  status: CommentStatus;
  reactions: Map<ReactionType, Reaction>;
  helpfulCount: number;
  unhelpfulCount: number;
  verified: boolean;
  sentiment?: SentimentScore;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface ReviewResponse {
  id: string;
  reviewId: string;
  content: string;
  authorId: string;
  status: CommentStatus;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface Report {
  id: string;
  targetType: 'comment' | 'review' | 'response' | 'user';
  targetId: string;
  reporterId: string;
  reason: ReportReason;
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  moderatorId?: string;
  resolution?: string;
  createdAt: Date;
  reviewedAt?: Date;
}

export interface CommentThread {
  rootComment: Comment;
  replies: Comment[];
  totalReplies: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ReviewWithResponses {
  review: Review;
  responses: ReviewResponse[];
  averageRating: number;
  totalReviews: number;
}

export interface ModerationAction {
  id: string;
  moderatorId: string;
  targetType: 'comment' | 'review' | 'response';
  targetId: string;
  action: 'approve' | 'reject' | 'flag' | 'delete' | 'restore' | 'ban_user' | 'warn_user';
  reason?: string;
  createdAt: Date;
}

export interface UserActivity {
  userId: string;
  totalComments: number;
  totalReviews: number;
  totalReactions: number;
  reportedCount: number;
  receivedReports: number;
  lastActivityAt: Date;
}

export interface SentimentAnalysisResult {
  text: string;
  sentiment: SentimentScore;
  keywords: string[];
  entities: string[];
  language: string;
  analyzedAt: Date;
}

export interface PaginatedComments {
  comments: Comment[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedReviews {
  reviews: Review[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface ReviewSummary {
  targetId: string;
  targetType: string;
  averageRating: number;
  totalReviews: number;
  distribution: RatingDistribution;
  recentReviews: Review[];
}

export type NotificationType = 
  | 'comment_reply'
  | 'review_response'
  | 'mention'
  | 'reaction'
  | 'moderation_action'
  | 'report_resolved';

export interface NotificationPayload {
  type: NotificationType;
  recipientId: string;
  senderId?: string;
  moderatorId?: string;
  targetType: 'comment' | 'review' | 'response';
  targetId: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

export function createCommentId(): string {
  return `cmt_${crypto.randomBytes(8).toString('hex')}`;
}

export function createReviewId(): string {
  return `rev_${crypto.randomBytes(8).toString('hex')}`;
}

export function createResponseId(): string {
  return `rsp_${crypto.randomBytes(8).toString('hex')}`;
}

export function createReportId(): string {
  return `rpt_${crypto.randomBytes(8).toString('hex')}`;
}

export function createModerationId(): string {
  return `mod_${crypto.randomBytes(8).toString('hex')}`;
}

export function createNotificationId(): string {
  return `notif_${crypto.randomBytes(8).toString('hex')}`;
}

export function isValidRating(rating: unknown): rating is ReviewRating {
  return typeof rating === 'number' && Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

export function isValidReactionType(type: unknown): type is ReactionType {
  if (typeof type !== 'string') return false;
  const validTypes: ReactionType[] = ['like', 'dislike', 'love', 'laugh', 'sad', 'angry', 'wow', 'care'];
  return validTypes.includes(type as ReactionType);
}

export function isValidCommentStatus(status: unknown): status is CommentStatus {
  if (typeof status !== 'string') return false;
  const validStatuses: CommentStatus[] = ['pending', 'approved', 'rejected', 'flagged'];
  return validStatuses.includes(status as CommentStatus);
}

export function isSentimentScore(obj: unknown): obj is SentimentScore {
  if (typeof obj !== 'object' || obj === null) return false;
  const score = obj as Record<string, unknown>;
  return (
    typeof score.label === 'string' &&
    typeof score.confidence === 'number' &&
    typeof score.positive === 'number' &&
    typeof score.negative === 'number' &&
    typeof score.neutral === 'number'
  );
}

export function getDefaultSentiment(): SentimentScore {
  return {
    label: 'neutral',
    confidence: 0,
    positive: 0,
    negative: 0,
    neutral: 1,
  };
}

export function getDefaultReactions(): Map<ReactionType, Reaction> {
  const reactions: Map<ReactionType, Reaction> = new Map();
  const types: ReactionType[] = ['like', 'dislike', 'love', 'laugh', 'sad', 'angry', 'wow', 'care'];
  
  for (const type of types) {
    reactions.set(type, { type, count: 0, userIds: [] });
  }
  
  return reactions;
}

export function calculateAverageRating(ratings: ReviewRating[]): number {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((acc, r) => acc + r, 0);
  return Math.round((sum / ratings.length) * 100) / 100;
}

export function getDefaultRatingDistribution(): RatingDistribution {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

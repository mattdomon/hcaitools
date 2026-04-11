import {
  Comment,
  Review,
  ReviewResponse,
  Report,
  CommentThread,
  ReviewWithResponses,
  ModerationAction,
  SentimentScore,
  CommentStatus,
  ReviewRating,
  ReactionType,
  ReportReason,
  NotificationPayload,
  PaginatedComments,
  PaginatedReviews,
  ReviewSummary,
  RatingDistribution,
  SentimentAnalysisResult,
  createCommentId,
  createReviewId,
  createResponseId,
  createReportId,
  createModerationId,
  createNotificationId,
  isValidRating,
  isValidReactionType,
  getDefaultReactions,
  calculateAverageRating,
  getDefaultRatingDistribution,
} from './types';

export class CommentsReviewsEngine {
  private comments: Map<string, Comment> = new Map();
  private reviews: Map<string, Review> = new Map();
  private responses: Map<string, ReviewResponse> = new Map();
  private reports: Map<string, Report> = new Map();
  private moderationActions: Map<string, ModerationAction> = new Map();
  private notifications: Map<string, NotificationPayload> = new Map();
  private userActivities: Map<string, { totalComments: number; totalReviews: number; totalReactions: number }> = new Map();

  createComment(params: {
    content: string;
    authorId: string;
    targetId: string;
    targetType: Comment['targetType'];
    parentId?: string;
    mentions?: string[];
    hashtags?: string[];
    autoApprove?: boolean;
  }): Comment {
    const id = createCommentId();
    const now = new Date();
    const status: CommentStatus = params.autoApprove ? 'approved' : 'pending';
    const sentiment = this.analyzeSentiment(params.content);

    let rootId: string | undefined;
    if (params.parentId) {
      const parent = this.comments.get(params.parentId);
      if (parent) {
        rootId = parent.rootId || parent.id;
      }
    }

    const comment: Comment = {
      id,
      content: params.content,
      authorId: params.authorId,
      targetId: params.targetId,
      targetType: params.targetType,
      parentId: params.parentId,
      rootId,
      status,
      reactions: getDefaultReactions(),
      replyCount: 0,
      mentions: params.mentions || [],
      hashtags: params.hashtags || [],
      sentiment,
      isEdited: false,
      createdAt: now,
      updatedAt: now,
    };

    this.comments.set(id, comment);
    this.incrementUserActivity(params.authorId, 'comments');

    if (params.parentId) {
      const parent = this.comments.get(params.parentId);
      if (parent) {
        parent.replyCount++;
        parent.updatedAt = now;
      }
    }

    if (status === 'approved' && params.parentId) {
      const parent = this.comments.get(params.parentId);
      if (parent && parent.status === 'approved') {
        this.createNotification({
          type: 'comment_reply',
          recipientId: parent.authorId,
          senderId: params.authorId,
          targetType: 'comment',
          targetId: id,
          message: 'Someone replied to your comment',
        });
      }
    }

    return comment;
  }

  updateComment(commentId: string, content: string, _userId: string): Comment | null {
    const comment = this.comments.get(commentId);
    if (!comment) return null;

    comment.content = content;
    comment.sentiment = this.analyzeSentiment(content);
    comment.isEdited = true;
    comment.updatedAt = new Date();

    return comment;
  }

  deleteComment(commentId: string, _userId: string): boolean {
    const comment = this.comments.get(commentId);
    if (!comment) return false;

    comment.deletedAt = new Date();
    comment.content = '[deleted]';
    comment.status = 'rejected';

    if (comment.parentId) {
      const parent = this.comments.get(comment.parentId);
      if (parent && parent.replyCount > 0) {
        parent.replyCount--;
      }
    }

    return true;
  }

  getComment(commentId: string): Comment | undefined {
    return this.comments.get(commentId);
  }

  getCommentsByTarget(targetId: string, options?: {
    status?: CommentStatus;
    page?: number;
    pageSize?: number;
    sortBy?: 'createdAt' | 'reactions';
    sortOrder?: 'asc' | 'desc';
  }): PaginatedComments {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const sortBy = options?.sortBy || 'createdAt';
    const sortOrder = options?.sortOrder || 'desc';

    let comments = Array.from(this.comments.values())
      .filter(c => c.targetId === targetId && !c.deletedAt);

    if (options?.status) {
      comments = comments.filter(c => c.status === options.status);
    }

    comments = comments.filter(c => !c.parentId);

    if (sortBy === 'createdAt') {
      comments.sort((a, b) => sortOrder === 'desc' 
        ? b.createdAt.getTime() - a.createdAt.getTime()
        : a.createdAt.getTime() - b.createdAt.getTime());
    } else if (sortBy === 'reactions') {
      comments.sort((a, b) => {
        const aTotal = Array.from(a.reactions.values()).reduce((sum, r) => sum + r.count, 0);
        const bTotal = Array.from(b.reactions.values()).reduce((sum, r) => sum + r.count, 0);
        return sortOrder === 'desc' ? bTotal - aTotal : aTotal - bTotal;
      });
    }

    const total = comments.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const paginatedComments = comments.slice(start, start + pageSize);

    return {
      comments: paginatedComments,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  getCommentThread(rootCommentId: string, options?: {
    page?: number;
    pageSize?: number;
  }): CommentThread | null {
    const root = this.comments.get(rootCommentId);
    if (!root || root.deletedAt) return null;

    const page = options?.page || 1;
    const pageSize = options?.pageSize || 10;

    const replies = Array.from(this.comments.values())
      .filter(c => c.rootId === rootCommentId && !c.deletedAt)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const start = (page - 1) * pageSize;
    const paginatedReplies = replies.slice(start, start + pageSize);
    const hasMore = start + pageSize < replies.length;

    return {
      rootComment: root,
      replies: paginatedReplies,
      totalReplies: replies.length,
      page,
      pageSize,
      hasMore,
    };
  }

  addReaction(
    targetType: 'comment' | 'review',
    targetId: string,
    userId: string,
    reactionType: ReactionType
  ): boolean {
    if (!isValidReactionType(reactionType)) return false;

    if (targetType === 'comment') {
      const comment = this.comments.get(targetId);
      if (!comment) return false;

      const reaction = comment.reactions.get(reactionType);
      if (!reaction) return false;

      comment.reactions.forEach((r) => {
        if (r.userIds.includes(userId)) {
          r.userIds = r.userIds.filter(id => id !== userId);
          r.count--;
        }
      });

      if (!reaction.userIds.includes(userId)) {
        reaction.userIds.push(userId);
        reaction.count++;
      }

      this.incrementUserActivity(userId, 'reactions');
      return true;
    } else {
      const review = this.reviews.get(targetId);
      if (!review) return false;

      const reaction = review.reactions.get(reactionType);
      if (!reaction) return false;

      review.reactions.forEach((r) => {
        if (r.userIds.includes(userId)) {
          r.userIds = r.userIds.filter(id => id !== userId);
          r.count--;
        }
      });

      if (!reaction.userIds.includes(userId)) {
        reaction.userIds.push(userId);
        reaction.count++;
      }

      this.incrementUserActivity(userId, 'reactions');
      return true;
    }
  }

  removeReaction(
    targetType: 'comment' | 'review',
    targetId: string,
    userId: string
  ): boolean {
    if (targetType === 'comment') {
      const comment = this.comments.get(targetId);
      if (!comment) return false;

      comment.reactions.forEach((reaction) => {
        if (reaction.userIds.includes(userId)) {
          reaction.userIds = reaction.userIds.filter(id => id !== userId);
          reaction.count--;
        }
      });
      return true;
    } else {
      const review = this.reviews.get(targetId);
      if (!review) return false;

      review.reactions.forEach((reaction) => {
        if (reaction.userIds.includes(userId)) {
          reaction.userIds = reaction.userIds.filter(id => id !== userId);
          reaction.count--;
        }
      });
      return true;
    }
  }

  createReview(params: {
    content: string;
    authorId: string;
    targetId: string;
    targetType: Review['targetType'];
    rating: ReviewRating;
    title?: string;
    pros?: string[];
    cons?: string[];
    images?: string[];
    verified?: boolean;
    autoApprove?: boolean;
  }): Review {
    if (!isValidRating(params.rating)) {
      throw new Error('Invalid rating value');
    }

    const id = createReviewId();
    const now = new Date();
    const status: CommentStatus = params.autoApprove ? 'approved' : 'pending';
    const sentiment = this.analyzeSentiment(params.content);

    const review: Review = {
      id,
      content: params.content,
      authorId: params.authorId,
      targetId: params.targetId,
      targetType: params.targetType,
      rating: params.rating,
      title: params.title,
      pros: params.pros,
      cons: params.cons,
      images: params.images,
      status,
      reactions: getDefaultReactions(),
      helpfulCount: 0,
      unhelpfulCount: 0,
      verified: params.verified || false,
      sentiment,
      isEdited: false,
      createdAt: now,
      updatedAt: now,
    };

    this.reviews.set(id, review);
    this.incrementUserActivity(params.authorId, 'reviews');

    return review;
  }

  updateReview(
    reviewId: string,
    updates: {
      content?: string;
      rating?: ReviewRating;
      title?: string;
      pros?: string[];
      cons?: string[];
    },
    _userId: string
  ): Review | null {
    const review = this.reviews.get(reviewId);
    if (!review) return null;

    if (updates.rating !== undefined && !isValidRating(updates.rating)) {
      throw new Error('Invalid rating value');
    }

    if (updates.content) {
      review.sentiment = this.analyzeSentiment(updates.content);
    }

    Object.assign(review, updates);
    review.isEdited = true;
    review.updatedAt = new Date();

    return review;
  }

  deleteReview(reviewId: string, _userId: string): boolean {
    const review = this.reviews.get(reviewId);
    if (!review) return false;

    review.deletedAt = new Date();
    review.content = '[deleted]';
    review.status = 'rejected';

    return true;
  }

  getReview(reviewId: string): Review | undefined {
    return this.reviews.get(reviewId);
  }

  getReviewsByTarget(targetId: string, options?: {
    status?: CommentStatus;
    rating?: ReviewRating;
    page?: number;
    pageSize?: number;
    sortBy?: 'createdAt' | 'rating' | 'helpful';
    sortOrder?: 'asc' | 'desc';
  }): PaginatedReviews {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const sortBy = options?.sortBy || 'createdAt';
    const sortOrder = options?.sortOrder || 'desc';

    let reviews = Array.from(this.reviews.values())
      .filter(r => r.targetId === targetId && !r.deletedAt);

    if (options?.status) {
      reviews = reviews.filter(r => r.status === options.status);
    }

    if (options?.rating) {
      reviews = reviews.filter(r => r.rating === options.rating);
    }

    reviews.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'createdAt':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'rating':
          comparison = a.rating - b.rating;
          break;
        case 'helpful':
          comparison = a.helpfulCount - b.helpfulCount;
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    const total = reviews.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const paginatedReviews = reviews.slice(start, start + pageSize);

    return {
      reviews: paginatedReviews,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  getReviewSummary(targetId: string, targetType: Review['targetType']): ReviewSummary {
    const reviews = Array.from(this.reviews.values())
      .filter(r => r.targetId === targetId && r.targetType === targetType && !r.deletedAt && r.status === 'approved');

    const distribution: RatingDistribution = getDefaultRatingDistribution();
    const ratings: ReviewRating[] = [];

    for (const review of reviews) {
      ratings.push(review.rating);
      distribution[review.rating]++;
    }

    const recentReviews = [...reviews]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);

    return {
      targetId,
      targetType,
      averageRating: calculateAverageRating(ratings),
      totalReviews: reviews.length,
      distribution,
      recentReviews,
    };
  }

  createResponse(params: {
    reviewId: string;
    content: string;
    authorId: string;
  }): ReviewResponse | null {
    const review = this.reviews.get(params.reviewId);
    if (!review) return null;

    const id = createResponseId();
    const now = new Date();

    const response: ReviewResponse = {
      id,
      reviewId: params.reviewId,
      content: params.content,
      authorId: params.authorId,
      status: 'pending',
      isEdited: false,
      createdAt: now,
      updatedAt: now,
    };

    this.responses.set(id, response);

    this.createNotification({
      type: 'review_response',
      recipientId: review.authorId,
      senderId: params.authorId,
      targetType: 'review',
      targetId: params.reviewId,
      message: 'Someone responded to your review',
    });

    return response;
  }

  getResponsesByReview(reviewId: string): ReviewResponse[] {
    return Array.from(this.responses.values())
      .filter(r => r.reviewId === reviewId && !r.deletedAt)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  getReviewWithResponses(reviewId: string): ReviewWithResponses | null {
    const review = this.reviews.get(reviewId);
    if (!review) return null;

    const responses = this.getResponsesByReview(reviewId);
    const summary = this.getReviewSummary(review.targetId, review.targetType);

    return {
      review,
      responses,
      averageRating: summary.averageRating,
      totalReviews: summary.totalReviews,
    };
  }

  markHelpful(reviewId: string, _userId: string): boolean {
    const review = this.reviews.get(reviewId);
    if (!review) return false;

    review.helpfulCount++;
    return true;
  }

  markUnhelpful(reviewId: string, _userId: string): boolean {
    const review = this.reviews.get(reviewId);
    if (!review) return false;

    review.unhelpfulCount++;
    return true;
  }

  createReport(params: {
    targetType: Report['targetType'];
    targetId: string;
    reporterId: string;
    reason: ReportReason;
    description?: string;
  }): Report {
    const id = createReportId();
    const now = new Date();

    const report: Report = {
      id,
      targetType: params.targetType,
      targetId: params.targetId,
      reporterId: params.reporterId,
      reason: params.reason,
      description: params.description,
      status: 'pending',
      createdAt: now,
    };

    this.reports.set(id, report);

    return report;
  }

  getReport(reportId: string): Report | undefined {
    return this.reports.get(reportId);
  }

  getReportsByTarget(targetId: string): Report[] {
    return Array.from(this.reports.values())
      .filter(r => r.targetId === targetId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getPendingReports(): Report[] {
    return Array.from(this.reports.values())
      .filter(r => r.status === 'pending')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  resolveReport(reportId: string, moderatorId: string, resolution: string): Report | null {
    const report = this.reports.get(reportId);
    if (!report) return null;

    report.status = 'resolved';
    report.moderatorId = moderatorId;
    report.resolution = resolution;
    report.reviewedAt = new Date();

    return report;
  }

  dismissReport(reportId: string, moderatorId: string, reason: string): Report | null {
    const report = this.reports.get(reportId);
    if (!report) return null;

    report.status = 'dismissed';
    report.moderatorId = moderatorId;
    report.resolution = reason;
    report.reviewedAt = new Date();

    return report;
  }

  moderateContent(
    moderatorId: string,
    targetType: 'comment' | 'review' | 'response',
    targetId: string,
    action: ModerationAction['action'],
    reason?: string
  ): ModerationAction | null {
    let content: Comment | Review | ReviewResponse | undefined;

    if (targetType === 'comment') {
      content = this.comments.get(targetId);
    } else if (targetType === 'review') {
      content = this.reviews.get(targetId);
    } else {
      content = this.responses.get(targetId);
    }

    if (!content) return null;

    const id = createModerationId();
    const now = new Date();

    const moderationAction: ModerationAction = {
      id,
      moderatorId,
      targetType,
      targetId,
      action,
      reason,
      createdAt: now,
    };

    this.moderationActions.set(id, moderationAction);

    if (targetType === 'comment') {
      const comment = content as Comment;
      if (action === 'approve') {
        comment.status = 'approved';
      } else if (action === 'reject' || action === 'delete') {
        comment.status = 'rejected';
      } else if (action === 'flag') {
        comment.status = 'flagged';
      }
      comment.updatedAt = now;
    } else if (targetType === 'review') {
      const review = content as Review;
      if (action === 'approve') {
        review.status = 'approved';
      } else if (action === 'reject' || action === 'delete') {
        review.status = 'rejected';
      } else if (action === 'flag') {
        review.status = 'flagged';
      }
      review.updatedAt = now;
    } else {
      const response = content as ReviewResponse;
      if (action === 'approve') {
        response.status = 'approved';
      } else if (action === 'reject' || action === 'delete') {
        response.status = 'rejected';
      } else if (action === 'flag') {
        response.status = 'flagged';
      }
      response.updatedAt = now;
    }

    if (action === 'flag' && content.authorId) {
      this.createNotification({
        type: 'moderation_action',
        recipientId: content.authorId,
        moderatorId,
        targetType,
        targetId,
        message: `Your content has been flagged: ${reason || 'No reason provided'}`,
      });
    }

    return moderationAction;
  }

  getModerationHistory(targetType: 'comment' | 'review' | 'response', targetId: string): ModerationAction[] {
    return Array.from(this.moderationActions.values())
      .filter(m => m.targetType === targetType && m.targetId === targetId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getRecentModerationActions(limit: number = 50): ModerationAction[] {
    return Array.from(this.moderationActions.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  analyzeSentiment(text: string): SentimentScore {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'best', 'awesome', 'nice', 'helpful', 'perfect', 'beautiful', 'outstanding'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'poor', 'disappointing', 'useless', 'boring', 'annoying', 'ugly', 'fail', 'broken'];

    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of words) {
      if (positiveWords.some(pw => word.includes(pw))) positiveCount++;
      if (negativeWords.some(nw => word.includes(nw))) negativeCount++;
    }

    const total = words.length || 1;
    const positive = positiveCount / total;
    const negative = negativeCount / total;
    const neutral = Math.max(0, 1 - positive - negative);

    let label: SentimentScore['label'] = 'neutral';
    if (positiveCount > negativeCount && positiveCount > 0) {
      label = 'positive';
    } else if (negativeCount > positiveCount && negativeCount > 0) {
      label = 'negative';
    }

    const confidence = Math.max(positive, negative, neutral);

    return {
      label,
      confidence,
      positive,
      negative,
      neutral,
    };
  }

  analyzeTextSentiment(text: string): SentimentAnalysisResult {
    const sentiment = this.analyzeSentiment(text);
    
    const hashtagRegex = /#[a-zA-Z0-9_]+/g;
    const mentionRegex = /@[a-zA-Z0-9_]+/g;
    
    const hashtags = (text.match(hashtagRegex) || []).map(h => h.slice(1));
    const mentions = (text.match(mentionRegex) || []).map(m => m.slice(1));
    const entities: string[] = [...hashtags, ...mentions];

    return {
      text,
      sentiment,
      keywords: this.extractKeywords(text),
      entities,
      language: 'en',
      analyzedAt: new Date(),
    };
  }

  private extractKeywords(text: string): string[] {
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'];
    
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.includes(w));
    
    const frequency: Map<string, number> = new Map();
    for (const word of words) {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    }
    
    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  private createNotification(payload: Omit<NotificationPayload, 'id' | 'isRead' | 'createdAt'>): void {
    const id = createNotificationId();
    this.notifications.set(id, {
      ...payload,
      isRead: false,
      createdAt: new Date(),
    } as NotificationPayload);
  }

  getUserNotifications(userId: string): NotificationPayload[] {
    return Array.from(this.notifications.values())
      .filter(n => n.recipientId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  markNotificationAsRead(notificationId: string): boolean {
    const notification = this.notifications.get(notificationId);
    if (!notification) return false;
    
    notification.isRead = true;
    return true;
  }

  getUserActivity(userId: string): {
    totalComments: number;
    totalReviews: number;
    totalReactions: number;
  } {
    return this.userActivities.get(userId) || { totalComments: 0, totalReviews: 0, totalReactions: 0 };
  }

  private incrementUserActivity(userId: string, type: 'comments' | 'reviews' | 'reactions'): void {
    const activity = this.userActivities.get(userId) || { totalComments: 0, totalReviews: 0, totalReactions: 0 };
    if (type === 'comments') activity.totalComments++;
    else if (type === 'reviews') activity.totalReviews++;
    else if (type === 'reactions') activity.totalReactions++;
    this.userActivities.set(userId, activity);
  }

  searchComments(query: string, options?: {
    targetId?: string;
    status?: CommentStatus;
    page?: number;
    pageSize?: number;
  }): PaginatedComments {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const lowerQuery = query.toLowerCase();

    let comments = Array.from(this.comments.values())
      .filter(c => !c.deletedAt && c.content.toLowerCase().includes(lowerQuery));

    if (options?.targetId) {
      comments = comments.filter(c => c.targetId === options.targetId);
    }

    if (options?.status) {
      comments = comments.filter(c => c.status === options.status);
    }

    comments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = comments.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const paginatedComments = comments.slice(start, start + pageSize);

    return {
      comments: paginatedComments,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  searchReviews(query: string, options?: {
    targetId?: string;
    status?: CommentStatus;
    rating?: ReviewRating;
    page?: number;
    pageSize?: number;
  }): PaginatedReviews {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const lowerQuery = query.toLowerCase();

    let reviews = Array.from(this.reviews.values())
      .filter(r => !r.deletedAt && r.content.toLowerCase().includes(lowerQuery));

    if (options?.targetId) {
      reviews = reviews.filter(r => r.targetId === options.targetId);
    }

    if (options?.status) {
      reviews = reviews.filter(r => r.status === options.status);
    }

    if (options?.rating) {
      reviews = reviews.filter(r => r.rating === options.rating);
    }

    reviews.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = reviews.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const paginatedReviews = reviews.slice(start, start + pageSize);

    return {
      reviews: paginatedReviews,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  getContentStats(targetId: string): {
    totalComments: number;
    totalReviews: number;
    averageRating: number;
    totalReactions: number;
  } {
    const comments = Array.from(this.comments.values())
      .filter(c => c.targetId === targetId && !c.deletedAt && c.status === 'approved');
    
    const reviews = Array.from(this.reviews.values())
      .filter(r => r.targetId === targetId && !r.deletedAt && r.status === 'approved');

    const totalReactions = [...comments, ...reviews].reduce((sum, item) => {
      return sum + Array.from(item.reactions.values()).reduce((rSum, r) => rSum + r.count, 0);
    }, 0);

    const ratings = reviews.map(r => r.rating);
    const avgRating = calculateAverageRating(ratings);

    return {
      totalComments: comments.length,
      totalReviews: reviews.length,
      averageRating: avgRating,
      totalReactions,
    };
  }

  clear(): void {
    this.comments.clear();
    this.reviews.clear();
    this.responses.clear();
    this.reports.clear();
    this.moderationActions.clear();
    this.notifications.clear();
    this.userActivities.clear();
  }
}

export const createCommentsReviewsEngine = (): CommentsReviewsEngine => {
  return new CommentsReviewsEngine();
};

export default CommentsReviewsEngine;

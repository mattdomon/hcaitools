import {
  CommentsReviewsEngine,
  createCommentsReviewsEngine,
  CommentStatus,
  ReviewRating,
  ReactionType,
  ReportReason,
  isValidRating,
  isValidReactionType,
  isValidCommentStatus,
  isSentimentScore,
  calculateAverageRating,
  getDefaultRatingDistribution,
  createCommentId,
  createReviewId,
  createResponseId,
  createReportId,
  createModerationId,
  createNotificationId,
} from '../src/core/commentsReviews';

describe('CommentsReviewsEngine', () => {
  let engine: CommentsReviewsEngine;

  beforeEach(() => {
    engine = createCommentsReviewsEngine();
  });

  describe('Comment Creation and Retrieval', () => {
    test('should create a comment with pending status by default', () => {
      const comment = engine.createComment({
        content: 'This is a test comment',
        authorId: 'user_123',
        targetId: 'post_456',
        targetType: 'post',
      });

      expect(comment.id).toMatch(/^cmt_[a-f0-9]{16}$/);
      expect(comment.content).toBe('This is a test comment');
      expect(comment.authorId).toBe('user_123');
      expect(comment.targetId).toBe('post_456');
      expect(comment.status).toBe('pending');
      expect(comment.replyCount).toBe(0);
    });

    test('should create a comment with approved status when autoApprove is true', () => {
      const comment = engine.createComment({
        content: 'Approved comment',
        authorId: 'user_123',
        targetId: 'post_456',
        targetType: 'post',
        autoApprove: true,
      });

      expect(comment.status).toBe('approved');
    });

    test('should create a reply comment with parentId and rootId', () => {
      const parent = engine.createComment({
        content: 'Parent comment',
        authorId: 'user_123',
        targetId: 'post_456',
        targetType: 'post',
        autoApprove: true,
      });

      const reply = engine.createComment({
        content: 'Reply comment',
        authorId: 'user_789',
        targetId: 'post_456',
        targetType: 'post',
        parentId: parent.id,
      });

      expect(reply.parentId).toBe(parent.id);
      expect(reply.rootId).toBe(parent.id);
      expect(parent.replyCount).toBe(1);
    });

    test('should retrieve comment by id', () => {
      const created = engine.createComment({
        content: 'Test comment',
        authorId: 'user_123',
        targetId: 'post_456',
        targetType: 'post',
      });

      const retrieved = engine.getComment(created.id);
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.content).toBe('Test comment');
    });

    test('should return undefined for non-existent comment', () => {
      const comment = engine.getComment('cmt_nonexistent');
      expect(comment).toBeUndefined();
    });

    test('should update comment content and mark as edited', () => {
      const comment = engine.createComment({
        content: 'Original content',
        authorId: 'user_123',
        targetId: 'post_456',
        targetType: 'post',
        autoApprove: true,
      });

      const updated = engine.updateComment(comment.id, 'Updated content', 'user_123');
      expect(updated?.content).toBe('Updated content');
      expect(updated?.isEdited).toBe(true);
    });

    test('should delete comment and set deletedAt timestamp', () => {
      const comment = engine.createComment({
        content: 'To be deleted',
        authorId: 'user_123',
        targetId: 'post_456',
        targetType: 'post',
        autoApprove: true,
      });

      const result = engine.deleteComment(comment.id, 'user_123');
      expect(result).toBe(true);
      expect(engine.getComment(comment.id)?.deletedAt).toBeDefined();
    });
  });

  describe('Comment Threading', () => {
    test('should get comment thread with replies', () => {
      const root = engine.createComment({
        content: 'Root comment',
        authorId: 'user_123',
        targetId: 'post_456',
        targetType: 'post',
        autoApprove: true,
      });

      engine.createComment({
        content: 'Reply 1',
        authorId: 'user_789',
        targetId: 'post_456',
        targetType: 'post',
        parentId: root.id,
        autoApprove: true,
      });

      engine.createComment({
        content: 'Reply 2',
        authorId: 'user_abc',
        targetId: 'post_456',
        targetType: 'post',
        parentId: root.id,
        autoApprove: true,
      });

      const thread = engine.getCommentThread(root.id);
      expect(thread).not.toBeNull();
      expect(thread?.rootComment.id).toBe(root.id);
      expect(thread?.totalReplies).toBe(2);
    });

    test('should return null for non-existent root comment', () => {
      const thread = engine.getCommentThread('cmt_nonexistent');
      expect(thread).toBeNull();
    });

    test('should paginate thread replies', () => {
      const root = engine.createComment({
        content: 'Root comment',
        authorId: 'user_123',
        targetId: 'post_456',
        targetType: 'post',
        autoApprove: true,
      });

      for (let i = 0; i < 15; i++) {
        engine.createComment({
          content: `Reply ${i}`,
          authorId: `user_${i}`,
          targetId: 'post_456',
          targetType: 'post',
          parentId: root.id,
          autoApprove: true,
        });
      }

      const thread = engine.getCommentThread(root.id, { page: 1, pageSize: 5 });
      expect(thread?.replies.length).toBe(5);
      expect(thread?.hasMore).toBe(true);
      expect(thread?.totalReplies).toBe(15);
    });
  });

  describe('Reactions', () => {
    test('should add reaction to comment', () => {
      const comment = engine.createComment({
        content: 'Test comment',
        authorId: 'user_123',
        targetId: 'post_456',
        targetType: 'post',
        autoApprove: true,
      });

      const result = engine.addReaction('comment', comment.id, 'user_789', 'like');
      expect(result).toBe(true);

      const updated = engine.getComment(comment.id);
      const likeReaction = updated?.reactions.get('like');
      expect(likeReaction?.count).toBe(1);
      expect(likeReaction?.userIds).toContain('user_789');
    });

    test('should remove reaction from comment', () => {
      const comment = engine.createComment({
        content: 'Test comment',
        authorId: 'user_123',
        targetId: 'post_456',
        targetType: 'post',
        autoApprove: true,
      });

      engine.addReaction('comment', comment.id, 'user_789', 'like');
      const result = engine.removeReaction('comment', comment.id, 'user_789');
      expect(result).toBe(true);

      const updated = engine.getComment(comment.id);
      const likeReaction = updated?.reactions.get('like');
      expect(likeReaction?.count).toBe(0);
    });

    test('should add reaction to review', () => {
      const review = engine.createReview({
        content: 'Great product!',
        authorId: 'user_123',
        targetId: 'product_456',
        targetType: 'product',
        rating: 5,
      });

      const result = engine.addReaction('review', review.id, 'user_789', 'love');
      expect(result).toBe(true);
    });

    test('should return false for invalid reaction type', () => {
      const comment = engine.createComment({
        content: 'Test comment',
        authorId: 'user_123',
        targetId: 'post_456',
        targetType: 'post',
        autoApprove: true,
      });

      const result = engine.addReaction('comment', comment.id, 'user_789', 'invalid' as ReactionType);
      expect(result).toBe(false);
    });
  });

  describe('Reviews', () => {
    test('should create a review with pending status by default', () => {
      const review = engine.createReview({
        content: 'This is a great product',
        authorId: 'user_123',
        targetId: 'product_456',
        targetType: 'product',
        rating: 5,
      });

      expect(review.id).toMatch(/^rev_[a-f0-9]{16}$/);
      expect(review.rating).toBe(5);
      expect(review.status).toBe('pending');
      expect(review.helpfulCount).toBe(0);
      expect(review.unhelpfulCount).toBe(0);
    });

    test('should create review with all optional fields', () => {
      const review = engine.createReview({
        content: 'Detailed review',
        authorId: 'user_123',
        targetId: 'product_456',
        targetType: 'product',
        rating: 4,
        title: 'Good product',
        pros: ['Great quality', 'Fast shipping'],
        cons: ['Slightly expensive'],
        images: ['image1.jpg', 'image2.jpg'],
        verified: true,
      });

      expect(review.title).toBe('Good product');
      expect(review.pros).toEqual(['Great quality', 'Fast shipping']);
      expect(review.cons).toEqual(['Slightly expensive']);
      expect(review.images).toEqual(['image1.jpg', 'image2.jpg']);
      expect(review.verified).toBe(true);
    });

    test('should throw error for invalid rating', () => {
      expect(() => {
        engine.createReview({
          content: 'Invalid rating',
          authorId: 'user_123',
          targetId: 'product_456',
          targetType: 'product',
          rating: 6 as ReviewRating,
        });
      }).toThrow('Invalid rating value');
    });

    test('should update review', () => {
      const review = engine.createReview({
        content: 'Original review',
        authorId: 'user_123',
        targetId: 'product_456',
        targetType: 'product',
        rating: 3,
      });

      const updated = engine.updateReview(review.id, {
        content: 'Updated review',
        rating: 4,
      }, 'user_123');

      expect(updated?.content).toBe('Updated review');
      expect(updated?.rating).toBe(4);
      expect(updated?.isEdited).toBe(true);
    });

    test('should mark review as helpful', () => {
      const review = engine.createReview({
        content: 'Helpful review',
        authorId: 'user_123',
        targetId: 'product_456',
        targetType: 'product',
        rating: 5,
      });

      engine.markHelpful(review.id, 'user_789');
      const updated = engine.getReview(review.id);
      expect(updated?.helpfulCount).toBe(1);
    });

    test('should mark review as unhelpful', () => {
      const review = engine.createReview({
        content: 'Unhelpful review',
        authorId: 'user_123',
        targetId: 'product_456',
        targetType: 'product',
        rating: 1,
      });

      engine.markUnhelpful(review.id, 'user_789');
      const updated = engine.getReview(review.id);
      expect(updated?.unhelpfulCount).toBe(1);
    });

    test('should get review summary with distribution', () => {
      for (let i = 0; i < 3; i++) {
        engine.createReview({
          content: `Review ${i}`,
          authorId: `user_${i}`,
          targetId: 'product_456',
          targetType: 'product',
          rating: 5,
          autoApprove: true,
        });
      }

      for (let i = 3; i < 5; i++) {
        engine.createReview({
          content: `Review ${i}`,
          authorId: `user_${i}`,
          targetId: 'product_456',
          targetType: 'product',
          rating: 4,
          autoApprove: true,
        });
      }

      const summary = engine.getReviewSummary('product_456', 'product');
      expect(summary.averageRating).toBe(4.6);
      expect(summary.totalReviews).toBe(5);
      expect(summary.distribution[5]).toBe(3);
      expect(summary.distribution[4]).toBe(2);
    });
  });

  describe('Review Responses', () => {
    test('should create response to review', () => {
      const review = engine.createReview({
        content: 'Great product',
        authorId: 'user_123',
        targetId: 'product_456',
        targetType: 'product',
        rating: 5,
      });

      const response = engine.createResponse({
        reviewId: review.id,
        content: 'Thank you!',
        authorId: 'vendor_789',
      });

      expect(response).not.toBeNull();
      expect(response?.reviewId).toBe(review.id);
      expect(response?.status).toBe('pending');
    });

    test('should get responses by review', () => {
      const review = engine.createReview({
        content: 'Great product',
        authorId: 'user_123',
        targetId: 'product_456',
        targetType: 'product',
        rating: 5,
      });

      engine.createResponse({
        reviewId: review.id,
        content: 'Response 1',
        authorId: 'vendor_789',
      });

      engine.createResponse({
        reviewId: review.id,
        content: 'Response 2',
        authorId: 'vendor_abc',
      });

      const responses = engine.getResponsesByReview(review.id);
      expect(responses.length).toBe(2);
    });

    test('should get review with responses', () => {
      const review = engine.createReview({
        content: 'Great product',
        authorId: 'user_123',
        targetId: 'product_456',
        targetType: 'product',
        rating: 5,
        autoApprove: true,
      });

      engine.createResponse({
        reviewId: review.id,
        content: 'Thank you!',
        authorId: 'vendor_789',
      });

      const reviewWithResponses = engine.getReviewWithResponses(review.id);
      expect(reviewWithResponses?.review.id).toBe(review.id);
      expect(reviewWithResponses?.responses.length).toBe(1);
    });
  });

  describe('Reports and Moderation', () => {
    test('should create a report', () => {
      const comment = engine.createComment({
        content: 'Inappropriate content',
        authorId: 'user_123',
        targetId: 'post_456',
        targetType: 'post',
        autoApprove: true,
      });

      const report = engine.createReport({
        targetType: 'comment',
        targetId: comment.id,
        reporterId: 'user_789',
        reason: 'inappropriate',
        description: 'This comment contains inappropriate language',
      });

      expect(report.id).toMatch(/^rpt_[a-f0-9]{16}$/);
      expect(report.status).toBe('pending');
    });

    test('should get pending reports', () => {
      const comment = engine.createComment({
        content: 'Spam',
        authorId: 'user_123',
        targetId: 'post_456',
        targetType: 'post',
        autoApprove: true,
      });

      engine.createReport({
        targetType: 'comment',
        targetId: comment.id,
        reporterId: 'user_789',
        reason: 'spam',
      });

      const pendingReports = engine.getPendingReports();
      expect(pendingReports.length).toBe(1);
    });

    test('should resolve a report', () => {
      const comment = engine.createComment({
        content: 'Spam content',
        authorId: 'user_123',
        targetId: 'post_456',
        targetType: 'post',
        autoApprove: true,
      });

      const report = engine.createReport({
        targetType: 'comment',
        targetId: comment.id,
        reporterId: 'user_789',
        reason: 'spam',
      });

      const resolved = engine.resolveReport(report.id, 'mod_001', 'Removed spam content');
      expect(resolved?.status).toBe('resolved');
      expect(resolved?.moderatorId).toBe('mod_001');
    });

    test('should moderate content - approve', () => {
      const comment = engine.createComment({
        content: 'Pending comment',
        authorId: 'user_123',
        targetId: 'post_456',
        targetType: 'post',
      });

      const action = engine.moderateContent('mod_001', 'comment', comment.id, 'approve');
      expect(action?.action).toBe('approve');

      const updated = engine.getComment(comment.id);
      expect(updated?.status).toBe('approved');
    });

    test('should moderate content - reject', () => {
      const comment = engine.createComment({
        content: 'Rejected comment',
        authorId: 'user_123',
        targetId: 'post_456',
        targetType: 'post',
        autoApprove: true,
      });

      const action = engine.moderateContent('mod_001', 'comment', comment.id, 'reject', 'Violates community guidelines');
      expect(action?.action).toBe('reject');

      const updated = engine.getComment(comment.id);
      expect(updated?.status).toBe('rejected');
    });

    test('should get moderation history', () => {
      const comment = engine.createComment({
        content: 'Moderated comment',
        authorId: 'user_123',
        targetId: 'post_456',
        targetType: 'post',
      });

      engine.moderateContent('mod_001', 'comment', comment.id, 'approve');
      engine.moderateContent('mod_002', 'comment', comment.id, 'flag', 'Needs review');

      const history = engine.getModerationHistory('comment', comment.id);
      expect(history.length).toBe(2);
    });
  });

  describe('Sentiment Analysis', () => {
    test('should analyze positive sentiment', () => {
      const comment = engine.createComment({
        content: 'This is an amazing and wonderful product! I love it so much!',
        authorId: 'user_123',
        targetId: 'product_456',
        targetType: 'product',
      });

      expect(comment.sentiment?.label).toBe('positive');
      if (comment.sentiment) {
        expect(comment.sentiment.positive).toBeGreaterThan(comment.sentiment.negative);
      }
    });

    test('should analyze negative sentiment', () => {
      const comment = engine.createComment({
        content: 'This is terrible and awful. I hate this horrible product!',
        authorId: 'user_123',
        targetId: 'product_456',
        targetType: 'product',
      });

      expect(comment.sentiment?.label).toBe('negative');
      if (comment.sentiment) {
        expect(comment.sentiment.negative).toBeGreaterThan(comment.sentiment.positive);
      }
    });

    test('should analyze neutral sentiment', () => {
      const comment = engine.createComment({
        content: 'The product arrived today.',
        authorId: 'user_123',
        targetId: 'product_456',
        targetType: 'product',
      });

      expect(comment.sentiment?.label).toBe('neutral');
    });

    test('should analyze text sentiment with keywords and entities', () => {
      const result = engine.analyzeTextSentiment('Check out #newproduct and follow @username for updates!');

      expect(result.sentiment).toBeDefined();
      expect(result.entities).toContain('newproduct');
      expect(result.entities).toContain('username');
    });
  });

  describe('Search', () => {
    test('should search comments by content', () => {
      engine.createComment({
        content: 'JavaScript is great for web development',
        authorId: 'user_123',
        targetId: 'post_456',
        targetType: 'post',
        autoApprove: true,
      });

      engine.createComment({
        content: 'Python is also a great language',
        authorId: 'user_789',
        targetId: 'post_456',
        targetType: 'post',
        autoApprove: true,
      });

      const results = engine.searchComments('JavaScript');
      expect(results.comments.length).toBe(1);
      expect(results.comments[0].content).toContain('JavaScript');
    });

    test('should search reviews by content', () => {
      engine.createReview({
        content: 'Excellent camera quality',
        authorId: 'user_123',
        targetId: 'camera_001',
        targetType: 'product',
        rating: 5,
        autoApprove: true,
      });

      engine.createReview({
        content: 'Battery life is poor',
        authorId: 'user_789',
        targetId: 'camera_001',
        targetType: 'product',
        rating: 2,
        autoApprove: true,
      });

      const results = engine.searchReviews('camera');
      expect(results.reviews.length).toBe(1);
    });
  });

  describe('Pagination', () => {
    test('should paginate comments', () => {
      for (let i = 0; i < 25; i++) {
        engine.createComment({
          content: `Comment ${i}`,
          authorId: `user_${i}`,
          targetId: 'post_456',
          targetType: 'post',
          autoApprove: true,
        });
      }

      const page1 = engine.getCommentsByTarget('post_456', { page: 1, pageSize: 10 });
      expect(page1.comments.length).toBe(10);
      expect(page1.total).toBe(25);
      expect(page1.totalPages).toBe(3);
      expect(page1.page).toBe(1);

      const page2 = engine.getCommentsByTarget('post_456', { page: 2, pageSize: 10 });
      expect(page2.comments.length).toBe(10);
      expect(page2.page).toBe(2);
    });

    test('should paginate reviews', () => {
      for (let i = 0; i < 15; i++) {
        engine.createReview({
          content: `Review ${i}`,
          authorId: `user_${i}`,
          targetId: 'product_456',
          targetType: 'product',
          rating: ((i % 5) + 1) as ReviewRating,
          autoApprove: true,
        });
      }

      const page1 = engine.getReviewsByTarget('product_456', { page: 1, pageSize: 5 });
      expect(page1.reviews.length).toBe(5);
      expect(page1.total).toBe(15);
      expect(page1.totalPages).toBe(3);
    });
  });

  describe('Content Stats', () => {
    test('should get content stats', () => {
      for (let i = 0; i < 3; i++) {
        engine.createComment({
          content: `Comment ${i}`,
          authorId: `user_${i}`,
          targetId: 'post_456',
          targetType: 'post',
          autoApprove: true,
        });
      }

      for (let i = 0; i < 2; i++) {
        engine.createReview({
          content: `Review ${i}`,
          authorId: `user_${i}`,
          targetId: 'product_456',
          targetType: 'product',
          rating: 5,
          autoApprove: true,
        });
      }

      const commentStats = engine.getContentStats('post_456');
      expect(commentStats.totalComments).toBe(3);

      const reviewStats = engine.getContentStats('product_456');
      expect(reviewStats.totalReviews).toBe(2);
    });
  });

  describe('User Activity', () => {
    test('should track user activity', () => {
      engine.createComment({
        content: 'Comment 1',
        authorId: 'user_123',
        targetId: 'post_456',
        targetType: 'post',
        autoApprove: true,
      });

      engine.createReview({
        content: 'Review 1',
        authorId: 'user_123',
        targetId: 'product_456',
        targetType: 'product',
        rating: 5,
        autoApprove: true,
      });

      const activity = engine.getUserActivity('user_123');
      expect(activity.totalComments).toBe(1);
      expect(activity.totalReviews).toBe(1);
    });
  });

  describe('Type Guards and Utilities', () => {
    test('isValidRating should validate ratings correctly', () => {
      expect(isValidRating(1)).toBe(true);
      expect(isValidRating(5)).toBe(true);
      expect(isValidRating(0)).toBe(false);
      expect(isValidRating(6)).toBe(false);
      expect(isValidRating(1.5)).toBe(false);
      expect(isValidRating('5')).toBe(false);
    });

    test('isValidReactionType should validate reaction types correctly', () => {
      expect(isValidReactionType('like')).toBe(true);
      expect(isValidReactionType('love')).toBe(true);
      expect(isValidReactionType('angry')).toBe(true);
      expect(isValidReactionType('invalid')).toBe(false);
      expect(isValidReactionType(123)).toBe(false);
    });

    test('isValidCommentStatus should validate statuses correctly', () => {
      expect(isValidCommentStatus('pending')).toBe(true);
      expect(isValidCommentStatus('approved')).toBe(true);
      expect(isValidCommentStatus('rejected')).toBe(true);
      expect(isValidCommentStatus('flagged')).toBe(true);
      expect(isValidCommentStatus('invalid')).toBe(false);
    });

    test('calculateAverageRating should compute correctly', () => {
      expect(calculateAverageRating([5, 4, 3])).toBe(4);
      expect(calculateAverageRating([5, 5])).toBe(5);
      expect(calculateAverageRating([1, 2, 3, 4, 5])).toBe(3);
      expect(calculateAverageRating([])).toBe(0);
    });

    test('getDefaultRatingDistribution should return correct structure', () => {
      const dist = getDefaultRatingDistribution();
      expect(dist[1]).toBe(0);
      expect(dist[2]).toBe(0);
      expect(dist[3]).toBe(0);
      expect(dist[4]).toBe(0);
      expect(dist[5]).toBe(0);
    });

    test('ID generation functions should produce valid IDs', () => {
      expect(createCommentId()).toMatch(/^cmt_[a-f0-9]{16}$/);
      expect(createReviewId()).toMatch(/^rev_[a-f0-9]{16}$/);
      expect(createResponseId()).toMatch(/^rsp_[a-f0-9]{16}$/);
      expect(createReportId()).toMatch(/^rpt_[a-f0-9]{16}$/);
      expect(createModerationId()).toMatch(/^mod_[a-f0-9]{16}$/);
      expect(createNotificationId()).toMatch(/^notif_[a-f0-9]{16}$/);
    });
  });

  describe('Clear and Reset', () => {
    test('should clear all data', () => {
      engine.createComment({
        content: 'Test',
        authorId: 'user_123',
        targetId: 'post_456',
        targetType: 'post',
      });

      engine.createReview({
        content: 'Test review',
        authorId: 'user_123',
        targetId: 'product_456',
        targetType: 'product',
        rating: 5,
      });

      engine.clear();

      expect(engine.getComment('any')).toBeUndefined();
      expect(engine.getReview('any')).toBeUndefined();
    });
  });
});

describe('Sentiment Analysis', () => {
  let engine: CommentsReviewsEngine;

  beforeEach(() => {
    engine = createCommentsReviewsEngine();
  });

  test('should update sentiment when comment is updated', () => {
    const comment = engine.createComment({
      content: 'This is okay',
      authorId: 'user_123',
      targetId: 'post_456',
      targetType: 'post',
      autoApprove: true,
    });

    expect(comment.sentiment?.label).toBe('neutral');

    const updated = engine.updateComment(comment.id, 'This is absolutely amazing and wonderful!', 'user_123');
    expect(updated?.sentiment?.label).toBe('positive');
  });

  test('should update sentiment when review is updated', () => {
    const review = engine.createReview({
      content: 'Poor quality and disappointing experience',
      authorId: 'user_123',
      targetId: 'product_456',
      targetType: 'product',
      rating: 2,
    });

    expect(review.sentiment?.label).toBe('negative');

    const updated = engine.updateReview(review.id, { content: 'Absolutely terrible and horrible!' }, 'user_123');
    expect(updated?.sentiment?.label).toBe('negative');
  });
});

/**
 * Social Media Integration Tests
 */

import { SocialMediaServiceImpl } from '../src/core/socialMedia/socialMedia';
import { SocialMediaManus } from '../src/core/socialMedia';
import {
  SocialPlatform,
  PostType,
  PostStatus,
  CommentStatus,
  MediaType,
} from '../src/core/socialMedia/types';

describe('SocialMediaServiceImpl', () => {
  let service: SocialMediaServiceImpl;

  beforeEach(() => {
    service = new SocialMediaServiceImpl();
  });

  describe('Account Management', () => {
    test('should connect a social media account', async () => {
      const account = await service.connectAccount('user123', 'twitter', 'token123');

      expect(account.accountId).toBeDefined();
      expect(account.platform).toBe('twitter');
      expect(account.userId).toBe('user123');
      expect(account.isConnected).toBe(true);
      expect(account.username).toContain('user123');
    });

    test('should connect accounts on multiple platforms', async () => {
      const twitterAccount = await service.connectAccount('user123', 'twitter', 'token');
      const facebookAccount = await service.connectAccount('user123', 'facebook', 'token');
      const instagramAccount = await service.connectAccount('user123', 'instagram', 'token');

      expect(twitterAccount.platform).toBe('twitter');
      expect(facebookAccount.platform).toBe('facebook');
      expect(instagramAccount.platform).toBe('instagram');
    });

    test('should get connected accounts for user', async () => {
      await service.connectAccount('user123', 'twitter', 'token');
      await service.connectAccount('user123', 'linkedin', 'token');

      const accounts = await service.getConnectedAccounts('user123');

      expect(accounts.length).toBe(2);
    });

    test('should disconnect account', async () => {
      const account = await service.connectAccount('user123', 'twitter', 'token');
      await service.disconnectAccount(account.accountId);

      const accounts = await service.getConnectedAccounts('user123');

      expect(accounts[0].isConnected).toBe(false);
    });

    test('should refresh account and update expiration', async () => {
      const account = await service.connectAccount('user123', 'twitter', 'token');
      const originalExpiry = account.expiresAt;

      await new Promise((resolve) => setTimeout(resolve, 10));
      const refreshed = await service.refreshAccount(account.accountId);

      expect(refreshed.expiresAt).toBeDefined();
      expect(refreshed.expiresAt!.getTime()).toBeGreaterThanOrEqual(originalExpiry!.getTime());
    });

    test('should get account analytics', async () => {
      const account = await service.connectAccount('user123', 'twitter', 'token');
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

      const analytics = await service.getAccountAnalytics(account.accountId, { start, end });

      expect(analytics.accountId).toBe(account.accountId);
      expect(analytics.platform).toBe('twitter');
      expect(analytics.totalPosts).toBeDefined();
      expect(analytics.totalFollowers).toBeDefined();
      expect(analytics.period).toBeDefined();
    });
  });

  describe('Post Creation', () => {
    let account: Awaited<ReturnType<typeof service.connectAccount>>;

    beforeEach(async () => {
      account = await service.connectAccount('user123', 'twitter', 'token');
    });

    test('should create a text post', async () => {
      const post = await service.createPost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'Hello world!',
        postType: 'text',
        status: 'draft',
      });

      expect(post.postId).toBeDefined();
      expect(post.content).toBe('Hello world!');
      expect(post.postType).toBe('text');
      expect(post.status).toBe('draft');
    });

    test('should create a post with media', async () => {
      const media = [{
        mediaId: 'media1',
        type: 'image' as MediaType,
        url: 'https://example.com/image.jpg',
        width: 1920,
        height: 1080,
      }];

      const post = await service.createPost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'Check out this image!',
        postType: 'image',
        media,
        status: 'draft',
      });

      expect(post.media).toHaveLength(1);
      expect(post.media![0].url).toBe('https://example.com/image.jpg');
    });

    test('should create a post with link', async () => {
      const post = await service.createPost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'Check out this article',
        postType: 'link',
        link: {
          url: 'https://example.com/article',
          title: 'Example Article',
          description: 'An example article description',
        },
        status: 'draft',
      });

      expect(post.link).toBeDefined();
      expect(post.link!.url).toBe('https://example.com/article');
      expect(post.link!.title).toBe('Example Article');
    });

    test('should create a post with tags and mentions', async () => {
      const post = await service.createPost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'Hello @user456!',
        postType: 'text',
        tags: ['ai', 'tech'],
        mentions: ['user456'],
        status: 'draft',
      });

      expect(post.tags).toContain('ai');
      expect(post.tags).toContain('tech');
      expect(post.mentions).toContain('user456');
    });

    test('should create post with location', async () => {
      const post = await service.createPost(account.accountId, {
        platform: 'instagram',
        userId: 'user123',
        content: 'Check-in from the office!',
        postType: 'text',
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          placeName: 'San Francisco, CA',
        },
        status: 'draft',
      });

      expect(post.location).toBeDefined();
      expect(post.location!.latitude).toBe(37.7749);
      expect(post.location!.placeName).toBe('San Francisco, CA');
    });

    test('should throw error for non-existent account', async () => {
      await expect(
        service.createPost('nonexistent', {
          platform: 'twitter',
          userId: 'user123',
          content: 'Test',
          postType: 'text',
          status: 'draft',
        })
      ).rejects.toThrow('Account nonexistent not found');
    });
  });

  describe('Post Scheduling', () => {
    let account: Awaited<ReturnType<typeof service.connectAccount>>;

    beforeEach(async () => {
      account = await service.connectAccount('user123', 'twitter', 'token');
    });

    test('should schedule a post', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const post = await service.schedulePost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'Scheduled post',
        postType: 'text',
        status: 'scheduled',
        scheduledFor: futureDate,
      });

      expect(post.postId).toBeDefined();
      expect(post.scheduledFor).toEqual(futureDate);
      expect(post.status).toBe('scheduled');
    });

    test('should schedule a recurring post', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const post = await service.schedulePost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'Daily update',
        postType: 'text',
        status: 'scheduled',
        scheduledFor: futureDate,
        recurrence: {
          frequency: 'daily',
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      expect(post.recurrence).toBeDefined();
      expect(post.recurrence!.frequency).toBe('daily');
    });

    test('should get scheduled posts', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await service.schedulePost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'Post 1',
        postType: 'text',
        status: 'scheduled',
        scheduledFor: futureDate,
      });

      await service.schedulePost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'Post 2',
        postType: 'text',
        status: 'scheduled',
        scheduledFor: futureDate,
      });

      const scheduled = await service.getScheduledPosts(account.accountId);

      expect(scheduled.length).toBe(2);
    });

    test('should cancel scheduled post', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const post = await service.schedulePost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'To be cancelled',
        postType: 'text',
        status: 'scheduled',
        scheduledFor: futureDate,
      });

      await service.cancelScheduledPost(post.postId);

      const scheduled = await service.getScheduledPosts(account.accountId);
      expect(scheduled.find((p) => p.postId === post.postId)).toBeUndefined();
    });

    test('should reschedule a post', async () => {
      const originalDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const newDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const post = await service.schedulePost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'To be rescheduled',
        postType: 'text',
        status: 'scheduled',
        scheduledFor: originalDate,
      });

      await service.reschedulePost(post.postId, newDate);

      const updated = await service.getPost(post.postId);
      expect(updated!.scheduledFor).toEqual(newDate);
    });
  });

  describe('Post Publishing', () => {
    let account: Awaited<ReturnType<typeof service.connectAccount>>;

    beforeEach(async () => {
      account = await service.connectAccount('user123', 'twitter', 'token');
    });

    test('should publish a draft post', async () => {
      const post = await service.createPost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'Publishing soon',
        postType: 'text',
        status: 'draft',
      });

      const published = await service.publishPost(post.postId);

      expect(published.status).toBe('published');
      expect(published.publishedAt).toBeDefined();
    });

    test('should update a post', async () => {
      const post = await service.createPost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'Original content',
        postType: 'text',
        status: 'draft',
      });

      const updated = await service.updatePost(post.postId, {
        content: 'Updated content',
        tags: ['updated'],
      });

      expect(updated.content).toBe('Updated content');
      expect(updated.tags).toContain('updated');
    });

    test('should delete a post', async () => {
      const post = await service.createPost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'To be deleted',
        postType: 'text',
        status: 'draft',
      });

      await service.deletePost(post.postId);

      const retrieved = await service.getPost(post.postId);
      expect(retrieved).toBeNull();
    });

    test('should get posts with filters', async () => {
      await service.createPost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'Text post',
        postType: 'text',
        status: 'draft',
      });

      await service.createPost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'Image post',
        postType: 'image',
        status: 'draft',
      });

      const textPosts = await service.getAccountPosts(account.accountId, {
        postType: 'text',
      });

      expect(textPosts.every((p) => p.postType === 'text')).toBe(true);
    });

    test('should get posts with pagination', async () => {
      for (let i = 0; i < 10; i++) {
        await service.createPost(account.accountId, {
          platform: 'twitter',
          userId: 'user123',
          content: `Post ${i}`,
          postType: 'text',
          status: 'published',
          publishedAt: new Date(),
        });
      }

      const firstPage = await service.getAccountPosts(account.accountId, {
        limit: 3,
        offset: 0,
      });

      expect(firstPage.length).toBe(3);
    });
  });

  describe('Cross-Platform Posting', () => {
    beforeEach(async () => {
      await service.connectAccount('user123', 'twitter', 'token');
      await service.connectAccount('user123', 'facebook', 'token');
    });

    test('should create cross-platform post', async () => {
      const crossPost = await service.createCrossPlatformPost({
        userId: 'user123',
        content: 'Cross-platform content',
        postType: 'text',
        platforms: ['twitter', 'facebook'],
        status: 'draft',
        individualPostIds: [],
      });

      expect(crossPost.crossPostId).toBeDefined();
      expect(crossPost.platforms).toContain('twitter');
      expect(crossPost.platforms).toContain('facebook');
    });

    test('should publish to all platforms', async () => {
      const crossPost = await service.createCrossPlatformPost({
        userId: 'user123',
        content: 'Publishing everywhere!',
        postType: 'text',
        platforms: ['twitter', 'facebook'],
        status: 'draft',
        individualPostIds: [],
      });

      const published = await service.publishCrossPlatformPost(crossPost.crossPostId);

      expect(published.length).toBe(2);
      expect(published.some((p) => p.platform === 'twitter')).toBe(true);
      expect(published.some((p) => p.platform === 'facebook')).toBe(true);
    });

    test('should cancel cross-platform post', async () => {
      const crossPost = await service.createCrossPlatformPost({
        userId: 'user123',
        content: 'To cancel',
        postType: 'text',
        platforms: ['twitter', 'facebook'],
        status: 'draft',
        individualPostIds: [],
      });

      await service.cancelCrossPlatformPost(crossPost.crossPostId);

      const retrieved = await service.createCrossPlatformPost({
        userId: 'user123',
        content: 'Check',
        postType: 'text',
        platforms: ['twitter'],
        status: 'draft',
        individualPostIds: [],
      });
      expect(retrieved.crossPostId).not.toBe(crossPost.crossPostId);
    });
  });

  describe('Analytics', () => {
    let account: Awaited<ReturnType<typeof service.connectAccount>>;

    beforeEach(async () => {
      account = await service.connectAccount('user123', 'twitter', 'token');
      const post = await service.createPost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'Analytics test',
        postType: 'text',
        status: 'published',
        publishedAt: new Date(),
      });
      await service.publishPost(post.postId);
    });

    test('should get post analytics', async () => {
      const posts = await service.getAccountPosts(account.accountId);
      const postId = posts[0].postId;

      const analytics = await service.getPostAnalytics(postId);

      expect(analytics).toBeDefined();
      expect(analytics!.postId).toBe(postId);
      expect(analytics!.impressions).toBeDefined();
      expect(analytics!.engagements).toBeDefined();
    });

    test('should get multiple post analytics', async () => {
      const post2 = await service.createPost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'Second post',
        postType: 'text',
        status: 'published',
        publishedAt: new Date(),
      });
      await service.publishPost(post2.postId);

      const posts = await service.getAccountPosts(account.accountId);
      const postIds = posts.map((p) => p.postId);

      const analyticsMap = await service.getMultiplePostAnalytics(postIds);

      expect(analyticsMap.size).toBe(2);
    });

    test('should get engagement stats', async () => {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

      const stats = await service.getEngagementStats('user123', 'twitter', { start, end });

      expect(stats.userId).toBe('user123');
      expect(stats.platform).toBe('twitter');
      expect(stats.totalPosts).toBeDefined();
      expect(stats.totalLikes).toBeDefined();
    });

    test('should get trending hashtags', async () => {
      const hashtags = await service.getTrendingHashtags('twitter', 5);

      expect(hashtags.length).toBeLessThanOrEqual(5);
      expect(hashtags[0].hashtag).toBeDefined();
      expect(hashtags[0].count).toBeDefined();
    });
  });

  describe('Comments', () => {
    let account: Awaited<ReturnType<typeof service.connectAccount>>;

    beforeEach(async () => {
      account = await service.connectAccount('user123', 'twitter', 'token');
    });

    test('should add comment to post', async () => {
      const post = await service.createPost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'Post with comments',
        postType: 'text',
        status: 'published',
      });

      const comment = await service.createComment(post.postId, 'Great post!');

      expect(comment.commentId).toBeDefined();
      expect(comment.content).toBe('Great post!');
      expect(comment.status).toBe('approved');
    });

    test('should reply to comment', async () => {
      const post = await service.createPost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'Post with reply',
        postType: 'text',
        status: 'published',
      });

      const comment = await service.createComment(post.postId, 'Original comment');
      const reply = await service.replyToComment(comment.commentId, 'Reply to comment');

      expect(reply.content).toBe('Reply to comment');
    });

    test('should update comment', async () => {
      const post = await service.createPost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'Post for editing comment',
        postType: 'text',
        status: 'published',
      });

      const comment = await service.createComment(post.postId, 'Original');
      const updated = await service.updateComment(comment.commentId, 'Updated content');

      expect(updated.content).toBe('Updated content');
    });

    test('should delete comment', async () => {
      const post = await service.createPost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'Post for deleting comment',
        postType: 'text',
        status: 'published',
      });

      const comment = await service.createComment(post.postId, 'To be deleted');
      await service.deleteComment(comment.commentId);

      const comments = await service.getComments(post.postId);
      expect(comments.find((c) => c.commentId === comment.commentId)!.status).toBe('deleted');
    });

    test('should moderate comment', async () => {
      const post = await service.createPost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'Post for moderation',
        postType: 'text',
        status: 'published',
      });

      const comment = await service.createComment(post.postId, 'Needs moderation');
      await service.moderateComment(comment.commentId, 'spam');

      const comments = await service.getComments(post.postId);
      expect(comments.find((c) => c.commentId === comment.commentId)!.status).toBe('spam');
    });

    test('should get comments with filters', async () => {
      const post = await service.createPost(account.accountId, {
        platform: 'twitter',
        userId: 'user123',
        content: 'Post for filtering comments',
        postType: 'text',
        status: 'published',
      });

      await service.createComment(post.postId, 'Approved comment');
      const pendingComment = await service.createComment(post.postId, 'Pending comment');
      await service.moderateComment(pendingComment.commentId, 'pending');

      const comments = await service.getComments(post.postId, { status: 'pending' });

      expect(comments.every((c) => c.status === 'pending')).toBe(true);
    });
  });

  describe('Direct Messages', () => {
    let account: Awaited<ReturnType<typeof service.connectAccount>>;

    beforeEach(async () => {
      account = await service.connectAccount('user123', 'twitter', 'token');
    });

    test('should send direct message', async () => {
      const message = await service.sendMessage(
        account.accountId,
        'conv123',
        'Hello, DM here!'
      );

      expect(message.messageId).toBeDefined();
      expect(message.content).toBe('Hello, DM here!');
      expect(message.status).toBe('sent');
    });

    test('should send message with media', async () => {
      const media = {
        mediaId: 'media1',
        type: 'image' as MediaType,
        url: 'https://example.com/image.jpg',
      };

      const message = await service.sendMessage(
        account.accountId,
        'conv123',
        'Check this out!',
        media
      );

      expect(message.media).toBeDefined();
      expect(message.media!.url).toBe('https://example.com/image.jpg');
    });

    test('should get conversation messages', async () => {
      await service.sendMessage(account.accountId, 'conv123', 'Message 1');
      await service.sendMessage(account.accountId, 'conv123', 'Message 2');

      const messages = await service.getConversationMessages(account.accountId, 'conv123');

      expect(messages.length).toBe(2);
    });

    test('should mark message as read', async () => {
      const message = await service.sendMessage(
        account.accountId,
        'conv123',
        'Read receipt test'
      );

      await service.markMessageAsRead(message.messageId);

      const retrieved = await service.getConversationMessages(account.accountId, 'conv123');
      expect(retrieved.find((m) => m.messageId === message.messageId)!.status).toBe('read');
    });

    test('should mark conversation as read', async () => {
      await service.sendMessage(account.accountId, 'conv123', 'Message 1');
      await service.sendMessage(account.accountId, 'conv123', 'Message 2');

      await service.markConversationAsRead(account.accountId, 'conv123');

      const messages = await service.getConversationMessages(account.accountId, 'conv123');
      expect(messages.every((m) => m.status === 'read')).toBe(true);
    });
  });

  describe('Mentions', () => {
    let account: Awaited<ReturnType<typeof service.connectAccount>>;

    beforeEach(async () => {
      account = await service.connectAccount('user123', 'twitter', 'token');
    });

    test('should get mentions for account', async () => {
      const mentions = await service.getMentions(account.accountId);

      expect(Array.isArray(mentions)).toBe(true);
    });

    test('should get mentions with date filter', async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const mentions = await service.getMentions(account.accountId, since);

      expect(Array.isArray(mentions)).toBe(true);
    });

    test('should get mention analytics', async () => {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

      const analytics = await service.getMentionAnalytics(account.accountId, { start, end });

      expect(analytics.totalMentions).toBeDefined();
      expect(analytics.mentionsByDay).toBeDefined();
    });
  });
});

describe('SocialMediaManus', () => {
  let manus: SocialMediaManus;

  beforeEach(() => {
    manus = new SocialMediaManus();
  });

  test('should create instance', () => {
    expect(manus).toBeDefined();
  });

  test('should connect social account', async () => {
    const account = await manus.connectSocialAccount('user123', 'twitter', 'token123');

    expect(account.accountId).toBeDefined();
    expect(account.platform).toBe('twitter');
  });

  test('should disconnect social account', async () => {
    const account = await manus.connectSocialAccount('user123', 'twitter', 'token');
    await manus.disconnectSocialAccount(account.accountId);

    const accounts = await manus.getSocialAccounts('user123');
    expect(accounts[0].isConnected).toBe(false);
  });

  test('should create social post', async () => {
    const account = await manus.connectSocialAccount('user123', 'twitter', 'token');
    
    const post = await manus.createSocialPost(account.accountId, 'Hello!', 'text');

    expect(post.postId).toBeDefined();
    expect(post.content).toBe('Hello!');
  });

  test('should schedule social post', async () => {
    const account = await manus.connectSocialAccount('user123', 'twitter', 'token');
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const post = await manus.scheduleSocialPost(
      account.accountId,
      'Scheduled content',
      'text',
      futureDate
    );

    expect(post.scheduledFor).toEqual(futureDate);
  });

  test('should publish to all platforms', async () => {
    await manus.connectSocialAccount('user123', 'twitter', 'token');
    await manus.connectSocialAccount('user123', 'facebook', 'token');

    const posts = await manus.publishToAllPlatforms(
      'user123',
      'Cross-platform content',
      ['twitter', 'facebook']
    );

    expect(posts.length).toBe(2);
  });

  test('should add comment', async () => {
    const account = await manus.connectSocialAccount('user123', 'twitter', 'token');
    const post = await manus.createSocialPost(account.accountId, 'Post for comment', 'text');

    const comment = await manus.addComment(post.postId, 'Great!');

    expect(comment.commentId).toBeDefined();
  });

  test('should reply to comment', async () => {
    const account = await manus.connectSocialAccount('user123', 'twitter', 'token');
    const post = await manus.createSocialPost(account.accountId, 'Post for reply', 'text');
    const comment = await manus.addComment(post.postId, 'Original comment');

    const reply = await manus.replyToComment(comment.commentId, 'Reply content');

    expect(reply.content).toBe('Reply content');
  });

  test('should moderate comment', async () => {
    const account = await manus.connectSocialAccount('user123', 'twitter', 'token');
    const post = await manus.createSocialPost(account.accountId, 'Post for moderation', 'text');
    const comment = await manus.addComment(post.postId, 'Comment to moderate');

    await manus.moderateComment(comment.commentId, 'spam');

    const comments = await manus.getComments(post.postId);
    expect(comments.find((c) => c.commentId === comment.commentId)!.status).toBe('spam');
  });

  test('should send direct message', async () => {
    const account = await manus.connectSocialAccount('user123', 'twitter', 'token');

    const message = await manus.sendDirectMessage(account.accountId, 'conv123', 'Hello!');

    expect(message.messageId).toBeDefined();
  });

  test('should get messages', async () => {
    const account = await manus.connectSocialAccount('user123', 'twitter', 'token');

    await manus.sendDirectMessage(account.accountId, 'conv123', 'Test message');
    const messages = await manus.getMessages(account.accountId, 'conv123');

    expect(messages.length).toBeGreaterThan(0);
  });

  test('should mark message as read', async () => {
    const account = await manus.connectSocialAccount('user123', 'twitter', 'token');
    const message = await manus.sendDirectMessage(account.accountId, 'conv123', 'Test');

    await manus.markMessageAsRead(message.messageId);

    const messages = await manus.getMessages(account.accountId, 'conv123');
    expect(messages.find((m) => m.messageId === message.messageId)!.status).toBe('read');
  });

  test('should get trending hashtags', async () => {
    const hashtags = await manus.getTrendingHashtags('twitter', 5);

    expect(hashtags.length).toBeLessThanOrEqual(5);
  });

  test('should get post analytics', async () => {
    const account = await manus.connectSocialAccount('user123', 'twitter', 'token');
    const post = await manus.createSocialPost(account.accountId, 'Analytics test', 'text');
    await manus.publishScheduledPost(post.postId);

    const analytics = await manus.getPostAnalytics(post.postId);

    expect(analytics).toBeDefined();
  });

  test('should get engagement stats', async () => {
    await manus.connectSocialAccount('user123', 'twitter', 'token');

    const stats = await manus.getEngagementStats('user123', 'twitter', 7);

    expect(stats.totalPosts).toBeDefined();
  });

  test('should get mentions', async () => {
    const account = await manus.connectSocialAccount('user123', 'twitter', 'token');

    const mentions = await manus.getMentions(account.accountId);

    expect(Array.isArray(mentions)).toBe(true);
  });
});

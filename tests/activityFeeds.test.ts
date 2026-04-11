import {
  ActivityFeedManager,
  createActivityFeedManager,
  ActivityType,
  FeedType,
  ActivityStatus,
  ActivityActor,
  FeedPreferences,
  FeedFilter,
  RealTimeUpdate,
} from '../src/core/activityFeeds';

describe('Activity Feeds & Updates System', () => {
  let manager: ActivityFeedManager;

  beforeEach(() => {
    manager = createActivityFeedManager({
      maxFeedSize: 100,
      maxAggregationWindowMs: 300000,
      cacheTtlMs: 60000,
      realTimeUpdateIntervalMs: 5000,
    });
  });

  describe('Activity Creation', () => {
    const testActor: ActivityActor = {
      id: 'user_123',
      username: 'testuser',
      displayName: 'Test User',
      avatarUrl: 'https://example.com/avatar.png',
    };

    test('should create a post activity', async () => {
      const activity = await manager.createActivity('post', testActor, {
        content: {
          text: 'Hello World',
          mediaUrls: ['https://example.com/image.png'],
        },
      });

      expect(activity.id).toMatch(/^act_[a-f0-9]+$/);
      expect(activity.type).toBe('post');
      expect(activity.actorId).toBe('user_123');
      expect(activity.actor.username).toBe('testuser');
      expect(activity.content?.text).toBe('Hello World');
      expect(activity.status).toBe('active');
      expect(activity.createdAt).toBeInstanceOf(Date);
      expect(activity.updatedAt).toBeInstanceOf(Date);
    });

    test('should create a comment activity', async () => {
      const activity = await manager.createActivity('comment', testActor, {
        targetId: 'post_456',
        target: { id: 'post_456', type: 'post', title: 'Original Post', url: 'https://example.com/post/456' },
        content: { text: 'Great post!' },
      });

      expect(activity.id).toMatch(/^act_[a-f0-9]+$/);
      expect(activity.type).toBe('comment');
      expect(activity.targetId).toBe('post_456');
      expect(activity.target?.type).toBe('post');
    });

    test('should create a like activity', async () => {
      const activity = await manager.createActivity('like', testActor, {
        targetId: 'post_789',
        target: { id: 'post_789', type: 'post' },
      });

      expect(activity.id).toMatch(/^act_[a-f0-9]+$/);
      expect(activity.type).toBe('like');
    });

    test('should create a follow activity', async () => {
      const activity = await manager.createActivity('follow', testActor, {
        targetId: 'user_target',
        target: { id: 'user_target', type: 'user', title: 'Target User' },
      });

      expect(activity.id).toMatch(/^act_[a-f0-9]+$/);
      expect(activity.type).toBe('follow');
    });

    test('should create a mention activity', async () => {
      const activity = await manager.createActivity('mention', testActor, {
        targetId: 'post_mention',
        content: { text: 'Hey @otheruser!' },
      });

      expect(activity.id).toMatch(/^act_[a-f0-9]+$/);
      expect(activity.type).toBe('mention');
    });

    test('should create activity with expiration', async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      const activity = await manager.createActivity('post', testActor, {
        expiresAt,
      });

      expect(activity.expiresAt).toEqual(expiresAt);
    });

    test('should create activity with metadata', async () => {
      const activity = await manager.createActivity('post', testActor, {
        metadata: { source: 'web', version: 1 },
      });

      expect(activity.metadata?.source).toBe('web');
      expect(activity.metadata?.version).toBe(1);
    });
  });

  describe('Activity Retrieval', () => {
    const testActor: ActivityActor = {
      id: 'user_actor',
      username: 'actor',
    };

    beforeEach(async () => {
      await manager.createActivity('post', testActor, { content: { text: 'Post 1' } });
      await manager.createActivity('post', testActor, { content: { text: 'Post 2' } });
      await manager.createActivity('comment', testActor, { content: { text: 'Comment 1' } });
    });

    test('should get activity by id', async () => {
      const created = await manager.createActivity('post', testActor, {
        content: { text: 'Find me' },
      });

      const retrieved = await manager.getActivity(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.content?.text).toBe('Find me');
    });

    test('should return undefined for non-existent activity', async () => {
      const retrieved = await manager.getActivity('non_existent');
      expect(retrieved).toBeUndefined();
    });

    test('should get activities by actor', async () => {
      const activities = await manager.getActivitiesByActor('user_actor');
      expect(activities.length).toBeGreaterThanOrEqual(3);
      expect(activities.every((a) => a.actorId === 'user_actor')).toBe(true);
    });

    test('should limit activities by actor', async () => {
      const activities = await manager.getActivitiesByActor('user_actor', 2);
      expect(activities.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Activity Updates', () => {
    const testActor: ActivityActor = { id: 'user_update', username: 'updater' };

    test('should update activity content', async () => {
      const activity = await manager.createActivity('post', testActor, {
        content: { text: 'Original' },
      });

      const updated = await manager.updateActivity(activity.id, {
        content: { text: 'Updated' },
      });

      expect(updated.content?.text).toBe('Updated');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(activity.updatedAt.getTime());
    });

    test('should update activity metadata', async () => {
      const activity = await manager.createActivity('post', testActor);

      const updated = await manager.updateActivity(activity.id, {
        metadata: { edited: true },
      });

      expect(updated.metadata?.edited).toBe(true);
    });

    test('should throw error when updating non-existent activity', async () => {
      await expect(
        manager.updateActivity('non_existent', { content: { text: 'New' } })
      ).rejects.toThrow('Activity not found: non_existent');
    });
  });

  describe('Activity Deletion', () => {
    const testActor: ActivityActor = { id: 'user_delete', username: 'deleter' };

    test('should delete existing activity', async () => {
      const activity = await manager.createActivity('post', testActor);
      const result = await manager.deleteActivity(activity.id);

      expect(result).toBe(true);
      expect(await manager.getActivity(activity.id)).toBeUndefined();
    });

    test('should return false when deleting non-existent activity', async () => {
      const result = await manager.deleteActivity('non_existent');
      expect(result).toBe(false);
    });
  });

  describe('Activity Visibility', () => {
    const testActor: ActivityActor = { id: 'user_visibility', username: 'visuser' };

    test('should hide activity', async () => {
      const activity = await manager.createActivity('post', testActor);
      const hidden = await manager.hideActivity(activity.id);

      expect(hidden.status).toBe('hidden');
    });

    test('should unhide activity', async () => {
      const activity = await manager.createActivity('post', testActor);
      await manager.hideActivity(activity.id);
      const unhidden = await manager.unhideActivity(activity.id);

      expect(unhidden.status).toBe('active');
    });

    test('should archive activity', async () => {
      const activity = await manager.createActivity('post', testActor);
      const archived = await manager.archiveActivity(activity.id);

      expect(archived.status).toBe('archived');
    });
  });

  describe('Feed Creation', () => {
    test('should create a home feed', async () => {
      const feed = await manager.createFeed('user_home', 'home', 'My Home Feed');

      expect(feed.id).toMatch(/^feed_[a-f0-9]+$/);
      expect(feed.userId).toBe('user_home');
      expect(feed.type).toBe('home');
      expect(feed.name).toBe('My Home Feed');
      expect(feed.itemCount).toBe(0);
    });

    test('should create a user feed', async () => {
      const feed = await manager.createFeed('user_profile', 'user', 'User Profile Feed');

      expect(feed.id).toMatch(/^feed_[a-f0-9]+$/);
      expect(feed.type).toBe('user');
    });

    test('should create a notification feed', async () => {
      const feed = await manager.createFeed('user_notif', 'notification', 'Notifications');

      expect(feed.id).toMatch(/^feed_[a-f0-9]+$/);
      expect(feed.type).toBe('notification');
    });

    test('should create feed with description', async () => {
      const feed = await manager.createFeed('user_desc', 'home', 'Home', 'My personal feed');

      expect(feed.description).toBe('My personal feed');
    });
  });

  describe('Feed Retrieval', () => {
    beforeEach(async () => {
      await manager.createFeed('user_get', 'home');
      await manager.createFeed('user_get', 'user');
      await manager.createFeed('user_get', 'notification');
    });

    test('should get feed by id', async () => {
      const created = await manager.createFeed('user_find', 'home');
      const retrieved = await manager.getFeed(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.userId).toBe('user_find');
    });

    test('should get all user feeds', async () => {
      const feeds = await manager.getUserFeeds('user_get');
      expect(feeds.length).toBe(3);
    });

    test('should return undefined for non-existent feed', async () => {
      const retrieved = await manager.getFeed('non_existent');
      expect(retrieved).toBeUndefined();
    });

    test('should delete feed', async () => {
      const feed = await manager.createFeed('user_del', 'home');
      const result = await manager.deleteFeed(feed.id);

      expect(result).toBe(true);
      expect(await manager.getFeed(feed.id)).toBeUndefined();
    });
  });

  describe('Feed Items', () => {
    const testActor: ActivityActor = { id: 'user_feed', username: 'feeduser' };
    let testFeed: Awaited<ReturnType<typeof manager.createFeed>>;
    let testActivity: Awaited<ReturnType<typeof manager.createActivity>>;

    beforeEach(async () => {
      testFeed = await manager.createFeed('user_items', 'home');
      testActivity = await manager.createActivity('post', testActor, {
        content: { text: 'Test Post' },
      });
    });

    test('should add item to feed', async () => {
      const feedItem = await manager.addToFeed(testFeed.id, testActivity.id);

      expect(feedItem.id).toMatch(/^fi_[a-f0-9]+$/);
      expect(feedItem.feedId).toBe(testFeed.id);
      expect(feedItem.activityId).toBe(testActivity.id);
      expect(feedItem.activity.content?.text).toBe('Test Post');
      expect(feedItem.visibility).toBe('public');
    });

    test('should add item with friends visibility', async () => {
      const feedItem = await manager.addToFeed(testFeed.id, testActivity.id, 'friends');

      expect(feedItem.visibility).toBe('friends');
    });

    test('should throw error when adding to non-existent feed', async () => {
      await expect(
        manager.addToFeed('non_existent', testActivity.id)
      ).rejects.toThrow('Feed not found: non_existent');
    });

    test('should throw error when adding non-existent activity', async () => {
      await expect(
        manager.addToFeed(testFeed.id, 'non_existent')
      ).rejects.toThrow('Activity not found: non_existent');
    });

    test('should get feed items', async () => {
      await manager.addToFeed(testFeed.id, testActivity.id);
      const items = await manager.getFeedItems(testFeed.id);

      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items[0].activityId).toBe(testActivity.id);
    });

    test('should filter feed items by type', async () => {
      const activity2 = await manager.createActivity('comment', testActor);
      await manager.addToFeed(testFeed.id, testActivity.id);
      await manager.addToFeed(testFeed.id, activity2.id);

      const filter: FeedFilter = { types: ['comment'] };
      const items = await manager.getFeedItems(testFeed.id, filter);

      expect(items.every((i) => i.activity.type === 'comment')).toBe(true);
    });

    test('should filter feed items by limit', async () => {
      const activity2 = await manager.createActivity('comment', testActor);
      const activity3 = await manager.createActivity('like', testActor);
      await manager.addToFeed(testFeed.id, testActivity.id);
      await manager.addToFeed(testFeed.id, activity2.id);
      await manager.addToFeed(testFeed.id, activity3.id);

      const filter: FeedFilter = { limit: 2 };
      const items = await manager.getFeedItems(testFeed.id, filter);

      expect(items.length).toBeLessThanOrEqual(2);
    });

    test('should remove item from feed', async () => {
      await manager.addToFeed(testFeed.id, testActivity.id);
      const result = await manager.removeFromFeed(testFeed.id, testActivity.id);

      expect(result).toBe(true);
    });
  });

  describe('Home Feed', () => {
    test('should get or create home feed', async () => {
      const items = await manager.getHomeFeed('user_new');
      expect(items).toBeDefined();
      expect(Array.isArray(items)).toBe(true);
    });
  });

  describe('User Feed', () => {
    test('should get or create user feed', async () => {
      const items = await manager.getUserFeed('user_profile');
      expect(items).toBeDefined();
      expect(Array.isArray(items)).toBe(true);
    });
  });

  describe('Notification Feed', () => {
    test('should get or create notification feed', async () => {
      const items = await manager.getNotificationFeed('user_notif');
      expect(items).toBeDefined();
      expect(Array.isArray(items)).toBe(true);
    });
  });

  describe('User Preferences', () => {
    const preferences: FeedPreferences = {
      userId: 'user_pref',
      homeFeed: {
        enabled: true,
        types: ['post', 'comment'],
        showReplies: true,
        showFollows: false,
      },
      userFeed: {
        enabled: true,
        showLikes: true,
        showComments: false,
      },
      notificationFeed: {
        enabled: true,
        mentionNotifications: true,
        followNotifications: false,
      },
    };

    test('should set user preferences', () => {
      manager.setUserPreferences(preferences);
      const retrieved = manager.getUserPreferences('user_pref');

      expect(retrieved).toBeDefined();
      expect(retrieved?.homeFeed.types).toEqual(['post', 'comment']);
      expect(retrieved?.homeFeed.showReplies).toBe(true);
    });

    test('should return undefined for non-existent user preferences', () => {
      const retrieved = manager.getUserPreferences('non_existent');
      expect(retrieved).toBeUndefined();
    });

    test('should update specific feed preferences', () => {
      manager.setUserPreferences(preferences);
      manager.setUserPreferences({
        ...preferences,
        homeFeed: { ...preferences.homeFeed, showFollows: true },
      });

      const retrieved = manager.getUserPreferences('user_pref');
      expect(retrieved?.homeFeed.showFollows).toBe(true);
    });
  });

  describe('Real-Time Updates', () => {
    const testActor: ActivityActor = { id: 'user_rt', username: 'rtuser' };

    test('should subscribe to feed updates', async () => {
      const updates: RealTimeUpdate[] = [];
      const feed = await manager.createFeed('user_sub', 'home');

      const unsubscribe = manager.subscribeToFeed(feed.id, (update) => {
        updates.push(update);
      });

      await manager.publishUpdate(feed.id, 'new', ['act_123']);

      expect(updates.length).toBe(1);
      expect(updates[0].type).toBe('new');

      unsubscribe();
    });

    test('should handle multiple subscribers', async () => {
      const updates1: RealTimeUpdate[] = [];
      const updates2: RealTimeUpdate[] = [];
      const feed = await manager.createFeed('user_multi', 'home');

      manager.subscribeToFeed(feed.id, (update) => updates1.push(update));
      manager.subscribeToFeed(feed.id, (update) => updates2.push(update));

      await manager.publishUpdate(feed.id, 'new', ['act_456']);

      expect(updates1.length).toBe(1);
      expect(updates2.length).toBe(1);
    });

    test('should publish update with activities', async () => {
      const activity = await manager.createActivity('post', testActor);
      const feed = await manager.createFeed('user_act', 'home');

      await manager.publishUpdate(feed.id, 'new', [activity.id], [activity]);
    });
  });

  describe('Feed Caching', () => {
    const testActor: ActivityActor = { id: 'user_cache', username: 'cacheuser' };

    test('should cache feed items', async () => {
      const feed = await manager.createFeed('user_cached', 'home');
      const activity = await manager.createActivity('post', testActor);
      await manager.addToFeed(feed.id, activity.id);

      const items1 = await manager.getFeedItems(feed.id);
      const items2 = await manager.getFeedItems(feed.id);

      expect(items1).toEqual(items2);
    });

    test('should invalidate cache when adding item', async () => {
      const feed = await manager.createFeed('user_inval', 'home');
      const activity = await manager.createActivity('post', testActor);

      await manager.getFeedItems(feed.id);
      await manager.addToFeed(feed.id, activity.id);
      const items = await manager.getFeedItems(feed.id);

      expect(items.some((i) => i.activityId === activity.id)).toBe(true);
    });

    test('should clear all cache', async () => {
      const feed = await manager.createFeed('user_clear', 'home');
      await manager.getFeedItems(feed.id);

      manager.clearAllCache();
    });

    test('should invalidate specific feed cache', async () => {
      const feed = await manager.createFeed('user_spec', 'home');
      await manager.getFeedItems(feed.id);

      manager.invalidateCache(feed.id);
    });
  });

  describe('Feed Clearing', () => {
    const testActor: ActivityActor = { id: 'user_clear', username: 'clearuser' };

    test('should clear feed items', async () => {
      const feed = await manager.createFeed('user_empty', 'home');
      const activity = await manager.createActivity('post', testActor);
      await manager.addToFeed(feed.id, activity.id);

      await manager.clearFeed(feed.id);
      const items = await manager.getFeedItems(feed.id);

      expect(items.length).toBe(0);
    });
  });

  describe('Feed Aggregations', () => {
    test('should create feed aggregation', async () => {
      const feed = await manager.createFeed('user_agg', 'home');

      const aggregation = await manager.aggregateFeedItems(feed.id, {
        feedId: feed.id,
        activityType: 'like',
        primaryActivityId: 'act_1',
        aggregatedActivityIds: ['act_2', 'act_3'],
        count: 3,
        latestAt: new Date(),
      });

      expect(aggregation.id).toMatch(/^fagg_[a-f0-9]+$/);
      expect(aggregation.count).toBe(3);
    });

    test('should get aggregation by id', async () => {
      const feed = await manager.createFeed('user_getagg', 'home');
      const created = await manager.aggregateFeedItems(feed.id, {
        feedId: feed.id,
        activityType: 'follow',
        primaryActivityId: 'act_1',
        aggregatedActivityIds: ['act_2'],
        count: 2,
        latestAt: new Date(),
      });

      const retrieved = manager.getAggregation(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.activityType).toBe('follow');
    });
  });

  describe('Activity Types', () => {
    const testActor: ActivityActor = { id: 'user_types', username: 'typesuser' };
    const activityTypes: ActivityType[] = ['post', 'comment', 'like', 'follow', 'mention'];

    activityTypes.forEach((type) => {
      test(`should create ${type} activity`, async () => {
        const activity = await manager.createActivity(type, testActor);
        expect(activity.type).toBe(type);
      });
    });
  });

  describe('Feed Types', () => {
    const feedTypes: FeedType[] = ['home', 'user', 'notification'];

    feedTypes.forEach((type) => {
      test(`should create ${type} feed`, async () => {
        const feed = await manager.createFeed(`user_${type}`, type);
        expect(feed.type).toBe(type);
      });
    });
  });

  describe('Activity Status', () => {
    const testActor: ActivityActor = { id: 'user_status', username: 'statususer' };
    const statuses: ActivityStatus[] = ['active', 'hidden', 'deleted', 'archived'];

    statuses.forEach((status) => {
      test(`should handle ${status} status`, async () => {
        const activity = await manager.createActivity('post', testActor);
        if (status !== 'active') {
          await manager.updateActivity(activity.id, { status });
          const updated = await manager.getActivity(activity.id);
          expect(updated?.status).toBe(status);
        }
      });
    });
  });

  describe('createActivityFeedManager', () => {
    test('should create manager with custom config', () => {
      const customManager = createActivityFeedManager({
        maxFeedSize: 200,
        maxAggregationWindowMs: 600000,
        cacheTtlMs: 120000,
        realTimeUpdateIntervalMs: 10000,
      });

      expect(customManager).toBeInstanceOf(ActivityFeedManager);
    });

    test('should create manager with default config', () => {
      const defaultManager = createActivityFeedManager();
      expect(defaultManager).toBeInstanceOf(ActivityFeedManager);
    });
  });

  describe('Type Guards', () => {
    test('should correctly identify Activity objects', async () => {
      const { isActivity } = await import('../src/core/activityFeeds/types');
      const activity = await manager.createActivity('post', { id: 'u1', username: 'test' });

      expect(isActivity(activity)).toBe(true);
      expect(isActivity({ invalid: true })).toBe(false);
      expect(isActivity(null)).toBe(false);
      expect(isActivity(undefined)).toBe(false);
    });
  });
});

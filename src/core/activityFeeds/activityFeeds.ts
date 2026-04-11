import crypto from 'crypto';
import {
  Activity,
  ActivityActor,
  ActivityContent,
  ActivityFeedConfig,
  ActivityTarget,
  ActivityType,
  Feed,
  FeedAggregation,
  FeedCache,
  FeedFilter,
  FeedItem,
  FeedPreferences,
  FeedType,
  IActivityAggregator,
  IActivityStore,
  IFeedCache,
  IFeedStore,
  IRealTimePublisher,
  RealTimeUpdate,
  RealTimeUpdateType,
} from './types';

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

class InMemoryActivityStore implements IActivityStore {
  private activities: Map<string, Activity> = new Map();

  async saveActivity(activity: Activity): Promise<Activity> {
    this.activities.set(activity.id, activity);
    return activity;
  }

  async getActivity(id: string): Promise<Activity | undefined> {
    return this.activities.get(id);
  }

  async deleteActivity(id: string): Promise<boolean> {
    return this.activities.delete(id);
  }

  async getActivitiesByActor(actorId: string, limit?: number): Promise<Activity[]> {
    const activities = Array.from(this.activities.values())
      .filter((a) => a.actorId === actorId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (limit) {
      return activities.slice(0, limit);
    }
    return activities;
  }
}

class InMemoryFeedStore implements IFeedStore {
  private feeds: Map<string, Feed> = new Map();
  private feedItems: Map<string, FeedItem[]> = new Map();

  async saveFeed(feed: Feed): Promise<Feed> {
    this.feeds.set(feed.id, feed);
    if (!this.feedItems.has(feed.id)) {
      this.feedItems.set(feed.id, []);
    }
    return feed;
  }

  async getFeed(id: string): Promise<Feed | undefined> {
    return this.feeds.get(id);
  }

  async deleteFeed(id: string): Promise<boolean> {
    this.feedItems.delete(id);
    return this.feeds.delete(id);
  }

  async getAllFeeds(): Promise<Feed[]> {
    return Array.from(this.feeds.values());
  }

  async clearFeedItems(feedId: string): Promise<void> {
    this.feedItems.set(feedId, []);
  }

  async addFeedItem(feedId: string, item: FeedItem): Promise<void> {
    const items = this.feedItems.get(feedId) || [];
    const existingIndex = items.findIndex((i) => i.activityId === item.activityId);
    if (existingIndex === -1) {
      items.unshift(item);
      this.feedItems.set(feedId, items);
    }
  }

  async getFeedItems(feedId: string, filter?: FeedFilter): Promise<FeedItem[]> {
    let items = this.feedItems.get(feedId) || [];

    if (filter) {
      if (filter.types && filter.types.length > 0) {
        items = items.filter((item) => filter.types!.includes(item.activity.type));
      }
      if (filter.actorIds && filter.actorIds.length > 0) {
        items = items.filter((item) => filter.actorIds!.includes(item.activity.actorId));
      }
      if (filter.targetIds && filter.targetIds.length > 0) {
        items = items.filter((item) => item.activity.targetId && filter.targetIds!.includes(item.activity.targetId));
      }
      if (filter.startDate) {
        items = items.filter((item) => item.activity.createdAt >= filter.startDate!);
      }
      if (filter.endDate) {
        items = items.filter((item) => item.activity.createdAt <= filter.endDate!);
      }
      if (filter.status) {
        items = items.filter((item) => item.activity.status === filter.status);
      }

      const offset = filter.offset || 0;
      const limit = filter.limit || items.length;
      items = items.slice(offset, offset + limit);
    }

    return items;
  }

  async removeFeedItem(feedId: string, activityId: string): Promise<boolean> {
    const items = this.feedItems.get(feedId);
    if (!items) return false;

    const index = items.findIndex((i) => i.activityId === activityId);
    if (index === -1) return false;

    items.splice(index, 1);
    return true;
  }
}

class InMemoryFeedCache implements IFeedCache {
  private cache: Map<string, FeedCache> = new Map();

  get(key: string): FeedCache | undefined {
    const item = this.cache.get(key);
    if (item && item.expiresAt > new Date()) {
      return item;
    }
    if (item) {
      this.cache.delete(key);
    }
    return undefined;
  }

  set(cache: FeedCache): void {
    this.cache.set(cache.key, cache);
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidateByFeedId(_feedId: string): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((cache, key) => {
      if (cache.feedId === _feedId) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  clear(): void {
    this.cache.clear();
  }
}

class InMemoryRealTimePublisher implements IRealTimePublisher {
  private subscriptions: Map<string, Set<(update: RealTimeUpdate) => void>> = new Map();

  async publish(update: RealTimeUpdate): Promise<void> {
    const subscribers = this.subscriptions.get(update.feedId);
    if (subscribers) {
      subscribers.forEach((callback) => callback(update));
    }
  }

  subscribe(feedId: string, callback: (update: RealTimeUpdate) => void): () => void {
    if (!this.subscriptions.has(feedId)) {
      this.subscriptions.set(feedId, new Set());
    }
    this.subscriptions.get(feedId)!.add(callback);

    return () => {
      const subs = this.subscriptions.get(feedId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscriptions.delete(feedId);
        }
      }
    };
  }
}

class ActivityAggregator implements IActivityAggregator {
  private readonly windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  aggregate(feedId: string, activities: Activity[]): Activity[] {
    if (activities.length === 0) return [];

    const aggregated: Map<string, Activity[]> = new Map();

    for (const activity of activities) {
      const key = this.getAggregationKey(activity);
      const existing = aggregated.get(key);
      if (existing) {
        existing.push(activity);
      } else {
        aggregated.set(key, [activity]);
      }
    }

    const result: Activity[] = [];
    aggregated.forEach((groupedActivities) => {
      if (groupedActivities.length > 1 && this.shouldAggregateGroup(groupedActivities)) {
        result.push(this.createAggregatedActivity(groupedActivities));
      } else {
        result.push(...groupedActivities);
      }
    });

    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  shouldAggregate(activity1: Activity, activity2: Activity): boolean {
    if (activity1.type !== activity2.type) return false;
    if (activity1.actorId !== activity2.actorId) return false;

    const timeDiff = Math.abs(activity1.createdAt.getTime() - activity2.createdAt.getTime());
    return timeDiff <= this.windowMs;
  }

  createAggregatedActivity(activities: Activity[]): Activity {
    const sorted = activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const primary = sorted[0];

    return {
      ...primary,
      id: generateId('agg'),
      metadata: {
        ...primary.metadata,
        aggregatedCount: activities.length,
        aggregated: true,
      },
      updatedAt: new Date(),
    };
  }

  private getAggregationKey(activity: Activity): string {
    return `${activity.type}:${activity.actorId}:${activity.targetId || 'no-target'}`;
  }

  private shouldAggregateGroup(activities: Activity[]): boolean {
    if (activities.length < 2) return false;

    const typesToAggregate: ActivityType[] = ['like', 'follow', 'mention'];
    if (!typesToAggregate.includes(activities[0].type)) return false;

    const timeSpan = Math.max(...activities.map((a) => a.createdAt.getTime())) -
      Math.min(...activities.map((a) => a.createdAt.getTime()));

    return timeSpan <= this.windowMs;
  }
}

export class ActivityFeedManager {
  private activityStore: IActivityStore;
  private feedStore: IFeedStore;
  private cache: IFeedCache;
  private publisher: IRealTimePublisher;
  private aggregator: IActivityAggregator;
  private config: ActivityFeedConfig;
  private preferences: Map<string, FeedPreferences> = new Map();
  private aggregations: Map<string, FeedAggregation> = new Map();

  constructor(config: Partial<ActivityFeedConfig> = {}) {
    this.activityStore = new InMemoryActivityStore();
    this.feedStore = new InMemoryFeedStore();
    this.cache = new InMemoryFeedCache();
    this.publisher = new InMemoryRealTimePublisher();
    this.aggregator = new ActivityAggregator(config.maxAggregationWindowMs || 300000);

    this.config = {
      maxFeedSize: config.maxFeedSize || 100,
      maxAggregationWindowMs: config.maxAggregationWindowMs || 300000,
      cacheTtlMs: config.cacheTtlMs || 60000,
      realTimeUpdateIntervalMs: config.realTimeUpdateIntervalMs || 5000,
    };
  }

  async createActivity(
    type: ActivityType,
    actor: ActivityActor,
    options?: {
      targetId?: string;
      target?: ActivityTarget;
      content?: ActivityContent;
      metadata?: Record<string, unknown>;
      expiresAt?: Date;
    }
  ): Promise<Activity> {
    const now = new Date();
    const activity: Activity = {
      id: generateId('act'),
      type,
      actorId: actor.id,
      actor,
      targetId: options?.targetId,
      target: options?.target,
      content: options?.content,
      metadata: options?.metadata,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      expiresAt: options?.expiresAt,
    };

    await this.activityStore.saveActivity(activity);
    await this.distributeToFeeds(activity);

    return activity;
  }

  async getActivity(id: string): Promise<Activity | undefined> {
    return this.activityStore.getActivity(id);
  }

  async updateActivity(id: string, updates: Partial<Pick<Activity, 'content' | 'metadata' | 'status'>>): Promise<Activity> {
    const activity = await this.activityStore.getActivity(id);
    if (!activity) {
      throw new Error(`Activity not found: ${id}`);
    }

    const updated: Activity = {
      ...activity,
      ...updates,
      updatedAt: new Date(),
    };

    await this.activityStore.saveActivity(updated);

    if (updates.status) {
      await this.notifyFeedsOfUpdate(updated, 'update');
    }

    return updated;
  }

  async deleteActivity(id: string): Promise<boolean> {
    const activity = await this.activityStore.getActivity(id);
    if (!activity) return false;

    await this.activityStore.deleteActivity(id);
    await this.notifyFeedsOfUpdate(activity, 'delete');

    return true;
  }

  async getActivitiesByActor(actorId: string, limit?: number): Promise<Activity[]> {
    return this.activityStore.getActivitiesByActor(actorId, limit);
  }

  async createFeed(userId: string, type: FeedType, name?: string, description?: string): Promise<Feed> {
    const now = new Date();
    const feed: Feed = {
      id: generateId('feed'),
      userId,
      type,
      name,
      description,
      itemCount: 0,
      lastUpdatedAt: now,
      createdAt: now,
    };

    return this.feedStore.saveFeed(feed);
  }

  async getFeed(id: string): Promise<Feed | undefined> {
    return this.feedStore.getFeed(id);
  }

  async getUserFeeds(userId: string): Promise<Feed[]> {
    const allFeeds = await this.getAllFeeds();
    return allFeeds.filter((f) => f.userId === userId);
  }

  async deleteFeed(id: string): Promise<boolean> {
    return this.feedStore.deleteFeed(id);
  }

  async getAllFeeds(): Promise<Feed[]> {
    return this.feedStore.getAllFeeds();
  }

  async addToFeed(feedId: string, activityId: string, visibility: 'public' | 'friends' | 'private' = 'public'): Promise<FeedItem> {
    const feed = await this.feedStore.getFeed(feedId);
    if (!feed) {
      throw new Error(`Feed not found: ${feedId}`);
    }

    const activity = await this.activityStore.getActivity(activityId);
    if (!activity) {
      throw new Error(`Activity not found: ${activityId}`);
    }

    const feedItem: FeedItem = {
      id: generateId('fi'),
      feedId,
      activityId,
      activity,
      visibility,
      addedAt: new Date(),
    };

    await this.feedStore.addFeedItem(feedId, feedItem);

    feed.itemCount = (feed.itemCount || 0) + 1;
    feed.lastUpdatedAt = new Date();
    await this.feedStore.saveFeed(feed);

    this.cache.invalidateByFeedId(feedId);

    return feedItem;
  }

  async getFeedItems(feedId: string, filter?: FeedFilter): Promise<FeedItem[]> {
    const cacheKey = this.getCacheKey(feedId, filter);
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return cached.items;
    }

    let items = await this.feedStore.getFeedItems(feedId, {
      ...filter,
      limit: filter?.limit || this.config.maxFeedSize,
    });

    if (items.length > 0 && filter?.types && filter.types.length > 0) {
      items = this.aggregator.aggregate(feedId, items.map((i) => i.activity)).map((activity) => ({
        id: generateId('fi'),
        feedId,
        activityId: activity.id,
        activity,
        visibility: 'public' as const,
        addedAt: new Date(),
      }));
    }

    const cacheEntry: FeedCache = {
      key: cacheKey,
      feedId,
      items,
      itemCount: items.length,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.cacheTtlMs),
    };

    this.cache.set(cacheEntry);

    return items;
  }

  async removeFromFeed(feedId: string, activityId: string): Promise<boolean> {
    const result = await this.feedStore.removeFeedItem(feedId, activityId);
    if (result) {
      this.cache.invalidateByFeedId(feedId);
    }
    return result;
  }

  setUserPreferences(preferences: FeedPreferences): void {
    this.preferences.set(preferences.userId, preferences);
  }

  getUserPreferences(userId: string): FeedPreferences | undefined {
    return this.preferences.get(userId);
  }

  subscribeToFeed(feedId: string, callback: (update: RealTimeUpdate) => void): () => void {
    return this.publisher.subscribe(feedId, callback);
  }

  async publishUpdate(feedId: string, type: RealTimeUpdateType, activityIds?: string[], activities?: Activity[]): Promise<void> {
    const update: RealTimeUpdate = {
      id: generateId('rt'),
      type,
      feedId,
      activityId: activityIds?.[0],
      activities,
      timestamp: new Date(),
    };

    await this.publisher.publish(update);
  }

  private async distributeToFeeds(activity: Activity): Promise<void> {
    const preferences = this.preferences.get(activity.actorId);
    const typesToDistribute = preferences?.homeFeed?.types || ['post', 'comment', 'like', 'follow', 'mention'];

    if (!typesToDistribute.includes(activity.type)) {
      return;
    }

    const relevantFeeds = await this.findRelevantFeeds(activity);

    for (const feed of relevantFeeds) {
      await this.addToFeedInternal(feed.id, activity);
    }

    await this.publishUpdate('__all__', 'new', [activity.id], [activity]);
  }

  private async findRelevantFeeds(_activity: Activity): Promise<Feed[]> {
    return [];
  }

  private async addToFeedInternal(feedId: string, activity: Activity): Promise<void> {
    const feedItem: FeedItem = {
      id: generateId('fi'),
      feedId,
      activityId: activity.id,
      activity,
      visibility: 'public',
      addedAt: new Date(),
    };

    await this.feedStore.addFeedItem(feedId, feedItem);
    this.cache.invalidateByFeedId(feedId);
  }

  private async notifyFeedsOfUpdate(activity: Activity, type: RealTimeUpdateType): Promise<void> {
    await this.publishUpdate('__all__', type, [activity.id], [activity]);
  }

  private getCacheKey(feedId: string, filter?: FeedFilter): string {
    return `${feedId}:${JSON.stringify(filter || {})}`;
  }

  async aggregateFeedItems(feedId: string, aggregation: Omit<FeedAggregation, 'id'>): Promise<FeedAggregation> {
    const agg: FeedAggregation = {
      ...aggregation,
      id: generateId('fagg'),
    };

    this.aggregations.set(agg.id, agg);
    return agg;
  }

  getAggregation(id: string): FeedAggregation | undefined {
    return this.aggregations.get(id);
  }

  async hideActivity(activityId: string): Promise<Activity> {
    return this.updateActivity(activityId, { status: 'hidden' });
  }

  async unhideActivity(activityId: string): Promise<Activity> {
    return this.updateActivity(activityId, { status: 'active' });
  }

  async archiveActivity(activityId: string): Promise<Activity> {
    return this.updateActivity(activityId, { status: 'archived' });
  }

  async getHomeFeed(userId: string, filter?: FeedFilter): Promise<FeedItem[]> {
    const userFeeds = await this.getUserFeeds(userId);
    const homeFeed = userFeeds.find((f) => f.type === 'home');

    if (!homeFeed) {
      const newFeed = await this.createFeed(userId, 'home', 'Home Feed');
      return this.getFeedItems(newFeed.id, filter);
    }

    return this.getFeedItems(homeFeed.id, filter);
  }

  async getUserFeed(userId: string, filter?: FeedFilter): Promise<FeedItem[]> {
    const userFeeds = await this.getUserFeeds(userId);
    const userFeed = userFeeds.find((f) => f.type === 'user');

    if (!userFeed) {
      const newFeed = await this.createFeed(userId, 'user', `${userId}'s Feed`);
      return this.getFeedItems(newFeed.id, filter);
    }

    return this.getFeedItems(userFeed.id, filter);
  }

  async getNotificationFeed(userId: string, filter?: FeedFilter): Promise<FeedItem[]> {
    const userFeeds = await this.getUserFeeds(userId);
    const notifFeed = userFeeds.find((f) => f.type === 'notification');

    if (!notifFeed) {
      const newFeed = await this.createFeed(userId, 'notification', 'Notifications');
      return this.getFeedItems(newFeed.id, filter);
    }

    return this.getFeedItems(notifFeed.id, filter);
  }

  async markAsRead(_feedId: string, _activityId: string): Promise<void> {
  }

  async clearFeed(feedId: string): Promise<void> {
    const feed = await this.feedStore.getFeed(feedId);
    if (feed) {
      feed.itemCount = 0;
      feed.lastUpdatedAt = new Date();
      await this.feedStore.saveFeed(feed);
      await this.feedStore.clearFeedItems(feedId);
      this.cache.invalidateByFeedId(feedId);
    }
  }

  invalidateCache(feedId: string): void {
    this.cache.invalidateByFeedId(feedId);
  }

  clearAllCache(): void {
    this.cache.clear();
  }
}

export function createActivityFeedManager(config?: Partial<ActivityFeedConfig>): ActivityFeedManager {
  return new ActivityFeedManager(config);
}

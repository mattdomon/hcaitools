export type ActivityType = 'post' | 'comment' | 'like' | 'follow' | 'mention';

export type FeedType = 'home' | 'user' | 'notification';

export type ActivityStatus = 'active' | 'hidden' | 'deleted' | 'archived';

export type RealTimeUpdateType = 'new' | 'update' | 'delete' | 'aggregation';

export interface ActivityActor {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface ActivityTarget {
  id: string;
  type: string;
  title?: string;
  url?: string;
}

export interface ActivityContent {
  text?: string;
  mediaUrls?: string[];
  metadata?: Record<string, unknown>;
}

export interface Activity {
  id: string;
  type: ActivityType;
  actorId: string;
  actor: ActivityActor;
  targetId?: string;
  target?: ActivityTarget;
  content?: ActivityContent;
  metadata?: Record<string, unknown>;
  status: ActivityStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface FeedItem {
  id: string;
  feedId: string;
  activityId: string;
  activity: Activity;
  aggregatedCount?: number;
  aggregatedActivities?: Activity[];
  visibility: 'public' | 'friends' | 'private';
  addedAt: Date;
}

export interface Feed {
  id: string;
  userId: string;
  type: FeedType;
  name?: string;
  description?: string;
  itemCount: number;
  lastUpdatedAt: Date;
  createdAt: Date;
}

export interface FeedFilter {
  types?: ActivityType[];
  actorIds?: string[];
  targetIds?: string[];
  startDate?: Date;
  endDate?: Date;
  status?: ActivityStatus;
  limit?: number;
  offset?: number;
}

export interface FeedAggregation {
  id: string;
  feedId: string;
  activityType: ActivityType;
  primaryActivityId: string;
  aggregatedActivityIds: string[];
  count: number;
  latestAt: Date;
}

export interface RealTimeUpdate {
  id: string;
  type: RealTimeUpdateType;
  feedId: string;
  activityId?: string;
  activities?: Activity[];
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface FeedPreferences {
  userId: string;
  homeFeed: {
    enabled: boolean;
    types: ActivityType[];
    showReplies: boolean;
    showFollows: boolean;
  };
  userFeed: {
    enabled: boolean;
    showLikes: boolean;
    showComments: boolean;
  };
  notificationFeed: {
    enabled: boolean;
    mentionNotifications: boolean;
    followNotifications: boolean;
  };
}

export interface FeedCache {
  key: string;
  feedId: string;
  items: FeedItem[];
  itemCount: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface ActivityFeedConfig {
  maxFeedSize: number;
  maxAggregationWindowMs: number;
  cacheTtlMs: number;
  realTimeUpdateIntervalMs: number;
}

export interface IActivityStore {
  saveActivity(activity: Activity): Promise<Activity>;
  getActivity(id: string): Promise<Activity | undefined>;
  deleteActivity(id: string): Promise<boolean>;
  getActivitiesByActor(actorId: string, limit?: number): Promise<Activity[]>;
}

export interface IFeedStore {
  saveFeed(feed: Feed): Promise<Feed>;
  getFeed(id: string): Promise<Feed | undefined>;
  deleteFeed(id: string): Promise<boolean>;
  getAllFeeds(): Promise<Feed[]>;
  clearFeedItems(feedId: string): Promise<void>;
  addFeedItem(feedId: string, item: FeedItem): Promise<void>;
  getFeedItems(feedId: string, filter?: FeedFilter): Promise<FeedItem[]>;
  removeFeedItem(feedId: string, activityId: string): Promise<boolean>;
}

export interface IFeedCache {
  get(key: string): FeedCache | undefined;
  set(cache: FeedCache): void;
  invalidate(key: string): void;
  invalidateByFeedId(feedId: string): void;
  clear(): void;
}

export interface IRealTimePublisher {
  publish(update: RealTimeUpdate): Promise<void>;
  subscribe(feedId: string, callback: (update: RealTimeUpdate) => void): () => void;
}

export interface IActivityAggregator {
  aggregate(feedId: string, activities: Activity[]): Activity[];
  shouldAggregate(activity1: Activity, activity2: Activity): boolean;
  createAggregatedActivity(activities: Activity[]): Activity;
}

export function isActivity(obj: unknown): obj is Activity {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const activity = obj as Record<string, unknown>;
  return (
    typeof activity.id === 'string' &&
    typeof activity.type === 'string' &&
    typeof activity.actorId === 'string' &&
    typeof activity.status === 'string'
  );
}

export function isFeedItem(obj: unknown): obj is FeedItem {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const item = obj as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.feedId === 'string' &&
    typeof item.activityId === 'string'
  );
}

export function isFeed(obj: unknown): obj is Feed {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const feed = obj as Record<string, unknown>;
  return (
    typeof feed.id === 'string' &&
    typeof feed.userId === 'string' &&
    typeof feed.type === 'string'
  );
}

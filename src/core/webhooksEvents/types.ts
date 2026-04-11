export type WebhookDeliveryMode = 'sync' | 'async' | 'batch';
export type SubscriptionType = 'persistent' | 'transient';
export type DeliveryStatus = 'pending' | 'delivered' | 'failed' | 'retried';
export type EventDeliveryPriority = 'high' | 'normal' | 'low';

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  status: DeliveryStatus;
  attempts: number;
  maxAttempts: number;
  payload: unknown;
  response?: {
    statusCode: number;
    body?: string;
    headers?: Record<string, string>;
  };
  error?: {
    message: string;
    code?: string;
  };
  nextRetryAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEvent {
  id: string;
  type: string;
  source: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  orderingKey?: string;
  delivered: boolean;
  replayed: boolean;
}

export interface EventSubscription {
  id: string;
  name: string;
  webhookId: string;
  eventTypes: string[];
  filter?: EventFilter;
  type: SubscriptionType;
  priority: EventDeliveryPriority;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventFilter {
  byType?: string[];
  bySource?: string[];
  byContent?: Record<string, unknown>;
  byMetadata?: Record<string, unknown>;
}

export interface EventTransformer {
  id: string;
  name: string;
  transform: (event: WebhookEvent) => WebhookEvent | Promise<WebhookEvent>;
  filter?: EventFilter;
  priority: number;
  enabled: boolean;
}

export interface EventOrdering {
  eventId: string;
  key: string;
  sequence: number;
  previousEventId?: string;
  nextEventId?: string;
}

export interface EventReplayOptions {
  fromTimestamp?: Date;
  toTimestamp?: Date;
  eventTypes?: string[];
  sources?: string[];
  limit?: number;
  preserveOrdering: boolean;
}

export interface DeliveryOptions {
  mode?: WebhookDeliveryMode;
  timeout?: number;
  retries?: number;
  batchSize?: number;
  batchDelay?: number;
  priority?: EventDeliveryPriority;
}

export interface WebhookCreateInput {
  url: string;
  secret?: string;
  metadata?: Record<string, unknown>;
}

export interface WebhookUpdateInput {
  url?: string;
  secret?: string;
  metadata?: Record<string, unknown>;
}

export interface SubscriptionCreateInput {
  name: string;
  webhookId: string;
  eventTypes: string[];
  filter?: EventFilter;
  type?: SubscriptionType;
  priority?: EventDeliveryPriority;
}

export interface SubscriptionUpdateInput {
  name?: string;
  eventTypes?: string[];
  filter?: EventFilter;
  type?: SubscriptionType;
  priority?: EventDeliveryPriority;
  enabled?: boolean;
}

export interface TransformerCreateInput {
  name: string;
  transform: (event: WebhookEvent) => WebhookEvent | Promise<WebhookEvent>;
  filter?: EventFilter;
  priority?: number;
}

export interface TransformerUpdateInput {
  name?: string;
  transform?: (event: WebhookEvent) => WebhookEvent | Promise<WebhookEvent>;
  filter?: EventFilter;
  priority?: number;
  enabled?: boolean;
}

export interface EventHistoryEntry {
  eventId: string;
  action: 'published' | 'delivered' | 'failed' | 'replayed' | 'transformed';
  timestamp: Date;
  details?: Record<string, unknown>;
}

export interface PubSubMessage {
  id: string;
  event: WebhookEvent;
  subscriptionId: string;
  deliveryStatus: DeliveryStatus;
  timestamp: Date;
}

export interface WebhookEventsConfig {
  maxDeliveryAttempts: number;
  defaultDeliveryTimeout: number;
  defaultBatchSize: number;
  defaultBatchDelay: number;
  enableEventOrdering: boolean;
  enableEventReplay: boolean;
  enableEventHistory: boolean;
}

export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatuses: number[];
}

export interface DeliveryResult {
  success: boolean;
  deliveryId: string;
  attempts: number;
  response?: {
    statusCode: number;
    body?: string;
    headers?: Record<string, string>;
  };
  error?: {
    message: string;
    code?: string;
  };
}

export interface BatchDeliveryResult {
  results: DeliveryResult[];
  totalAttempts: number;
  successCount: number;
  failureCount: number;
}

export interface EventBus {
  publish(event: WebhookEvent): Promise<string>;
  subscribe(subscription: EventSubscription, handler: EventHandler): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;
  unsubscribeAll(webhookId: string): Promise<void>;
}

export interface EventHandler {
  (event: WebhookEvent, context: EventHandlerContext): Promise<void>;
}

export interface EventHandlerContext {
  subscription: EventSubscription;
  delivery: WebhookDelivery;
  retryCount: number;
}

export interface WebhookManager {
  createWebhook(input: WebhookCreateInput): Promise<WebhookEndpoint>;
  updateWebhook(id: string, input: WebhookUpdateInput): Promise<WebhookEndpoint>;
  deleteWebhook(id: string): Promise<void>;
  getWebhook(id: string): Promise<WebhookEndpoint | null>;
  listWebhooks(): Promise<WebhookEndpoint[]>;
}

export interface SubscriptionManager {
  createSubscription(input: SubscriptionCreateInput): Promise<EventSubscription>;
  updateSubscription(id: string, input: SubscriptionUpdateInput): Promise<EventSubscription>;
  deleteSubscription(id: string): Promise<void>;
  getSubscription(id: string): Promise<EventSubscription | null>;
  listSubscriptions(webhookId?: string): Promise<EventSubscription[]>;
  enableSubscription(id: string): Promise<void>;
  disableSubscription(id: string): Promise<void>;
}

export interface DeliveryManager {
  deliverEvent(event: WebhookEvent, options?: DeliveryOptions): Promise<DeliveryResult>;
  deliverBatch(events: WebhookEvent[], options?: DeliveryOptions): Promise<BatchDeliveryResult>;
  retryDelivery(deliveryId: string): Promise<DeliveryResult>;
  getDelivery(id: string): Promise<WebhookDelivery | null>;
  listDeliveries(webhookId: string, status?: DeliveryStatus): Promise<WebhookDelivery[]>;
  cancelDelivery(deliveryId: string): Promise<void>;
}

export interface EventReplayManager {
  replayEvents(options: EventReplayOptions): Promise<string[]>;
  getReplayStatus(replayId: string): Promise<{
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    eventsReplayed: number;
    eventsFailed: number;
    startedAt?: Date;
    completedAt?: Date;
  } | null>;
  getEventHistory(eventId: string): Promise<EventHistoryEntry[]>;
  clearEventHistory(eventId: string): Promise<void>;
}

export interface TransformerManager {
  createTransformer(input: TransformerCreateInput): Promise<EventTransformer>;
  updateTransformer(id: string, input: TransformerUpdateInput): Promise<EventTransformer>;
  deleteTransformer(id: string): Promise<void>;
  getTransformer(id: string): Promise<EventTransformer | null>;
  listTransformers(): Promise<EventTransformer[]>;
}

export interface OrderingManager {
  setOrdering(eventId: string, key: string, sequence: number): Promise<EventOrdering>;
  getOrdering(eventId: string): Promise<EventOrdering | null>;
  getNextEvent(currentEventId: string): Promise<WebhookEvent | null>;
  getPreviousEvent(currentEventId: string): Promise<WebhookEvent | null>;
  getEventsInOrder(key: string): Promise<WebhookEvent[]>;
  deleteOrdering(eventId: string): Promise<void>;
}

export type WebhookEventsModule = WebhookManager & SubscriptionManager & DeliveryManager & EventReplayManager & TransformerManager & OrderingManager & EventBus;

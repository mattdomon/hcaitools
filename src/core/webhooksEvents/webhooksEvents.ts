import crypto from 'crypto';
import {
  WebhookEndpoint,
  WebhookDelivery,
  WebhookEvent,
  EventSubscription,
  EventFilter,
  EventTransformer,
  EventOrdering,
  EventReplayOptions,
  DeliveryOptions,
  WebhookCreateInput,
  WebhookUpdateInput,
  SubscriptionCreateInput,
  SubscriptionUpdateInput,
  TransformerCreateInput,
  TransformerUpdateInput,
  EventHistoryEntry,
  WebhookEventsConfig,
  RetryPolicy,
  DeliveryResult,
  BatchDeliveryResult,
  EventHandler,
  EventHandlerContext,
  WebhookEventsModule,
  DeliveryStatus,
} from './types';

const generateId = (prefix: string): string => {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
};

const defaultConfig: WebhookEventsConfig = {
  maxDeliveryAttempts: 3,
  defaultDeliveryTimeout: 30000,
  defaultBatchSize: 10,
  defaultBatchDelay: 1000,
  enableEventOrdering: true,
  enableEventReplay: true,
  enableEventHistory: true,
};

const defaultRetryPolicy: RetryPolicy = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

export class WebhooksEventsImpl implements WebhookEventsModule {
  private webhooks: Map<string, WebhookEndpoint> = new Map();
  private subscriptions: Map<string, EventSubscription> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();
  private transformers: Map<string, EventTransformer> = new Map();
  private eventOrderings: Map<string, EventOrdering> = new Map();
  private eventHistory: Map<string, EventHistoryEntry[]> = new Map();
  private publishedEvents: Map<string, WebhookEvent> = new Map();
  private handlers: Map<string, EventHandler> = new Map();
  private subscriptionHandlers: Map<string, string> = new Map();
  private config: WebhookEventsConfig;
  private retryPolicy: RetryPolicy;

  constructor(config: Partial<WebhookEventsConfig> = {}, retryPolicy: Partial<RetryPolicy> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.retryPolicy = { ...defaultRetryPolicy, ...retryPolicy };
  }

  async createWebhook(input: WebhookCreateInput): Promise<WebhookEndpoint> {
    const now = new Date();
    const webhook: WebhookEndpoint = {
      id: generateId('wh'),
      url: input.url,
      secret: input.secret,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    };
    this.webhooks.set(webhook.id, webhook);
    return webhook;
  }

  async updateWebhook(id: string, input: WebhookUpdateInput): Promise<WebhookEndpoint> {
    const webhook = this.webhooks.get(id);
    if (!webhook) {
      throw new Error(`Webhook not found: ${id}`);
    }
    const updated: WebhookEndpoint = {
      ...webhook,
      url: input.url ?? webhook.url,
      secret: input.secret ?? webhook.secret,
      metadata: input.metadata ?? webhook.metadata,
      updatedAt: new Date(),
    };
    this.webhooks.set(id, updated);
    return updated;
  }

  async deleteWebhook(id: string): Promise<void> {
    if (!this.webhooks.has(id)) {
      throw new Error(`Webhook not found: ${id}`);
    }
    this.webhooks.delete(id);
    await this.unsubscribeAll(id);
  }

  async getWebhook(id: string): Promise<WebhookEndpoint | null> {
    return this.webhooks.get(id) ?? null;
  }

  async listWebhooks(): Promise<WebhookEndpoint[]> {
    return Array.from(this.webhooks.values());
  }

  async createSubscription(input: SubscriptionCreateInput): Promise<EventSubscription> {
    const webhook = this.webhooks.get(input.webhookId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${input.webhookId}`);
    }
    const now = new Date();
    const subscription: EventSubscription = {
      id: generateId('sub'),
      name: input.name,
      webhookId: input.webhookId,
      eventTypes: input.eventTypes,
      filter: input.filter,
      type: input.type ?? 'persistent',
      priority: input.priority ?? 'normal',
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    this.subscriptions.set(subscription.id, subscription);
    return subscription;
  }

  async updateSubscription(id: string, input: SubscriptionUpdateInput): Promise<EventSubscription> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) {
      throw new Error(`Subscription not found: ${id}`);
    }
    const updated: EventSubscription = {
      ...subscription,
      name: input.name ?? subscription.name,
      eventTypes: input.eventTypes ?? subscription.eventTypes,
      filter: input.filter ?? subscription.filter,
      type: input.type ?? subscription.type,
      priority: input.priority ?? subscription.priority,
      enabled: input.enabled ?? subscription.enabled,
      updatedAt: new Date(),
    };
    this.subscriptions.set(id, updated);
    return updated;
  }

  async deleteSubscription(id: string): Promise<void> {
    if (!this.subscriptions.has(id)) {
      throw new Error(`Subscription not found: ${id}`);
    }
    this.subscriptions.delete(id);
    this.handlers.delete(id);
  }

  async getSubscription(id: string): Promise<EventSubscription | null> {
    return this.subscriptions.get(id) ?? null;
  }

  async listSubscriptions(webhookId?: string): Promise<EventSubscription[]> {
    const all = Array.from(this.subscriptions.values());
    if (webhookId) {
      return all.filter(s => s.webhookId === webhookId);
    }
    return all;
  }

  async enableSubscription(id: string): Promise<void> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) {
      throw new Error(`Subscription not found: ${id}`);
    }
    subscription.enabled = true;
    subscription.updatedAt = new Date();
  }

  async disableSubscription(id: string): Promise<void> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) {
      throw new Error(`Subscription not found: ${id}`);
    }
    subscription.enabled = false;
    subscription.updatedAt = new Date();
  }

  async deliverEvent(event: WebhookEvent, options?: DeliveryOptions): Promise<DeliveryResult> {
    const timeout = options?.timeout ?? this.config.defaultDeliveryTimeout;
    const maxAttempts = options?.retries ?? this.retryPolicy.maxAttempts;

    const subscriptions = this.getMatchingSubscriptions(event);
    if (subscriptions.length === 0) {
      return {
        success: false,
        deliveryId: '',
        attempts: 0,
        error: { message: 'No matching subscriptions', code: 'NO_SUBSCRIPTIONS' },
      };
    }

    const results: DeliveryResult[] = [];
    let totalAttempts = 0;

    for (const subscription of subscriptions) {
      if (!subscription.enabled) continue;

      const webhook = this.webhooks.get(subscription.webhookId);
      if (!webhook) continue;

      let eventToDeliver = event;
      if (this.config.enableEventHistory) {
        await this.addEventHistory(event.id, 'published', { subscriptionId: subscription.id });
      }

      for (const transformer of this.getEnabledTransformers()) {
        if (this.matchesFilter(eventToDeliver, transformer.filter)) {
          eventToDeliver = await transformer.transform(eventToDeliver);
          if (this.config.enableEventHistory) {
            await this.addEventHistory(event.id, 'transformed', { transformerId: transformer.id });
          }
        }
      }

      const delivery = this.createDelivery(subscription, eventToDeliver, maxAttempts);
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        totalAttempts++;
        delivery.attempts = attempt;
        
        try {
          const response = await this.executeDelivery(webhook.url, eventToDeliver, timeout);
          
          delivery.status = 'delivered';
          delivery.response = response;
          delivery.deliveredAt = new Date();
          this.deliveries.set(delivery.id, delivery);

          if (this.config.enableEventHistory) {
            await this.addEventHistory(event.id, 'delivered', { deliveryId: delivery.id, attempt });
          }

          results.push({
            success: true,
            deliveryId: delivery.id,
            attempts: attempt,
            response,
          });
          break;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          delivery.error = { message: errorMessage };
          
          if (attempt < maxAttempts) {
            delivery.status = 'retried';
            delivery.nextRetryAt = this.calculateNextRetry(attempt);
          } else {
            delivery.status = 'failed';
          }
          this.deliveries.set(delivery.id, delivery);

          if (this.config.enableEventHistory) {
            await this.addEventHistory(event.id, 'failed', { deliveryId: delivery.id, attempt, error: errorMessage });
          }

          if (attempt === maxAttempts) {
            results.push({
              success: false,
              deliveryId: delivery.id,
              attempts: attempt,
              error: { message: errorMessage },
            });
          }
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    return {
      success: successCount > 0,
      deliveryId: results[0]?.deliveryId ?? '',
      attempts: totalAttempts,
      response: results[0]?.response,
      error: successCount === 0 ? results[0]?.error : undefined,
    };
  }

  async deliverBatch(events: WebhookEvent[], options?: DeliveryOptions): Promise<BatchDeliveryResult> {
    const batchSize = options?.batchSize ?? this.config.defaultBatchSize;
    const batchDelay = options?.batchDelay ?? this.config.defaultBatchDelay;

    const results: DeliveryResult[] = [];
    let totalAttempts = 0;

    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      
      for (const event of batch) {
        const result = await this.deliverEvent(event, { ...options, mode: 'async' });
        results.push(result);
        totalAttempts += result.attempts;
      }

      if (i + batchSize < events.length && batchDelay > 0) {
        await this.delay(batchDelay);
      }
    }

    const successCount = results.filter(r => r.success).length;
    return {
      results,
      totalAttempts,
      successCount,
      failureCount: results.length - successCount,
    };
  }

  async retryDelivery(deliveryId: string): Promise<DeliveryResult> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) {
      throw new Error(`Delivery not found: ${deliveryId}`);
    }

    const event = this.publishedEvents.get(delivery.eventId);
    if (!event) {
      throw new Error(`Event not found: ${delivery.eventId}`);
    }

    const subscription = this.subscriptions.get(delivery.webhookId.replace('wh_', 'sub_'));
    if (!subscription) {
      throw new Error(`Subscription not found for delivery`);
    }

    const webhook = this.webhooks.get(subscription.webhookId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${subscription.webhookId}`);
    }

    delivery.attempts++;
    delivery.status = 'pending';
    delivery.error = undefined;
    this.deliveries.set(deliveryId, delivery);

    try {
      const response = await this.executeDelivery(webhook.url, event, this.config.defaultDeliveryTimeout);
      delivery.status = 'delivered';
      delivery.response = response;
      delivery.deliveredAt = new Date();
      this.deliveries.set(deliveryId, delivery);

      if (this.config.enableEventHistory) {
        await this.addEventHistory(event.id, 'delivered', { deliveryId, attempt: delivery.attempts });
      }

      return {
        success: true,
        deliveryId,
        attempts: delivery.attempts,
        response,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      delivery.error = { message: errorMessage };
      delivery.status = 'failed';
      this.deliveries.set(deliveryId, delivery);

      if (this.config.enableEventHistory) {
        await this.addEventHistory(event.id, 'failed', { deliveryId, attempt: delivery.attempts, error: errorMessage });
      }

      return {
        success: false,
        deliveryId,
        attempts: delivery.attempts,
        error: { message: errorMessage },
      };
    }
  }

  async getDelivery(id: string): Promise<WebhookDelivery | null> {
    return this.deliveries.get(id) ?? null;
  }

  async listDeliveries(webhookId: string, status?: DeliveryStatus): Promise<WebhookDelivery[]> {
    const all = Array.from(this.deliveries.values()).filter(d => d.webhookId === webhookId);
    if (status) {
      return all.filter(d => d.status === status);
    }
    return all;
  }

  async cancelDelivery(deliveryId: string): Promise<void> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) {
      throw new Error(`Delivery not found: ${deliveryId}`);
    }
    if (delivery.status === 'delivered') {
      throw new Error(`Cannot cancel delivered event`);
    }
    delivery.status = 'failed';
    delivery.error = { message: 'Cancelled by user', code: 'CANCELLED' };
    this.deliveries.set(deliveryId, delivery);
  }

  async replayEvents(options: EventReplayOptions): Promise<string[]> {
    if (!this.config.enableEventReplay) {
      throw new Error('Event replay is disabled');
    }

    const replayId = generateId('replay');
    let events = Array.from(this.publishedEvents.values());

    if (options.fromTimestamp) {
      events = events.filter(e => e.timestamp >= options.fromTimestamp!);
    }
    if (options.toTimestamp) {
      events = events.filter(e => e.timestamp <= options.toTimestamp!);
    }
    if (options.eventTypes && options.eventTypes.length > 0) {
      events = events.filter(e => options.eventTypes!.includes(e.type));
    }
    if (options.sources && options.sources.length > 0) {
      events = events.filter(e => options.sources!.includes(e.source));
    }
    if (options.limit) {
      events = events.slice(0, options.limit);
    }

    const replayedIds: string[] = [];
    
    for (const event of events) {
      const replayedEvent: WebhookEvent = {
        ...event,
        id: generateId('evt'),
        timestamp: new Date(),
        replayed: true,
      };
      this.publishedEvents.set(replayedEvent.id, replayedEvent);
      replayedIds.push(replayedEvent.id);

      if (this.config.enableEventHistory) {
        await this.addEventHistory(replayedEvent.id, 'replayed', {
          originalEventId: event.id,
          replayId,
        });
      }

      if (options.preserveOrdering && event.orderingKey) {
        await this.setOrdering(replayedEvent.id, event.orderingKey, 0);
      }

      await this.deliverEvent(replayedEvent);
    }

    return replayedIds;
  }

  async getReplayStatus(replayId: string): Promise<{
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    eventsReplayed: number;
    eventsFailed: number;
    startedAt?: Date;
    completedAt?: Date;
  } | null> {
    const events = Array.from(this.publishedEvents.values()).filter(e => 
      e.replayed && e.metadata?.replayId === replayId
    );
    
    if (events.length === 0) {
      return null;
    }

    const failedCount = events.filter(e => e.metadata?.status === 'failed').length;
    
    return {
      status: 'completed',
      eventsReplayed: events.length,
      eventsFailed: failedCount,
      startedAt: events[0]?.metadata?.startedAt as Date | undefined,
      completedAt: new Date(),
    };
  }

  async getEventHistory(eventId: string): Promise<EventHistoryEntry[]> {
    return this.eventHistory.get(eventId) ?? [];
  }

  async clearEventHistory(eventId: string): Promise<void> {
    this.eventHistory.delete(eventId);
  }

  async createTransformer(input: TransformerCreateInput): Promise<EventTransformer> {
    const transformer: EventTransformer = {
      id: generateId('xfrm'),
      name: input.name,
      transform: input.transform,
      filter: input.filter,
      priority: input.priority ?? 0,
      enabled: true,
    };
    this.transformers.set(transformer.id, transformer);
    return transformer;
  }

  async updateTransformer(id: string, input: TransformerUpdateInput): Promise<EventTransformer> {
    const transformer = this.transformers.get(id);
    if (!transformer) {
      throw new Error(`Transformer not found: ${id}`);
    }
    const updated: EventTransformer = {
      ...transformer,
      name: input.name ?? transformer.name,
      transform: input.transform ?? transformer.transform,
      filter: input.filter ?? transformer.filter,
      priority: input.priority ?? transformer.priority,
      enabled: input.enabled ?? transformer.enabled,
    };
    this.transformers.set(id, updated);
    return updated;
  }

  async deleteTransformer(id: string): Promise<void> {
    if (!this.transformers.has(id)) {
      throw new Error(`Transformer not found: ${id}`);
    }
    this.transformers.delete(id);
  }

  async getTransformer(id: string): Promise<EventTransformer | null> {
    return this.transformers.get(id) ?? null;
  }

  async listTransformers(): Promise<EventTransformer[]> {
    return Array.from(this.transformers.values());
  }

  async setOrdering(eventId: string, key: string, sequence: number): Promise<EventOrdering> {
    if (!this.config.enableEventOrdering) {
      throw new Error('Event ordering is disabled');
    }

    const existingOrdering = this.eventOrderings.get(eventId);
    const ordering: EventOrdering = {
      eventId,
      key,
      sequence,
      previousEventId: existingOrdering?.previousEventId,
      nextEventId: existingOrdering?.nextEventId,
    };

    const eventsWithSameKey = Array.from(this.eventOrderings.values()).filter(o => o.key === key);
    const previousEvent = eventsWithSameKey
      .filter(o => o.sequence < sequence)
      .sort((a, b) => b.sequence - a.sequence)[0];

    if (previousEvent) {
      ordering.previousEventId = previousEvent.eventId;
      previousEvent.nextEventId = eventId;
      this.eventOrderings.set(previousEvent.eventId, previousEvent);
    }

    const nextEvent = eventsWithSameKey
      .filter(o => o.sequence > sequence)
      .sort((a, b) => a.sequence - b.sequence)[0];

    if (nextEvent) {
      ordering.nextEventId = nextEvent.eventId;
      nextEvent.previousEventId = eventId;
      this.eventOrderings.set(nextEvent.eventId, nextEvent);
    }

    this.eventOrderings.set(eventId, ordering);
    return ordering;
  }

  async getOrdering(eventId: string): Promise<EventOrdering | null> {
    return this.eventOrderings.get(eventId) ?? null;
  }

  async getNextEvent(currentEventId: string): Promise<WebhookEvent | null> {
    const ordering = this.eventOrderings.get(currentEventId);
    if (!ordering?.nextEventId) {
      return null;
    }
    return this.publishedEvents.get(ordering.nextEventId) ?? null;
  }

  async getPreviousEvent(currentEventId: string): Promise<WebhookEvent | null> {
    const ordering = this.eventOrderings.get(currentEventId);
    if (!ordering?.previousEventId) {
      return null;
    }
    return this.publishedEvents.get(ordering.previousEventId) ?? null;
  }

  async getEventsInOrder(key: string): Promise<WebhookEvent[]> {
    const orderings = Array.from(this.eventOrderings.values())
      .filter(o => o.key === key)
      .sort((a, b) => a.sequence - b.sequence);

    const events: WebhookEvent[] = [];
    for (const ordering of orderings) {
      const event = this.publishedEvents.get(ordering.eventId);
      if (event) {
        events.push(event);
      }
    }
    return events;
  }

  async deleteOrdering(eventId: string): Promise<void> {
    const ordering = this.eventOrderings.get(eventId);
    if (!ordering) return;

    if (ordering.previousEventId) {
      const prev = this.eventOrderings.get(ordering.previousEventId);
      if (prev) {
        prev.nextEventId = ordering.nextEventId;
        this.eventOrderings.set(ordering.previousEventId, prev);
      }
    }

    if (ordering.nextEventId) {
      const next = this.eventOrderings.get(ordering.nextEventId);
      if (next) {
        next.previousEventId = ordering.previousEventId;
        this.eventOrderings.set(ordering.nextEventId, next);
      }
    }

    this.eventOrderings.delete(eventId);
  }

  async publish(event: WebhookEvent): Promise<string> {
    const eventToStore: WebhookEvent = {
      ...event,
      id: event.id || generateId('evt'),
      timestamp: event.timestamp || new Date(),
      delivered: false,
      replayed: false,
    };

    this.publishedEvents.set(eventToStore.id, eventToStore);

    if (this.config.enableEventOrdering && eventToStore.orderingKey) {
      await this.setOrdering(eventToStore.id, eventToStore.orderingKey, Date.now());
    }

    const matchingSubscriptions = this.getMatchingSubscriptions(eventToStore);
    
    for (const subscription of matchingSubscriptions) {
      if (!subscription.enabled) continue;

      const handler = this.handlers.get(subscription.id);
      if (handler) {
        const delivery = this.createDelivery(subscription, eventToStore, this.retryPolicy.maxAttempts);
        
        const context: EventHandlerContext = {
          subscription,
          delivery,
          retryCount: 0,
        };

        try {
          await handler(eventToStore, context);
          eventToStore.delivered = true;
          this.publishedEvents.set(eventToStore.id, eventToStore);
        } catch {
          eventToStore.delivered = false;
          this.publishedEvents.set(eventToStore.id, eventToStore);
        }
      }
    }

    return eventToStore.id;
  }

  async subscribe(subscription: EventSubscription, handler: EventHandler): Promise<string> {
    this.handlers.set(subscription.id, handler);
    this.subscriptionHandlers.set(subscription.id, subscription.id);
    return subscription.id;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    this.handlers.delete(subscriptionId);
    this.subscriptionHandlers.delete(subscriptionId);
  }

  async unsubscribeAll(webhookId: string): Promise<void> {
    const subscriptions = Array.from(this.subscriptions.values()).filter(s => s.webhookId === webhookId);
    for (const subscription of subscriptions) {
      await this.unsubscribe(subscription.id);
      this.subscriptions.delete(subscription.id);
    }
  }

  private getMatchingSubscriptions(event: WebhookEvent): EventSubscription[] {
    const all = Array.from(this.subscriptions.values());
    return all.filter(subscription => {
      if (!subscription.eventTypes.includes(event.type) && !subscription.eventTypes.includes('*')) {
        return false;
      }
      if (subscription.filter && !this.matchesFilter(event, subscription.filter)) {
        return false;
      }
      return true;
    });
  }

  private matchesFilter(event: WebhookEvent, filter?: EventFilter): boolean {
    if (!filter) return true;

    if (filter.bySource && filter.bySource.length > 0 && !filter.bySource.includes(event.source)) {
      return false;
    }

    if (filter.byType && filter.byType.length > 0 && !filter.byType.includes(event.type)) {
      return false;
    }

    if (filter.byContent && event.payload) {
      for (const [key, value] of Object.entries(filter.byContent)) {
        const payloadValue = (event.payload as Record<string, unknown>)?.[key];
        if (payloadValue !== value) {
          return false;
        }
      }
    }

    if (filter.byMetadata && event.metadata) {
      for (const [key, value] of Object.entries(filter.byMetadata)) {
        const metadataValue = event.metadata[key];
        if (metadataValue !== value) {
          return false;
        }
      }
    }

    return true;
  }

  private getEnabledTransformers(): EventTransformer[] {
    return Array.from(this.transformers.values())
      .filter(t => t.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  private createDelivery(subscription: EventSubscription, event: WebhookEvent, maxAttempts: number): WebhookDelivery {
    const delivery: WebhookDelivery = {
      id: generateId('dlv'),
      webhookId: subscription.webhookId,
      eventId: event.id,
      status: 'pending',
      attempts: 0,
      maxAttempts,
      payload: event.payload,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.deliveries.set(delivery.id, delivery);
    return delivery;
  }

  private async executeDelivery(
    url: string,
    event: WebhookEvent,
    timeout: number
  ): Promise<{ statusCode: number; body?: string; headers?: Record<string, string> }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Delivery timeout'));
      }, timeout);

      setTimeout(() => {
        clearTimeout(timer);
        if (url.startsWith('http')) {
          resolve({ statusCode: 200, body: 'OK', headers: {} });
        } else {
          resolve({ statusCode: 200, body: 'OK', headers: {} });
        }
      }, 10);
    });
  }

  private calculateNextRetry(attempt: number): Date {
    const delay = Math.min(
      this.retryPolicy.initialDelayMs * Math.pow(this.retryPolicy.backoffMultiplier, attempt - 1),
      this.retryPolicy.maxDelayMs
    );
    return new Date(Date.now() + delay);
  }

  private async addEventHistory(
    eventId: string,
    action: EventHistoryEntry['action'],
    details?: Record<string, unknown>
  ): Promise<void> {
    const entry: EventHistoryEntry = {
      eventId,
      action,
      timestamp: new Date(),
      details,
    };
    const existing = this.eventHistory.get(eventId) ?? [];
    existing.push(entry);
    this.eventHistory.set(eventId, existing);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const createWebhookEventsModule = (
  config?: Partial<WebhookEventsConfig>,
  retryPolicy?: Partial<RetryPolicy>
): WebhookEventsModule => {
  return new WebhooksEventsImpl(config, retryPolicy);
};

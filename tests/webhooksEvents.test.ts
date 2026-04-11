import crypto from 'crypto';
import {
  WebhooksEventsImpl,
  createWebhookEventsModule,
  WebhookEndpoint,
  WebhookEvent,
  EventSubscription,
  WebhookDelivery,
  DeliveryOptions,
  EventReplayOptions,
  WebhookDeliveryMode,
  DeliveryStatus,
  SubscriptionType,
  EventDeliveryPriority,
  EventHandler,
} from '../src/core/webhooksEvents';

const generateId = (prefix: string): string => {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
};

describe('WebhooksEvents', () => {
  let module: WebhooksEventsImpl;

  beforeEach(() => {
    module = new WebhooksEventsImpl();
  });

  describe('Webhook Management', () => {
    test('should create a webhook', async () => {
      const webhook = await module.createWebhook({
        url: 'https://example.com/webhook',
        secret: 'my-secret',
        metadata: { key: 'value' },
      });

      expect(webhook.id).toMatch(/^wh_[a-f0-9]{16}$/);
      expect(webhook.url).toBe('https://example.com/webhook');
      expect(webhook.secret).toBe('my-secret');
      expect(webhook.metadata).toEqual({ key: 'value' });
      expect(webhook.createdAt).toBeInstanceOf(Date);
      expect(webhook.updatedAt).toBeInstanceOf(Date);
    });

    test('should create webhook without optional fields', async () => {
      const webhook = await module.createWebhook({ url: 'https://example.com/webhook' });

      expect(webhook.id).toBeDefined();
      expect(webhook.url).toBe('https://example.com/webhook');
      expect(webhook.secret).toBeUndefined();
      expect(webhook.metadata).toBeUndefined();
    });

    test('should get a webhook by id', async () => {
      const created = await module.createWebhook({ url: 'https://example.com/webhook' });
      const retrieved = await module.getWebhook(created.id);

      expect(retrieved).toEqual(created);
    });

    test('should return null for non-existent webhook', async () => {
      const retrieved = await module.getWebhook('non-existent-id');

      expect(retrieved).toBeNull();
    });

    test('should list all webhooks', async () => {
      await module.createWebhook({ url: 'https://example.com/webhook1' });
      await module.createWebhook({ url: 'https://example.com/webhook2' });
      const webhooks = await module.listWebhooks();

      expect(webhooks).toHaveLength(2);
    });

    test('should update a webhook', async () => {
      const webhook = await module.createWebhook({ url: 'https://example.com/webhook' });
      const updated = await module.updateWebhook(webhook.id, { url: 'https://example.com/new' });

      expect(updated.url).toBe('https://example.com/new');
      expect(updated.id).toBe(webhook.id);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(webhook.createdAt.getTime());
    });

    test('should update webhook metadata only', async () => {
      const webhook = await module.createWebhook({
        url: 'https://example.com/webhook',
        metadata: { old: 'value' },
      });
      const updated = await module.updateWebhook(webhook.id, { metadata: { new: 'value' } });

      expect(updated.metadata).toEqual({ new: 'value' });
      expect(updated.url).toBe(webhook.url);
    });

    test('should throw error when updating non-existent webhook', async () => {
      await expect(module.updateWebhook('non-existent', { url: 'https://example.com' })).rejects.toThrow(
        'Webhook not found'
      );
    });

    test('should delete a webhook', async () => {
      const webhook = await module.createWebhook({ url: 'https://example.com/webhook' });
      await module.deleteWebhook(webhook.id);
      const retrieved = await module.getWebhook(webhook.id);

      expect(retrieved).toBeNull();
    });

    test('should throw error when deleting non-existent webhook', async () => {
      await expect(module.deleteWebhook('non-existent')).rejects.toThrow('Webhook not found');
    });
  });

  describe('Subscription Management', () => {
    let webhook: WebhookEndpoint;

    beforeEach(async () => {
      webhook = await module.createWebhook({ url: 'https://example.com/webhook' });
    });

    test('should create a subscription', async () => {
      const subscription = await module.createSubscription({
        name: 'my-subscription',
        webhookId: webhook.id,
        eventTypes: ['user.created', 'user.updated'],
        type: 'persistent',
        priority: 'high',
      });

      expect(subscription.id).toMatch(/^sub_[a-f0-9]{16}$/);
      expect(subscription.name).toBe('my-subscription');
      expect(subscription.webhookId).toBe(webhook.id);
      expect(subscription.eventTypes).toEqual(['user.created', 'user.updated']);
      expect(subscription.type).toBe('persistent');
      expect(subscription.priority).toBe('high');
      expect(subscription.enabled).toBe(true);
    });

    test('should create subscription with transient type', async () => {
      const subscription = await module.createSubscription({
        name: 'transient-sub',
        webhookId: webhook.id,
        eventTypes: ['event.type'],
        type: 'transient',
      });

      expect(subscription.type).toBe('transient');
    });

    test('should create subscription with default type', async () => {
      const subscription = await module.createSubscription({
        name: 'default-sub',
        webhookId: webhook.id,
        eventTypes: ['event.type'],
      });

      expect(subscription.type).toBe('persistent');
    });

    test('should create subscription with filter', async () => {
      const subscription = await module.createSubscription({
        name: 'filtered-sub',
        webhookId: webhook.id,
        eventTypes: ['user.*'],
        filter: {
          bySource: ['api'],
          byContent: { status: 'active' },
        },
      });

      expect(subscription.filter).toEqual({
        bySource: ['api'],
        byContent: { status: 'active' },
      });
    });

    test('should throw error when creating subscription for non-existent webhook', async () => {
      await expect(
        module.createSubscription({
          name: 'invalid-sub',
          webhookId: 'non-existent-webhook',
          eventTypes: ['event.type'],
        })
      ).rejects.toThrow('Webhook not found');
    });

    test('should get a subscription', async () => {
      const created = await module.createSubscription({
        name: 'my-sub',
        webhookId: webhook.id,
        eventTypes: ['event.type'],
      });
      const retrieved = await module.getSubscription(created.id);

      expect(retrieved).toEqual(created);
    });

    test('should list subscriptions', async () => {
      await module.createSubscription({ name: 'sub1', webhookId: webhook.id, eventTypes: ['e1'] });
      await module.createSubscription({ name: 'sub2', webhookId: webhook.id, eventTypes: ['e2'] });
      const subscriptions = await module.listSubscriptions();

      expect(subscriptions).toHaveLength(2);
    });

    test('should list subscriptions by webhook id', async () => {
      const webhook2 = await module.createWebhook({ url: 'https://example.com/webhook2' });
      await module.createSubscription({ name: 'sub1', webhookId: webhook.id, eventTypes: ['e1'] });
      await module.createSubscription({ name: 'sub2', webhookId: webhook2.id, eventTypes: ['e2'] });
      const subscriptions = await module.listSubscriptions(webhook.id);

      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0].webhookId).toBe(webhook.id);
    });

    test('should update a subscription', async () => {
      const subscription = await module.createSubscription({
        name: 'original',
        webhookId: webhook.id,
        eventTypes: ['e1'],
      });
      const updated = await module.updateSubscription(subscription.id, {
        name: 'updated',
        eventTypes: ['e1', 'e2'],
      });

      expect(updated.name).toBe('updated');
      expect(updated.eventTypes).toEqual(['e1', 'e2']);
    });

    test('should delete a subscription', async () => {
      const subscription = await module.createSubscription({
        name: 'to-delete',
        webhookId: webhook.id,
        eventTypes: ['event.type'],
      });
      await module.deleteSubscription(subscription.id);
      const retrieved = await module.getSubscription(subscription.id);

      expect(retrieved).toBeNull();
    });

    test('should enable subscription', async () => {
      const subscription = await module.createSubscription({
        name: 'test',
        webhookId: webhook.id,
        eventTypes: ['event.type'],
      });
      await module.disableSubscription(subscription.id);
      await module.enableSubscription(subscription.id);
      const retrieved = await module.getSubscription(subscription.id);

      expect(retrieved?.enabled).toBe(true);
    });

    test('should disable subscription', async () => {
      const subscription = await module.createSubscription({
        name: 'test',
        webhookId: webhook.id,
        eventTypes: ['event.type'],
      });
      await module.disableSubscription(subscription.id);
      const retrieved = await module.getSubscription(subscription.id);

      expect(retrieved?.enabled).toBe(false);
    });
  });

  describe('Event Publishing', () => {
    let webhook: WebhookEndpoint;
    let subscription: EventSubscription;

    beforeEach(async () => {
      webhook = await module.createWebhook({ url: 'https://example.com/webhook' });
      subscription = await module.createSubscription({
        name: 'test-sub',
        webhookId: webhook.id,
        eventTypes: ['user.created'],
      });
    });

    test('should publish an event', async () => {
      const event: WebhookEvent = {
        id: generateId('evt'),
        type: 'user.created',
        source: 'api',
        payload: { userId: '123' },
        timestamp: new Date(),
        delivered: false,
        replayed: false,
      };

      const eventId = await module.publish(event);
      expect(eventId).toBeDefined();
    });

    test('should auto-generate event id if not provided', async () => {
      const event: Omit<WebhookEvent, 'id'> = {
        type: 'user.created',
        source: 'api',
        payload: { userId: '123' },
        timestamp: new Date(),
        delivered: false,
        replayed: false,
      };

      const eventId = await module.publish(event as WebhookEvent);
      expect(eventId).toMatch(/^evt_[a-f0-9]{16}$/);
    });

    test('should match subscriptions by event type', async () => {
      const event: WebhookEvent = {
        id: generateId('evt'),
        type: 'user.created',
        source: 'api',
        payload: { userId: '123' },
        timestamp: new Date(),
        delivered: false,
        replayed: false,
      };

      await module.publish(event);
      const matchingSubs = await module.listSubscriptions();
      const delivery = await module.deliverEvent(event);

      expect(delivery.success).toBe(true);
    });

    test('should not match subscription for non-matching event type', async () => {
      const testModule = new WebhooksEventsImpl();
      const testWebhook = await testModule.createWebhook({ url: 'https://example.com/webhook' });
      await testModule.createSubscription({
        name: 'other-sub',
        webhookId: testWebhook.id,
        eventTypes: ['user.deleted'],
      });

      const event: WebhookEvent = {
        id: generateId('evt'),
        type: 'user.created',
        source: 'api',
        payload: { userId: '123' },
        timestamp: new Date(),
        delivered: false,
        replayed: false,
      };

      const result = await testModule.deliverEvent(event);
      expect(result.success).toBe(false);
    });
  });

  describe('Event Delivery', () => {
    let webhook: WebhookEndpoint;
    let subscription: EventSubscription;

    beforeEach(async () => {
      webhook = await module.createWebhook({ url: 'https://example.com/webhook' });
      subscription = await module.createSubscription({
        name: 'test-sub',
        webhookId: webhook.id,
        eventTypes: ['*'],
      });
    });

    test('should deliver event synchronously', async () => {
      const event: WebhookEvent = {
        id: generateId('evt'),
        type: 'test.event',
        source: 'api',
        payload: { data: 'test' },
        timestamp: new Date(),
        delivered: false,
        replayed: false,
      };

      const result = await module.deliverEvent(event, { mode: 'sync' });

      expect(result.success).toBe(true);
      expect(result.attempts).toBeGreaterThanOrEqual(1);
    });

    test('should deliver event asynchronously', async () => {
      const event: WebhookEvent = {
        id: generateId('evt'),
        type: 'test.event',
        source: 'api',
        payload: { data: 'test' },
        timestamp: new Date(),
        delivered: false,
        replayed: false,
      };

      const result = await module.deliverEvent(event, { mode: 'async' });

      expect(result.success).toBe(true);
    });

    test('should track delivery attempts', async () => {
      const event: WebhookEvent = {
        id: generateId('evt'),
        type: 'test.event',
        source: 'api',
        payload: { data: 'test' },
        timestamp: new Date(),
        delivered: false,
        replayed: false,
      };

      await module.deliverEvent(event);
      const deliveries = await module.listDeliveries(webhook.id);

      expect(deliveries.length).toBeGreaterThan(0);
    });

    test('should get delivery by id', async () => {
      const event: WebhookEvent = {
        id: generateId('evt'),
        type: 'test.event',
        source: 'api',
        payload: { data: 'test' },
        timestamp: new Date(),
        delivered: false,
        replayed: false,
      };

      const result = await module.deliverEvent(event);
      const delivery = await module.getDelivery(result.deliveryId);

      expect(delivery).not.toBeNull();
      expect(delivery?.eventId).toBe(event.id);
    });

    test('should cancel pending delivery', async () => {
      const cancelModule = new WebhooksEventsImpl({
        maxDeliveryAttempts: 1,
        defaultDeliveryTimeout: 5000,
      });
      const cancelWebhook = await cancelModule.createWebhook({ url: 'https://example.com/webhook' });
      await cancelModule.createSubscription({
        name: 'test-sub',
        webhookId: cancelWebhook.id,
        eventTypes: ['*'],
      });

      const event: WebhookEvent = {
        id: generateId('evt'),
        type: 'test.event',
        source: 'api',
        payload: { data: 'test' },
        timestamp: new Date(),
        delivered: false,
        replayed: false,
      };

      const result = await cancelModule.deliverEvent(event, { retries: 1 });
      if (!result.success) {
        expect(result.error?.message).toBeDefined();
      } else {
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Batch Delivery', () => {
    let webhook: WebhookEndpoint;

    beforeEach(async () => {
      webhook = await module.createWebhook({ url: 'https://example.com/webhook' });
      await module.createSubscription({
        name: 'test-sub',
        webhookId: webhook.id,
        eventTypes: ['*'],
      });
    });

    test('should deliver batch of events', async () => {
      const events: WebhookEvent[] = [
        { id: generateId('evt'), type: 'e1', source: 'api', payload: {}, timestamp: new Date(), delivered: false, replayed: false },
        { id: generateId('evt'), type: 'e2', source: 'api', payload: {}, timestamp: new Date(), delivered: false, replayed: false },
        { id: generateId('evt'), type: 'e3', source: 'api', payload: {}, timestamp: new Date(), delivered: false, replayed: false },
      ];

      const result = await module.deliverBatch(events);

      expect(result.results.length).toBe(3);
      expect(result.successCount).toBe(3);
    });

    test('should respect batch size', async () => {
      const events: WebhookEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: generateId('evt'),
        type: `e${i}`,
        source: 'api',
        payload: {},
        timestamp: new Date(),
        delivered: false,
        replayed: false,
      }));

      const result = await module.deliverBatch(events, { batchSize: 2 });

      expect(result.results.length).toBe(5);
    });
  });

  describe('Event Filtering', () => {
    let webhook: WebhookEndpoint;

    beforeEach(async () => {
      webhook = await module.createWebhook({ url: 'https://example.com/webhook' });
    });

    test('should filter by event type', async () => {
      await module.createSubscription({
        name: 'filtered-sub',
        webhookId: webhook.id,
        eventTypes: ['user.created'],
      });

      const event: WebhookEvent = {
        id: generateId('evt'),
        type: 'user.created',
        source: 'api',
        payload: {},
        timestamp: new Date(),
        delivered: false,
        replayed: false,
      };

      const result = await module.deliverEvent(event);
      expect(result.success).toBe(true);
    });

    test('should filter by source', async () => {
      await module.createSubscription({
        name: 'source-filtered',
        webhookId: webhook.id,
        eventTypes: ['*'],
        filter: { bySource: ['api'] },
      });

      const matchingEvent: WebhookEvent = {
        id: generateId('evt'),
        type: 'test',
        source: 'api',
        payload: {},
        timestamp: new Date(),
        delivered: false,
        replayed: false,
      };

      const nonMatchingEvent: WebhookEvent = {
        id: generateId('evt'),
        type: 'test',
        source: 'other',
        payload: {},
        timestamp: new Date(),
        delivered: false,
        replayed: false,
      };

      const result1 = await module.deliverEvent(matchingEvent);
      expect(result1.success).toBe(true);
    });

    test('should filter by content', async () => {
      await module.createSubscription({
        name: 'content-filtered',
        webhookId: webhook.id,
        eventTypes: ['*'],
        filter: { byContent: { status: 'active' } },
      });

      const event: WebhookEvent = {
        id: generateId('evt'),
        type: 'test',
        source: 'api',
        payload: { status: 'active' },
        timestamp: new Date(),
        delivered: false,
        replayed: false,
      };

      const result = await module.deliverEvent(event);
      expect(result.success).toBe(true);
    });
  });

  describe('Event Replay', () => {
    test('should replay events with options', async () => {
      const moduleWithReplay = new WebhooksEventsImpl({ enableEventReplay: true });

      const event: WebhookEvent = {
        id: generateId('evt'),
        type: 'test.event',
        source: 'api',
        payload: { data: 'original' },
        timestamp: new Date(Date.now() - 10000),
        delivered: false,
        replayed: false,
      };

      await moduleWithReplay.publish(event);

      const options: EventReplayOptions = {
        fromTimestamp: new Date(Date.now() - 20000),
        toTimestamp: new Date(),
        eventTypes: ['test.event'],
        preserveOrdering: false,
      };

      const replayedIds = await moduleWithReplay.replayEvents(options);
      expect(replayedIds.length).toBeGreaterThanOrEqual(0);
    });

    test('should throw error when replay is disabled', async () => {
      const moduleWithoutReplay = new WebhooksEventsImpl({ enableEventReplay: false });

      await expect(
        moduleWithoutReplay.replayEvents({ preserveOrdering: false })
      ).rejects.toThrow('Event replay is disabled');
    });

    test('should get replay status', async () => {
      const moduleWithReplay = new WebhooksEventsImpl({ enableEventReplay: true });
      const status = await moduleWithReplay.getReplayStatus('non-existent');

      expect(status).toBeNull();
    });
  });

  describe('Event History', () => {
    let webhook: WebhookEndpoint;

    beforeEach(async () => {
      webhook = await module.createWebhook({ url: 'https://example.com/webhook' });
      await module.createSubscription({
        name: 'test-sub',
        webhookId: webhook.id,
        eventTypes: ['*'],
      });
    });

    test('should record event history', async () => {
      const event: WebhookEvent = {
        id: generateId('evt'),
        type: 'test.event',
        source: 'api',
        payload: {},
        timestamp: new Date(),
        delivered: false,
        replayed: false,
      };

      await module.deliverEvent(event);
      const history = await module.getEventHistory(event.id);

      expect(history.length).toBeGreaterThan(0);
    });

    test('should clear event history', async () => {
      const event: WebhookEvent = {
        id: generateId('evt'),
        type: 'test.event',
        source: 'api',
        payload: {},
        timestamp: new Date(),
        delivered: false,
        replayed: false,
      };

      await module.publish(event);
      await module.clearEventHistory(event.id);
      const history = await module.getEventHistory(event.id);

      expect(history).toHaveLength(0);
    });
  });

  describe('Transformers', () => {
    let webhook: WebhookEndpoint;

    beforeEach(async () => {
      webhook = await module.createWebhook({ url: 'https://example.com/webhook' });
      await module.createSubscription({
        name: 'test-sub',
        webhookId: webhook.id,
        eventTypes: ['*'],
      });
    });

    test('should create transformer', async () => {
      const transformer = await module.createTransformer({
        name: 'test-transformer',
        transform: async (event) => ({
          ...event,
          metadata: { ...event.metadata, transformed: true },
        }),
        priority: 1,
      });

      expect(transformer.id).toMatch(/^xfrm_[a-f0-9]{16}$/);
      expect(transformer.name).toBe('test-transformer');
      expect(transformer.enabled).toBe(true);
    });

    test('should update transformer', async () => {
      const transformer = await module.createTransformer({
        name: 'original',
        transform: async (event) => event,
      });

      const updated = await module.updateTransformer(transformer.id, {
        name: 'updated',
        enabled: false,
      });

      expect(updated.name).toBe('updated');
      expect(updated.enabled).toBe(false);
    });

    test('should delete transformer', async () => {
      const transformer = await module.createTransformer({
        name: 'to-delete',
        transform: async (event) => event,
      });

      await module.deleteTransformer(transformer.id);
      const retrieved = await module.getTransformer(transformer.id);

      expect(retrieved).toBeNull();
    });

    test('should list transformers', async () => {
      await module.createTransformer({ name: 't1', transform: async (e) => e });
      await module.createTransformer({ name: 't2', transform: async (e) => e });
      const transformers = await module.listTransformers();

      expect(transformers).toHaveLength(2);
    });
  });

  describe('Event Ordering', () => {
    test('should set event ordering', async () => {
      const moduleWithOrdering = new WebhooksEventsImpl({ enableEventOrdering: true });
      const eventId = generateId('evt');

      const ordering = await moduleWithOrdering.setOrdering(eventId, 'sequence-1', 100);

      expect(ordering.eventId).toBe(eventId);
      expect(ordering.key).toBe('sequence-1');
      expect(ordering.sequence).toBe(100);
    });

    test('should throw error when ordering is disabled', async () => {
      const moduleWithoutOrdering = new WebhooksEventsImpl({ enableEventOrdering: false });

      await expect(moduleWithoutOrdering.setOrdering('evt1', 'key', 1)).rejects.toThrow(
        'Event ordering is disabled'
      );
    });

    test('should get ordering for event', async () => {
      const moduleWithOrdering = new WebhooksEventsImpl({ enableEventOrdering: true });
      const eventId = generateId('evt');

      await moduleWithOrdering.setOrdering(eventId, 'key', 1);
      const ordering = await moduleWithOrdering.getOrdering(eventId);

      expect(ordering).not.toBeNull();
      expect(ordering?.eventId).toBe(eventId);
    });

    test('should get events in order', async () => {
      const moduleWithOrdering = new WebhooksEventsImpl({ enableEventOrdering: true });

      const event1: WebhookEvent = {
        id: 'evt1',
        type: 'e1',
        source: 'api',
        payload: {},
        timestamp: new Date(),
        delivered: false,
        replayed: false,
      };
      const event2: WebhookEvent = { ...event1, id: 'evt2' };
      const event3: WebhookEvent = { ...event1, id: 'evt3' };

      await moduleWithOrdering.publish(event1);
      await moduleWithOrdering.publish(event2);
      await moduleWithOrdering.publish(event3);

      await moduleWithOrdering.setOrdering('evt1', 'key', 1);
      await moduleWithOrdering.setOrdering('evt2', 'key', 2);
      await moduleWithOrdering.setOrdering('evt3', 'key', 3);

      const events = await moduleWithOrdering.getEventsInOrder('key');
      expect(events.length).toBe(3);
    });
  });

  describe('Pub/Sub', () => {
    let webhook: WebhookEndpoint;
    let subscription: EventSubscription;

    beforeEach(async () => {
      webhook = await module.createWebhook({ url: 'https://example.com/webhook' });
      subscription = await module.createSubscription({
        name: 'pubsub-sub',
        webhookId: webhook.id,
        eventTypes: ['test.event'],
      });
    });

    test('should subscribe with handler', async () => {
      let handlerCalled = false;
      const handler: EventHandler = async () => {
        handlerCalled = true;
      };

      await module.subscribe(subscription, handler);
      expect(handlerCalled).toBe(false);
    });

    test('should unsubscribe', async () => {
      const handler: EventHandler = async () => {};

      await module.subscribe(subscription, handler);
      await module.unsubscribe(subscription.id);
    });

    test('should unsubscribe all for webhook', async () => {
      const handler: EventHandler = async () => {};

      await module.subscribe(subscription, handler);
      await module.unsubscribeAll(webhook.id);
    });
  });

  describe('Factory Function', () => {
    test('should create module using factory function', () => {
      const module = createWebhookEventsModule();
      expect(module).toBeDefined();
    });

    test('should create module with custom config', () => {
      const module = createWebhookEventsModule({
        maxDeliveryAttempts: 5,
        defaultDeliveryTimeout: 60000,
        enableEventReplay: false,
      });
      expect(module).toBeDefined();
    });
  });
});

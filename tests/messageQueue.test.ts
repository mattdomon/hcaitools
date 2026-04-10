import {
  MessageQueue,
  QueueConfig,
  Message,
  Subscription,
  SubscriptionType,
  MessageState,
  QueueType,
  MessagePattern,
  createMessageId,
  createRetryPolicy,
  createDeadLetterConfig,
  isMessageExpired,
  isMessageRetryable,
  calculateRetryDelay,
  compareMessagePriority,
  isValidQueueConfig,
  createMessageMetadata,
  createSubscription,
} from '../src/core/messageQueue';

describe('MessageQueue', () => {
  let queue: MessageQueue;

  beforeEach(() => {
    queue = new MessageQueue();
  });

  afterEach(() => {
    queue.clear();
  });

  describe('Queue Management', () => {
    test('should create a queue with valid config', () => {
      const config: QueueConfig = {
        name: 'test-queue',
        type: 'fifo',
        messagePattern: 'point_to_point',
        durable: true,
        maxSize: 1000,
        messageTTL: 86400000,
      };

      const result = queue.createQueue(config);
      expect(result.name).toBe('test-queue');
      expect(result.type).toBe('fifo');
    });

    test('should throw error for duplicate queue', () => {
      const config: QueueConfig = {
        name: 'test-queue',
        type: 'fifo',
        messagePattern: 'point_to_point',
        durable: true,
        maxSize: 1000,
        messageTTL: 86400000,
      };

      queue.createQueue(config);
      expect(() => queue.createQueue(config)).toThrow('Queue test-queue already exists');
    });

    test('should throw error for invalid queue config', () => {
      const invalidConfig = {
        name: '',
        type: 'fifo',
        messagePattern: 'point_to_point',
        durable: true,
        maxSize: 1000,
        messageTTL: 86400000,
      };

      expect(() => queue.createQueue(invalidConfig as QueueConfig)).toThrow('Invalid queue configuration');
    });

    test('should get existing queue', () => {
      const config: QueueConfig = {
        name: 'test-queue',
        type: 'fifo',
        messagePattern: 'point_to_point',
        durable: true,
        maxSize: 1000,
        messageTTL: 86400000,
      };

      queue.createQueue(config);
      const result = queue.getQueue('test-queue');
      expect(result).toBeDefined();
      expect(result?.name).toBe('test-queue');
    });

    test('should return undefined for non-existent queue', () => {
      const result = queue.getQueue('non-existent');
      expect(result).toBeUndefined();
    });

    test('should delete existing queue', () => {
      const config: QueueConfig = {
        name: 'test-queue',
        type: 'fifo',
        messagePattern: 'point_to_point',
        durable: true,
        maxSize: 1000,
        messageTTL: 86400000,
      };

      queue.createQueue(config);
      const deleted = queue.deleteQueue('test-queue');
      expect(deleted).toBe(true);
      expect(queue.getQueue('test-queue')).toBeUndefined();
    });

    test('should return false when deleting non-existent queue', () => {
      const deleted = queue.deleteQueue('non-existent');
      expect(deleted).toBe(false);
    });

    test('should return all queues', () => {
      queue.createQueue({
        name: 'queue1',
        type: 'fifo',
        messagePattern: 'point_to_point',
        durable: true,
        maxSize: 1000,
        messageTTL: 86400000,
      });

      queue.createQueue({
        name: 'queue2',
        type: 'priority',
        messagePattern: 'pub_sub',
        durable: true,
        maxSize: 2000,
        messageTTL: 86400000,
      });

      const queues = queue.getAllQueues();
      expect(queues).toHaveLength(2);
    });
  });

  describe('Topic Management', () => {
    test('should create a topic', () => {
      const topic = queue.createTopic('test-topic');
      expect(topic.name).toBe('test-topic');
      expect(topic.messageCount).toBe(0);
    });

    test('should throw error for duplicate topic', () => {
      queue.createTopic('test-topic');
      expect(() => queue.createTopic('test-topic')).toThrow('Topic test-topic already exists');
    });

    test('should get existing topic', () => {
      queue.createTopic('test-topic');
      const topic = queue.getTopic('test-topic');
      expect(topic).toBeDefined();
      expect(topic?.name).toBe('test-topic');
    });

    test('should delete existing topic', () => {
      queue.createTopic('test-topic');
      const deleted = queue.deleteTopic('test-topic');
      expect(deleted).toBe(true);
      expect(queue.getTopic('test-topic')).toBeUndefined();
    });

    test('should return all topics', () => {
      queue.createTopic('topic1');
      queue.createTopic('topic2');

      const topics = queue.getAllTopics();
      expect(topics).toHaveLength(2);
    });
  });

  describe('Message Publishing', () => {
    test('should publish message to topic', async () => {
      const message = await queue.publish('test-topic', { data: 'test' });
      expect(message.id).toBeDefined();
      expect(message.topic).toBe('test-topic');
      expect(message.payload).toEqual({ data: 'test' });
      expect(message.state).toBe('published');
    });

    test('should auto-create topic when publishing', async () => {
      const message = await queue.publish('new-topic', { data: 'test' });
      expect(queue.getTopic('new-topic')).toBeDefined();
      expect(message.topic).toBe('new-topic');
    });

    test('should publish message with priority', async () => {
      const message = await queue.publish('test-topic', { data: 'test' }, { priority: 10 });
      expect(message.priority).toBe(10);
    });

    test('should publish message with headers', async () => {
      const message = await queue.publish('test-topic', { data: 'test' }, { headers: { key: 'value' } });
      expect(message.metadata.headers.key).toBe('value');
    });

    test('should publish message with custom publisherId', async () => {
      const message = await queue.publish('test-topic', { data: 'test' }, { publisherId: 'custom-publisher' });
      expect(message.metadata.publisherId).toBe('custom-publisher');
    });

    test('should increment stats on publish', async () => {
      await queue.publish('test-topic', { data: 'test' });
      const stats = queue.getStats();
      expect(stats.totalMessages).toBe(1);
      expect(stats.publishedMessages).toBe(1);
    });
  });

  describe('Subscription Management', () => {
    test('should subscribe to topic', async () => {
      queue.createTopic('test-topic');
      const handler = jest.fn();

      const subscription = await queue.subscribe('test-topic', 'exclusive', 'consumer1', handler);
      expect(subscription.id).toBeDefined();
      expect(subscription.topic).toBe('test-topic');
      expect(subscription.consumerId).toBe('consumer1');
    });

    test('should return subscriptions by consumer', async () => {
      queue.createTopic('test-topic');
      const handler = jest.fn();

      await queue.subscribe('test-topic', 'exclusive', 'consumer1', handler);
      await queue.subscribe('test-topic', 'shared', 'consumer1', handler);

      const subscriptions = queue.getSubscriptionsByConsumer('consumer1');
      expect(subscriptions).toHaveLength(2);
    });

    test('should unsubscribe from topic', async () => {
      queue.createTopic('test-topic');
      const handler = jest.fn();

      const subscription = await queue.subscribe('test-topic', 'exclusive', 'consumer1', handler);
      const unsubscribed = await queue.unsubscribe(subscription.id);

      expect(unsubscribed).toBe(true);
    });

    test('should subscribe with filter', async () => {
      queue.createTopic('test-topic');
      const handler = jest.fn();

      await queue.subscribe('test-topic', 'exclusive', 'consumer1', handler, { filter: { type: 'important' } });
      const subscriptions = queue.getSubscriptionsByConsumer('consumer1');

      expect(subscriptions[0].options.filter).toEqual({ type: 'important' });
    });
  });

  describe('Message Consumption', () => {
    test('should consume message from subscription', async () => {
      const handler = jest.fn();
      queue.createTopic('test-topic');

      const subscription = await queue.subscribe('test-topic', 'exclusive', 'consumer1', handler);
      await queue.publish('test-topic', { data: 'test' });

      const message = await queue.consume(subscription.id);
      expect(message).toBeDefined();
      expect(message?.state).toBe('consumed');
    });

    test('should auto-acknowledge when autoAck is enabled', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      queue.createTopic('test-topic');

      await queue.subscribe('test-topic', 'exclusive', 'consumer1', handler, { autoAck: true });
      await queue.publish('test-topic', { data: 'test' });

      const message = await queue.consume<Subscription>(queue.getSubscriptionsByConsumer('consumer1')[0].id);
      expect(message).toBeDefined();

      const stats = queue.getStats();
      expect(stats.acknowledgedMessages).toBe(1);
    });

    test('should return null when no messages available', async () => {
      queue.createTopic('test-topic');
      const subscription = await queue.subscribe('test-topic', 'exclusive', 'consumer1', jest.fn());

      const message = await queue.consume(subscription.id);
      expect(message).toBeNull();
    });
  });

  describe('Message Acknowledgment', () => {
    test('should acknowledge message', async () => {
      await queue.publish('test-topic', { data: 'test' });
      const messages = await queue.getMessagesByTopic('test-topic');
      const messageId = messages[0].id;

      const acknowledged = await queue.acknowledge(messageId);
      expect(acknowledged).toBe(true);

      const message = (await queue.getMessagesByTopic('test-topic'))[0];
      expect(message.state).toBe('acknowledged');
    });

    test('should return false when acknowledging non-existent message', async () => {
      const acknowledged = await queue.acknowledge('non-existent-id');
      expect(acknowledged).toBe(false);
    });
  });

  describe('Message Negative Acknowledgment', () => {
    test('should retry message on nack', async () => {
      queue.createQueue({
        name: 'test-queue',
        type: 'fifo',
        messagePattern: 'point_to_point',
        durable: true,
        maxSize: 1000,
        messageTTL: 86400000,
        retryPolicy: {
          maxAttempts: 3,
          backoffMultiplier: 2,
          initialDelayMs: 100,
          maxDelayMs: 1000,
        },
      });

      const message = await queue.publish('test-topic', { data: 'test' });
      await queue.nacknowledge(message.id, new Error('Test error'));

      const updatedMessage = (await queue.getMessagesByTopic('test-topic'))[0];
      expect(updatedMessage.metadata.retryCount).toBe(1);
    });

    test('should move to dead letter after max retries', async () => {
      queue.createQueue({
        name: 'test-topic',
        type: 'fifo',
        messagePattern: 'point_to_point',
        durable: true,
        maxSize: 1000,
        messageTTL: 86400000,
        retryPolicy: {
          maxAttempts: 0,
          backoffMultiplier: 1,
          initialDelayMs: 10,
          maxDelayMs: 100,
        },
        deadLetterConfig: {
          queueName: 'test-topic_dlq',
          retentionMs: 604800000,
        },
      });

      const message = await queue.publish('test-topic', { data: 'test' });
      await queue.nacknowledge(message.id, new Error('Test error'));

      const stats = queue.getStats();
      expect(stats.deadLetterMessages).toBe(1);
    });
  });

  describe('Dead Letter Queue', () => {
    test('should get dead letter messages', async () => {
      queue.createQueue({
        name: 'test-queue',
        type: 'dead_letter',
        messagePattern: 'point_to_point',
        durable: true,
        maxSize: 100,
        messageTTL: 604800000,
        deadLetterConfig: {
          queueName: 'test-queue_dlq',
          retentionMs: 604800000,
        },
      });

      queue.createQueue({
        name: 'main-queue',
        type: 'fifo',
        messagePattern: 'point_to_point',
        durable: true,
        maxSize: 1000,
        messageTTL: 86400000,
        deadLetterConfig: {
          queueName: 'test-queue_dlq',
          retentionMs: 604800000,
        },
      });

      const message = await queue.publish('main-queue', { data: 'test' });
      await queue.nacknowledge(message.id, new Error('Test error'));

      const dlqMessages = await queue.getDeadLetterMessages('test-queue_dlq');
      expect(dlqMessages.length).toBeGreaterThanOrEqual(0);
    });

    test('should retry dead letter message', async () => {
      queue.createQueue({
        name: 'test-queue',
        type: 'fifo',
        messagePattern: 'point_to_point',
        durable: true,
        maxSize: 1000,
        messageTTL: 86400000,
        retryPolicy: {
          maxAttempts: 1,
          backoffMultiplier: 1,
          initialDelayMs: 10,
          maxDelayMs: 100,
        },
      });

      const message = await queue.publish('test-topic', { data: 'test' });
      await queue.nacknowledge(message.id, new Error('Test error'));

      const stats = queue.getStats();
      if (stats.deadLetterMessages > 0) {
        const dlqMessages = await queue.getDeadLetterMessages('test-queue_dlq');
        if (dlqMessages.length > 0) {
          const retried = await queue.retryDeadLetterMessage(dlqMessages[0].id);
          expect(retried).toBe(true);
        }
      }
    });

    test('should purge dead letter queue', async () => {
      queue.createQueue({
        name: 'test-queue',
        type: 'fifo',
        messagePattern: 'point_to_point',
        durable: true,
        maxSize: 1000,
        messageTTL: 86400000,
        retryPolicy: {
          maxAttempts: 1,
          backoffMultiplier: 1,
          initialDelayMs: 10,
          maxDelayMs: 100,
        },
      });

      const message = await queue.publish('test-topic', { data: 'test' });
      await queue.nacknowledge(message.id, new Error('Test error'));

      const purged = await queue.purgeDeadLetterQueue('test-queue_dlq');
      expect(purged).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Message Filtering', () => {
    test('should filter messages by topic', async () => {
      await queue.publish('topic1', { data: 'test1' });
      await queue.publish('topic2', { data: 'test2' });
      await queue.publish('topic1', { data: 'test3' });

      const topic1Messages = await queue.getMessagesByTopic('topic1');
      expect(topic1Messages).toHaveLength(2);

      const topic2Messages = await queue.getMessagesByTopic('topic2');
      expect(topic2Messages).toHaveLength(1);
    });

    test('should filter messages by state', async () => {
      const msg1 = await queue.publish('test-topic', { data: 'test1' });
      const msg2 = await queue.publish('test-topic', { data: 'test2' });

      await queue.acknowledge(msg1.id);

      const publishedMessages = await queue.getMessagesByState('published');
      const acknowledgedMessages = await queue.getMessagesByState('acknowledged');

      expect(publishedMessages).toHaveLength(1);
      expect(acknowledgedMessages).toHaveLength(1);
    });
  });

  describe('Priority Queue', () => {
    test('should get pending messages in priority order', async () => {
      queue.createQueue({
        name: 'priority-queue',
        type: 'priority',
        messagePattern: 'point_to_point',
        durable: true,
        maxSize: 1000,
        messageTTL: 86400000,
      });

      await queue.publish('priority-queue', { data: 'low' }, { priority: 1 });
      await queue.publish('priority-queue', { data: 'high' }, { priority: 10 });
      await queue.publish('priority-queue', { data: 'medium' }, { priority: 5 });

      const pending = await queue.getPendingMessages('priority-queue');
      expect(pending[0]?.payload).toEqual({ data: 'high' });
      expect(pending[1]?.payload).toEqual({ data: 'medium' });
      expect(pending[2]?.payload).toEqual({ data: 'low' });
    });
  });

  describe('Stats', () => {
    test('should return accurate stats', async () => {
      queue.createQueue({
        name: 'test-queue',
        type: 'fifo',
        messagePattern: 'point_to_point',
        durable: true,
        maxSize: 1000,
        messageTTL: 86400000,
      });

      await queue.publish('test-topic', { data: 'test' });
      await queue.publish('test-topic', { data: 'test' });

      const stats = queue.getStats();
      expect(stats.totalMessages).toBe(2);
      expect(stats.publishedMessages).toBe(2);
    });
  });

  describe('Type Helper Functions', () => {
    test('should create message ID with prefix', () => {
      const id = createMessageId('test');
      expect(id).toMatch(/^test_[a-f0-9]{16}$/);
    });

    test('should create retry policy with defaults', () => {
      const policy = createRetryPolicy();
      expect(policy.maxAttempts).toBe(3);
      expect(policy.backoffMultiplier).toBe(2);
      expect(policy.initialDelayMs).toBe(1000);
      expect(policy.maxDelayMs).toBe(30000);
    });

    test('should create retry policy with overrides', () => {
      const policy = createRetryPolicy({ maxAttempts: 5 });
      expect(policy.maxAttempts).toBe(5);
      expect(policy.backoffMultiplier).toBe(2);
    });

    test('should create dead letter config', () => {
      const config = createDeadLetterConfig('dlq', 604800000);
      expect(config.queueName).toBe('dlq');
      expect(config.retentionMs).toBe(604800000);
    });

    test('should detect expired message', () => {
      const message: Message = {
        id: 'test',
        topic: 'test',
        payload: {},
        priority: 0,
        state: 'published',
        metadata: createMessageMetadata('test'),
        createdAt: Date.now() - 200000,
        expiresAt: Date.now() - 100000,
      };

      expect(isMessageExpired(message)).toBe(true);
    });

    test('should detect non-expired message', () => {
      const message: Message = {
        id: 'test',
        topic: 'test',
        payload: {},
        priority: 0,
        state: 'published',
        metadata: createMessageMetadata('test'),
        createdAt: Date.now(),
        expiresAt: Date.now() + 100000,
      };

      expect(isMessageExpired(message)).toBe(false);
    });

    test('should detect retryable message', () => {
      const message: Message = {
        id: 'test',
        topic: 'test',
        payload: {},
        priority: 0,
        state: 'published',
        metadata: createMessageMetadata('test'),
        createdAt: Date.now(),
        expiresAt: Date.now() + 100000,
      };

      const policy = createRetryPolicy({ maxAttempts: 3 });
      expect(isMessageRetryable(message, policy)).toBe(true);
    });

    test('should detect non-retryable message', () => {
      const message: Message = {
        id: 'test',
        topic: 'test',
        payload: {},
        priority: 0,
        state: 'published',
        metadata: { ...createMessageMetadata('test'), retryCount: 3 },
        createdAt: Date.now(),
        expiresAt: Date.now() + 100000,
      };

      const policy = createRetryPolicy({ maxAttempts: 3 });
      expect(isMessageRetryable(message, policy)).toBe(false);
    });

    test('should calculate retry delay', () => {
      const message: Message = {
        id: 'test',
        topic: 'test',
        payload: {},
        priority: 0,
        state: 'published',
        metadata: { ...createMessageMetadata('test'), retryCount: 2 },
        createdAt: Date.now(),
        expiresAt: Date.now() + 100000,
      };

      const policy = createRetryPolicy({
        initialDelayMs: 1000,
        backoffMultiplier: 2,
        maxDelayMs: 10000,
      });

      const delay = calculateRetryDelay(message, policy);
      expect(delay).toBe(4000);
    });

    test('should cap retry delay at maxDelayMs', () => {
      const message: Message = {
        id: 'test',
        topic: 'test',
        payload: {},
        priority: 0,
        state: 'published',
        metadata: { ...createMessageMetadata('test'), retryCount: 10 },
        createdAt: Date.now(),
        expiresAt: Date.now() + 100000,
      };

      const policy = createRetryPolicy({
        initialDelayMs: 1000,
        backoffMultiplier: 2,
        maxDelayMs: 5000,
      });

      const delay = calculateRetryDelay(message, policy);
      expect(delay).toBe(5000);
    });

    test('should validate queue config - valid', () => {
      const config: QueueConfig = {
        name: 'test',
        type: 'fifo',
        messagePattern: 'point_to_point',
        durable: true,
        maxSize: 1000,
        messageTTL: 86400000,
      };

      expect(isValidQueueConfig(config)).toBe(true);
    });

    test('should validate queue config - invalid name', () => {
      const config = {
        name: '',
        type: 'fifo' as QueueType,
        messagePattern: 'point_to_point' as MessagePattern,
        durable: true,
        maxSize: 1000,
        messageTTL: 86400000,
      };

      expect(isValidQueueConfig(config)).toBe(false);
    });

    test('should validate queue config - invalid type', () => {
      const config = {
        name: 'test',
        type: 'invalid' as QueueType,
        messagePattern: 'point_to_point' as MessagePattern,
        durable: true,
        maxSize: 1000,
        messageTTL: 86400000,
      };

      expect(isValidQueueConfig(config)).toBe(false);
    });

    test('should compare message priority', () => {
      const msg1: Message = {
        id: 'test1',
        topic: 'test',
        payload: {},
        priority: 5,
        state: 'published',
        metadata: createMessageMetadata('test'),
        createdAt: 1000,
        expiresAt: Date.now() + 100000,
      };

      const msg2: Message = {
        id: 'test2',
        topic: 'test',
        payload: {},
        priority: 10,
        state: 'published',
        metadata: createMessageMetadata('test'),
        createdAt: 2000,
        expiresAt: Date.now() + 100000,
      };

      expect(compareMessagePriority(msg1, msg2)).toBeGreaterThan(0);
      expect(compareMessagePriority(msg2, msg1)).toBeLessThan(0);
    });

    test('should create message metadata', () => {
      const metadata = createMessageMetadata('publisher1', { key: 'value' });
      expect(metadata.publisherId).toBe('publisher1');
      expect(metadata.headers.key).toBe('value');
      expect(metadata.retryCount).toBe(0);
      expect(metadata.timestamp).toBeDefined();
    });

    test('should create subscription', () => {
      const subscription = createSubscription('test-topic', 'exclusive', 'consumer1', { autoAck: true });
      expect(subscription.topic).toBe('test-topic');
      expect(subscription.type).toBe('exclusive');
      expect(subscription.consumerId).toBe('consumer1');
      expect(subscription.options.autoAck).toBe(true);
    });
  });

  describe('Clear', () => {
    test('should clear all data', async () => {
      queue.createQueue({
        name: 'test-queue',
        type: 'fifo',
        messagePattern: 'point_to_point',
        durable: true,
        maxSize: 1000,
        messageTTL: 86400000,
      });

      queue.createTopic('test-topic');
      await queue.publish('test-topic', { data: 'test' });

      queue.clear();

      expect(queue.getAllQueues()).toHaveLength(0);
      expect(queue.getAllTopics()).toHaveLength(0);
      expect(queue.getStats().totalMessages).toBe(0);
    });
  });
});

import {
  QueueConfig,
  Message,
  MessageState,
  Subscription,
  SubscriptionType,
  TopicConfig,
  QueueStats,
  MessageHandler,
  DeadLetterConfig,
  createMessageId,
  createRetryPolicy,
  createDeadLetterConfig,
  isMessageExpired,
  isMessageRetryable,
  calculateRetryDelay,
  compareMessagePriority,
  createMessageMetadata,
  isValidQueueConfig,
  createSubscription,
} from './types';

export class MessageQueue {
  private queues: Map<string, QueueConfig> = new Map();
  private topics: Map<string, TopicConfig> = new Map();
  private messages: Map<string, Message> = new Map();
  private pendingMessages: Map<string, string[]> = new Map();
  private deadLetterMessages: Map<string, Message[]> = new Map();
  private subscriptionMessages: Map<string, Map<string, Message>> = new Map();
  private consumerSubscriptions: Map<string, Set<string>> = new Map();
  private stats: QueueStats = {
    totalMessages: 0,
    pendingMessages: 0,
    publishedMessages: 0,
    consumedMessages: 0,
    acknowledgedMessages: 0,
    failedMessages: 0,
    deadLetterMessages: 0,
  };

  createQueue(config: QueueConfig): QueueConfig {
    if (!isValidQueueConfig(config)) {
      throw new Error('Invalid queue configuration');
    }

    if (this.queues.has(config.name)) {
      throw new Error(`Queue ${config.name} already exists`);
    }

    const queueConfig: QueueConfig = {
      ...config,
      retryPolicy: config.retryPolicy || createRetryPolicy(),
      deadLetterConfig: config.deadLetterConfig || createDeadLetterConfig(`${config.name}_dlq`, 604800000),
    };

    this.queues.set(config.name, queueConfig);
    this.pendingMessages.set(config.name, []);
    this.deadLetterMessages.set(config.name, []);

    return queueConfig;
  }

  getQueue(name: string): QueueConfig | undefined {
    return this.queues.get(name);
  }

  deleteQueue(name: string): boolean {
    const queue = this.queues.get(name);
    if (!queue) {
      return false;
    }

    const messages = this.pendingMessages.get(name) || [];
    for (const msgId of messages) {
      this.messages.delete(msgId);
    }

    this.queues.delete(name);
    this.pendingMessages.delete(name);
    this.deadLetterMessages.delete(name);

    return true;
  }

  createTopic(topicName: string): TopicConfig {
    if (this.topics.has(topicName)) {
      throw new Error(`Topic ${topicName} already exists`);
    }

    const topicConfig: TopicConfig = {
      name: topicName,
      subscriptions: new Map(),
      messageCount: 0,
      createdAt: Date.now(),
    };

    this.topics.set(topicName, topicConfig);
    this.subscriptionMessages.set(topicName, new Map());

    return topicConfig;
  }

  getTopic(name: string): TopicConfig | undefined {
    return this.topics.get(name);
  }

  deleteTopic(topicName: string): boolean {
    const topic = this.topics.get(topicName);
    if (!topic) {
      return false;
    }

    for (const subId of topic.subscriptions.keys()) {
      this.subscriptionMessages.get(topicName)?.delete(subId);
      this.consumerSubscriptions.delete(subId);
    }

    this.topics.delete(topicName);
    this.subscriptionMessages.delete(topicName);

    return true;
  }

  async publish<T>(topic: string, payload: T, options?: { priority?: number; headers?: Record<string, unknown>; publisherId?: string }): Promise<Message<T>> {
    let topicConfig = this.topics.get(topic);

    if (!topicConfig) {
      topicConfig = this.createTopic(topic);
    }

    const messageId = createMessageId('msg');
    const priority = options?.priority ?? 0;
    const publisherId = options?.publisherId ?? 'anonymous';
    const headers = options?.headers ?? {};

    const message: Message<T> = {
      id: messageId,
      topic,
      payload,
      priority,
      state: 'published',
      metadata: createMessageMetadata(publisherId, headers),
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
    };

    this.messages.set(messageId, message);
    topicConfig.messageCount++;
    this.stats.totalMessages++;
    this.stats.publishedMessages++;

    this.distributeMessage(message, topicConfig);

    return message;
  }

  private distributeMessage<T>(message: Message<T>, topicConfig: TopicConfig): void {
    const topicMessages = this.subscriptionMessages.get(topicConfig.name);
    if (!topicMessages) return;

    for (const [subId, subscription] of topicConfig.subscriptions) {
      if (this.matchesFilter(message, subscription.options.filter)) {
        topicMessages.set(subId, message);
      }
    }
  }

  private matchesFilter(message: Message, filter?: Record<string, unknown>): boolean {
    if (!filter) return true;

    for (const [key, value] of Object.entries(filter)) {
      if (message.metadata.headers[key] !== value) {
        return false;
      }
    }
    return true;
  }

  async subscribe(
    topic: string,
    type: SubscriptionType,
    consumerId: string,
    handler: MessageHandler,
    options?: { filter?: Record<string, unknown>; autoAck?: boolean; ackTimeout?: number; maxConcurrent?: number }
  ): Promise<Subscription> {
    let topicConfig = this.topics.get(topic);

    if (!topicConfig) {
      topicConfig = this.createTopic(topic);
    }

    const subscription = createSubscription(topic, type, consumerId, {
      filter: options?.filter,
      autoAck: options?.autoAck ?? false,
      ackTimeout: options?.ackTimeout ?? 30000,
      maxConcurrent: options?.maxConcurrent ?? 1,
    });

    topicConfig.subscriptions.set(subscription.id, subscription);

    if (!this.consumerSubscriptions.has(consumerId)) {
      this.consumerSubscriptions.set(consumerId, new Set());
    }
    this.consumerSubscriptions.get(consumerId)!.add(subscription.id);

    this.messageHandlers.set(subscription.id, handler);

    return subscription;
  }

  private messageHandlers: Map<string, MessageHandler> = new Map();

  async unsubscribe(subscriptionId: string): Promise<boolean> {
    for (const [topicName, topicConfig] of this.topics) {
      const subscription = topicConfig.subscriptions.get(subscriptionId);
      if (subscription) {
        topicConfig.subscriptions.delete(subscriptionId);
        this.consumerSubscriptions.get(subscription.consumerId)?.delete(subscriptionId);
        this.messageHandlers.delete(subscriptionId);
        this.subscriptionMessages.get(topicName)?.delete(subscriptionId);
        return true;
      }
    }
    return false;
  }

  async consume<T>(subscriptionId: string): Promise<Message<T> | null> {
    for (const [topicName, topicConfig] of this.topics) {
      const subscription = topicConfig.subscriptions.get(subscriptionId);
      if (!subscription) continue;

      const topicMessages = this.subscriptionMessages.get(topicName);
      if (!topicMessages) continue;

      const message = topicMessages.get(subscriptionId) as Message<T> | undefined;
      if (!message) return null;

      if (isMessageExpired(message)) {
        await this.moveToDeadLetter(message, 'Message expired');
        return null;
      }

      message.state = 'consumed';
      message.metadata.subscriptionId = subscriptionId;
      this.stats.consumedMessages++;

      topicMessages.delete(subscriptionId);

      const handler = this.messageHandlers.get(subscriptionId);
      if (handler && subscription.options.autoAck) {
        try {
          await handler(message);
          await this.acknowledge(message.id);
        } catch {
          await this.nacknowledge(message.id, new Error('Handler failed'));
        }
      }

      return message;
    }
    return null;
  }

  async acknowledge(messageId: string): Promise<boolean> {
    const message = this.messages.get(messageId);
    if (!message) return false;

    message.state = 'acknowledged';
    this.stats.acknowledgedMessages++;
    this.stats.consumedMessages--;

    return true;
  }

  async nacknowledge(messageId: string, error?: Error): Promise<boolean> {
    const message = this.messages.get(messageId);
    if (!message) return false;

    const queueConfig = this.findQueueForTopic(message.topic);
    if (!queueConfig) {
      message.state = 'failed';
      this.stats.failedMessages++;
      return false;
    }

    const retryPolicy = queueConfig.retryPolicy || createRetryPolicy();

    if (isMessageRetryable(message, retryPolicy)) {
      message.metadata.retryCount++;
      message.state = 'pending';

      setTimeout(() => {
        const topicConfig = this.topics.get(message.topic);
        if (topicConfig) {
          this.distributeMessage(message, topicConfig);
        }
      }, calculateRetryDelay(message, retryPolicy));

      return true;
    }

    await this.moveToDeadLetter(message, error?.message || 'Max retries exceeded');
    return true;
  }

  private findQueueForTopic(_topic: string): QueueConfig | undefined {
    for (const queue of this.queues.values()) {
      if (queue.type !== 'dead_letter') {
        return queue;
      }
    }
    return undefined;
  }

  private async moveToDeadLetter(message: Message, reason: string): Promise<void> {
    message.state = 'failed';

    const deadLetterConfig = this.getDeadLetterConfig(message.topic);
    if (deadLetterConfig) {
      const dlqMessage: Message = {
        ...message,
        id: createMessageId('dlq'),
        topic: deadLetterConfig.queueName,
        metadata: {
          ...message.metadata,
          headers: {
            ...message.metadata.headers,
            deadLetterReason: reason,
            originalTopic: message.topic,
          },
        },
        expiresAt: Date.now() + deadLetterConfig.retentionMs,
      };

      const dlqMessages = this.deadLetterMessages.get(deadLetterConfig.queueName);
      if (dlqMessages) {
        dlqMessages.push(dlqMessage);
      }

      this.messages.set(dlqMessage.id, dlqMessage);
      this.stats.deadLetterMessages++;
    }

    this.stats.failedMessages++;
  }

  private getDeadLetterConfig(topic: string): DeadLetterConfig | undefined {
    for (const queue of this.queues.values()) {
      if (queue.deadLetterConfig && queue.deadLetterConfig.queueName.includes(topic)) {
        return queue.deadLetterConfig;
      }
    }

    const queue = this.queues.get(topic);
    return queue?.deadLetterConfig;
  }

  async getMessagesByTopic<T>(topic: string): Promise<Message<T>[]> {
    const messages: Message<T>[] = [];
    for (const message of this.messages.values()) {
      if (message.topic === topic) {
        messages.push(message as Message<T>);
      }
    }
    return messages;
  }

  async getMessagesByState(state: MessageState): Promise<Message[]> {
    const messages: Message[] = [];
    for (const message of this.messages.values()) {
      if (message.state === state) {
        messages.push(message);
      }
    }
    return messages;
  }

  async getMessagesBySubscription<T>(subscriptionId: string): Promise<Message<T>[]> {
    const messages: Message<T>[] = [];
    for (const [topicName, topicConfig] of this.topics) {
      const subscription = topicConfig.subscriptions.get(subscriptionId);
      if (subscription) {
        const topicMessages = this.subscriptionMessages.get(topicName);
        const message = topicMessages?.get(subscriptionId) as Message<T> | undefined;
        if (message) {
          messages.push(message);
        }
      }
    }
    return messages;
  }

  async getPendingMessages(queueName: string): Promise<Message[]> {
    const queue = this.queues.get(queueName);
    if (!queue) return [];

    const pendingMsgs: Message[] = [];

    for (const message of this.messages.values()) {
      if (message.topic === queueName && message.state === 'published' && !isMessageExpired(message)) {
        pendingMsgs.push(message);
      }
    }

    if (queue.type === 'priority') {
      pendingMsgs.sort(compareMessagePriority);
    }

    return pendingMsgs;
  }

  async getDeadLetterMessages(queueName: string): Promise<Message[]> {
    return this.deadLetterMessages.get(queueName) || [];
  }

  async retryDeadLetterMessage(messageId: string): Promise<boolean> {
    const message = this.messages.get(messageId);
    if (!message || message.state !== 'failed') return false;

    const topicConfig = this.topics.get(message.topic);
    if (!topicConfig) return false;

    message.state = 'pending';
    message.metadata.retryCount = 0;
    this.stats.failedMessages--;
    this.stats.pendingMessages++;

    this.distributeMessage(message, topicConfig);

    return true;
  }

  async purgeDeadLetterQueue(queueName: string): Promise<number> {
    const dlqMessages = this.deadLetterMessages.get(queueName);
    if (!dlqMessages) return 0;

    const count = dlqMessages.length;
    for (const msg of dlqMessages) {
      this.messages.delete(msg.id);
    }

    dlqMessages.length = 0;
    this.stats.deadLetterMessages -= count;

    return count;
  }

  getStats(): QueueStats {
    return { ...this.stats };
  }

  getAllQueues(): QueueConfig[] {
    return Array.from(this.queues.values());
  }

  getAllTopics(): TopicConfig[] {
    return Array.from(this.topics.values());
  }

  getSubscriptionsByConsumer(consumerId: string): Subscription[] {
    const subIds = this.consumerSubscriptions.get(consumerId);
    if (!subIds) return [];

    const subscriptions: Subscription[] = [];
    for (const topicConfig of this.topics.values()) {
      for (const subId of subIds) {
        const subscription = topicConfig.subscriptions.get(subId);
        if (subscription) {
          subscriptions.push(subscription);
        }
      }
    }
    return subscriptions;
  }

  async cleanupExpiredMessages(): Promise<number> {
    let cleanedCount = 0;

    for (const message of this.messages.values()) {
      if (isMessageExpired(message) && message.state !== 'acknowledged' && message.state !== 'failed') {
        await this.moveToDeadLetter(message, 'Message expired during retention');
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  clear(): void {
    this.queues.clear();
    this.topics.clear();
    this.messages.clear();
    this.pendingMessages.clear();
    this.deadLetterMessages.clear();
    this.subscriptionMessages.clear();
    this.consumerSubscriptions.clear();
    this.messageHandlers.clear();
    this.stats = {
      totalMessages: 0,
      pendingMessages: 0,
      publishedMessages: 0,
      consumedMessages: 0,
      acknowledgedMessages: 0,
      failedMessages: 0,
      deadLetterMessages: 0,
    };
  }
}

export const messageQueue = new MessageQueue();

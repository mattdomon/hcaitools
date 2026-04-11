import crypto from 'crypto';

export type QueueType = 'fifo' | 'priority' | 'dead_letter';
export type MessagePattern = 'pub_sub' | 'point_to_point';
export type MessageState = 'pending' | 'published' | 'consumed' | 'acknowledged' | 'failed';
export type SubscriptionType = 'exclusive' | 'shared' | 'durable';

export interface MessagePriority {
  level: number;
  comparator?: (a: unknown, b: unknown) => number;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

export interface DeadLetterConfig {
  queueName: string;
  retentionMs: number;
  maxMessageAge?: number;
}

export interface QueueConfig {
  name: string;
  type: QueueType;
  messagePattern: MessagePattern;
  durable: boolean;
  maxSize: number;
  messageTTL: number;
  priority?: MessagePriority;
  retryPolicy?: RetryPolicy;
  deadLetterConfig?: DeadLetterConfig;
  subscriptionType?: SubscriptionType;
}

export interface MessageMetadata {
  timestamp: number;
  publisherId: string;
  subscriptionId?: string;
  headers: Record<string, unknown>;
  retryCount: number;
  originalMessageId?: string;
}

export interface Message<T = unknown> {
  id: string;
  topic: string;
  payload: T;
  priority: number;
  state: MessageState;
  metadata: MessageMetadata;
  createdAt: number;
  expiresAt: number;
}

export interface Subscription {
  id: string;
  topic: string;
  type: SubscriptionType;
  consumerId: string;
  options: SubscriptionOptions;
}

export interface SubscriptionOptions {
  ackTimeout: number;
  autoAck: boolean;
  maxConcurrent: number;
  filter?: Record<string, unknown>;
}

export interface TopicConfig {
  name: string;
  subscriptions: Map<string, Subscription>;
  messageCount: number;
  createdAt: number;
}

export interface QueueStats {
  totalMessages: number;
  pendingMessages: number;
  publishedMessages: number;
  consumedMessages: number;
  acknowledgedMessages: number;
  failedMessages: number;
  deadLetterMessages: number;
}

export interface MessageHandler<T = unknown> {
  (message: Message<T>): Promise<void>;
}

export interface AckHandler {
  (messageId: string): Promise<void>;
}

export interface NackHandler {
  (messageId: string, error?: Error): Promise<void>;
}

export function createMessageId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export function createRetryPolicy(overrides?: Partial<RetryPolicy>): RetryPolicy {
  return {
    maxAttempts: 3,
    backoffMultiplier: 2,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    ...overrides,
  };
}

export function createDeadLetterConfig(queueName: string, retentionMs: number): DeadLetterConfig {
  return {
    queueName,
    retentionMs,
  };
}

export function isMessageExpired(message: Message): boolean {
  return Date.now() > message.expiresAt;
}

export function isMessageRetryable(message: Message, retryPolicy: RetryPolicy): boolean {
  return message.metadata.retryCount < retryPolicy.maxAttempts;
}

export function calculateRetryDelay(message: Message, retryPolicy: RetryPolicy): number {
  const delay = retryPolicy.initialDelayMs * Math.pow(retryPolicy.backoffMultiplier, message.metadata.retryCount);
  return Math.min(delay, retryPolicy.maxDelayMs);
}

export function isValidQueueConfig(config: Partial<QueueConfig>): config is QueueConfig {
  return (
    typeof config.name === 'string' &&
    config.name.length > 0 &&
    ['fifo', 'priority', 'dead_letter'].includes(config.type as QueueType) &&
    ['pub_sub', 'point_to_point'].includes(config.messagePattern as MessagePattern) &&
    typeof config.durable === 'boolean' &&
    typeof config.maxSize === 'number' &&
    config.maxSize > 0 &&
    typeof config.messageTTL === 'number' &&
    config.messageTTL > 0
  );
}

export function compareMessagePriority(a: Message, b: Message): number {
  if (a.priority !== b.priority) {
    return b.priority - a.priority;
  }
  return a.createdAt - b.createdAt;
}

export function createMessageMetadata(publisherId: string, headers?: Record<string, unknown>): MessageMetadata {
  return {
    timestamp: Date.now(),
    publisherId,
    headers: headers || {},
    retryCount: 0,
  };
}

export function createSubscription(
  topic: string,
  type: SubscriptionType,
  consumerId: string,
  options?: Partial<SubscriptionOptions>
): Subscription {
  return {
    id: createMessageId('sub'),
    topic,
    type,
    consumerId,
    options: {
      ackTimeout: 30000,
      autoAck: false,
      maxConcurrent: 1,
      ...options,
    },
  };
}

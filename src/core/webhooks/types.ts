/**
 * Webhook Management System Types
 * Complete type definitions for webhook registry, delivery, and management
 */

export type WebhookEventType = 
  | 'task.created'
  | 'task.updated'
  | 'task.deleted'
  | 'workflow.started'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'message.received'
  | 'message.sent'
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'payment.processed'
  | 'payment.failed'
  | 'file.uploaded'
  | 'file.deleted'
  | 'custom';

export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'retrying';

export type WebhookSigningAlgorithm = 'HMAC-SHA256' | 'HMAC-SHA384' | 'HMAC-SHA512';

export interface Webhook {
  webhookId: string;
  name: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  signingAlgorithm: WebhookSigningAlgorithm;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  filters?: WebhookFilter[];
  transformation?: WebhookPayloadTransformation;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: unknown;
}

export interface WebhookPayloadTransformation {
  template: string;
  variables: string[];
}

export interface WebhookDelivery {
  deliveryId: string;
  webhookId: string;
  eventType: WebhookEventType;
  payload: unknown;
  transformedPayload?: unknown;
  status: WebhookDeliveryStatus;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  responseStatus?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  error?: string;
  createdAt: Date;
  deliveredAt?: Date;
}

export interface WebhookDeliveryAttempt {
  attemptId: string;
  deliveryId: string;
  attemptNumber: number;
  timestamp: Date;
  durationMs: number;
  status: 'success' | 'failure';
  responseStatus?: number;
  responseBody?: string;
  error?: string;
}

export interface WebhookRegistration {
  name: string;
  url: string;
  events: WebhookEventType[];
  secret?: string;
  signingAlgorithm?: WebhookSigningAlgorithm;
  metadata?: Record<string, unknown>;
  filters?: WebhookFilter[];
  transformation?: WebhookPayloadTransformation;
}

export interface WebhookUpdate {
  name?: string;
  url?: string;
  events?: WebhookEventType[];
  secret?: string;
  signingAlgorithm?: WebhookSigningAlgorithm;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
  filters?: WebhookFilter[];
  transformation?: WebhookPayloadTransformation;
}

export interface WebhookSignature {
  algorithm: WebhookSigningAlgorithm;
  signature: string;
  timestamp: number;
  nonce?: string;
}

export interface WebhookBatchDelivery {
  batchId: string;
  webhookIds: string[];
  eventType: WebhookEventType;
  payload: unknown;
  status: 'pending' | 'processing' | 'completed' | 'partial_failure' | 'failed';
  results: WebhookBatchResult[];
  createdAt: Date;
  completedAt?: Date;
}

export interface WebhookBatchResult {
  webhookId: string;
  deliveryId?: string;
  status: 'delivered' | 'failed' | 'skipped';
  error?: string;
  responseStatus?: number;
}

export interface WebhookStatistics {
  webhookId: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  pendingDeliveries: number;
  retryingDeliveries: number;
  averageDeliveryTimeMs: number;
  successRate: number;
  lastDeliveryAt?: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
}

export interface WebhookEvent {
  eventId: string;
  eventType: WebhookEventType;
  payload: unknown;
  timestamp: Date;
  source?: string;
}

export interface WebhookFilterResult {
  passed: boolean;
  reason?: string;
}

export interface WebhookDeliveryResult {
  success: boolean;
  deliveryId: string;
  statusCode?: number;
  responseBody?: string;
  durationMs: number;
  error?: string;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatuses: number[];
}

export interface WebhookManager {
  // Registration
  register(registration: WebhookRegistration): Promise<Webhook>;
  update(webhookId: string, updates: WebhookUpdate): Promise<Webhook>;
  unregister(webhookId: string): Promise<void>;
  getWebhook(webhookId: string): Promise<Webhook | null>;
  getWebhooks(filters?: { eventType?: WebhookEventType; isActive?: boolean }): Promise<Webhook[]>;

  // Delivery
  deliver(webhookId: string, event: WebhookEvent): Promise<WebhookDeliveryResult>;
  deliverBatch(webhookIds: string[], event: WebhookEvent): Promise<WebhookBatchDelivery>;
  retryDelivery(deliveryId: string): Promise<void>;
  getDelivery(deliveryId: string): Promise<WebhookDelivery | null>;
  getWebhookDeliveries(webhookId: string, options?: GetDeliveriesOptions): Promise<WebhookDelivery[]>;

  // Signature
  generateSignature(webhook: Webhook, payload: unknown, timestamp: number, nonce?: string): WebhookSignature;
  verifySignature(webhook: Webhook, signature: WebhookSignature, payload: unknown): boolean;

  // Filtering and transformation
  applyFilters(webhook: Webhook, payload: unknown): WebhookFilterResult;
  transformPayload(webhook: Webhook, payload: unknown): unknown;

  // Statistics
  getStatistics(webhookId: string): Promise<WebhookStatistics>;
  getAllStatistics(): Promise<WebhookStatistics[]>;

  // Utility
  listEventTypes(): WebhookEventType[];
}

export interface GetDeliveriesOptions {
  status?: WebhookDeliveryStatus;
  limit?: number;
  offset?: number;
  since?: Date;
  until?: Date;
}

export interface WebhookDeliveryHistory {
  webhookId: string;
  deliveries: WebhookDelivery[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface DeliveryQueueItem {
  deliveryId: string;
  webhookId: string;
  scheduledFor: Date;
  priority: number;
}

export interface WebhookHealthStatus {
  webhookId: string;
  isHealthy: boolean;
  consecutiveFailures: number;
  lastSuccessfulDelivery?: Date;
  lastFailedDelivery?: Date;
  averageResponseTimeMs: number;
  uptimePercentage: number;
}

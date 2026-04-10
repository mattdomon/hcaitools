/**
 * Webhook Manager Implementation
 * Complete webhook management system with delivery, retry, and signature support
 */

import crypto from 'crypto';
import {
  Webhook,
  WebhookRegistration,
  WebhookUpdate,
  WebhookDelivery,
  WebhookEvent,
  WebhookEventType,
  WebhookSignature,
  WebhookManager,
  WebhookBatchDelivery,
  WebhookStatistics,
  WebhookFilterResult,
  WebhookDeliveryResult,
  GetDeliveriesOptions,
  RetryConfig,
  WebhookDeliveryAttempt,
  WebhookFilter,
} from './types';

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

export class WebhookManagerImpl implements WebhookManager {
  private webhooks: Map<string, Webhook> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();
  private deliveryAttempts: Map<string, WebhookDeliveryAttempt[]> = new Map();
  private retryQueue: Map<string, NodeJS.Timeout> = new Map();
  private httpClient: HttpClient;
  private retryConfig: RetryConfig;

  constructor(
    httpClient?: HttpClient,
    retryConfig?: Partial<RetryConfig>
  ) {
    this.httpClient = httpClient || new DefaultHttpClient();
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  async register(registration: WebhookRegistration): Promise<Webhook> {
    const secret = registration.secret || this.generateSecret();
    const webhook: Webhook = {
      webhookId: this.generateId('webhook'),
      name: registration.name,
      url: registration.url,
      events: registration.events,
      secret,
      signingAlgorithm: registration.signingAlgorithm || 'HMAC-SHA256',
      isActive: true,
      metadata: registration.metadata,
      filters: registration.filters,
      transformation: registration.transformation,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.webhooks.set(webhook.webhookId, webhook);
    return webhook;
  }

  async update(webhookId: string, updates: WebhookUpdate): Promise<Webhook> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    const updated: Webhook = {
      ...webhook,
      ...updates,
      webhookId,
      updatedAt: new Date(),
    };

    this.webhooks.set(webhookId, updated);
    return updated;
  }

  async unregister(webhookId: string): Promise<void> {
    const timeout = this.retryQueue.get(webhookId);
    if (timeout) {
      clearTimeout(timeout);
      this.retryQueue.delete(webhookId);
    }
    this.webhooks.delete(webhookId);
  }

  async getWebhook(webhookId: string): Promise<Webhook | null> {
    return this.webhooks.get(webhookId) || null;
  }

  async getWebhooks(filters?: { eventType?: WebhookEventType; isActive?: boolean }): Promise<Webhook[]> {
    let webhooks = Array.from(this.webhooks.values());

    if (filters?.eventType) {
      webhooks = webhooks.filter((w) => w.events.includes(filters.eventType!));
    }

    if (filters?.isActive !== undefined) {
      webhooks = webhooks.filter((w) => w.isActive === filters.isActive);
    }

    return webhooks;
  }

  async deliver(webhookId: string, event: WebhookEvent): Promise<WebhookDeliveryResult> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook || !webhook.isActive) {
      return {
        success: false,
        deliveryId: '',
        error: 'Webhook not found or inactive',
        durationMs: 0,
      };
    }

    if (!webhook.events.includes(event.eventType) && !webhook.events.includes('custom')) {
      return {
        success: false,
        deliveryId: '',
        error: 'Event type not subscribed',
        durationMs: 0,
      };
    }

    const filterResult = this.applyFilters(webhook, event.payload);
    if (!filterResult.passed) {
      return {
        success: false,
        deliveryId: '',
        error: `Filter failed: ${filterResult.reason}`,
        durationMs: 0,
      };
    }

    const delivery: WebhookDelivery = {
      deliveryId: this.generateId('deliv'),
      webhookId,
      eventType: event.eventType,
      payload: event.payload,
      status: 'pending',
      attempts: 0,
      maxAttempts: this.retryConfig.maxRetries,
      createdAt: new Date(),
    };

    this.deliveries.set(delivery.deliveryId, delivery);

    const transformedPayload = webhook.transformation
      ? this.transformPayload(webhook, event.payload)
      : event.payload;

    const result = await this.executeDelivery(webhook, delivery, transformedPayload);

    if (result.success) {
      delivery.status = 'delivered';
      delivery.deliveredAt = new Date();
      delivery.transformedPayload = transformedPayload;
    } else {
      delivery.attempts++;
      delivery.lastAttemptAt = new Date();
      delivery.error = result.error;

      if (this.shouldRetry(result.statusCode)) {
        delivery.status = 'retrying';
        delivery.nextRetryAt = this.calculateNextRetry(delivery.attempts);
        this.scheduleRetry(delivery.deliveryId);
      } else {
        delivery.status = 'failed';
      }
    }

    if (result.statusCode) {
      delivery.responseStatus = result.statusCode;
      delivery.responseBody = result.responseBody;
    }

    this.deliveries.set(delivery.deliveryId, delivery);
    return result;
  }

  async deliverBatch(webhookIds: string[], event: WebhookEvent): Promise<WebhookBatchDelivery> {
    const batchDelivery: WebhookBatchDelivery = {
      batchId: this.generateId('batch'),
      webhookIds,
      eventType: event.eventType,
      payload: event.payload,
      status: 'processing',
      results: [],
      createdAt: new Date(),
    };

    const eligibleWebhooks: string[] = [];

    for (const webhookId of webhookIds) {
      const webhook = this.webhooks.get(webhookId);
      if (!webhook || !webhook.isActive) {
        batchDelivery.results.push({
          webhookId,
          status: 'skipped',
          error: 'Webhook not found or inactive',
        });
        continue;
      }

      if (!webhook.events.includes(event.eventType) && !webhook.events.includes('custom')) {
        batchDelivery.results.push({
          webhookId,
          status: 'skipped',
          error: 'Event type not subscribed',
        });
        continue;
      }

      const filterResult = this.applyFilters(webhook, event.payload);
      if (!filterResult.passed) {
        batchDelivery.results.push({
          webhookId,
          status: 'skipped',
          error: `Filter failed: ${filterResult.reason}`,
        });
        continue;
      }

      eligibleWebhooks.push(webhookId);
    }

    const deliveryPromises = eligibleWebhooks.map(async (webhookId) => {
      const result = await this.deliver(webhookId, event);
      return {
        webhookId,
        deliveryId: result.deliveryId,
        status: result.success ? 'delivered' as const : 'failed' as const,
        error: result.error,
        responseStatus: result.statusCode,
      };
    });

    const results = await Promise.all(deliveryPromises);
    batchDelivery.results.push(...results);

    const hasFailures = batchDelivery.results.some((r) => r.status === 'failed');
    const allSkipped = batchDelivery.results.every((r) => r.status === 'skipped');

    if (allSkipped) {
      batchDelivery.status = 'failed';
    } else if (hasFailures) {
      batchDelivery.status = 'partial_failure';
    } else {
      batchDelivery.status = 'completed';
    }

    batchDelivery.completedAt = new Date();
    return batchDelivery;
  }

  async retryDelivery(deliveryId: string): Promise<void> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) {
      throw new Error(`Delivery ${deliveryId} not found`);
    }

    const webhook = this.webhooks.get(delivery.webhookId);
    if (!webhook || !webhook.isActive) {
      throw new Error('Webhook not found or inactive');
    }

    delivery.status = 'pending';
    delivery.attempts++;
    delivery.nextRetryAt = undefined;

    const result = await this.executeDelivery(webhook, delivery, delivery.transformedPayload || delivery.payload);

    if (result.success) {
      delivery.status = 'delivered';
      delivery.deliveredAt = new Date();
    } else {
      delivery.attempts = delivery.attempts;
      delivery.lastAttemptAt = new Date();
      delivery.error = result.error;

      if (this.shouldRetry(result.statusCode) && delivery.attempts < delivery.maxAttempts) {
        delivery.status = 'retrying';
        delivery.nextRetryAt = this.calculateNextRetry(delivery.attempts);
        this.scheduleRetry(delivery.deliveryId);
      } else {
        delivery.status = 'failed';
      }
    }

    if (result.statusCode) {
      delivery.responseStatus = result.statusCode;
      delivery.responseBody = result.responseBody;
    }

    this.deliveries.set(deliveryId, delivery);
  }

  async getDelivery(deliveryId: string): Promise<WebhookDelivery | null> {
    return this.deliveries.get(deliveryId) || null;
  }

  async getWebhookDeliveries(
    webhookId: string,
    options?: GetDeliveriesOptions
  ): Promise<WebhookDelivery[]> {
    let deliveries = Array.from(this.deliveries.values()).filter(
      (d) => d.webhookId === webhookId
    );

    if (options?.status) {
      deliveries = deliveries.filter((d) => d.status === options.status);
    }

    if (options?.since) {
      deliveries = deliveries.filter((d) => d.createdAt >= options.since!);
    }

    if (options?.until) {
      deliveries = deliveries.filter((d) => d.createdAt <= options.until!);
    }

    deliveries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (options?.offset) {
      deliveries = deliveries.slice(options.offset);
    }

    if (options?.limit) {
      deliveries = deliveries.slice(0, options.limit);
    }

    return deliveries;
  }

  generateSignature(
    webhook: Webhook,
    payload: unknown,
    timestamp: number,
    nonce?: string
  ): WebhookSignature {
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const signatureBase = `${timestamp}.${nonce || ''}.${payloadString}`;

    const algorithm = this.getSigningAlgorithm(webhook.signingAlgorithm);

    const hmac = crypto.createHmac(algorithm, webhook.secret);
    hmac.update(signatureBase);
    const signature = hmac.digest('base64');

    return {
      algorithm: webhook.signingAlgorithm,
      signature,
      timestamp,
      nonce,
    };
  }

  verifySignature(
    webhook: Webhook,
    signature: WebhookSignature,
    payload: unknown
  ): boolean {
    const expectedSignature = this.generateSignature(
      webhook,
      payload,
      signature.timestamp,
      signature.nonce
    );

    if (expectedSignature.algorithm !== signature.algorithm) {
      return false;
    }

    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const signatureBase = `${signature.timestamp}.${signature.nonce || ''}.${payloadString}`;

    const algorithm = this.getSigningAlgorithm(signature.algorithm);
    const hmac = crypto.createHmac(algorithm, webhook.secret);
    hmac.update(signatureBase);
    const computedSignature = hmac.digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(computedSignature),
      Buffer.from(signature.signature)
    );
  }

  applyFilters(webhook: Webhook, payload: unknown): WebhookFilterResult {
    if (!webhook.filters || webhook.filters.length === 0) {
      return { passed: true };
    }

    const payloadObj = this.isRecord(payload) ? payload : {};

    for (const filter of webhook.filters) {
      const fieldValue = this.getNestedValue(payloadObj, filter.field);

      const passed = this.evaluateFilter(fieldValue, filter);
      if (!passed) {
        return {
          passed: false,
          reason: `Filter failed: ${filter.field} ${filter.operator} ${JSON.stringify(filter.value)}`,
        };
      }
    }

    return { passed: true };
  }

  transformPayload(webhook: Webhook, payload: unknown): unknown {
    if (!webhook.transformation) {
      return payload;
    }

    let transformed = webhook.transformation.template;

    for (const variable of webhook.transformation.variables) {
      const value = this.getNestedValue(this.isRecord(payload) ? payload : {}, variable);
      transformed = transformed.replace(new RegExp(`{{${variable}}}`, 'g'), String(value ?? ''));
    }

    try {
      return JSON.parse(transformed);
    } catch {
      return transformed;
    }
  }

  async getStatistics(webhookId: string): Promise<WebhookStatistics> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    const deliveries = await this.getWebhookDeliveries(webhookId, { limit: 1000 });

    const totalDeliveries = deliveries.length;
    const successfulDeliveries = deliveries.filter((d) => d.status === 'delivered').length;
    const failedDeliveries = deliveries.filter((d) => d.status === 'failed').length;
    const pendingDeliveries = deliveries.filter((d) => d.status === 'pending').length;
    const retryingDeliveries = deliveries.filter((d) => d.status === 'retrying').length;

    const successRate = totalDeliveries > 0 ? successfulDeliveries / totalDeliveries : 0;

    const deliveredWithTime = deliveries.filter(
      (d) => d.deliveredAt && d.lastAttemptAt
    );
    const averageDeliveryTimeMs =
      deliveredWithTime.length > 0
        ? deliveredWithTime.reduce((sum, d) => {
            const deliveryTime = (d.deliveredAt!.getTime() - d.createdAt.getTime());
            return sum + deliveryTime;
          }, 0) / deliveredWithTime.length
        : 0;

    const lastDelivery = deliveries[0];
    const lastSuccess = deliveries.find((d) => d.status === 'delivered');
    const lastFailure = deliveries.find((d) => d.status === 'failed');

    return {
      webhookId,
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      pendingDeliveries,
      retryingDeliveries,
      averageDeliveryTimeMs,
      successRate,
      lastDeliveryAt: lastDelivery?.createdAt,
      lastSuccessAt: lastSuccess?.deliveredAt,
      lastFailureAt: lastFailure?.lastAttemptAt,
    };
  }

  async getAllStatistics(): Promise<WebhookStatistics[]> {
    const statistics: WebhookStatistics[] = [];
    for (const webhook of this.webhooks.values()) {
      const stats = await this.getStatistics(webhook.webhookId);
      statistics.push(stats);
    }
    return statistics;
  }

  listEventTypes(): WebhookEventType[] {
    return [
      'task.created',
      'task.updated',
      'task.deleted',
      'workflow.started',
      'workflow.completed',
      'workflow.failed',
      'message.received',
      'message.sent',
      'user.created',
      'user.updated',
      'user.deleted',
      'payment.processed',
      'payment.failed',
      'file.uploaded',
      'file.deleted',
      'custom',
    ];
  }

  private async executeDelivery(
    webhook: Webhook,
    delivery: WebhookDelivery,
    transformedPayload: unknown
  ): Promise<WebhookDeliveryResult> {
    const startTime = Date.now();
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(8).toString('hex');
    const signature = this.generateSignature(webhook, transformedPayload, timestamp, nonce);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Id': webhook.webhookId,
      'X-Webhook-Signature': signature.signature,
      'X-Webhook-Timestamp': timestamp.toString(),
      'X-Webhook-Nonce': nonce,
      'X-Delivery-Id': delivery.deliveryId,
      'X-Event-Type': delivery.eventType,
    };

    try {
      const response = await this.httpClient.post(webhook.url, transformedPayload, headers);
      const durationMs = Date.now() - startTime;
      const isSuccess = response.statusCode >= 200 && response.statusCode < 300;

      if (isSuccess) {
        this.recordAttempt(delivery.deliveryId, {
          status: 'success',
          responseStatus: response.statusCode,
          responseBody: response.body,
          durationMs,
        });

        return {
          success: true,
          deliveryId: delivery.deliveryId,
          statusCode: response.statusCode,
          responseBody: response.body,
          durationMs,
        };
      } else {
        this.recordAttempt(delivery.deliveryId, {
          status: 'failure',
          responseStatus: response.statusCode,
          responseBody: response.body,
          durationMs,
          error: `HTTP ${response.statusCode}: ${response.body}`,
        });

        return {
          success: false,
          deliveryId: delivery.deliveryId,
          statusCode: response.statusCode,
          responseBody: response.body,
          error: `HTTP ${response.statusCode}: ${response.body}`,
          durationMs,
        };
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.recordAttempt(delivery.deliveryId, {
        status: 'failure',
        error: errorMessage,
        durationMs,
      });

      return {
        success: false,
        deliveryId: delivery.deliveryId,
        error: errorMessage,
        durationMs,
      };
    }
  }

  private shouldRetry(statusCode?: number): boolean {
    if (!statusCode) return true;
    return this.retryConfig.retryableStatuses.includes(statusCode);
  }

  private calculateNextRetry(attemptNumber: number): Date {
    const delayMs = Math.min(
      this.retryConfig.baseDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attemptNumber - 1),
      this.retryConfig.maxDelayMs
    );
    return new Date(Date.now() + delayMs);
  }

  private scheduleRetry(deliveryId: string): void {
    const existingTimeout = this.retryQueue.get(deliveryId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const delivery = this.deliveries.get(deliveryId);
    if (!delivery || !delivery.nextRetryAt) return;

    const delay = delivery.nextRetryAt.getTime() - Date.now();
    if (delay <= 0) {
      this.retryDelivery(deliveryId).catch(() => {});
      return;
    }

    const timeout = setTimeout(() => {
      this.retryDelivery(deliveryId).catch(() => {});
      this.retryQueue.delete(deliveryId);
    }, delay);

    this.retryQueue.set(deliveryId, timeout);
  }

  private recordAttempt(
    deliveryId: string,
    result: { status: 'success' | 'failure'; responseStatus?: number; responseBody?: string; error?: string; durationMs: number }
  ): void {
    const attempts = this.deliveryAttempts.get(deliveryId) || [];
    const attempt: WebhookDeliveryAttempt = {
      attemptId: this.generateId('attempt'),
      deliveryId,
      attemptNumber: attempts.length + 1,
      timestamp: new Date(),
      durationMs: result.durationMs,
      status: result.status,
      responseStatus: result.responseStatus,
      responseBody: result.responseBody,
      error: result.error,
    };
    attempts.push(attempt);
    this.deliveryAttempts.set(deliveryId, attempts);
  }

  private getSigningAlgorithm(algorithm: string): string {
    const mapping: Record<string, string> = {
      'HMAC-SHA256': 'sha256',
      'HMAC-SHA384': 'sha384',
      'HMAC-SHA512': 'sha512',
    };
    return mapping[algorithm] || 'sha256';
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object' && !Array.isArray(current)) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private evaluateFilter(fieldValue: unknown, filter: WebhookFilter): boolean {
    const { operator, value } = filter;

    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'contains':
        return typeof fieldValue === 'string' && typeof value === 'string' && fieldValue.includes(value);
      case 'not_contains':
        return typeof fieldValue === 'string' && typeof value === 'string' && !fieldValue.includes(value);
      case 'starts_with':
        return typeof fieldValue === 'string' && typeof value === 'string' && fieldValue.startsWith(value);
      case 'ends_with':
        return typeof fieldValue === 'string' && typeof value === 'string' && fieldValue.endsWith(value);
      case 'greater_than':
        return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue > value;
      case 'less_than':
        return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue < value;
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(fieldValue);
      default:
        return false;
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

export interface HttpClient {
  post(url: string, body: unknown, headers: Record<string, string>): Promise<HttpResponse>;
}

export interface HttpResponse {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
}

class DefaultHttpClient implements HttpClient {
  async post(url: string, body: unknown, headers: Record<string, string>): Promise<HttpResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseBody = await response.text();

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        statusCode: response.status,
        body: responseBody,
        headers: responseHeaders,
      };
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }
}

export function createWebhookManager(httpClient?: HttpClient, retryConfig?: Partial<RetryConfig>): WebhookManagerImpl {
  return new WebhookManagerImpl(httpClient, retryConfig);
}

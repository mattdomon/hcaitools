/**
 * Webhook Management System
 * Complete webhook registry with URL management, event filtering, payload transformation,
 * signing and signature verification, retry logic with exponential backoff, delivery status tracking,
 * and batch webhook delivery.
 */

import crypto from 'crypto';
import { WebhookManagerImpl, HttpClient } from './webhookManager';
import {
  WebhookEventType,
  WebhookSigningAlgorithm,
  WebhookFilter,
  WebhookPayloadTransformation,
  WebhookUpdate,
  WebhookSignature,
  WebhookEvent,
  WebhookDeliveryResult,
  GetDeliveriesOptions,
  RetryConfig,
  WebhookDelivery,
} from './types';
import { Webhook, WebhookBatchDelivery, WebhookStatistics } from './types';

export {
  WebhookEventType,
  WebhookDeliveryStatus,
  WebhookSigningAlgorithm,
  Webhook,
  WebhookFilter,
  WebhookPayloadTransformation,
  WebhookDelivery,
  WebhookDeliveryAttempt,
  WebhookRegistration,
  WebhookUpdate,
  WebhookSignature,
  WebhookBatchDelivery,
  WebhookBatchResult,
  WebhookStatistics,
  WebhookEvent,
  WebhookFilterResult,
  WebhookDeliveryResult,
  RetryConfig,
  WebhookManager,
  GetDeliveriesOptions,
  WebhookDeliveryHistory,
  DeliveryQueueItem,
  WebhookHealthStatus,
} from './types';

export {
  WebhookManagerImpl,
  createWebhookManager,
  HttpClient,
  HttpResponse,
} from './webhookManager';

export class WebhookManus {
  private manager: WebhookManagerImpl;

  constructor(httpClient?: HttpClient, retryConfig?: Partial<RetryConfig>) {
    this.manager = new WebhookManagerImpl(httpClient, retryConfig);
  }

  async register(
    name: string,
    url: string,
    events: WebhookEventType[],
    options?: {
      secret?: string;
      signingAlgorithm?: WebhookSigningAlgorithm;
      metadata?: Record<string, unknown>;
      filters?: WebhookFilter[];
      transformation?: WebhookPayloadTransformation;
    }
  ): Promise<Webhook> {
    return this.manager.register({
      name,
      url,
      events,
      ...options,
    });
  }

  async update(webhookId: string, updates: WebhookUpdate): Promise<Webhook> {
    return this.manager.update(webhookId, updates);
  }

  async unregister(webhookId: string): Promise<void> {
    return this.manager.unregister(webhookId);
  }

  async getWebhook(webhookId: string): Promise<Webhook | null> {
    return this.manager.getWebhook(webhookId);
  }

  async listWebhooks(filters?: { eventType?: WebhookEventType; isActive?: boolean }): Promise<Webhook[]> {
    return this.manager.getWebhooks(filters);
  }

  async deliver(webhookId: string, eventType: WebhookEventType, payload: unknown): Promise<WebhookDeliveryResult> {
    const event: WebhookEvent = {
      eventId: this.generateId('evt'),
      eventType,
      payload,
      timestamp: new Date(),
    };
    return this.manager.deliver(webhookId, event);
  }

  async deliverBatch(
    webhookIds: string[],
    eventType: WebhookEventType,
    payload: unknown
  ): Promise<WebhookBatchDelivery> {
    const event: WebhookEvent = {
      eventId: this.generateId('evt'),
      eventType,
      payload,
      timestamp: new Date(),
    };
    return this.manager.deliverBatch(webhookIds, event);
  }

  async retryDelivery(deliveryId: string): Promise<void> {
    return this.manager.retryDelivery(deliveryId);
  }

  async getDelivery(deliveryId: string): Promise<WebhookDelivery | null> {
    return this.manager.getDelivery(deliveryId);
  }

  async getDeliveryHistory(
    webhookId: string,
    options?: GetDeliveriesOptions
  ): Promise<WebhookDelivery[]> {
    return this.manager.getWebhookDeliveries(webhookId, options);
  }

  async generateSignature(
    webhookId: string,
    payload: unknown,
    timestamp: number,
    nonce?: string
  ): Promise<WebhookSignature | null> {
    const webhook = await this.manager.getWebhook(webhookId);
    if (!webhook) return null;
    return this.manager.generateSignature(webhook, payload, timestamp, nonce);
  }

  async verifySignature(
    webhookId: string,
    signature: WebhookSignature,
    payload: unknown
  ): Promise<boolean> {
    const webhook = await this.manager.getWebhook(webhookId);
    if (!webhook) return false;
    return this.manager.verifySignature(webhook, signature, payload);
  }

  async getStatistics(webhookId: string): Promise<WebhookStatistics> {
    return this.manager.getStatistics(webhookId);
  }

  async getAllStatistics(): Promise<WebhookStatistics[]> {
    return this.manager.getAllStatistics();
  }

  listEventTypes(): WebhookEventType[] {
    return this.manager.listEventTypes();
  }

  async enable(webhookId: string): Promise<Webhook> {
    return this.manager.update(webhookId, { isActive: true });
  }

  async disable(webhookId: string): Promise<Webhook> {
    return this.manager.update(webhookId, { isActive: false });
  }

  async rotateSecret(webhookId: string): Promise<Webhook> {
    const secret = crypto.randomBytes(32).toString('hex');
    return this.manager.update(webhookId, { secret });
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

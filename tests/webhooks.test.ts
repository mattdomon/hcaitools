/**
 * Webhook Management System Tests
 * Comprehensive tests for webhook registry, delivery, retry, signature, and batch delivery
 */

import crypto from 'crypto';
import {
  WebhookManagerImpl,
  HttpClient,
  HttpResponse,
} from '../src/core/webhooks/webhookManager';
import {
  WebhookEventType,
  WebhookRegistration,
  Webhook,
  WebhookDelivery,
  WebhookDeliveryStatus,
  WebhookSignature,
  WebhookEvent,
  WebhookBatchDelivery,
  WebhookStatistics,
  WebhookFilter,
  WebhookPayloadTransformation,
  WebhookManager,
  RetryConfig,
} from '../src/core/webhooks/types';

const TEST_EVENT_TYPES: WebhookEventType[] = [
  'task.created',
  'task.updated',
  'workflow.completed',
  'message.received',
  'payment.processed',
];

interface MockHttpResponse {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
}

class MockHttpClient implements HttpClient {
  private responses: Map<string, MockHttpResponse> = new Map();
  private calls: Array<{ url: string; body: unknown; headers: Record<string, string> }> = [];

  setResponse(url: string, response: MockHttpResponse): void {
    this.responses.set(url, response);
  }

  getCalls(): Array<{ url: string; body: unknown; headers: Record<string, string> }> {
    return this.calls;
  }

  clearCalls(): void {
    this.calls = [];
  }

  async post(url: string, body: unknown, headers: Record<string, string>): Promise<HttpResponse> {
    this.calls.push({ url, body, headers });
    const response = this.responses.get(url);
    if (response) {
      return response;
    }
    throw new Error(`No mock response set for URL: ${url}`);
  }
}

describe('WebhookManager', () => {
  let manager: WebhookManagerImpl;
  let mockHttpClient: MockHttpClient;

  beforeEach(() => {
    mockHttpClient = new MockHttpClient();
    manager = new WebhookManagerImpl(mockHttpClient);
  });

  describe('Webhook Registration', () => {
    test('should register a new webhook with generated ID and secret', async () => {
      const registration: WebhookRegistration = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created', 'task.updated'],
      };

      const webhook = await manager.register(registration);

      expect(webhook.webhookId).toMatch(/^webhook_[a-f0-9]{16}$/);
      expect(webhook.name).toBe('Test Webhook');
      expect(webhook.url).toBe('https://example.com/webhook');
      expect(webhook.events).toEqual(['task.created', 'task.updated']);
      expect(webhook.secret).toHaveLength(64);
      expect(webhook.signingAlgorithm).toBe('HMAC-SHA256');
      expect(webhook.isActive).toBe(true);
      expect(webhook.createdAt).toBeInstanceOf(Date);
    });

    test('should register webhook with custom secret', async () => {
      const customSecret = 'custom_secret_key_12345';
      const registration: WebhookRegistration = {
        name: 'Custom Secret Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
        secret: customSecret,
      };

      const webhook = await manager.register(registration);
      expect(webhook.secret).toBe(customSecret);
    });

    test('should register webhook with custom signing algorithm', async () => {
      const registration: WebhookRegistration = {
        name: 'SHA384 Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
        signingAlgorithm: 'HMAC-SHA384',
      };

      const webhook = await manager.register(registration);
      expect(webhook.signingAlgorithm).toBe('HMAC-SHA384');
    });

    test('should register webhook with metadata', async () => {
      const registration: WebhookRegistration = {
        name: 'Metadata Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
        metadata: { owner: 'test-team', environment: 'production' },
      };

      const webhook = await manager.register(registration);
      expect(webhook.metadata).toEqual({ owner: 'test-team', environment: 'production' });
    });

    test('should register multiple webhooks with unique IDs', async () => {
      const webhook1 = await manager.register({
        name: 'Webhook 1',
        url: 'https://example.com/webhook1',
        events: ['task.created'],
      });

      const webhook2 = await manager.register({
        name: 'Webhook 2',
        url: 'https://example.com/webhook2',
        events: ['task.created'],
      });

      expect(webhook1.webhookId).not.toBe(webhook2.webhookId);
    });
  });

  describe('Webhook Update', () => {
    test('should update webhook name', async () => {
      const webhook = await manager.register({
        name: 'Original Name',
        url: 'https://example.com/webhook',
        events: ['task.created'],
      });

      const updated = await manager.update(webhook.webhookId, { name: 'Updated Name' });

      expect(updated.name).toBe('Updated Name');
      expect(updated.webhookId).toBe(webhook.webhookId);
    });

    test('should update webhook URL', async () => {
      const webhook = await manager.register({
        name: 'Test Webhook',
        url: 'https://example.com/old',
        events: ['task.created'],
      });

      const updated = await manager.update(webhook.webhookId, { url: 'https://example.com/new' });

      expect(updated.url).toBe('https://example.com/new');
    });

    test('should update webhook events', async () => {
      const webhook = await manager.register({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
      });

      const updated = await manager.update(webhook.webhookId, {
        events: ['task.created', 'task.updated', 'workflow.completed'],
      });

      expect(updated.events).toEqual(['task.created', 'task.updated', 'workflow.completed']);
    });

    test('should update webhook active status', async () => {
      const webhook = await manager.register({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
      });

      const deactivated = await manager.update(webhook.webhookId, { isActive: false });
      expect(deactivated.isActive).toBe(false);

      const reactivated = await manager.update(webhook.webhookId, { isActive: true });
      expect(reactivated.isActive).toBe(true);
    });

    test('should throw error when updating non-existent webhook', async () => {
      await expect(
        manager.update('non_existent_id', { name: 'Test' })
      ).rejects.toThrow('Webhook non_existent_id not found');
    });
  });

  describe('Webhook Retrieval', () => {
    test('should get webhook by ID', async () => {
      const registered = await manager.register({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
      });

      const retrieved = await manager.getWebhook(registered.webhookId);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.webhookId).toBe(registered.webhookId);
    });

    test('should return null for non-existent webhook', async () => {
      const result = await manager.getWebhook('non_existent_id');
      expect(result).toBeNull();
    });

    test('should get webhooks filtered by event type', async () => {
      await manager.register({
        name: 'Task Webhook',
        url: 'https://example.com/task',
        events: ['task.created', 'task.updated'],
      });

      await manager.register({
        name: 'Workflow Webhook',
        url: 'https://example.com/workflow',
        events: ['workflow.completed'],
      });

      const taskWebhooks = await manager.getWebhooks({ eventType: 'task.created' });
      expect(taskWebhooks.length).toBe(1);
      expect(taskWebhooks[0].name).toBe('Task Webhook');
    });

    test('should get webhooks filtered by active status', async () => {
      const webhook1 = await manager.register({
        name: 'Active Webhook',
        url: 'https://example.com/active',
        events: ['task.created'],
      });

      await manager.register({
        name: 'Inactive Webhook',
        url: 'https://example.com/inactive',
        events: ['task.created'],
      });

      await manager.update(webhook1.webhookId, { isActive: false });

      const activeWebhooks = await manager.getWebhooks({ isActive: true });
      expect(activeWebhooks.length).toBe(1);
      expect(activeWebhooks[0].name).toBe('Inactive Webhook');
    });
  });

  describe('Webhook Unregistration', () => {
    test('should unregister existing webhook', async () => {
      const webhook = await manager.register({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
      });

      await manager.unregister(webhook.webhookId);

      const retrieved = await manager.getWebhook(webhook.webhookId);
      expect(retrieved).toBeNull();
    });

    test('should not throw when unregistering non-existent webhook', async () => {
      await expect(manager.unregister('non_existent_id')).resolves.not.toThrow();
    });
  });

  describe('Signature Generation and Verification', () => {
    test('should generate valid HMAC-SHA256 signature', async () => {
      const webhook = await manager.register({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
      });

      const payload = { taskId: '123', action: 'created' };
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = manager.generateSignature(webhook, payload, timestamp);

      expect(signature.algorithm).toBe('HMAC-SHA256');
      expect(signature.signature).toBeTruthy();
      expect(signature.timestamp).toBe(timestamp);
    });

    test('should generate signature with nonce', async () => {
      const webhook = await manager.register({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
      });

      const payload = { taskId: '123' };
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = 'random_nonce_value';

      const signature = manager.generateSignature(webhook, payload, timestamp, nonce);

      expect(signature.nonce).toBe(nonce);
    });

    test('should verify valid signature', async () => {
      const webhook = await manager.register({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
      });

      const payload = { taskId: '123', action: 'created' };
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = manager.generateSignature(webhook, payload, timestamp);

      const isValid = manager.verifySignature(webhook, signature, payload);
      expect(isValid).toBe(true);
    });

    test('should reject invalid signature', async () => {
      const webhook = await manager.register({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
      });

      const payload = { taskId: '123' };
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = manager.generateSignature(webhook, payload, timestamp);

      const tamperedPayload = { taskId: '456' };
      const isValid = manager.verifySignature(webhook, signature, tamperedPayload);

      expect(isValid).toBe(false);
    });

    test('should reject signature with wrong algorithm', async () => {
      const webhook = await manager.register({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
        signingAlgorithm: 'HMAC-SHA256',
      });

      const payload = { taskId: '123' };
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = manager.generateSignature(webhook, payload, timestamp);
      signature.algorithm = 'HMAC-SHA384';

      const isValid = manager.verifySignature(webhook, signature, payload);
      expect(isValid).toBe(false);
    });

    test('should verify signature with SHA512 algorithm', async () => {
      const webhook = await manager.register({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
        signingAlgorithm: 'HMAC-SHA512',
      });

      const payload = { taskId: '123' };
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = manager.generateSignature(webhook, payload, timestamp);
      expect(signature.algorithm).toBe('HMAC-SHA512');

      const isValid = manager.verifySignature(webhook, signature, payload);
      expect(isValid).toBe(true);
    });
  });

  describe('Event Filtering', () => {
    test('should pass filter with matching equals condition', async () => {
      const webhook = await manager.register({
        name: 'Filtered Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
        filters: [{ field: 'status', operator: 'equals', value: 'active' }],
      });

      const result = manager.applyFilters(webhook, { status: 'active' });
      expect(result.passed).toBe(true);
    });

    test('should fail filter with non-matching equals condition', async () => {
      const webhook = await manager.register({
        name: 'Filtered Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
        filters: [{ field: 'status', operator: 'equals', value: 'active' }],
      });

      const result = manager.applyFilters(webhook, { status: 'inactive' });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Filter failed');
    });

    test('should pass filter with contains operator', async () => {
      const webhook = await manager.register({
        name: 'Filtered Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
        filters: [{ field: 'message', operator: 'contains', value: 'urgent' }],
      });

      const result = manager.applyFilters(webhook, { message: 'This is urgent!' });
      expect(result.passed).toBe(true);
    });

    test('should pass filter with in operator', async () => {
      const webhook = await manager.register({
        name: 'Filtered Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
        filters: [{ field: 'status', operator: 'in', value: ['active', 'pending'] }],
      });

      const result = manager.applyFilters(webhook, { status: 'pending' });
      expect(result.passed).toBe(true);
    });

    test('should fail filter with not_in operator', async () => {
      const webhook = await manager.register({
        name: 'Filtered Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
        filters: [{ field: 'status', operator: 'not_in', value: ['deleted', 'archived'] }],
      });

      const result = manager.applyFilters(webhook, { status: 'deleted' });
      expect(result.passed).toBe(false);
    });

    test('should pass filter with nested field', async () => {
      const webhook = await manager.register({
        name: 'Filtered Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
        filters: [{ field: 'user.id', operator: 'equals', value: 'user123' }],
      });

      const result = manager.applyFilters(webhook, { user: { id: 'user123', name: 'Test' } });
      expect(result.passed).toBe(true);
    });

    test('should pass when no filters defined', async () => {
      const webhook = await manager.register({
        name: 'No Filter Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
      });

      const result = manager.applyFilters(webhook, { any: 'data' });
      expect(result.passed).toBe(true);
    });
  });

  describe('Payload Transformation', () => {
    test('should transform payload using template', async () => {
      const webhook = await manager.register({
        name: 'Transformed Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
        transformation: {
          template: '{"taskId": "{{id}}", "event": "{{event}}"}',
          variables: ['id', 'event'],
        },
      });

      const payload = { id: 'task_123', event: 'created', extra: 'data' };
      const result = manager.transformPayload(webhook, payload);

      expect(result).toEqual({ taskId: 'task_123', event: 'created' });
    });

    test('should handle missing variables in transformation', async () => {
      const webhook = await manager.register({
        name: 'Transformed Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
        transformation: {
          template: '{"taskId": "{{id}}", "missing": "{{nonexistent}}"}',
          variables: ['id', 'nonexistent'],
        },
      });

      const payload = { id: 'task_123' };
      const result = manager.transformPayload(webhook, payload);

      expect(result).toEqual({ taskId: 'task_123', missing: '' });
    });

    test('should return original payload when no transformation defined', async () => {
      const webhook = await manager.register({
        name: 'No Transform Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
      });

      const payload = { test: 'data' };
      const result = manager.transformPayload(webhook, payload);

      expect(result).toEqual(payload);
    });
  });

  describe('Event Delivery', () => {
    test('should deliver event successfully', async () => {
      const webhook = await manager.register({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
      });

      mockHttpClient.setResponse('https://example.com/webhook', {
        statusCode: 200,
        body: 'OK',
        headers: {},
      });

      const event: WebhookEvent = {
        eventId: 'evt_123',
        eventType: 'task.created',
        payload: { taskId: 'task_123' },
        timestamp: new Date(),
      };

      const result = await manager.deliver(webhook.webhookId, event);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
    });

    test('should reject delivery for inactive webhook', async () => {
      const webhook = await manager.register({
        name: 'Inactive Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
      });

      await manager.update(webhook.webhookId, { isActive: false });

      const event: WebhookEvent = {
        eventId: 'evt_123',
        eventType: 'task.created',
        payload: { taskId: 'task_123' },
        timestamp: new Date(),
      };

      const result = await manager.deliver(webhook.webhookId, event);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found or inactive');
    });

    test('should reject delivery for non-subscribed event type', async () => {
      const webhook = await manager.register({
        name: 'Task Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
      });

      const event: WebhookEvent = {
        eventId: 'evt_123',
        eventType: 'workflow.completed',
        payload: { workflowId: 'wf_123' },
        timestamp: new Date(),
      };

      const result = await manager.deliver(webhook.webhookId, event);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Event type not subscribed');
    });

    test('should include signature headers in delivery', async () => {
      const webhook = await manager.register({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
      });

      mockHttpClient.setResponse('https://example.com/webhook', {
        statusCode: 200,
        body: 'OK',
        headers: {},
      });

      const event: WebhookEvent = {
        eventId: 'evt_123',
        eventType: 'task.created',
        payload: { taskId: 'task_123' },
        timestamp: new Date(),
      };

      await manager.deliver(webhook.webhookId, event);

      const calls = mockHttpClient.getCalls();
      expect(calls.length).toBe(1);
      expect(calls[0].headers['X-Webhook-Id']).toBe(webhook.webhookId);
      expect(calls[0].headers['X-Webhook-Signature']).toBeTruthy();
      expect(calls[0].headers['X-Event-Type']).toBe('task.created');
    });

    test('should mark delivery as failed on HTTP error', async () => {
      const webhook = await manager.register({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
      });

      mockHttpClient.setResponse('https://example.com/webhook', {
        statusCode: 500,
        body: 'Internal Server Error',
        headers: {},
      });

      const event: WebhookEvent = {
        eventId: 'evt_123',
        eventType: 'task.created',
        payload: { taskId: 'task_123' },
        timestamp: new Date(),
      };

      const result = await manager.deliver(webhook.webhookId, event);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
    });
  });

  describe('Batch Delivery', () => {
    test('should deliver event to multiple webhooks', async () => {
      const webhook1 = await manager.register({
        name: 'Webhook 1',
        url: 'https://example.com/webhook1',
        events: ['task.created'],
      });

      const webhook2 = await manager.register({
        name: 'Webhook 2',
        url: 'https://example.com/webhook2',
        events: ['task.created'],
      });

      mockHttpClient.setResponse('https://example.com/webhook1', {
        statusCode: 200,
        body: 'OK',
        headers: {},
      });

      mockHttpClient.setResponse('https://example.com/webhook2', {
        statusCode: 200,
        body: 'OK',
        headers: {},
      });

      const event: WebhookEvent = {
        eventId: 'evt_123',
        eventType: 'task.created',
        payload: { taskId: 'task_123' },
        timestamp: new Date(),
      };

      const result = await manager.deliverBatch([webhook1.webhookId, webhook2.webhookId], event);

      expect(result.status).toBe('completed');
      expect(result.results.length).toBe(2);
      expect(result.results.every((r) => r.status === 'delivered')).toBe(true);
    });

    test('should handle partial failure in batch delivery', async () => {
      const webhook1 = await manager.register({
        name: 'Success Webhook',
        url: 'https://example.com/success',
        events: ['task.created'],
      });

      const webhook2 = await manager.register({
        name: 'Failure Webhook',
        url: 'https://example.com/failure',
        events: ['task.created'],
      });

      mockHttpClient.setResponse('https://example.com/success', {
        statusCode: 200,
        body: 'OK',
        headers: {},
      });

      mockHttpClient.setResponse('https://example.com/failure', {
        statusCode: 500,
        body: 'Error',
        headers: {},
      });

      const event: WebhookEvent = {
        eventId: 'evt_123',
        eventType: 'task.created',
        payload: { taskId: 'task_123' },
        timestamp: new Date(),
      };

      const result = await manager.deliverBatch([webhook1.webhookId, webhook2.webhookId], event);

      expect(result.status).toBe('partial_failure');
      expect(result.results.find((r) => r.webhookId === webhook1.webhookId)?.status).toBe('delivered');
      expect(result.results.find((r) => r.webhookId === webhook2.webhookId)?.status).toBe('failed');
    });

    test('should skip webhooks not subscribed to event', async () => {
      const webhook = await manager.register({
        name: 'Task Webhook',
        url: 'https://example.com/task',
        events: ['task.created'],
      });

      mockHttpClient.setResponse('https://example.com/task', {
        statusCode: 200,
        body: 'OK',
        headers: {},
      });

      const event: WebhookEvent = {
        eventId: 'evt_123',
        eventType: 'workflow.completed',
        payload: { workflowId: 'wf_123' },
        timestamp: new Date(),
      };

      const result = await manager.deliverBatch([webhook.webhookId], event);

      expect(result.results[0].status).toBe('skipped');
    });
  });

  describe('Delivery History', () => {
    test('should track delivery status', async () => {
      const webhook = await manager.register({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
      });

      mockHttpClient.setResponse('https://example.com/webhook', {
        statusCode: 200,
        body: 'OK',
        headers: {},
      });

      const event: WebhookEvent = {
        eventId: 'evt_123',
        eventType: 'task.created',
        payload: { taskId: 'task_123' },
        timestamp: new Date(),
      };

      await manager.deliver(webhook.webhookId, event);

      const deliveries = await manager.getWebhookDeliveries(webhook.webhookId);
      expect(deliveries.length).toBe(1);
      expect(deliveries[0].status).toBe('delivered');
    });

    test('should filter deliveries by status', async () => {
      const webhook = await manager.register({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
      });

      mockHttpClient.setResponse('https://example.com/webhook', {
        statusCode: 200,
        body: 'OK',
        headers: {},
      });

      const event: WebhookEvent = {
        eventId: 'evt_123',
        eventType: 'task.created',
        payload: { taskId: 'task_123' },
        timestamp: new Date(),
      };

      await manager.deliver(webhook.webhookId, event);

      const delivered = await manager.getWebhookDeliveries(webhook.webhookId, { status: 'delivered' });
      const pending = await manager.getWebhookDeliveries(webhook.webhookId, { status: 'pending' });

      expect(delivered.length).toBe(1);
      expect(pending.length).toBe(0);
    });
  });

  describe('Statistics', () => {
    test('should calculate webhook statistics', async () => {
      const webhook = await manager.register({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
      });

      mockHttpClient.setResponse('https://example.com/webhook', {
        statusCode: 200,
        body: 'OK',
        headers: {},
      });

      for (let i = 0; i < 5; i++) {
        const event: WebhookEvent = {
          eventId: `evt_${i}`,
          eventType: 'task.created',
          payload: { taskId: `task_${i}` },
          timestamp: new Date(),
        };
        await manager.deliver(webhook.webhookId, event);
      }

      const stats = await manager.getStatistics(webhook.webhookId);

      expect(stats.totalDeliveries).toBe(5);
      expect(stats.successfulDeliveries).toBe(5);
      expect(stats.failedDeliveries).toBe(0);
      expect(stats.successRate).toBe(1);
    });

    test('should return statistics for all webhooks', async () => {
      await manager.register({
        name: 'Webhook 1',
        url: 'https://example.com/webhook1',
        events: ['task.created'],
      });

      await manager.register({
        name: 'Webhook 2',
        url: 'https://example.com/webhook2',
        events: ['task.created'],
      });

      const allStats = await manager.getAllStatistics();
      expect(allStats.length).toBe(2);
    });
  });

  describe('Event Types', () => {
    test('should list all available event types', () => {
      const eventTypes = manager.listEventTypes();

      expect(eventTypes).toContain('task.created');
      expect(eventTypes).toContain('task.updated');
      expect(eventTypes).toContain('workflow.completed');
      expect(eventTypes).toContain('message.received');
      expect(eventTypes).toContain('payment.processed');
      expect(eventTypes).toContain('custom');
    });
  });

  describe('Custom HTTP Client', () => {
    test('should use custom HTTP client for delivery', async () => {
      const customClient: HttpClient = {
        async post(url, body, headers) {
          return {
            statusCode: 201,
            body: 'Created',
            headers: { 'content-type': 'application/json' },
          };
        },
      };

      const customManager = new WebhookManagerImpl(customClient);

      const webhook = await customManager.register({
        name: 'Custom Client Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
      });

      const event: WebhookEvent = {
        eventId: 'evt_123',
        eventType: 'task.created',
        payload: { taskId: 'task_123' },
        timestamp: new Date(),
      };

      const result = await customManager.deliver(webhook.webhookId, event);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(201);
    });
  });

  describe('Custom Retry Configuration', () => {
    test('should use custom retry config', async () => {
      const retryConfig = {
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
        retryableStatuses: [500, 502, 503],
      };

      const managerWithRetry = new WebhookManagerImpl(mockHttpClient, retryConfig);

      const webhook = await managerWithRetry.register({
        name: 'Retry Webhook',
        url: 'https://example.com/webhook',
        events: ['task.created'],
      });

      mockHttpClient.setResponse('https://example.com/webhook', {
        statusCode: 503,
        body: 'Service Unavailable',
        headers: {},
      });

      const event: WebhookEvent = {
        eventId: 'evt_123',
        eventType: 'task.created',
        payload: { taskId: 'task_123' },
        timestamp: new Date(),
      };

      const result = await managerWithRetry.deliver(webhook.webhookId, event);

      expect(result.success).toBe(false);
      const delivery = await managerWithRetry.getDelivery(result.deliveryId);
      expect(delivery?.status).toBe('retrying');
      expect(delivery?.nextRetryAt).toBeInstanceOf(Date);
    });
  });
});

describe('WebhookManus', () => {
  test('should export WebhookManus class', async () => {
    const { WebhookManus } = await import('../src/core/webhooks');
    expect(WebhookManus).toBeDefined();
  });
});

describe('Type Exports', () => {
  test('should export all types', () => {
    const webhook: Webhook = {} as Webhook;
    const delivery: WebhookDelivery = {} as WebhookDelivery;
    const event: WebhookEvent = {} as WebhookEvent;
    const signature: WebhookSignature = {} as WebhookSignature;
    const batchDelivery: WebhookBatchDelivery = {} as WebhookBatchDelivery;
    const statistics: WebhookStatistics = {} as WebhookStatistics;
    const retryConfig: RetryConfig = {} as RetryConfig;

    expect(webhook).toBeDefined();
    expect(delivery).toBeDefined();
    expect(event).toBeDefined();
    expect(signature).toBeDefined();
    expect(batchDelivery).toBeDefined();
    expect(statistics).toBeDefined();
    expect(retryConfig).toBeDefined();
  });
});

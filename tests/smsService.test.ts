/**
 * SMS Service Tests
 */

import { SMSServiceImpl } from '../src/core/smsService/smsService';
import { SMSManus } from '../src/core/smsService';
import {
  SMSProvider,
  SMSType,
  SMSDeliveryStatus,
  QueuePriority,
  SendSMSOptions,
  PhoneNumber,
} from '../src/core/smsService/types';

describe('SMSServiceImpl', () => {
  let service: SMSServiceImpl;

  beforeEach(() => {
    service = new SMSServiceImpl();
  });

  afterEach(() => {
    service.stopQueueProcessing();
  });

  describe('Basic SMS Sending', () => {
    test('should send SMS with minimal options', async () => {
      const message = await service.send({
        to: [{ number: '+15551234567' }],
        body: 'Test SMS message',
      });

      expect(message.messageId).toBeDefined();
      expect(message.messageId.startsWith('sms_')).toBe(true);
      expect(message.to[0].number).toBe('+15551234567');
      expect(message.body).toBe('Test SMS message');
      expect(message.status).toBe('sent');
      expect(message.type).toBe('transactional');
      expect(message.provider).toBe('twilio');
      expect(message.direction).toBe('outbound');
    });

    test('should send SMS with all options', async () => {
      const options: SendSMSOptions = {
        from: { number: '+15559876543', countryCode: '1' },
        to: [{ number: '+15551234567' }],
        body: 'Full featured SMS message',
        type: 'promotional',
        provider: 'vonage',
        priority: 'high',
        metadata: { campaignId: 'campaign123' },
      };

      const message = await service.send(options);

      expect(message.from.number).toBe('+15559876543');
      expect(message.to[0].number).toBe('+15551234567');
      expect(message.body).toBe('Full featured SMS message');
      expect(message.type).toBe('promotional');
      expect(message.provider).toBe('vonage');
      expect(message.priority).toBe('high');
      expect(message.metadata?.campaignId).toBe('campaign123');
    });

    test('should generate unique message IDs', async () => {
      const message1 = await service.send({
        to: [{ number: '+15551234567' }],
        body: 'Message 1',
      });

      const message2 = await service.send({
        to: [{ number: '+15557654321' }],
        body: 'Message 2',
      });

      expect(message1.messageId).not.toBe(message2.messageId);
    });

    test('should set correct timestamps', async () => {
      const message = await service.send({
        to: [{ number: '+15551234567' }],
        body: 'Test message',
      });

      expect(message.createdAt).toBeInstanceOf(Date);
      expect(message.sentAt).toBeInstanceOf(Date);
      expect(message.updatedAt).toBeInstanceOf(Date);
    });

    test('should calculate message segments', async () => {
      const shortMessage = await service.send({
        to: [{ number: '+15551234567' }],
        body: 'Short message',
      });

      expect(shortMessage.segments).toBe(1);

      const longMessage = await service.send({
        to: [{ number: '+15551234567' }],
        body: 'A'.repeat(200),
      });

      expect(longMessage.segments).toBeGreaterThan(1);
    });
  });

  describe('Batch SMS Sending', () => {
    test('should send batch SMS messages', async () => {
      const options: SendSMSOptions[] = [
        {
          to: [{ number: '+15551234567' }],
          body: 'Batch message 1',
        },
        {
          to: [{ number: '+15557654321' }],
          body: 'Batch message 2',
        },
        {
          to: [{ number: '+15559012345' }],
          body: 'Batch message 3',
        },
      ];

      const results = await service.sendBatch(options);

      expect(results).toHaveLength(3);
      expect(results[0].to[0].number).toBe('+15551234567');
      expect(results[1].to[0].number).toBe('+15557654321');
      expect(results[2].to[0].number).toBe('+15559012345');
    });
  });

  describe('Send To Number', () => {
    test('should send SMS using sendToNumber', async () => {
      const from: PhoneNumber = { number: '+15559876543' };
      const to: PhoneNumber = { number: '+15551234567' };

      const message = await service.sendToNumber(from, to, 'Direct message', 'transactional');

      expect(message.from.number).toBe('+15559876543');
      expect(message.to[0].number).toBe('+15551234567');
      expect(message.body).toBe('Direct message');
      expect(message.type).toBe('transactional');
    });
  });

  describe('SMS Templates', () => {
    test('should create template', async () => {
      const template = await service.createTemplate({
        name: 'Welcome Template',
        type: 'transactional',
        body: 'Hello {{name}}, welcome to {{company}}!',
        variables: ['name', 'company'],
      });

      expect(template.templateId).toBeDefined();
      expect(template.templateId.startsWith('smstmpl_')).toBe(true);
      expect(template.name).toBe('Welcome Template');
      expect(template.variables).toContain('name');
      expect(template.variables).toContain('company');
    });

    test('should get template by ID', async () => {
      const created = await service.createTemplate({
        name: 'Test Template',
        type: 'transactional',
        body: 'Body text',
        variables: [],
      });

      const retrieved = await service.getTemplate(created.templateId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.templateId).toBe(created.templateId);
      expect(retrieved?.name).toBe('Test Template');
    });

    test('should return null for non-existent template', async () => {
      const template = await service.getTemplate('non_existent_id');
      expect(template).toBeNull();
    });

    test('should update template', async () => {
      const template = await service.createTemplate({
        name: 'Original Name',
        type: 'transactional',
        body: 'Original Body',
        variables: [],
      });

      const updated = await service.updateTemplate(template.templateId, {
        name: 'Updated Name',
        body: 'Updated Body',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.body).toBe('Updated Body');
    });

    test('should delete template', async () => {
      const template = await service.createTemplate({
        name: 'To Delete',
        type: 'transactional',
        body: 'Body',
        variables: [],
      });

      await service.deleteTemplate(template.templateId);

      const retrieved = await service.getTemplate(template.templateId);
      expect(retrieved).toBeNull();
    });

    test('should list templates by type', async () => {
      await service.createTemplate({
        name: 'Template 1',
        type: 'transactional',
        body: 'Body',
        variables: [],
      });

      await service.createTemplate({
        name: 'Template 2',
        type: 'promotional',
        body: 'Body',
        variables: [],
      });

      await service.createTemplate({
        name: 'Template 3',
        type: 'transactional',
        body: 'Body',
        variables: [],
      });

      const transactional = await service.listTemplates('transactional');
      const promotional = await service.listTemplates('promotional');
      const all = await service.listTemplates();

      expect(transactional).toHaveLength(2);
      expect(promotional).toHaveLength(1);
      expect(all).toHaveLength(3);
    });
  });

  describe('Template Rendering', () => {
    test('should send SMS with template', async () => {
      const template = await service.createTemplate({
        name: 'Welcome',
        type: 'transactional',
        body: 'Hello {{name}}, your code is {{code}}.',
        variables: ['name', 'code'],
      });

      const message = await service.sendWithTemplate(
        template.templateId,
        [{ number: '+15551234567' }],
        { name: 'John', code: '123456' }
      );

      expect(message.body).toBe('Hello John, your code is 123456.');
    });

    test('should throw error for missing template', async () => {
      await expect(
        service.sendWithTemplate('non_existent', [{ number: '+15551234567' }], {})
      ).rejects.toThrow('Template non_existent not found');
    });

    test('should throw error for missing template variables', async () => {
      const template = await service.createTemplate({
        name: 'Test',
        type: 'transactional',
        body: 'Hello {{name}}, your code is {{code}}.',
        variables: ['name', 'code'],
      });

      await expect(
        service.sendWithTemplate(template.templateId, [{ number: '+15551234567' }], { name: 'John' })
      ).rejects.toThrow('Missing template variables: code');
    });
  });

  describe('Verification SMS', () => {
    test('should send verification code', async () => {
      const phoneNumber: PhoneNumber = { number: '+15551234567' };

      const message = await service.sendVerification(phoneNumber, '123456');

      expect(message.to[0].number).toBe('+15551234567');
      expect(message.body).toContain('123456');
      expect(message.type).toBe('verification');
      expect(message.priority).toBe('high');
    });

    test('should include expiration message in verification', async () => {
      const phoneNumber: PhoneNumber = { number: '+15551234567' };

      const message = await service.sendVerification(phoneNumber, '789012');

      expect(message.body).toContain('verification code');
      expect(message.body).toContain('expire');
    });
  });

  describe('Message Retrieval', () => {
    test('should get message by ID', async () => {
      const sent = await service.send({
        to: [{ number: '+15551234567' }],
        body: 'Test message',
      });

      const retrieved = await service.getMessage(sent.messageId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.messageId).toBe(sent.messageId);
    });

    test('should return null for non-existent message', async () => {
      const message = await service.getMessage('non_existent_id');
      expect(message).toBeNull();
    });

    test('should query messages by status', async () => {
      await service.send({
        to: [{ number: '+15551234567' }],
        body: 'Message 1',
      });

      const failed = await service.send({
        to: [{ number: '+15557654321' }],
        body: 'Message 2',
      });
      await service.cancel(failed.messageId);

      const sentMessages = await service.queryMessages({ status: 'sent' });
      const failedMessages = await service.queryMessages({ status: 'failed', includeFailed: true });

      expect(sentMessages.length).toBeGreaterThan(0);
      expect(failedMessages.some((m) => m.messageId === failed.messageId)).toBe(true);
    });

    test('should query messages by type', async () => {
      await service.send({
        to: [{ number: '+15551234567' }],
        body: 'Transactional message',
        type: 'transactional',
      });

      await service.send({
        to: [{ number: '+15557654321' }],
        body: 'Promotional message',
        type: 'promotional',
      });

      const transactional = await service.queryMessages({ type: 'transactional' });
      const promotional = await service.queryMessages({ type: 'promotional' });

      expect(transactional.every((m) => m.type === 'transactional')).toBe(true);
      expect(promotional.every((m) => m.type === 'promotional')).toBe(true);
    });

    test('should query messages with pagination', async () => {
      for (let i = 0; i < 10; i++) {
        await service.send({
          to: [{ number: `+1555${String(i).padStart(7, '0')}` }],
          body: `Message ${i}`,
        });
      }

      const firstPage = await service.queryMessages({ limit: 3 });
      const secondPage = await service.queryMessages({ limit: 3, offset: 3 });

      expect(firstPage).toHaveLength(3);
      expect(secondPage).toHaveLength(3);
      expect(firstPage[0].messageId).not.toBe(secondPage[0].messageId);
    });
  });

  describe('SMS Stats', () => {
    test('should get SMS stats', async () => {
      await service.send({
        to: [{ number: '+15551234567' }],
        body: 'Test message',
      });

      await service.send({
        to: [{ number: '+15557654321' }],
        body: 'Test message',
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      const stats = await service.getSMSStats();

      expect(stats.totalSent).toBeGreaterThanOrEqual(2);
      expect(stats.totalDelivered).toBeGreaterThanOrEqual(2);
      expect(stats.byType).toBeDefined();
      expect(stats.byProvider).toBeDefined();
    });

    test('should get stats for specific time period', async () => {
      const since = new Date(Date.now() - 60000);

      await service.send({
        to: [{ number: '+15551234567' }],
        body: 'Test message',
      });

      const stats = await service.getSMSStats(since);
      expect(stats.totalSent).toBeGreaterThanOrEqual(1);
    });

    test('should calculate delivery rate', async () => {
      const stats = await service.getSMSStats();
      
      expect(stats.deliveryRate).toBeGreaterThanOrEqual(0);
      expect(stats.failureRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Retry and Cancel', () => {
    test('should retry failed message', async () => {
      const message = await service.send({
        to: [{ number: '+15551234567' }],
        body: 'Test message',
      });

      await service.cancel(message.messageId);
      const cancelled = await service.getMessage(message.messageId);
      expect(cancelled?.status).toBe('failed');

      await service.retry(message.messageId);
      const retried = await service.getMessage(message.messageId);
      expect(retried?.status).toBe('queued');
      expect(retried?.retryCount).toBe(1);
    });

    test('should cancel message', async () => {
      const message = await service.send({
        to: [{ number: '+15551234567' }],
        body: 'Test message',
      });

      await service.cancel(message.messageId);

      const cancelled = await service.getMessage(message.messageId);
      expect(cancelled?.status).toBe('failed');
      expect(cancelled?.failedAt).toBeInstanceOf(Date);
    });

    test('should throw error when retrying non-existent message', async () => {
      await expect(service.retry('non_existent')).rejects.toThrow('Message non_existent not found');
    });

    test('should throw error when retrying after max retries', async () => {
      const message = await service.send({
        to: [{ number: '+15551234567' }],
        body: 'Test message',
      });

      message.retryCount = 3;
      message.maxRetries = 3;
      service['messages'].set(message.messageId, message);

      await expect(service.retry(message.messageId)).rejects.toThrow('has exceeded max retries');
    });
  });

  describe('Delivery Tracking', () => {
    test('should track delivery', async () => {
      const message = await service.send({
        to: [{ number: '+15551234567' }],
        body: 'Test message',
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      const tracking = await service.getDeliveryTracking(message.messageId);

      expect(tracking).not.toBeNull();
      expect(tracking?.trackingId).toBeDefined();
      expect(tracking?.messageId).toBe(message.messageId);
    });

    test('should return null for non-existent tracking', async () => {
      const tracking = await service.getDeliveryTracking('non_existent');
      expect(tracking).toBeNull();
    });

    test('should record delivery status', async () => {
      const message = await service.send({
        to: [{ number: '+15551234567' }],
        body: 'Test message',
      });

      await service.recordDeliveryStatus(message.messageId, 'delivered');

      const updated = await service.getMessage(message.messageId);
      expect(updated?.status).toBe('delivered');
    });

    test('should record failed status with error', async () => {
      const message = await service.send({
        to: [{ number: '+15551234567' }],
        body: 'Test message',
      });

      await service.recordDeliveryStatus(message.messageId, 'failed', '30005', 'Unknown destination');

      const updated = await service.getMessage(message.messageId);
      expect(updated?.status).toBe('failed');
      expect(updated?.errorCode).toBe('30005');
      expect(updated?.errorMessage).toBe('Unknown destination');
    });
  });

  describe('Provider Configuration', () => {
    test('should configure provider', async () => {
      await service.configureProvider({
        provider: 'twilio',
        settings: {
          apiKey: 'test_api_key',
          authToken: 'test_auth_token',
          fromNumber: '+15551234567',
          deliveryReportsEnabled: true,
        },
      });

      const config = service.getProviderConfig('twilio');
      expect(config).not.toBeNull();
      expect(config?.settings.apiKey).toBe('test_api_key');
      expect(config?.settings.deliveryReportsEnabled).toBe(true);
    });

    test('should return null for non-configured provider', async () => {
      const config = service.getProviderConfig('vonage');
      expect(config).toBeNull();
    });

    test('should test connection', async () => {
      const result = await service.testConnection('twilio');
      expect(result).toBe(true);
    });

    test('should return false for non-configured provider connection test', async () => {
      const result = await service.testConnection('vonage');
      expect(result).toBe(false);
    });
  });

  describe('SMS Queue', () => {
    test('should get queue size', async () => {
      const size = await service.getQueueSize();
      expect(size).toBeGreaterThanOrEqual(0);
    });

    test('should get queue size by priority', async () => {
      const normalSize = await service.getQueueSize('normal');
      const highSize = await service.getQueueSize('high');

      expect(typeof normalSize).toBe('number');
      expect(typeof highSize).toBe('number');
    });

    test('should clear queue', async () => {
      await service.clearQueue();
      const size = await service.getQueueSize();
      expect(size).toBe(0);
    });

    test('should schedule message for later', async () => {
      const futureDate = new Date(Date.now() + 60000);

      const message = await service.send({
        to: [{ number: '+15551234567' }],
        body: 'Scheduled message',
        scheduledFor: futureDate,
      });

      expect(message.status).toBe('queued');
      expect(message.scheduledFor).toEqual(futureDate);
    });
  });

  describe('Incoming SMS', () => {
    test('should handle incoming SMS', async () => {
      const incoming: import('../src/core/smsService/types').SMSIncoming = {
        incomingId: 'inc_123',
        from: { number: '+15551234567' },
        to: { number: '+15559876543' },
        body: 'Hello',
        provider: 'twilio',
        receivedAt: new Date(),
        keywords: [],
      };

      await service.handleIncomingSMS(incoming);

      const messages = await service.getIncomingMessages();
      expect(messages.some((m) => m.incomingId === 'inc_123')).toBe(true);
    });

    test('should extract keywords from incoming SMS', async () => {
      const incoming: import('../src/core/smsService/types').SMSIncoming = {
        incomingId: 'inc_456',
        from: { number: '+15551234567' },
        to: { number: '+15559876543' },
        body: 'STOP',
        provider: 'twilio',
        receivedAt: new Date(),
        keywords: ['stop'],
      };

      await service.handleIncomingSMS(incoming);

      const messages = await service.getIncomingMessages();
      const received = messages.find((m) => m.incomingId === 'inc_456');
      expect(received?.keywords).toContain('stop');
    });

    test('should get incoming messages with limit', async () => {
      for (let i = 0; i < 5; i++) {
        await service.handleIncomingSMS({
          incomingId: `inc_${i}`,
          from: { number: `+1555${String(i).padStart(7, '0')}` },
          to: { number: '+15559876543' },
          body: `Message ${i}`,
          provider: 'twilio',
          receivedAt: new Date(),
          keywords: [],
        });
      }

      const messages = await service.getIncomingMessages({ limit: 3 });
      expect(messages).toHaveLength(3);
    });
  });

  describe('SMS Preferences', () => {
    test('should update preferences', async () => {
      const preferences = await service.updatePreferences('user123', '+15551234567', {
        marketingEnabled: true,
        transactionalEnabled: true,
      });

      expect(preferences.userId).toBe('user123');
      expect(preferences.phoneNumber).toBe('+15551234567');
      expect(preferences.marketingEnabled).toBe(true);
      expect(preferences.transactionalEnabled).toBe(true);
    });

    test('should get preferences', async () => {
      await service.updatePreferences('user123', '+15551234567', {
        marketingEnabled: false,
      });

      const preferences = await service.getPreferences('user123');
      expect(preferences).not.toBeNull();
      expect(preferences?.marketingEnabled).toBe(false);
    });

    test('should return null for non-existent preferences', async () => {
      const preferences = await service.getPreferences('non_existent');
      expect(preferences).toBeNull();
    });

    test('should opt out phone number', async () => {
      await service.updatePreferences('user123', '+15551234567', {
        marketingEnabled: true,
        transactionalEnabled: true,
      });

      await service.optOut('+15551234567');

      const preferences = await service.getPreferences('user123');
      expect(preferences?.optedOutAt).toBeInstanceOf(Date);
      expect(preferences?.marketingEnabled).toBe(false);
    });

    test('should check if phone number is opted out', async () => {
      await service.updatePreferences('user123', '+15551234567', {
        marketingEnabled: true,
      });

      await service.optOut('+15551234567');

      const isOptedOut = await service.isOptedOut('+15551234567');
      expect(isOptedOut).toBe(true);
    });

    test('should return false for non-opted out number', async () => {
      const isOptedOut = await service.isOptedOut('+15551234567');
      expect(isOptedOut).toBe(false);
    });
  });

  describe('SMSManus Helper Class', () => {
    let smsManus: SMSManus;

    beforeEach(() => {
      smsManus = new SMSManus();
    });

    test('should send SMS using helper', async () => {
      const message = await smsManus.sendSMS('+15551234567', 'Test SMS');

      expect(message.messageId).toBeDefined();
      expect(message.to[0].number).toBe('+15551234567');
      expect(message.body).toBe('Test SMS');
    });

    test('should send bulk SMS', async () => {
      const recipients = [
        { number: '+15551234567' },
        { number: '+15557654321' },
      ];

      const messages = await smsManus.sendBulk(recipients, 'Bulk SMS');

      expect(messages).toHaveLength(2);
    });

    test('should send verification using helper', async () => {
      const message = await smsManus.sendVerification('+15551234567', '123456');

      expect(message.body).toContain('123456');
      expect(message.type).toBe('verification');
    });

    test('should schedule SMS using helper', async () => {
      const futureDate = new Date(Date.now() + 60000);

      const message = await smsManus.scheduleSMS('+15551234567', 'Scheduled', futureDate);

      expect(message.scheduledFor).toEqual(futureDate);
    });

    test('should get stats using helper', async () => {
      await smsManus.sendSMS('+15551234567', 'Test');

      const stats = await smsManus.getStats();

      expect(stats.totalSent).toBeGreaterThan(0);
    });

    test('should create and use template', async () => {
      const template = await smsManus.createTemplate(
        'Welcome',
        'transactional',
        'Hello {{name}}, your code is {{code}}.'
      );

      expect(template.templateId).toBeDefined();

      const message = await smsManus.sendTemplate(
        template.templateId,
        [{ number: '+15551234567' }],
        { name: 'John', code: '999' }
      );

      expect(message.body).toBe('Hello John, your code is 999.');
    });

    test('should update preferences using helper', async () => {
      const preferences = await smsManus.updatePreferences('user123', '+15551234567', {
        marketingEnabled: true,
      });

      expect(preferences.userId).toBe('user123');
      expect(preferences.marketingEnabled).toBe(true);
    });

    test('should get delivery tracking using helper', async () => {
      const sent = await smsManus.sendSMS('+15551234567', 'Test');

      await new Promise((resolve) => setTimeout(resolve, 200));

      const tracking = await smsManus.getDeliveryTracking(sent.messageId);
      expect(tracking).not.toBeNull();
    });

    test('should test connection using helper', async () => {
      const result = await smsManus.testConnection('twilio');
      expect(result).toBe(true);
    });

    test('should get queue size using helper', async () => {
      const size = await smsManus.getQueueSize();
      expect(typeof size).toBe('number');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty to array in query', async () => {
      const messages = await service.queryMessages({ to: '' });
      expect(Array.isArray(messages)).toBe(true);
    });

    test('should handle message with no metadata', async () => {
      const message = await service.send({
        to: [{ number: '+15551234567' }],
        body: 'Test message',
      });

      expect(message.metadata).toBeUndefined();
    });

    test('should handle update template with new variables', async () => {
      const template = await service.createTemplate({
        name: 'Test',
        type: 'transactional',
        body: 'Body',
        variables: [],
      });

      const updated = await service.updateTemplate(template.templateId, {
        variables: ['new', 'variables'],
      });

      expect(updated.variables).toEqual(['new', 'variables']);
    });

    test('should handle incoming messages sorted by date', async () => {
      const now = new Date();
      
      await service.handleIncomingSMS({
        incomingId: 'old',
        from: { number: '+15551111111' },
        to: { number: '+15559876543' },
        body: 'Old message',
        provider: 'twilio',
        receivedAt: new Date(now.getTime() - 1000),
        keywords: [],
      });

      await service.handleIncomingSMS({
        incomingId: 'new',
        from: { number: '+15552222222' },
        to: { number: '+15559876543' },
        body: 'New message',
        provider: 'twilio',
        receivedAt: new Date(now.getTime() + 1000),
        keywords: [],
      });

      const messages = await service.getIncomingMessages();
      expect(messages[0].incomingId).toBe('new');
    });

    test('should handle undelivered status', async () => {
      const message = await service.send({
        to: [{ number: '+15551234567' }],
        body: 'Test message',
      });

      await service.recordDeliveryStatus(message.messageId, 'undelivered', '30005', 'Unknown destination');

      const updated = await service.getMessage(message.messageId);
      expect(updated?.status).toBe('undelivered');
      expect(updated?.undeliveredAt).toBeInstanceOf(Date);
    });

    test('should handle message direction', async () => {
      const message = await service.send({
        to: [{ number: '+15551234567' }],
        body: 'Outbound message',
      });

      expect(message.direction).toBe('outbound');
    });
  });
});

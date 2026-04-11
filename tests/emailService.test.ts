/**
 * Email Service Tests
 */

import { EmailServiceImpl } from '../src/core/emailService/emailService';
import { EmailManus } from '../src/core/emailService';
import {
  EmailProvider,
  EmailType,
  DeliveryStatus,
  QueuePriority,
  BounceType,
  BounceCategory,
  SendEmailOptions,
} from '../src/core/emailService/types';

describe('EmailServiceImpl', () => {
  let service: EmailServiceImpl;

  beforeEach(() => {
    service = new EmailServiceImpl();
  });

  afterEach(() => {
    service.stopQueueProcessing();
  });

  describe('Basic Email Sending', () => {
    test('should send email with minimal options', async () => {
      const email = await service.send({
        to: [{ email: 'test@example.com' }],
        subject: 'Test Email',
        body: 'This is a test email body',
      });

      expect(email.emailId).toBeDefined();
      expect(email.emailId.startsWith('email_')).toBe(true);
      expect(email.to[0].email).toBe('test@example.com');
      expect(email.subject).toBe('Test Email');
      expect(email.body).toBe('This is a test email body');
      expect(email.status).toBe('sent');
      expect(email.type).toBe('transactional');
      expect(email.provider).toBe('smtp');
    });

    test('should send email with all options', async () => {
      const options: SendEmailOptions = {
        from: { email: 'sender@manus.ai', name: 'Manus Sender' },
        to: [{ email: 'recipient@example.com', name: 'John Doe' }],
        cc: [{ email: 'cc@example.com' }],
        bcc: [{ email: 'bcc@example.com' }],
        subject: 'Full Featured Email',
        body: 'Email body content',
        bodyHtml: '<p>Email body content</p>',
        attachments: [
          { filename: 'test.txt', content: Buffer.from('test'), contentType: 'text/plain' },
        ],
        inlineImages: [
          { contentId: 'img1', content: Buffer.from('image'), contentType: 'image/png' },
        ],
        headers: [{ key: 'X-Custom-Header', value: 'custom-value' }],
        type: 'marketing',
        provider: 'sendgrid',
        priority: 'high',
        metadata: { userId: 'user123' },
      };

      const email = await service.send(options);

      expect(email.from.email).toBe('sender@manus.ai');
      expect(email.from.name).toBe('Manus Sender');
      expect(email.to[0].name).toBe('John Doe');
      expect(email.cc).toHaveLength(1);
      expect(email.bcc).toHaveLength(1);
      expect(email.attachments).toHaveLength(1);
      expect(email.inlineImages).toHaveLength(1);
      expect(email.headers).toHaveLength(1);
      expect(email.type).toBe('marketing');
      expect(email.provider).toBe('sendgrid');
      expect(email.priority).toBe('high');
      expect(email.metadata?.userId).toBe('user123');
    });

    test('should generate unique email IDs', async () => {
      const email1 = await service.send({
        to: [{ email: 'test1@example.com' }],
        subject: 'Test 1',
        body: 'Body 1',
      });

      const email2 = await service.send({
        to: [{ email: 'test2@example.com' }],
        subject: 'Test 2',
        body: 'Body 2',
      });

      expect(email1.emailId).not.toBe(email2.emailId);
    });

    test('should set correct timestamps', async () => {
      const email = await service.send({
        to: [{ email: 'test@example.com' }],
        subject: 'Test',
        body: 'Body',
      });

      expect(email.createdAt).toBeInstanceOf(Date);
      expect(email.sentAt).toBeInstanceOf(Date);
      expect(email.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Batch Email Sending', () => {
    test('should send batch emails', async () => {
      const options: SendEmailOptions[] = [
        {
          to: [{ email: 'user1@example.com' }],
          subject: 'Batch Email 1',
          body: 'Body 1',
        },
        {
          to: [{ email: 'user2@example.com' }],
          subject: 'Batch Email 2',
          body: 'Body 2',
        },
        {
          to: [{ email: 'user3@example.com' }],
          subject: 'Batch Email 3',
          body: 'Body 3',
        },
      ];

      const results = await service.sendBatch(options);

      expect(results).toHaveLength(3);
      expect(results[0].to[0].email).toBe('user1@example.com');
      expect(results[1].to[0].email).toBe('user2@example.com');
      expect(results[2].to[0].email).toBe('user3@example.com');
    });
  });

  describe('Send To Address', () => {
    test('should send email using sendToAddress', async () => {
      const from = { email: 'from@example.com', name: 'From User' };
      const to = { email: 'to@example.com', name: 'To User' };

      const email = await service.sendToAddress(from, to, 'Subject', 'Body', '<p>Body</p>');

      expect(email.from.email).toBe('from@example.com');
      expect(email.from.name).toBe('From User');
      expect(email.to[0].email).toBe('to@example.com');
      expect(email.to[0].name).toBe('To User');
      expect(email.bodyHtml).toBe('<p>Body</p>');
    });
  });

  describe('Email Templates', () => {
    test('should create template', async () => {
      const template = await service.createTemplate({
        name: 'Welcome Template',
        type: 'transactional',
        subject: 'Welcome {{name}}!',
        body: 'Hello {{name}}, welcome to {{company}}!',
        bodyHtml: '<h1>Hello {{name}}</h1><p>Welcome to {{company}}!</p>',
        variables: ['name', 'company'],
      });

      expect(template.templateId).toBeDefined();
      expect(template.templateId.startsWith('tmpl_')).toBe(true);
      expect(template.name).toBe('Welcome Template');
      expect(template.variables).toContain('name');
      expect(template.variables).toContain('company');
    });

    test('should get template by ID', async () => {
      const created = await service.createTemplate({
        name: 'Test Template',
        type: 'transactional',
        subject: 'Subject',
        body: 'Body',
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
        subject: 'Original Subject',
        body: 'Original Body',
        variables: [],
      });

      const updated = await service.updateTemplate(template.templateId, {
        name: 'Updated Name',
        subject: 'Updated Subject',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.subject).toBe('Updated Subject');
      expect(updated.body).toBe('Original Body');
    });

    test('should delete template', async () => {
      const template = await service.createTemplate({
        name: 'To Delete',
        type: 'transactional',
        subject: 'Subject',
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
        subject: 'Subject',
        body: 'Body',
        variables: [],
      });

      await service.createTemplate({
        name: 'Template 2',
        type: 'marketing',
        subject: 'Subject',
        body: 'Body',
        variables: [],
      });

      await service.createTemplate({
        name: 'Template 3',
        type: 'transactional',
        subject: 'Subject',
        body: 'Body',
        variables: [],
      });

      const transactional = await service.listTemplates('transactional');
      const marketing = await service.listTemplates('marketing');
      const all = await service.listTemplates();

      expect(transactional).toHaveLength(2);
      expect(marketing).toHaveLength(1);
      expect(all).toHaveLength(3);
    });
  });

  describe('Template Rendering', () => {
    test('should send email with template', async () => {
      const template = await service.createTemplate({
        name: 'Welcome',
        type: 'transactional',
        subject: 'Welcome {{name}}!',
        body: 'Hello {{name}}, your email is {{email}}.',
        variables: ['name', 'email'],
      });

      const email = await service.sendWithTemplate(
        template.templateId,
        [{ email: 'user@example.com' }],
        { name: 'John', email: 'user@example.com' }
      );

      expect(email.subject).toBe('Welcome John!');
      expect(email.body).toBe('Hello John, your email is user@example.com.');
    });

    test('should throw error for missing template', async () => {
      await expect(
        service.sendWithTemplate('non_existent', [{ email: 'test@example.com' }], {})
      ).rejects.toThrow('Template non_existent not found');
    });

    test('should throw error for missing template variables', async () => {
      const template = await service.createTemplate({
        name: 'Test',
        type: 'transactional',
        subject: 'Subject',
        body: 'Hello {{name}}, you are {{age}} years old.',
        variables: ['name', 'age'],
      });

      await expect(
        service.sendWithTemplate(template.templateId, [{ email: 'test@example.com' }], { name: 'John' })
      ).rejects.toThrow('Missing template variables: age');
    });
  });

  describe('Email Retrieval', () => {
    test('should get email by ID', async () => {
      const sent = await service.send({
        to: [{ email: 'test@example.com' }],
        subject: 'Test',
        body: 'Body',
      });

      const retrieved = await service.getEmail(sent.emailId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.emailId).toBe(sent.emailId);
    });

    test('should return null for non-existent email', async () => {
      const email = await service.getEmail('non_existent_id');
      expect(email).toBeNull();
    });

    test('should query emails by status', async () => {
      await service.send({
        to: [{ email: 'test1@example.com' }],
        subject: 'Test 1',
        body: 'Body 1',
      });

      const failed = await service.send({
        to: [{ email: 'test2@example.com' }],
        subject: 'Test 2',
        body: 'Body 2',
      });
      await service.cancel(failed.emailId);

      const sentEmails = await service.queryEmails({ status: 'sent' });
      const failedEmails = await service.queryEmails({ status: 'failed' });

      expect(sentEmails.length).toBeGreaterThan(0);
      expect(failedEmails).toHaveLength(1);
    });

    test('should query emails by type', async () => {
      await service.send({
        to: [{ email: 'test@example.com' }],
        subject: 'Test',
        body: 'Body',
        type: 'transactional',
      });

      await service.send({
        to: [{ email: 'test@example.com' }],
        subject: 'Test',
        body: 'Body',
        type: 'marketing',
      });

      const transactional = await service.queryEmails({ type: 'transactional' });
      const marketing = await service.queryEmails({ type: 'marketing' });

      expect(transactional.every((e) => e.type === 'transactional')).toBe(true);
      expect(marketing.every((e) => e.type === 'marketing')).toBe(true);
    });

    test('should query emails with pagination', async () => {
      for (let i = 0; i < 10; i++) {
        await service.send({
          to: [{ email: `test${i}@example.com` }],
          subject: `Test ${i}`,
          body: `Body ${i}`,
        });
      }

      const firstPage = await service.queryEmails({ limit: 3 });
      const secondPage = await service.queryEmails({ limit: 3, offset: 3 });

      expect(firstPage).toHaveLength(3);
      expect(secondPage).toHaveLength(3);
      expect(firstPage[0].emailId).not.toBe(secondPage[0].emailId);
    });
  });

  describe('Email Stats', () => {
    test('should get email stats', async () => {
      await service.send({
        to: [{ email: 'test@example.com' }],
        subject: 'Test',
        body: 'Body',
      });

      await service.send({
        to: [{ email: 'test@example.com' }],
        subject: 'Test',
        body: 'Body',
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      const stats = await service.getEmailStats();

      expect(stats.totalSent).toBeGreaterThanOrEqual(2);
      expect(stats.totalDelivered).toBeGreaterThanOrEqual(2);
      expect(stats.byType).toBeDefined();
      expect(stats.byProvider).toBeDefined();
      expect(stats.deliveryRate).toBeGreaterThan(0);
    });

    test('should get stats for specific time period', async () => {
      const since = new Date(Date.now() - 60000);

      await service.send({
        to: [{ email: 'test@example.com' }],
        subject: 'Test',
        body: 'Body',
      });

      const stats = await service.getEmailStats(since);
      expect(stats.totalSent).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Retry and Cancel', () => {
    test('should retry failed email', async () => {
      const email = await service.send({
        to: [{ email: 'test@example.com' }],
        subject: 'Test',
        body: 'Body',
      });

      await service.cancel(email.emailId);
      const cancelled = await service.getEmail(email.emailId);
      expect(cancelled?.status).toBe('failed');

      await service.retry(email.emailId);
      const retried = await service.getEmail(email.emailId);
      expect(retried?.status).toBe('pending');
      expect(retried?.retryCount).toBe(1);
    });

    test('should cancel email', async () => {
      const email = await service.send({
        to: [{ email: 'test@example.com' }],
        subject: 'Test',
        body: 'Body',
      });

      await service.cancel(email.emailId);

      const cancelled = await service.getEmail(email.emailId);
      expect(cancelled?.status).toBe('failed');
      expect(cancelled?.failedAt).toBeInstanceOf(Date);
    });

    test('should throw error when retrying non-existent email', async () => {
      await expect(service.retry('non_existent')).rejects.toThrow('Email non_existent not found');
    });

    test('should throw error when retrying after max retries', async () => {
      const email = await service.send({
        to: [{ email: 'test@example.com' }],
        subject: 'Test',
        body: 'Body',
      });

      email.retryCount = 3;
      email.maxRetries = 3;
      service['emails'].set(email.emailId, email);

      await expect(service.retry(email.emailId)).rejects.toThrow('has exceeded max retries');
    });
  });

  describe('Bounce Handling', () => {
    test('should record bounce', async () => {
      const email = await service.send({
        to: [{ email: 'test@example.com' }],
        subject: 'Test',
        body: 'Body',
      });

      const bounce = await service.recordBounce(email.emailId, 'hard', 'invalid', 'Bad address');

      expect(bounce.bounceId).toBeDefined();
      expect(bounce.bounceId.startsWith('bounce_')).toBe(true);
      expect(bounce.emailId).toBe(email.emailId);
      expect(bounce.bounceType).toBe('hard');
      expect(bounce.category).toBe('invalid');

      const updated = await service.getEmail(email.emailId);
      expect(updated?.status).toBe('bounced');
    });

    test('should get bounces for email', async () => {
      const email = await service.send({
        to: [{ email: 'test@example.com' }],
        subject: 'Test',
        body: 'Body',
      });

      await service.recordBounce(email.emailId, 'soft', 'full', 'Mailbox full');
      await service.recordBounce(email.emailId, 'hard', 'invalid', 'Invalid address');

      const bounces = await service.getBounces(email.emailId);
      expect(bounces).toHaveLength(2);
    });

    test('should handle bounce data', async () => {
      const email = await service.send({
        to: [{ email: 'test@example.com' }],
        subject: 'Test',
        body: 'Body',
      });

      const bounceData = {
        emailId: email.emailId,
        email: 'bounce@example.com',
        bounceType: 'soft',
        reason: 'Mailbox full',
        provider: 'sendgrid',
      };

      await service.handleBounce(bounceData);

      const bounces = await service.getBounces(email.emailId);
      expect(bounces).toHaveLength(1);
    });
  });

  describe('Unsubscribe Management', () => {
    test('should unsubscribe email', async () => {
      const record = await service.unsubscribe('user@example.com', 'marketing_list', 'No longer interested');

      expect(record.unsubscribeId).toBeDefined();
      expect(record.unsubscribeId.startsWith('unsub_')).toBe(true);
      expect(record.email).toBe('user@example.com');
      expect(record.listId).toBe('marketing_list');
      expect(record.reason).toBe('No longer interested');
    });

    test('should check if email is unsubscribed', async () => {
      await service.unsubscribe('user@example.com', 'marketing_list');

      const isUnsubscribed = await service.isUnsubscribed('user@example.com', 'marketing_list');
      const isNotUnsubscribed = await service.isUnsubscribed('other@example.com', 'marketing_list');

      expect(isUnsubscribed).toBe(true);
      expect(isNotUnsubscribed).toBe(false);
    });

    test('should check unsubscribed without listId', async () => {
      await service.unsubscribe('user@example.com');

      const isUnsubscribed = await service.isUnsubscribed('user@example.com');
      expect(isUnsubscribed).toBe(true);
    });

    test('should handle unsubscribe data', async () => {
      const unsubscribeData: Record<string, unknown> = {
        email: 'user@example.com',
        'List-ID': 'test_list',
        reason: 'User requested',
      };

      await service.handleUnsubscribe(unsubscribeData);
      const isUnsubscribed = await service.isUnsubscribed('user@example.com', 'test_list');
      expect(isUnsubscribed).toBe(true);
    });
  });

  describe('Delivery Tracking', () => {
    test('should track delivery', async () => {
      const email = await service.send({
        to: [{ email: 'test@example.com' }],
        subject: 'Test',
        body: 'Body',
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      const tracking = await service.getDeliveryTracking(email.emailId);

      expect(tracking).not.toBeNull();
      expect(tracking?.trackingId).toBeDefined();
      expect(tracking?.emailId).toBe(email.emailId);
      expect(tracking?.status).toBe('delivered');
      expect(tracking?.deliveredAt).toBeInstanceOf(Date);
      expect(tracking?.deliveryTimeMs).toBeDefined();
    });

    test('should return null for non-existent tracking', async () => {
      const tracking = await service.getDeliveryTracking('non_existent');
      expect(tracking).toBeNull();
    });
  });

  describe('Provider Configuration', () => {
    test('should configure provider', async () => {
      await service.configureProvider({
        provider: 'sendgrid',
        settings: {
          apiKey: 'test_api_key',
          fromEmail: 'sender@example.com',
          trackingEnabled: true,
        },
      });

      const config = service.getProviderConfig('sendgrid');
      expect(config).not.toBeNull();
      expect(config?.settings.apiKey).toBe('test_api_key');
      expect(config?.settings.trackingEnabled).toBe(true);
    });

    test('should return null for non-configured provider', async () => {
      const config = service.getProviderConfig('mailgun');
      expect(config).toBeNull();
    });

    test('should test connection', async () => {
      const result = await service.testConnection('smtp');
      expect(result).toBe(true);
    });

    test('should return false for non-configured provider connection test', async () => {
      const result = await service.testConnection('mailgun');
      expect(result).toBe(false);
    });
  });

  describe('Email Queue', () => {
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

    test('should schedule email for later', async () => {
      const futureDate = new Date(Date.now() + 60000);

      const email = await service.send({
        to: [{ email: 'test@example.com' }],
        subject: 'Scheduled Email',
        body: 'Body',
        scheduledFor: futureDate,
      });

      expect(email.status).toBe('pending');
      expect(email.scheduledFor).toEqual(futureDate);
    });
  });

  describe('EmailManus Helper Class', () => {
    let emailManus: EmailManus;

    beforeEach(() => {
      emailManus = new EmailManus();
    });

    test('should send email using helper', async () => {
      const email = await emailManus.sendEmail('test@example.com', 'Test Subject', 'Test Body');

      expect(email.emailId).toBeDefined();
      expect(email.to[0].email).toBe('test@example.com');
      expect(email.subject).toBe('Test Subject');
    });

    test('should send bulk emails', async () => {
      const recipients = [
        { email: 'user1@example.com', name: 'User 1' },
        { email: 'user2@example.com', name: 'User 2' },
      ];

      const emails = await emailManus.sendBulk(recipients, 'Bulk Subject', 'Bulk Body');

      expect(emails).toHaveLength(2);
    });

    test('should send HTML email', async () => {
      const email = await emailManus.sendEmail('test@example.com', 'HTML Subject', 'Body', {
        bodyHtml: '<p>HTML Body</p>',
      });

      expect(email.bodyHtml).toBe('<p>HTML Body</p>');
    });

    test('should schedule email', async () => {
      const futureDate = new Date(Date.now() + 60000);

      const email = await emailManus.scheduleEmail(
        'test@example.com',
        'Scheduled',
        'Body',
        futureDate
      );

      expect(email.scheduledFor).toEqual(futureDate);
    });

    test('should get stats using helper', async () => {
      await emailManus.sendEmail('test@example.com', 'Test', 'Body');

      const stats = await emailManus.getStats();

      expect(stats.totalSent).toBeGreaterThan(0);
    });

    test('should retry email using helper', async () => {
      const email = await emailManus.sendEmail('test@example.com', 'Test', 'Body');
      await emailManus.cancelEmail(email.emailId);

      await emailManus.retryEmail(email.emailId);

      const updated = await emailManus.getEmail(email.emailId);
      expect(updated?.status).toBe('pending');
    });

    test('should create and use template', async () => {
      const template = await emailManus.createTemplate(
        'Welcome',
        'transactional',
        'Welcome {{name}}!',
        'Hello {{name}}, welcome aboard!',
        '<h1>Welcome {{name}}</h1>'
      );

      expect(template.templateId).toBeDefined();

      const email = await emailManus.sendTemplate(
        template.templateId,
        [{ email: 'user@example.com' }],
        { name: 'John' }
      );

      expect(email.body).toBe('Hello John, welcome aboard!');
    });

    test('should handle unsubscribe', async () => {
      await emailManus.unsubscribe('user@example.com', 'marketing', 'Too many emails');

      const isUnsubscribed = await emailManus.isUnsubscribed('user@example.com', 'marketing');
      expect(isUnsubscribed).toBe(true);
    });

    test('should get delivery tracking', async () => {
      const email = await emailManus.sendEmail('test@example.com', 'Test', 'Body');

      const tracking = await emailManus.getDeliveryTracking(email.emailId);
      expect(tracking).not.toBeNull();
    });

    test('should test connection', async () => {
      const result = await emailManus.testConnection('smtp');
      expect(result).toBe(true);
    });

    test('should get queue size', async () => {
      const size = await emailManus.getQueueSize();
      expect(typeof size).toBe('number');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty to array in query', async () => {
      const emails = await service.queryEmails({ to: '' });
      expect(Array.isArray(emails)).toBe(true);
    });

    test('should handle email with no attachments', async () => {
      const email = await service.send({
        to: [{ email: 'test@example.com' }],
        subject: 'Test',
        body: 'Body',
      });

      expect(email.attachments).toHaveLength(0);
      expect(email.inlineImages).toHaveLength(0);
    });

    test('should update template with new variables', async () => {
      const template = await service.createTemplate({
        name: 'Test',
        type: 'transactional',
        subject: 'Subject',
        body: 'Body',
        variables: [],
      });

      const updated = await service.updateTemplate(template.templateId, {
        variables: ['new', 'variables'],
      });

      expect(updated.variables).toEqual(['new', 'variables']);
    });

    test('should handle multiple bounces', async () => {
      const email = await service.send({
        to: [{ email: 'test@example.com' }],
        subject: 'Test',
        body: 'Body',
      });

      await service.recordBounce(email.emailId, 'hard', 'invalid');
      await service.recordBounce(email.emailId, 'soft', 'full');

      const bounces = await service.getBounces(email.emailId);
      expect(bounces).toHaveLength(2);
    });
  });
});

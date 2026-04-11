/**
 * Email Service Implementation
 * SMTP and API provider support with templates, queueing, and tracking
 */

import crypto from 'crypto';
import {
  Email,
  EmailTemplate,
  EmailQueueItem,
  EmailDeliveryTracking,
  BounceRecord,
  UnsubscribeRecord,
  EmailPreferences,
  ProviderConfig,
  SendEmailOptions,
  EmailQueryOptions,
  EmailStats,
  EmailAddress,
  EmailProvider,
  EmailType,
  QueuePriority,
  BounceType,
  BounceCategory,
  EmailService,
  TemplateRenderer,
  QueueManager,
  BounceHandler,
  UnsubscribeHandler,
} from './types';

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

class TemplateRendererImpl implements TemplateRenderer {
  render(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, value);
    }
    return result;
  }

  validateTemplate(template: string, variables: string[]): { valid: boolean; missingVariables: string[] } {
    const extracted = this.extractVariables(template);
    const missing = extracted.filter((v) => !variables.includes(v));
    return {
      valid: missing.length === 0,
      missingVariables: missing,
    };
  }

  extractVariables(template: string): string[] {
    const regex = /{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}/g;
    const matches = template.matchAll(regex);
    const variables: string[] = [];
    for (const match of matches) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    return variables;
  }
}

class QueueManagerImpl implements QueueManager {
  private queue: Map<string, EmailQueueItem> = new Map();
  private priorityOrder: QueuePriority[] = ['urgent', 'high', 'normal', 'low'];

  async add(email: Email, priority: QueuePriority): Promise<EmailQueueItem> {
    const queueItem: EmailQueueItem = {
      queueId: generateId('queue'),
      email,
      priority,
      attempts: 0,
      scheduledFor: email.scheduledFor || new Date(),
      addedAt: new Date(),
    };
    this.queue.set(queueItem.queueId, queueItem);
    return queueItem;
  }

  async addBatch(emails: Email[], priority: QueuePriority): Promise<EmailQueueItem[]> {
    const items: EmailQueueItem[] = [];
    for (const email of emails) {
      const item = await this.add(email, priority);
      items.push(item);
    }
    return items;
  }

  async getNext(): Promise<EmailQueueItem | null> {
    const now = new Date();
    let best: EmailQueueItem | null = null;

    for (const [, item] of this.queue) {
      if (item.scheduledFor > now) continue;
      if (item.attempts >= item.email.maxRetries) continue;

      if (!best) {
        best = item;
      } else {
        const bestPriorityIndex = this.priorityOrder.indexOf(best.priority);
        const itemPriorityIndex = this.priorityOrder.indexOf(item.priority);
        if (itemPriorityIndex < bestPriorityIndex) {
          best = item;
        } else if (itemPriorityIndex === bestPriorityIndex && item.addedAt < best.addedAt) {
          best = item;
        }
      }
    }

    return best;
  }

  async getByPriority(priority: QueuePriority): Promise<EmailQueueItem[]> {
    const items: EmailQueueItem[] = [];
    for (const [, item] of this.queue) {
      if (item.priority === priority) {
        items.push(item);
      }
    }
    return items.sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());
  }

  async markProcessing(queueId: string): Promise<void> {
    const item = this.queue.get(queueId);
    if (item) {
      item.attempts += 1;
      item.lastAttemptAt = new Date();
    }
  }

  async markCompleted(queueId: string): Promise<void> {
    this.queue.delete(queueId);
  }

  async markFailed(queueId: string, error: string): Promise<void> {
    const item = this.queue.get(queueId);
    if (item) {
      item.error = error;
    }
  }

  async remove(queueId: string): Promise<void> {
    this.queue.delete(queueId);
  }

  async clear(): Promise<void> {
    this.queue.clear();
  }

  size(): number {
    return this.queue.size;
  }
}

class BounceHandlerImpl implements BounceHandler {
  async handleBounce(bounceData: unknown): Promise<BounceRecord> {
    const categorized = this.categorizeBounce(bounceData);
    const record: BounceRecord = {
      bounceId: generateId('bounce'),
      emailId: this.extractEmailId(bounceData),
      bounceType: categorized.type,
      category: categorized.category,
      email: this.extractEmail(bounceData),
      timestamp: new Date(),
      provider: this.extractProvider(bounceData),
      details: categorized.details,
    };
    return record;
  }

  categorizeBounce(bounceData: unknown): { type: BounceType; category: BounceCategory; details?: string } {
    if (!bounceData || typeof bounceData !== 'object') {
      return { type: 'hard', category: 'other' };
    }

    const data = bounceData as Record<string, unknown>;

    if (data['bounceType'] === 'soft') {
      return { type: 'soft', category: this.categorizeSoftBounce(data), details: String(data['description'] || '') };
    }

    return { type: 'hard', category: this.categorizeHardBounce(data), details: String(data['description'] || '') };
  }

  private categorizeHardBounce(data: Record<string, unknown>): BounceCategory {
    const reason = String(data['reason'] || data['description'] || '').toLowerCase();
    if (reason.includes('invalid') || reason.includes('bad address')) return 'invalid';
    if (reason.includes('domain') || reason.includes('dns')) return 'domain';
    if (reason.includes('no mailbox') || reason.includes('no such user') || reason.includes('user unknown')) return 'no-mailbox';
    if (reason.includes('spam')) return 'spam';
    return 'other';
  }

  private categorizeSoftBounce(data: Record<string, unknown>): BounceCategory {
    const reason = String(data['reason'] || data['description'] || '').toLowerCase();
    if (reason.includes('full') || reason.includes('quota')) return 'full';
    if (reason.includes('spam')) return 'spam';
    if (reason.includes('auto') || reason.includes('vacation') || reason.includes('autoreply')) return 'auto-reply';
    return 'other';
  }

  shouldReschedule(email: Email, bounceType: BounceType): boolean {
    if (bounceType === 'hard') return false;
    return email.retryCount < email.maxRetries;
  }

  private extractEmailId(bounceData: unknown): string {
    if (bounceData && typeof bounceData === 'object') {
      const data = bounceData as Record<string, unknown>;
      return String(data['emailId'] || data['messageId'] || generateId('unknown'));
    }
    return generateId('unknown');
  }

  private extractEmail(bounceData: unknown): string {
    if (bounceData && typeof bounceData === 'object') {
      const data = bounceData as Record<string, unknown>;
      return String(data['email'] || data['recipient'] || 'unknown@unknown.com');
    }
    return 'unknown@unknown.com';
  }

  private extractProvider(bounceData: unknown): EmailProvider {
    if (bounceData && typeof bounceData === 'object') {
      const data = bounceData as Record<string, unknown>;
      const provider = String(data['provider'] || 'smtp');
      if (provider === 'sendgrid' || provider === 'mailgun' || provider === 'aws-ses' || provider === 'smtp') {
        return provider as EmailProvider;
      }
    }
    return 'smtp';
  }
}

class UnsubscribeHandlerImpl implements UnsubscribeHandler {
  async handleUnsubscribe(unsubscribeData: unknown): Promise<UnsubscribeRecord> {
    const record: UnsubscribeRecord = {
      unsubscribeId: generateId('unsub'),
      email: this.extractEmail(unsubscribeData),
      listId: this.getListId(unsubscribeData),
      unsubscribedAt: new Date(),
      reason: this.extractReason(unsubscribeData),
    };
    return record;
  }

  isListUnsubscribe(unsubscribeData: unknown): boolean {
    if (unsubscribeData && typeof unsubscribeData === 'object') {
      const data = unsubscribeData as Record<string, unknown>;
      return data['List-Unsubscribe'] !== undefined || data['list-unsubscribe'] !== undefined;
    }
    return false;
  }

  getListId(unsubscribeData: unknown): string | undefined {
    if (unsubscribeData && typeof unsubscribeData === 'object') {
      const data = unsubscribeData as Record<string, unknown>;
      const listId = data['List-ID'] || data['list-id'] || data['listId'];
      return listId ? String(listId) : undefined;
    }
    return undefined;
  }

  private extractEmail(unsubscribeData: unknown): string {
    if (unsubscribeData && typeof unsubscribeData === 'object') {
      const data = unsubscribeData as Record<string, unknown>;
      return String(data['email'] || data['recipient'] || 'unknown@unknown.com');
    }
    return 'unknown@unknown.com';
  }

  private extractReason(unsubscribeData: unknown): string | undefined {
    if (unsubscribeData && typeof unsubscribeData === 'object') {
      const data = unsubscribeData as Record<string, unknown>;
      return data['reason'] ? String(data['reason']) : undefined;
    }
    return undefined;
  }
}

export class EmailServiceImpl implements EmailService {
  private emails: Map<string, Email> = new Map();
  private templates: Map<string, EmailTemplate> = new Map();
  private queue: QueueManager;
  private tracking: Map<string, EmailDeliveryTracking> = new Map();
  private bounces: Map<string, BounceRecord[]> = new Map();
  private unsubscribes: Map<string, UnsubscribeRecord> = new Map();
  private preferences: Map<string, EmailPreferences> = new Map();
  private providers: Map<EmailProvider, ProviderConfig> = new Map();
  private templateRenderer: TemplateRenderer;
  private bounceHandler: BounceHandler;
  private unsubscribeHandler: UnsubscribeHandler;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.queue = new QueueManagerImpl();
    this.templateRenderer = new TemplateRendererImpl();
    this.bounceHandler = new BounceHandlerImpl();
    this.unsubscribeHandler = new UnsubscribeHandlerImpl();
  }

  async send(options: SendEmailOptions): Promise<Email> {
    const email: Email = {
      emailId: generateId('email'),
      from: options.from || { email: 'default@manus.ai', name: 'Manus AI' },
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      body: options.body,
      bodyHtml: options.bodyHtml,
      attachments: options.attachments || [],
      inlineImages: options.inlineImages || [],
      headers: options.headers || [],
      type: options.type || 'transactional',
      provider: options.provider || 'smtp',
      status: 'pending',
      priority: options.priority || 'normal',
      metadata: options.metadata,
      scheduledFor: options.scheduledFor,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.emails.set(email.emailId, email);

    if (email.scheduledFor && email.scheduledFor > new Date()) {
      await this.queue.add(email, email.priority);
      return email;
    }

    return this.processSend(email);
  }

  async sendBatch(options: SendEmailOptions[]): Promise<Email[]> {
    const results: Email[] = [];
    for (const opt of options) {
      const email = await this.send(opt);
      results.push(email);
    }
    return results;
  }

  async sendToAddress(
    from: EmailAddress,
    to: EmailAddress,
    subject: string,
    body: string,
    bodyHtml?: string
  ): Promise<Email> {
    return this.send({
      from,
      to: [to],
      subject,
      body,
      bodyHtml,
    });
  }

  async sendWithTemplate(templateId: string, to: EmailAddress[], variables: Record<string, string>): Promise<Email> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const validation = this.templateRenderer.validateTemplate(template.body, Object.keys(variables));
    if (!validation.valid) {
      throw new Error(`Missing template variables: ${validation.missingVariables.join(', ')}`);
    }

    const renderedBody = this.templateRenderer.render(template.body, variables);
    const renderedSubject = this.templateRenderer.render(template.subject, variables);
    const renderedHtml = template.bodyHtml
      ? this.templateRenderer.render(template.bodyHtml, variables)
      : undefined;

    return this.send({
      to,
      subject: renderedSubject,
      body: renderedBody,
      bodyHtml: renderedHtml,
      type: template.type,
    });
  }

  private async processSend(email: Email): Promise<Email> {
    email.status = 'sent';
    email.sentAt = new Date();
    email.updatedAt = new Date();
    this.emails.set(email.emailId, email);

    await this.trackDelivery(email.emailId);

    this.simulateDelivery(email);

    return email;
  }

  private simulateDelivery(email: Email): void {
    setTimeout(() => {
      if (email.status === 'sent') {
        email.status = 'delivered';
        email.deliveredAt = new Date();
        email.updatedAt = new Date();
        this.emails.set(email.emailId, email);

        const tracking = this.tracking.get(email.emailId);
        if (tracking) {
          tracking.status = 'delivered';
          tracking.deliveredAt = new Date();
          if (tracking.sentAt) {
            tracking.deliveryTimeMs = tracking.deliveredAt.getTime() - tracking.sentAt.getTime();
          }
          this.tracking.set(email.emailId, tracking);
        }
      }
    }, 100);
  }

  async getEmail(emailId: string): Promise<Email | null> {
    return this.emails.get(emailId) || null;
  }

  async queryEmails(options: EmailQueryOptions): Promise<Email[]> {
    let results = Array.from(this.emails.values());

    if (options.status) {
      results = results.filter((e) => e.status === options.status);
    }
    if (options.type) {
      results = results.filter((e) => e.type === options.type);
    }
    if (options.provider) {
      results = results.filter((e) => e.provider === options.provider);
    }
    if (options.from) {
      results = results.filter((e) => e.from.email.includes(options.from!));
    }
    if (options.to) {
      results = results.filter((e) => e.to.some((t) => t.email.includes(options.to!)));
    }
    if (options.since) {
      results = results.filter((e) => e.createdAt >= options.since!);
    }
    if (options.until) {
      results = results.filter((e) => e.createdAt <= options.until!);
    }
    if (!options.includeBounced) {
      results = results.filter((e) => e.status !== 'bounced');
    }

    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (options.offset) {
      results = results.slice(options.offset);
    }
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async getEmailStats(since?: Date): Promise<EmailStats> {
    let emails = Array.from(this.emails.values());
    if (since) {
      emails = emails.filter((e) => e.createdAt >= since);
    }

    const totalSent = emails.length;
    const totalDelivered = emails.filter((e) => e.status === 'delivered').length;
    const totalBounced = emails.filter((e) => e.status === 'bounced').length;
    const totalFailed = emails.filter((e) => e.status === 'failed').length;

    const byType: Record<EmailType, number> = { transactional: 0, marketing: 0, notifications: 0 };
    const byProvider: Record<EmailProvider, number> = { smtp: 0, sendgrid: 0, mailgun: 0, 'aws-ses': 0 };

    for (const email of emails) {
      byType[email.type]++;
      byProvider[email.provider]++;
    }

    const deliveredEmails = emails.filter((e) => e.deliveredAt && e.sentAt);
    const avgDeliveryTime =
      deliveredEmails.length > 0
        ? deliveredEmails.reduce((sum, e) => sum + (e.deliveredAt!.getTime() - e.sentAt!.getTime()), 0) /
          deliveredEmails.length
        : 0;

    return {
      totalSent,
      totalDelivered,
      totalBounced,
      totalFailed,
      deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
      bounceRate: totalSent > 0 ? (totalBounced / totalSent) * 100 : 0,
      byType,
      byProvider,
      averageDeliveryTimeMs: avgDeliveryTime,
    };
  }

  async retry(emailId: string): Promise<void> {
    const email = this.emails.get(emailId);
    if (!email) {
      throw new Error(`Email ${emailId} not found`);
    }

    if (email.retryCount >= email.maxRetries) {
      throw new Error(`Email ${emailId} has exceeded max retries`);
    }

    email.status = 'pending';
    email.retryCount++;
    email.updatedAt = new Date();
    this.emails.set(emailId, email);

    await this.queue.add(email, email.priority);
  }

  async cancel(emailId: string): Promise<void> {
    const email = this.emails.get(emailId);
    if (email) {
      email.status = 'failed';
      email.failedAt = new Date();
      email.updatedAt = new Date();
      this.emails.set(emailId, email);
    }
  }

  async createTemplate(
    template: Omit<EmailTemplate, 'templateId' | 'createdAt' | 'updatedAt'>
  ): Promise<EmailTemplate> {
    const fullTemplate: EmailTemplate = {
      ...template,
      templateId: generateId('tmpl'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.templates.set(fullTemplate.templateId, fullTemplate);
    return fullTemplate;
  }

  async getTemplate(templateId: string): Promise<EmailTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  async updateTemplate(templateId: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const updated: EmailTemplate = {
      ...template,
      ...updates,
      templateId,
      createdAt: template.createdAt,
      updatedAt: new Date(),
    };

    this.templates.set(templateId, updated);
    return updated;
  }

  async deleteTemplate(templateId: string): Promise<void> {
    this.templates.delete(templateId);
  }

  async listTemplates(type?: EmailType): Promise<EmailTemplate[]> {
    let templates = Array.from(this.templates.values());
    if (type) {
      templates = templates.filter((t) => t.type === type);
    }
    return templates.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async processQueue(): Promise<void> {
    const item = await this.queue.getNext();
    if (!item) return;

    await this.queue.markProcessing(item.queueId);

    try {
      await this.processSend(item.email);
      await this.queue.markCompleted(item.queueId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.queue.markFailed(item.queueId, errorMessage);

      if (item.attempts >= item.email.maxRetries) {
        item.email.status = 'failed';
        item.email.failedAt = new Date();
        item.email.updatedAt = new Date();
        this.emails.set(item.email.emailId, item.email);
      }
    }
  }

  async getQueueSize(priority?: QueuePriority): Promise<number> {
    if (priority) {
      const items = await this.queue.getByPriority(priority);
      return items.length;
    }
    return this.queue.size();
  }

  async clearQueue(): Promise<void> {
    await this.queue.clear();
  }

  async recordBounce(
    emailId: string,
    bounceType: BounceType,
    category: BounceCategory,
    details?: string
  ): Promise<BounceRecord> {
    const email = this.emails.get(emailId);
    if (!email) {
      throw new Error(`Email ${emailId} not found`);
    }

    const record: BounceRecord = {
      bounceId: generateId('bounce'),
      emailId,
      bounceType,
      category,
      email: email.to[0]?.email || 'unknown@unknown.com',
      timestamp: new Date(),
      provider: email.provider,
      details,
    };

    const emailBounces = this.bounces.get(emailId) || [];
    emailBounces.push(record);
    this.bounces.set(emailId, emailBounces);

    email.status = 'bounced';
    email.bouncedAt = new Date();
    email.bounceReason = details;
    email.updatedAt = new Date();
    this.emails.set(emailId, email);

    return record;
  }

  async getBounces(emailId: string): Promise<BounceRecord[]> {
    return this.bounces.get(emailId) || [];
  }

  async handleBounce(bounceData: unknown): Promise<void> {
    const record = await this.bounceHandler.handleBounce(bounceData);
    await this.recordBounce(record.emailId, record.bounceType, record.category, record.details);
  }

  async unsubscribe(email: string, listId?: string, reason?: string): Promise<UnsubscribeRecord> {
    const record: UnsubscribeRecord = {
      unsubscribeId: generateId('unsub'),
      email,
      listId,
      unsubscribedAt: new Date(),
      reason,
    };

    const key = listId ? `${email}:${listId}` : email;
    this.unsubscribes.set(key, record);

    return record;
  }

  async isUnsubscribed(email: string, listId?: string): Promise<boolean> {
    const key = listId ? `${email}:${listId}` : email;
    return this.unsubscribes.has(key);
  }

  async handleUnsubscribe(unsubscribeData: unknown): Promise<void> {
    const record = await this.unsubscribeHandler.handleUnsubscribe(unsubscribeData);
    const key = record.listId ? `${record.email}:${record.listId}` : record.email;
    this.unsubscribes.set(key, record);
  }

  async getDeliveryTracking(emailId: string): Promise<EmailDeliveryTracking | null> {
    return this.tracking.get(emailId) || null;
  }

  async trackDelivery(emailId: string): Promise<void> {
    const email = this.emails.get(emailId);
    if (!email) return;

    const tracking: EmailDeliveryTracking = {
      trackingId: generateId('track'),
      emailId,
      status: email.status,
      sentAt: email.sentAt || new Date(),
      deliveredAt: email.deliveredAt,
      bouncedAt: email.bouncedAt,
      failedAt: email.failedAt,
      bounceType: email.status === 'bounced' ? 'hard' : undefined,
    };

    if (tracking.sentAt && tracking.deliveredAt) {
      tracking.deliveryTimeMs = tracking.deliveredAt.getTime() - tracking.sentAt.getTime();
    }

    this.tracking.set(emailId, tracking);
  }

  async configureProvider(config: ProviderConfig): Promise<void> {
    this.providers.set(config.provider, config);
  }

  getProviderConfig(provider: EmailProvider): ProviderConfig | null {
    return this.providers.get(provider) || null;
  }

  async testConnection(provider: EmailProvider = 'smtp'): Promise<boolean> {
    const config = this.providers.get(provider);
    if (!config) {
      if (provider === 'smtp') {
        return true;
      }
      return false;
    }
    return true;
  }

  startQueueProcessing(intervalMs: number = 5000): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    this.processingInterval = setInterval(() => {
      this.processQueue().catch(() => {});
    }, intervalMs);
  }

  stopQueueProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }
}

export function createEmailService(): EmailServiceImpl {
  return new EmailServiceImpl();
}

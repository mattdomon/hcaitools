/**
 * Email Service
 * SMTP and API provider support with templates, queueing, and tracking
 */

export {
  EmailProvider,
  EmailType,
  DeliveryStatus,
  QueuePriority,
  BounceType,
  BounceCategory,
  Attachment,
  InlineImage,
  EmailAddress,
  EmailHeader,
  Email,
  EmailTemplate,
  EmailQueueItem,
  EmailDeliveryTracking,
  BounceRecord,
  UnsubscribeRecord,
  EmailPreferences,
  ProviderConfig,
  ProviderSettings,
  SendEmailOptions,
  EmailQueryOptions,
  EmailStats,
  EmailService,
  TemplateRenderer,
  QueueManager,
  BounceHandler,
  UnsubscribeHandler,
} from './types';

export { EmailServiceImpl, createEmailService } from './emailService';

import { EmailServiceImpl } from './emailService';
import { EmailAddress } from './types';

export class EmailManus {
  private service: EmailServiceImpl;

  constructor() {
    this.service = new EmailServiceImpl();
  }

  async sendEmail(
    to: string | EmailAddress,
    subject: string,
    body: string,
    options?: {
      bodyHtml?: string;
      from?: EmailAddress;
      attachments?: import('./types').Attachment[];
      type?: import('./types').EmailType;
      priority?: import('./types').QueuePriority;
    }
  ): Promise<import('./types').Email> {
    const toAddress = typeof to === 'string' ? { email: to } : to;
    return this.service.send({
      to: [toAddress],
      subject,
      body,
      bodyHtml: options?.bodyHtml,
      from: options?.from,
      attachments: options?.attachments,
      type: options?.type || 'transactional',
      priority: options?.priority || 'normal',
    });
  }

  async sendBulk(
    to: EmailAddress[],
    subject: string,
    body: string,
    options?: { bodyHtml?: string; type?: import('./types').EmailType }
  ): Promise<import('./types').Email[]> {
    return this.service.sendBatch(
      to.map((recipient) => ({
        to: [recipient],
        subject,
        body,
        bodyHtml: options?.bodyHtml,
        type: options?.type || 'transactional',
      }))
    );
  }

  async sendTemplate(
    templateId: string,
    to: EmailAddress[],
    variables: Record<string, string>
  ): Promise<import('./types').Email> {
    return this.service.sendWithTemplate(templateId, to, variables);
  }

  async scheduleEmail(
    to: string | EmailAddress,
    subject: string,
    body: string,
    scheduledFor: Date,
    options?: { bodyHtml?: string; type?: import('./types').EmailType }
  ): Promise<import('./types').Email> {
    const toAddress = typeof to === 'string' ? { email: to } : to;
    return this.service.send({
      to: [toAddress],
      subject,
      body,
      bodyHtml: options?.bodyHtml,
      type: options?.type || 'transactional',
      scheduledFor,
    });
  }

  async getEmail(emailId: string): Promise<import('./types').Email | null> {
    return this.service.getEmail(emailId);
  }

  async getStats(since?: Date): Promise<import('./types').EmailStats> {
    return this.service.getEmailStats(since);
  }

  async retryEmail(emailId: string): Promise<void> {
    return this.service.retry(emailId);
  }

  async cancelEmail(emailId: string): Promise<void> {
    return this.service.cancel(emailId);
  }

  async createTemplate(
    name: string,
    type: import('./types').EmailType,
    subject: string,
    body: string,
    bodyHtml?: string
  ): Promise<import('./types').EmailTemplate> {
    return this.service.createTemplate({
      name,
      type,
      subject,
      body,
      bodyHtml,
      variables: this.extractVariables(body + ' ' + subject + ' ' + (bodyHtml || '')),
    });
  }

  private extractVariables(template: string): string[] {
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

  async getTemplate(templateId: string): Promise<import('./types').EmailTemplate | null> {
    return this.service.getTemplate(templateId);
  }

  async updateTemplate(
    templateId: string,
    updates: Partial<import('./types').EmailTemplate>
  ): Promise<import('./types').EmailTemplate> {
    return this.service.updateTemplate(templateId, updates);
  }

  async deleteTemplate(templateId: string): Promise<void> {
    return this.service.deleteTemplate(templateId);
  }

  async listTemplates(type?: import('./types').EmailType): Promise<import('./types').EmailTemplate[]> {
    return this.service.listTemplates(type);
  }

  async recordBounce(
    emailId: string,
    bounceType: import('./types').BounceType,
    category: import('./types').BounceCategory,
    details?: string
  ): Promise<import('./types').BounceRecord> {
    return this.service.recordBounce(emailId, bounceType, category, details);
  }

  async getBounces(emailId: string): Promise<import('./types').BounceRecord[]> {
    return this.service.getBounces(emailId);
  }

  async unsubscribe(email: string, listId?: string, reason?: string): Promise<import('./types').UnsubscribeRecord> {
    return this.service.unsubscribe(email, listId, reason);
  }

  async isUnsubscribed(email: string, listId?: string): Promise<boolean> {
    return this.service.isUnsubscribed(email, listId);
  }

  async getDeliveryTracking(emailId: string): Promise<import('./types').EmailDeliveryTracking | null> {
    return this.service.getDeliveryTracking(emailId);
  }

  async configureProvider(config: import('./types').ProviderConfig): Promise<void> {
    return this.service.configureProvider(config);
  }

  async testConnection(provider: import('./types').EmailProvider = 'smtp'): Promise<boolean> {
    return this.service.testConnection(provider);
  }

  async getQueueSize(priority?: import('./types').QueuePriority): Promise<number> {
    return this.service.getQueueSize(priority);
  }

  startQueueProcessing(intervalMs?: number): void {
    this.service.startQueueProcessing(intervalMs);
  }

  stopQueueProcessing(): void {
    this.service.stopQueueProcessing();
  }
}

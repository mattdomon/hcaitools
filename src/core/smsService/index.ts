/**
 * SMS Service
 * Multi-provider SMS support with templates, queueing, and tracking
 */

export {
  SMSProvider,
  SMSType,
  SMSDeliveryStatus,
  QueuePriority,
  SMSDirection,
  KeywordAction,
  PhoneNumber,
  SMSMessage,
  SMSTemplate,
  SMSQueueItem,
  SMSDeliveryTracking,
  SMSIncoming,
  SMSWebhookPayload,
  SMSCallback,
  SMSPreferences,
  ProviderConfig,
  ProviderSettings,
  SendSMSOptions,
  SMSQueryOptions,
  SMSStats,
  SMSService,
  TemplateRenderer,
  QueueManager,
  DeliveryStatusHandler,
  KeywordHandler,
  PhoneNumberValidator,
} from './types';

export { SMSServiceImpl, createSMSService } from './smsService';

import { SMSServiceImpl } from './smsService';
import { PhoneNumber, SMSType, QueuePriority, SMSPreferences, SMSTemplate } from './types';

export class SMSManus {
  private service: SMSServiceImpl;

  constructor() {
    this.service = new SMSServiceImpl();
  }

  async sendSMS(
    to: string | PhoneNumber,
    body: string,
    options?: {
      from?: PhoneNumber;
      type?: SMSType;
      priority?: QueuePriority;
    }
  ): Promise<import('./types').SMSMessage> {
    const toNumber = typeof to === 'string' ? { number: to } : to;
    return this.service.send({
      to: [toNumber],
      body,
      from: options?.from,
      type: options?.type || 'transactional',
      priority: options?.priority || 'normal',
    });
  }

  async sendBulk(
    to: PhoneNumber[],
    body: string,
    options?: { type?: SMSType }
  ): Promise<import('./types').SMSMessage[]> {
    return this.service.sendBatch(
      to.map((recipient) => ({
        to: [recipient],
        body,
        type: options?.type || 'transactional',
      }))
    );
  }

  async sendTemplate(
    templateId: string,
    to: PhoneNumber[],
    variables: Record<string, string>
  ): Promise<import('./types').SMSMessage> {
    return this.service.sendWithTemplate(templateId, to, variables);
  }

  async sendVerification(
    phoneNumber: string | PhoneNumber,
    code: string
  ): Promise<import('./types').SMSMessage> {
    const to = typeof phoneNumber === 'string' ? { number: phoneNumber } : phoneNumber;
    return this.service.sendVerification(to, code);
  }

  async scheduleSMS(
    to: string | PhoneNumber,
    body: string,
    scheduledFor: Date,
    options?: { type?: SMSType }
  ): Promise<import('./types').SMSMessage> {
    const toNumber = typeof to === 'string' ? { number: to } : to;
    return this.service.send({
      to: [toNumber],
      body,
      type: options?.type || 'transactional',
      scheduledFor,
    });
  }

  async getMessage(messageId: string): Promise<import('./types').SMSMessage | null> {
    return this.service.getMessage(messageId);
  }

  async getStats(since?: Date): Promise<import('./types').SMSStats> {
    return this.service.getSMSStats(since);
  }

  async retryMessage(messageId: string): Promise<void> {
    return this.service.retry(messageId);
  }

  async cancelMessage(messageId: string): Promise<void> {
    return this.service.cancel(messageId);
  }

  async createTemplate(
    name: string,
    type: SMSType,
    body: string
  ): Promise<SMSTemplate> {
    return this.service.createTemplate({
      name,
      type,
      body,
      variables: this.extractVariables(body),
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

  async getTemplate(templateId: string): Promise<SMSTemplate | null> {
    return this.service.getTemplate(templateId);
  }

  async updateTemplate(
    templateId: string,
    updates: Partial<SMSTemplate>
  ): Promise<SMSTemplate> {
    return this.service.updateTemplate(templateId, updates);
  }

  async deleteTemplate(templateId: string): Promise<void> {
    return this.service.deleteTemplate(templateId);
  }

  async listTemplates(type?: SMSType): Promise<SMSTemplate[]> {
    return this.service.listTemplates(type);
  }

  async getDeliveryTracking(messageId: string): Promise<import('./types').SMSDeliveryTracking | null> {
    return this.service.getDeliveryTracking(messageId);
  }

  async handleDeliveryCallback(payload: import('./types').SMSWebhookPayload): Promise<void> {
    return this.service.handleDeliveryCallback(payload);
  }

  async getIncomingMessages(options?: { since?: Date; limit?: number }): Promise<import('./types').SMSIncoming[]> {
    return this.service.getIncomingMessages(options);
  }

  async configureProvider(config: import('./types').ProviderConfig): Promise<void> {
    return this.service.configureProvider(config);
  }

  async testConnection(provider: import('./types').SMSProvider = 'twilio'): Promise<boolean> {
    return this.service.testConnection(provider);
  }

  async getQueueSize(priority?: QueuePriority): Promise<number> {
    return this.service.getQueueSize(priority);
  }

  startQueueProcessing(intervalMs?: number): void {
    this.service.startQueueProcessing(intervalMs);
  }

  stopQueueProcessing(): void {
    this.service.stopQueueProcessing();
  }

  async updatePreferences(
    userId: string,
    phoneNumber: string,
    updates: Partial<SMSPreferences>
  ): Promise<SMSPreferences> {
    return this.service.updatePreferences(userId, phoneNumber, updates);
  }

  async getPreferences(userId: string): Promise<SMSPreferences | null> {
    return this.service.getPreferences(userId);
  }

  async optOut(phoneNumber: string, reason?: string): Promise<void> {
    return this.service.optOut(phoneNumber, reason);
  }

  async isOptedOut(phoneNumber: string): Promise<boolean> {
    return this.service.isOptedOut(phoneNumber);
  }
}

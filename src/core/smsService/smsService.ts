/**
 * SMS Service Implementation
 * Multi-provider SMS support with templates, queueing, and tracking
 */

import crypto from 'crypto';
import {
  SMSMessage,
  SMSTemplate,
  SMSQueueItem,
  SMSDeliveryTracking,
  SMSIncoming,
  SMSWebhookPayload,
  SMSCallback,
  SMSPreferences,
  ProviderConfig,
  SendSMSOptions,
  SMSQueryOptions,
  SMSStats,
  PhoneNumber,
  SMSProvider,
  SMSType,
  QueuePriority,
  SMSDeliveryStatus,
  SMSService,
  TemplateRenderer,
  QueueManager,
  DeliveryStatusHandler,
  KeywordHandler,
  PhoneNumberValidator,
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

class PhoneNumberValidatorImpl implements PhoneNumberValidator {
  validate(phoneNumber: string): { valid: boolean; formatted?: string; type?: PhoneNumber['type']; countryCode?: string } {
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.length < 10 || cleaned.length > 15) {
      return { valid: false };
    }

    let countryCode = '1';
    let localNumber = cleaned;
    
    if (cleaned.length > 10) {
      countryCode = cleaned.slice(0, cleaned.length - 10);
      localNumber = cleaned.slice(-10);
    }

    const areaCode = localNumber.slice(0, 3);
    const prefix = localNumber.slice(3, 6);
    const lineNumber = localNumber.slice(6);

    if (parseInt(areaCode, 10) < 200 || parseInt(prefix, 10) < 200 || parseInt(lineNumber, 10) < 0) {
      return { valid: false };
    }

    const formatted = `+${countryCode} (${areaCode}) ${prefix}-${lineNumber}`;
    const type = this.categorizeNumber(localNumber);

    return {
      valid: true,
      formatted,
      type,
      countryCode,
    };
  }

  format(phoneNumber: string, _countryCode?: string): string {
    const validation = this.validate(phoneNumber);
    if (!validation.valid) {
      return phoneNumber;
    }
    return validation.formatted || phoneNumber;
  }

  isMobile(phoneNumber: string): boolean {
    const validation = this.validate(phoneNumber);
    return validation.valid && validation.type === 'mobile';
  }

  isVoip(phoneNumber: string): boolean {
    const validation = this.validate(phoneNumber);
    return validation.valid && validation.type === 'voip';
  }

  private categorizeNumber(localNumber: string): PhoneNumber['type'] {
    const prefix = localNumber.slice(0, 3);
    
    const voipPrefixes = ['200', '300', '400', '500', '600', '700', '800', '900'];
    if (voipPrefixes.includes(prefix)) {
      return 'voip';
    }
    
    return 'mobile';
  }
}

class QueueManagerImpl implements QueueManager {
  private queue: Map<string, SMSQueueItem> = new Map();
  private priorityOrder: QueuePriority[] = ['urgent', 'high', 'normal', 'low'];

  async add(message: SMSMessage, priority: QueuePriority): Promise<SMSQueueItem> {
    const queueItem: SMSQueueItem = {
      queueId: generateId('smsq'),
      message,
      priority,
      attempts: 0,
      scheduledFor: message.scheduledFor || new Date(),
      addedAt: new Date(),
    };
    this.queue.set(queueItem.queueId, queueItem);
    return queueItem;
  }

  async addBatch(messages: SMSMessage[], priority: QueuePriority): Promise<SMSQueueItem[]> {
    const items: SMSQueueItem[] = [];
    for (const message of messages) {
      const item = await this.add(message, priority);
      items.push(item);
    }
    return items;
  }

  async getNext(): Promise<SMSQueueItem | null> {
    const now = new Date();
    let best: SMSQueueItem | null = null;

    for (const [, item] of this.queue) {
      if (item.scheduledFor > now) continue;
      if (item.attempts >= item.message.maxRetries) continue;

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

  async getByPriority(priority: QueuePriority): Promise<SMSQueueItem[]> {
    const items: SMSQueueItem[] = [];
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

class DeliveryStatusHandlerImpl implements DeliveryStatusHandler {
  async handleStatusUpdate(_payload: SMSWebhookPayload): Promise<void> {
    // Implemented in SMSServiceImpl
  }

  categorizeError(errorCode: string): { category: string; shouldRetry: boolean } {
    const errorMappings: Record<string, { category: string; shouldRetry: boolean }> = {
      '30003': { category: 'unreachable', shouldRetry: true },
      '30004': { category: 'message_limit', shouldRetry: false },
      '30005': { category: 'unknown_destination', shouldRetry: false },
      '30006': { category: 'landline', shouldRetry: false },
      '30007': { category: 'carrier_blocked', shouldRetry: true },
      '30008': { category: 'unknown_error', shouldRetry: true },
      '500': { category: 'server_error', shouldRetry: true },
      '503': { category: 'service_unavailable', shouldRetry: true },
    };

    return errorMappings[errorCode] || { category: 'unknown', shouldRetry: true };
  }
}

class KeywordHandlerImpl implements KeywordHandler {
  private stopWords = ['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit'];
  private startWords = ['start', 'yes', 'subscribe', 'unstop'];
  private helpWords = ['help', 'info', 'information', 'support'];
  private optIns: Map<string, { optedInAt: Date; source: string }> = new Map();

  async handleKeyword(from: PhoneNumber, keyword: string, _originalMessageId?: string): Promise<void> {
    const normalizedKeyword = keyword.toLowerCase().trim();

    if (this.stopWords.includes(normalizedKeyword)) {
      const key = from.number;
      this.optIns.delete(key);
    } else if (this.startWords.includes(normalizedKeyword)) {
      const key = from.number;
      this.optIns.set(key, { optedInAt: new Date(), source: 'keyword_reply' });
    }
  }

  extractKeywords(messageBody: string): string[] {
    const words = messageBody.toLowerCase().split(/\s+/);
    const keywords: string[] = [];

    for (const word of words) {
      const cleaned = word.replace(/[^a-z]/g, '');
      if (this.stopWords.includes(cleaned) || this.startWords.includes(cleaned) || this.helpWords.includes(cleaned)) {
        keywords.push(cleaned);
      }
    }

    return keywords;
  }
}

export class SMSServiceImpl implements SMSService {
  private messages: Map<string, SMSMessage> = new Map();
  private templates: Map<string, SMSTemplate> = new Map();
  private queue: QueueManager;
  private tracking: Map<string, SMSDeliveryTracking> = new Map();
  private incoming: Map<string, SMSIncoming> = new Map();
  private callbacks: Map<string, SMSCallback> = new Map();
  private preferences: Map<string, SMSPreferences> = new Map();
  private providers: Map<SMSProvider, ProviderConfig> = new Map();
  private templateRenderer: TemplateRenderer;
  private phoneValidator: PhoneNumberValidator;
  private statusHandler: DeliveryStatusHandler;
  private keywordHandler: KeywordHandler;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.queue = new QueueManagerImpl();
    this.templateRenderer = new TemplateRendererImpl();
    this.phoneValidator = new PhoneNumberValidatorImpl();
    this.statusHandler = new DeliveryStatusHandlerImpl();
    this.keywordHandler = new KeywordHandlerImpl();
  }

  async send(options: SendSMSOptions): Promise<SMSMessage> {
    const message: SMSMessage = {
      messageId: generateId('sms'),
      from: options.from || { number: '+15551234567' },
      to: options.to,
      body: options.body,
      type: options.type || 'transactional',
      provider: options.provider || 'twilio',
      status: 'queued',
      direction: 'outbound',
      priority: options.priority || 'normal',
      metadata: options.metadata,
      scheduledFor: options.scheduledFor,
      retryCount: 0,
      maxRetries: 3,
      segments: this.calculateSegments(options.body),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.messages.set(message.messageId, message);

    if (options.deliveryCallbackUrl) {
      await this.createCallback(message.messageId, options.deliveryCallbackUrl);
    }

    if (message.scheduledFor && message.scheduledFor > new Date()) {
      await this.queue.add(message, message.priority);
      return message;
    }

    return this.processSend(message);
  }

  async sendBatch(options: SendSMSOptions[]): Promise<SMSMessage[]> {
    const results: SMSMessage[] = [];
    for (const opt of options) {
      const message = await this.send(opt);
      results.push(message);
    }
    return results;
  }

  async sendToNumber(from: PhoneNumber, to: PhoneNumber, body: string, type?: SMSType): Promise<SMSMessage> {
    return this.send({
      from,
      to: [to],
      body,
      type,
    });
  }

  async sendWithTemplate(templateId: string, to: PhoneNumber[], variables: Record<string, string>): Promise<SMSMessage> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const validation = this.templateRenderer.validateTemplate(template.body, Object.keys(variables));
    if (!validation.valid) {
      throw new Error(`Missing template variables: ${validation.missingVariables.join(', ')}`);
    }

    const renderedBody = this.templateRenderer.render(template.body, variables);

    return this.send({
      to,
      body: renderedBody,
      type: template.type,
    });
  }

  async sendVerification(phoneNumber: PhoneNumber, code: string): Promise<SMSMessage> {
    return this.send({
      to: [phoneNumber],
      body: `Your verification code is: ${code}. This code will expire in 10 minutes.`,
      type: 'verification',
      priority: 'high',
    });
  }

  private calculateSegments(body: string): number {
    const singleSegmentLimit = 160;
    const multiSegmentLimit = 153;

    if (body.length <= singleSegmentLimit) {
      return 1;
    }

    return Math.ceil(body.length / multiSegmentLimit);
  }

  private async processSend(message: SMSMessage): Promise<SMSMessage> {
    message.status = 'sent';
    message.sentAt = new Date();
    message.updatedAt = new Date();
    this.messages.set(message.messageId, message);

    await this.trackDelivery(message.messageId);

    this.simulateDelivery(message);

    return message;
  }

  private simulateDelivery(message: SMSMessage): void {
    setTimeout(() => {
      if (message.status === 'sent') {
        const success = Math.random() > 0.05;
        
        if (success) {
          message.status = 'delivered';
          message.deliveredAt = new Date();
          message.deliveryTimeMs = message.deliveredAt.getTime() - message.sentAt!.getTime();
        } else {
          message.status = 'failed';
          message.failedAt = new Date();
          message.errorCode = '30008';
          message.errorMessage = 'Unknown error';
        }
        
        message.updatedAt = new Date();
        this.messages.set(message.messageId, message);

        const tracking = this.tracking.get(message.messageId);
        if (tracking) {
          tracking.status = message.status;
          if (message.deliveredAt) tracking.deliveredAt = message.deliveredAt;
          if (message.failedAt) tracking.failedAt = message.failedAt;
          if (message.undeliveredAt) tracking.undeliveredAt = message.undeliveredAt;
          if (message.errorCode) tracking.errorCode = message.errorCode;
          if (message.errorMessage) tracking.errorMessage = message.errorMessage;
          this.tracking.set(message.messageId, tracking);
        }
      }
    }, 100);
  }

  private async createCallback(messageId: string, url: string): Promise<SMSCallback> {
    const callback: SMSCallback = {
      callbackId: generateId('cb'),
      messageId,
      url,
      method: 'POST',
      attempts: 0,
      createdAt: new Date(),
    };
    this.callbacks.set(callback.callbackId, callback);
    return callback;
  }

  async getMessage(messageId: string): Promise<SMSMessage | null> {
    return this.messages.get(messageId) || null;
  }

  async queryMessages(options: SMSQueryOptions): Promise<SMSMessage[]> {
    let results = Array.from(this.messages.values());

    if (options.status) {
      results = results.filter((m) => m.status === options.status);
    }
    if (options.type) {
      results = results.filter((m) => m.type === options.type);
    }
    if (options.provider) {
      results = results.filter((m) => m.provider === options.provider);
    }
    if (options.direction) {
      results = results.filter((m) => m.direction === options.direction);
    }
    if (options.from) {
      results = results.filter((m) => m.from.number.includes(options.from!));
    }
    if (options.to) {
      results = results.filter((m) => m.to.some((t) => t.number.includes(options.to!)));
    }
    if (options.since) {
      results = results.filter((m) => m.createdAt >= options.since!);
    }
    if (options.until) {
      results = results.filter((m) => m.createdAt <= options.until!);
    }
    if (!options.includeFailed) {
      results = results.filter((m) => m.status !== 'failed');
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

  async getSMSStats(since?: Date): Promise<SMSStats> {
    let messages = Array.from(this.messages.values());
    if (since) {
      messages = messages.filter((m) => m.createdAt >= since);
    }

    const totalSent = messages.length;
    const totalDelivered = messages.filter((m) => m.status === 'delivered').length;
    const totalFailed = messages.filter((m) => m.status === 'failed').length;
    const totalUndelivered = messages.filter((m) => m.status === 'undelivered').length;

    const byType: Record<SMSType, number> = { promotional: 0, transactional: 0, verification: 0 };
    const byProvider: Record<SMSProvider, number> = { twilio: 0, vonage: 0, 'aws-sns': 0 };

    for (const message of messages) {
      byType[message.type]++;
      byProvider[message.provider]++;
    }

    const deliveredMessages = messages.filter((m) => m.deliveredAt && m.sentAt);
    const avgDeliveryTime =
      deliveredMessages.length > 0
        ? deliveredMessages.reduce((sum, m) => sum + (m.deliveryTimeMs || 0), 0) / deliveredMessages.length
        : 0;

    return {
      totalSent,
      totalDelivered,
      totalFailed,
      totalUndelivered,
      deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
      failureRate: totalSent > 0 ? (totalFailed / totalSent) * 100 : 0,
      byType,
      byProvider,
      averageDeliveryTimeMs: avgDeliveryTime,
    };
  }

  async retry(messageId: string): Promise<void> {
    const message = this.messages.get(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    if (message.retryCount >= message.maxRetries) {
      throw new Error(`Message ${messageId} has exceeded max retries`);
    }

    message.status = 'queued';
    message.retryCount++;
    message.updatedAt = new Date();
    this.messages.set(messageId, message);

    await this.queue.add(message, message.priority);
  }

  async cancel(messageId: string): Promise<void> {
    const message = this.messages.get(messageId);
    if (message) {
      message.status = 'failed';
      message.failedAt = new Date();
      message.updatedAt = new Date();
      this.messages.set(messageId, message);
    }
  }

  async createTemplate(template: Omit<SMSTemplate, 'templateId' | 'createdAt' | 'updatedAt'>): Promise<SMSTemplate> {
    const fullTemplate: SMSTemplate = {
      ...template,
      templateId: generateId('smstmpl'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.templates.set(fullTemplate.templateId, fullTemplate);
    return fullTemplate;
  }

  async getTemplate(templateId: string): Promise<SMSTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  async updateTemplate(templateId: string, updates: Partial<SMSTemplate>): Promise<SMSTemplate> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const updated: SMSTemplate = {
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

  async listTemplates(type?: SMSType): Promise<SMSTemplate[]> {
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
      await this.processSend(item.message);
      await this.queue.markCompleted(item.queueId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.queue.markFailed(item.queueId, errorMessage);

      if (item.attempts >= item.message.maxRetries) {
        item.message.status = 'failed';
        item.message.failedAt = new Date();
        item.message.errorMessage = errorMessage;
        item.message.updatedAt = new Date();
        this.messages.set(item.message.messageId, item.message);
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

  async recordDeliveryStatus(
    messageId: string,
    status: SMSDeliveryStatus,
    errorCode?: string,
    errorMessage?: string
  ): Promise<void> {
    const message = this.messages.get(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    message.status = status;
    message.updatedAt = new Date();

    if (status === 'delivered') {
      message.deliveredAt = new Date();
      if (message.sentAt) {
        message.deliveryTimeMs = message.deliveredAt.getTime() - message.sentAt.getTime();
      }
    } else if (status === 'failed') {
      message.failedAt = new Date();
      message.errorCode = errorCode;
      message.errorMessage = errorMessage;
    } else if (status === 'undelivered') {
      message.undeliveredAt = new Date();
      message.errorCode = errorCode;
      message.errorMessage = errorMessage;
    }

    this.messages.set(messageId, message);

    const tracking = this.tracking.get(messageId);
    if (tracking) {
      tracking.status = status;
      if (message.deliveredAt) tracking.deliveredAt = message.deliveredAt;
      if (message.failedAt) tracking.failedAt = message.failedAt;
      if (message.undeliveredAt) tracking.undeliveredAt = message.undeliveredAt;
      if (errorCode) tracking.errorCode = errorCode;
      if (errorMessage) tracking.errorMessage = errorMessage;
      this.tracking.set(messageId, tracking);
    }
  }

  async getDeliveryTracking(messageId: string): Promise<SMSDeliveryTracking | null> {
    return this.tracking.get(messageId) || null;
  }

  private async trackDelivery(messageId: string): Promise<void> {
    const message = this.messages.get(messageId);
    if (!message) return;

    const tracking: SMSDeliveryTracking = {
      trackingId: generateId('smstrack'),
      messageId,
      status: message.status,
      sentAt: message.sentAt || new Date(),
      deliveredAt: message.deliveredAt,
      failedAt: message.failedAt,
      undeliveredAt: message.undeliveredAt,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
    };

    if (tracking.sentAt && tracking.deliveredAt) {
      tracking.deliveryTimeMs = tracking.deliveredAt.getTime() - tracking.sentAt.getTime();
    }

    this.tracking.set(messageId, tracking);
  }

  async handleDeliveryCallback(payload: SMSWebhookPayload): Promise<void> {
    const message = this.messages.get(payload.messageId);
    if (!message) return;

    await this.recordDeliveryStatus(payload.messageId, payload.status, payload.errorCode, payload.errorMessage);
  }

  async handleIncomingSMS(incoming: SMSIncoming): Promise<void> {
    this.incoming.set(incoming.incomingId, incoming);

    const keywords = this.keywordHandler.extractKeywords(incoming.body);
    
    for (const keyword of keywords) {
      await this.keywordHandler.handleKeyword(incoming.from, keyword);
    }
  }

  async getIncomingMessages(options?: { since?: Date; limit?: number }): Promise<SMSIncoming[]> {
    let results = Array.from(this.incoming.values());

    if (options?.since) {
      results = results.filter((m) => m.receivedAt >= options.since!);
    }

    results.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());

    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async processKeyword(from: PhoneNumber, keyword: string, originalMessageId?: string): Promise<void> {
    await this.keywordHandler.handleKeyword(from, keyword, originalMessageId);
  }

  async configureProvider(config: ProviderConfig): Promise<void> {
    this.providers.set(config.provider, config);
  }

  getProviderConfig(provider: SMSProvider): ProviderConfig | null {
    return this.providers.get(provider) || null;
  }

  async testConnection(provider: SMSProvider = 'twilio'): Promise<boolean> {
    const config = this.providers.get(provider);
    if (!config) {
      if (provider === 'twilio') {
        return true;
      }
      return false;
    }
    return true;
  }

  async updatePreferences(userId: string, phoneNumber: string, updates: Partial<SMSPreferences>): Promise<SMSPreferences> {
    const existing = this.preferences.get(userId);
    
    const preferences: SMSPreferences = {
      userId,
      phoneNumber,
      marketingEnabled: updates.marketingEnabled ?? existing?.marketingEnabled ?? false,
      transactionalEnabled: updates.transactionalEnabled ?? existing?.transactionalEnabled ?? true,
      verificationEnabled: updates.verificationEnabled ?? existing?.verificationEnabled ?? true,
      optedOutAt: updates.optedOutAt ?? existing?.optedOutAt,
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
      ...updates,
    };

    this.preferences.set(userId, preferences);
    return preferences;
  }

  async getPreferences(userId: string): Promise<SMSPreferences | null> {
    return this.preferences.get(userId) || null;
  }

  async optOut(phoneNumber: string, _reason?: string): Promise<void> {
    for (const [userId, prefs] of this.preferences) {
      if (prefs.phoneNumber === phoneNumber) {
        prefs.optedOutAt = new Date();
        prefs.marketingEnabled = false;
        prefs.transactionalEnabled = false;
        prefs.updatedAt = new Date();
        this.preferences.set(userId, prefs);
      }
    }
  }

  async isOptedOut(phoneNumber: string): Promise<boolean> {
    for (const [, prefs] of this.preferences) {
      if (prefs.phoneNumber === phoneNumber && prefs.optedOutAt) {
        return true;
      }
    }
    return false;
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

export function createSMSService(): SMSServiceImpl {
  return new SMSServiceImpl();
}

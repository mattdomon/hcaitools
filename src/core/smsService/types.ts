/**
 * SMS Service Types
 * Multi-provider SMS support with templates, queueing, and tracking
 */

export type SMSProvider = 'twilio' | 'vonage' | 'aws-sns';
export type SMSType = 'promotional' | 'transactional' | 'verification';
export type SMSDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';
export type QueuePriority = 'low' | 'normal' | 'high' | 'urgent';
export type SMSDirection = 'outbound' | 'inbound';
export type KeywordAction = 'stop' | 'start' | 'help' | 'unsubscribe';

export interface PhoneNumber {
  number: string;
  countryCode?: string;
  formatted?: string;
  type?: 'mobile' | 'landline' | 'voip' | 'unknown';
  isValid?: boolean;
}

export interface SMSMessage {
  messageId: string;
  from: PhoneNumber;
  to: PhoneNumber[];
  body: string;
  type: SMSType;
  provider: SMSProvider;
  status: SMSDeliveryStatus;
  direction: SMSDirection;
  priority: QueuePriority;
  metadata?: Record<string, unknown>;
  scheduledFor?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  undeliveredAt?: Date;
  deliveryTimeMs?: number;
  retryCount: number;
  maxRetries: number;
  segments: number;
  errorCode?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SMSTemplate {
  templateId: string;
  name: string;
  type: SMSType;
  body: string;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SMSQueueItem {
  queueId: string;
  message: SMSMessage;
  priority: QueuePriority;
  attempts: number;
  scheduledFor: Date;
  addedAt: Date;
  lastAttemptAt?: Date;
  error?: string;
}

export interface SMSDeliveryTracking {
  trackingId: string;
  messageId: string;
  status: SMSDeliveryStatus;
  sentAt: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  undeliveredAt?: Date;
  deliveryTimeMs?: number;
  providerResponse?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
}

export interface SMSIncoming {
  incomingId: string;
  from: PhoneNumber;
  to: PhoneNumber;
  body: string;
  provider: SMSProvider;
  receivedAt: Date;
  keywords: string[];
  metadata?: Record<string, unknown>;
}

export interface SMSWebhookPayload {
  messageId: string;
  status: SMSDeliveryStatus;
  provider: SMSProvider;
  timestamp: Date;
  errorCode?: string;
  errorMessage?: string;
  providerResponse?: Record<string, unknown>;
}

export interface SMSCallback {
  callbackId: string;
  messageId: string;
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  payload?: Record<string, unknown>;
  attempts: number;
  lastAttemptAt?: Date;
  responseCode?: number;
  responseBody?: string;
  createdAt: Date;
}

export interface SMSPreferences {
  userId: string;
  phoneNumber: string;
  marketingEnabled: boolean;
  transactionalEnabled: boolean;
  verificationEnabled: boolean;
  optedOutAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderConfig {
  provider: SMSProvider;
  settings: ProviderSettings;
}

export interface ProviderSettings {
  apiKey?: string;
  apiSecret?: string;
  accountSid?: string;
  authToken?: string;
  region?: string;
  fromNumber?: string;
  webhookUrl?: string;
  deliveryReportsEnabled?: boolean;
  maxSegments?: number;
  maxLength?: number;
}

export interface SendSMSOptions {
  from?: PhoneNumber;
  to: PhoneNumber[];
  body: string;
  type?: SMSType;
  provider?: SMSProvider;
  priority?: QueuePriority;
  metadata?: Record<string, unknown>;
  scheduledFor?: Date;
  deliveryCallbackUrl?: string;
}

export interface SMSQueryOptions {
  status?: SMSDeliveryStatus;
  type?: SMSType;
  provider?: SMSProvider;
  direction?: SMSDirection;
  from?: string;
  to?: string;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
  includeFailed?: boolean;
}

export interface SMSStats {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalUndelivered: number;
  deliveryRate: number;
  failureRate: number;
  byType: Record<SMSType, number>;
  byProvider: Record<SMSProvider, number>;
  averageDeliveryTimeMs: number;
}

export interface SMSService {
  send(options: SendSMSOptions): Promise<SMSMessage>;
  sendBatch(options: SendSMSOptions[]): Promise<SMSMessage[]>;
  sendToNumber(from: PhoneNumber, to: PhoneNumber, body: string, type?: SMSType): Promise<SMSMessage>;
  sendWithTemplate(templateId: string, to: PhoneNumber[], variables: Record<string, string>): Promise<SMSMessage>;
  sendVerification(phoneNumber: PhoneNumber, code: string): Promise<SMSMessage>;

  getMessage(messageId: string): Promise<SMSMessage | null>;
  queryMessages(options: SMSQueryOptions): Promise<SMSMessage[]>;
  getSMSStats(since?: Date): Promise<SMSStats>;

  retry(messageId: string): Promise<void>;
  cancel(messageId: string): Promise<void>;

  createTemplate(template: Omit<SMSTemplate, 'templateId' | 'createdAt' | 'updatedAt'>): Promise<SMSTemplate>;
  getTemplate(templateId: string): Promise<SMSTemplate | null>;
  updateTemplate(templateId: string, updates: Partial<SMSTemplate>): Promise<SMSTemplate>;
  deleteTemplate(templateId: string): Promise<void>;
  listTemplates(type?: SMSType): Promise<SMSTemplate[]>;

  processQueue(): Promise<void>;
  getQueueSize(priority?: QueuePriority): Promise<number>;
  clearQueue(): Promise<void>;

  recordDeliveryStatus(messageId: string, status: SMSDeliveryStatus, errorCode?: string, errorMessage?: string): Promise<void>;
  getDeliveryTracking(messageId: string): Promise<SMSDeliveryTracking | null>;
  handleDeliveryCallback(payload: SMSWebhookPayload): Promise<void>;

  handleIncomingSMS(incoming: SMSIncoming): Promise<void>;
  getIncomingMessages(options?: { since?: Date; limit?: number }): Promise<SMSIncoming[]>;
  processKeyword(from: PhoneNumber, keyword: string, originalMessageId?: string): Promise<void>;

  configureProvider(config: ProviderConfig): Promise<void>;
  getProviderConfig(provider: SMSProvider): ProviderConfig | null;
  testConnection(provider?: SMSProvider): Promise<boolean>;

  updatePreferences(userId: string, phoneNumber: string, updates: Partial<SMSPreferences>): Promise<SMSPreferences>;
  getPreferences(userId: string): Promise<SMSPreferences | null>;
  optOut(phoneNumber: string, reason?: string): Promise<void>;
  isOptedOut(phoneNumber: string): Promise<boolean>;
}

export interface TemplateRenderer {
  render(template: string, variables: Record<string, string>): string;
  validateTemplate(template: string, variables: string[]): { valid: boolean; missingVariables: string[] };
  extractVariables(template: string): string[];
}

export interface QueueManager {
  add(message: SMSMessage, priority: QueuePriority): Promise<SMSQueueItem>;
  addBatch(messages: SMSMessage[], priority: QueuePriority): Promise<SMSQueueItem[]>;
  getNext(): Promise<SMSQueueItem | null>;
  getByPriority(priority: QueuePriority): Promise<SMSQueueItem[]>;
  markProcessing(queueId: string): Promise<void>;
  markCompleted(queueId: string): Promise<void>;
  markFailed(queueId: string, error: string): Promise<void>;
  remove(queueId: string): Promise<void>;
  clear(): Promise<void>;
  size(): number;
}

export interface DeliveryStatusHandler {
  handleStatusUpdate(payload: SMSWebhookPayload): Promise<void>;
  categorizeError(errorCode: string): { category: string; shouldRetry: boolean };
}

export interface KeywordHandler {
  handleKeyword(from: PhoneNumber, keyword: string, originalMessageId?: string): Promise<void>;
  extractKeywords(messageBody: string): string[];
}

export interface PhoneNumberValidator {
  validate(phoneNumber: string): { valid: boolean; formatted?: string; type?: PhoneNumber['type']; countryCode?: string };
  format(phoneNumber: string, countryCode?: string): string;
  isMobile(phoneNumber: string): boolean;
  isVoip(phoneNumber: string): boolean;
}

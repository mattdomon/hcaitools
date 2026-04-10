/**
 * Email Service Types
 * SMTP and API provider support with templates, queueing, and tracking
 */

export type EmailProvider = 'smtp' | 'sendgrid' | 'mailgun' | 'aws-ses';
export type EmailType = 'transactional' | 'marketing' | 'notifications';
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'bounced' | 'failed';
export type QueuePriority = 'low' | 'normal' | 'high' | 'urgent';
export type BounceType = 'hard' | 'soft';
export type BounceCategory = 'invalid' | 'domain' | 'no-mailbox' | 'full' | 'spam' | 'auto-reply' | 'other';

export interface Attachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
  contentId?: string;
  disposition?: 'attachment' | 'inline';
}

export interface InlineImage {
  contentId: string;
  content: Buffer | string;
  contentType: string;
}

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailHeader {
  key: string;
  value: string;
}

export interface Email {
  emailId: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  body: string;
  bodyHtml?: string;
  attachments: Attachment[];
  inlineImages: InlineImage[];
  headers: EmailHeader[];
  type: EmailType;
  provider: EmailProvider;
  status: DeliveryStatus;
  priority: QueuePriority;
  metadata?: Record<string, unknown>;
  scheduledFor?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  bouncedAt?: Date;
  failedAt?: Date;
  bounceReason?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailTemplate {
  templateId: string;
  name: string;
  type: EmailType;
  subject: string;
  body: string;
  bodyHtml?: string;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailQueueItem {
  queueId: string;
  email: Email;
  priority: QueuePriority;
  attempts: number;
  scheduledFor: Date;
  addedAt: Date;
  lastAttemptAt?: Date;
  error?: string;
}

export interface EmailDeliveryTracking {
  trackingId: string;
  emailId: string;
  status: DeliveryStatus;
  sentAt: Date;
  deliveredAt?: Date;
  bouncedAt?: Date;
  failedAt?: Date;
  deliveryTimeMs?: number;
  bounceType?: BounceType;
  bounceCategory?: BounceCategory;
  bounceMessage?: string;
  providerResponse?: Record<string, unknown>;
}

export interface BounceRecord {
  bounceId: string;
  emailId: string;
  bounceType: BounceType;
  category: BounceCategory;
  email: string;
  timestamp: Date;
  provider: EmailProvider;
  details?: string;
}

export interface UnsubscribeRecord {
  unsubscribeId: string;
  email: string;
  listId?: string;
  unsubscribedAt: Date;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailPreferences {
  userId: string;
  email: string;
  marketingEnabled: boolean;
  notificationsEnabled: boolean;
  frequency?: 'realtime' | 'daily' | 'weekly';
  categories: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderConfig {
  provider: EmailProvider;
  settings: ProviderSettings;
}

export interface ProviderSettings {
  apiKey?: string;
  apiSecret?: string;
  region?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  fromEmail?: string;
  fromName?: string;
  webhookUrl?: string;
  trackingEnabled?: boolean;
  openTrackingEnabled?: boolean;
  clickTrackingEnabled?: boolean;
}

export interface SendEmailOptions {
  from?: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  body: string;
  bodyHtml?: string;
  attachments?: Attachment[];
  inlineImages?: InlineImage[];
  headers?: EmailHeader[];
  type?: EmailType;
  provider?: EmailProvider;
  priority?: QueuePriority;
  metadata?: Record<string, unknown>;
  scheduledFor?: Date;
}

export interface EmailQueryOptions {
  status?: DeliveryStatus;
  type?: EmailType;
  provider?: EmailProvider;
  from?: string;
  to?: string;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
  includeBounced?: boolean;
}

export interface EmailStats {
  totalSent: number;
  totalDelivered: number;
  totalBounced: number;
  totalFailed: number;
  deliveryRate: number;
  bounceRate: number;
  byType: Record<EmailType, number>;
  byProvider: Record<EmailProvider, number>;
  averageDeliveryTimeMs: number;
}

export interface EmailService {
  send(options: SendEmailOptions): Promise<Email>;
  sendBatch(options: SendEmailOptions[]): Promise<Email[]>;
  sendToAddress(from: EmailAddress, to: EmailAddress, subject: string, body: string, bodyHtml?: string): Promise<Email>;
  sendWithTemplate(templateId: string, to: EmailAddress[], variables: Record<string, string>): Promise<Email>;

  getEmail(emailId: string): Promise<Email | null>;
  queryEmails(options: EmailQueryOptions): Promise<Email[]>;
  getEmailStats(since?: Date): Promise<EmailStats>;

  retry(emailId: string): Promise<void>;
  cancel(emailId: string): Promise<void>;

  createTemplate(template: Omit<EmailTemplate, 'templateId' | 'createdAt' | 'updatedAt'>): Promise<EmailTemplate>;
  getTemplate(templateId: string): Promise<EmailTemplate | null>;
  updateTemplate(templateId: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate>;
  deleteTemplate(templateId: string): Promise<void>;
  listTemplates(type?: EmailType): Promise<EmailTemplate[]>;

  processQueue(): Promise<void>;
  getQueueSize(priority?: QueuePriority): Promise<number>;
  clearQueue(): Promise<void>;

  recordBounce(emailId: string, bounceType: BounceType, category: BounceCategory, details?: string): Promise<BounceRecord>;
  getBounces(emailId: string): Promise<BounceRecord[]>;
  handleBounce(bounceData: unknown): Promise<void>;

  unsubscribe(email: string, listId?: string, reason?: string): Promise<UnsubscribeRecord>;
  isUnsubscribed(email: string, listId?: string): Promise<boolean>;
  handleUnsubscribe(unsubscribeData: unknown): Promise<void>;

  getDeliveryTracking(emailId: string): Promise<EmailDeliveryTracking | null>;
  trackDelivery(emailId: string): Promise<void>;

  configureProvider(config: ProviderConfig): Promise<void>;
  getProviderConfig(provider: EmailProvider): ProviderConfig | null;
  testConnection(provider?: EmailProvider): Promise<boolean>;
}

export interface TemplateRenderer {
  render(template: string, variables: Record<string, string>): string;
  validateTemplate(template: string, variables: string[]): { valid: boolean; missingVariables: string[] };
  extractVariables(template: string): string[];
}

export interface QueueManager {
  add(email: Email, priority: QueuePriority): Promise<EmailQueueItem>;
  addBatch(emails: Email[], priority: QueuePriority): Promise<EmailQueueItem[]>;
  getNext(): Promise<EmailQueueItem | null>;
  getByPriority(priority: QueuePriority): Promise<EmailQueueItem[]>;
  markProcessing(queueId: string): Promise<void>;
  markCompleted(queueId: string): Promise<void>;
  markFailed(queueId: string, error: string): Promise<void>;
  remove(queueId: string): Promise<void>;
  clear(): Promise<void>;
  size(): number;
}

export interface BounceHandler {
  handleBounce(bounceData: unknown): Promise<BounceRecord>;
  categorizeBounce(bounceData: unknown): { type: BounceType; category: BounceCategory; details?: string };
  shouldReschedule(email: Email, bounceType: BounceType): boolean;
}

export interface UnsubscribeHandler {
  handleUnsubscribe(unsubscribeData: unknown): Promise<UnsubscribeRecord>;
  isListUnsubscribe(unsubscribeData: unknown): boolean;
  getListId(unsubscribeData: unknown): string | undefined;
}

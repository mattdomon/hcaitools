export type AuditEventType = 'data_access' | 'data_modification' | 'security_event' | 'compliance';

export type ComplianceFramework = 'GDPR' | 'HIPAA' | 'SOC2' | 'PCI-DSS';

export type RetentionPolicy = 'permanent' | 'short_term' | 'long_term';

export type ReportType = 'access_history' | 'change_log' | 'security_events';

export type DataSubjectRight = 'access' | 'rectification' | 'erasure' | 'portability';

export interface AuditEvent {
  id: string;
  eventType: AuditEventType;
  timestamp?: Date;
  userId?: string;
  sessionId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  framework?: ComplianceFramework;
  dataCategory?: string;
  retentionPolicy?: RetentionPolicy;
}

export interface AuditFilter {
  eventTypes?: AuditEventType[];
  startTime?: Date;
  endTime?: Date;
  userId?: string;
  sessionId?: string;
  resourceType?: string;
  resourceId?: string;
  success?: boolean;
  framework?: ComplianceFramework;
  dataCategory?: string;
}

export interface AuditStats {
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  eventsByUser: Record<string, number>;
  eventsByResource: Record<string, number>;
  successRate: number;
  failedEvents: number;
  startTime: Date;
  endTime: Date;
}

export interface RetentionRule {
  id: string;
  name: string;
  retentionPeriodDays: number;
  framework?: ComplianceFramework;
  dataCategories: string[];
  includeMetadata: boolean;
  encryptionRequired: boolean;
}

export interface ComplianceReport {
  id: string;
  reportType: ReportType;
  framework: ComplianceFramework;
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  summary: Record<string, unknown>;
  details: AuditEvent[];
  metadata: Record<string, unknown>;
}

export interface DataSubjectRequest {
  id: string;
  right: DataSubjectRight;
  requesterId: string;
  requesterEmail: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requestedAt: Date;
  completedAt?: Date;
  dataTypes: string[];
  notes?: string;
}

export interface AccessRecord {
  id: string;
  userId: string;
  resourceType: string;
  resourceId: string;
  accessType: 'read' | 'write' | 'delete' | 'execute';
  accessedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}

export interface ComplianceConfig {
  enableAutoRetention: boolean;
  retentionCheckIntervalMs: number;
  maxEventsBeforeFlush: number;
  encryptionEnabled: boolean;
  defaultRetentionDays: number;
  frameworks: ComplianceFramework[];
  enableRealTimeMonitoring: boolean;
  alertThresholds: AlertThreshold;
}

export interface AlertThreshold {
  maxEventsPerMinute: number;
  maxFailedAuthPerMinute: number;
  maxDataAccessPerUser: number;
}

export const DEFAULT_COMPLIANCE_CONFIG: ComplianceConfig = {
  enableAutoRetention: true,
  retentionCheckIntervalMs: 3600000,
  maxEventsBeforeFlush: 100,
  encryptionEnabled: false,
  defaultRetentionDays: 90,
  frameworks: ['GDPR', 'HIPAA', 'SOC2', 'PCI-DSS'],
  enableRealTimeMonitoring: true,
  alertThresholds: {
    maxEventsPerMinute: 1000,
    maxFailedAuthPerMinute: 10,
    maxDataAccessPerUser: 500,
  },
};

export const COMPLIANCE_ERROR_CODES = {
  AUDIT_NOT_FOUND: 'AUDIT_NOT_FOUND',
  RETENTION_VIOLATION: 'RETENTION_VIOLATION',
  COMPLIANCE_BREACH: 'COMPLIANCE_BREACH',
  DATA_SUBJECT_REQUEST_FAILED: 'DATA_SUBJECT_REQUEST_FAILED',
  REPORT_GENERATION_FAILED: 'REPORT_GENERATION_FAILED',
  FRAMEWORK_NOT_SUPPORTED: 'FRAMEWORK_NOT_SUPPORTED',
  INVALID_FILTER: 'INVALID_FILTER',
  EVENT_ENCRYPTION_FAILED: 'EVENT_ENCRYPTION_FAILED',
} as const;

export interface AuditError extends Error {
  code: (typeof COMPLIANCE_ERROR_CODES)[keyof typeof COMPLIANCE_ERROR_CODES];
  originalError?: Error;
}

export function isAuditEventType(value: unknown): value is AuditEventType {
  return typeof value === 'string' && ['data_access', 'data_modification', 'security_event', 'compliance'].includes(value as AuditEventType);
}

export function isComplianceFramework(value: unknown): value is ComplianceFramework {
  return typeof value === 'string' && ['GDPR', 'HIPAA', 'SOC2', 'PCI-DSS'].includes(value as ComplianceFramework);
}

export function isRetentionPolicy(value: unknown): value is RetentionPolicy {
  return typeof value === 'string' && ['permanent', 'short_term', 'long_term'].includes(value as RetentionPolicy);
}

export function isReportType(value: unknown): value is ReportType {
  return typeof value === 'string' && ['access_history', 'change_log', 'security_events'].includes(value as ReportType);
}

export function isDataSubjectRight(value: unknown): value is DataSubjectRight {
  return typeof value === 'string' && ['access', 'rectification', 'erasure', 'portability'].includes(value as DataSubjectRight);
}

export function generateAuditId(prefix: string = 'AUDIT'): string {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return `${prefix}_${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

export function getRetentionDays(policy: RetentionPolicy): number {
  switch (policy) {
    case 'permanent':
      return -1;
    case 'short_term':
      return 30;
    case 'long_term':
      return 365 * 7;
    default:
      return 90;
  }
}

export function isRetentionExpired(event: AuditEvent, retentionDays: number): boolean {
  if (retentionDays === -1) {
    return false;
  }
  const timestamp = event.timestamp || new Date();
  const cutoffDate = new Date(timestamp.getTime() + retentionDays * 24 * 60 * 60 * 1000);
  return new Date() > cutoffDate;
}

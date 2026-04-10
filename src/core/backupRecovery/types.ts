export type BackupType = 'full' | 'incremental' | 'differential';

export type BackupStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type StorageDestination = 'local' | 's3' | 'google_cloud' | 'azure';

export type RetentionPolicyType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type RecoveryStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface BackupSchedule {
  id: string;
  name: string;
  cronExpression: string;
  backupType: BackupType;
  retentionPolicy: RetentionPolicyType;
  retentionDays: number;
  enabled: boolean;
  destination: StorageDestination;
  destinationPath: string;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  includeMetadata: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Backup {
  id: string;
  scheduleId?: string;
  type: BackupType;
  status: BackupStatus;
  size: number;
  sizeBytes: number;
  compressedSizeBytes?: number;
  encryptedSizeBytes?: number;
  checksum?: string;
  encryptionAlgorithm?: string;
  sourcePath: string;
  destination: StorageDestination;
  destinationPath: string;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  errorMessage?: string;
  recoveryPointId?: string;
  metadata?: Record<string, unknown>;
  parentBackupId?: string;
  incrementalChangesCount?: number;
  compressionEnabled?: boolean;
  encryptionEnabled?: boolean;
}

export interface RecoveryPoint {
  id: string;
  backupId: string;
  timestamp: Date;
  type: BackupType;
  size: number;
  checksum: string;
  isCompressed: boolean;
  isEncrypted: boolean;
  encryptionAlgorithm?: string;
  retentionUntil?: Date;
  metadata?: Record<string, unknown>;
  dependencies?: string[];
}

export interface RecoveryRequest {
  id: string;
  recoveryPointId: string;
  targetPath: string;
  status: RecoveryStatus;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  dataRestored: number;
  dataRestoredBytes: number;
  errorMessage?: string;
  verificationStatus?: 'pending' | 'verified' | 'failed';
  metadata?: Record<string, unknown>;
}

export interface RetentionRule {
  id: string;
  name: string;
  policyType: RetentionPolicyType;
  retentionDays: number;
  backupTypes: BackupType[];
  destinations: StorageDestination[];
  enabled: boolean;
  applyToEncryptedBackups: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface StorageConfig {
  destination: StorageDestination;
  localPath?: string;
  s3?: S3Config;
  googleCloud?: GoogleCloudConfig;
  azure?: AzureConfig;
}

export interface S3Config {
  bucket: string;
  region: string;
  prefix?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  serverSideEncryption?: boolean;
}

export interface GoogleCloudConfig {
  bucket: string;
  projectId: string;
  prefix?: string;
  serviceAccountKeyPath?: string;
  serviceAccountKeyJson?: string;
  storageClass?: string;
}

export interface AzureConfig {
  container: string;
  accountName: string;
  accountKey?: string;
  prefix?: string;
  sasToken?: string;
  storageAccountUrl?: string;
}

export interface BackupEncryption {
  algorithm: 'AES-256-GCM' | 'AES-256-CBC' | 'AES-128-GCM';
  keyId?: string;
  encryptedKey?: string;
  iv?: string;
  authTag?: string;
}

export interface BackupCompression {
  algorithm: 'gzip' | 'zstd' | 'lz4' | 'none';
  level?: number;
  originalSize: number;
  compressedSize: number;
  ratio?: number;
}

export interface RPOConfig {
  targetMinutes: number;
  actualMinutes?: number;
  lastBackupAt?: Date;
  nextScheduledBackup?: Date;
  isWithinTarget: boolean;
  violations: string[];
}

export interface BackupStats {
  totalBackups: number;
  completedBackups: number;
  failedBackups: number;
  runningBackups: number;
  pendingBackups: number;
  totalSizeBytes: number;
  compressedSizeBytes: number;
  averageCompressionRatio: number;
  averageBackupDurationMs: number;
  successRate: number;
  lastSuccessfulBackup?: Date;
  lastFailedBackup?: Date;
  byType: Record<BackupType, number>;
  byDestination: Record<StorageDestination, number>;
}

export interface DisasterRecoveryPlan {
  id: string;
  name: string;
  description: string;
  rpoMinutes: number;
  rtoMinutes: number;
  backupSchedules: string[];
  recoveryPointIds: string[];
  fallbackDestinations: StorageDestination[];
  lastTestAt?: Date;
  lastTestResult?: 'success' | 'failed' | 'never_tested';
  createdAt: Date;
  updatedAt: Date;
}

export interface FailoverConfig {
  enabled: boolean;
  primaryRegion?: string;
  fallbackRegion?: string;
  automaticFailover: boolean;
  healthCheckIntervalMs: number;
  failureThreshold: number;
  recoveryTimeoutMs: number;
}

export interface BackupVerification {
  id: string;
  backupId: string;
  verificationType: 'checksum' | 'restore_test' | 'metadata' | 'integrity';
  status: 'passed' | 'failed' | 'pending';
  verifiedAt?: Date;
  errorMessage?: string;
  details?: Record<string, unknown>;
}

export interface BackupNotification {
  id: string;
  backupId?: string;
  scheduleId?: string;
  type: 'success' | 'failure' | 'warning' | 'info';
  title: string;
  message: string;
  sentAt: Date;
  recipient?: string;
  metadata?: Record<string, unknown>;
}

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  defaultRetentionDays: 30,
  defaultCompressionEnabled: true,
  defaultCompressionAlgorithm: 'gzip',
  defaultEncryptionEnabled: false,
  defaultEncryptionAlgorithm: 'AES-256-GCM',
  defaultStorageDestination: 'local',
  maxBackupSizeBytes: 10 * 1024 * 1024 * 1024,
  backupCheckIntervalMs: 60000,
  enableParallelBackups: true,
  maxParallelBackups: 3,
  verifyBackupsAfterCreation: true,
  defaultRPO: 60,
};

export interface BackupConfig {
  defaultRetentionDays: number;
  defaultCompressionEnabled: boolean;
  defaultCompressionAlgorithm: 'gzip' | 'zstd' | 'lz4' | 'none';
  defaultEncryptionEnabled: boolean;
  defaultEncryptionAlgorithm: 'AES-256-GCM' | 'AES-256-CBC' | 'AES-128-GCM';
  defaultStorageDestination: StorageDestination;
  maxBackupSizeBytes: number;
  backupCheckIntervalMs: number;
  enableParallelBackups: boolean;
  maxParallelBackups: number;
  verifyBackupsAfterCreation: boolean;
  defaultRPO: number;
}

export const BACKUP_ERROR_CODES = {
  BACKUP_NOT_FOUND: 'BACKUP_NOT_FOUND',
  BACKUP_FAILED: 'BACKUP_FAILED',
  BACKUP_CANCELLED: 'BACKUP_CANCELLED',
  RECOVERY_FAILED: 'RECOVERY_FAILED',
  RECOVERY_POINT_NOT_FOUND: 'RECOVERY_POINT_NOT_FOUND',
  INVALID_SCHEDULE: 'INVALID_SCHEDULE',
  STORAGE_ERROR: 'STORAGE_ERROR',
  ENCRYPTION_ERROR: 'ENCRYPTION_ERROR',
  DECRYPTION_ERROR: 'DECRYPTION_ERROR',
  COMPRESSION_ERROR: 'COMPRESSION_ERROR',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  RETENTION_VIOLATION: 'RETENTION_VIOLATION',
  INVALID_CONFIG: 'INVALID_CONFIG',
  DESTINATION_UNREACHABLE: 'DESTINATION_UNREACHABLE',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  CONCURRENT_BACKUP_LIMIT: 'CONCURRENT_BACKUP_LIMIT',
} as const;

export interface BackupError extends Error {
  code: (typeof BACKUP_ERROR_CODES)[keyof typeof BACKUP_ERROR_CODES];
  backupId?: string;
  originalError?: Error;
}

function generateRandomId(prefix: string): string {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return `${prefix}_${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

export function generateBackupId(prefix: string = 'BACKUP'): string {
  return generateRandomId(prefix);
}

export function generateScheduleId(prefix: string = 'SCHED'): string {
  return generateRandomId(prefix);
}

export function generateRecoveryPointId(prefix: string = 'RP'): string {
  return generateRandomId(prefix);
}

export function generateRecoveryRequestId(prefix: string = 'REC'): string {
  return generateRandomId(prefix);
}

export function generateRetentionRuleId(prefix: string = 'RET'): string {
  return generateRandomId(prefix);
}

export function isBackupType(value: unknown): value is BackupType {
  return typeof value === 'string' && ['full', 'incremental', 'differential'].includes(value as BackupType);
}

export function isBackupStatus(value: unknown): value is BackupStatus {
  return typeof value === 'string' && ['pending', 'running', 'completed', 'failed', 'cancelled'].includes(value as BackupStatus);
}

export function isStorageDestination(value: unknown): value is StorageDestination {
  return typeof value === 'string' && ['local', 's3', 'google_cloud', 'azure'].includes(value as StorageDestination);
}

export function isRetentionPolicyType(value: unknown): value is RetentionPolicyType {
  return typeof value === 'string' && ['daily', 'weekly', 'monthly', 'yearly'].includes(value as RetentionPolicyType);
}

export function isRecoveryStatus(value: unknown): value is RecoveryStatus {
  return typeof value === 'string' && ['pending', 'in_progress', 'completed', 'failed'].includes(value as RecoveryStatus);
}

export function calculateCompressionRatio(original: number, compressed: number): number {
  if (original === 0) return 0;
  return Number(((1 - compressed / original) * 100).toFixed(2));
}

export function calculateRPOStatus(rpoConfig: RPOConfig): { withinTarget: boolean; driftMinutes: number } {
  if (!rpoConfig.lastBackupAt || !rpoConfig.targetMinutes) {
    return { withinTarget: true, driftMinutes: 0 };
  }
  const minutesSinceLastBackup = (Date.now() - rpoConfig.lastBackupAt.getTime()) / 60000;
  const driftMinutes = minutesSinceLastBackup - rpoConfig.targetMinutes;
  return {
    withinTarget: driftMinutes <= 0,
    driftMinutes: Math.max(0, driftMinutes),
  };
}

export function getRetentionPolicyDays(policy: RetentionPolicyType): number {
  switch (policy) {
    case 'daily':
      return 1;
    case 'weekly':
      return 7;
    case 'monthly':
      return 30;
    case 'yearly':
      return 365;
    default:
      return 30;
  }
}

export function isRecoveryPointExpired(point: RecoveryPoint, _retentionDays: number): boolean {
  if (!point.retentionUntil) {
    return false;
  }
  return new Date() > point.retentionUntil;
}

export function formatBackupSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export function validateChecksum(backup: Backup, expectedChecksum: string): boolean {
  return backup.checksum === expectedChecksum;
}

export function isValidCronExpression(expression: string): boolean {
  const parts = expression.split(' ');
  if (parts.length !== 5) return false;
  const validPart = (part: string, max: number): boolean => {
    if (part === '*') return true;
    if (part.includes('/')) {
      const [range, step] = part.split('/');
      if (range !== '*' && !validateNumberRange(range, 0, max)) return false;
      return !isNaN(parseInt(step, 10));
    }
    if (part.includes(',')) {
      return part.split(',').every((p) => validateNumberRange(p.trim(), 0, max));
    }
    if (part.includes('-')) {
      const [start, end] = part.split('-');
      return validateNumberRange(start.trim(), 0, max) && validateNumberRange(end.trim(), 0, max);
    }
    return validateNumberRange(part, 0, max);
  };
  return (
    validPart(parts[0], 59) &&
    validPart(parts[1], 59) &&
    validPart(parts[2], 31) &&
    validPart(parts[3], 12) &&
    validPart(parts[4], 7)
  );
}

function validateNumberRange(value: string, min: number, max: number): boolean {
  const num = parseInt(value, 10);
  return !isNaN(num) && num >= min && num <= max;
}

/**
 * Logging & Monitoring System Types
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type LogStorageType = 'memory' | 'file' | 'database';

export type LogRotationType = 'size' | 'time' | 'both';

export type MetricType = 'response_time' | 'cpu' | 'memory' | 'requests' | 'custom';

export type AlertType = 'threshold' | 'anomaly';

export type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  source: string;
  metadata?: Record<string, unknown>;
  stack?: string;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  duration?: number;
  error?: LogErrorDetail;
}

export interface LogErrorDetail {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  cause?: string;
}

export interface LogFilter {
  levels?: LogLevel[];
  sources?: string[];
  startTime?: Date;
  endTime?: Date;
  searchText?: string;
  correlationId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface LogConfig {
  storageType: LogStorageType;
  defaultLevel: LogLevel;
  maxMemoryLogs: number;
  filePath?: string;
  databaseUrl?: string;
  flushIntervalMs?: number;
  enableConsole?: boolean;
  enableFile?: boolean;
  enableDatabase?: boolean;
  keyPrefix?: string;
}

export interface LogRotationConfig {
  type: LogRotationType;
  maxSizeBytes?: number;
  maxFiles?: number;
  maxAgeMs?: number;
  rotateIntervalMs?: number;
  compressOldLogs?: boolean;
}

export interface LogStats {
  totalLogs: number;
  logsByLevel: Record<LogLevel, number>;
  logsBySource: Record<string, number>;
  averageLogSize: number;
  totalSizeBytes: number;
  oldestLogTimestamp?: Date;
  newestLogTimestamp?: Date;
  startTime: Date;
  lastResetTime: Date;
}

export interface MetricValue {
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  unit?: string;
  timestamp: Date;
  labels?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface MetricsSnapshot {
  responseTime: Metric;
  cpu: Metric;
  memory: Metric;
  requests: Metric;
  custom: Record<string, Metric>;
  timestamp: Date;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  memoryTotal: number;
  memoryUsed: number;
  uptime: number;
  timestamp: Date;
}

export interface AlertConfig {
  name: string;
  type: AlertType;
  metric: string;
  threshold?: number;
  anomalyThreshold?: number;
  timeWindowMs?: number;
  severity: AlertSeverity;
  enabled: boolean;
  cooldownMs?: number;
  notificationChannels?: string[];
}

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Alert {
  id: string;
  name: string;
  type: AlertType;
  severity: AlertSeverity;
  metric: string;
  value: number;
  threshold?: number;
  message: string;
  triggeredAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  status: AlertStatus;
  metadata?: Record<string, unknown>;
}

export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface AlertNotification {
  alertId: string;
  channel: string;
  sentAt: Date;
  success: boolean;
  error?: string;
}

export interface LogAggregation {
  count: number;
  level: LogLevel;
  source: string;
  timeBucket: Date;
  avgDuration?: number;
  errorRate?: number;
}

export interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  labels?: Record<string, string>;
}

export interface TimeSeries {
  metric: string;
  dataPoints: TimeSeriesDataPoint[];
  intervalMs: number;
}

export interface LogSearchResult {
  logs: LogEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  searchTimeMs: number;
}

export interface LogQueryOptions {
  filter: LogFilter;
  page?: number;
  pageSize?: number;
  sortBy?: 'timestamp' | 'level' | 'source';
  sortOrder?: 'asc' | 'desc';
}

export interface HealthCheckResult {
  healthy: boolean;
  storageConnected: boolean;
  latencyMs: number;
  errors: string[];
  metrics?: SystemMetrics;
}

export interface LogRetentionPolicy {
  maxAgeMs?: number;
  maxLogs?: number;
  minFreeSpaceBytes?: number;
  archivePath?: string;
  compressBeforeDelete?: boolean;
}

export interface LogExporter {
  export(logs: LogEntry[], format: 'json' | 'csv' | 'xml'): Promise<string>;
  import(data: string, format: 'json' | 'csv' | 'xml'): Promise<LogEntry[]>;
}

export interface PerformanceMonitorConfig {
  enabled: boolean;
  sampleRate: number;
  trackResponseTime: boolean;
  trackCpu: boolean;
  trackMemory: boolean;
  trackRequests: boolean;
  slowRequestThresholdMs?: number;
}

export interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  requestsPerSecond: number;
  timestamp: Date;
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  score: number;
  expectedValue: number;
  actualValue: number;
  deviation: number;
  timestamp: Date;
}

export interface LogEvent {
  type: 'log' | 'flush' | 'rotate' | 'clear' | 'export';
  entry?: LogEntry;
  count?: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface LogEventEmitter {
  on(event: LogEvent['type'], handler: (event: LogEvent) => void): void;
  off(event: LogEvent['type'], handler: (event: LogEvent) => void): void;
  emit(event: LogEvent): void;
}

export interface SerializedLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  source: string;
  metadata?: Record<string, unknown>;
  stack?: string;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  duration?: number;
  error?: LogErrorDetail;
}

export interface LogSnapshot {
  entries: SerializedLogEntry[];
  stats: LogStats;
  timestamp: Date;
  version: string;
}

export const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];

export const LOG_LEVEL_PRIORITIES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

export const DEFAULT_LOG_CONFIG: LogConfig = {
  storageType: 'memory',
  defaultLevel: 'info',
  maxMemoryLogs: 10000,
  flushIntervalMs: 5000,
  enableConsole: true,
  enableFile: false,
  enableDatabase: false,
  keyPrefix: 'log:',
};

export const DEFAULT_ROTATION_CONFIG: LogRotationConfig = {
  type: 'size',
  maxSizeBytes: 100 * 1024 * 1024,
  maxFiles: 10,
  compressOldLogs: true,
};

export const DEFAULT_LOG_RETENTION: LogRetentionPolicy = {
  maxAgeMs: 7 * 24 * 60 * 60 * 1000,
  maxLogs: 50000,
};

export const LOG_ERROR_CODES = {
  LOG_NOT_FOUND: 'LOG_NOT_FOUND',
  OPERATION_FAILED: 'LOG_OPERATION_FAILED',
  SERIALIZATION_ERROR: 'LOG_SERIALIZATION_ERROR',
  DESERIALIZATION_ERROR: 'LOG_DESERIALIZATION_ERROR',
  STORAGE_ERROR: 'LOG_STORAGE_ERROR',
  ROTATION_FAILED: 'LOG_ROTATION_FAILED',
  EXPORT_FAILED: 'LOG_EXPORT_FAILED',
  IMPORT_FAILED: 'LOG_IMPORT_FAILED',
  INVALID_CONFIG: 'LOG_INVALID_CONFIG',
  ALERT_FAILED: 'LOG_ALERT_FAILED',
} as const;

export interface LogError extends Error {
  code: (typeof LOG_ERROR_CODES)[keyof typeof LOG_ERROR_CODES];
  logId?: string;
  originalError?: Error;
}

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && LOG_LEVELS.includes(value as LogLevel);
}

export function isAlertStatus(value: unknown): value is AlertStatus {
  return typeof value === 'string' && ['active', 'acknowledged', 'resolved'].includes(value as AlertStatus);
}

export function isAlertSeverity(value: unknown): value is AlertSeverity {
  return typeof value === 'string' && ['low', 'medium', 'high', 'critical'].includes(value as AlertSeverity);
}

export function isMetricType(value: unknown): value is MetricType {
  return typeof value === 'string' && ['response_time', 'cpu', 'memory', 'requests', 'custom'].includes(value as MetricType);
}

export function generateLogId(prefix: string = 'LOG'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${random}`;
}

export function serializeLogEntry(entry: LogEntry): SerializedLogEntry {
  return {
    ...entry,
    timestamp: entry.timestamp.toISOString(),
  };
}

export function deserializeLogEntry(data: SerializedLogEntry): LogEntry {
  return {
    ...data,
    timestamp: new Date(data.timestamp),
  };
}

export function formatLogMessage(entry: LogEntry): string {
  const timestamp = entry.timestamp.toISOString();
  const level = entry.level.toUpperCase().padEnd(5);
  const source = entry.source.padEnd(20);
  let message = `[${timestamp}] ${level} [${source}] ${entry.message}`;
  
  if (entry.correlationId) {
    message += ` [corr:${entry.correlationId}]`;
  }
  
  if (entry.duration !== undefined) {
    message += ` [${entry.duration}ms]`;
  }
  
  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    message += ` ${JSON.stringify(entry.metadata)}`;
  }
  
  if (entry.stack) {
    message += `\n${entry.stack}`;
  }
  
  return message;
}

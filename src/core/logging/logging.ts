/**
 * Logging & Monitoring System Implementation
 */

import {
  LogLevel,
  LogEntry,
  LogFilter,
  LogConfig,
  LogRotationConfig,
  LogStats,
  MetricValue,
  Alert,
  AlertConfig,
  AlertNotification,
  LogAggregation,
  TimeSeries,
  TimeSeriesDataPoint,
  LogSearchResult,
  LogQueryOptions,
  HealthCheckResult,
  LogRetentionPolicy,
  PerformanceMonitorConfig,
  PerformanceMetrics,
  AnomalyDetectionResult,
  LogEvent,
  LogEventEmitter,
  LogSnapshot,
  SerializedLogEntry,
  LOG_LEVEL_PRIORITIES,
  DEFAULT_LOG_CONFIG,
  DEFAULT_ROTATION_CONFIG,
  DEFAULT_LOG_RETENTION,
  generateLogId,
  serializeLogEntry,
  deserializeLogEntry,
  formatLogMessage,
} from './types';

type LogEventHandler = (event: LogEvent) => void;

export class SimpleEventEmitter implements LogEventEmitter {
  private handlers: Map<string, Set<LogEventHandler>> = new Map();

  on(event: LogEvent['type'], handler: LogEventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: LogEvent['type'], handler: LogEventHandler): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler);
    }
  }

  emit(event: LogEvent): void {
    const eventHandlers = this.handlers.get(event.type);
    if (eventHandlers) {
      eventHandlers.forEach((handler) => handler(event));
    }
  }

  removeAllListeners(): void {
    this.handlers.clear();
  }
}

export class InMemoryLogStorage {
  private logs: LogEntry[] = [];
  private maxLogs: number;

  constructor(maxLogs: number = 10000) {
    this.maxLogs = maxLogs;
  }

  add(entry: LogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  getAll(): LogEntry[] {
    return [...this.logs];
  }

  getFiltered(filter: LogFilter): LogEntry[] {
    return this.logs.filter((entry) => {
      if (filter.levels && filter.levels.length > 0) {
        if (!filter.levels.includes(entry.level)) {
          return false;
        }
      }

      if (filter.sources && filter.sources.length > 0) {
        if (!filter.sources.includes(entry.source)) {
          return false;
        }
      }

      if (filter.startTime) {
        if (entry.timestamp < filter.startTime) {
          return false;
        }
      }

      if (filter.endTime) {
        if (entry.timestamp > filter.endTime) {
          return false;
        }
      }

      if (filter.searchText) {
        const searchLower = filter.searchText.toLowerCase();
        if (!entry.message.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      if (filter.correlationId) {
        if (entry.correlationId !== filter.correlationId) {
          return false;
        }
      }

      if (filter.userId) {
        if (entry.userId !== filter.userId) {
          return false;
        }
      }

      if (filter.metadata) {
        for (const [key, value] of Object.entries(filter.metadata)) {
          if (entry.metadata?.[key] !== value) {
            return false;
          }
        }
      }

      return true;
    });
  }

  clear(): void {
    this.logs = [];
  }

  size(): number {
    return this.logs.length;
  }

  getStats(): LogStats {
    const logsByLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      fatal: 0,
    };

    const logsBySource: Record<string, number> = {};
    let totalSize = 0;
    let oldestTimestamp: Date | undefined;
    let newestTimestamp: Date | undefined;

    for (const log of this.logs) {
      logsByLevel[log.level]++;
      logsBySource[log.source] = (logsBySource[log.source] || 0) + 1;
      totalSize += JSON.stringify(log).length;

      if (!oldestTimestamp || log.timestamp < oldestTimestamp) {
        oldestTimestamp = log.timestamp;
      }
      if (!newestTimestamp || log.timestamp > newestTimestamp) {
        newestTimestamp = log.timestamp;
      }
    }

    return {
      totalLogs: this.logs.length,
      logsByLevel,
      logsBySource,
      averageLogSize: this.logs.length > 0 ? totalSize / this.logs.length : 0,
      totalSizeBytes: totalSize,
      oldestLogTimestamp: oldestTimestamp,
      newestLogTimestamp: newestTimestamp,
      startTime: this.logs.length > 0 ? this.logs[0].timestamp : new Date(),
      lastResetTime: new Date(),
    };
  }
}

export class LogRotator {
  private config: LogRotationConfig;
  private currentSize: number = 0;
  private lastRotateTime: Date = new Date();
  private rotationTimer?: NodeJS.Timeout;

  constructor(config: LogRotationConfig) {
    this.config = config;
  }

  shouldRotate(entry: LogEntry): boolean {
    const entrySize = JSON.stringify(entry).length;

    if (this.config.type === 'size' || this.config.type === 'both') {
      if (this.config.maxSizeBytes && this.currentSize + entrySize > this.config.maxSizeBytes) {
        return true;
      }
    }

    if (this.config.type === 'time' || this.config.type === 'both') {
      if (this.isTimeForRotation()) {
        return true;
      }
    }

    return false;
  }

  private isTimeForRotation(): boolean {
    if (!this.config.rotateIntervalMs) {
      return false;
    }
    const now = Date.now();
    const lastRotate = this.lastRotateTime.getTime();
    return now - lastRotate >= this.config.rotateIntervalMs;
  }

  recordWrite(size: number): void {
    this.currentSize += size;
  }

  getCurrentSize(): number {
    return this.currentSize;
  }

  resetRotation(): void {
    this.currentSize = 0;
    this.lastRotateTime = new Date();
  }

  startTimeBasedRotation(callback: () => void): void {
    if (this.config.rotateIntervalMs) {
      this.rotationTimer = setInterval(() => {
        callback();
      }, this.config.rotateIntervalMs);
    }
  }

  stopTimeBasedRotation(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = undefined;
    }
  }

  getConfig(): LogRotationConfig {
    return { ...this.config };
  }
}

export class MetricsCollector {
  private metrics: Map<string, MetricValue[]> = new Map();
  private maxValuesPerMetric: number = 1000;

  addMetric(name: string, value: number, labels?: Record<string, string>): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricValues = this.metrics.get(name)!;
    metricValues.push({
      value,
      timestamp: new Date(),
      labels,
    });

    if (metricValues.length > this.maxValuesPerMetric) {
      metricValues.shift();
    }
  }

  getMetrics(name: string, timeWindowMs?: number): MetricValue[] {
    const metricValues = this.metrics.get(name) || [];
    
    if (!timeWindowMs) {
      return [...metricValues];
    }

    const cutoff = Date.now() - timeWindowMs;
    return metricValues.filter((m) => m.timestamp.getTime() >= cutoff);
  }

  getAllMetrics(): Map<string, MetricValue[]> {
    return new Map(this.metrics);
  }

  getLatestMetric(name: string): MetricValue | undefined {
    const values = this.metrics.get(name);
    return values ? values[values.length - 1] : undefined;
  }

  getTimeSeries(name: string, intervalMs: number, timeWindowMs: number): TimeSeries {
    const cutoff = Date.now() - timeWindowMs;
    const values = this.metrics.get(name) || [];
    const filtered = values.filter((m) => m.timestamp.getTime() >= cutoff);

    const dataPoints: TimeSeriesDataPoint[] = filtered.map((m) => ({
      timestamp: m.timestamp,
      value: m.value,
      labels: m.labels,
    }));

    return {
      metric: name,
      dataPoints,
      intervalMs,
    };
  }

  clearMetric(name: string): void {
    this.metrics.delete(name);
  }

  clearAll(): void {
    this.metrics.clear();
  }

  aggregateByTime(name: string, bucketMs: number): Map<number, { avg: number; min: number; max: number; count: number }> {
    const values = this.metrics.get(name) || [];
    const buckets = new Map<number, number[]>();

    for (const metric of values) {
      const bucketKey = Math.floor(metric.timestamp.getTime() / bucketMs) * bucketMs;
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
      }
      buckets.get(bucketKey)!.push(metric.value);
    }

    const result = new Map<number, { avg: number; min: number; max: number; count: number }>();
    for (const [bucket, bucketValues] of buckets) {
      result.set(bucket, {
        avg: bucketValues.reduce((a, b) => a + b, 0) / bucketValues.length,
        min: Math.min(...bucketValues),
        max: Math.max(...bucketValues),
        count: bucketValues.length,
      });
    }

    return result;
  }
}

export class AlertManager {
  private alerts: Map<string, Alert> = new Map();
  private configs: Map<string, AlertConfig> = new Map();
  private notifications: AlertNotification[] = [];
  private lastTriggered: Map<string, number> = new Map();

  addConfig(config: AlertConfig): void {
    this.configs.set(config.name, { ...config });
  }

  removeConfig(name: string): void {
    this.configs.delete(name);
  }

  getConfig(name: string): AlertConfig | undefined {
    const config = this.configs.get(name);
    return config ? { ...config } : undefined;
  }

  getAllConfigs(): AlertConfig[] {
    return Array.from(this.configs.values()).map((c) => ({ ...c }));
  }

  checkThreshold(metricName: string, value: number): Alert | null {
    for (const config of this.configs.values()) {
      if (!config.enabled || config.type !== 'threshold') {
        continue;
      }
      if (config.metric !== metricName) {
        continue;
      }
      if (config.threshold === undefined) {
        continue;
      }

      if (this.isInCooldown(config.name)) {
        continue;
      }

      if (value >= config.threshold) {
        const alert = this.createAlert(config, value);
        this.alerts.set(alert.id, alert);
        this.lastTriggered.set(config.name, Date.now());
        return alert;
      }
    }
    return null;
  }

  checkAnomaly(metricName: string, actualValue: number, expectedValue: number): Alert | null {
    for (const config of this.configs.values()) {
      if (!config.enabled || config.type !== 'anomaly') {
        continue;
      }
      if (config.metric !== metricName) {
        continue;
      }
      if (config.anomalyThreshold === undefined) {
        continue;
      }

      if (this.isInCooldown(config.name)) {
        continue;
      }

      const deviation = Math.abs(actualValue - expectedValue) / (expectedValue || 1);
      if (deviation >= config.anomalyThreshold) {
        const alert = this.createAlert(config, actualValue, expectedValue);
        this.alerts.set(alert.id, alert);
        this.lastTriggered.set(config.name, Date.now());
        return alert;
      }
    }
    return null;
  }

  private isInCooldown(alertName: string): boolean {
    const lastTriggered = this.lastTriggered.get(alertName);
    if (!lastTriggered) {
      return false;
    }

    const config = this.configs.get(alertName);
    if (!config || !config.cooldownMs) {
      return false;
    }

    return Date.now() - lastTriggered < config.cooldownMs;
  }

  private createAlert(config: AlertConfig, value: number, expectedValue?: number): Alert {
    const message = config.type === 'threshold'
      ? `Alert '${config.name}': ${config.metric} value ${value} exceeded threshold ${config.threshold}`
      : `Alert '${config.name}': ${config.metric} value ${value} deviated from expected ${expectedValue}`;

    return {
      id: generateLogId('ALERT'),
      name: config.name,
      type: config.type,
      severity: config.severity,
      metric: config.metric,
      value,
      threshold: config.threshold,
      message,
      triggeredAt: new Date(),
      status: 'active',
      metadata: expectedValue !== undefined ? { expectedValue } : undefined,
    };
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status !== 'active') {
      return false;
    }
    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    return true;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status === 'resolved') {
      return false;
    }
    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    return true;
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter((a) => a.status === 'active');
  }

  getAlertHistory(alertName?: string): Alert[] {
    const alerts = Array.from(this.alerts.values());
    if (alertName) {
      return alerts.filter((a) => a.name === alertName);
    }
    return alerts.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());
  }

  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  clearResolvedAlerts(): number {
    let cleared = 0;
    for (const [id, alert] of this.alerts) {
      if (alert.status === 'resolved') {
        this.alerts.delete(id);
        cleared++;
      }
    }
    return cleared;
  }

  recordNotification(alertId: string, channel: string, success: boolean, error?: string): void {
    this.notifications.push({
      alertId,
      channel,
      sentAt: new Date(),
      success,
      error,
    });
  }

  getNotifications(alertId?: string): AlertNotification[] {
    if (alertId) {
      return this.notifications.filter((n) => n.alertId === alertId);
    }
    return [...this.notifications];
  }
}

export class PerformanceMonitor {
  private config: PerformanceMonitorConfig;
  private requestTimes: number[] = [];
  private errorCount: number = 0;
  private requestCount: number = 0;
  private startTime: Date;
  private metricsCollector: MetricsCollector;

  constructor(config: PerformanceMonitorConfig, metricsCollector: MetricsCollector) {
    this.config = config;
    this.metricsCollector = metricsCollector;
    this.startTime = new Date();
  }

  recordRequest(durationMs: number, isError: boolean = false): void {
    if (!this.config.enabled) {
      return;
    }

    this.requestTimes.push(durationMs);
    this.requestCount++;
    if (isError) {
      this.errorCount++;
    }

    if (this.config.trackResponseTime) {
      this.metricsCollector.addMetric('response_time', durationMs);
    }

    if (this.config.trackRequests) {
      this.metricsCollector.addMetric('requests', 1);
    }

    if (this.config.slowRequestThresholdMs && durationMs > this.config.slowRequestThresholdMs) {
      this.metricsCollector.addMetric('slow_requests', 1);
    }
  }

  recordCpuUsage(usage: number): void {
    if (this.config.enabled && this.config.trackCpu) {
      this.metricsCollector.addMetric('cpu', usage);
    }
  }

  recordMemoryUsage(used: number, total: number): void {
    if (this.config.enabled && this.config.trackMemory) {
      this.metricsCollector.addMetric('memory', used);
      this.metricsCollector.addMetric('memory_percent', (used / total) * 100);
    }
  }

  getMetrics(): PerformanceMetrics {
    const sorted = [...this.requestTimes].sort((a, b) => a - b);
    const avg = this.requestTimes.length > 0
      ? this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length
      : 0;

    const p50Index = Math.floor(sorted.length * 0.5);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    const uptime = Date.now() - this.startTime.getTime();
    const requestsPerSecond = uptime > 0 ? (this.requestCount / uptime) * 1000 : 0;

    return {
      requestCount: this.requestCount,
      averageResponseTime: avg,
      minResponseTime: sorted.length > 0 ? sorted[0] : 0,
      maxResponseTime: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
      p50ResponseTime: sorted.length > p50Index ? sorted[p50Index] : 0,
      p95ResponseTime: sorted.length > p95Index ? sorted[p95Index] : 0,
      p99ResponseTime: sorted.length > p99Index ? sorted[p99Index] : 0,
      errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
      requestsPerSecond,
      timestamp: new Date(),
    };
  }

  reset(): void {
    this.requestTimes = [];
    this.errorCount = 0;
    this.requestCount = 0;
    this.startTime = new Date();
  }

  getConfig(): PerformanceMonitorConfig {
    return { ...this.config };
  }
}

export class AnomalyDetector {
  private windowSize: number;
  private values: Map<string, number[]> = new Map();

  constructor(windowSize: number = 100) {
    this.windowSize = windowSize;
  }

  addValue(metricName: string, value: number): void {
    if (!this.values.has(metricName)) {
      this.values.set(metricName, []);
    }

    const metricValues = this.values.get(metricName)!;
    metricValues.push(value);

    if (metricValues.length > this.windowSize) {
      metricValues.shift();
    }
  }

  detect(metricName: string, currentValue: number): AnomalyDetectionResult {
    const history = this.values.get(metricName) || [];

    if (history.length < 10) {
      return {
        isAnomaly: false,
        score: 0,
        expectedValue: currentValue,
        actualValue: currentValue,
        deviation: 0,
        timestamp: new Date(),
      };
    }

    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const squaredDiffs = history.map((v) => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / history.length;
    const stdDev = Math.sqrt(variance);

    const deviation = Math.abs(currentValue - mean) / (stdDev || 1);
    const score = Math.min(deviation / 3, 1);

    return {
      isAnomaly: score > 0.7,
      score,
      expectedValue: mean,
      actualValue: currentValue,
      deviation,
      timestamp: new Date(),
    };
  }

  getMean(metricName: string): number | undefined {
    const history = this.values.get(metricName);
    if (!history || history.length === 0) {
      return undefined;
    }
    return history.reduce((a, b) => a + b, 0) / history.length;
  }

  getStdDev(metricName: string): number | undefined {
    const history = this.values.get(metricName);
    if (!history || history.length < 2) {
      return undefined;
    }

    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const squaredDiffs = history.map((v) => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / history.length;
    return Math.sqrt(variance);
  }

  clear(metricName?: string): void {
    if (metricName) {
      this.values.delete(metricName);
    } else {
      this.values.clear();
    }
  }
}

export class LogSearchEngine {
  private storage: InMemoryLogStorage;

  constructor(storage: InMemoryLogStorage) {
    this.storage = storage;
  }

  search(options: LogQueryOptions): LogSearchResult {
    const startTime = Date.now();
    const filter = options.filter;
    const page = options.page || 1;
    const pageSize = options.pageSize || 50;

    let results = this.storage.getFiltered(filter);

    if (options.sortBy) {
      const sortOrder = options.sortOrder === 'desc' ? -1 : 1;
      results = results.sort((a, b) => {
        if (options.sortBy === 'timestamp') {
          return (a.timestamp.getTime() - b.timestamp.getTime()) * sortOrder;
        } else if (options.sortBy === 'level') {
          return (LOG_LEVEL_PRIORITIES[a.level] - LOG_LEVEL_PRIORITIES[b.level]) * sortOrder;
        } else if (options.sortBy === 'source') {
          return a.source.localeCompare(b.source) * sortOrder;
        }
        return 0;
      });
    }

    const totalCount = results.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedResults = results.slice(startIndex, startIndex + pageSize);

    return {
      logs: paginatedResults,
      totalCount,
      page,
      pageSize,
      totalPages,
      searchTimeMs: Date.now() - startTime,
    };
  }

  aggregate(filter: LogFilter, timeBucketMs: number): LogAggregation[] {
    const logs = this.storage.getFiltered(filter);
    const buckets = new Map<string, LogEntry[]>();

    for (const log of logs) {
      const bucketKey = new Date(
        Math.floor(log.timestamp.getTime() / timeBucketMs) * timeBucketMs
      ).toISOString();

      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
      }
      buckets.get(bucketKey)!.push(log);
    }

    const aggregations: LogAggregation[] = [];

    for (const [timeBucket, bucketLogs] of buckets) {
      const levelCounts: Record<LogLevel, number> = {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
        fatal: 0,
      };

      const sourceCounts: Record<string, number> = {};
      let totalDuration = 0;
      let durationCount = 0;
      let errorCount = 0;

      for (const log of bucketLogs) {
        levelCounts[log.level]++;
        sourceCounts[log.source] = (sourceCounts[log.source] || 0) + 1;

        if (log.duration !== undefined) {
          totalDuration += log.duration;
          durationCount++;
        }

        if (log.level === 'error' || log.level === 'fatal') {
          errorCount++;
        }
      }

      const sources = Object.keys(sourceCounts);
      const primarySource = sources.length > 0 ? sources[0] : 'unknown';
      const dominantLevel = (Object.entries(levelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'info') as LogLevel;

      aggregations.push({
        count: bucketLogs.length,
        level: dominantLevel,
        source: primarySource,
        timeBucket: new Date(timeBucket),
        avgDuration: durationCount > 0 ? totalDuration / durationCount : undefined,
        errorRate: bucketLogs.length > 0 ? errorCount / bucketLogs.length : undefined,
      });
    }

    return aggregations.sort((a, b) => a.timeBucket.getTime() - b.timeBucket.getTime());
  }
}

export class LogExporterImporter {
  export(logs: LogEntry[], format: 'json' | 'csv' | 'xml'): string {
    switch (format) {
      case 'json':
        return this.exportJSON(logs);
      case 'csv':
        return this.exportCSV(logs);
      case 'xml':
        return this.exportXML(logs);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private exportJSON(logs: LogEntry[]): string {
    const serialized = logs.map(serializeLogEntry);
    return JSON.stringify(serialized, null, 2);
  }

  private exportCSV(logs: LogEntry[]): string {
    const headers = [
      'id',
      'timestamp',
      'level',
      'message',
      'source',
      'correlationId',
      'userId',
      'sessionId',
      'duration',
    ];

    const rows = logs.map((log) =>
      [
        log.id,
        log.timestamp.toISOString(),
        log.level,
        `"${log.message.replace(/"/g, '""')}"`,
        log.source,
        log.correlationId || '',
        log.userId || '',
        log.sessionId || '',
        log.duration?.toString() || '',
      ].join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  private exportXML(logs: LogEntry[]): string {
    const entries = logs
      .map((log) => {
        const serialized = serializeLogEntry(log);
        return `  <entry>
    <id>${serialized.id}</id>
    <timestamp>${serialized.timestamp}</timestamp>
    <level>${serialized.level}</level>
    <message><![CDATA[${serialized.message}]]></message>
    <source>${serialized.source}</source>
    ${serialized.correlationId ? `<correlationId>${serialized.correlationId}</correlationId>` : ''}
    ${serialized.userId ? `<userId>${serialized.userId}</userId>` : ''}
    ${serialized.sessionId ? `<sessionId>${serialized.sessionId}</sessionId>` : ''}
    ${serialized.duration !== undefined ? `<duration>${serialized.duration}</duration>` : ''}
  </entry>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<logs>\n${entries}\n</logs>`;
  }

  import(data: string, format: 'json' | 'csv' | 'xml'): LogEntry[] {
    switch (format) {
      case 'json':
        return this.importJSON(data);
      case 'csv':
        return this.importCSV(data);
      case 'xml':
        return this.importXML(data);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private importJSON(data: string): LogEntry[] {
    const parsed = JSON.parse(data) as SerializedLogEntry[];
    return parsed.map(deserializeLogEntry);
  }

  private importCSV(data: string): LogEntry[] {
    const lines = data.split('\n').filter((line) => line.trim());
    if (lines.length < 2) {
      return [];
    }

    const logs: LogEntry[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length >= 9) {
        logs.push({
          id: values[0],
          timestamp: new Date(values[1]),
          level: values[2] as LogLevel,
          message: values[3],
          source: values[4],
          correlationId: values[5] || undefined,
          userId: values[6] || undefined,
          sessionId: values[7] || undefined,
          duration: values[8] ? parseInt(values[8], 10) : undefined,
        });
      }
    }
    return logs;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  private importXML(data: string): LogEntry[] {
    const logs: LogEntry[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(data)) !== null) {
      const entryContent = match[1];
      const log = this.parseXMLEntry(entryContent);
      if (log) {
        logs.push(log);
      }
    }

    return logs;
  }

  private parseXMLEntry(content: string): LogEntry | null {
    const getValue = (tag: string): string => {
      const regex = new RegExp(`<${tag}><!\\[CDATA\\[([^\\]]*?)\\]\\]><\\/${tag}>|<${tag}>([^<]*)<\\/${tag}>`);
      const match = content.match(regex);
      return match ? (match[1] || match[2] || '') : '';
    };

    const id = getValue('id');
    if (!id) {
      return null;
    }

    return {
      id,
      timestamp: new Date(getValue('timestamp')),
      level: getValue('level') as LogLevel,
      message: getValue('message'),
      source: getValue('source'),
      correlationId: getValue('correlationId') || undefined,
      userId: getValue('userId') || undefined,
      sessionId: getValue('sessionId') || undefined,
      duration: getValue('duration') ? parseInt(getValue('duration'), 10) : undefined,
    };
  }
}

export interface ILogger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, error?: Error, metadata?: Record<string, unknown>): void;
  fatal(message: string, error?: Error, metadata?: Record<string, unknown>): void;
  log(entry: LogEntry): void;
  getLogs(filter?: LogFilter): LogEntry[];
  search(options: LogQueryOptions): LogSearchResult;
  getStats(): LogStats;
  clear(): void;
  flush(): Promise<void>;
  snapshot(): Promise<LogSnapshot>;
  restore(snapshot: LogSnapshot): Promise<void>;
  export(format: 'json' | 'csv' | 'xml'): Promise<string>;
  healthCheck(): Promise<HealthCheckResult>;
  on(event: LogEvent['type'], handler: (event: LogEvent) => void): void;
  off(event: LogEvent['type'], handler: (event: LogEvent) => void): void;
  destroy(): void;
}

export class Logger implements ILogger {
  private config: LogConfig;
  private storage: InMemoryLogStorage;
  private rotator: LogRotator;
  private eventEmitter: SimpleEventEmitter;
  private flushTimer?: NodeJS.Timeout;
  private pendingLogs: LogEntry[] = [];
  private metricsCollector: MetricsCollector;
  private alertManager: AlertManager;
  private performanceMonitor: PerformanceMonitor;
  private anomalyDetector: AnomalyDetector;
  private searchEngine: LogSearchEngine;
  private retentionPolicy: LogRetentionPolicy;

  constructor(config: Partial<LogConfig> = {}) {
    this.config = { ...DEFAULT_LOG_CONFIG, ...config } as LogConfig;
    this.storage = new InMemoryLogStorage(this.config.maxMemoryLogs);
    this.rotator = new LogRotator(DEFAULT_ROTATION_CONFIG);
    this.eventEmitter = new SimpleEventEmitter();
    this.metricsCollector = new MetricsCollector();
    this.alertManager = new AlertManager();
    this.anomalyDetector = new AnomalyDetector();
    this.searchEngine = new LogSearchEngine(this.storage);
    this.retentionPolicy = { ...DEFAULT_LOG_RETENTION };
    this.performanceMonitor = new PerformanceMonitor(
      {
        enabled: true,
        sampleRate: 1,
        trackResponseTime: true,
        trackCpu: true,
        trackMemory: true,
        trackRequests: true,
        slowRequestThresholdMs: 1000,
      },
      this.metricsCollector
    );

    if (this.config.flushIntervalMs) {
      this.startFlushTimer();
    }
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      id: generateLogId('LOG'),
      timestamp: new Date(),
      level,
      message,
      source: this.getCallerSource(),
      metadata,
    };

    if (error) {
      entry.stack = error.stack;
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  private getCallerSource(): string {
    const error = new Error();
    const stack = error.stack?.split('\n') || [];
    const relevantFrame = stack.find(
      (line) => !line.includes('Logging') && !line.includes('logger')
    );
    if (relevantFrame) {
      const match = relevantFrame.match(/at\s+(.+):/);
      return match ? match[1] : 'unknown';
    }
    return 'unknown';
  }

  private shouldLog(level: LogLevel): boolean {
    const currentPriority = LOG_LEVEL_PRIORITIES[level];
    const defaultPriority = LOG_LEVEL_PRIORITIES[this.config.defaultLevel];
    return currentPriority >= defaultPriority;
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      this.log(this.createLogEntry('debug', message, metadata));
    }
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      this.log(this.createLogEntry('info', message, metadata));
    }
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      this.log(this.createLogEntry('warn', message, metadata));
    }
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      this.log(this.createLogEntry('error', message, metadata, error));
    }
  }

  fatal(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    if (this.shouldLog('fatal')) {
      this.log(this.createLogEntry('fatal', message, metadata, error));
    }
  }

  log(entry: LogEntry): void {
    if (this.rotator.shouldRotate(entry)) {
      this.emitLogEvent('rotate', undefined, this.storage.size());
      this.rotator.resetRotation();
    }

    if (this.config.enableConsole) {
      console.log(formatLogMessage(entry));
    }

    this.storage.add(entry);
    this.pendingLogs.push(entry);

    const entrySize = JSON.stringify(entry).length;
    this.rotator.recordWrite(entrySize);
    this.metricsCollector.addMetric('log_count', 1);
    this.metricsCollector.addMetric('log_size', entrySize);

    this.applyRetentionPolicy();

    this.emitLogEvent('log', entry);
  }

  private emitLogEvent(type: LogEvent['type'], entry?: LogEntry, count?: number): void {
    this.eventEmitter.emit({
      type,
      entry,
      count,
      timestamp: new Date(),
    });
  }

  private applyRetentionPolicy(): void {
    if (this.retentionPolicy.maxAgeMs) {
      const cutoff = Date.now() - this.retentionPolicy.maxAgeMs;
      const logs = this.storage.getAll();
      let removed = 0;

      for (const log of logs) {
        if (log.timestamp.getTime() < cutoff) {
          removed++;
        }
      }

      if (removed > 0) {
        const filtered = logs.filter((log) => log.timestamp.getTime() >= cutoff);
        this.storage.clear();
        for (const log of filtered) {
          this.storage.add(log);
        }
      }
    }

    if (this.retentionPolicy.maxLogs) {
      const logs = this.storage.getAll();
      if (logs.length > this.retentionPolicy.maxLogs) {
        const toRemove = logs.length - this.retentionPolicy.maxLogs;
        const filtered = logs.slice(toRemove);
        this.storage.clear();
        for (const log of filtered) {
          this.storage.add(log);
        }
      }
    }
  }

  getLogs(filter?: LogFilter): LogEntry[] {
    if (!filter) {
      return this.storage.getAll();
    }
    return this.storage.getFiltered(filter);
  }

  search(options: LogQueryOptions): LogSearchResult {
    return this.searchEngine.search(options);
  }

  getStats(): LogStats {
    return this.storage.getStats();
  }

  clear(): void {
    this.storage.clear();
    this.emitLogEvent('clear', undefined, 0);
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs);
  }

  async flush(): Promise<void> {
    if (this.pendingLogs.length > 0) {
      this.emitLogEvent('flush', undefined, this.pendingLogs.length);
      this.pendingLogs = [];
    }
  }

  async snapshot(): Promise<LogSnapshot> {
    const entries = this.storage.getAll().map(serializeLogEntry);
    return {
      entries,
      stats: this.getStats(),
      timestamp: new Date(),
      version: '1.0.0',
    };
  }

  async restore(snapshot: LogSnapshot): Promise<void> {
    this.clear();
    for (const entry of snapshot.entries) {
      this.storage.add(deserializeLogEntry(entry));
    }
  }

  async export(format: 'json' | 'csv' | 'xml'): Promise<string> {
    const logs = this.storage.getAll();
    const exporter = new LogExporterImporter();
    const result = exporter.export(logs, format);
    this.emitLogEvent('export');
    return result;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      this.storage.getAll();
      return {
        healthy: true,
        storageConnected: true,
        latencyMs: Date.now() - start,
        errors: [],
      };
    } catch (error) {
      return {
        healthy: false,
        storageConnected: false,
        latencyMs: Date.now() - start,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  on(event: LogEvent['type'], handler: (event: LogEvent) => void): void {
    this.eventEmitter.on(event, handler);
  }

  off(event: LogEvent['type'], handler: (event: LogEvent) => void): void {
    this.eventEmitter.off(event, handler);
  }

  getMetricsCollector(): MetricsCollector {
    return this.metricsCollector;
  }

  getAlertManager(): AlertManager {
    return this.alertManager;
  }

  getPerformanceMonitor(): PerformanceMonitor {
    return this.performanceMonitor;
  }

  getAnomalyDetector(): AnomalyDetector {
    return this.anomalyDetector;
  }

  setRetentionPolicy(policy: LogRetentionPolicy): void {
    this.retentionPolicy = { ...policy };
  }

  setRotationConfig(config: LogRotationConfig): void {
    this.rotator = new LogRotator(config);
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    this.eventEmitter.removeAllListeners();
    this.rotator.stopTimeBasedRotation();
  }
}

export function createLogger(config?: Partial<LogConfig>): Logger {
  return new Logger(config);
}

export function createChildLogger(parent: Logger, source: string): Logger {
  const child = new Logger();
  child.info = (message: string, metadata?: Record<string, unknown>) => {
    parent.info(`[${source}] ${message}`, metadata);
  };
  child.debug = (message: string, metadata?: Record<string, unknown>) => {
    parent.debug(`[${source}] ${message}`, metadata);
  };
  child.warn = (message: string, metadata?: Record<string, unknown>) => {
    parent.warn(`[${source}] ${message}`, metadata);
  };
  child.error = (message: string, error?: Error, metadata?: Record<string, unknown>) => {
    parent.error(`[${source}] ${message}`, error, metadata);
  };
  child.fatal = (message: string, error?: Error, metadata?: Record<string, unknown>) => {
    parent.fatal(`[${source}] ${message}`, error, metadata);
  };
  return child;
}

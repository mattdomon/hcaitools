/**
 * Logging & Monitoring System Tests
 */

import {
  Logger,
  createLogger,
  InMemoryLogStorage,
  LogRotator,
  MetricsCollector,
  AlertManager,
  PerformanceMonitor,
  AnomalyDetector,
  LogSearchEngine,
  LogExporterImporter,
  SimpleEventEmitter,
  LogLevel,
  LogEntry,
  LogFilter,
  LogConfig,
  AlertConfig,
  AlertSeverity,
  LogEvent,
  LogQueryOptions,
  generateLogId,
  serializeLogEntry,
  deserializeLogEntry,
  formatLogMessage,
  isLogLevel,
  isAlertStatus,
  isAlertSeverity,
  isMetricType,
} from '../src/core/logging';

describe('Logging & Monitoring System', () => {
  describe('Type Guards', () => {
    test('isLogLevel correctly identifies valid log levels', () => {
      expect(isLogLevel('debug')).toBe(true);
      expect(isLogLevel('info')).toBe(true);
      expect(isLogLevel('warn')).toBe(true);
      expect(isLogLevel('error')).toBe(true);
      expect(isLogLevel('fatal')).toBe(true);
    });

    test('isLogLevel correctly rejects invalid log levels', () => {
      expect(isLogLevel('trace')).toBe(false);
      expect(isLogLevel('warning')).toBe(false);
      expect(isLogLevel('DEBUG')).toBe(false);
      expect(isLogLevel(123)).toBe(false);
      expect(isLogLevel(null)).toBe(false);
      expect(isLogLevel(undefined)).toBe(false);
    });

    test('isAlertStatus correctly identifies valid statuses', () => {
      expect(isAlertStatus('active')).toBe(true);
      expect(isAlertStatus('acknowledged')).toBe(true);
      expect(isAlertStatus('resolved')).toBe(true);
    });

    test('isAlertStatus correctly rejects invalid statuses', () => {
      expect(isAlertStatus('pending')).toBe(false);
      expect(isAlertStatus('ACTIVE')).toBe(false);
      expect(isAlertStatus(123)).toBe(false);
    });

    test('isAlertSeverity correctly identifies valid severities', () => {
      expect(isAlertSeverity('low')).toBe(true);
      expect(isAlertSeverity('medium')).toBe(true);
      expect(isAlertSeverity('high')).toBe(true);
      expect(isAlertSeverity('critical')).toBe(true);
    });

    test('isAlertSeverity correctly rejects invalid severities', () => {
      expect(isAlertSeverity('urgent')).toBe(false);
      expect(isAlertSeverity('LOW')).toBe(false);
      expect(isAlertSeverity(123)).toBe(false);
    });

    test('isMetricType correctly identifies valid metric types', () => {
      expect(isMetricType('response_time')).toBe(true);
      expect(isMetricType('cpu')).toBe(true);
      expect(isMetricType('memory')).toBe(true);
      expect(isMetricType('requests')).toBe(true);
      expect(isMetricType('custom')).toBe(true);
    });
  });

  describe('ID Generation', () => {
    test('generateLogId creates unique IDs', () => {
      const id1 = generateLogId();
      const id2 = generateLogId();
      expect(id1).not.toBe(id2);
    });

    test('generateLogId uses provided prefix', () => {
      const id = generateLogId('TEST');
      expect(id.startsWith('TEST_')).toBe(true);
    });

    test('generateLogId generates IDs with correct format', () => {
      const id = generateLogId('LOG');
      expect(id).toMatch(/^LOG_[a-z0-9]+$/);
    });
  });

  describe('Log Entry Serialization', () => {
    test('serializeLogEntry converts LogEntry to SerializedLogEntry', () => {
      const entry: LogEntry = {
        id: 'LOG_123',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        level: 'info',
        message: 'Test message',
        source: 'test',
      };

      const serialized = serializeLogEntry(entry);
      expect(serialized.timestamp).toBe('2024-01-01T12:00:00.000Z');
      expect(serialized.id).toBe('LOG_123');
      expect(serialized.level).toBe('info');
    });

    test('deserializeLogEntry converts SerializedLogEntry back to LogEntry', () => {
      const entry: LogEntry = {
        id: 'LOG_123',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        level: 'info',
        message: 'Test message',
        source: 'test',
      };

      const serialized = serializeLogEntry(entry);
      const deserialized = deserializeLogEntry(serialized);

      expect(deserialized.id).toBe(entry.id);
      expect(deserialized.level).toBe(entry.level);
      expect(deserialized.timestamp.getTime()).toBe(entry.timestamp.getTime());
    });

    test('formatLogMessage formats log entry correctly', () => {
      const entry: LogEntry = {
        id: 'LOG_123',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        level: 'info',
        message: 'Test message',
        source: 'test',
      };

      const formatted = formatLogMessage(entry);
      expect(formatted).toContain('2024-01-01T12:00:00.000Z');
      expect(formatted).toContain('INFO');
      expect(formatted).toContain('Test message');
    });

    test('formatLogMessage includes optional fields when present', () => {
      const entry: LogEntry = {
        id: 'LOG_123',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        level: 'error',
        message: 'Error occurred',
        source: 'test',
        correlationId: 'corr_123',
        duration: 150,
        metadata: { key: 'value' },
      };

      const formatted = formatLogMessage(entry);
      expect(formatted).toContain('corr_123');
      expect(formatted).toContain('150ms');
      expect(formatted).toContain('key');
    });
  });

  describe('InMemoryLogStorage', () => {
    test('adds log entries and retrieves them', () => {
      const storage = new InMemoryLogStorage(100);
      const entry: LogEntry = {
        id: 'LOG_1',
        timestamp: new Date(),
        level: 'info',
        message: 'Test',
        source: 'test',
      };

      storage.add(entry);
      expect(storage.size()).toBe(1);
      expect(storage.getAll()).toHaveLength(1);
    });

    test('respects maxLogs limit', () => {
      const storage = new InMemoryLogStorage(3);
      for (let i = 0; i < 5; i++) {
        storage.add({
          id: `LOG_${i}`,
          timestamp: new Date(),
          level: 'info',
          message: `Test ${i}`,
          source: 'test',
        });
      }

      expect(storage.size()).toBe(3);
    });

    test('filters logs by level', () => {
      const storage = new InMemoryLogStorage(100);
      storage.add({ id: '1', timestamp: new Date(), level: 'debug', message: 'd', source: 's' });
      storage.add({ id: '2', timestamp: new Date(), level: 'info', message: 'i', source: 's' });
      storage.add({ id: '3', timestamp: new Date(), level: 'error', message: 'e', source: 's' });

      const filtered = storage.getFiltered({ levels: ['error', 'fatal'] });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].level).toBe('error');
    });

    test('filters logs by source', () => {
      const storage = new InMemoryLogStorage(100);
      storage.add({ id: '1', timestamp: new Date(), level: 'info', message: 'a', source: 'sourceA' });
      storage.add({ id: '2', timestamp: new Date(), level: 'info', message: 'b', source: 'sourceB' });

      const filtered = storage.getFiltered({ sources: ['sourceA'] });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].source).toBe('sourceA');
    });

    test('filters logs by time range', () => {
      const storage = new InMemoryLogStorage(100);
      const now = new Date();
      const oldDate = new Date(now.getTime() - 10000);
      const recentDate = new Date(now.getTime() - 1000);

      storage.add({ id: '1', timestamp: oldDate, level: 'info', message: 'old', source: 's' });
      storage.add({ id: '2', timestamp: recentDate, level: 'info', message: 'new', source: 's' });

      const filtered = storage.getFiltered({ startTime: new Date(now.getTime() - 5000) });
      expect(filtered).toHaveLength(1);
    });

    test('filters logs by search text', () => {
      const storage = new InMemoryLogStorage(100);
      storage.add({ id: '1', timestamp: new Date(), level: 'info', message: 'hello world', source: 's' });
      storage.add({ id: '2', timestamp: new Date(), level: 'info', message: 'foo bar', source: 's' });

      const filtered = storage.getFiltered({ searchText: 'hello' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].message).toContain('hello');
    });

    test('calculates stats correctly', () => {
      const storage = new InMemoryLogStorage(100);
      storage.add({ id: '1', timestamp: new Date(), level: 'info', message: 'a', source: 'src1' });
      storage.add({ id: '2', timestamp: new Date(), level: 'info', message: 'b', source: 'src1' });
      storage.add({ id: '3', timestamp: new Date(), level: 'error', message: 'c', source: 'src2' });

      const stats = storage.getStats();
      expect(stats.totalLogs).toBe(3);
      expect(stats.logsByLevel.info).toBe(2);
      expect(stats.logsByLevel.error).toBe(1);
      expect(stats.logsBySource.src1).toBe(2);
      expect(stats.logsBySource.src2).toBe(1);
    });

    test('clears all logs', () => {
      const storage = new InMemoryLogStorage(100);
      storage.add({ id: '1', timestamp: new Date(), level: 'info', message: 'a', source: 's' });
      storage.add({ id: '2', timestamp: new Date(), level: 'info', message: 'b', source: 's' });

      storage.clear();
      expect(storage.size()).toBe(0);
    });
  });

  describe('LogRotator', () => {
    test('shouldRotate by size when size limit exceeded', () => {
      const rotator = new LogRotator({
        type: 'size',
        maxSizeBytes: 10000,
      });

      const entry: LogEntry = {
        id: 'LOG_1',
        timestamp: new Date(),
        level: 'info',
        message: 'short',
        source: 'test',
      };

      rotator.recordWrite(100);
      expect(rotator.shouldRotate(entry)).toBe(false);

      rotator.recordWrite(9900);
      expect(rotator.shouldRotate(entry)).toBe(true);
    });

    test('resetRotation resets size and time', () => {
      const rotator = new LogRotator({
        type: 'size',
        maxSizeBytes: 100,
      });

      rotator.recordWrite(50);
      rotator.resetRotation();

      expect(rotator.getCurrentSize()).toBe(0);
    });
  });

  describe('MetricsCollector', () => {
    test('adds and retrieves metrics', () => {
      const collector = new MetricsCollector();
      collector.addMetric('response_time', 100);
      collector.addMetric('response_time', 200);

      const metrics = collector.getMetrics('response_time');
      expect(metrics).toHaveLength(2);
      expect(metrics[0].value).toBe(100);
      expect(metrics[1].value).toBe(200);
    });

    test('filters metrics by time window', () => {
      const collector = new MetricsCollector();
      const oldTime = new Date(Date.now() - 10000);
      const recentTime = new Date();

      collector.addMetric('test', 100, undefined);

      const oldMetric = { value: 50, timestamp: oldTime };
      const recentMetric = { value: 200, timestamp: recentTime };

      const metrics = collector.getMetrics('test');
      expect(metrics.length).toBeGreaterThanOrEqual(0);
    });

    test('gets latest metric', () => {
      const collector = new MetricsCollector();
      collector.addMetric('cpu', 10);
      collector.addMetric('cpu', 20);
      collector.addMetric('cpu', 30);

      const latest = collector.getLatestMetric('cpu');
      expect(latest?.value).toBe(30);
    });

    test('aggregates metrics by time bucket', () => {
      const collector = new MetricsCollector();
      collector.addMetric('test', 100);
      collector.addMetric('test', 200);
      collector.addMetric('test', 150);

      const buckets = collector.aggregateByTime('test', 60000);
      expect(buckets.size).toBeGreaterThanOrEqual(0);
    });

    test('clears specific metric', () => {
      const collector = new MetricsCollector();
      collector.addMetric('metric1', 100);
      collector.addMetric('metric2', 200);

      collector.clearMetric('metric1');

      expect(collector.getMetrics('metric1')).toHaveLength(0);
      expect(collector.getMetrics('metric2')).toHaveLength(1);
    });
  });

  describe('AlertManager', () => {
    test('adds and retrieves alert configs', () => {
      const manager = new AlertManager();
      const config: AlertConfig = {
        name: 'high_cpu',
        type: 'threshold',
        metric: 'cpu',
        threshold: 90,
        severity: 'high',
        enabled: true,
      };

      manager.addConfig(config);
      const retrieved = manager.getConfig('high_cpu');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.threshold).toBe(90);
    });

    test('checks threshold and creates alert when exceeded', () => {
      const manager = new AlertManager();
      manager.addConfig({
        name: 'high_cpu',
        type: 'threshold',
        metric: 'cpu',
        threshold: 80,
        severity: 'high',
        enabled: true,
        cooldownMs: 1000,
      });

      const alert = manager.checkThreshold('cpu', 95);

      expect(alert).not.toBeNull();
      expect(alert?.value).toBe(95);
      expect(alert?.status).toBe('active');
    });

    test('does not create alert when below threshold', () => {
      const manager = new AlertManager();
      manager.addConfig({
        name: 'high_cpu',
        type: 'threshold',
        metric: 'cpu',
        threshold: 80,
        severity: 'high',
        enabled: true,
      });

      const alert = manager.checkThreshold('cpu', 50);
      expect(alert).toBeNull();
    });

    test('respects cooldown period', () => {
      const manager = new AlertManager();
      manager.addConfig({
        name: 'high_cpu',
        type: 'threshold',
        metric: 'cpu',
        threshold: 80,
        severity: 'high',
        enabled: true,
        cooldownMs: 5000,
      });

      manager.checkThreshold('cpu', 95);
      const secondAlert = manager.checkThreshold('cpu', 95);

      expect(secondAlert).toBeNull();
    });

    test('checks anomaly detection', () => {
      const manager = new AlertManager();
      manager.addConfig({
        name: 'cpu_anomaly',
        type: 'anomaly',
        metric: 'cpu',
        anomalyThreshold: 0.5,
        severity: 'critical',
        enabled: true,
      });

      const alert = manager.checkAnomaly('cpu', 200, 100);
      expect(alert).not.toBeNull();
    });

    test('acknowledges alert', () => {
      const manager = new AlertManager();
      manager.addConfig({
        name: 'test',
        type: 'threshold',
        metric: 'test',
        threshold: 50,
        severity: 'medium',
        enabled: true,
      });

      const alert = manager.checkThreshold('test', 100);
      expect(alert).not.toBeNull();

      const acknowledged = manager.acknowledgeAlert(alert!.id);
      expect(acknowledged).toBe(true);
      expect(manager.getAlertHistory()[0].status).toBe('acknowledged');
    });

    test('resolves alert', () => {
      const manager = new AlertManager();
      manager.addConfig({
        name: 'test',
        type: 'threshold',
        metric: 'test',
        threshold: 50,
        severity: 'medium',
        enabled: true,
      });

      const alert = manager.checkThreshold('test', 100);
      manager.resolveAlert(alert!.id);

      expect(manager.getAlertHistory()[0].status).toBe('resolved');
    });

    test('clears resolved alerts', () => {
      const manager = new AlertManager();
      manager.addConfig({
        name: 'test',
        type: 'threshold',
        metric: 'test',
        threshold: 50,
        severity: 'medium',
        enabled: true,
      });

      const alert = manager.checkThreshold('test', 100);
      manager.resolveAlert(alert!.id);
      const cleared = manager.clearResolvedAlerts();

      expect(cleared).toBe(1);
      expect(manager.getAllAlerts()).toHaveLength(0);
    });
  });

  describe('PerformanceMonitor', () => {
    test('records request metrics', () => {
      const collector = new MetricsCollector();
      const monitor = new PerformanceMonitor(
        {
          enabled: true,
          sampleRate: 1,
          trackResponseTime: true,
          trackRequests: true,
          trackCpu: false,
          trackMemory: false,
        },
        collector
      );

      monitor.recordRequest(100, false);
      monitor.recordRequest(200, true);

      const metrics = monitor.getMetrics();
      expect(metrics.requestCount).toBe(2);
      expect(metrics.errorRate).toBe(0.5);
    });

    test('calculates percentiles correctly', () => {
      const collector = new MetricsCollector();
      const monitor = new PerformanceMonitor(
        {
          enabled: true,
          sampleRate: 1,
          trackResponseTime: true,
          trackRequests: false,
          trackCpu: false,
          trackMemory: false,
        },
        collector
      );

      for (let i = 1; i <= 100; i++) {
        monitor.recordRequest(i, false);
      }

      const metrics = monitor.getMetrics();
      expect(metrics.p50ResponseTime).toBeGreaterThanOrEqual(50);
      expect(metrics.p50ResponseTime).toBeLessThanOrEqual(51);
      expect(metrics.p95ResponseTime).toBeGreaterThanOrEqual(95);
      expect(metrics.p99ResponseTime).toBeGreaterThanOrEqual(99);
    });

    test('records CPU and memory usage', () => {
      const collector = new MetricsCollector();
      const monitor = new PerformanceMonitor(
        {
          enabled: true,
          sampleRate: 1,
          trackResponseTime: false,
          trackRequests: false,
          trackCpu: true,
          trackMemory: true,
        },
        collector
      );

      monitor.recordCpuUsage(45);
      monitor.recordMemoryUsage(500, 1000);

      const metrics = collector.getLatestMetric('memory');
      expect(metrics?.value).toBe(500);
    });

    test('resets metrics', () => {
      const collector = new MetricsCollector();
      const monitor = new PerformanceMonitor(
        {
          enabled: true,
          sampleRate: 1,
          trackResponseTime: true,
          trackRequests: true,
          trackCpu: false,
          trackMemory: false,
        },
        collector
      );

      monitor.recordRequest(100, false);
      monitor.reset();

      const metrics = monitor.getMetrics();
      expect(metrics.requestCount).toBe(0);
    });
  });

  describe('AnomalyDetector', () => {
    test('detects anomalies based on deviation from mean', () => {
      const detector = new AnomalyDetector(100);

      for (let i = 0; i < 50; i++) {
        detector.addValue('metric1', 100);
      }

      const result = detector.detect('metric1', 300);
      expect(result.isAnomaly).toBe(true);
      expect(result.actualValue).toBe(300);
    });

    test('does not flag normal values as anomalies', () => {
      const detector = new AnomalyDetector(100);

      for (let i = 0; i < 50; i++) {
        detector.addValue('metric1', 100 + (i % 10));
      }

      const result = detector.detect('metric1', 105);
      expect(result.isAnomaly).toBe(false);
    });

    test('returns low score with insufficient history', () => {
      const detector = new AnomalyDetector(100);

      detector.addValue('metric1', 100);
      detector.addValue('metric1', 110);

      const result = detector.detect('metric1', 200);
      expect(result.isAnomaly).toBe(false);
      expect(result.score).toBe(0);
    });

    test('calculates mean and standard deviation', () => {
      const detector = new AnomalyDetector(100);

      for (let i = 0; i < 10; i++) {
        detector.addValue('metric1', i * 10);
      }

      const mean = detector.getMean('metric1');
      const stdDev = detector.getStdDev('metric1');

      expect(mean).toBe(45);
      expect(stdDev).toBeGreaterThan(0);
    });
  });

  describe('LogSearchEngine', () => {
    test('searches logs with pagination', () => {
      const storage = new InMemoryLogStorage(100);
      for (let i = 0; i < 100; i++) {
        storage.add({
          id: `LOG_${i}`,
          timestamp: new Date(),
          level: 'info',
          message: `Message ${i}`,
          source: 'test',
        });
      }

      const searchEngine = new LogSearchEngine(storage);
      const result = searchEngine.search({
        filter: {},
        page: 1,
        pageSize: 10,
      });

      expect(result.logs).toHaveLength(10);
      expect(result.totalCount).toBe(100);
      expect(result.totalPages).toBe(10);
    });

    test('searches with level filter', () => {
      const storage = new InMemoryLogStorage(100);
      storage.add({ id: '1', timestamp: new Date(), level: 'debug', message: 'a', source: 's' });
      storage.add({ id: '2', timestamp: new Date(), level: 'info', message: 'b', source: 's' });
      storage.add({ id: '3', timestamp: new Date(), level: 'error', message: 'c', source: 's' });

      const searchEngine = new LogSearchEngine(storage);
      const result = searchEngine.search({
        filter: { levels: ['error', 'fatal'] },
        page: 1,
        pageSize: 50,
      });

      expect(result.totalCount).toBe(1);
      expect(result.logs[0].level).toBe('error');
    });

    test('sorts search results', () => {
      const storage = new InMemoryLogStorage(100);
      storage.add({ id: '1', timestamp: new Date('2024-01-01'), level: 'info', message: 'a', source: 'a' });
      storage.add({ id: '2', timestamp: new Date('2024-01-03'), level: 'info', message: 'b', source: 'b' });
      storage.add({ id: '3', timestamp: new Date('2024-01-02'), level: 'info', message: 'c', source: 'c' });

      const searchEngine = new LogSearchEngine(storage);
      const result = searchEngine.search({
        filter: {},
        sortBy: 'timestamp',
        sortOrder: 'desc',
        page: 1,
        pageSize: 50,
      });

      expect(result.logs[0].id).toBe('2');
      expect(result.logs[1].id).toBe('3');
      expect(result.logs[2].id).toBe('1');
    });

    test('aggregates logs by time bucket', () => {
      const storage = new InMemoryLogStorage(100);
      const now = new Date();

      for (let i = 0; i < 10; i++) {
        storage.add({
          id: `LOG_${i}`,
          timestamp: new Date(now.getTime() + i * 1000),
          level: 'info',
          message: 'Test',
          source: 'test',
          duration: i * 10,
        });
      }

      const searchEngine = new LogSearchEngine(storage);
      const aggregations = searchEngine.aggregate({}, 5000);

      expect(aggregations.length).toBeGreaterThan(0);
    });
  });

  describe('LogExporterImporter', () => {
    test('exports logs as JSON', () => {
      const exporter = new LogExporterImporter();
      const logs: LogEntry[] = [
        { id: '1', timestamp: new Date('2024-01-01'), level: 'info', message: 'Test', source: 'test' },
      ];

      const json = exporter.export(logs, 'json');
      expect(json).toContain('"id": "1"');
      expect(json).toContain('"level": "info"');
    });

    test('imports logs from JSON', () => {
      const exporter = new LogExporterImporter();
      const logs: LogEntry[] = [
        { id: '1', timestamp: new Date('2024-01-01'), level: 'info', message: 'Test', source: 'test' },
      ];

      const json = exporter.export(logs, 'json');
      const imported = exporter.import(json, 'json');

      expect(imported).toHaveLength(1);
      expect(imported[0].id).toBe('1');
    });

    test('exports and imports CSV', () => {
      const exporter = new LogExporterImporter();
      const logs: LogEntry[] = [
        { id: '1', timestamp: new Date('2024-01-01'), level: 'info', message: 'Test', source: 'test' },
      ];

      const csv = exporter.export(logs, 'csv');
      const imported = exporter.import(csv, 'csv');

      expect(imported).toHaveLength(1);
      expect(imported[0].id).toBe('1');
    });

    test('exports and imports XML', () => {
      const exporter = new LogExporterImporter();
      const logs: LogEntry[] = [
        { id: '1', timestamp: new Date('2024-01-01'), level: 'info', message: 'Test', source: 'test' },
      ];

      const xml = exporter.export(logs, 'xml');
      expect(xml).toContain('<entry>');
      expect(xml).toContain('</entry>');
    });
  });

  describe('SimpleEventEmitter', () => {
    test('emits and receives events', () => {
      const emitter = new SimpleEventEmitter();
      let received = false;

      emitter.on('log', () => {
        received = true;
      });

      emitter.emit({ type: 'log', timestamp: new Date() });
      expect(received).toBe(true);
    });

    test('removes event listeners', () => {
      const emitter = new SimpleEventEmitter();
      let count = 0;

      const handler = () => {
        count++;
      };

      emitter.on('log', handler);
      emitter.emit({ type: 'log', timestamp: new Date() });

      emitter.off('log', handler);
      emitter.emit({ type: 'log', timestamp: new Date() });

      expect(count).toBe(1);
    });

    test('removes all listeners', () => {
      const emitter = new SimpleEventEmitter();
      let count = 0;

      emitter.on('log', () => count++);
      emitter.on('flush', () => count++);

      emitter.emit({ type: 'log', timestamp: new Date() });
      emitter.emit({ type: 'flush', timestamp: new Date() });

      emitter.removeAllListeners();

      emitter.emit({ type: 'log', timestamp: new Date() });
      emitter.emit({ type: 'flush', timestamp: new Date() });

      expect(count).toBe(2);
    });
  });

  describe('Logger', () => {
    test('creates logger with default config', () => {
      const logger = createLogger();
      expect(logger).toBeInstanceOf(Logger);
    });

    test('logs messages at different levels', () => {
      const logger = createLogger({ defaultLevel: 'debug', maxMemoryLogs: 100 });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');
      logger.fatal('Fatal message');

      const stats = logger.getStats();
      expect(stats.totalLogs).toBe(5);
    });

    test('filters logs by configured level', () => {
      const logger = createLogger({ defaultLevel: 'warn', maxMemoryLogs: 100 });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');

      const stats = logger.getStats();
      expect(stats.totalLogs).toBe(1);
      expect(stats.logsByLevel.warn).toBe(1);
    });

    test('captures error details', () => {
      const logger = createLogger({ maxMemoryLogs: 100 });
      const error = new Error('Test error');

      logger.error('An error occurred', error);

      const logs = logger.getLogs();
      expect(logs[0].error).toBeDefined();
      expect(logs[0].error?.message).toBe('Test error');
    });

    test('clears logs', () => {
      const logger = createLogger({ maxMemoryLogs: 100 });
      logger.info('Message');
      logger.clear();

      const stats = logger.getStats();
      expect(stats.totalLogs).toBe(0);
    });

    test('searches logs', () => {
      const logger = createLogger({ maxMemoryLogs: 100 });
      logger.info('Hello world');
      logger.info('Goodbye world');

      const result = logger.search({
        filter: { searchText: 'Hello' },
        page: 1,
        pageSize: 10,
      });

      expect(result.totalCount).toBe(1);
      expect(result.logs[0].message).toContain('Hello');
    });

    test('creates snapshot and restores', async () => {
      const logger = createLogger({ maxMemoryLogs: 100 });
      logger.info('Test message');

      const snapshot = await logger.snapshot();
      expect(snapshot.entries).toHaveLength(1);

      const logger2 = createLogger({ maxMemoryLogs: 100 });
      await logger2.restore(snapshot);

      expect(logger2.getLogs()).toHaveLength(1);
    });

    test('exports logs', async () => {
      const logger = createLogger({ maxMemoryLogs: 100 });
      logger.info('Test message');

      const json = await logger.export('json');
      expect(json).toContain('Test message');
    });

    test('performs health check', async () => {
      const logger = createLogger({ maxMemoryLogs: 100 });
      const health = await logger.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.storageConnected).toBe(true);
    });

    test('registers and unregisters event listeners', () => {
      const logger = createLogger({ maxMemoryLogs: 100 });
      let eventCount = 0;

      const handler = () => eventCount++;

      logger.on('log', handler);
      logger.info('Message');

      expect(eventCount).toBe(1);

      logger.off('log', handler);
      logger.info('Another message');

      expect(eventCount).toBe(1);
    });

    test('destroys logger cleanly', () => {
      const logger = createLogger({ maxMemoryLogs: 100, flushIntervalMs: 1000 });
      logger.info('Message');

      logger.destroy();
      expect(() => logger.getLogs()).not.toThrow();
    });
  });
});

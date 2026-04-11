import {
  TimeSeriesDatabase,
  TimeSeriesQuery,
  TimeSeriesAggregatedPoint,
  AlertCondition,
  AlertNotification,
  DownsampleConfig,
} from '../src/core/timeSeriesDB';

describe('TimeSeriesDatabase', () => {
  let db: TimeSeriesDatabase;

  beforeEach(() => {
    db = new TimeSeriesDatabase();
  });

  describe('Metric Management', () => {
    test('should create a metric with all required fields', () => {
      const metric = db.createMetric('cpu_usage', 'percent', 'CPU usage percentage', { env: 'prod' });
      expect(metric.id).toMatch(/^metric_[a-f0-9]{16}$/);
      expect(metric.name).toBe('cpu_usage');
      expect(metric.unit).toBe('percent');
      expect(metric.description).toBe('CPU usage percentage');
      expect(metric.tags).toEqual({ env: 'prod' });
      expect(metric.createdAt).toBeLessThanOrEqual(Date.now());
      expect(metric.updatedAt).toBeLessThanOrEqual(Date.now());
    });

    test('should create metric with default empty tags', () => {
      const metric = db.createMetric('memory_usage', 'MB');
      expect(metric.tags).toEqual({});
    });

    test('should get metric by id', () => {
      const created = db.createMetric('test_metric', 'units');
      const retrieved = db.getMetric(created.id);
      expect(retrieved).toEqual(created);
    });

    test('should return undefined for non-existent metric', () => {
      const retrieved = db.getMetric('non_existent_id');
      expect(retrieved).toBeUndefined();
    });

    test('should get all metrics', () => {
      db.createMetric('metric1', 'unit1');
      db.createMetric('metric2', 'unit2');
      const metrics = db.getAllMetrics();
      expect(metrics).toHaveLength(2);
    });

    test('should delete metric by id', () => {
      const metric = db.createMetric('to_delete', 'units');
      const result = db.deleteMetric(metric.id);
      expect(result).toBe(true);
      expect(db.getMetric(metric.id)).toBeUndefined();
    });

    test('should return false when deleting non-existent metric', () => {
      const result = db.deleteMetric('non_existent');
      expect(result).toBe(false);
    });
  });

  describe('Data Ingestion', () => {
    test('should ingest data point for existing metric', () => {
      const metric = db.createMetric('temperature', 'celsius');
      const point = db.ingest(metric.id, 25.5);
      expect(point).not.toBeNull();
      expect(point?.metricId).toBe(metric.id);
      expect(point?.value).toBe(25.5);
      expect(point?.timestamp).toBeLessThanOrEqual(Date.now());
      expect(point?.tags).toEqual({});
    });

    test('should ingest with custom timestamp and tags', () => {
      const metric = db.createMetric('humidity', 'percent');
      const customTimestamp = Date.now() - 10000;
      const point = db.ingest(metric.id, 65.0, {
        timestamp: customTimestamp,
        tags: { sensor: 'S1' },
      });
      expect(point?.timestamp).toBe(customTimestamp);
      expect(point?.tags).toEqual({ sensor: 'S1' });
    });

    test('should return null when ingesting to non-existent metric', () => {
      const point = db.ingest('non_existent', 100);
      expect(point).toBeNull();
    });

    test('should increment stats on ingestion', () => {
      const metric = db.createMetric('requests', 'count');
      db.ingest(metric.id, 1);
      db.ingest(metric.id, 2);
      const stats = db.getStats();
      expect(stats.totalDataPoints).toBe(2);
      expect(stats.ingestedDataPoints).toBe(2);
    });
  });

  describe('Time Series Queries', () => {
    test('should query data points within time range', () => {
      const metric = db.createMetric('requests', 'count');
      const now = Date.now();
      db.ingest(metric.id, 10, { timestamp: now - 1000 });
      db.ingest(metric.id, 20, { timestamp: now - 500 });
      db.ingest(metric.id, 30, { timestamp: now });

      const query: TimeSeriesQuery = {
        metricId: metric.id,
        startTime: now - 1000,
        endTime: now,
      };
      const results = db.query(query);
      expect(results).toHaveLength(3);
    });

    test('should filter by tags in query', () => {
      const metric = db.createMetric('events', 'count');
      db.ingest(metric.id, 1, { tags: { region: 'us' } });
      db.ingest(metric.id, 2, { tags: { region: 'eu' } });
      db.ingest(metric.id, 3, { tags: { region: 'us' } });

      const query: TimeSeriesQuery = {
        metricId: metric.id,
        startTime: 0,
        endTime: Date.now(),
        tags: { region: 'us' },
      };
      const results = db.query(query);
      expect(results).toHaveLength(2);
    });

    test('should apply limit to query results', () => {
      const metric = db.createMetric('values', 'number');
      for (let i = 1; i <= 10; i++) {
        db.ingest(metric.id, i);
      }

      const query: TimeSeriesQuery = {
        metricId: metric.id,
        startTime: 0,
        endTime: Date.now(),
        limit: 5,
      };
      const results = db.query(query);
      expect(results).toHaveLength(5);
    });
  });

  describe('Aggregation', () => {
    test('should aggregate with sum', () => {
      const metric = db.createMetric('revenue', 'dollars');
      const now = Date.now();
      db.ingest(metric.id, 100, { timestamp: now - 120000 });
      db.ingest(metric.id, 200, { timestamp: now - 120000 });
      db.ingest(metric.id, 150, { timestamp: now - 60000 });

      const query: TimeSeriesQuery = {
        metricId: metric.id,
        startTime: now - 130000,
        endTime: now,
        aggregation: 'sum',
        interval: '1m',
      };
      const results = db.query(query) as TimeSeriesAggregatedPoint[];
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].sum).toBeDefined();
    });

    test('should aggregate with avg', () => {
      const metric = db.createMetric('temperature', 'celsius');
      const now = Date.now();
      db.ingest(metric.id, 20, { timestamp: now - 120000 });
      db.ingest(metric.id, 30, { timestamp: now - 120000 });
      db.ingest(metric.id, 25, { timestamp: now - 60000 });

      const query: TimeSeriesQuery = {
        metricId: metric.id,
        startTime: now - 130000,
        endTime: now,
        aggregation: 'avg',
        interval: '1m',
      };
      const results = db.query(query) as TimeSeriesAggregatedPoint[];
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].avg).toBeDefined();
    });

    test('should aggregate with min', () => {
      const metric = db.createMetric('prices', 'dollars');
      const now = Date.now();
      const base = Math.floor(now / 900000) * 900000;
      db.ingest(metric.id, 50, { timestamp: base + 1000 });
      db.ingest(metric.id, 10, { timestamp: base + 1000 });
      db.ingest(metric.id, 30, { timestamp: base + 60000 + 1000 });

      const query: TimeSeriesQuery = {
        metricId: metric.id,
        startTime: base - 1000,
        endTime: base + 120000,
        aggregation: 'min',
        interval: '1m',
      };
      const results = db.query(query) as TimeSeriesAggregatedPoint[];
      expect(results.length).toBeGreaterThan(0);
      results.forEach(r => {
        expect(typeof r.min).toBe('number');
        expect(r.min).toBeLessThanOrEqual(r.value);
      });
    });

    test('should aggregate with max', () => {
      const metric = db.createMetric('high_scores', 'points');
      const now = Date.now();
      const base = Math.floor(now / 900000) * 900000;
      db.ingest(metric.id, 100, { timestamp: base + 1000 });
      db.ingest(metric.id, 500, { timestamp: base + 1000 });
      db.ingest(metric.id, 300, { timestamp: base + 60000 + 1000 });

      const query: TimeSeriesQuery = {
        metricId: metric.id,
        startTime: base - 1000,
        endTime: base + 120000,
        aggregation: 'max',
        interval: '1m',
      };
      const results = db.query(query) as TimeSeriesAggregatedPoint[];
      expect(results.length).toBeGreaterThan(0);
      results.forEach(r => {
        expect(typeof r.max).toBe('number');
        expect(r.max).toBeGreaterThanOrEqual(r.value);
      });
    });

    test('should aggregate with count', () => {
      const metric = db.createMetric('clicks', 'count');
      const now = Date.now();
      db.ingest(metric.id, 1, { timestamp: now - 120000 });
      db.ingest(metric.id, 1, { timestamp: now - 120000 });
      db.ingest(metric.id, 1, { timestamp: now - 60000 });

      const query: TimeSeriesQuery = {
        metricId: metric.id,
        startTime: now - 130000,
        endTime: now,
        aggregation: 'count',
        interval: '1m',
      };
      const results = db.query(query) as TimeSeriesAggregatedPoint[];
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].count).toBeDefined();
    });
  });

  describe('Downsampling', () => {
    test('should downsample data to 5m interval', () => {
      const metric = db.createMetric('data', 'units');
      const now = Date.now();
      for (let i = 0; i < 10; i++) {
        db.ingest(metric.id, i, { timestamp: now - i * 60000 });
      }

      const config: DownsampleConfig = { interval: '5m', aggregation: 'avg' };
      const results = db.downsample(metric.id, config);
      expect(results).not.toBeNull();
      expect(results!.length).toBeLessThan(10);
    });

    test('should downsample data to 1h interval', () => {
      const metric = db.createMetric('hourly_data', 'units');
      const now = Date.now();
      for (let i = 0; i < 5; i++) {
        db.ingest(metric.id, i * 10, { timestamp: now - i * 3600000 });
      }

      const config: DownsampleConfig = { interval: '1h', aggregation: 'avg' };
      const results = db.downsample(metric.id, config);
      expect(results).not.toBeNull();
      expect(results!.length).toBeLessThanOrEqual(5);
    });

    test('should return null for non-existent metric downsample', () => {
      const config: DownsampleConfig = { interval: '1m', aggregation: 'avg' };
      const results = db.downsample('non_existent', config);
      expect(results).toBeNull();
    });

    test('should return null for empty metric downsample', () => {
      const metric = db.createMetric('empty', 'units');
      const config: DownsampleConfig = { interval: '1m', aggregation: 'avg' };
      const results = db.downsample(metric.id, config);
      expect(results).toBeNull();
    });
  });

  describe('Retention Policies', () => {
    test('should create retention policy', () => {
      const policy = db.createRetentionPolicy('30day', 'cpu_.*', 30 * 24 * 60 * 60 * 1000, '1h');
      expect(policy.id).toMatch(/^retention_[a-f0-9]{16}$/);
      expect(policy.name).toBe('30day');
      expect(policy.metricPattern).toBe('cpu_.*');
      expect(policy.downsampleInterval).toBe('1h');
      expect(policy.enabled).toBe(true);
    });

    test('should get all retention policies', () => {
      db.createRetentionPolicy('policy1', '.*', 86400000);
      db.createRetentionPolicy('policy2', 'metrics.*', 172800000);
      const policies = db.getRetentionPolicies();
      expect(policies).toHaveLength(2);
    });

    test('should delete retention policy', () => {
      const policy = db.createRetentionPolicy('to_delete', '.*', 86400000);
      const result = db.deleteRetentionPolicy(policy.id);
      expect(result).toBe(true);
      expect(db.getRetentionPolicies()).toHaveLength(0);
    });

    test('should apply retention policy and delete old data', () => {
      const metric = db.createMetric('test_metric', 'units');
      const oldTimestamp = Date.now() - 100000;
      db.ingest(metric.id, 1, { timestamp: oldTimestamp });
      db.ingest(metric.id, 2, { timestamp: Date.now() });

      const policy = db.createRetentionPolicy('short', 'test_metric', 60000);
      const deleted = db.applyRetentionPolicy(policy.id);
      expect(deleted).toBe(1);
    });
  });

  describe('Alerts', () => {
    test('should create alert for existing metric', () => {
      const metric = db.createMetric('cpu', 'percent');
      const condition: AlertCondition = { type: 'above' };
      const notifications: AlertNotification[] = [{ channel: 'email', target: 'admin@example.com' }];

      const alert = db.createAlert('High CPU', metric.id, condition, 90, 60000, notifications);
      expect(alert).not.toBeNull();
      expect(alert!.name).toBe('High CPU');
      expect(alert!.threshold).toBe(90);
      expect(alert!.enabled).toBe(true);
    });

    test('should return null when creating alert for non-existent metric', () => {
      const condition: AlertCondition = { type: 'above' };
      const alert = db.createAlert('Bad Alert', 'non_existent', condition, 100, 60000, []);
      expect(alert).toBeNull();
    });

    test('should get alert by id', () => {
      const metric = db.createMetric('memory', 'MB');
      const alert = db.createAlert('Memory Alert', metric.id, { type: 'above' }, 80, 60000, []);
      const retrieved = db.getAlert(alert!.id);
      expect(retrieved).toEqual(alert);
    });

    test('should get all alerts', () => {
      const metric = db.createMetric('disk', 'percent');
      db.createAlert('Alert 1', metric.id, { type: 'above' }, 90, 60000, []);
      db.createAlert('Alert 2', metric.id, { type: 'below' }, 10, 60000, []);
      const alerts = db.getAllAlerts();
      expect(alerts).toHaveLength(2);
    });

    test('should update alert', () => {
      const metric = db.createMetric('cpu', 'percent');
      const alert = db.createAlert('Original', metric.id, { type: 'above' }, 90, 60000, []);
      const updated = db.updateAlert(alert!.id, { threshold: 95, name: 'Updated' });
      expect(updated!.threshold).toBe(95);
      expect(updated!.name).toBe('Updated');
    });

    test('should delete alert', () => {
      const metric = db.createMetric('cpu', 'percent');
      const alert = db.createAlert('To Delete', metric.id, { type: 'above' }, 90, 60000, []);
      const result = db.deleteAlert(alert!.id);
      expect(result).toBe(true);
      expect(db.getAlert(alert!.id)).toBeUndefined();
    });

    test('should evaluate alerts and trigger when condition met', () => {
      const metric = db.createMetric('temperature', 'celsius');
      db.ingest(metric.id, 50, { timestamp: Date.now() - 1000 });
      db.ingest(metric.id, 95, { timestamp: Date.now() });

      db.createAlert(
        'High Temp',
        metric.id,
        { type: 'above' },
        90,
        120000,
        [{ channel: 'sms', target: '+1234567890' }]
      );

      const triggered = db.evaluateAlerts();
      expect(triggered.length).toBeGreaterThan(0);
    });

    test('should not trigger alert when condition not met', () => {
      const metric = db.createMetric('temperature', 'celsius');
      db.ingest(metric.id, 30, { timestamp: Date.now() });

      db.createAlert(
        'Low Temp',
        metric.id,
        { type: 'below' },
        20,
        120000,
        [{ channel: 'sms', target: '+1234567890' }]
      );

      const triggered = db.evaluateAlerts();
      expect(triggered.length).toBe(0);
    });

    test('should get alert events', () => {
      const metric = db.createMetric('pressure', 'psi');
      db.ingest(metric.id, 100, { timestamp: Date.now() });

      const alert = db.createAlert('High Pressure', metric.id, { type: 'above' }, 90, 60000, []);
      db.evaluateAlerts();

      const events = db.getAlertEvents(alert!.id);
      expect(events.length).toBeGreaterThan(0);
    });

    test('should get all alert events when no alertId provided', () => {
      const metric = db.createMetric('speed', 'mph');
      db.ingest(metric.id, 100, { timestamp: Date.now() });

      db.createAlert('Speed Alert', metric.id, { type: 'above' }, 90, 60000, []);
      db.evaluateAlerts();

      const events = db.getAlertEvents();
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('Alert Condition Types', () => {
    test('should trigger on above condition', () => {
      const metric = db.createMetric('value', 'units');
      db.ingest(metric.id, 150, { timestamp: Date.now() });

      db.createAlert('Above', metric.id, { type: 'above' }, 100, 60000, []);
      const triggered = db.evaluateAlerts();
      expect(triggered.length).toBe(1);
    });

    test('should trigger on below condition', () => {
      const metric = db.createMetric('value', 'units');
      db.ingest(metric.id, 5, { timestamp: Date.now() });

      db.createAlert('Below', metric.id, { type: 'below' }, 10, 60000, []);
      const triggered = db.evaluateAlerts();
      expect(triggered.length).toBe(1);
    });

    test('should trigger on equals condition', () => {
      const metric = db.createMetric('value', 'units');
      db.ingest(metric.id, 50, { timestamp: Date.now() });

      db.createAlert('Equals', metric.id, { type: 'equals' }, 50, 60000, []);
      const triggered = db.evaluateAlerts();
      expect(triggered.length).toBe(1);
    });

    test('should trigger on change condition', () => {
      const metric = db.createMetric('value', 'units');
      const now = Date.now();
      db.ingest(metric.id, 100, { timestamp: now - 1000 });
      db.ingest(metric.id, 200, { timestamp: now });

      db.createAlert(
        'Change',
        metric.id,
        { type: 'change', changePercent: 50 },
        100,
        120000,
        []
      );
      const triggered = db.evaluateAlerts();
      expect(triggered.length).toBe(1);
    });
  });

  describe('Stats', () => {
    test('should return accurate stats', () => {
      const metric = db.createMetric('stats_test', 'units');
      db.ingest(metric.id, 1);
      db.ingest(metric.id, 2);
      db.ingest(metric.id, 3);

      const stats = db.getStats();
      expect(stats.totalMetrics).toBe(1);
      expect(stats.totalDataPoints).toBe(3);
      expect(stats.ingestedDataPoints).toBe(3);
    });

    test('should track active and triggered alerts in stats', () => {
      const metric = db.createMetric('alert_stats', 'units');
      db.createAlert('Alert 1', metric.id, { type: 'above' }, 90, 60000, []);
      db.createAlert('Alert 2', metric.id, { type: 'below' }, 10, 60000, []);

      const stats = db.getStats();
      expect(stats.activeAlerts).toBe(2);
    });
  });

  describe('Clear', () => {
    test('should clear all data', () => {
      const metric = db.createMetric('to_clear', 'units');
      db.ingest(metric.id, 1);
      db.createAlert('Alert', metric.id, { type: 'above' }, 90, 60000, []);
      db.createRetentionPolicy('policy', '.*', 86400000);

      db.clear();

      expect(db.getAllMetrics()).toHaveLength(0);
      expect(db.getAllAlerts()).toHaveLength(0);
      expect(db.getRetentionPolicies()).toHaveLength(0);
      expect(db.getStats().totalDataPoints).toBe(0);
    });
  });

  describe('ID Generation', () => {
    test('should generate unique IDs with prefix', () => {
      const id1 = db.generateId('test');
      const id2 = db.generateId('test');
      expect(id1).toMatch(/^test_[a-f0-9]{16}$/);
      expect(id2).toMatch(/^test_[a-f0-9]{16}$/);
      expect(id1).not.toBe(id2);
    });

    test('should generate different IDs for different prefixes', () => {
      const id1 = db.generateId('metric');
      const id2 = db.generateId('alert');
      expect(id1.startsWith('metric_')).toBe(true);
      expect(id2.startsWith('alert_')).toBe(true);
    });
  });

  describe('Downsample Intervals', () => {
    test('should handle 1m interval', () => {
      const metric = db.createMetric('minute_data', 'units');
      const now = Date.now();
      for (let i = 0; i < 5; i++) {
        db.ingest(metric.id, i, { timestamp: now - i * 60000 });
      }

      const results = db.downsample(metric.id, { interval: '1m', aggregation: 'avg' });
      expect(results).not.toBeNull();
    });

    test('should handle 15m interval', () => {
      const metric = db.createMetric('fifteen_min', 'units');
      const now = Date.now();
      for (let i = 0; i < 20; i++) {
        db.ingest(metric.id, i, { timestamp: now - i * 60000 });
      }

      const results = db.downsample(metric.id, { interval: '15m', aggregation: 'avg' });
      expect(results).not.toBeNull();
      expect(results!.length).toBeLessThan(20);
    });

    test('should handle 1d interval', () => {
      const metric = db.createMetric('daily_data', 'units');
      const now = Date.now();
      for (let i = 0; i < 10; i++) {
        db.ingest(metric.id, i, { timestamp: now - i * 86400000 });
      }

      const results = db.downsample(metric.id, { interval: '1d', aggregation: 'avg' });
      expect(results).not.toBeNull();
    });
  });
});

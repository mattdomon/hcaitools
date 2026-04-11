import * as crypto from 'crypto';

export interface DataPoint<T = number> {
  timestamp: number;
  value: T;
}

export interface TimeSeriesMetric {
  id: string;
  name: string;
  description: string;
  unit: string;
  tags: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

export interface TimeSeriesDataPoint extends DataPoint {
  metricId: string;
  tags: Record<string, string>;
}

export interface TimeSeriesQuery {
  metricId: string;
  startTime: number;
  endTime: number;
  aggregation?: AggregationType;
  interval?: DownsampleInterval;
  tags?: Record<string, string>;
  limit?: number;
}

export interface TimeSeriesAggregatedPoint extends DataPoint {
  count: number;
  min: number;
  max: number;
  sum: number;
  avg: number;
}

export interface RetentionPolicy {
  id: string;
  name: string;
  metricPattern: string;
  duration: number;
  downsampleInterval?: DownsampleInterval;
  enabled: boolean;
  createdAt: number;
}

export interface TimeBasedAlert {
  id: string;
  name: string;
  metricId: string;
  condition: AlertCondition;
  threshold: number;
  evaluationInterval: number;
  notifications: AlertNotification[];
  enabled: boolean;
  lastTriggered?: number;
  createdAt: number;
  updatedAt: number;
}

export interface AlertCondition {
  type: 'above' | 'below' | 'equals' | 'change';
  comparisonValue?: number;
  changePercent?: number;
}

export interface AlertNotification {
  channel: string;
  target: string;
}

export interface AlertEvent {
  id: string;
  alertId: string;
  triggeredAt: number;
  value: number;
  threshold: number;
  notificationSent: boolean;
}

export interface DownsampleConfig {
  interval: DownsampleInterval;
  aggregation: AggregationType;
}

export type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count';

export type DownsampleInterval = '1m' | '5m' | '15m' | '1h' | '1d';

export interface TimeSeriesStats {
  totalMetrics: number;
  totalDataPoints: number;
  ingestedDataPoints: number;
  aggregatedQueries: number;
  activeAlerts: number;
  triggeredAlerts: number;
}

export interface IngestionOptions {
  timestamp?: number;
  tags?: Record<string, string>;
}

export class TimeSeriesDatabase {
  private metrics: Map<string, TimeSeriesMetric> = new Map();
  private dataPoints: Map<string, TimeSeriesDataPoint[]> = new Map();
  private retentionPolicies: Map<string, RetentionPolicy> = new Map();
  private alerts: Map<string, TimeBasedAlert> = new Map();
  private alertEvents: AlertEvent[] = [];

  private stats: TimeSeriesStats = {
    totalMetrics: 0,
    totalDataPoints: 0,
    ingestedDataPoints: 0,
    aggregatedQueries: 0,
    activeAlerts: 0,
    triggeredAlerts: 0,
  };

  generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }

  createMetric(
    name: string,
    unit: string,
    description: string = '',
    tags: Record<string, string> = {}
  ): TimeSeriesMetric {
    const now = Date.now();
    const metric: TimeSeriesMetric = {
      id: this.generateId('metric'),
      name,
      description,
      unit,
      tags,
      createdAt: now,
      updatedAt: now,
    };
    this.metrics.set(metric.id, metric);
    this.dataPoints.set(metric.id, []);
    this.stats.totalMetrics++;
    return metric;
  }

  getMetric(id: string): TimeSeriesMetric | undefined {
    return this.metrics.get(id);
  }

  getAllMetrics(): TimeSeriesMetric[] {
    return Array.from(this.metrics.values());
  }

  deleteMetric(id: string): boolean {
    if (!this.metrics.has(id)) return false;
    this.metrics.delete(id);
    this.dataPoints.delete(id);
    this.stats.totalMetrics--;
    return true;
  }

  ingest(
    metricId: string,
    value: number,
    options: IngestionOptions = {}
  ): TimeSeriesDataPoint | null {
    const metric = this.metrics.get(metricId);
    if (!metric) return null;

    const timestamp = options.timestamp ?? Date.now();
    const point: TimeSeriesDataPoint = {
      metricId,
      timestamp,
      value,
      tags: options.tags ?? {},
    };

    const points = this.dataPoints.get(metricId) ?? [];
    points.push(point);
    this.dataPoints.set(metricId, points);
    this.stats.totalDataPoints++;
    this.stats.ingestedDataPoints++;
    return point;
  }

  query(query: TimeSeriesQuery): (TimeSeriesDataPoint | TimeSeriesAggregatedPoint)[] {
    const points = this.dataPoints.get(query.metricId) ?? [];
    let filtered = points.filter(
      (p) => p.timestamp >= query.startTime && p.timestamp <= query.endTime
    );

    if (query.tags) {
      filtered = filtered.filter((p) => {
        for (const [key, value] of Object.entries(query.tags ?? {})) {
          if (p.tags[key] !== value) return false;
        }
        return true;
      });
    }

    if (query.limit) {
      filtered = filtered.slice(-query.limit);
    }

    if (query.aggregation && query.interval) {
      this.stats.aggregatedQueries++;
      return this.aggregate(filtered, query.aggregation, query.interval, query.startTime, query.endTime);
    }

    return filtered;
  }

  aggregate(
    points: TimeSeriesDataPoint[],
    aggregation: AggregationType,
    interval: DownsampleInterval,
    startTime: number,
    endTime: number
  ): TimeSeriesAggregatedPoint[] {
    if (points.length === 0) return [];

    const intervalMs = this.intervalToMs(interval);
    const buckets = new Map<number, number[]>();

    for (const point of points) {
      const bucketKey = Math.floor(point.timestamp / intervalMs) * intervalMs;
      const bucket = buckets.get(bucketKey) ?? [];
      bucket.push(point.value);
      buckets.set(bucketKey, bucket);
    }

    const result: TimeSeriesAggregatedPoint[] = [];
    const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);

    for (const key of sortedKeys) {
      if (key < startTime || key > endTime) continue;
      const values = buckets.get(key) ?? [];
      if (values.length === 0) continue;

      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);

      result.push({
        timestamp: key,
        value: this.getAggregatedValue(aggregation, sum, avg, min, max, values.length),
        count: values.length,
        min,
        max,
        sum,
        avg,
      });
    }

    return result;
  }

  private getAggregatedValue(
    type: AggregationType,
    sum: number,
    avg: number,
    min: number,
    max: number,
    count: number
  ): number {
    switch (type) {
      case 'sum': return sum;
      case 'avg': return avg;
      case 'min': return min;
      case 'max': return max;
      case 'count': return count;
    }
  }

  private intervalToMs(interval: DownsampleInterval): number {
    switch (interval) {
      case '1m': return 60 * 1000;
      case '5m': return 5 * 60 * 1000;
      case '15m': return 15 * 60 * 1000;
      case '1h': return 60 * 60 * 1000;
      case '1d': return 24 * 60 * 60 * 1000;
    }
  }

  downsample(
    metricId: string,
    config: DownsampleConfig
  ): TimeSeriesAggregatedPoint[] | null {
    const points = this.dataPoints.get(metricId) ?? [];
    if (points.length === 0) return null;

    const startTime = Math.min(...points.map((p) => p.timestamp));
    const endTime = Math.max(...points.map((p) => p.timestamp));

    return this.aggregate(points, config.aggregation, config.interval, startTime, endTime);
  }

  createRetentionPolicy(
    name: string,
    metricPattern: string,
    duration: number,
    downsampleInterval?: DownsampleInterval
  ): RetentionPolicy {
    const policy: RetentionPolicy = {
      id: this.generateId('retention'),
      name,
      metricPattern,
      duration,
      downsampleInterval,
      enabled: true,
      createdAt: Date.now(),
    };
    this.retentionPolicies.set(policy.id, policy);
    return policy;
  }

  getRetentionPolicies(): RetentionPolicy[] {
    return Array.from(this.retentionPolicies.values());
  }

  deleteRetentionPolicy(id: string): boolean {
    return this.retentionPolicies.delete(id);
  }

  applyRetentionPolicy(policyId: string): number {
    const policy = this.retentionPolicies.get(policyId);
    if (!policy || !policy.enabled) return 0;

    const cutoffTime = Date.now() - policy.duration;
    let deletedCount = 0;

    for (const [metricId, points] of this.dataPoints.entries()) {
      const metric = this.metrics.get(metricId);
      if (!metric) continue;
      const matches = metric.name.match(new RegExp(policy.metricPattern));
      if (!matches && policy.metricPattern !== '*') continue;

      const filtered = points.filter((p) => p.timestamp >= cutoffTime);
      deletedCount += points.length - filtered.length;
      this.dataPoints.set(metricId, filtered);

      if (policy.downsampleInterval && filtered.length > 0) {
        const aggregated = this.downsample(metricId, {
          interval: policy.downsampleInterval,
          aggregation: 'avg',
        });
        if (aggregated) {
          const newPoints: TimeSeriesDataPoint[] = aggregated.map((a) => ({
            metricId,
            timestamp: a.timestamp,
            value: a.value,
            tags: {},
          }));
          this.dataPoints.set(metricId, newPoints);
        }
      }
    }

    this.stats.totalDataPoints -= deletedCount;
    return deletedCount;
  }

  createAlert(
    name: string,
    metricId: string,
    condition: AlertCondition,
    threshold: number,
    evaluationInterval: number,
    notifications: AlertNotification[]
  ): TimeBasedAlert | null {
    const metric = this.metrics.get(metricId);
    if (!metric) return null;

    const now = Date.now();
    const alert: TimeBasedAlert = {
      id: this.generateId('alert'),
      name,
      metricId,
      condition,
      threshold,
      evaluationInterval,
      notifications,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    this.alerts.set(alert.id, alert);
    this.stats.activeAlerts++;
    return alert;
  }

  getAlert(id: string): TimeBasedAlert | undefined {
    return this.alerts.get(id);
  }

  getAllAlerts(): TimeBasedAlert[] {
    return Array.from(this.alerts.values());
  }

  updateAlert(id: string, updates: Partial<TimeBasedAlert>): TimeBasedAlert | null {
    const alert = this.alerts.get(id);
    if (!alert) return null;

    const updated: TimeBasedAlert = {
      ...alert,
      ...updates,
      id: alert.id,
      createdAt: alert.createdAt,
      updatedAt: Date.now(),
    };
    this.alerts.set(id, updated);
    return updated;
  }

  deleteAlert(id: string): boolean {
    if (!this.alerts.has(id)) return false;
    this.alerts.delete(id);
    this.stats.activeAlerts--;
    return true;
  }

  evaluateAlerts(_callback?: (alert: TimeBasedAlert, event: AlertEvent) => void): AlertEvent[] {
    const now = Date.now();
    const triggered: AlertEvent[] = [];

    for (const alert of this.alerts.values()) {
      if (!alert.enabled) continue;

      const shouldTrigger = this.checkAlertCondition(alert, now);
      if (shouldTrigger) {
        const event = this.triggerAlert(alert);
        triggered.push(event);
        if (_callback) {
          _callback(alert, event);
        }
      }
    }

    return triggered;
  }

  private checkAlertCondition(alert: TimeBasedAlert, now: number): boolean {
    const points = this.dataPoints.get(alert.metricId) ?? [];
    const recentPoints = points.filter(
      (p) => p.timestamp >= now - alert.evaluationInterval && p.timestamp <= now
    );

    if (recentPoints.length === 0) return false;

    const latestValue = recentPoints[recentPoints.length - 1].value;

    switch (alert.condition.type) {
      case 'above':
        return latestValue > alert.threshold;
      case 'below':
        return latestValue < alert.threshold;
      case 'equals':
        return Math.abs(latestValue - alert.threshold) < 0.0001;
      case 'change':
        if (recentPoints.length < 2) return false;
        const oldValue = recentPoints[0].value;
        const changePercent = Math.abs((latestValue - oldValue) / oldValue) * 100;
        return changePercent >= (alert.condition.changePercent ?? 0);
    }
  }

  private triggerAlert(alert: TimeBasedAlert): AlertEvent {
    const points = this.dataPoints.get(alert.metricId) ?? [];
    const latestValue = points.length > 0 ? points[points.length - 1].value : 0;

    const event: AlertEvent = {
      id: this.generateId('event'),
      alertId: alert.id,
      triggeredAt: Date.now(),
      value: latestValue,
      threshold: alert.threshold,
      notificationSent: alert.notifications.length > 0,
    };

    this.alertEvents.push(event);
    alert.lastTriggered = event.triggeredAt;
    this.stats.triggeredAlerts++;

    return event;
  }

  getAlertEvents(alertId?: string): AlertEvent[] {
    if (alertId) {
      return this.alertEvents.filter((e) => e.alertId === alertId);
    }
    return [...this.alertEvents];
  }

  getStats(): TimeSeriesStats {
    return { ...this.stats };
  }

  clear(): void {
    this.metrics.clear();
    this.dataPoints.clear();
    this.retentionPolicies.clear();
    this.alerts.clear();
    this.alertEvents = [];
    this.stats = {
      totalMetrics: 0,
      totalDataPoints: 0,
      ingestedDataPoints: 0,
      aggregatedQueries: 0,
      activeAlerts: 0,
      triggeredAlerts: 0,
    };
  }
}

export const timeSeriesDB = new TimeSeriesDatabase();
export default timeSeriesDB;

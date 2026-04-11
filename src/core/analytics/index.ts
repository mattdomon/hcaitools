/**
 * Analytics & Reporting Module
 * Comprehensive analytics tracking system for Manus AI Platform
 */

export {
  TimeSeriesGranularity,
  EventPropertyType,
  FunnelStepType,
  ABTestStatus,
  ReportFormat,
  DashboardWidgetType,
  AnalyticsEvent,
  DeviceInfo,
  EventProperty,
  TimeSeriesDataPoint,
  AggregatedMetrics,
  FunnelStep,
  Funnel,
  FunnelStepDefinition,
  ABTestVariant,
  ABVariantMetrics,
  ABTest,
  StatisticalSignificance,
  Report,
  ReportPeriod,
  ReportSection,
  ReportFilter,
  DashboardWidget,
  WidgetDataSource,
  WidgetQuery,
  TimeRange,
  UserJourney,
  RetentionCohort,
  RetentionPeriod,
  Dashboard,
  DashboardLayout,
  MetricDefinition,
  RealtimeMetrics,
  AnalyticsService,
  QueryOptions,
  AggregationQuery,
  FunnelService,
  ABTestService,
  ReportService,
  DashboardService,
  UserJourneyService,
  RetentionService,
  RealtimeService,
  MetricService,
} from './types';

export {
  AnalyticsServiceImpl,
  FunnelServiceImpl,
  ABTestServiceImpl,
  ReportServiceImpl,
  DashboardServiceImpl,
  UserJourneyServiceImpl,
  RetentionServiceImpl,
  RealtimeServiceImpl,
  MetricServiceImpl,
  createAnalyticsService,
} from './analytics';

import {
  AnalyticsServiceImpl,
  createAnalyticsService,
} from './analytics';

import {
  QueryOptions,
  TimeRange,
  TimeSeriesGranularity,
} from './types';

export class AnalyticsManus {
  private service: AnalyticsServiceImpl;

  constructor() {
    this.service = createAnalyticsService();
  }

  async trackEvent(eventName: string, userId: string | undefined, sessionId: string, properties?: Record<string, unknown>) {
    return this.service.track({ eventName, userId, sessionId, properties: properties || {} });
  }

  async trackPageView(userId: string | undefined, sessionId: string, page: string, properties?: Record<string, unknown>) {
    return this.service.trackPageView(userId, sessionId, page, properties);
  }

  async trackConversion(userId: string, sessionId: string, conversionName: string, value?: number) {
    return this.service.trackConversion(userId, sessionId, conversionName, value);
  }

  async getEvent(eventId: string) {
    return this.service.getEvent(eventId);
  }

  async getUserEvents(userId: string, options?: QueryOptions) {
    return this.service.getEventsByUser(userId, options);
  }

  async getSessionEvents(sessionId: string) {
    return this.service.getEventsBySession(sessionId);
  }

  async aggregate(eventName: string, aggregation: 'count' | 'sum' | 'average' | 'min' | 'max' | 'unique', timeRange?: TimeRange) {
    return this.service.aggregate({ eventName, aggregation, timeRange });
  }

  async getTimeSeries(eventName: string, timeRange: TimeRange, granularity: TimeSeriesGranularity) {
    return this.service.getTimeSeries(eventName, timeRange, granularity);
  }

  get funnel() {
    return this.service.getFunnelService();
  }

  get abtest() {
    return this.service.getABTestService();
  }

  get report() {
    return this.service.getReportService();
  }

  get dashboard() {
    return this.service.getDashboardService();
  }

  get journey() {
    return this.service.getUserJourneyService();
  }

  get retention() {
    return this.service.getRetentionService();
  }

  get realtime() {
    return this.service.getRealtimeService();
  }

  get metric() {
    return this.service.getMetricService();
  }
}

export function createAnalytics(): AnalyticsManus {
  return new AnalyticsManus();
}

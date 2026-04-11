/**
 * Analytics & Reporting Types
 * Comprehensive analytics tracking system for Manus AI Platform
 */

export type TimeSeriesGranularity = 'hourly' | 'daily' | 'weekly' | 'monthly';
export type EventPropertyType = 'string' | 'number' | 'boolean' | 'date' | 'array';
export type FunnelStepType = 'view' | 'click' | 'submit' | 'purchase' | 'custom';
export type ABTestStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived';
export type ReportFormat = 'summary' | 'detailed' | 'comparison' | 'trend';
export type DashboardWidgetType = 'counter' | 'chart' | 'table' | 'metric';

export interface AnalyticsEvent {
  eventId: string;
  eventName: string;
  userId?: string;
  sessionId: string;
  timestamp: Date;
  properties: Record<string, unknown>;
  metrics?: Record<string, number>;
  source?: string;
  deviceInfo?: DeviceInfo;
}

export interface DeviceInfo {
  userAgent?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  browser?: string;
  os?: string;
  screenResolution?: string;
}

export interface EventProperty {
  name: string;
  type: EventPropertyType;
  description?: string;
}

export interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  properties?: Record<string, unknown>;
}

export interface AggregatedMetrics {
  totalEvents: number;
  uniqueUsers: number;
  totalSessions: number;
  averagePerSession: number;
  data: TimeSeriesDataPoint[];
}

export interface FunnelStep {
  stepId: string;
  name: string;
  type: FunnelStepType;
  selector?: string;
  expectedConversions?: number;
  actualConversions: number;
  conversionRate: number;
  dropOffRate: number;
}

export interface Funnel {
  funnelId: string;
  name: string;
  description?: string;
  steps: FunnelStep[];
  startDate: Date;
  endDate: Date;
  totalUsers: number;
  completedUsers: number;
  overallConversionRate: number;
}

export interface FunnelStepDefinition {
  name: string;
  type: FunnelStepType;
  selector?: string;
}

export interface ABTestVariant {
  variantId: string;
  name: string;
  description?: string;
  weight: number;
  metrics: ABVariantMetrics;
  isControl: boolean;
}

export interface ABVariantMetrics {
  impressions: number;
  conversions: number;
  conversionRate: number;
  revenue?: number;
  customMetrics: Record<string, number>;
}

export interface ABTest {
  testId: string;
  name: string;
  description?: string;
  status: ABTestStatus;
  variants: ABTestVariant[];
  startDate: Date;
  endDate?: Date;
  targetMetric: string;
  minimumDetectableEffect?: number;
  statisticalSignificance: StatisticalSignificance;
  createdAt: Date;
  updatedAt: Date;
}

export interface StatisticalSignificance {
  isSignificant: boolean;
  confidenceLevel: number;
  pValue?: number;
  zScore?: number;
  sampleSizeReached: boolean;
}

export interface Report {
  reportId: string;
  name: string;
  description?: string;
  format: ReportFormat;
  generatedAt: Date;
  period: ReportPeriod;
  sections: ReportSection[];
  filters?: ReportFilter[];
}

export interface ReportPeriod {
  start: Date;
  end: Date;
}

export interface ReportSection {
  title: string;
  type: 'summary' | 'chart' | 'table' | 'metrics' | 'text';
  data: unknown;
  configuration?: Record<string, unknown>;
}

export interface ReportFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: unknown;
}

export interface DashboardWidget {
  widgetId: string;
  name: string;
  type: DashboardWidgetType;
  dataSource: WidgetDataSource;
  position: { x: number; y: number; w: number; h: number };
  refreshInterval?: number;
  configuration?: Record<string, unknown>;
}

export interface WidgetDataSource {
  type: 'events' | 'funnels' | 'abtests' | 'metrics' | 'custom';
  query: WidgetQuery;
}

export interface WidgetQuery {
  eventName?: string;
  aggregation?: 'count' | 'sum' | 'average' | 'min' | 'max' | 'unique';
  groupBy?: string[];
  filters?: Record<string, unknown>;
  timeRange?: TimeRange;
  granularity?: TimeSeriesGranularity;
}

export interface TimeRange {
  start: Date;
  end: Date;
  preset?: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'last90days' | 'thisMonth' | 'lastMonth';
}

export interface UserJourney {
  journeyId: string;
  userId: string;
  sessionId: string;
  events: AnalyticsEvent[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
  pageViews: number;
  conversions: string[];
}

export interface RetentionCohort {
  cohortDate: Date;
  initialUsers: number;
  periods: RetentionPeriod[];
}

export interface RetentionPeriod {
  periodIndex: number;
  retainedUsers: number;
  retentionRate: number;
}

export interface Dashboard {
  dashboardId: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  layout: DashboardLayout;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardLayout {
  columns: number;
  rows: number;
  gap: number;
}

export interface MetricDefinition {
  metricId: string;
  name: string;
  description?: string;
  aggregation: 'count' | 'sum' | 'average' | 'min' | 'max' | 'unique';
  eventName?: string;
  property?: string;
  filters?: Record<string, unknown>;
}

export interface RealtimeMetrics {
  activeUsers: number;
  eventsPerMinute: number;
  pageViewsPerMinute: number;
  conversionsPerMinute: number;
  errorRate: number;
  averageResponseTime: number;
  topEvents: Array<{ eventName: string; count: number }>;
  topPages: Array<{ path: string; views: number }>;
}

export interface AnalyticsService {
  track(event: Omit<AnalyticsEvent, 'eventId' | 'timestamp'>): Promise<AnalyticsEvent>;
  trackPageView(userId: string | undefined, sessionId: string, page: string, properties?: Record<string, unknown>): Promise<AnalyticsEvent>;
  trackConversion(userId: string, sessionId: string, conversionName: string, value?: number): Promise<AnalyticsEvent>;
  getEvent(eventId: string): Promise<AnalyticsEvent | null>;
  getEventsByUser(userId: string, options?: QueryOptions): Promise<AnalyticsEvent[]>;
  getEventsBySession(sessionId: string): Promise<AnalyticsEvent[]>;
  getEventsByProperty(propertyName: string, propertyValue: unknown): Promise<AnalyticsEvent[]>;
  aggregate(aggregation: AggregationQuery): Promise<AggregatedMetrics>;
  getTimeSeries(eventName: string, timeRange: TimeRange, granularity: TimeSeriesGranularity): Promise<TimeSeriesDataPoint[]>;
  registerProperty(definition: EventProperty): void;
  getRegisteredProperties(): EventProperty[];
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  since?: Date;
  until?: Date;
  properties?: Record<string, unknown>;
}

export interface AggregationQuery {
  eventName: string;
  aggregation: 'count' | 'sum' | 'average' | 'min' | 'max' | 'unique';
  property?: string;
  groupBy?: string[];
  timeRange?: TimeRange;
  granularity?: TimeSeriesGranularity;
  filters?: Record<string, unknown>;
}

export interface FunnelService {
  createFunnel(name: string, description: string, steps: FunnelStepDefinition[]): Promise<Funnel>;
  getFunnel(funnelId: string): Promise<Funnel | null>;
  updateFunnel(funnelId: string, updates: Partial<Funnel>): Promise<Funnel>;
  deleteFunnel(funnelId: string): Promise<void>;
  trackFunnelConversion(userId: string, funnelId: string, stepName: string): Promise<void>;
  getFunnelAnalytics(funnelId: string, period: TimeRange): Promise<Funnel>;
  listFunnels(): Promise<Funnel[]>;
}

export interface ABTestService {
  createTest(test: Omit<ABTest, 'testId' | 'createdAt' | 'updatedAt' | 'statisticalSignificance'>): Promise<ABTest>;
  getTest(testId: string): Promise<ABTest | null>;
  updateTest(testId: string, updates: Partial<ABTest>): Promise<ABTest>;
  deleteTest(testId: string): Promise<void>;
  startTest(testId: string): Promise<ABTest>;
  pauseTest(testId: string): Promise<ABTest>;
  completeTest(testId: string): Promise<ABTest>;
  getTestAnalytics(testId: string): Promise<ABTest>;
  assignVariant(testId: string, userId: string): Promise<ABTestVariant>;
  trackVariantImpression(testId: string, variantId: string, userId?: string): Promise<void>;
  trackVariantConversion(testId: string, variantId: string, userId: string, value?: number): Promise<void>;
  listTests(status?: ABTestStatus): Promise<ABTest[]>;
  calculateSignificance(test: ABTest): StatisticalSignificance;
}

export interface ReportService {
  generateReport(name: string, format: ReportFormat, period: TimeRange, options?: ReportOptions): Promise<Report>;
  getReport(reportId: string): Promise<Report | null>;
  listReports(): Promise<Report[]>;
  deleteReport(reportId: string): Promise<void>;
  exportReport(reportId: string, format: 'json' | 'csv' | 'pdf'): Promise<string>;
}

export interface ReportOptions {
  description?: string;
  sections?: string[];
  filters?: ReportFilter[];
  includeComparison?: boolean;
  includeTrends?: boolean;
}

export interface DashboardService {
  createDashboard(name: string, description: string, layout?: Partial<DashboardLayout>): Promise<Dashboard>;
  getDashboard(dashboardId: string): Promise<Dashboard | null>;
  updateDashboard(dashboardId: string, updates: Partial<Dashboard>): Promise<Dashboard>;
  deleteDashboard(dashboardId: string): Promise<void>;
  addWidget(dashboardId: string, widget: Omit<DashboardWidget, 'widgetId'>): Promise<DashboardWidget>;
  removeWidget(dashboardId: string, widgetId: string): Promise<void>;
  refreshWidget(dashboardId: string, widgetId: string): Promise<unknown>;
  listDashboards(): Promise<Dashboard[]>;
}

export interface UserJourneyService {
  startJourney(userId: string, sessionId: string): Promise<UserJourney>;
  addEventToJourney(journeyId: string, event: AnalyticsEvent): Promise<void>;
  endJourney(journeyId: string): Promise<UserJourney>;
  getJourney(journeyId: string): Promise<UserJourney | null>;
  getUserJourneys(userId: string): Promise<UserJourney[]>;
  getJourneysBySession(sessionId: string): Promise<UserJourney[]>;
}

export interface RetentionService {
  calculateRetention(startDate: Date, endDate: Date, cohortPeriodDays: number): Promise<RetentionCohort[]>;
  getRetentionForUser(userId: string): Promise<RetentionCohort[]>;
  getRetentionTrend(period: TimeRange): Promise<Array<{ date: Date; retentionRate: number }>>;
}

export interface RealtimeService {
  getCurrentMetrics(): Promise<RealtimeMetrics>;
  subscribeToMetrics(callback: (metrics: RealtimeMetrics) => void): () => void;
  getActiveUsers(): Promise<number>;
  getEventsPerMinute(): Promise<number>;
}

export interface MetricService {
  registerMetric(definition: MetricDefinition): void;
  getMetric(metricId: string): Promise<MetricDefinition | null>;
  getMetricValue(metricId: string, timeRange: TimeRange): Promise<number>;
  listMetrics(): Promise<MetricDefinition[]>;
}

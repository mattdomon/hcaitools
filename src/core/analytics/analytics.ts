/**
 * Analytics Service Implementation
 * Comprehensive analytics tracking system for Manus AI Platform
 */

import crypto from 'crypto';
import {
  AnalyticsEvent,
  AnalyticsService,
  FunnelService,
  ABTestService,
  ReportService,
  DashboardService,
  UserJourneyService,
  RetentionService,
  RealtimeService,
  MetricService,
  EventProperty,
  TimeSeriesDataPoint,
  AggregatedMetrics,
  Funnel,
  FunnelStep,
  FunnelStepDefinition,
  ABTest,
  ABTestVariant,
  Report,
  ReportFormat,
  ReportSection,
  ReportOptions,
  Dashboard,
  DashboardWidget,
  DashboardLayout,
  UserJourney,
  RetentionCohort,
  RetentionPeriod,
  RealtimeMetrics,
  MetricDefinition,
  TimeRange,
  TimeSeriesGranularity,
  AggregationQuery,
  QueryOptions,
  ABTestStatus,
  StatisticalSignificance,
} from './types';

export class AnalyticsServiceImpl implements AnalyticsService {
  private events: Map<string, AnalyticsEvent> = new Map();
  private userEvents: Map<string, Set<string>> = new Map();
  private sessionEvents: Map<string, Set<string>> = new Map();
  private registeredProperties: Map<string, EventProperty> = new Map();
  private eventIndex: Map<string, Set<string>> = new Map();
  private funnelService: FunnelServiceImpl;
  private abTestService: ABTestServiceImpl;
  private reportService: ReportServiceImpl;
  private dashboardService: DashboardServiceImpl;
  private userJourneyService: UserJourneyServiceImpl;
  private retentionService: RetentionServiceImpl;
  private realtimeService: RealtimeServiceImpl;
  private metricService: MetricServiceImpl;

  constructor() {
    this.funnelService = new FunnelServiceImpl(this);
    this.abTestService = new ABTestServiceImpl();
    this.reportService = new ReportServiceImpl(this);
    this.dashboardService = new DashboardServiceImpl();
    this.userJourneyService = new UserJourneyServiceImpl();
    this.retentionService = new RetentionServiceImpl(this);
    this.realtimeService = new RealtimeServiceImpl(this);
    this.metricService = new MetricServiceImpl(this);
  }

  async track(event: Omit<AnalyticsEvent, 'eventId' | 'timestamp'>): Promise<AnalyticsEvent> {
    const fullEvent: AnalyticsEvent = {
      ...event,
      eventId: this.generateId('evt'),
      timestamp: new Date(),
    };

    this.events.set(fullEvent.eventId, fullEvent);
    this.indexEvent(fullEvent);

    if (fullEvent.userId) {
      if (!this.userEvents.has(fullEvent.userId)) {
        this.userEvents.set(fullEvent.userId, new Set());
      }
      this.userEvents.get(fullEvent.userId)!.add(fullEvent.eventId);
    }

    if (!this.sessionEvents.has(fullEvent.sessionId)) {
      this.sessionEvents.set(fullEvent.sessionId, new Set());
    }
    this.sessionEvents.get(fullEvent.sessionId)!.add(fullEvent.eventId);

    return fullEvent;
  }

  async trackPageView(
    userId: string | undefined,
    sessionId: string,
    page: string,
    properties?: Record<string, unknown>
  ): Promise<AnalyticsEvent> {
    return this.track({
      eventName: 'page_view',
      userId,
      sessionId,
      properties: { page, ...properties },
      source: 'client',
    });
  }

  async trackConversion(
    userId: string,
    sessionId: string,
    conversionName: string,
    value?: number
  ): Promise<AnalyticsEvent> {
    return this.track({
      eventName: 'conversion',
      userId,
      sessionId,
      properties: { conversionName, value },
      metrics: value !== undefined ? { conversion_value: value } : undefined,
      source: 'client',
    });
  }

  async getEvent(eventId: string): Promise<AnalyticsEvent | null> {
    return this.events.get(eventId) || null;
  }

  async getEventsByUser(userId: string, options?: QueryOptions): Promise<AnalyticsEvent[]> {
    const eventIds = this.userEvents.get(userId);
    if (!eventIds) return [];

    let events = Array.from(eventIds)
      .map((id) => this.events.get(id))
      .filter((e): e is AnalyticsEvent => e !== undefined);

    events = this.applyQueryOptions(events, options);
    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getEventsBySession(sessionId: string): Promise<AnalyticsEvent[]> {
    const eventIds = this.sessionEvents.get(sessionId);
    if (!eventIds) return [];

    return Array.from(eventIds)
      .map((id) => this.events.get(id))
      .filter((e): e is AnalyticsEvent => e !== undefined)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async getEventsByProperty(propertyName: string, propertyValue: unknown): Promise<AnalyticsEvent[]> {
    const eventIds = this.eventIndex.get(`${propertyName}:${String(propertyValue)}`);
    if (!eventIds) return [];

    return Array.from(eventIds)
      .map((id) => this.events.get(id))
      .filter((e): e is AnalyticsEvent => e !== undefined);
  }

  async aggregate(aggregation: AggregationQuery): Promise<AggregatedMetrics> {
    let events = Array.from(this.events.values());

    if (aggregation.eventName) {
      events = events.filter((e) => e.eventName === aggregation.eventName);
    }

    if (aggregation.timeRange) {
      events = events.filter(
        (e) => e.timestamp >= aggregation.timeRange!.start && e.timestamp <= aggregation.timeRange!.end
      );
    }

    if (aggregation.filters) {
      events = this.applyFilters(events, aggregation.filters);
    }

    const userIds = new Set(events.map((e) => e.userId).filter((u): u is string => u !== undefined));
    const sessions = new Set(events.map((e) => e.sessionId));

    const data = await this.getTimeSeries(
      aggregation.eventName,
      aggregation.timeRange || { start: new Date(Date.now() - 86400000), end: new Date() },
      aggregation.granularity || 'daily'
    );

    return {
      totalEvents: events.length,
      uniqueUsers: userIds.size,
      totalSessions: sessions.size,
      averagePerSession: sessions.size > 0 ? events.length / sessions.size : 0,
      data,
    };
  }

  async getTimeSeries(
    eventName: string,
    timeRange: TimeRange,
    granularity: TimeSeriesGranularity
  ): Promise<TimeSeriesDataPoint[]> {
    let events = Array.from(this.events.values());

    if (eventName) {
      events = events.filter((e) => e.eventName === eventName);
    }

    events = events.filter((e) => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end);

    const grouped = this.groupByTimeGranularity(events, granularity);
    const result: TimeSeriesDataPoint[] = [];

    for (const [key, granEvents] of Object.entries(grouped)) {
      result.push({
        timestamp: new Date(key),
        value: granEvents.length,
      });
    }

    return result.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  registerProperty(definition: EventProperty): void {
    this.registeredProperties.set(definition.name, definition);
  }

  getRegisteredProperties(): EventProperty[] {
    return Array.from(this.registeredProperties.values());
  }

  getAllEvents(): AnalyticsEvent[] {
    return Array.from(this.events.values());
  }

  getEventsInTimeRange(start: Date, end: Date): AnalyticsEvent[] {
    return Array.from(this.events.values()).filter(
      (e) => e.timestamp >= start && e.timestamp <= end
    );
  }

  getFunnelService(): FunnelService {
    return this.funnelService;
  }

  getABTestService(): ABTestService {
    return this.abTestService;
  }

  getReportService(): ReportService {
    return this.reportService;
  }

  getDashboardService(): DashboardService {
    return this.dashboardService;
  }

  getUserJourneyService(): UserJourneyService {
    return this.userJourneyService;
  }

  getRetentionService(): RetentionService {
    return this.retentionService;
  }

  getRealtimeService(): RealtimeService {
    return this.realtimeService;
  }

  getMetricService(): MetricService {
    return this.metricService;
  }

  private indexEvent(event: AnalyticsEvent): void {
    for (const [key, value] of Object.entries(event.properties)) {
      const indexKey = `${key}:${String(value)}`;
      if (!this.eventIndex.has(indexKey)) {
        this.eventIndex.set(indexKey, new Set());
      }
      this.eventIndex.get(indexKey)!.add(event.eventId);
    }
  }

  private applyQueryOptions(events: AnalyticsEvent[], options?: QueryOptions): AnalyticsEvent[] {
    if (!options) return events;

    if (options.since) {
      events = events.filter((e) => e.timestamp >= options.since!);
    }

    if (options.until) {
      events = events.filter((e) => e.timestamp <= options.until!);
    }

    if (options.properties) {
      events = this.applyFilters(events, options.properties);
    }

    if (options.offset) {
      events = events.slice(options.offset);
    }

    if (options.limit) {
      events = events.slice(0, options.limit);
    }

    return events;
  }

  private applyFilters(events: AnalyticsEvent[], filters: Record<string, unknown>): AnalyticsEvent[] {
    return events.filter((event) => {
      for (const [key, value] of Object.entries(filters)) {
        if (event.properties[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  private groupByTimeGranularity(
    events: AnalyticsEvent[],
    granularity: TimeSeriesGranularity
  ): Record<string, AnalyticsEvent[]> {
    const groups: Record<string, AnalyticsEvent[]> = {};

    for (const event of events) {
      const key = this.getTimeKey(event.timestamp, granularity);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(event);
    }

    return groups;
  }

  private getTimeKey(date: Date, granularity: TimeSeriesGranularity): string {
    const d = new Date(date);
    switch (granularity) {
      case 'hourly':
        d.setMinutes(0, 0, 0);
        break;
      case 'daily':
        d.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay());
        break;
      case 'monthly':
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        break;
    }
    return d.toISOString();
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export class FunnelServiceImpl implements FunnelService {
  private funnels: Map<string, Funnel> = new Map();
  private funnelUserProgress: Map<string, Map<string, { currentStep: number; events: AnalyticsEvent[] }>> = new Map();
  private analytics: AnalyticsServiceImpl;

  constructor(analytics: AnalyticsServiceImpl) {
    this.analytics = analytics;
  }

  async createFunnel(name: string, description: string, steps: FunnelStepDefinition[]): Promise<Funnel> {
    const funnelId = this.generateId('funnel');

    const funnelSteps: FunnelStep[] = steps.map((step) => ({
      stepId: this.generateId('step'),
      name: step.name,
      type: step.type,
      selector: step.selector,
      actualConversions: 0,
      conversionRate: 0,
      dropOffRate: 0,
    }));

    const funnel: Funnel = {
      funnelId,
      name,
      description,
      steps: funnelSteps,
      startDate: new Date(),
      endDate: new Date(),
      totalUsers: 0,
      completedUsers: 0,
      overallConversionRate: 0,
    };

    this.funnels.set(funnelId, funnel);
    this.funnelUserProgress.set(funnelId, new Map());

    return funnel;
  }

  async getFunnel(funnelId: string): Promise<Funnel | null> {
    return this.funnels.get(funnelId) || null;
  }

  async updateFunnel(funnelId: string, updates: Partial<Funnel>): Promise<Funnel> {
    const funnel = this.funnels.get(funnelId);
    if (!funnel) {
      throw new Error(`Funnel ${funnelId} not found`);
    }

    const updated: Funnel = { ...funnel, ...updates, funnelId };
    this.funnels.set(funnelId, updated);
    return updated;
  }

  async deleteFunnel(funnelId: string): Promise<void> {
    this.funnels.delete(funnelId);
    this.funnelUserProgress.delete(funnelId);
  }

  async trackFunnelConversion(userId: string, funnelId: string, stepName: string): Promise<void> {
    const funnel = this.funnels.get(funnelId);
    if (!funnel) return;

    const stepIndex = funnel.steps.findIndex((s) => s.name === stepName);
    if (stepIndex === -1) return;

    const progress = this.funnelUserProgress.get(funnelId);
    if (!progress) return;

    const userProgress = progress.get(userId);

    if (!userProgress) {
      if (stepIndex === 0) {
        progress.set(userId, { currentStep: 0, events: [] });
        funnel.totalUsers++;
        funnel.steps[0].actualConversions++;
      }
    } else {
      if (stepIndex === userProgress.currentStep + 1) {
        userProgress.currentStep = stepIndex;
        funnel.steps[stepIndex].actualConversions++;

        if (stepIndex === funnel.steps.length - 1) {
          funnel.completedUsers++;
        }
      }
    }

    this.recalculateFunnelMetrics(funnel);
  }

  async getFunnelAnalytics(funnelId: string, _period: TimeRange): Promise<Funnel> {
    const funnel = this.funnels.get(funnelId);
    if (!funnel) {
      throw new Error(`Funnel ${funnelId} not found`);
    }

    return funnel;
  }

  async listFunnels(): Promise<Funnel[]> {
    return Array.from(this.funnels.values());
  }

  private recalculateFunnelMetrics(funnel: Funnel): void {
    for (let i = 0; i < funnel.steps.length; i++) {
      const step = funnel.steps[i];
      const previousCount = i === 0 ? funnel.totalUsers : funnel.steps[i - 1].actualConversions;

      if (previousCount > 0) {
        step.conversionRate = step.actualConversions / previousCount;
        step.dropOffRate = 1 - step.conversionRate;
      } else {
        step.conversionRate = 0;
        step.dropOffRate = 0;
      }
    }

    if (funnel.totalUsers > 0) {
      funnel.overallConversionRate = funnel.completedUsers / funnel.totalUsers;
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export class ABTestServiceImpl implements ABTestService {
  private tests: Map<string, ABTest> = new Map();
  private variantAssignments: Map<string, Map<string, string>> = new Map();
  private variantImpressions: Map<string, Map<string, Set<string>>> = new Map();
  private variantConversions: Map<string, Map<string, Set<string>>> = new Map();

  async createTest(
    test: Omit<ABTest, 'testId' | 'createdAt' | 'updatedAt' | 'statisticalSignificance'>
  ): Promise<ABTest> {
    const testId = this.generateId('abtest');

    const fullTest: ABTest = {
      ...test,
      testId,
      createdAt: new Date(),
      updatedAt: new Date(),
      statisticalSignificance: {
        isSignificant: false,
        confidenceLevel: 0,
        sampleSizeReached: false,
      },
    };

    this.tests.set(testId, fullTest);
    this.variantAssignments.set(testId, new Map());
    this.variantImpressions.set(testId, new Map());
    this.variantConversions.set(testId, new Map());

    for (const variant of fullTest.variants) {
      this.variantImpressions.get(testId)!.set(variant.variantId, new Set());
      this.variantConversions.get(testId)!.set(variant.variantId, new Set());
    }

    return fullTest;
  }

  async getTest(testId: string): Promise<ABTest | null> {
    return this.tests.get(testId) || null;
  }

  async updateTest(testId: string, updates: Partial<ABTest>): Promise<ABTest> {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`A/B Test ${testId} not found`);
    }

    const updated: ABTest = { ...test, ...updates, testId, updatedAt: new Date() };
    this.tests.set(testId, updated);
    return updated;
  }

  async deleteTest(testId: string): Promise<void> {
    this.tests.delete(testId);
    this.variantAssignments.delete(testId);
    this.variantImpressions.delete(testId);
    this.variantConversions.delete(testId);
  }

  async startTest(testId: string): Promise<ABTest> {
    return this.updateTest(testId, { status: 'running' });
  }

  async pauseTest(testId: string): Promise<ABTest> {
    return this.updateTest(testId, { status: 'paused' });
  }

  async completeTest(testId: string): Promise<ABTest> {
    const test = await this.getTest(testId);
    if (!test) {
      throw new Error(`A/B Test ${testId} not found`);
    }

    const significance = this.calculateSignificance(test);
    return this.updateTest(testId, { status: 'completed', statisticalSignificance: significance });
  }

  async getTestAnalytics(testId: string): Promise<ABTest> {
    const test = await this.getTest(testId);
    if (!test) {
      throw new Error(`A/B Test ${testId} not found`);
    }

    for (const variant of test.variants) {
      const impressions = this.variantImpressions.get(testId)?.get(variant.variantId);
      const conversions = this.variantConversions.get(testId)?.get(variant.variantId);

      variant.metrics.impressions = impressions?.size || 0;
      variant.metrics.conversions = conversions?.size || 0;
      variant.metrics.conversionRate =
        variant.metrics.impressions > 0 ? variant.metrics.conversions / variant.metrics.impressions : 0;
    }

    test.statisticalSignificance = this.calculateSignificance(test);
    this.tests.set(testId, test);

    return test;
  }

  async assignVariant(testId: string, userId: string): Promise<ABTestVariant> {
    const test = await this.getTest(testId);
    if (!test) {
      throw new Error(`A/B Test ${testId} not found`);
    }

    const assignments = this.variantAssignments.get(testId)!;
    const existing = assignments.get(userId);
    if (existing) {
      const variant = test.variants.find((v) => v.variantId === existing);
      if (variant) return variant;
    }

    const random = Math.random() * test.variants.reduce((sum, v) => sum + v.weight, 0);
    let cumulative = 0;

    for (const variant of test.variants) {
      cumulative += variant.weight;
      if (random <= cumulative) {
        assignments.set(userId, variant.variantId);
        return variant;
      }
    }

    return test.variants[0];
  }

  async trackVariantImpression(testId: string, variantId: string, userId?: string): Promise<void> {
    const impressions = this.variantImpressions.get(testId)?.get(variantId);
    if (impressions && userId) {
      impressions.add(userId);
    }
  }

  async trackVariantConversion(
    testId: string,
    variantId: string,
    userId: string,
    _value?: number
  ): Promise<void> {
    const conversions = this.variantConversions.get(testId)?.get(variantId);
    if (conversions) {
      conversions.add(userId);
    }
  }

  async listTests(status?: ABTestStatus): Promise<ABTest[]> {
    let tests = Array.from(this.tests.values());
    if (status) {
      tests = tests.filter((t) => t.status === status);
    }
    return tests;
  }

  calculateSignificance(test: ABTest): StatisticalSignificance {
    const control = test.variants.find((v) => v.isControl);
    if (!control) {
      return { isSignificant: false, confidenceLevel: 0, sampleSizeReached: false };
    }

    const controlConversions = control.metrics.conversions;
    const controlImpressions = control.metrics.impressions;

    let maxChiSquare = 0;
    let bestVariant: ABTestVariant | null = null;

    for (const variant of test.variants) {
      if (variant.isControl) continue;

      const variantConversions = variant.metrics.conversions;
      const variantImpressions = variant.metrics.impressions;

      const totalConversions = controlConversions + variantConversions;
      const totalImpressions = controlImpressions + variantImpressions;

      if (totalImpressions === 0) continue;

      const expectedControlConversions = (totalConversions * controlImpressions) / totalImpressions;
      const expectedVariantConversions = (totalConversions * variantImpressions) / totalImpressions;

      const chiSquare =
        expectedControlConversions > 0
          ? Math.pow(controlConversions - expectedControlConversions, 2) / expectedControlConversions
          : 0 +
            (expectedVariantConversions > 0
              ? Math.pow(variantConversions - expectedVariantConversions, 2) / expectedVariantConversions
              : 0);

      if (chiSquare > maxChiSquare) {
        maxChiSquare = chiSquare;
        bestVariant = variant;
      }
    }

    const df = 1;
    const pValue = this.chiSquarePValue(maxChiSquare, df);
    const confidenceLevel = 1 - pValue;

    return {
      isSignificant: confidenceLevel >= 0.95,
      confidenceLevel,
      pValue,
      sampleSizeReached: controlImpressions + (bestVariant?.metrics.impressions || 0) >= 1000,
    };
  }

  private chiSquarePValue(x: number, df: number): number {
    if (x <= 0 || df <= 0) return 1;

    const k = df / 2;
    const g = this.gammaLn(k);
    const s = k * Math.log(x / 2) - x / 2 - g;

    return Math.exp(s) * (1 + (x - df) / (12 * k) - (x - df) ** 2 / (288 * k * k));
  }

  private gammaLn(x: number): number {
    const c = [
      76.18009172947146,
      -86.5053203294168,
      24.01409824083091,
      -1.231739572450155,
      0.001208650973866179,
      -0.000005395239384953,
    ];
    let y = x;
    const tmp = x + 5.5;
    const tmp2 = tmp - (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) {
      ser += c[j] / ++y;
    }
    return -tmp2 + Math.log((2.506628274631 * ser) / x);
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export class ReportServiceImpl implements ReportService {
  private reports: Map<string, Report> = new Map();
  private analytics: AnalyticsServiceImpl;

  constructor(analytics: AnalyticsServiceImpl) {
    this.analytics = analytics;
  }

  async generateReport(
    name: string,
    format: ReportFormat,
    period: TimeRange,
    options?: ReportOptions
  ): Promise<Report> {
    const reportId = this.generateId('report');
    const sections: ReportSection[] = [];

    switch (format) {
      case 'summary':
        sections.push(await this.generateSummarySection(period, options));
        break;
      case 'detailed':
        sections.push(await this.generateSummarySection(period, options));
        sections.push(await this.generateDetailedSection(period, options));
        break;
      case 'comparison':
        sections.push(await this.generateComparisonSection(period, options));
        break;
      case 'trend':
        sections.push(await this.generateTrendSection(period, options));
        break;
    }

    const report: Report = {
      reportId,
      name,
      description: options?.description,
      format,
      generatedAt: new Date(),
      period,
      sections,
      filters: options?.filters,
    };

    this.reports.set(reportId, report);
    return report;
  }

  async getReport(reportId: string): Promise<Report | null> {
    return this.reports.get(reportId) || null;
  }

  async listReports(): Promise<Report[]> {
    return Array.from(this.reports.values());
  }

  async deleteReport(reportId: string): Promise<void> {
    this.reports.delete(reportId);
  }

  async exportReport(reportId: string, format: 'json' | 'csv' | 'pdf'): Promise<string> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'csv':
        return this.exportToCsv(report);
      case 'pdf':
        return JSON.stringify(report);
      default:
        return JSON.stringify(report);
    }
  }

  private async generateSummarySection(period: TimeRange, _options?: ReportOptions): Promise<ReportSection> {
    const aggregation = await this.analytics.aggregate({
      eventName: '',
      aggregation: 'count',
      timeRange: period,
    });

    return {
      title: 'Summary',
      type: 'summary',
      data: {
        totalEvents: aggregation.totalEvents,
        uniqueUsers: aggregation.uniqueUsers,
        totalSessions: aggregation.totalSessions,
        averagePerSession: aggregation.averagePerSession,
      },
    };
  }

  private async generateDetailedSection(period: TimeRange, _options?: ReportOptions): Promise<ReportSection> {
    const events = this.analytics.getEventsInTimeRange(period.start, period.end);

    const eventCounts: Record<string, number> = {};
    for (const event of events) {
      eventCounts[event.eventName] = (eventCounts[event.eventName] || 0) + 1;
    }

    return {
      title: 'Detailed Breakdown',
      type: 'table',
      data: Object.entries(eventCounts).map(([name, count]) => ({ eventName: name, count })),
    };
  }

  private async generateComparisonSection(period: TimeRange, _options?: ReportOptions): Promise<ReportSection> {
    const midPoint = new Date((period.start.getTime() + period.end.getTime()) / 2);
    const firstHalf: TimeRange = { start: period.start, end: midPoint };
    const secondHalf: TimeRange = { start: midPoint, end: period.end };

    const first = await this.analytics.aggregate({ eventName: '', aggregation: 'count', timeRange: firstHalf });
    const second = await this.analytics.aggregate({ eventName: '', aggregation: 'count', timeRange: secondHalf });

    return {
      title: 'Comparison',
      type: 'metrics',
      data: {
        firstPeriod: { totalEvents: first.totalEvents, uniqueUsers: first.uniqueUsers },
        secondPeriod: { totalEvents: second.totalEvents, uniqueUsers: second.uniqueUsers },
        change: {
          eventsChange: second.totalEvents - first.totalEvents,
          usersChange: second.uniqueUsers - first.uniqueUsers,
        },
      },
    };
  }

  private async generateTrendSection(period: TimeRange, _options?: ReportOptions): Promise<ReportSection> {
    const timeSeries = await this.analytics.getTimeSeries('', period, 'daily');

    return {
      title: 'Trend Analysis',
      type: 'chart',
      data: timeSeries.map((point) => ({
        date: point.timestamp.toISOString(),
        value: point.value,
      })),
    };
  }

  private exportToCsv(report: Report): string {
    const lines: string[] = [];
    lines.push(`Report: ${report.name}`);
    lines.push(`Generated: ${report.generatedAt.toISOString()}`);
    lines.push(`Period: ${report.period.start.toISOString()} - ${report.period.end.toISOString()}`);
    lines.push('');

    for (const section of report.sections) {
      lines.push(`## ${section.title}`);
      if (typeof section.data === 'object' && section.data !== null) {
        lines.push(JSON.stringify(section.data));
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export class DashboardServiceImpl implements DashboardService {
  private dashboards: Map<string, Dashboard> = new Map();

  async createDashboard(name: string, description: string, layout?: Partial<DashboardLayout>): Promise<Dashboard> {
    const dashboardId = this.generateId('dash');

    const dashboard: Dashboard = {
      dashboardId,
      name,
      description,
      widgets: [],
      layout: {
        columns: layout?.columns || 12,
        rows: layout?.rows || 8,
        gap: layout?.gap || 16,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.dashboards.set(dashboardId, dashboard);
    return dashboard;
  }

  async getDashboard(dashboardId: string): Promise<Dashboard | null> {
    return this.dashboards.get(dashboardId) || null;
  }

  async updateDashboard(dashboardId: string, updates: Partial<Dashboard>): Promise<Dashboard> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    const updated: Dashboard = { ...dashboard, ...updates, dashboardId, updatedAt: new Date() };
    this.dashboards.set(dashboardId, updated);
    return updated;
  }

  async deleteDashboard(dashboardId: string): Promise<void> {
    this.dashboards.delete(dashboardId);
  }

  async addWidget(dashboardId: string, widget: Omit<DashboardWidget, 'widgetId'>): Promise<DashboardWidget> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    const fullWidget: DashboardWidget = {
      ...widget,
      widgetId: this.generateId('widget'),
    };

    dashboard.widgets.push(fullWidget);
    dashboard.updatedAt = new Date();
    this.dashboards.set(dashboardId, dashboard);

    return fullWidget;
  }

  async removeWidget(dashboardId: string, widgetId: string): Promise<void> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    dashboard.widgets = dashboard.widgets.filter((w) => w.widgetId !== widgetId);
    dashboard.updatedAt = new Date();
    this.dashboards.set(dashboardId, dashboard);
  }

  async refreshWidget(_dashboardId: string, _widgetId: string): Promise<unknown> {
    return { data: [], refreshedAt: new Date() };
  }

  async listDashboards(): Promise<Dashboard[]> {
    return Array.from(this.dashboards.values());
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export class UserJourneyServiceImpl implements UserJourneyService {
  private journeys: Map<string, UserJourney> = new Map();
  private userJourneys: Map<string, Set<string>> = new Map();
  private sessionJourneys: Map<string, Set<string>> = new Map();

  async startJourney(userId: string, sessionId: string): Promise<UserJourney> {
    const journeyId = this.generateId('journey');

    const journey: UserJourney = {
      journeyId,
      userId,
      sessionId,
      events: [],
      startTime: new Date(),
      pageViews: 0,
      conversions: [],
    };

    this.journeys.set(journeyId, journey);

    if (!this.userJourneys.has(userId)) {
      this.userJourneys.set(userId, new Set());
    }
    this.userJourneys.get(userId)!.add(journeyId);

    if (!this.sessionJourneys.has(sessionId)) {
      this.sessionJourneys.set(sessionId, new Set());
    }
    this.sessionJourneys.get(sessionId)!.add(journeyId);

    return journey;
  }

  async addEventToJourney(journeyId: string, event: AnalyticsEvent): Promise<void> {
    const journey = this.journeys.get(journeyId);
    if (!journey) return;

    journey.events.push(event);

    if (event.eventName === 'page_view') {
      journey.pageViews++;
    }

    if (event.eventName === 'conversion' && event.properties.conversionName) {
      journey.conversions.push(String(event.properties.conversionName));
    }
  }

  async endJourney(journeyId: string): Promise<UserJourney> {
    const journey = this.journeys.get(journeyId);
    if (!journey) {
      throw new Error(`Journey ${journeyId} not found`);
    }

    journey.endTime = new Date();
    journey.duration = journey.endTime.getTime() - journey.startTime.getTime();

    this.journeys.set(journeyId, journey);
    return journey;
  }

  async getJourney(journeyId: string): Promise<UserJourney | null> {
    return this.journeys.get(journeyId) || null;
  }

  async getUserJourneys(userId: string): Promise<UserJourney[]> {
    const journeyIds = this.userJourneys.get(userId);
    if (!journeyIds) return [];

    return Array.from(journeyIds)
      .map((id) => this.journeys.get(id))
      .filter((j): j is UserJourney => j !== undefined);
  }

  async getJourneysBySession(sessionId: string): Promise<UserJourney[]> {
    const journeyIds = this.sessionJourneys.get(sessionId);
    if (!journeyIds) return [];

    return Array.from(journeyIds)
      .map((id) => this.journeys.get(id))
      .filter((j): j is UserJourney => j !== undefined);
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export class RetentionServiceImpl implements RetentionService {
  private analytics: AnalyticsServiceImpl;

  constructor(analytics: AnalyticsServiceImpl) {
    this.analytics = analytics;
  }

  async calculateRetention(startDate: Date, endDate: Date, cohortPeriodDays: number): Promise<RetentionCohort[]> {
    const cohorts: RetentionCohort[] = [];
    let currentDate = new Date(startDate);

    while (currentDate < endDate) {
      const cohortEnd = new Date(currentDate.getTime() + cohortPeriodDays * 86400000);
      const users = this.getUsersAcquiredInPeriod(currentDate, cohortEnd);

      const periods: RetentionPeriod[] = [];
      let periodStart = new Date(cohortEnd);
      let periodIndex = 0;

      while (periodStart < endDate) {
        const periodEnd = new Date(periodStart.getTime() + cohortPeriodDays * 86400000);
        const retainedUsers = this.getRetainedUsers(users, periodStart, periodEnd);

        periods.push({
          periodIndex,
          retainedUsers,
          retentionRate: users.length > 0 ? retainedUsers / users.length : 0,
        });

        periodStart = periodEnd;
        periodIndex++;
      }

      cohorts.push({
        cohortDate: currentDate,
        initialUsers: users.length,
        periods,
      });

      currentDate = cohortEnd;
    }

    return cohorts;
  }

  async getRetentionForUser(_userId: string): Promise<RetentionCohort[]> {
    return [];
  }

  async getRetentionTrend(_period: TimeRange): Promise<Array<{ date: Date; retentionRate: number }>> {
    return [];
  }

  private getUsersAcquiredInPeriod(start: Date, end: Date): string[] {
    const events = this.analytics.getEventsInTimeRange(start, end);

    const users = new Set<string>();
    for (const event of events) {
      if (event.eventName === 'page_view' && event.userId) {
        users.add(event.userId);
      }
    }

    return Array.from(users);
  }

  private getRetainedUsers(userIds: string[], periodStart: Date, periodEnd: Date): number {
    const events = this.analytics.getEventsInTimeRange(periodStart, periodEnd);

    const retained = new Set<string>();
    for (const event of events) {
      if (event.eventName === 'page_view' && event.userId && userIds.includes(event.userId)) {
        retained.add(event.userId);
      }
    }

    return retained.size;
  }
}

export class RealtimeServiceImpl implements RealtimeService {
  private analytics: AnalyticsServiceImpl;
  private subscribers: Set<(metrics: RealtimeMetrics) => void> = new Set();
  private intervalId: NodeJS.Timeout | null = null;

  constructor(analytics: AnalyticsServiceImpl) {
    this.analytics = analytics;
  }

  async getCurrentMetrics(): Promise<RealtimeMetrics> {
    const now = Date.now();
    const oneMinuteAgo = new Date(now - 60000);

    const events = this.analytics.getEventsInTimeRange(oneMinuteAgo, new Date(now));

    const activeUserIds = new Set<string>();
    const pageViews = events.filter((e) => e.eventName === 'page_view');
    const conversions = events.filter((e) => e.eventName === 'conversion');

    for (const event of events) {
      if (event.userId) {
        activeUserIds.add(event.userId);
      }
    }

    const eventCounts: Record<string, number> = {};
    const pageCounts: Record<string, number> = {};

    for (const event of events) {
      eventCounts[event.eventName] = (eventCounts[event.eventName] || 0) + 1;
      if (event.eventName === 'page_view' && event.properties.page) {
        const page = String(event.properties.page);
        pageCounts[page] = (pageCounts[page] || 0) + 1;
      }
    }

    const topEvents = Object.entries(eventCounts)
      .map(([eventName, count]) => ({ eventName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topPages = Object.entries(pageCounts)
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    return {
      activeUsers: activeUserIds.size,
      eventsPerMinute: events.length,
      pageViewsPerMinute: pageViews.length,
      conversionsPerMinute: conversions.length,
      errorRate: 0,
      averageResponseTime: 0,
      topEvents,
      topPages,
    };
  }

  subscribeToMetrics(callback: (metrics: RealtimeMetrics) => void): () => void {
    this.subscribers.add(callback);

    if (!this.intervalId) {
      this.intervalId = setInterval(async () => {
        const metrics = await this.getCurrentMetrics();
        for (const subscriber of this.subscribers) {
          subscriber(metrics);
        }
      }, 5000);
    }

    return () => {
      this.subscribers.delete(callback);
      if (this.subscribers.size === 0 && this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    };
  }

  async getActiveUsers(): Promise<number> {
    const metrics = await this.getCurrentMetrics();
    return metrics.activeUsers;
  }

  async getEventsPerMinute(): Promise<number> {
    const metrics = await this.getCurrentMetrics();
    return metrics.eventsPerMinute;
  }
}

export class MetricServiceImpl implements MetricService {
  private metrics: Map<string, MetricDefinition> = new Map();
  private analytics: AnalyticsServiceImpl;

  constructor(analytics: AnalyticsServiceImpl) {
    this.analytics = analytics;
  }

  registerMetric(definition: MetricDefinition): void {
    this.metrics.set(definition.metricId, definition);
  }

  async getMetric(metricId: string): Promise<MetricDefinition | null> {
    return this.metrics.get(metricId) || null;
  }

  async getMetricValue(metricId: string, timeRange: TimeRange): Promise<number> {
    const definition = this.metrics.get(metricId);
    if (!definition) {
      throw new Error(`Metric ${metricId} not found`);
    }

    const aggregation = await this.analytics.aggregate({
      eventName: definition.eventName || '',
      aggregation: definition.aggregation,
      property: definition.property,
      timeRange,
      filters: definition.filters,
    });

    switch (definition.aggregation) {
      case 'count':
        return aggregation.totalEvents;
      case 'unique':
        return aggregation.uniqueUsers;
      case 'sum':
      case 'average':
        return aggregation.averagePerSession * aggregation.totalEvents;
      default:
        return aggregation.totalEvents;
    }
  }

  async listMetrics(): Promise<MetricDefinition[]> {
    return Array.from(this.metrics.values());
  }
}

export function createAnalyticsService(): AnalyticsServiceImpl {
  return new AnalyticsServiceImpl();
}

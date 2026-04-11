/**
 * Analytics Service Tests
 */

import {
  AnalyticsServiceImpl,
  FunnelServiceImpl,
  ABTestServiceImpl,
  ReportServiceImpl,
  DashboardServiceImpl,
  UserJourneyServiceImpl,
  createAnalyticsService,
} from '../src/core/analytics/analytics';
import {
  AnalyticsManus,
  createAnalytics,
} from '../src/core/analytics';

describe('AnalyticsServiceImpl', () => {
  let service: AnalyticsServiceImpl;

  beforeEach(() => {
    service = createAnalyticsService();
  });

  describe('Event Tracking', () => {
    test('should track event with all fields', async () => {
      const event = await service.track({
        eventName: 'test_event',
        userId: 'user123',
        sessionId: 'session456',
        properties: { key: 'value' },
        source: 'test',
      });

      expect(event.eventId).toBeDefined();
      expect(event.eventName).toBe('test_event');
      expect(event.userId).toBe('user123');
      expect(event.sessionId).toBe('session456');
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.properties.key).toBe('value');
    });

    test('should track event without userId', async () => {
      const event = await service.track({
        eventName: 'anonymous_event',
        sessionId: 'session456',
        properties: {},
      });

      expect(event.eventId).toBeDefined();
      expect(event.userId).toBeUndefined();
      expect(event.eventName).toBe('anonymous_event');
    });

    test('should track page view', async () => {
      const event = await service.trackPageView('user123', 'session456', '/home', { referrer: 'google' });

      expect(event.eventName).toBe('page_view');
      expect(event.properties.page).toBe('/home');
      expect(event.properties.referrer).toBe('google');
    });

    test('should track conversion', async () => {
      const event = await service.trackConversion('user123', 'session456', 'purchase', 99.99);

      expect(event.eventName).toBe('conversion');
      expect(event.properties.conversionName).toBe('purchase');
      expect(event.properties.value).toBe(99.99);
      expect(event.metrics?.conversion_value).toBe(99.99);
    });

    test('should generate unique event IDs', async () => {
      const event1 = await service.track({ eventName: 'test', sessionId: 's1', properties: {} });
      const event2 = await service.track({ eventName: 'test', sessionId: 's2', properties: {} });

      expect(event1.eventId).not.toBe(event2.eventId);
    });
  });

  describe('Event Retrieval', () => {
    test('should get event by ID', async () => {
      const tracked = await service.track({ eventName: 'test', sessionId: 'session1', properties: {} });
      const retrieved = await service.getEvent(tracked.eventId);

      expect(retrieved?.eventId).toBe(tracked.eventId);
      expect(retrieved?.eventName).toBe('test');
    });

    test('should return null for non-existent event', async () => {
      const result = await service.getEvent('non_existent_id');
      expect(result).toBeNull();
    });

    test('should get events by user', async () => {
      await service.track({ eventName: 'event1', userId: 'user123', sessionId: 's1', properties: {} });
      await service.track({ eventName: 'event2', userId: 'user123', sessionId: 's2', properties: {} });
      await service.track({ eventName: 'event3', userId: 'other', sessionId: 's3', properties: {} });

      const events = await service.getEventsByUser('user123');
      expect(events.length).toBe(2);
      expect(events.every((e) => e.userId === 'user123')).toBe(true);
    });

    test('should get events by session', async () => {
      await service.track({ eventName: 'event1', sessionId: 'session1', properties: {} });
      await service.track({ eventName: 'event2', sessionId: 'session1', properties: {} });
      await service.track({ eventName: 'event3', sessionId: 'session2', properties: {} });

      const events = await service.getEventsBySession('session1');
      expect(events.length).toBe(2);
    });

    test('should filter events by time range', async () => {
      await service.track({ eventName: 'test', sessionId: 's1', properties: {} });

      const events = await service.getEventsByUser('user_never_exists', {
        since: new Date(Date.now() - 1000),
        until: new Date(Date.now() + 1000),
      });
      expect(Array.isArray(events)).toBe(true);
    });

    test('should limit events', async () => {
      for (let i = 0; i < 10; i++) {
        await service.track({ eventName: 'test', userId: 'user123', sessionId: `s${i}`, properties: {} });
      }

      const events = await service.getEventsByUser('user123', { limit: 5 });
      expect(events.length).toBe(5);
    });
  });

  describe('Aggregation', () => {
    test('should aggregate events count', async () => {
      await service.track({ eventName: 'page_view', sessionId: 's1', properties: {} });
      await service.track({ eventName: 'page_view', sessionId: 's2', properties: {} });
      await service.track({ eventName: 'click', sessionId: 's3', properties: {} });

      const result = await service.aggregate({ eventName: 'page_view', aggregation: 'count' });
      expect(result.totalEvents).toBe(2);
    });

    test('should aggregate unique users', async () => {
      await service.track({ eventName: 'test', userId: 'user1', sessionId: 's1', properties: {} });
      await service.track({ eventName: 'test', userId: 'user2', sessionId: 's2', properties: {} });
      await service.track({ eventName: 'test', userId: 'user1', sessionId: 's3', properties: {} });

      const result = await service.aggregate({ eventName: 'test', aggregation: 'unique' });
      expect(result.uniqueUsers).toBe(2);
    });

    test('should get time series data', async () => {
      await service.track({ eventName: 'test', sessionId: 's1', properties: {} });

      const timeRange = { start: new Date(Date.now() - 86400000), end: new Date() };
      const series = await service.getTimeSeries('test', timeRange, 'hourly');
      expect(Array.isArray(series)).toBe(true);
    });
  });

  describe('Property Registration', () => {
    test('should register property', () => {
      service.registerProperty({ name: 'page', type: 'string', description: 'Page name' });
      const props = service.getRegisteredProperties();
      expect(props.some((p) => p.name === 'page')).toBe(true);
    });
  });
});

describe('FunnelServiceImpl', () => {
  let analytics: AnalyticsServiceImpl;
  let funnelService: FunnelServiceImpl;

  beforeEach(() => {
    analytics = createAnalyticsService();
    funnelService = analytics.getFunnelService() as FunnelServiceImpl;
  });

  test('should create funnel', async () => {
    const funnel = await funnelService.createFunnel('Test Funnel', 'Description', [
      { name: 'Step 1', type: 'view' },
      { name: 'Step 2', type: 'click' },
      { name: 'Step 3', type: 'submit' },
    ]);

    expect(funnel.funnelId).toBeDefined();
    expect(funnel.name).toBe('Test Funnel');
    expect(funnel.steps.length).toBe(3);
  });

  test('should get funnel by ID', async () => {
    const created = await funnelService.createFunnel('Test', 'Desc', [
      { name: 'Step 1', type: 'view' },
    ]);

    const retrieved = await funnelService.getFunnel(created.funnelId);
    expect(retrieved?.funnelId).toBe(created.funnelId);
  });

  test('should list funnels', async () => {
    await funnelService.createFunnel('Funnel 1', 'Desc', [{ name: 'S1', type: 'view' }]);
    await funnelService.createFunnel('Funnel 2', 'Desc', [{ name: 'S1', type: 'view' }]);

    const funnels = await funnelService.listFunnels();
    expect(funnels.length).toBe(2);
  });

  test('should update funnel', async () => {
    const funnel = await funnelService.createFunnel('Original', 'Desc', [{ name: 'S1', type: 'view' }]);
    const updated = await funnelService.updateFunnel(funnel.funnelId, { name: 'Updated' });

    expect(updated.name).toBe('Updated');
  });

  test('should track funnel conversion', async () => {
    const funnel = await funnelService.createFunnel('Test', 'Desc', [
      { name: 'Step 1', type: 'view' },
      { name: 'Step 2', type: 'click' },
    ]);

    await funnelService.trackFunnelConversion('user123', funnel.funnelId, 'Step 1');
    const analytics2 = await funnelService.getFunnelAnalytics(funnel.funnelId, {
      start: new Date(),
      end: new Date(),
    });

    expect(analytics2.totalUsers).toBe(1);
    expect(analytics2.steps[0].actualConversions).toBe(1);
  });

  test('should delete funnel', async () => {
    const funnel = await funnelService.createFunnel('Test', 'Desc', [{ name: 'S1', type: 'view' }]);
    await funnelService.deleteFunnel(funnel.funnelId);

    const retrieved = await funnelService.getFunnel(funnel.funnelId);
    expect(retrieved).toBeNull();
  });
});

describe('ABTestServiceImpl', () => {
  let abTestService: ABTestServiceImpl;

  beforeEach(() => {
    abTestService = new ABTestServiceImpl();
  });

  test('should create A/B test', async () => {
    const test = await abTestService.createTest({
      name: 'Button Color Test',
      description: 'Testing red vs blue',
      status: 'draft',
      variants: [
        {
          variantId: 'ctrl',
          name: 'Control',
          weight: 50,
          metrics: { impressions: 0, conversions: 0, conversionRate: 0, customMetrics: {} },
          isControl: true,
        },
        {
          variantId: 'var1',
          name: 'Variant A',
          weight: 50,
          metrics: { impressions: 0, conversions: 0, conversionRate: 0, customMetrics: {} },
          isControl: false,
        },
      ],
      startDate: new Date(),
      targetMetric: 'conversion_rate',
    });

    expect(test.testId).toBeDefined();
    expect(test.name).toBe('Button Color Test');
    expect(test.variants.length).toBe(2);
  });

  test('should start test', async () => {
    const test = await abTestService.createTest({
      name: 'Test',
      status: 'draft',
      variants: [
        {
          variantId: 'ctrl',
          name: 'Control',
          weight: 100,
          metrics: { impressions: 0, conversions: 0, conversionRate: 0, customMetrics: {} },
          isControl: true,
        },
      ],
      startDate: new Date(),
      targetMetric: 'ctr',
    });

    const started = await abTestService.startTest(test.testId);
    expect(started.status).toBe('running');
  });

  test('should pause test', async () => {
    const test = await abTestService.createTest({
      name: 'Test',
      status: 'running',
      variants: [
        {
          variantId: 'ctrl',
          name: 'Control',
          weight: 100,
          metrics: { impressions: 0, conversions: 0, conversionRate: 0, customMetrics: {} },
          isControl: true,
        },
      ],
      startDate: new Date(),
      targetMetric: 'ctr',
    });

    const paused = await abTestService.pauseTest(test.testId);
    expect(paused.status).toBe('paused');
  });

  test('should assign variant', async () => {
    const test = await abTestService.createTest({
      name: 'Test',
      status: 'running',
      variants: [
        {
          variantId: 'ctrl',
          name: 'Control',
          weight: 50,
          metrics: { impressions: 0, conversions: 0, conversionRate: 0, customMetrics: {} },
          isControl: true,
        },
        {
          variantId: 'var1',
          name: 'Variant',
          weight: 50,
          metrics: { impressions: 0, conversions: 0, conversionRate: 0, customMetrics: {} },
          isControl: false,
        },
      ],
      startDate: new Date(),
      targetMetric: 'ctr',
    });

    const variant = await abTestService.assignVariant(test.testId, 'user123');
    expect(variant.variantId).toBeDefined();
  });

  test('should track variant impression', async () => {
    const test = await abTestService.createTest({
      name: 'Test',
      status: 'running',
      variants: [
        {
          variantId: 'ctrl',
          name: 'Control',
          weight: 100,
          metrics: { impressions: 0, conversions: 0, conversionRate: 0, customMetrics: {} },
          isControl: true,
        },
      ],
      startDate: new Date(),
      targetMetric: 'ctr',
    });

    await abTestService.trackVariantImpression(test.testId, 'ctrl', 'user123');
    const analytics = await abTestService.getTestAnalytics(test.testId);
    expect(analytics.variants[0].metrics.impressions).toBe(1);
  });

  test('should track variant conversion', async () => {
    const test = await abTestService.createTest({
      name: 'Test',
      status: 'running',
      variants: [
        {
          variantId: 'ctrl',
          name: 'Control',
          weight: 100,
          metrics: { impressions: 0, conversions: 0, conversionRate: 0, customMetrics: {} },
          isControl: true,
        },
      ],
      startDate: new Date(),
      targetMetric: 'ctr',
    });

    await abTestService.trackVariantConversion(test.testId, 'ctrl', 'user123');
    const analytics = await abTestService.getTestAnalytics(test.testId);
    expect(analytics.variants[0].metrics.conversions).toBe(1);
  });

  test('should list tests by status', async () => {
    await abTestService.createTest({
      name: 'Running Test',
      status: 'running',
      variants: [
        {
          variantId: 'ctrl',
          name: 'Control',
          weight: 100,
          metrics: { impressions: 0, conversions: 0, conversionRate: 0, customMetrics: {} },
          isControl: true,
        },
      ],
      startDate: new Date(),
      targetMetric: 'ctr',
    });

    await abTestService.createTest({
      name: 'Draft Test',
      status: 'draft',
      variants: [
        {
          variantId: 'ctrl',
          name: 'Control',
          weight: 100,
          metrics: { impressions: 0, conversions: 0, conversionRate: 0, customMetrics: {} },
          isControl: true,
        },
      ],
      startDate: new Date(),
      targetMetric: 'ctr',
    });

    const running = await abTestService.listTests('running');
    expect(running.length).toBe(1);
    expect(running[0].name).toBe('Running Test');
  });

  test('should calculate statistical significance', async () => {
    const test = await abTestService.createTest({
      name: 'Significance Test',
      status: 'running',
      variants: [
        {
          variantId: 'ctrl',
          name: 'Control',
          weight: 50,
          metrics: { impressions: 1000, conversions: 50, conversionRate: 0.05, customMetrics: {} },
          isControl: true,
        },
        {
          variantId: 'var1',
          name: 'Variant',
          weight: 50,
          metrics: { impressions: 1000, conversions: 80, conversionRate: 0.08, customMetrics: {} },
          isControl: false,
        },
      ],
      startDate: new Date(),
      targetMetric: 'ctr',
    });

    const significance = abTestService.calculateSignificance(test);
    expect(significance.confidenceLevel).toBeGreaterThan(0);
  });
});

describe('ReportServiceImpl', () => {
  let analytics: AnalyticsServiceImpl;
  let reportService: ReportServiceImpl;

  beforeEach(() => {
    analytics = createAnalyticsService();
    reportService = analytics.getReportService() as ReportServiceImpl;
  });

  test('should generate summary report', async () => {
    await analytics.track({ eventName: 'page_view', sessionId: 's1', properties: {} });

    const report = await reportService.generateReport(
      'Summary Report',
      'summary',
      { start: new Date(Date.now() - 86400000), end: new Date() }
    );

    expect(report.reportId).toBeDefined();
    expect(report.format).toBe('summary');
    expect(report.sections.length).toBeGreaterThan(0);
  });

  test('should generate detailed report', async () => {
    const report = await reportService.generateReport(
      'Detailed Report',
      'detailed',
      { start: new Date(Date.now() - 86400000), end: new Date() }
    );

    expect(report.sections.length).toBe(2);
  });

  test('should generate comparison report', async () => {
    const report = await reportService.generateReport(
      'Comparison Report',
      'comparison',
      { start: new Date(Date.now() - 86400000), end: new Date() }
    );

    expect(report.format).toBe('comparison');
  });

  test('should generate trend report', async () => {
    const report = await reportService.generateReport(
      'Trend Report',
      'trend',
      { start: new Date(Date.now() - 86400000), end: new Date() }
    );

    expect(report.format).toBe('trend');
  });

  test('should get report by ID', async () => {
    const created = await reportService.generateReport(
      'Test',
      'summary',
      { start: new Date(Date.now() - 86400000), end: new Date() }
    );

    const retrieved = await reportService.getReport(created.reportId);
    expect(retrieved?.name).toBe('Test');
  });

  test('should list reports', async () => {
    await reportService.generateReport('Report 1', 'summary', {
      start: new Date(Date.now() - 86400000),
      end: new Date(),
    });
    await reportService.generateReport('Report 2', 'summary', {
      start: new Date(Date.now() - 86400000),
      end: new Date(),
    });

    const reports = await reportService.listReports();
    expect(reports.length).toBe(2);
  });

  test('should export report as JSON', async () => {
    const report = await reportService.generateReport('Export Test', 'summary', {
      start: new Date(Date.now() - 86400000),
      end: new Date(),
    });

    const exported = await reportService.exportReport(report.reportId, 'json');
    expect(JSON.parse(exported).name).toBe('Export Test');
  });

  test('should export report as CSV', async () => {
    const report = await reportService.generateReport('CSV Export', 'summary', {
      start: new Date(Date.now() - 86400000),
      end: new Date(),
    });

    const exported = await reportService.exportReport(report.reportId, 'csv');
    expect(exported).toContain('Report:');
  });

  test('should delete report', async () => {
    const report = await reportService.generateReport('To Delete', 'summary', {
      start: new Date(Date.now() - 86400000),
      end: new Date(),
    });

    await reportService.deleteReport(report.reportId);
    const retrieved = await reportService.getReport(report.reportId);
    expect(retrieved).toBeNull();
  });
});

describe('DashboardServiceImpl', () => {
  let dashboardService: DashboardServiceImpl;

  beforeEach(() => {
    dashboardService = new DashboardServiceImpl();
  });

  test('should create dashboard', async () => {
    const dashboard = await dashboardService.createDashboard('My Dashboard', 'Description');

    expect(dashboard.dashboardId).toBeDefined();
    expect(dashboard.name).toBe('My Dashboard');
    expect(dashboard.widgets.length).toBe(0);
  });

  test('should create dashboard with custom layout', async () => {
    const dashboard = await dashboardService.createDashboard('Test', 'Desc', {
      columns: 6,
      rows: 4,
      gap: 8,
    });

    expect(dashboard.layout.columns).toBe(6);
    expect(dashboard.layout.rows).toBe(4);
    expect(dashboard.layout.gap).toBe(8);
  });

  test('should get dashboard by ID', async () => {
    const created = await dashboardService.createDashboard('Test', 'Desc');
    const retrieved = await dashboardService.getDashboard(created.dashboardId);

    expect(retrieved?.name).toBe('Test');
  });

  test('should update dashboard', async () => {
    const dashboard = await dashboardService.createDashboard('Original', 'Desc');
    const updated = await dashboardService.updateDashboard(dashboard.dashboardId, {
      name: 'Updated',
    });

    expect(updated.name).toBe('Updated');
  });

  test('should add widget to dashboard', async () => {
    const dashboard = await dashboardService.createDashboard('Test', 'Desc');
    const widget = await dashboardService.addWidget(dashboard.dashboardId, {
      name: 'Counter',
      type: 'counter',
      dataSource: { type: 'events', query: { eventName: 'page_view' } },
      position: { x: 0, y: 0, w: 2, h: 2 },
    });

    expect(widget.widgetId).toBeDefined();
    expect(widget.name).toBe('Counter');
  });

  test('should remove widget from dashboard', async () => {
    const dashboard = await dashboardService.createDashboard('Test', 'Desc');
    const widget = await dashboardService.addWidget(dashboard.dashboardId, {
      name: 'To Remove',
      type: 'counter',
      dataSource: { type: 'events', query: {} },
      position: { x: 0, y: 0, w: 1, h: 1 },
    });

    await dashboardService.removeWidget(dashboard.dashboardId, widget.widgetId);
    const updated = await dashboardService.getDashboard(dashboard.dashboardId);
    expect(updated?.widgets.length).toBe(0);
  });

  test('should list dashboards', async () => {
    await dashboardService.createDashboard('Dashboard 1', 'Desc');
    await dashboardService.createDashboard('Dashboard 2', 'Desc');

    const dashboards = await dashboardService.listDashboards();
    expect(dashboards.length).toBe(2);
  });

  test('should delete dashboard', async () => {
    const dashboard = await dashboardService.createDashboard('To Delete', 'Desc');
    await dashboardService.deleteDashboard(dashboard.dashboardId);

    const retrieved = await dashboardService.getDashboard(dashboard.dashboardId);
    expect(retrieved).toBeNull();
  });
});

describe('UserJourneyServiceImpl', () => {
  let journeyService: UserJourneyServiceImpl;

  beforeEach(() => {
    const analytics = createAnalyticsService();
    journeyService = analytics.getUserJourneyService() as UserJourneyServiceImpl;
  });

  test('should start journey', async () => {
    const journey = await journeyService.startJourney('user123', 'session456');

    expect(journey.journeyId).toBeDefined();
    expect(journey.userId).toBe('user123');
    expect(journey.sessionId).toBe('session456');
    expect(journey.pageViews).toBe(0);
    expect(journey.conversions).toEqual([]);
  });

  test('should add event to journey', async () => {
    const journey = await journeyService.startJourney('user123', 'session456');
    const event: any = {
      eventId: 'evt123',
      eventName: 'page_view',
      sessionId: 'session456',
      timestamp: new Date(),
      properties: { page: '/home' },
    };

    await journeyService.addEventToJourney(journey.journeyId, event);
    const updated = await journeyService.getJourney(journey.journeyId);

    expect(updated?.events.length).toBe(1);
    expect(updated?.pageViews).toBe(1);
  });

  test('should track conversion in journey', async () => {
    const journey = await journeyService.startJourney('user123', 'session456');
    const event: any = {
      eventId: 'evt123',
      eventName: 'conversion',
      sessionId: 'session456',
      timestamp: new Date(),
      properties: { conversionName: 'purchase' },
    };

    await journeyService.addEventToJourney(journey.journeyId, event);
    const updated = await journeyService.getJourney(journey.journeyId);

    expect(updated?.conversions).toContain('purchase');
  });

  test('should end journey', async () => {
    const journey = await journeyService.startJourney('user123', 'session456');
    const ended = await journeyService.endJourney(journey.journeyId);

    expect(ended.endTime).toBeDefined();
    expect(ended.duration).toBeGreaterThanOrEqual(0);
  });

  test('should get user journeys', async () => {
    await journeyService.startJourney('user123', 'session1');
    await journeyService.startJourney('user123', 'session2');

    const journeys = await journeyService.getUserJourneys('user123');
    expect(journeys.length).toBe(2);
  });

  test('should get journeys by session', async () => {
    const journey = await journeyService.startJourney('user123', 'session456');
    const journeys = await journeyService.getJourneysBySession('session456');

    expect(journeys.length).toBe(1);
    expect(journeys[0].journeyId).toBe(journey.journeyId);
  });
});

describe('AnalyticsManus', () => {
  let analytics: AnalyticsManus;

  beforeEach(() => {
    analytics = createAnalytics();
  });

  test('should track event', async () => {
    const event = await analytics.trackEvent('custom_event', 'user123', 'session456', { key: 'value' });
    expect(event.eventName).toBe('custom_event');
  });

  test('should track page view', async () => {
    const event = await analytics.trackPageView('user123', 'session456', '/about');
    expect(event.properties.page).toBe('/about');
  });

  test('should track conversion', async () => {
    const event = await analytics.trackConversion('user123', 'session456', 'signup', 0);
    expect(event.properties.conversionName).toBe('signup');
  });

  test('should get event by ID', async () => {
    const tracked = await analytics.trackEvent('test', 'user123', 'session456');
    const retrieved = await analytics.getEvent(tracked.eventId);
    expect(retrieved?.eventId).toBe(tracked.eventId);
  });

  test('should get user events', async () => {
    await analytics.trackEvent('test', 'user123', 'session1');
    await analytics.trackEvent('test', 'user123', 'session2');

    const events = await analytics.getUserEvents('user123');
    expect(events.length).toBe(2);
  });

  test('should aggregate events', async () => {
    await analytics.trackEvent('page_view', undefined, 'session1');
    await analytics.trackEvent('page_view', undefined, 'session2');

    const result = await analytics.aggregate('page_view', 'count');
    expect(result.totalEvents).toBe(2);
  });

  test('should get time series', async () => {
    const timeRange = { start: new Date(Date.now() - 86400000), end: new Date() };
    const series = await analytics.getTimeSeries('test', timeRange, 'daily');
    expect(Array.isArray(series)).toBe(true);
  });

  test('should access funnel service', () => {
    expect(analytics.funnel).toBeDefined();
  });

  test('should access abtest service', () => {
    expect(analytics.abtest).toBeDefined();
  });

  test('should access report service', () => {
    expect(analytics.report).toBeDefined();
  });

  test('should access dashboard service', () => {
    expect(analytics.dashboard).toBeDefined();
  });

  test('should access journey service', () => {
    expect(analytics.journey).toBeDefined();
  });

  test('should access retention service', () => {
    expect(analytics.retention).toBeDefined();
  });

  test('should access realtime service', () => {
    expect(analytics.realtime).toBeDefined();
  });

  test('should access metric service', () => {
    expect(analytics.metric).toBeDefined();
  });
});

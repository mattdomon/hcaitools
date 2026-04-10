/**
 * Reporting & Business Intelligence Tests
 */

import {
  ReportBuilderImpl,
  ReportCacheServiceImpl,
  ChartRendererImpl,
  ScheduledReportServiceImpl,
  ExportServiceImpl,
  DrillDownServiceImpl,
  FilterServiceImpl,
  ReportingService,
  createReportBuilder,
  createChartRenderer,
  createScheduledReportService,
  createExportService,
  createDrillDownService,
  createFilterService,
  createReportingService,
} from '../src/core/reporting/reporting';
import {
  ReportingManus,
  createReporting,
} from '../src/core/reporting';
import {
  ReportType,
  ChartType,
  ExportFormat,
  ScheduleType,
  FilterType,
  FilterOperator,
  DataSourceConfig,
  ChartConfiguration,
  DrillDownConfig,
  DrillDownLevel,
  ReportFilter,
  ReportSection,
  DragDropItem,
} from '../src/core/reporting/types';

describe('ReportBuilderImpl', () => {
  let builder: ReportBuilderImpl;

  beforeEach(() => {
    builder = createReportBuilder();
  });

  describe('Report Creation', () => {
    test('should create a tabular report', async () => {
      const dataSource: DataSourceConfig = { type: 'database' };
      const report = await builder.createReport('Test Report', 'tabular', dataSource);

      expect(report.reportId).toBeDefined();
      expect(report.name).toBe('Test Report');
      expect(report.type).toBe('tabular');
      expect(report.dataSource.type).toBe('database');
      expect(report.sections).toHaveLength(0);
      expect(report.filters).toHaveLength(0);
    });

    test('should create a chart report', async () => {
      const dataSource: DataSourceConfig = { type: 'api' };
      const report = await builder.createReport('Chart Report', 'chart', dataSource);

      expect(report.reportId).toBeDefined();
      expect(report.type).toBe('chart');
      expect(report.dataSource.type).toBe('api');
    });

    test('should create a metric_card report', async () => {
      const report = await builder.createReport('Metrics', 'metric_card', { type: 'custom' });

      expect(report.reportId).toBeDefined();
      expect(report.type).toBe('metric_card');
    });

    test('should create a pivot_table report', async () => {
      const report = await builder.createReport('Pivot', 'pivot_table', { type: 'file' });

      expect(report.reportId).toBeDefined();
      expect(report.type).toBe('pivot_table');
    });

    test('should generate unique report IDs', async () => {
      const report1 = await builder.createReport('Report 1', 'tabular', { type: 'database' });
      const report2 = await builder.createReport('Report 2', 'tabular', { type: 'database' });

      expect(report1.reportId).not.toBe(report2.reportId);
    });
  });

  describe('Report Retrieval', () => {
    test('should get existing report by ID', async () => {
      const created = await builder.createReport('Test', 'tabular', { type: 'database' });
      const retrieved = await builder.getReport(created.reportId);

      expect(retrieved?.reportId).toBe(created.reportId);
      expect(retrieved?.name).toBe('Test');
    });

    test('should return null for non-existent report', async () => {
      const result = await builder.getReport('non_existent_id');
      expect(result).toBeNull();
    });
  });

  describe('Report Update', () => {
    test('should update report name', async () => {
      const report = await builder.createReport('Original', 'tabular', { type: 'database' });
      const updated = await builder.updateReport(report.reportId, { name: 'Updated' });

      expect(updated.name).toBe('Updated');
      expect(updated.reportId).toBe(report.reportId);
    });

    test('should update report description', async () => {
      const report = await builder.createReport('Test', 'tabular', { type: 'database' });
      const updated = await builder.updateReport(report.reportId, { description: 'New description' });

      expect(updated.description).toBe('New description');
    });

    test('should throw error when updating non-existent report', async () => {
      await expect(builder.updateReport('non_existent', {})).rejects.toThrow('Report non_existent not found');
    });
  });

  describe('Report Deletion', () => {
    test('should delete existing report', async () => {
      const report = await builder.createReport('Test', 'tabular', { type: 'database' });
      await builder.deleteReport(report.reportId);

      const result = await builder.getReport(report.reportId);
      expect(result).toBeNull();
    });

    test('should delete report and invalidate cache', async () => {
      const report = await builder.createReport('Test', 'tabular', { type: 'database' });
      const cache = builder.getCacheService();

      await cache.set({
        reportId: report.reportId,
        parameters: {},
        data: { test: true },
        expiresAt: new Date(Date.now() + 60000),
        sizeBytes: 100,
      });

      await builder.deleteReport(report.reportId);
      const cached = await cache.get(report.reportId, {});
      expect(cached).toBeNull();
    });
  });

  describe('Section Management', () => {
    test('should add section to report', async () => {
      const report = await builder.createReport('Test', 'tabular', { type: 'database' });
      const section = await builder.addSection(report.reportId, {
        title: 'Section 1',
        type: 'tabular',
        position: 0,
        fields: ['field1', 'field2'],
      });

      expect(section.sectionId).toBeDefined();
      expect(section.title).toBe('Section 1');
    });

    test('should remove section from report', async () => {
      const report = await builder.createReport('Test', 'tabular', { type: 'database' });
      const section = await builder.addSection(report.reportId, {
        title: 'Section 1',
        type: 'tabular',
        position: 0,
      });

      await builder.removeSection(report.reportId, section.sectionId);

      const updated = await builder.getReport(report.reportId);
      expect(updated?.sections).toHaveLength(0);
    });
  });

  describe('Filter Management', () => {
    test('should add filter to report', async () => {
      const report = await builder.createReport('Test', 'tabular', { type: 'database' });
      const filter = await builder.addFilter(report.reportId, {
        field: 'status',
        label: 'Status',
        type: 'select',
        operator: 'eq',
        value: 'active',
        required: true,
      });

      expect(filter.filterId).toBeDefined();
      expect(filter.field).toBe('status');
    });

    test('should remove filter from report', async () => {
      const report = await builder.createReport('Test', 'tabular', { type: 'database' });
      const filter = await builder.addFilter(report.reportId, {
        field: 'status',
        label: 'Status',
        type: 'select',
        operator: 'eq',
        value: 'active',
        required: false,
      });

      await builder.removeFilter(report.reportId, filter.filterId);

      const updated = await builder.getReport(report.reportId);
      expect(updated?.filters).toHaveLength(0);
    });
  });

  describe('Drag and Drop Items', () => {
    test('should add drag drop item', async () => {
      const report = await builder.createReport('Test', 'tabular', { type: 'database' });
      const item = await builder.addDragDropItem(report.reportId, {
        type: 'field',
        label: 'Customer Name',
        dataField: 'customer_name',
      });

      expect(item.itemId).toBeDefined();
      expect(item.type).toBe('field');
      expect(item.dataField).toBe('customer_name');
    });

    test('should add metric item with aggregation', async () => {
      const report = await builder.createReport('Test', 'tabular', { type: 'database' });
      const item = await builder.addDragDropItem(report.reportId, {
        type: 'metric',
        label: 'Total Sales',
        dataField: 'sales',
        aggregation: 'sum',
      });

      expect(item.aggregation).toBe('sum');
    });

    test('should remove drag drop item', async () => {
      const report = await builder.createReport('Test', 'tabular', { type: 'database' });
      const item = await builder.addDragDropItem(report.reportId, {
        type: 'field',
        label: 'Test',
        dataField: 'test_field',
      });

      await builder.removeDragDropItem(report.reportId, item.itemId);

      const updated = await builder.getReport(report.reportId);
      expect(updated?.items).toHaveLength(0);
    });
  });

  describe('Section Reordering', () => {
    test('should reorder sections', async () => {
      const report = await builder.createReport('Test', 'tabular', { type: 'database' });
      const section1 = await builder.addSection(report.reportId, {
        title: 'Section 1',
        type: 'tabular',
        position: 0,
      });
      const section2 = await builder.addSection(report.reportId, {
        title: 'Section 2',
        type: 'chart',
        position: 1,
      });

      await builder.reorderSections(report.reportId, [section2.sectionId, section1.sectionId]);

      const updated = await builder.getReport(report.reportId);
      expect(updated?.sections[0].title).toBe('Section 2');
      expect(updated?.sections[1].title).toBe('Section 1');
    });
  });

  describe('Report Execution', () => {
    test('should execute report and return data', async () => {
      const report = await builder.createReport('Test', 'tabular', { type: 'database' });
      await builder.addDragDropItem(report.reportId, {
        type: 'field',
        label: 'ID',
        dataField: 'id',
      });

      const result = await builder.executeReport({ reportId: report.reportId });

      expect(result.reportId).toBe(report.reportId);
      expect(result.data).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.executionTimeMs).toBeDefined();
    });

    test('should use cache on second execution', async () => {
      const report = await builder.createReport('Test', 'tabular', { type: 'database' });

      const result1 = await builder.executeReport({ reportId: report.reportId });
      const result2 = await builder.executeReport({ reportId: report.reportId });

      expect(result2.cached).toBe(true);
    });
  });

  describe('List Reports', () => {
    test('should list all reports', async () => {
      await builder.createReport('Report 1', 'tabular', { type: 'database' });
      await builder.createReport('Report 2', 'chart', { type: 'api' });

      const reports = await builder.listReports();
      expect(reports.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('ReportCacheServiceImpl', () => {
  let cache: ReportCacheServiceImpl;

  beforeEach(() => {
    cache = new ReportCacheServiceImpl();
  });

  test('should store and retrieve cache entry', async () => {
    await cache.set({
      reportId: 'report1',
      parameters: { param1: 'value1' },
      data: { rows: 100 },
      expiresAt: new Date(Date.now() + 60000),
      sizeBytes: 1024,
    });

    const result = await cache.get('report1', { param1: 'value1' });
    expect(result).not.toBeNull();
    expect(result?.data).toEqual({ rows: 100 });
  });

  test('should return null for expired cache', async () => {
    await cache.set({
      reportId: 'report1',
      parameters: {},
      data: { test: true },
      expiresAt: new Date(Date.now() - 1000),
      sizeBytes: 100,
    });

    const result = await cache.get('report1', {});
    expect(result).toBeNull();
  });

  test('should clear expired entries', async () => {
    await cache.set({
      reportId: 'report1',
      parameters: {},
      data: { test: true },
      expiresAt: new Date(Date.now() - 1000),
      sizeBytes: 100,
    });

    const cleared = await cache.clearExpired();
    expect(cleared).toBe(1);
  });

  test('should calculate cache stats', async () => {
    await cache.set({
      reportId: 'report1',
      parameters: {},
      data: { test: true },
      expiresAt: new Date(Date.now() + 60000),
      sizeBytes: 100,
    });

    const stats = await cache.getStats();
    expect(stats.totalEntries).toBe(1);
    expect(stats.totalSizeBytes).toBe(100);
  });
});

describe('ChartRendererImpl', () => {
  let renderer: ChartRendererImpl;

  beforeEach(() => {
    renderer = createChartRenderer();
  });

  test('should render gauge chart', async () => {
    const config: ChartConfiguration = {
      type: 'gauge',
      showLegend: false,
      showGrid: true,
      animationEnabled: true,
      dataLabelsEnabled: false,
    };

    const result = await renderer.render('gauge', 75, config);
    expect(result).toHaveProperty('type', 'gauge');
    expect(result).toHaveProperty('value', 75);
  });

  test('should render pie chart', async () => {
    const data = { Apples: 30, Oranges: 20, Bananas: 50 };
    const config: ChartConfiguration = {
      type: 'pie',
      showLegend: true,
      showGrid: false,
      animationEnabled: true,
      dataLabelsEnabled: true,
    };

    const result = await renderer.render('pie', data, config);
    expect(result).toHaveProperty('type', 'pie');
    expect(result).toHaveProperty('data');
  });

  test('should render donut chart', async () => {
    const data = { Category1: 100, Category2: 200 };
    const config: ChartConfiguration = {
      type: 'donut',
      showLegend: true,
      showGrid: false,
      animationEnabled: true,
      dataLabelsEnabled: false,
    };

    const result = await renderer.render('donut', data, config);
    expect(result).toHaveProperty('type', 'donut');
  });

  test('should render line chart', async () => {
    const data = [{ date: '2024-01-01', value: 100 }];
    const config: ChartConfiguration = {
      type: 'line',
      title: 'Trend',
      xAxis: 'Date',
      yAxis: 'Value',
      showLegend: true,
      showGrid: true,
      animationEnabled: true,
      dataLabelsEnabled: false,
    };

    const result = await renderer.render('line', data, config);
    expect(result).toHaveProperty('type', 'line');
  });

  test('should render bar chart', async () => {
    const data = [{ month: 'Jan', sales: 5000 }];
    const config: ChartConfiguration = {
      type: 'bar',
      showLegend: false,
      showGrid: true,
      animationEnabled: true,
      dataLabelsEnabled: true,
    };

    const result = await renderer.render('bar', data, config);
    expect(result).toHaveProperty('type', 'bar');
  });
});

describe('ScheduledReportServiceImpl', () => {
  let scheduler: ScheduledReportServiceImpl;

  beforeEach(() => {
    scheduler = createScheduledReportService();
  });

  test('should create daily schedule', async () => {
    const schedule = await scheduler.createSchedule({
      reportId: 'report1',
      name: 'Daily Sales',
      schedule: 'daily',
      enabled: true,
      recipients: ['user1@example.com'],
      format: 'pdf',
    });

    expect(schedule.scheduleId).toBeDefined();
    expect(schedule.schedule).toBe('daily');
    expect(schedule.nextRunAt).toBeInstanceOf(Date);
  });

  test('should create weekly schedule', async () => {
    const schedule = await scheduler.createSchedule({
      reportId: 'report1',
      name: 'Weekly Summary',
      schedule: 'weekly',
      enabled: true,
      recipients: ['user1@example.com'],
      format: 'excel',
    });

    expect(schedule.schedule).toBe('weekly');
  });

  test('should get schedule by ID', async () => {
    const created = await scheduler.createSchedule({
      reportId: 'report1',
      name: 'Test',
      schedule: 'once',
      enabled: true,
      recipients: [],
      format: 'csv',
    });

    const retrieved = await scheduler.getSchedule(created.scheduleId);
    expect(retrieved?.name).toBe('Test');
  });

  test('should enable schedule', async () => {
    const schedule = await scheduler.createSchedule({
      reportId: 'report1',
      name: 'Test',
      schedule: 'daily',
      enabled: false,
      recipients: [],
      format: 'json',
    });

    const enabled = await scheduler.enableSchedule(schedule.scheduleId);
    expect(enabled.enabled).toBe(true);
  });

  test('should disable schedule', async () => {
    const schedule = await scheduler.createSchedule({
      reportId: 'report1',
      name: 'Test',
      schedule: 'monthly',
      enabled: true,
      recipients: [],
      format: 'pdf',
    });

    const disabled = await scheduler.disableSchedule(schedule.scheduleId);
    expect(disabled.enabled).toBe(false);
  });

  test('should list schedules by report ID', async () => {
    await scheduler.createSchedule({
      reportId: 'report1',
      name: 'Schedule 1',
      schedule: 'daily',
      enabled: true,
      recipients: [],
      format: 'pdf',
    });
    await scheduler.createSchedule({
      reportId: 'report1',
      name: 'Schedule 2',
      schedule: 'weekly',
      enabled: true,
      recipients: [],
      format: 'csv',
    });

    const schedules = await scheduler.listSchedules('report1');
    expect(schedules.length).toBe(2);
  });
});

describe('ExportServiceImpl', () => {
  let exporter: ExportServiceImpl;

  beforeEach(() => {
    exporter = createExportService();
  });

  test('should export to CSV', async () => {
    const data = [
      { id: 1, name: 'Item 1', value: 100 },
      { id: 2, name: 'Item 2', value: 200 },
    ];

    const csv = await exporter.exportToCsv(data);
    expect(csv).toContain('id,name,value');
    expect(csv).toContain('Item 1');
  });

  test('should export to JSON', async () => {
    const data = { total: 100, items: ['a', 'b'] };
    const json = await exporter.exportToJson(data);

    expect(JSON.parse(json)).toEqual(data);
  });

  test('should generate unique export IDs', () => {
    const id1 = exporter.generateExportId();
    const id2 = exporter.generateExportId();

    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^exp_[a-f0-9]+$/);
  });
});

describe('FilterServiceImpl', () => {
  let filterService: FilterServiceImpl;

  beforeEach(() => {
    filterService = createFilterService();
  });

  test('should apply equal filter', () => {
    const data = [
      { id: 1, status: 'active' },
      { id: 2, status: 'inactive' },
    ];
    const filters: ReportFilter[] = [
      {
        filterId: 'f1',
        field: 'status',
        label: 'Status',
        type: 'select',
        operator: 'eq',
        value: 'active',
        required: false,
      },
    ];

    const result = filterService.applyFilters(data, filters);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 1, status: 'active' });
  });

  test('should apply numeric greater than filter', () => {
    const data = [
      { id: 1, value: 10 },
      { id: 2, value: 20 },
      { id: 3, value: 30 },
    ];
    const filters: ReportFilter[] = [
      {
        filterId: 'f1',
        field: 'value',
        label: 'Value',
        type: 'number',
        operator: 'gt',
        value: 15,
        required: false,
      },
    ];

    const result = filterService.applyFilters(data, filters) as Array<{ id: number; value: number }>;
    expect(result).toHaveLength(2);
    expect(result[0].value).toBeGreaterThan(15);
  });

  test('should validate filter values', () => {
    const filter: ReportFilter = {
      filterId: 'f1',
      field: 'age',
      label: 'Age',
      type: 'number',
      operator: 'gt',
      value: 18,
      required: true,
    };

    expect(filterService.validateFilter(filter, 25)).toBe(true);
    expect(filterService.validateFilter(filter, 'twenty')).toBe(false);
    expect(filterService.validateFilter(filter, undefined)).toBe(false);
  });

  test('should build filter query', () => {
    const filters: ReportFilter[] = [
      {
        filterId: 'f1',
        field: 'status',
        label: 'Status',
        type: 'select',
        operator: 'eq',
        value: 'active',
        required: false,
      },
      {
        filterId: 'f2',
        field: 'category',
        label: 'Category',
        type: 'select',
        operator: 'in',
        value: ['a', 'b'],
        required: false,
      },
    ];

    const query = filterService.buildFilterQuery(filters);
    expect(query).toContain("status eq 'active'");
    expect(query).toContain('category IN (a, b)');
  });
});

describe('DrillDownServiceImpl', () => {
  let drillDownService: DrillDownServiceImpl;

  beforeEach(() => {
    const builder = createReportBuilder();
    drillDownService = createDrillDownService(builder);
  });

  test('should set and get drill down config', async () => {
    const config: DrillDownConfig = {
      enabled: true,
      levels: [
        { level: 0, label: 'Year', groupByField: 'year' },
        { level: 1, label: 'Month', groupByField: 'month', aggregation: 'sum' },
      ],
      defaultExpandLevel: 0,
    };

    await drillDownService.setDrillDownConfig('report1', config);
    const retrieved = await drillDownService.getDrillDownConfig('report1');

    expect(retrieved?.enabled).toBe(true);
    expect(retrieved?.levels).toHaveLength(2);
  });

  test('should get drill down data for level', async () => {
    const config: DrillDownConfig = {
      enabled: true,
      levels: [
        { level: 0, label: 'Region', groupByField: 'region' },
      ],
      defaultExpandLevel: 0,
    };

    await drillDownService.setDrillDownConfig('report1', config);
    const data = await drillDownService.getDrillDownData('report1', 0, {});

    expect(Array.isArray(data)).toBe(true);
  });
});

describe('ReportingManus', () => {
  let reporting: ReportingManus;

  beforeEach(() => {
    reporting = createReporting();
  });

  test('should create report via convenience method', async () => {
    const report = await reporting.createReport('Test Report', 'tabular');
    expect(report.name).toBe('Test Report');
  });

  test('should render chart via convenience method', async () => {
    const result = await reporting.renderChart('line', [], {
      type: 'line',
      showLegend: true,
      showGrid: true,
      animationEnabled: true,
      dataLabelsEnabled: false,
    });

    expect(result).toHaveProperty('type', 'line');
  });

  test('should export report', async () => {
    const report = await reporting.createReport('Export Test', 'tabular');
    const exported = await reporting.exportReport(report.reportId, 'json');

    expect(typeof exported).toBe('string');
    expect(JSON.parse(exported)).toHaveProperty('data');
  });

  test('should get cache stats', async () => {
    const stats = await reporting.getCacheStats();
    expect(stats).toHaveProperty('totalEntries');
    expect(stats).toHaveProperty('hitRate');
  });

  test('should clear expired cache', async () => {
    const count = await reporting.clearExpiredCache();
    expect(typeof count).toBe('number');
  });
});

describe('ReportingService', () => {
  let service: ReportingService;

  beforeEach(() => {
    service = createReportingService();
  });

  test('should create quick report', async () => {
    const report = await service.createQuickReport('Quick Report', 'chart');
    expect(report.name).toBe('Quick Report');
    expect(report.type).toBe('chart');
  });

  test('should execute report with filters', async () => {
    const report = await service.builder.createReport('Filter Test', 'tabular', { type: 'database' });
    await service.builder.addFilter(report.reportId, {
      field: 'status',
      label: 'Status',
      type: 'select',
      operator: 'eq',
      value: 'active',
      required: false,
    });

    const result = await service.executeWithFilters({
      reportId: report.reportId,
      filters: [{ filterId: 'f1', value: 'active' }],
    });

    expect(result.reportId).toBe(report.reportId);
  });
});

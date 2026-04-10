/**
 * Data Visualization & Charts Tests
 * Comprehensive test suite for Manus AI Platform Data Visualization Module
 */

import {
  ChartServiceImpl,
  ThemeServiceImpl,
  ConfigurationServiceImpl,
  AggregationServiceImpl,
  TransformServiceImpl,
  ViewportServiceImpl,
  ExportServiceImpl,
  createChartService,
  createThemeService,
  createAggregationService,
  createTransformService,
} from '../src/core/dataVisualization/dataVisualization';

import {
  ChartType,
  DataPoint,
  ChartFilter,
  AggregationFunction,
  GroupByFunction,
  ExportOptions,
  ChartConfiguration,
} from '../src/core/dataVisualization/types';

describe('ChartServiceImpl', () => {
  let service: ChartServiceImpl;

  beforeEach(() => {
    service = new ChartServiceImpl();
  });

  test('should create a chart with no series', async () => {
    const chart = await service.createChart('Test Chart', 'line');
    expect(chart.chartId).toBeDefined();
    expect(chart.title).toBe('Test Chart');
    expect(chart.type).toBe('line');
    expect(chart.series).toHaveLength(0);
  });

  test('should create a chart with series', async () => {
    const series = [
      { name: 'Series 1', type: 'line' as ChartType, data: [{ x: 1, y: 10 }] },
    ];
    const chart = await service.createChart('Test Chart', 'line', series);
    expect(chart.series).toHaveLength(1);
    expect(chart.series[0].seriesId).toBeDefined();
    expect(chart.series[0].name).toBe('Series 1');
  });

  test('should get a chart by id', async () => {
    const created = await service.createChart('Test Chart', 'bar');
    const retrieved = await service.getChart(created.chartId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.chartId).toBe(created.chartId);
  });

  test('should return null for non-existent chart', async () => {
    const chart = await service.getChart('non-existent');
    expect(chart).toBeNull();
  });

  test('should update chart title', async () => {
    const chart = await service.createChart('Original Title', 'line');
    const updated = await service.updateChart(chart.chartId, { title: 'New Title' });
    expect(updated.title).toBe('New Title');
  });

  test('should delete a chart', async () => {
    const chart = await service.createChart('Test Chart', 'line');
    await service.deleteChart(chart.chartId);
    const retrieved = await service.getChart(chart.chartId);
    expect(retrieved).toBeNull();
  });

  test('should add a series to chart', async () => {
    const chart = await service.createChart('Test Chart', 'line');
    const series = await service.addSeries(chart.chartId, {
      name: 'New Series',
      type: 'bar',
      data: [{ x: 'A', y: 5 }],
    });
    expect(series.seriesId).toBeDefined();
    const updated = await service.getChart(chart.chartId);
    expect(updated?.series).toHaveLength(1);
  });

  test('should remove a series from chart', async () => {
    const chart = await service.createChart('Test Chart', 'line');
    const series = await service.addSeries(chart.chartId, {
      name: 'Series to Remove',
      type: 'line',
      data: [],
    });
    await service.removeSeries(chart.chartId, series.seriesId);
    const updated = await service.getChart(chart.chartId);
    expect(updated?.series).toHaveLength(0);
  });

  test('should update a series', async () => {
    const chart = await service.createChart('Test Chart', 'line');
    const series = await service.addSeries(chart.chartId, {
      name: 'Original',
      type: 'line',
      data: [],
    });
    const updated = await service.updateSeries(chart.chartId, series.seriesId, {
      name: 'Updated',
      color: '#FF0000',
    });
    expect(updated.name).toBe('Updated');
    expect(updated.color).toBe('#FF0000');
  });

  test('should get a series by id', async () => {
    const chart = await service.createChart('Test Chart', 'line');
    const series = await service.addSeries(chart.chartId, {
      name: 'Test Series',
      type: 'line',
      data: [{ x: 1, y: 2 }],
    });
    const retrieved = await service.getSeries(chart.chartId, series.seriesId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe('Test Series');
  });

  test('should list all charts', async () => {
    await service.createChart('Chart 1', 'line');
    await service.createChart('Chart 2', 'bar');
    const charts = await service.listCharts();
    expect(charts).toHaveLength(2);
  });

  test('should clone a chart', async () => {
    const original = await service.createChart('Original', 'line', [
      { name: 'Series 1', type: 'line', data: [{ x: 1, y: 10 }] },
    ]);
    const cloned = await service.cloneChart(original.chartId, 'Cloned');
    expect(cloned.chartId).not.toBe(original.chartId);
    expect(cloned.title).toBe('Cloned');
    expect(cloned.series).toHaveLength(1);
  });

  test('should throw error when updating non-existent chart', async () => {
    await expect(service.updateChart('non-existent', { title: 'New' })).rejects.toThrow();
  });

  test('should throw error when deleting non-existent chart', async () => {
    await expect(service.deleteChart('non-existent')).rejects.toThrow();
  });
});

describe('ThemeServiceImpl', () => {
  let service: ThemeServiceImpl;

  beforeEach(() => {
    service = new ThemeServiceImpl();
  });

  test('should create a theme', async () => {
    const theme = await service.createTheme('Custom Theme', ['#000', '#FFF']);
    expect(theme.themeId).toBeDefined();
    expect(theme.name).toBe('Custom Theme');
    expect(theme.colors).toEqual(['#000', '#FFF']);
  });

  test('should get a theme by id', async () => {
    const created = await service.createTheme('Test Theme', ['#111']);
    const retrieved = await service.getTheme(created.themeId);
    expect(retrieved?.name).toBe('Test Theme');
  });

  test('should return null for non-existent theme', async () => {
    const theme = await service.getTheme('non-existent');
    expect(theme).toBeNull();
  });

  test('should update a theme', async () => {
    const theme = await service.createTheme('Test', ['#000']);
    const updated = await service.updateTheme(theme.themeId, { name: 'Updated' });
    expect(updated.name).toBe('Updated');
  });

  test('should delete a theme', async () => {
    const theme = await service.createTheme('To Delete', ['#000']);
    await service.deleteTheme(theme.themeId);
    const retrieved = await service.getTheme(theme.themeId);
    expect(retrieved).toBeNull();
  });

  test('should list all themes', async () => {
    await service.createTheme('Theme 1', ['#000']);
    await service.createTheme('Theme 2', ['#111']);
    const themes = await service.listThemes();
    expect(themes.length).toBeGreaterThanOrEqual(2);
  });

  test('should get default theme', () => {
    const defaultTheme = service.getDefaultTheme();
    expect(defaultTheme.themeId).toBe('default');
    expect(defaultTheme.colors.length).toBeGreaterThan(0);
  });

  test('should throw error when deleting default theme', async () => {
    await expect(service.deleteTheme('default')).rejects.toThrow();
  });
});

describe('ConfigurationServiceImpl', () => {
  let service: ConfigurationServiceImpl;

  beforeEach(() => {
    service = new ConfigurationServiceImpl();
  });

  test('should get default configuration', async () => {
    const config = await service.getConfiguration('any-chart');
    expect(config.animation).toBeDefined();
    expect(config.interactivity).toBeDefined();
    expect(config.legend).toBeDefined();
  });

  test('should update configuration', async () => {
    const updated = await service.updateConfiguration('chart-1', {
      animation: { enabled: false, type: 'grow', duration: 500 },
    });
    expect(updated.animation?.enabled).toBe(false);
    expect(updated.animation?.duration).toBe(500);
  });

  test('should reset configuration', async () => {
    await service.updateConfiguration('chart-1', { responsive: false });
    const reset = await service.resetConfiguration('chart-1');
    expect(reset.responsive).toBe(true);
  });
});

describe('AggregationServiceImpl', () => {
  let service: AggregationServiceImpl;

  beforeEach(() => {
    service = new AggregationServiceImpl();
  });

  test('should aggregate with sum', async () => {
    const data: DataPoint[] = [
      { x: 1, y: 10 },
      { x: 2, y: 20 },
      { x: 3, y: 30 },
    ];
    const result = await service.aggregate(data, { function: 'sum' });
    expect(result).toHaveLength(1);
    expect(result[0].y).toBe(60);
  });

  test('should aggregate with average', async () => {
    const data: DataPoint[] = [
      { x: 1, y: 10 },
      { x: 2, y: 20 },
      { x: 3, y: 30 },
    ];
    const result = await service.aggregate(data, { function: 'average' });
    expect(result[0].y).toBe(20);
  });

  test('should aggregate with min', async () => {
    const data: DataPoint[] = [
      { x: 1, y: 10 },
      { x: 2, y: 5 },
      { x: 3, y: 30 },
    ];
    const result = await service.aggregate(data, { function: 'min' });
    expect(result[0].y).toBe(5);
  });

  test('should aggregate with max', async () => {
    const data: DataPoint[] = [
      { x: 1, y: 10 },
      { x: 2, y: 5 },
      { x: 3, y: 30 },
    ];
    const result = await service.aggregate(data, { function: 'max' });
    expect(result[0].y).toBe(30);
  });

  test('should aggregate with count', async () => {
    const data: DataPoint[] = [
      { x: 1, y: 10 },
      { x: 2, y: 20 },
      { x: 3, y: 30 },
    ];
    const result = await service.aggregate(data, { function: 'count' });
    expect(result[0].y).toBe(3);
  });

  test('should aggregate with median', async () => {
    const data: DataPoint[] = [
      { x: 1, y: 10 },
      { x: 2, y: 30 },
      { x: 3, y: 20 },
    ];
    const result = await service.aggregate(data, { function: 'median' });
    expect(result[0].y).toBe(20);
  });

  test('should return empty array for empty data', async () => {
    const result = await service.aggregate([], { function: 'sum' });
    expect(result).toHaveLength(0);
  });

  test('should group data by x value', async () => {
    const data: DataPoint[] = [
      { x: 'A', y: 10 },
      { x: 'A', y: 20 },
      { x: 'B', y: 15 },
    ];
    const groups = await service.groupBy(data, 'x', 'day');
    expect(groups.size).toBe(2);
    expect(groups.get('A')?.length).toBe(2);
    expect(groups.get('B')?.length).toBe(1);
  });

  test('should rollup data', async () => {
    const data: DataPoint[] = [
      { x: 1, y: 10 },
      { x: 2, y: 20 },
      { x: 3, y: 30 },
    ];
    const result = await service.rollup(data, [], 'sum');
    expect(result[0].y).toBe(60);
  });

  test('should perform time series aggregation', async () => {
    const now = new Date();
    const data: DataPoint[] = [
      { x: new Date(now.getTime()), y: 10 },
      { x: new Date(now.getTime() + 60000), y: 20 },
      { x: new Date(now.getTime() + 120000), y: 30 },
    ];
    const result = await service.timeSeriesAggregate(data, 'minute');
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  test('should apply filters in aggregation', async () => {
    const data: DataPoint[] = [
      { x: 1, y: 10 },
      { x: 2, y: 20 },
      { x: 3, y: 30 },
    ];
    const filters: ChartFilter[] = [
      { field: 'y', operator: 'gte', value: 20 },
    ];
    const result = await service.aggregate(data, { function: 'sum', filters });
    expect(result[0].y).toBe(50);
  });
});

describe('TransformServiceImpl', () => {
  let service: TransformServiceImpl;

  beforeEach(() => {
    service = new TransformServiceImpl();
  });

  test('should filter data by equal operator', () => {
    const data: DataPoint[] = [
      { x: 1, y: 10 },
      { x: 2, y: 20 },
      { x: 3, y: 30 },
    ];
    const filters: ChartFilter[] = [
      { field: 'y', operator: 'eq', value: 20 },
    ];
    const result = service.filter(data, filters);
    expect(result).toHaveLength(1);
    expect(result[0].y).toBe(20);
  });

  test('should filter data by greater than operator', () => {
    const data: DataPoint[] = [
      { x: 1, y: 10 },
      { x: 2, y: 20 },
      { x: 3, y: 30 },
    ];
    const filters: ChartFilter[] = [
      { field: 'y', operator: 'gt', value: 15 },
    ];
    const result = service.filter(data, filters);
    expect(result).toHaveLength(2);
  });

  test('should filter data by less than operator', () => {
    const data: DataPoint[] = [
      { x: 1, y: 10 },
      { x: 2, y: 20 },
      { x: 3, y: 30 },
    ];
    const filters: ChartFilter[] = [
      { field: 'y', operator: 'lt', value: 25 },
    ];
    const result = service.filter(data, filters);
    expect(result).toHaveLength(2);
  });

  test('should filter data by in operator', () => {
    const data: DataPoint[] = [
      { x: 1, y: 10 },
      { x: 2, y: 20 },
      { x: 3, y: 30 },
    ];
    const filters: ChartFilter[] = [
      { field: 'y', operator: 'in', value: [10, 30] },
    ];
    const result = service.filter(data, filters);
    expect(result).toHaveLength(2);
  });

  test('should filter data by contains operator', () => {
    const data: DataPoint[] = [
      { x: 'apple', y: 10 },
      { x: 'banana', y: 20 },
      { x: 'apricot', y: 30 },
    ];
    const filters: ChartFilter[] = [
      { field: 'x', operator: 'contains', value: 'ap' },
    ];
    const result = service.filter(data, filters);
    expect(result).toHaveLength(2);
  });

  test('should sort data ascending', () => {
    const data: DataPoint[] = [
      { x: 3, y: 30 },
      { x: 1, y: 10 },
      { x: 2, y: 20 },
    ];
    const result = service.sort(data, 'y', 'asc');
    expect(result[0].y).toBe(10);
    expect(result[1].y).toBe(20);
    expect(result[2].y).toBe(30);
  });

  test('should sort data descending', () => {
    const data: DataPoint[] = [
      { x: 1, y: 10 },
      { x: 2, y: 20 },
      { x: 3, y: 30 },
    ];
    const result = service.sort(data, 'y', 'desc');
    expect(result[0].y).toBe(30);
    expect(result[1].y).toBe(20);
    expect(result[2].y).toBe(10);
  });

  test('should pivot data', () => {
    const data: DataPoint[] = [
      { x: 'A', y: 10 },
      { x: 'B', y: 20 },
    ];
    const result = service.pivot(data, 'x', 'value', 'y');
    expect(result['A']['value']).toBe(10);
    expect(result['B']['value']).toBe(20);
  });
});

describe('ViewportServiceImpl', () => {
  let service: ViewportServiceImpl;

  beforeEach(() => {
    service = new ViewportServiceImpl();
  });

  test('should get default viewport', async () => {
    const viewport = await service.getViewport('any-chart');
    expect(viewport.startX).toBe(0);
    expect(viewport.endX).toBe(100);
    expect(viewport.scale).toBe(1);
  });

  test('should set viewport', async () => {
    const updated = await service.setViewport('chart-1', {
      startX: 10,
      endX: 50,
      startY: 20,
      endY: 80,
    });
    expect(updated.startX).toBe(10);
    expect(updated.endY).toBe(80);
  });

  test('should zoom to region', async () => {
    const initial = await service.setViewport('chart-1', {
      startX: 0,
      endX: 100,
      startY: 0,
      endY: 100,
      scale: 1,
    });
    const zoomed = await service.zoomTo('chart-1', 25, 75, 25, 75);
    expect(zoomed.scale).toBeGreaterThan(initial.scale);
  });

  test('should pan viewport', async () => {
    await service.setViewport('chart-1', {
      startX: 0,
      endX: 100,
      startY: 0,
      endY: 100,
      scale: 1,
    });
    const panned = await service.pan('chart-1', 10, 20);
    expect(panned.startX).toBe(-10);
    expect(panned.startY).toBe(-20);
  });

  test('should reset viewport', async () => {
    await service.setViewport('chart-1', {
      startX: 50,
      endX: 150,
      startY: 50,
      endY: 150,
      scale: 2,
    });
    const reset = await service.resetViewport('chart-1');
    expect(reset.startX).toBe(0);
    expect(reset.endX).toBe(100);
    expect(reset.scale).toBe(1);
  });
});

describe('ExportServiceImpl', () => {
  let chartService: ChartServiceImpl;
  let exportService: ExportServiceImpl;

  beforeEach(async () => {
    chartService = new ChartServiceImpl();
    exportService = new ExportServiceImpl(chartService['charts']);
  });

  test('should export chart as JSON', async () => {
    const chart = await chartService.createChart('Test Chart', 'line', [
      { name: 'Series 1', type: 'line', data: [{ x: 1, y: 10 }] },
    ]);
    const exported = await exportService.exportChart(chart.chartId, { format: 'json' });
    expect(exported).toContain('Test Chart');
  });

  test('should export data as CSV', async () => {
    const chart = await chartService.createChart('Test Chart', 'line', [
      { name: 'Series 1', type: 'line', data: [{ x: 1, y: 10 }] },
    ]);
    const exported = await exportService.exportData(chart.chartId, 'csv');
    expect(exported).toContain('x,y');
    expect(exported).toContain('1,10');
  });

  test('should export data as JSON', async () => {
    const chart = await chartService.createChart('Test Chart', 'line', [
      { name: 'Series 1', type: 'line', data: [{ x: 1, y: 10 }] },
    ]);
    const exported = await exportService.exportData(chart.chartId, 'json');
    expect(exported).toContain('seriesId');
    expect(exported).toContain('Series 1');
  });

  test('should export series as CSV', async () => {
    const chart = await chartService.createChart('Test Chart', 'line', [
      { name: 'Series 1', type: 'line', data: [{ x: 1, y: 10 }] },
    ]);
    const series = chart.series[0];
    const exported = await exportService.exportSeries(chart.chartId, series.seriesId, 'csv');
    expect(exported).toContain('1,10');
  });

  test('should export series as JSON', async () => {
    const chart = await chartService.createChart('Test Chart', 'line', [
      { name: 'Series 1', type: 'line', data: [{ x: 1, y: 10 }] },
    ]);
    const series = chart.series[0];
    const exported = await exportService.exportSeries(chart.chartId, series.seriesId, 'json');
    expect(exported).toContain('Series 1');
  });

  test('should throw error for non-existent chart', async () => {
    await expect(exportService.exportChart('non-existent', { format: 'json' })).rejects.toThrow();
  });
});

describe('ID Generation', () => {
  let service: ChartServiceImpl;

  beforeEach(() => {
    service = new ChartServiceImpl();
  });

  test('should generate unique chart IDs', async () => {
    const chart1 = await service.createChart('Chart 1', 'line');
    const chart2 = await service.createChart('Chart 2', 'line');
    expect(chart1.chartId).not.toBe(chart2.chartId);
  });

  test('should generate unique series IDs', async () => {
    const chart = await service.createChart('Chart', 'line');
    const series1 = await service.addSeries(chart.chartId, { name: 'S1', type: 'line', data: [] });
    const series2 = await service.addSeries(chart.chartId, { name: 'S2', type: 'line', data: [] });
    expect(series1.seriesId).not.toBe(series2.seriesId);
  });

  test('should generate IDs with correct prefix', async () => {
    const chart = await service.createChart('Chart', 'line');
    expect(chart.chartId).toMatch(/^chart_[a-f0-9]+$/);
  });
});

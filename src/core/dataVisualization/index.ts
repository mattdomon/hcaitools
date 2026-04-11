/**
 * Data Visualization & Charts Module
 * Comprehensive chart library for Manus AI Platform
 */

export {
  ChartType,
  DataSeriesType,
  AnimationType,
  ColorSchemeType,
  AggregationFunction,
  GroupByFunction,
  TimeRangePreset,
  DataPoint,
  DataSeries,
  ChartData,
  ChartTheme,
  ChartConfiguration,
  ChartFilter,
  AggregationOptions,
  TimeRange,
  RealTimeUpdate,
  ChartViewport,
  TooltipData,
  LegendItem,
  GaugeConfig,
  GaugeThreshold,
  HeatmapConfig,
  ChartAnnotation,
  DataTransformation,
  ExportOptions,
  ChartService,
  ThemeService,
  ConfigurationService,
  RealTimeService,
  AggregationService,
  TransformService,
  ViewportService,
  ExportService,
  DataVisualizationManager,
} from './types';

export {
  ChartServiceImpl,
  ThemeServiceImpl,
  ConfigurationServiceImpl,
  RealTimeServiceImpl,
  AggregationServiceImpl,
  TransformServiceImpl,
  ViewportServiceImpl,
  ExportServiceImpl,
  DataVisualizationManagerImpl,
  createDataVisualizationManager,
  createChartService,
  createThemeService,
  createAggregationService,
  createTransformService,
} from './dataVisualization';

import {
  createDataVisualizationManager,
} from './dataVisualization';

import {
  ChartType,
  DataPoint,
  ChartData,
  AggregationFunction,
  GroupByFunction,
  ChartFilter,
  DataVisualizationManager,
} from './types';

export class DataVisualization {
  private manager: DataVisualizationManager;

  constructor() {
    this.manager = createDataVisualizationManager();
  }

  get chart() {
    return this.manager.chartService;
  }

  get theme() {
    return this.manager.themeService;
  }

  get configuration() {
    return this.manager.configurationService;
  }

  get realtime() {
    return this.manager.realTimeService;
  }

  get aggregation() {
    return this.manager.aggregationService;
  }

  get transform() {
    return this.manager.transformService;
  }

  get viewport() {
    return this.manager.viewportService;
  }

  get export() {
    return this.manager.exportService;
  }

  async createLineChart(name: string, data: DataPoint[], options?: { title?: string }): Promise<ChartData> {
    return this.manager.chartService.createChart(
      options?.title || name,
      'line',
      [{
        name,
        type: 'line',
        data,
        visible: true,
      }]
    );
  }

  async createBarChart(name: string, data: DataPoint[], options?: { title?: string; stacked?: boolean }): Promise<ChartData> {
    return this.manager.chartService.createChart(
      options?.title || name,
      options?.stacked ? 'bar' : 'bar',
      [{
        name,
        type: 'bar',
        data,
        visible: true,
      }]
    );
  }

  async createPieChart(name: string, data: DataPoint[], options?: { title?: string }): Promise<ChartData> {
    return this.manager.chartService.createChart(
      options?.title || name,
      'pie',
      [{
        name,
        type: 'pie',
        data,
        visible: true,
      }]
    );
  }

  async createAreaChart(name: string, data: DataPoint[], options?: { title?: string }): Promise<ChartData> {
    return this.manager.chartService.createChart(
      options?.title || name,
      'area',
      [{
        name,
        type: 'area',
        data,
        visible: true,
      }]
    );
  }

  async createScatterChart(name: string, data: DataPoint[], options?: { title?: string }): Promise<ChartData> {
    return this.manager.chartService.createChart(
      options?.title || name,
      'scatter',
      [{
        name,
        type: 'scatter',
        data,
        visible: true,
      }]
    );
  }

  async createDonutChart(name: string, data: DataPoint[], options?: { title?: string }): Promise<ChartData> {
    return this.manager.chartService.createChart(
      options?.title || name,
      'donut',
      [{
        name,
        type: 'donut',
        data,
        visible: true,
      }]
    );
  }

  async createGaugeChart(name: string, value: number, options?: { title?: string; min?: number; max?: number }): Promise<ChartData> {
    return this.manager.chartService.createChart(
      options?.title || name,
      'gauge',
      [{
        name,
        type: 'gauge',
        data: [{ x: name, y: value }],
        visible: true,
      }]
    );
  }

  async createHeatmapChart(name: string, data: DataPoint[], options?: { title?: string }): Promise<ChartData> {
    return this.manager.chartService.createChart(
      options?.title || name,
      'heatmap',
      [{
        name,
        type: 'heatmap',
        data,
        visible: true,
      }]
    );
  }

  async createMultiSeriesChart(
    title: string,
    chartType: ChartType,
    series: Array<{ name: string; data: DataPoint[] }>
  ): Promise<ChartData> {
    return this.manager.chartService.createChart(
      title,
      chartType,
      series.map((s) => ({
        name: s.name,
        type: chartType,
        data: s.data,
        visible: true,
      }))
    );
  }

  async aggregate(data: DataPoint[], func: AggregationFunction, field?: string): Promise<DataPoint[]> {
    return this.manager.aggregationService.aggregate(data, { function: func, field });
  }

  async groupByTime(data: DataPoint[], interval: GroupByFunction): Promise<DataPoint[]> {
    return this.manager.aggregationService.timeSeriesAggregate(data, interval);
  }

  filterData(data: DataPoint[], filters: ChartFilter[]): DataPoint[] {
    return this.manager.transformService.filter(data, filters);
  }

  sortData(data: DataPoint[], field: 'x' | 'y', direction: 'asc' | 'desc'): DataPoint[] {
    return this.manager.transformService.sort(data, field, direction);
  }
}

export function createDataVisualization(): DataVisualization {
  return new DataVisualization();
}

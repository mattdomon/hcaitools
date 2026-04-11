/**
 * Data Visualization & Charts Implementation
 * Comprehensive chart library for Manus AI Platform
 */

import crypto from 'crypto';
import {
  ChartType,
  DataPoint,
  DataSeries,
  ChartData,
  ChartTheme,
  ChartConfiguration,
  ChartFilter,
  AggregationOptions,
  RealTimeUpdate,
  ChartViewport,
  ChartService,
  ThemeService,
  ConfigurationService,
  RealTimeService,
  AggregationService,
  TransformService,
  ViewportService,
  ExportService,
  DataTransformation,
  ExportOptions,
  AggregationFunction,
  GroupByFunction,
  DataVisualizationManager,
} from './types';

const DEFAULT_COLORS = [
  '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16',
];

const DEFAULT_THEME: ChartTheme = {
  themeId: 'default',
  name: 'Default',
  colors: DEFAULT_COLORS,
  backgroundColor: '#FFFFFF',
  textColor: '#1F2937',
  gridColor: '#E5E7EB',
  axisColor: '#6B7280',
  tooltipBackground: '#1F2937',
  legendPosition: 'bottom',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
};

const DEFAULT_CONFIGURATION: ChartConfiguration = {
  animation: {
    enabled: true,
    type: 'fade',
    duration: 300,
  },
  interactivity: {
    zoom: true,
    pan: true,
    tooltip: true,
    legendToggle: true,
    dataPointClick: true,
  },
  legend: {
    show: true,
    position: 'bottom',
    alignment: 'center',
  },
  axes: {
    x: {
      gridLines: true,
      rotation: 0,
    },
    y: {
      gridLines: true,
    },
  },
  responsive: true,
  maintainAspectRatio: true,
};

export class ChartServiceImpl implements ChartService {
  private charts: Map<string, ChartData> = new Map();

  async createChart(
    name: string,
    type: ChartType,
    series: Omit<DataSeries, 'seriesId'>[] = []
  ): Promise<ChartData> {
    const chartId = this.generateId('chart');

    const chartData: ChartData = {
      chartId,
      title: name,
      type,
      series: series.map((s) => ({
        ...s,
        seriesId: this.generateId('series'),
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.charts.set(chartId, chartData);
    return chartData;
  }

  async getChart(chartId: string): Promise<ChartData | null> {
    return this.charts.get(chartId) || null;
  }

  async updateChart(chartId: string, updates: Partial<ChartData>): Promise<ChartData> {
    const chart = this.charts.get(chartId);
    if (!chart) {
      throw new Error(`Chart ${chartId} not found`);
    }

    const updated: ChartData = {
      ...chart,
      ...updates,
      chartId,
      updatedAt: new Date(),
    };

    this.charts.set(chartId, updated);
    return updated;
  }

  async deleteChart(chartId: string): Promise<void> {
    if (!this.charts.has(chartId)) {
      throw new Error(`Chart ${chartId} not found`);
    }
    this.charts.delete(chartId);
  }

  async addSeries(
    chartId: string,
    series: Omit<DataSeries, 'seriesId'>
  ): Promise<DataSeries> {
    const chart = this.charts.get(chartId);
    if (!chart) {
      throw new Error(`Chart ${chartId} not found`);
    }

    const newSeries: DataSeries = {
      ...series,
      seriesId: this.generateId('series'),
    };

    chart.series.push(newSeries);
    chart.updatedAt = new Date();
    this.charts.set(chartId, chart);

    return newSeries;
  }

  async removeSeries(chartId: string, seriesId: string): Promise<void> {
    const chart = this.charts.get(chartId);
    if (!chart) {
      throw new Error(`Chart ${chartId} not found`);
    }

    chart.series = chart.series.filter((s) => s.seriesId !== seriesId);
    chart.updatedAt = new Date();
    this.charts.set(chartId, chart);
  }

  async updateSeries(
    chartId: string,
    seriesId: string,
    updates: Partial<DataSeries>
  ): Promise<DataSeries> {
    const chart = this.charts.get(chartId);
    if (!chart) {
      throw new Error(`Chart ${chartId} not found`);
    }

    const seriesIndex = chart.series.findIndex((s) => s.seriesId === seriesId);
    if (seriesIndex === -1) {
      throw new Error(`Series ${seriesId} not found in chart ${chartId}`);
    }

    const updatedSeries: DataSeries = {
      ...chart.series[seriesIndex],
      ...updates,
      seriesId,
    };

    chart.series[seriesIndex] = updatedSeries;
    chart.updatedAt = new Date();
    this.charts.set(chartId, chart);

    return updatedSeries;
  }

  async getSeries(chartId: string, seriesId: string): Promise<DataSeries | null> {
    const chart = this.charts.get(chartId);
    if (!chart) {
      return null;
    }

    return chart.series.find((s) => s.seriesId === seriesId) || null;
  }

  async listCharts(): Promise<ChartData[]> {
    return Array.from(this.charts.values());
  }

  async cloneChart(chartId: string, newName: string): Promise<ChartData> {
    const original = this.charts.get(chartId);
    if (!original) {
      throw new Error(`Chart ${chartId} not found`);
    }

    return this.createChart(
      newName,
      original.type,
      original.series.map((s) => ({
        name: s.name,
        type: s.type,
        data: [...s.data],
        color: s.color,
        visible: s.visible,
        metadata: s.metadata ? { ...s.metadata } : undefined,
      }))
    );
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export class ThemeServiceImpl implements ThemeService {
  private themes: Map<string, ChartTheme> = new Map();

  constructor() {
    this.themes.set(DEFAULT_THEME.themeId, DEFAULT_THEME);
  }

  async createTheme(
    name: string,
    colors: string[],
    options?: Partial<ChartTheme>
  ): Promise<ChartTheme> {
    const themeId = this.generateId('theme');

    const theme: ChartTheme = {
      ...DEFAULT_THEME,
      ...options,
      themeId,
      name,
      colors,
    };

    this.themes.set(themeId, theme);
    return theme;
  }

  async getTheme(themeId: string): Promise<ChartTheme | null> {
    return this.themes.get(themeId) || null;
  }

  async updateTheme(themeId: string, updates: Partial<ChartTheme>): Promise<ChartTheme> {
    const theme = this.themes.get(themeId);
    if (!theme) {
      throw new Error(`Theme ${themeId} not found`);
    }

    const updated: ChartTheme = { ...theme, ...updates, themeId };
    this.themes.set(themeId, updated);
    return updated;
  }

  async deleteTheme(themeId: string): Promise<void> {
    if (themeId === DEFAULT_THEME.themeId) {
      throw new Error('Cannot delete default theme');
    }
    this.themes.delete(themeId);
  }

  async listThemes(): Promise<ChartTheme[]> {
    return Array.from(this.themes.values());
  }

  getDefaultTheme(): ChartTheme {
    return DEFAULT_THEME;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export class ConfigurationServiceImpl implements ConfigurationService {
  private configurations: Map<string, ChartConfiguration> = new Map();

  async getConfiguration(chartId: string): Promise<ChartConfiguration> {
    return this.configurations.get(chartId) || { ...DEFAULT_CONFIGURATION };
  }

  async updateConfiguration(
    chartId: string,
    config: Partial<ChartConfiguration>
  ): Promise<ChartConfiguration> {
    const current = await this.getConfiguration(chartId);
    const updated = { ...current, ...config };
    this.configurations.set(chartId, updated);
    return updated;
  }

  async resetConfiguration(chartId: string): Promise<ChartConfiguration> {
    const defaultConfig = { ...DEFAULT_CONFIGURATION };
    this.configurations.set(chartId, defaultConfig);
    return defaultConfig;
  }
}

export class RealTimeServiceImpl implements RealTimeService {
  private subscribers: Map<string, Set<(update: RealTimeUpdate) => void>> = new Map();
  private lastUpdates: Map<string, RealTimeUpdate> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  subscribe(chartId: string, callback: (update: RealTimeUpdate) => void): () => void {
    if (!this.subscribers.has(chartId)) {
      this.subscribers.set(chartId, new Set());
    }

    this.subscribers.get(chartId)!.add(callback);

    return () => {
      const chartSubscribers = this.subscribers.get(chartId);
      if (chartSubscribers) {
        chartSubscribers.delete(callback);
        if (chartSubscribers.size === 0) {
          this.subscribers.delete(chartId);
        }
      }
    };
  }

  unsubscribe(chartId: string): void {
    this.subscribers.delete(chartId);
    const interval = this.intervals.get(chartId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(chartId);
    }
  }

  publishUpdate(chartId: string, seriesId: string, dataPoint: DataPoint): void {
    const update: RealTimeUpdate = {
      updateId: this.generateId('update'),
      chartId,
      seriesId,
      dataPoint,
      timestamp: new Date(),
    };

    this.lastUpdates.set(chartId, update);

    const chartSubscribers = this.subscribers.get(chartId);
    if (chartSubscribers) {
      for (const callback of chartSubscribers) {
        callback(update);
      }
    }
  }

  async getLastUpdate(chartId: string): Promise<RealTimeUpdate | null> {
    return this.lastUpdates.get(chartId) || null;
  }

  enableAutoUpdate(chartId: string, intervalMs: number, dataGenerator: () => DataPoint): void {
    const interval = setInterval(() => {
      const dataPoint = dataGenerator();
      this.publishUpdate(chartId, '', dataPoint);
    }, intervalMs);

    this.intervals.set(chartId, interval);
  }

  disableAutoUpdate(chartId: string): void {
    const interval = this.intervals.get(chartId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(chartId);
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export class AggregationServiceImpl implements AggregationService {
  async aggregate(data: DataPoint[], options: AggregationOptions): Promise<DataPoint[]> {
    if (data.length === 0) return [];

    const filtered = this.applyFilters(data, options.filters || []);

    switch (options.function) {
      case 'sum':
        return [this.sum(filtered, options.field)];
      case 'average':
        return [this.average(filtered, options.field)];
      case 'min':
        return [this.min(filtered, options.field)];
      case 'max':
        return [this.max(filtered, options.field)];
      case 'count':
        return [this.count(filtered)];
      case 'median':
        return [this.median(filtered, options.field)];
      default:
        return filtered;
    }
  }

  async groupBy(
    data: DataPoint[],
    _field: string,
    _groupFn: GroupByFunction
  ): Promise<Map<string, DataPoint[]>> {
    const groups = new Map<string, DataPoint[]>();

    for (const point of data) {
      const key = String(point.x);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(point);
    }

    return groups;
  }

  async rollup(
    data: DataPoint[],
    _groupBy: string[],
    aggFn: AggregationFunction
  ): Promise<DataPoint[]> {
    const groups = new Map<string, DataPoint[]>();

    for (const point of data) {
      const key = 'all';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(point);
    }

    const result: DataPoint[] = [];

    for (const points of groups.values()) {
      const aggregated = await this.aggregate(points, { function: aggFn });
      result.push(...aggregated);
    }

    return result;
  }

  async timeSeriesAggregate(data: DataPoint[], interval: GroupByFunction): Promise<DataPoint[]> {
    if (data.length === 0) return [];

    const grouped = new Map<number, DataPoint[]>();

    for (const point of data) {
      if (!(point.x instanceof Date)) continue;

      const timestamp = point.x.getTime();
      const bucket = this.getTimeBucket(timestamp, interval);

      if (!grouped.has(bucket)) {
        grouped.set(bucket, []);
      }
      grouped.get(bucket)!.push(point);
    }

    const result: DataPoint[] = [];

    for (const [bucket, points] of grouped) {
      const aggregated = await this.aggregate(points, { function: 'sum' });
      if (aggregated.length > 0) {
        result.push({
          x: new Date(bucket),
          y: aggregated[0].y,
        });
      }
    }

    return result.sort((a, b) => {
      const aTime = a.x instanceof Date ? a.x.getTime() : 0;
      const bTime = b.x instanceof Date ? b.x.getTime() : 0;
      return aTime - bTime;
    });
  }

  private applyFilters(data: DataPoint[], filters: ChartFilter[]): DataPoint[] {
    return data.filter((point) => {
      for (const filter of filters) {
        if (!this.matchesFilter(point, filter)) {
          return false;
        }
      }
      return true;
    });
  }

  private matchesFilter(point: DataPoint, filter: ChartFilter): boolean {
    const value = this.getFieldValue(point, filter.field);

    switch (filter.operator) {
      case 'eq':
        return value === filter.value;
      case 'neq':
        return value !== filter.value;
      case 'gt':
        return typeof value === 'number' && value > (filter.value as number);
      case 'gte':
        return typeof value === 'number' && value >= (filter.value as number);
      case 'lt':
        return typeof value === 'number' && value < (filter.value as number);
      case 'lte':
        return typeof value === 'number' && value <= (filter.value as number);
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(value);
      case 'contains':
        return typeof value === 'string' && value.includes(String(filter.value));
      default:
        return true;
    }
  }

  private getFieldValue(point: DataPoint, field: string): unknown {
    if (field === 'x') return point.x;
    if (field === 'y') return point.y;
    return point.metadata?.[field];
  }

  private sum(data: DataPoint[], field?: string): DataPoint {
    const values = data.map((p) => (field === 'y' ? p.y : this.getNumericValue(p, field)));
    return {
      x: 'Sum',
      y: values.reduce((a, b) => a + b, 0),
    };
  }

  private average(data: DataPoint[], field?: string): DataPoint {
    const values = data.map((p) => (field === 'y' ? p.y : this.getNumericValue(p, field)));
    return {
      x: 'Average',
      y: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
    };
  }

  private min(data: DataPoint[], field?: string): DataPoint {
    const values = data.map((p) => (field === 'y' ? p.y : this.getNumericValue(p, field)));
    return {
      x: 'Min',
      y: Math.min(...values),
    };
  }

  private max(data: DataPoint[], field?: string): DataPoint {
    const values = data.map((p) => (field === 'y' ? p.y : this.getNumericValue(p, field)));
    return {
      x: 'Max',
      y: Math.max(...values),
    };
  }

  private count(data: DataPoint[]): DataPoint {
    return {
      x: 'Count',
      y: data.length,
    };
  }

  private median(data: DataPoint[], field?: string): DataPoint {
    const values = data.map((p) => (field === 'y' ? p.y : this.getNumericValue(p, field))).sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    return {
      x: 'Median',
      y: values.length % 2 !== 0 ? values[mid] : (values[mid - 1] + values[mid]) / 2,
    };
  }

  private getNumericValue(point: DataPoint, field?: string): number {
    if (!field) return point.y;
    const value = point.metadata?.[field];
    return typeof value === 'number' ? value : 0;
  }

  private getTimeBucket(timestamp: number, interval: GroupByFunction): number {
    const date = new Date(timestamp);

    switch (interval) {
      case 'minute':
        date.setSeconds(0, 0);
        break;
      case 'hour':
        date.setMinutes(0, 0, 0);
        break;
      case 'day':
        date.setHours(0, 0, 0, 0);
        break;
      case 'week':
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - date.getDay());
        break;
      case 'month':
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        break;
      case 'year':
        date.setMonth(0, 1);
        date.setHours(0, 0, 0, 0);
        break;
    }

    return date.getTime();
  }
}

export class TransformServiceImpl implements TransformService {
  applyTransform(data: DataPoint[], transformation: DataTransformation): DataPoint[] {
    switch (transformation.type) {
      case 'filter':
        return this.filter(data, transformation.options.filters as ChartFilter[]);
      case 'sort':
        return this.sort(
          data,
          (transformation.options.field as 'x' | 'y') || 'x',
          (transformation.options.direction as 'asc' | 'desc') || 'asc'
        );
      case 'aggregate':
        return data;
      case 'group':
        return data;
      case 'pivot':
        return data;
      default:
        return data;
    }
  }

  filter(data: DataPoint[], filters: ChartFilter[]): DataPoint[] {
    return data.filter((point) => {
      for (const filter of filters) {
        if (!this.matchesFilter(point, filter)) {
          return false;
        }
      }
      return true;
    });
  }

  sort(data: DataPoint[], field: 'x' | 'y', direction: 'asc' | 'desc'): DataPoint[] {
    return [...data].sort((a, b) => {
      const aVal = field === 'x' ? a.x : a.y;
      const bVal = field === 'x' ? b.x : b.y;

      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else if (aVal instanceof Date && bVal instanceof Date) {
        comparison = aVal.getTime() - bVal.getTime();
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return direction === 'asc' ? comparison : -comparison;
    });
  }

  pivot(
    data: DataPoint[],
    _rowField: string,
    _colField: string,
    _valueField: string
  ): Record<string, Record<string, number>> {
    const result: Record<string, Record<string, number>> = {};

    for (const point of data) {
      const rowKey = String(point.x);
      const colKey = 'value';
      const value = point.y;

      if (!result[rowKey]) {
        result[rowKey] = {};
      }
      result[rowKey][colKey] = value;
    }

    return result;
  }

  private matchesFilter(point: DataPoint, filter: ChartFilter): boolean {
    const value = this.getFieldValue(point, filter.field);

    switch (filter.operator) {
      case 'eq':
        return value === filter.value;
      case 'neq':
        return value !== filter.value;
      case 'gt':
        return typeof value === 'number' && value > (filter.value as number);
      case 'gte':
        return typeof value === 'number' && value >= (filter.value as number);
      case 'lt':
        return typeof value === 'number' && value < (filter.value as number);
      case 'lte':
        return typeof value === 'number' && value <= (filter.value as number);
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(value);
      case 'contains':
        return typeof value === 'string' && value.includes(String(filter.value));
      default:
        return true;
    }
  }

  private getFieldValue(point: DataPoint, field: string): unknown {
    if (field === 'x') return point.x;
    if (field === 'y') return point.y;
    return point.metadata?.[field];
  }
}

export class ViewportServiceImpl implements ViewportService {
  private viewports: Map<string, ChartViewport> = new Map();

  async getViewport(chartId: string): Promise<ChartViewport> {
    return (
      this.viewports.get(chartId) || {
        startX: 0,
        endX: 100,
        startY: 0,
        endY: 100,
        scale: 1,
      }
    );
  }

  async setViewport(chartId: string, viewport: Partial<ChartViewport>): Promise<ChartViewport> {
    const current = await this.getViewport(chartId);
    const updated: ChartViewport = { ...current, ...viewport };
    this.viewports.set(chartId, updated);
    return updated;
  }

  async zoomTo(
    chartId: string,
    startX: number,
    endX: number,
    startY: number,
    endY: number
  ): Promise<ChartViewport> {
    const current = await this.getViewport(chartId);

    const newScaleX = current.scale * ((current.endX - current.startX) / (endX - startX));
    const newScaleY = current.scale * ((current.endY - current.startY) / (endY - startY));

    const updated: ChartViewport = {
      startX,
      endX,
      startY,
      endY,
      scale: Math.min(newScaleX, newScaleY, 10),
    };

    this.viewports.set(chartId, updated);
    return updated;
  }

  async pan(chartId: string, deltaX: number, deltaY: number): Promise<ChartViewport> {
    const current = await this.getViewport(chartId);

    const updated: ChartViewport = {
      ...current,
      startX: current.startX - deltaX,
      endX: current.endX - deltaX,
      startY: current.startY - deltaY,
      endY: current.endY - deltaY,
    };

    this.viewports.set(chartId, updated);
    return updated;
  }

  async resetViewport(chartId: string): Promise<ChartViewport> {
    const defaultViewport: ChartViewport = {
      startX: 0,
      endX: 100,
      startY: 0,
      endY: 100,
      scale: 1,
    };

    this.viewports.set(chartId, defaultViewport);
    return defaultViewport;
  }
}

export class ExportServiceImpl implements ExportService {
  private charts: Map<string, ChartData>;

  constructor(charts: Map<string, ChartData>) {
    this.charts = charts;
  }

  async exportChart(chartId: string, _options: ExportOptions): Promise<string> {
    const chart = this.charts.get(chartId);
    if (!chart) {
      throw new Error(`Chart ${chartId} not found`);
    }

    return JSON.stringify(chart, null, 2);
  }

  async exportData(chartId: string, format: 'csv' | 'json'): Promise<string> {
    const chart = this.charts.get(chartId);
    if (!chart) {
      throw new Error(`Chart ${chartId} not found`);
    }

    if (format === 'json') {
      const exportData = chart.series.map((s) => ({
        seriesId: s.seriesId,
        name: s.name,
        data: s.data,
      }));
      return JSON.stringify(exportData, null, 2);
    }

    const lines: string[] = ['x,y'];
    for (const series of chart.series) {
      for (const point of series.data) {
        lines.push(`${point.x},${point.y}`);
      }
    }

    return lines.join('\n');
  }

  async exportSeries(chartId: string, seriesId: string, format: 'csv' | 'json'): Promise<string> {
    const chart = this.charts.get(chartId);
    if (!chart) {
      throw new Error(`Chart ${chartId} not found`);
    }

    const series = chart.series.find((s) => s.seriesId === seriesId);
    if (!series) {
      throw new Error(`Series ${seriesId} not found`);
    }

    if (format === 'json') {
      return JSON.stringify(series, null, 2);
    }

    const lines: string[] = ['x,y'];
    for (const point of series.data) {
      lines.push(`${point.x},${point.y}`);
    }

    return lines.join('\n');
  }
}

export class DataVisualizationManagerImpl implements DataVisualizationManager {
  readonly chartService: ChartServiceImpl;
  readonly themeService: ThemeServiceImpl;
  readonly configurationService: ConfigurationServiceImpl;
  readonly realTimeService: RealTimeServiceImpl;
  readonly aggregationService: AggregationServiceImpl;
  readonly transformService: TransformServiceImpl;
  readonly viewportService: ViewportServiceImpl;
  readonly exportService: ExportServiceImpl;

  constructor() {
    this.chartService = new ChartServiceImpl();
    this.themeService = new ThemeServiceImpl();
    this.configurationService = new ConfigurationServiceImpl();
    this.realTimeService = new RealTimeServiceImpl();
    this.aggregationService = new AggregationServiceImpl();
    this.transformService = new TransformServiceImpl();
    this.viewportService = new ViewportServiceImpl();
    this.exportService = new ExportServiceImpl(this.chartService['charts']);
  }
}

export function createDataVisualizationManager(): DataVisualizationManager {
  return new DataVisualizationManagerImpl();
}

export function createChartService(): ChartService {
  return new ChartServiceImpl();
}

export function createThemeService(): ThemeService {
  return new ThemeServiceImpl();
}

export function createAggregationService(): AggregationService {
  return new AggregationServiceImpl();
}

export function createTransformService(): TransformService {
  return new TransformServiceImpl();
}

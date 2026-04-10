/**
 * Data Visualization & Charts Types
 * Comprehensive chart library for Manus AI Platform
 */

export type ChartType = 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'donut' | 'gauge' | 'heatmap';
export type DataSeriesType = 'single' | 'multiple' | 'stacked' | 'grouped';
export type AnimationType = 'fade' | 'slide' | 'grow';
export type ColorSchemeType = 'categorical' | 'sequential' | 'diverging';
export type AggregationFunction = 'sum' | 'average' | 'min' | 'max' | 'count' | 'median';
export type GroupByFunction = 'day' | 'week' | 'month' | 'year' | 'hour' | 'minute';
export type TimeRangePreset = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'last90days' | 'thisMonth' | 'lastMonth' | 'custom';

export interface DataPoint {
  x: number | string | Date;
  y: number;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface DataSeries {
  seriesId: string;
  name: string;
  type: ChartType;
  data: DataPoint[];
  color?: string;
  visible?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ChartData {
  chartId: string;
  title: string;
  type: ChartType;
  series: DataSeries[];
  labels?: string[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChartTheme {
  themeId: string;
  name: string;
  colors: string[];
  backgroundColor?: string;
  textColor?: string;
  gridColor?: string;
  axisColor?: string;
  tooltipBackground?: string;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  fontFamily?: string;
  fontSize?: number;
}

export interface ChartConfiguration {
  animation?: {
    enabled: boolean;
    type: AnimationType;
    duration: number;
  };
  interactivity?: {
    zoom: boolean;
    pan: boolean;
    tooltip: boolean;
    legendToggle: boolean;
    dataPointClick: boolean;
  };
  legend?: {
    show: boolean;
    position: 'top' | 'bottom' | 'left' | 'right';
    alignment: 'start' | 'center' | 'end';
  };
  axes?: {
    x: AxisConfiguration;
    y: AxisConfiguration;
  };
  responsive?: boolean;
  maintainAspectRatio?: boolean;
}

export interface AxisConfiguration {
  label?: string;
  min?: number;
  max?: number;
  scale?: 'linear' | 'logarithmic' | 'time';
  ticks?: number;
  gridLines?: boolean;
  rotation?: number;
}

export interface ChartFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: unknown;
}

export interface AggregationOptions {
  function: AggregationFunction;
  field?: string;
  groupBy?: GroupByFunction[];
  filters?: ChartFilter[];
}

export interface TimeRange {
  start: Date;
  end: Date;
  preset?: TimeRangePreset;
}

export interface RealTimeUpdate {
  updateId: string;
  chartId: string;
  seriesId: string;
  dataPoint: DataPoint;
  timestamp: Date;
}

export interface ChartViewport {
  startX: number;
  endX: number;
  startY: number;
  endY: number;
  scale: number;
}

export interface TooltipData {
  x: number;
  y: number;
  seriesId: string;
  dataPoint: DataPoint;
  formattedX: string;
  formattedY: string;
}

export interface LegendItem {
  seriesId: string;
  name: string;
  color: string;
  visible: boolean;
  value?: number;
}

export interface GaugeConfig {
  minValue: number;
  maxValue: number;
  startAngle: number;
  endAngle: number;
  thresholds: GaugeThreshold[];
  showValue: boolean;
  showPercentage: boolean;
}

export interface GaugeThreshold {
  value: number;
  color: string;
  label?: string;
}

export interface HeatmapConfig {
  xLabels: string[];
  yLabels: string[];
  colors: string[];
  cellSize?: number;
  showValues?: boolean;
  clustering?: boolean;
}

export interface ChartAnnotation {
  annotationId: string;
  chartId: string;
  type: 'line' | 'region' | 'point';
  x?: number | string | Date;
  y?: number;
  x2?: number | string | Date;
  y2?: number;
  label?: string;
  color?: string;
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface DataTransformation {
  transformationId: string;
  name: string;
  type: 'filter' | 'aggregate' | 'group' | 'sort' | 'pivot';
  options: Record<string, unknown>;
}

export interface ExportOptions {
  format: 'png' | 'svg' | 'csv' | 'json';
  width?: number;
  height?: number;
  quality?: number;
  backgroundColor?: string;
}

export interface ChartService {
  createChart(name: string, type: ChartType, series?: Omit<DataSeries, 'seriesId'>[]): Promise<ChartData>;
  getChart(chartId: string): Promise<ChartData | null>;
  updateChart(chartId: string, updates: Partial<ChartData>): Promise<ChartData>;
  deleteChart(chartId: string): Promise<void>;
  addSeries(chartId: string, series: Omit<DataSeries, 'seriesId'>): Promise<DataSeries>;
  removeSeries(chartId: string, seriesId: string): Promise<void>;
  updateSeries(chartId: string, seriesId: string, updates: Partial<DataSeries>): Promise<DataSeries>;
  getSeries(chartId: string, seriesId: string): Promise<DataSeries | null>;
  listCharts(): Promise<ChartData[]>;
  cloneChart(chartId: string, newName: string): Promise<ChartData>;
}

export interface ThemeService {
  createTheme(name: string, colors: string[], options?: Partial<ChartTheme>): Promise<ChartTheme>;
  getTheme(themeId: string): Promise<ChartTheme | null>;
  updateTheme(themeId: string, updates: Partial<ChartTheme>): Promise<ChartTheme>;
  deleteTheme(themeId: string): Promise<void>;
  listThemes(): Promise<ChartTheme[]>;
  getDefaultTheme(): ChartTheme;
}

export interface ConfigurationService {
  getConfiguration(chartId: string): Promise<ChartConfiguration>;
  updateConfiguration(chartId: string, config: Partial<ChartConfiguration>): Promise<ChartConfiguration>;
  resetConfiguration(chartId: string): Promise<ChartConfiguration>;
}

export interface RealTimeService {
  subscribe(chartId: string, callback: (update: RealTimeUpdate) => void): () => void;
  unsubscribe(chartId: string): void;
  publishUpdate(chartId: string, seriesId: string, dataPoint: DataPoint): void;
  getLastUpdate(chartId: string): Promise<RealTimeUpdate | null>;
}

export interface AggregationService {
  aggregate(data: DataPoint[], options: AggregationOptions): Promise<DataPoint[]>;
  groupBy(data: DataPoint[], field: string, groupFn: GroupByFunction): Promise<Map<string, DataPoint[]>>;
  rollup(data: DataPoint[], groupBy: string[], aggFn: AggregationFunction): Promise<DataPoint[]>;
  timeSeriesAggregate(data: DataPoint[], interval: GroupByFunction): Promise<DataPoint[]>;
}

export interface TransformService {
  applyTransform(data: DataPoint[], transformation: DataTransformation): DataPoint[];
  filter(data: DataPoint[], filters: ChartFilter[]): DataPoint[];
  sort(data: DataPoint[], field: 'x' | 'y', direction: 'asc' | 'desc'): DataPoint[];
  pivot(data: DataPoint[], rowField: string, colField: string, valueField: string): Record<string, Record<string, number>>;
}

export interface ViewportService {
  getViewport(chartId: string): Promise<ChartViewport>;
  setViewport(chartId: string, viewport: Partial<ChartViewport>): Promise<ChartViewport>;
  zoomTo(chartId: string, startX: number, endX: number, startY: number, endY: number): Promise<ChartViewport>;
  pan(chartId: string, deltaX: number, deltaY: number): Promise<ChartViewport>;
  resetViewport(chartId: string): Promise<ChartViewport>;
}

export interface ExportService {
  exportChart(chartId: string, options: ExportOptions): Promise<string>;
  exportData(chartId: string, format: 'csv' | 'json'): Promise<string>;
  exportSeries(chartId: string, seriesId: string, format: 'csv' | 'json'): Promise<string>;
}

export interface DataVisualizationManager {
  get chartService(): ChartService;
  get themeService(): ThemeService;
  get configurationService(): ConfigurationService;
  get realTimeService(): RealTimeService;
  get aggregationService(): AggregationService;
  get transformService(): TransformService;
  get viewportService(): ViewportService;
  get exportService(): ExportService;
}

/**
 * Reporting & Business Intelligence Types
 * Comprehensive reporting system for Manus AI Platform
 */

export type ReportType = 'tabular' | 'chart' | 'metric_card' | 'pivot_table';
export type ChartType = 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'donut' | 'gauge';
export type DataSourceType = 'database' | 'api' | 'file' | 'custom';
export type FilterType = 'date_range' | 'select' | 'multi_select' | 'text' | 'number';
export type ExportFormat = 'pdf' | 'excel' | 'csv' | 'json';
export type ScheduleType = 'once' | 'daily' | 'weekly' | 'monthly';
export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'between';

export interface ReportFilter {
  filterId: string;
  field: string;
  label: string;
  type: FilterType;
  operator: FilterOperator;
  value: unknown;
  options?: FilterOption[];
  required: boolean;
}

export interface FilterOption {
  label: string;
  value: string | number;
}

export interface DataSourceConfig {
  type: DataSourceType;
  connectionId?: string;
  query?: string;
  endpoint?: string;
  filePath?: string;
  customHandler?: string;
}

export interface ChartConfiguration {
  type: ChartType;
  title?: string;
  xAxis?: string;
  yAxis?: string;
  groupBy?: string;
  colors?: string[];
  showLegend: boolean;
  showGrid: boolean;
  animationEnabled: boolean;
  dataLabelsEnabled: boolean;
}

export interface PivotTableConfiguration {
  rows: string[];
  columns: string[];
  values: string[];
  aggregation: 'sum' | 'count' | 'average' | 'min' | 'max';
  showTotals: boolean;
  showSubtotals: boolean;
}

export interface ReportLayout {
  columns: number;
  showTitle: boolean;
  showDescription: boolean;
  showFilters: boolean;
  showExport: boolean;
}

export interface DragDropItem {
  itemId: string;
  type: 'field' | 'chart' | 'filter' | 'metric' | 'group';
  label: string;
  dataField?: string;
  aggregation?: 'sum' | 'count' | 'average' | 'min' | 'max';
  configuration?: Record<string, unknown>;
}

export interface ReportSection {
  sectionId: string;
  title: string;
  type: ReportType;
  position: number;
  dataSource?: DataSourceConfig;
  fields?: string[];
  metrics?: ReportMetric[];
  chartConfig?: ChartConfiguration;
  pivotConfig?: PivotTableConfiguration;
  layout?: ReportLayout;
}

export interface ReportMetric {
  metricId: string;
  label: string;
  field: string;
  aggregation: 'sum' | 'count' | 'average' | 'min' | 'max';
  format?: 'number' | 'currency' | 'percentage' | 'decimal';
  displayAs?: 'value' | 'trend' | 'comparison';
}

export interface ReportBuilderState {
  reportId: string;
  name: string;
  description?: string;
  type: ReportType;
  dataSource: DataSourceConfig;
  sections: ReportSection[];
  filters: ReportFilter[];
  layout: ReportLayout;
  items: DragDropItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledReport {
  scheduleId: string;
  reportId: string;
  name: string;
  schedule: ScheduleType;
  nextRunAt: Date;
  lastRunAt?: Date;
  enabled: boolean;
  recipients: string[];
  format: ExportFormat;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportCache {
  cacheId: string;
  reportId: string;
  parameters: Record<string, unknown>;
  data: unknown;
  generatedAt: Date;
  expiresAt: Date;
  sizeBytes: number;
}

export interface DrillDownConfig {
  enabled: boolean;
  levels: DrillDownLevel[];
  defaultExpandLevel: number;
}

export interface DrillDownLevel {
  level: number;
  label: string;
  groupByField: string;
  aggregation?: 'sum' | 'count' | 'average' | 'min' | 'max';
  chartType?: ChartType;
}

export interface ReportExport {
  exportId: string;
  reportId: string;
  format: ExportFormat;
  data: string | Buffer;
  generatedAt: Date;
  fileName: string;
  sizeBytes: number;
}

export interface ReportFilterValue {
  filterId: string;
  value: unknown;
}

export interface ReportDataRequest {
  reportId: string;
  parameters?: Record<string, unknown>;
  filters?: ReportFilterValue[];
  drillDownFilters?: Record<string, unknown>;
  page?: number;
  pageSize?: number;
}

export interface ReportDataResponse {
  reportId: string;
  data: unknown;
  metadata: ReportMetadata;
  filters: ReportFilter[];
  cached: boolean;
}

export interface ReportMetadata {
  totalRows?: number;
  totalPages?: number;
  currentPage?: number;
  executionTimeMs?: number;
  generatedAt: Date;
}

export interface ReportBuilder {
  createReport(name: string, type: ReportType, dataSource: DataSourceConfig): Promise<ReportBuilderState>;
  getReport(reportId: string): Promise<ReportBuilderState | null>;
  updateReport(reportId: string, updates: Partial<ReportBuilderState>): Promise<ReportBuilderState>;
  deleteReport(reportId: string): Promise<void>;
  addSection(reportId: string, section: Omit<ReportSection, 'sectionId'>): Promise<ReportSection>;
  removeSection(reportId: string, sectionId: string): Promise<void>;
  addFilter(reportId: string, filter: Omit<ReportFilter, 'filterId'>): Promise<ReportFilter>;
  removeFilter(reportId: string, filterId: string): Promise<void>;
  addDragDropItem(reportId: string, item: Omit<DragDropItem, 'itemId'>): Promise<DragDropItem>;
  removeDragDropItem(reportId: string, itemId: string): Promise<void>;
  reorderSections(reportId: string, sectionIds: string[]): Promise<void>;
  executeReport(request: ReportDataRequest): Promise<ReportDataResponse>;
  listReports(): Promise<ReportBuilderState[]>;
}

export interface ChartRenderer {
  render(type: ChartType, data: unknown, config: ChartConfiguration): Promise<unknown>;
  renderGauge(value: number, min: number, max: number, config: ChartConfiguration): unknown;
  renderPie(data: Record<string, number>, config: ChartConfiguration): unknown;
  renderDonut(data: Record<string, number>, config: ChartConfiguration): unknown;
}

export interface ScheduledReportService {
  createSchedule(schedule: Omit<ScheduledReport, 'scheduleId' | 'createdAt' | 'updatedAt' | 'nextRunAt'>): Promise<ScheduledReport>;
  getSchedule(scheduleId: string): Promise<ScheduledReport | null>;
  updateSchedule(scheduleId: string, updates: Partial<ScheduledReport>): Promise<ScheduledReport>;
  deleteSchedule(scheduleId: string): Promise<void>;
  enableSchedule(scheduleId: string): Promise<ScheduledReport>;
  disableSchedule(scheduleId: string): Promise<ScheduledReport>;
  listSchedules(reportId?: string): Promise<ScheduledReport[]>;
  getNextScheduledRun(scheduleId: string): Promise<Date | null>;
}

export interface ReportCacheService {
  get(reportId: string, parameters: Record<string, unknown>): Promise<ReportCache | null>;
  set(cache: Omit<ReportCache, 'cacheId' | 'generatedAt'>): Promise<ReportCache>;
  invalidate(reportId: string): Promise<void>;
  invalidateByPattern(reportId: string, parameterPattern: Record<string, unknown>): Promise<void>;
  clearExpired(): Promise<number>;
  getStats(): Promise<{ totalEntries: number; totalSizeBytes: number; hitRate: number }>;
}

export interface ExportService {
  exportToPdf(data: unknown, options?: Record<string, unknown>): Promise<Buffer>;
  exportToExcel(data: unknown, options?: Record<string, unknown>): Promise<Buffer>;
  exportToCsv(data: unknown, options?: Record<string, unknown>): Promise<string>;
  exportToJson(data: unknown, options?: Record<string, unknown>): Promise<string>;
  generateExportId(): string;
}

export interface DrillDownService {
  getDrillDownData(reportId: string, level: number, filters: Record<string, unknown>): Promise<unknown>;
  getAvailableDrillDownLevels(reportId: string): Promise<DrillDownLevel[]>;
  setDrillDownConfig(reportId: string, config: DrillDownConfig): Promise<void>;
  getDrillDownConfig(reportId: string): Promise<DrillDownConfig | null>;
}

export interface FilterService {
  applyFilters(data: unknown[], filters: ReportFilter[]): unknown[];
  validateFilter(filter: ReportFilter, value: unknown): boolean;
  getFilterOptions(filter: ReportFilter): FilterOption[];
  buildFilterQuery(filters: ReportFilter[]): string;
}

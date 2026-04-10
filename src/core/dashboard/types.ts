/**
 * Dashboard & Analytics Widgets Types
 * Comprehensive dashboard system for Manus AI Platform
 */

export type WidgetType = 'chart' | 'table' | 'metric' | 'counter' | 'progress' | 'funnel' | 'heatmap';
export type ChartType = 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'donut';
export type DataSourceType = 'events' | 'funnels' | 'abtests' | 'metrics' | 'custom';
export type AggregationType = 'count' | 'sum' | 'average' | 'min' | 'max' | 'unique';
export type TimeGranularity = 'minute' | 'hourly' | 'daily' | 'weekly' | 'monthly';
export type PermissionLevel = 'view' | 'edit' | 'admin';
export type RefreshInterval = 5000 | 10000 | 30000 | 60000 | 300000 | 600000;

export interface Position {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TimeRange {
  start: Date;
  end: Date;
  preset?: TimePreset;
}

export type TimePreset = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'last90days' | 'thisMonth' | 'lastMonth' | 'custom';

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  metadata?: Record<string, unknown>;
}

export interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, unknown>;
}

export interface TableColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'currency';
  width?: number;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

export interface TableRow {
  id: string;
  cells: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface MetricValue {
  current: number;
  previous?: number;
  change?: number;
  changePercent?: number;
  trend?: 'up' | 'down' | 'neutral';
}

export interface ProgressData {
  value: number;
  max: number;
  label?: string;
  showPercentage?: boolean;
}

export interface FunnelData {
  steps: Array<{
    name: string;
    value: number;
    conversionRate?: number;
  }>;
}

export interface HeatmapCell {
  x: number;
  y: number;
  value: number;
  label?: string;
}

export interface WidgetDataSource {
  type: DataSourceType;
  query: WidgetQuery;
  connectionId?: string;
}

export interface WidgetQuery {
  eventName?: string;
  aggregation?: AggregationType;
  property?: string;
  groupBy?: string[];
  filters?: Record<string, unknown>;
  timeRange?: TimeRange;
  granularity?: TimeGranularity;
  customData?: unknown;
}

export interface ChartConfiguration {
  chartType: ChartType;
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  colors?: string[];
  dataLabels?: boolean;
  stacked?: boolean;
}

export interface TableConfiguration {
  columns: TableColumn[];
  pageSize?: number;
  sortable?: boolean;
  filterable?: boolean;
  selectable?: boolean;
  striped?: boolean;
  bordered?: boolean;
}

export interface MetricConfiguration {
  prefix?: string;
  suffix?: string;
  decimals?: number;
  showTrend?: boolean;
  showComparison?: boolean;
}

export interface ProgressConfiguration {
  showLabel?: boolean;
  labelPosition?: 'inside' | 'outside' | 'top';
  animation?: boolean;
}

export interface FunnelConfiguration {
  showConversionRates?: boolean;
  showDropOff?: boolean;
  horizontal?: boolean;
  colors?: string[];
}

export interface HeatmapConfiguration {
  xLabels?: string[];
  yLabels?: string[];
  colorScale?: string[];
  cellSize?: number;
}

export interface WidgetConfiguration {
  chart?: ChartConfiguration;
  table?: TableConfiguration;
  metric?: MetricConfiguration;
  progress?: ProgressConfiguration;
  funnel?: FunnelConfiguration;
  heatmap?: HeatmapConfiguration;
  thresholds?: Threshold[];
}

export interface Threshold {
  value: number;
  color: string;
  label?: string;
}

export interface Widget {
  widgetId: string;
  dashboardId: string;
  name: string;
  description?: string;
  type: WidgetType;
  position: Position;
  dataSource: WidgetDataSource;
  configuration?: WidgetConfiguration;
  refreshInterval?: RefreshInterval;
  isVisible?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WidgetData {
  widgetId: string;
  data: unknown;
  timestamp: Date;
  isStale?: boolean;
  error?: string;
}

export interface DashboardLayout {
  columns: number;
  rows: number;
  gap: number;
  rowHeight?: number;
}

export interface DashboardPermissions {
  userId: string;
  dashboardId: string;
  permission: PermissionLevel;
  grantedAt: Date;
  grantedBy?: string;
}

export interface DashboardShare {
  shareId: string;
  dashboardId: string;
  shareType: 'public' | 'private' | 'link';
  linkToken?: string;
  expiresAt?: Date;
  permissions: DashboardPermissions[];
  createdAt: Date;
  createdBy: string;
}

export interface DashboardTemplate {
  templateId: string;
  name: string;
  description?: string;
  category: string;
  widgets: Omit<Widget, 'widgetId' | 'dashboardId' | 'createdAt' | 'updatedAt'>[];
  layout: DashboardLayout;
  isPublic?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Dashboard {
  dashboardId: string;
  name: string;
  description?: string;
  widgets: Widget[];
  layout: DashboardLayout;
  permissions: DashboardPermissions[];
  shareSettings?: DashboardShare;
  isTemplate?: boolean;
  templateId?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface WidgetUpdate {
  position?: Position;
  configuration?: WidgetConfiguration;
  refreshInterval?: RefreshInterval;
  isVisible?: boolean;
}

export interface DashboardUpdate {
  name?: string;
  description?: string;
  layout?: Partial<DashboardLayout>;
  widgets?: Widget[];
}

export interface DashboardPreferences {
  userId: string;
  defaultDashboardId?: string;
  widgetDefaults: Partial<WidgetConfiguration>;
  theme?: 'light' | 'dark' | 'auto';
  refreshRate?: RefreshInterval;
}

export interface DashboardEvent {
  eventId: string;
  dashboardId: string;
  widgetId?: string;
  eventType: 'view' | 'edit' | 'share' | 'widget_add' | 'widget_remove' | 'widget_update';
  userId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface RealtimeUpdate {
  widgetId: string;
  data: unknown;
  timestamp: Date;
}

export interface DashboardService {
  createDashboard(name: string, description: string, createdBy: string, layout?: Partial<DashboardLayout>): Promise<Dashboard>;
  getDashboard(dashboardId: string): Promise<Dashboard | null>;
  updateDashboard(dashboardId: string, updates: DashboardUpdate): Promise<Dashboard>;
  deleteDashboard(dashboardId: string): Promise<void>;
  duplicateDashboard(dashboardId: string, newName: string, createdBy: string): Promise<Dashboard>;
  listDashboards(userId?: string): Promise<Dashboard[]>;
  getDashboardsByUser(userId: string): Promise<Dashboard[]>;
}

export interface WidgetService {
  addWidget(dashboardId: string, widget: Omit<Widget, 'widgetId' | 'dashboardId' | 'createdAt' | 'updatedAt'>): Promise<Widget>;
  getWidget(widgetId: string): Promise<Widget | null>;
  updateWidget(widgetId: string, updates: WidgetUpdate): Promise<Widget>;
  removeWidget(dashboardId: string, widgetId: string): Promise<void>;
  moveWidget(widgetId: string, position: Position): Promise<Widget>;
  resizeWidget(widgetId: string, position: Position): Promise<Widget>;
  refreshWidget(widgetId: string): Promise<WidgetData>;
  getWidgetData(widgetId: string): Promise<WidgetData>;
  setWidgetRefreshInterval(widgetId: string, interval: RefreshInterval): Promise<void>;
}

export interface ShareService {
  shareDashboard(dashboardId: string, shareType: 'public' | 'private' | 'link', createdBy: string): Promise<DashboardShare>;
  revokeShare(shareId: string): Promise<void>;
  getShareByToken(token: string): Promise<DashboardShare | null>;
  getDashboardShares(dashboardId: string): Promise<DashboardShare[]>;
  updateSharePermissions(shareId: string, permissions: DashboardPermissions[]): Promise<DashboardShare>;
}

export interface PermissionService {
  grantPermission(dashboardId: string, userId: string, permission: PermissionLevel, grantedBy: string): Promise<DashboardPermissions>;
  revokePermission(dashboardId: string, userId: string): Promise<void>;
  getPermissions(dashboardId: string): Promise<DashboardPermissions[]>;
  hasPermission(dashboardId: string, userId: string, required: PermissionLevel): Promise<boolean>;
  updatePermission(dashboardId: string, userId: string, permission: PermissionLevel): Promise<DashboardPermissions>;
}

export interface TemplateService {
  createTemplate(name: string, description: string, category: string, dashboardId: string): Promise<DashboardTemplate>;
  getTemplate(templateId: string): Promise<DashboardTemplate | null>;
  listTemplates(category?: string): Promise<DashboardTemplate[]>;
  deleteTemplate(templateId: string): Promise<void>;
  createDashboardFromTemplate(templateId: string, name: string, createdBy: string): Promise<Dashboard>;
  updateTemplate(templateId: string, updates: Partial<DashboardTemplate>): Promise<DashboardTemplate>;
}

export interface PreferencesService {
  getPreferences(userId: string): Promise<DashboardPreferences>;
  updatePreferences(userId: string, preferences: Partial<DashboardPreferences>): Promise<DashboardPreferences>;
  setDefaultDashboard(userId: string, dashboardId: string): Promise<void>;
}

export interface RealtimeService {
  subscribeToWidget(widgetId: string, callback: (data: WidgetData) => void): () => void;
  subscribeToDashboard(dashboardId: string, callback: (data: RealtimeUpdate) => void): () => void;
  unsubscribeFromWidget(widgetId: string): void;
  unsubscribeFromDashboard(dashboardId: string): void;
}

export interface DataService {
  queryData(source: WidgetDataSource, timeRange: TimeRange): Promise<unknown>;
  aggregateData(data: unknown[], aggregation: AggregationType, property?: string): Promise<number>;
  groupData(data: unknown[], groupBy: string[]): Promise<Record<string, unknown[]>>;
  filterData(data: unknown[], filters: Record<string, unknown>): Promise<unknown[]>;
}

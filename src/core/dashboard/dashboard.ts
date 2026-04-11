/**
 * Dashboard & Analytics Widgets Implementation
 * Comprehensive dashboard system for Manus AI Platform
 */

import crypto from 'crypto';
import {
  Dashboard,
  DashboardUpdate,
  DashboardLayout,
  DashboardPermissions,
  DashboardShare,
  DashboardTemplate,
  DashboardPreferences,
  DashboardEvent,
  Widget,
  WidgetUpdate,
  WidgetData,
  WidgetDataSource,
  WidgetQuery,
  TimeRange,
  RefreshInterval,
  PermissionLevel,
  RealtimeUpdate,
  AggregationType,
  Position,
  TableColumn,
  ChartDataPoint,
  TimeSeriesDataPoint,
  MetricValue,
  ProgressData,
  FunnelData,
  HeatmapCell,
  DashboardService,
  WidgetService,
  ShareService,
  PermissionService,
  TemplateService,
  PreferencesService,
  RealtimeService,
  DataService,
} from './types';

export class DashboardServiceImpl implements DashboardService, WidgetService, ShareService, PermissionService, TemplateService, PreferencesService, RealtimeService, DataService {
  private dashboards: Map<string, Dashboard> = new Map();
  private widgets: Map<string, Widget> = new Map();
  private shares: Map<string, DashboardShare> = new Map();
  private templates: Map<string, DashboardTemplate> = new Map();
  private preferences: Map<string, DashboardPreferences> = new Map();
  private dashboardEvents: Map<string, DashboardEvent[]> = new Map();
  private widgetSubscribers: Map<string, Set<(data: WidgetData) => void>> = new Map();
  private dashboardSubscribers: Map<string, Set<(data: RealtimeUpdate) => void>> = new Map();
  private refreshIntervals: Map<string, NodeJS.Timeout> = new Map();

  async createDashboard(
    name: string,
    description: string,
    createdBy: string,
    layout?: Partial<DashboardLayout>
  ): Promise<Dashboard> {
    const dashboardId = this.generateId('dash');
    const now = new Date();

    const dashboard: Dashboard = {
      dashboardId,
      name,
      description,
      widgets: [],
      layout: {
        columns: layout?.columns || 12,
        rows: layout?.rows || 8,
        gap: layout?.gap || 16,
        rowHeight: layout?.rowHeight || 80,
      },
      permissions: [{
        userId: createdBy,
        dashboardId,
        permission: 'admin',
        grantedAt: now,
        grantedBy: createdBy,
      }],
      isTemplate: false,
      createdAt: now,
      updatedAt: now,
      createdBy,
    };

    this.dashboards.set(dashboardId, dashboard);
    await this.logEvent(dashboardId, undefined, 'view', createdBy);
    return dashboard;
  }

  async getDashboard(dashboardId: string): Promise<Dashboard | null> {
    return this.dashboards.get(dashboardId) || null;
  }

  async updateDashboard(dashboardId: string, updates: DashboardUpdate): Promise<Dashboard> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    const updated: Dashboard = {
      ...dashboard,
      ...updates,
      dashboardId,
      updatedAt: new Date(),
      layout: {
        columns: updates.layout?.columns ?? dashboard.layout.columns,
        rows: updates.layout?.rows ?? dashboard.layout.rows,
        gap: updates.layout?.gap ?? dashboard.layout.gap,
        rowHeight: updates.layout?.rowHeight ?? dashboard.layout.rowHeight,
      },
    };

    this.dashboards.set(dashboardId, updated);
    return updated;
  }

  async deleteDashboard(dashboardId: string): Promise<void> {
    const dashboard = this.dashboards.get(dashboardId);
    if (dashboard) {
      for (const widget of dashboard.widgets) {
        this.widgets.delete(widget.widgetId);
        this.stopWidgetRefresh(widget.widgetId);
      }
    }
    this.dashboards.delete(dashboardId);
    this.cleanupDashboardSubscribers(dashboardId);
  }

  async duplicateDashboard(dashboardId: string, newName: string, createdBy: string): Promise<Dashboard> {
    const original = await this.getDashboard(dashboardId);
    if (!original) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    const newDashboard = await this.createDashboard(newName, original.description || '', createdBy, original.layout);

    for (const widget of original.widgets) {
      await this.addWidget(newDashboard.dashboardId, {
        name: widget.name,
        description: widget.description,
        type: widget.type,
        position: { ...widget.position },
        dataSource: { ...widget.dataSource, query: { ...widget.dataSource.query } },
        configuration: widget.configuration ? this.deepClone(widget.configuration) : undefined,
        refreshInterval: widget.refreshInterval,
        isVisible: widget.isVisible,
      });
    }

    return this.getDashboard(newDashboard.dashboardId) as Promise<Dashboard>;
  }

  async listDashboards(_userId?: string): Promise<Dashboard[]> {
    return Array.from(this.dashboards.values()).filter(d => !d.isTemplate);
  }

  async getDashboardsByUser(userId: string): Promise<Dashboard[]> {
    return Array.from(this.dashboards.values()).filter(
      d => d.permissions.some(p => p.userId === userId) && !d.isTemplate
    );
  }

  async addWidget(
    dashboardId: string,
    widget: Omit<Widget, 'widgetId' | 'dashboardId' | 'createdAt' | 'updatedAt'>
  ): Promise<Widget> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    const widgetId = this.generateId('widget');
    const now = new Date();

    const fullWidget: Widget = {
      ...widget,
      widgetId,
      dashboardId,
      createdAt: now,
      updatedAt: now,
    };

    this.widgets.set(widgetId, fullWidget);
    dashboard.widgets.push(fullWidget);
    dashboard.updatedAt = now;

    if (fullWidget.refreshInterval) {
      this.startWidgetRefresh(fullWidget);
    }

    await this.logEvent(dashboardId, widgetId, 'widget_add', dashboard.createdBy);
    return fullWidget;
  }

  async getWidget(widgetId: string): Promise<Widget | null> {
    return this.widgets.get(widgetId) || null;
  }

  async updateWidget(widgetId: string, updates: WidgetUpdate): Promise<Widget> {
    const widget = this.widgets.get(widgetId);
    if (!widget) {
      throw new Error(`Widget ${widgetId} not found`);
    }

    const updated: Widget = {
      ...widget,
      ...updates,
      widgetId,
      updatedAt: new Date(),
    };

    if (updates.position) {
      updated.position = { ...widget.position, ...updates.position };
    }

    if (updates.configuration) {
      updated.configuration = { ...widget.configuration, ...updates.configuration };
    }

    this.widgets.set(widgetId, updated);

    if (updates.refreshInterval !== undefined) {
      this.stopWidgetRefresh(widgetId);
      if (updates.refreshInterval) {
        this.startWidgetRefresh(updated);
      }
    }

    await this.logEvent(widget.dashboardId, widgetId, 'widget_update', updated.dashboardId);
    return updated;
  }

  async removeWidget(dashboardId: string, widgetId: string): Promise<void> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    this.widgets.delete(widgetId);
    dashboard.widgets = dashboard.widgets.filter(w => w.widgetId !== widgetId);
    dashboard.updatedAt = new Date();
    this.stopWidgetRefresh(widgetId);
    this.cleanupWidgetSubscribers(widgetId);
  }

  async moveWidget(widgetId: string, position: Position): Promise<Widget> {
    return this.updateWidget(widgetId, { position });
  }

  async resizeWidget(widgetId: string, position: Position): Promise<Widget> {
    return this.updateWidget(widgetId, { position });
  }

  async refreshWidget(widgetId: string): Promise<WidgetData> {
    const widget = this.widgets.get(widgetId);
    if (!widget) {
      throw new Error(`Widget ${widgetId} not found`);
    }

    const data = await this.queryData(widget.dataSource, { start: new Date(Date.now() - 86400000), end: new Date() });

    return {
      widgetId,
      data,
      timestamp: new Date(),
    };
  }

  async getWidgetData(widgetId: string): Promise<WidgetData> {
    return this.refreshWidget(widgetId);
  }

  async setWidgetRefreshInterval(widgetId: string, interval: RefreshInterval): Promise<void> {
    const widget = this.widgets.get(widgetId);
    if (!widget) {
      throw new Error(`Widget ${widgetId} not found`);
    }

    await this.updateWidget(widgetId, { refreshInterval: interval });
  }

  async shareDashboard(
    dashboardId: string,
    shareType: 'public' | 'private' | 'link',
    createdBy: string
  ): Promise<DashboardShare> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    const shareId = this.generateId('share');
    const now = new Date();

    const share: DashboardShare = {
      shareId,
      dashboardId,
      shareType,
      linkToken: shareType === 'link' ? this.generateToken() : undefined,
      expiresAt: shareType === 'link' ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : undefined,
      permissions: [],
      createdAt: now,
      createdBy,
    };

    this.shares.set(shareId, share);
    dashboard.shareSettings = share;
    dashboard.updatedAt = now;

    await this.logEvent(dashboardId, undefined, 'share', createdBy, { shareType });
    return share;
  }

  async revokeShare(shareId: string): Promise<void> {
    const share = this.shares.get(shareId);
    if (share) {
      const dashboard = this.dashboards.get(share.dashboardId);
      if (dashboard) {
        dashboard.shareSettings = undefined;
        dashboard.updatedAt = new Date();
      }
    }
    this.shares.delete(shareId);
  }

  async getShareByToken(token: string): Promise<DashboardShare | null> {
    for (const share of this.shares.values()) {
      if (share.linkToken === token) {
        if (share.expiresAt && share.expiresAt < new Date()) {
          return null;
        }
        return share;
      }
    }
    return null;
  }

  async getDashboardShares(dashboardId: string): Promise<DashboardShare[]> {
    return Array.from(this.shares.values()).filter(s => s.dashboardId === dashboardId);
  }

  async updateSharePermissions(shareId: string, permissions: DashboardPermissions[]): Promise<DashboardShare> {
    const share = this.shares.get(shareId);
    if (!share) {
      throw new Error(`Share ${shareId} not found`);
    }

    share.permissions = permissions;
    return share;
  }

  async grantPermission(
    dashboardId: string,
    userId: string,
    permission: PermissionLevel,
    grantedBy: string
  ): Promise<DashboardPermissions> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    const existing = dashboard.permissions.find(p => p.userId === userId);
    if (existing) {
      existing.permission = permission;
      existing.grantedAt = new Date();
      existing.grantedBy = grantedBy;
      return existing;
    }

    const newPermission: DashboardPermissions = {
      userId,
      dashboardId,
      permission,
      grantedAt: new Date(),
      grantedBy,
    };

    dashboard.permissions.push(newPermission);
    dashboard.updatedAt = new Date();
    return newPermission;
  }

  async revokePermission(dashboardId: string, userId: string): Promise<void> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    dashboard.permissions = dashboard.permissions.filter(p => p.userId !== userId);
    dashboard.updatedAt = new Date();
  }

  async getPermissions(dashboardId: string): Promise<DashboardPermissions[]> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }
    return dashboard.permissions;
  }

  async hasPermission(dashboardId: string, userId: string, required: PermissionLevel): Promise<boolean> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      return false;
    }

    const permission = dashboard.permissions.find(p => p.userId === userId);
    if (!permission) {
      return false;
    }

    const levels: PermissionLevel[] = ['view', 'edit', 'admin'];
    return levels.indexOf(permission.permission) >= levels.indexOf(required);
  }

  async updatePermission(
    dashboardId: string,
    userId: string,
    permission: PermissionLevel
  ): Promise<DashboardPermissions> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    const existing = dashboard.permissions.find(p => p.userId === userId);
    if (!existing) {
      throw new Error(`Permission for user ${userId} not found`);
    }

    existing.permission = permission;
    dashboard.updatedAt = new Date();
    return existing;
  }

  async createTemplate(
    name: string,
    description: string,
    category: string,
    dashboardId: string
  ): Promise<DashboardTemplate> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    const templateId = this.generateId('tmpl');
    const now = new Date();

    const template: DashboardTemplate = {
      templateId,
      name,
      description,
      category,
      widgets: dashboard.widgets.map(w => ({
        name: w.name,
        description: w.description,
        type: w.type,
        position: { ...w.position },
        dataSource: { ...w.dataSource, query: { ...w.dataSource.query } },
        configuration: w.configuration ? this.deepClone(w.configuration) : undefined,
        refreshInterval: w.refreshInterval,
        isVisible: w.isVisible,
      })),
      layout: { ...dashboard.layout },
      createdAt: now,
      updatedAt: now,
    };

    this.templates.set(templateId, template);
    return template;
  }

  async getTemplate(templateId: string): Promise<DashboardTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  async listTemplates(category?: string): Promise<DashboardTemplate[]> {
    let templates = Array.from(this.templates.values());
    if (category) {
      templates = templates.filter(t => t.category === category);
    }
    return templates;
  }

  async deleteTemplate(templateId: string): Promise<void> {
    this.templates.delete(templateId);
  }

  async createDashboardFromTemplate(templateId: string, name: string, createdBy: string): Promise<Dashboard> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const dashboard = await this.createDashboard(name, template.description || '', createdBy, template.layout);

    for (const widgetTemplate of template.widgets) {
      await this.addWidget(dashboard.dashboardId, {
        name: widgetTemplate.name,
        description: widgetTemplate.description,
        type: widgetTemplate.type,
        position: { ...widgetTemplate.position },
        dataSource: { ...widgetTemplate.dataSource, query: { ...widgetTemplate.dataSource.query } },
        configuration: widgetTemplate.configuration ? this.deepClone(widgetTemplate.configuration) : undefined,
        refreshInterval: widgetTemplate.refreshInterval,
        isVisible: widgetTemplate.isVisible,
      });
    }

    return this.getDashboard(dashboard.dashboardId) as Promise<Dashboard>;
  }

  async updateTemplate(templateId: string, updates: Partial<DashboardTemplate>): Promise<DashboardTemplate> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const updated: DashboardTemplate = {
      ...template,
      ...updates,
      templateId,
      updatedAt: new Date(),
    };

    this.templates.set(templateId, updated);
    return updated;
  }

  async getPreferences(userId: string): Promise<DashboardPreferences> {
    return this.preferences.get(userId) || {
      userId,
      widgetDefaults: {},
      theme: 'auto',
      refreshRate: 30000,
    };
  }

  async updatePreferences(userId: string, prefs: Partial<DashboardPreferences>): Promise<DashboardPreferences> {
    const current = await this.getPreferences(userId);
    const updated: DashboardPreferences = {
      ...current,
      ...prefs,
      userId,
    };

    this.preferences.set(userId, updated);
    return updated;
  }

  async setDefaultDashboard(userId: string, dashboardId: string): Promise<void> {
    await this.updatePreferences(userId, { defaultDashboardId: dashboardId });
  }

  subscribeToWidget(widgetId: string, callback: (data: WidgetData) => void): () => void {
    if (!this.widgetSubscribers.has(widgetId)) {
      this.widgetSubscribers.set(widgetId, new Set());
    }
    this.widgetSubscribers.get(widgetId)!.add(callback);

    return () => {
      const subscribers = this.widgetSubscribers.get(widgetId);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.widgetSubscribers.delete(widgetId);
        }
      }
    };
  }

  subscribeToDashboard(dashboardId: string, callback: (data: RealtimeUpdate) => void): () => void {
    if (!this.dashboardSubscribers.has(dashboardId)) {
      this.dashboardSubscribers.set(dashboardId, new Set());
    }
    this.dashboardSubscribers.get(dashboardId)!.add(callback);

    return () => {
      const subscribers = this.dashboardSubscribers.get(dashboardId);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.dashboardSubscribers.delete(dashboardId);
        }
      }
    };
  }

  unsubscribeFromWidget(widgetId: string): void {
    this.widgetSubscribers.delete(widgetId);
    this.stopWidgetRefresh(widgetId);
  }

  unsubscribeFromDashboard(dashboardId: string): void {
    this.dashboardSubscribers.delete(dashboardId);
  }

  async queryData(source: WidgetDataSource, timeRange: TimeRange): Promise<unknown> {
    const { type, query } = source;

    switch (type) {
      case 'events':
        return this.generateEventData(query, timeRange);
      case 'metrics':
        return this.generateMetricData(query);
      case 'custom':
        return query.customData || [];
      default:
        return this.generateGenericData(query);
    }
  }

  async aggregateData(data: unknown[], aggregation: AggregationType, property?: string): Promise<number> {
    if (!Array.isArray(data)) {
      return 0;
    }

    let values: number[];
    if (property) {
      values = data.map((item: unknown) => {
        if (typeof item === 'object' && item !== null) {
          return (item as Record<string, unknown>)[property];
        }
        return undefined;
      }).filter((v): v is number => typeof v === 'number');
    } else {
      values = data.filter((v): v is number => typeof v === 'number');
    }

    switch (aggregation) {
      case 'count':
        return values.length;
      case 'sum':
        return values.reduce((a: number, b: number) => a + b, 0);
      case 'average':
        return values.length > 0 ? values.reduce((a: number, b: number) => a + b, 0) / values.length : 0;
      case 'min':
        return values.length > 0 ? Math.min(...values) : 0;
      case 'max':
        return values.length > 0 ? Math.max(...values) : 0;
      case 'unique':
        return new Set(values).size;
      default:
        return values.length;
    }
  }

  async groupData(data: unknown[], groupBy: string[]): Promise<Record<string, unknown[]>> {
    const result: Record<string, unknown[]> = {};

    for (const item of data as Record<string, unknown>[]) {
      const key = groupBy.map(field => String(item[field] || 'undefined')).join('_');
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(item);
    }

    return result;
  }

  async filterData(data: unknown[], filters: Record<string, unknown>): Promise<unknown[]> {
    return (data as Record<string, unknown>[]).filter(item => {
      for (const [key, value] of Object.entries(filters)) {
        if (item[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  private async logEvent(
    dashboardId: string,
    widgetId: string | undefined,
    eventType: DashboardEvent['eventType'],
    userId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const event: DashboardEvent = {
      eventId: this.generateId('evt'),
      dashboardId,
      widgetId,
      eventType,
      userId,
      timestamp: new Date(),
      metadata,
    };

    if (!this.dashboardEvents.has(dashboardId)) {
      this.dashboardEvents.set(dashboardId, []);
    }
    this.dashboardEvents.get(dashboardId)!.push(event);
  }

  private startWidgetRefresh(widget: Widget): void {
    if (!widget.refreshInterval) return;

    const intervalId = setInterval(async () => {
      try {
        const data = await this.refreshWidget(widget.widgetId);
        const subscribers = this.widgetSubscribers.get(widget.widgetId);
        if (subscribers) {
          for (const callback of subscribers) {
            callback(data);
          }
        }
      } catch {
        // Silently handle refresh errors
      }
    }, widget.refreshInterval);

    this.refreshIntervals.set(widget.widgetId, intervalId);
  }

  private stopWidgetRefresh(widgetId: string): void {
    const intervalId = this.refreshIntervals.get(widgetId);
    if (intervalId) {
      clearInterval(intervalId);
      this.refreshIntervals.delete(widgetId);
    }
  }

  private cleanupWidgetSubscribers(widgetId: string): void {
    this.widgetSubscribers.delete(widgetId);
  }

  private cleanupDashboardSubscribers(dashboardId: string): void {
    this.dashboardSubscribers.delete(dashboardId);
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateEventData(query: WidgetQuery, timeRange: TimeRange): ChartDataPoint[] {
    const count = Math.floor(Math.random() * 100) + 10;
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date(timeRange.end);
    const start = new Date(timeRange.start);
    const daysDiff = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    return Array.from({ length: Math.min(daysDiff, 12) }, (_, i) => ({
      label: labels[(start.getMonth() + i) % 12],
      value: Math.floor(Math.random() * count),
    }));
  }

  private generateMetricData(_query: WidgetQuery): MetricValue {
    const current = Math.floor(Math.random() * 1000);
    const previous = Math.floor(Math.random() * 1000);
    const change = current - previous;
    const changePercent = previous > 0 ? (change / previous) * 100 : 0;

    return {
      current,
      previous,
      change,
      changePercent,
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
    };
  }

  private generateGenericData(_query: WidgetQuery): unknown[] {
    return [
      { name: 'Item 1', value: Math.floor(Math.random() * 100) },
      { name: 'Item 2', value: Math.floor(Math.random() * 100) },
      { name: 'Item 3', value: Math.floor(Math.random() * 100) },
    ];
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}

export class ChartWidget {
  static generateLineData(points: number = 12): ChartDataPoint[] {
    return Array.from({ length: points }, (_, i) => ({
      label: `Point ${i + 1}`,
      value: Math.floor(Math.random() * 100),
    }));
  }

  static generateBarData(categories: number = 6): ChartDataPoint[] {
    return Array.from({ length: categories }, (_, i) => ({
      label: `Category ${String.fromCharCode(65 + i)}`,
      value: Math.floor(Math.random() * 100),
    }));
  }

  static generatePieData(segments: number = 5): ChartDataPoint[] {
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'];
    return Array.from({ length: segments }, (_, i) => ({
      label: `Segment ${i + 1}`,
      value: Math.floor(Math.random() * 100),
      color: colors[i % colors.length],
    }));
  }

  static generateAreaData(points: number = 12): ChartDataPoint[] {
    return Array.from({ length: points }, (_, i) => ({
      label: `Point ${i + 1}`,
      value: Math.floor(Math.random() * 100),
    }));
  }

  static generateScatterData(points: number = 20): ChartDataPoint[] {
    return Array.from({ length: points }, () => ({
      label: '',
      value: Math.random() * 100,
    }));
  }

  static generateDonutData(segments: number = 4): ChartDataPoint[] {
    return this.generatePieData(segments);
  }
}

export class TableWidget {
  static generateColumns(): TableColumn[] {
    return [
      { key: 'id', label: 'ID', type: 'string', sortable: true },
      { key: 'name', label: 'Name', type: 'string', sortable: true },
      { key: 'value', label: 'Value', type: 'number', sortable: true, align: 'right' },
      { key: 'createdAt', label: 'Created', type: 'date' },
    ];
  }

  static generateRows(count: number = 10): Record<string, unknown>[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `row_${i + 1}`,
      name: `Item ${i + 1}`,
      value: Math.floor(Math.random() * 1000),
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    }));
  }
}

export class MetricWidget {
  static generateValue(): MetricValue {
    const current = Math.floor(Math.random() * 10000);
    const previous = Math.floor(Math.random() * 10000);
    const change = current - previous;
    const changePercent = previous > 0 ? (change / previous) * 100 : 0;

    return {
      current,
      previous,
      change,
      changePercent,
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
    };
  }
}

export class ProgressWidget {
  static generateData(): ProgressData {
    const value = Math.floor(Math.random() * 100);
    return {
      value,
      max: 100,
      label: `${value}%`,
      showPercentage: true,
    };
  }
}

export class FunnelWidget {
  static generateData(): FunnelData {
    const steps = ['Visit', 'Sign Up', 'Onboarding', 'Activation', 'Purchase'];
    let total = 1000;

    return {
      steps: steps.map(name => {
        const value = Math.floor(total * (0.3 + Math.random() * 0.5));
        total = value;
        return {
          name,
          value,
          conversionRate: total > 0 ? value / (total * 10) : 0,
        };
      }),
    };
  }
}

export class HeatmapWidget {
  static generateCells(rows: number = 7, cols: number = 24): HeatmapCell[] {
    const cells: HeatmapCell[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        cells.push({
          x,
          y,
          value: Math.floor(Math.random() * 100),
          label: `Cell ${x},${y}`,
        });
      }
    }
    return cells;
  }
}

export class TimeSeriesWidget {
  static generateData(points: number = 24): TimeSeriesDataPoint[] {
    return Array.from({ length: points }, (_, i) => ({
      timestamp: new Date(Date.now() - (points - i) * 60 * 60 * 1000),
      value: Math.floor(Math.random() * 100),
    }));
  }
}

export function createDashboardService(): DashboardServiceImpl {
  return new DashboardServiceImpl();
}

export function createDashboard(
  name: string,
  description: string,
  createdBy: string,
  layout?: Partial<DashboardLayout>
): Promise<Dashboard> {
  const service = new DashboardServiceImpl();
  return service.createDashboard(name, description, createdBy, layout);
}

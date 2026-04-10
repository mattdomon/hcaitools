/**
 * Reporting & Business Intelligence Implementation
 * Comprehensive reporting system for Manus AI Platform
 */

import crypto from 'crypto';
import {
  ReportType,
  ChartType,
  DataSourceConfig,
  ReportFilter,
  ReportSection,
  ReportBuilderState,
  DragDropItem,
  ChartConfiguration,
  ScheduledReport,
  ReportCache,
  ReportDataRequest,
  ReportDataResponse,
  DrillDownConfig,
  DrillDownLevel,
  ScheduleType,
  FilterOption,
} from './types';

export class ReportBuilderImpl {
  private reports: Map<string, ReportBuilderState> = new Map();
  private cacheService: ReportCacheServiceImpl;
  private drillDownConfigs: Map<string, DrillDownConfig> = new Map();

  constructor() {
    this.cacheService = new ReportCacheServiceImpl();
  }

  async createReport(
    name: string,
    type: ReportType,
    dataSource: DataSourceConfig
  ): Promise<ReportBuilderState> {
    const reportId = this.generateId('rpt');
    const now = new Date();

    const report: ReportBuilderState = {
      reportId,
      name,
      type,
      dataSource,
      sections: [],
      filters: [],
      layout: {
        columns: 1,
        showTitle: true,
        showDescription: true,
        showFilters: true,
        showExport: true,
      },
      items: [],
      createdAt: now,
      updatedAt: now,
    };

    this.reports.set(reportId, report);
    return report;
  }

  async getReport(reportId: string): Promise<ReportBuilderState | null> {
    return this.reports.get(reportId) || null;
  }

  async updateReport(reportId: string, updates: Partial<ReportBuilderState>): Promise<ReportBuilderState> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    const updated: ReportBuilderState = {
      ...report,
      ...updates,
      reportId,
      updatedAt: new Date(),
    };

    this.reports.set(reportId, updated);
    return updated;
  }

  async deleteReport(reportId: string): Promise<void> {
    this.reports.delete(reportId);
    this.cacheService.invalidate(reportId);
    this.drillDownConfigs.delete(reportId);
  }

  async addSection(reportId: string, section: Omit<ReportSection, 'sectionId'>): Promise<ReportSection> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    const fullSection: ReportSection = {
      ...section,
      sectionId: this.generateId('sec'),
    };

    report.sections.push(fullSection);
    report.updatedAt = new Date();
    this.reports.set(reportId, report);

    return fullSection;
  }

  async removeSection(reportId: string, sectionId: string): Promise<void> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    report.sections = report.sections.filter((s) => s.sectionId !== sectionId);
    report.updatedAt = new Date();
    this.reports.set(reportId, report);
  }

  async addFilter(reportId: string, filter: Omit<ReportFilter, 'filterId'>): Promise<ReportFilter> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    const fullFilter: ReportFilter = {
      ...filter,
      filterId: this.generateId('flt'),
    };

    report.filters.push(fullFilter);
    report.updatedAt = new Date();
    this.reports.set(reportId, report);

    return fullFilter;
  }

  async removeFilter(reportId: string, filterId: string): Promise<void> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    report.filters = report.filters.filter((f) => f.filterId !== filterId);
    report.updatedAt = new Date();
    this.reports.set(reportId, report);
  }

  async addDragDropItem(reportId: string, item: Omit<DragDropItem, 'itemId'>): Promise<DragDropItem> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    const fullItem: DragDropItem = {
      ...item,
      itemId: this.generateId('item'),
    };

    report.items.push(fullItem);
    report.updatedAt = new Date();
    this.reports.set(reportId, report);

    return fullItem;
  }

  async removeDragDropItem(reportId: string, itemId: string): Promise<void> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    report.items = report.items.filter((i) => i.itemId !== itemId);
    report.updatedAt = new Date();
    this.reports.set(reportId, report);
  }

  async reorderSections(reportId: string, sectionIds: string[]): Promise<void> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    const sectionMap = new Map(report.sections.map((s) => [s.sectionId, s]));
    report.sections = sectionIds
      .map((id) => sectionMap.get(id))
      .filter((s): s is ReportSection => s !== undefined)
      .map((s, index) => ({ ...s, position: index }));

    report.updatedAt = new Date();
    this.reports.set(reportId, report);
  }

  async executeReport(request: ReportDataRequest): Promise<ReportDataResponse> {
    const startTime = Date.now();
    const report = this.reports.get(request.reportId);

    if (!report) {
      throw new Error(`Report ${request.reportId} not found`);
    }

    const cached = await this.cacheService.get(request.reportId, request.parameters || {});

    if (cached && cached.expiresAt > new Date()) {
      return {
        reportId: request.reportId,
        data: cached.data,
        metadata: {
          totalRows: Array.isArray(cached.data) ? (cached.data as unknown[]).length : 0,
          executionTimeMs: Date.now() - startTime,
          generatedAt: cached.generatedAt,
        },
        filters: report.filters,
        cached: true,
      };
    }

    const data = this.generateMockData(report, request);

    await this.cacheService.set({
      reportId: request.reportId,
      parameters: request.parameters || {},
      data,
      expiresAt: new Date(Date.now() + 300000),
      sizeBytes: JSON.stringify(data).length,
    });

    return {
      reportId: request.reportId,
      data,
      metadata: {
        totalRows: Array.isArray(data) ? data.length : 0,
        executionTimeMs: Date.now() - startTime,
        generatedAt: new Date(),
      },
      filters: report.filters,
      cached: false,
    };
  }

  async listReports(): Promise<ReportBuilderState[]> {
    return Array.from(this.reports.values());
  }

  async getDrillDownConfig(reportId: string): Promise<DrillDownConfig | null> {
    return this.drillDownConfigs.get(reportId) || null;
  }

  async setDrillDownConfig(reportId: string, config: DrillDownConfig): Promise<void> {
    this.drillDownConfigs.set(reportId, config);
  }

  async getDrillDownData(reportId: string, level: number, _filters: Record<string, unknown>): Promise<unknown> {
    const config = this.drillDownConfigs.get(reportId);
    if (!config || level >= config.levels.length) {
      return [];
    }

    const levelConfig = config.levels[level];
    return this.generateDrillDownData(levelConfig, level);
  }

  private generateDrillDownData(levelConfig: DrillDownLevel, _level: number): unknown[] {
    const count = 5 + Math.floor(Math.random() * 10);
    const data: Array<Record<string, unknown>> = [];

    for (let i = 0; i < count; i++) {
      data.push({
        label: `${levelConfig.label} ${i + 1}`,
        value: Math.floor(Math.random() * 1000),
        groupByField: levelConfig.groupByField,
      });
    }

    return data;
  }

  private generateMockData(report: ReportBuilderState, request: ReportDataRequest): unknown {
    const pageSize = request.pageSize || 50;
    const page = request.page || 1;
    const totalRows = 100;

    const mockData: Array<Record<string, unknown>> = [];

    for (let i = 0; i < pageSize; i++) {
      const row: Record<string, unknown> = {
        id: (page - 1) * pageSize + i + 1,
        date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      for (const item of report.items) {
        if (item.type === 'field' && item.dataField) {
          row[item.dataField] = this.generateFieldValue(item.dataField);
        } else if (item.type === 'metric' && item.aggregation && item.dataField) {
          row[`${item.aggregation}_${item.dataField}`] = Math.floor(Math.random() * 10000);
        }
      }

      mockData.push(row);
    }

    return {
      data: mockData,
      pagination: {
        page,
        pageSize,
        totalRows,
        totalPages: Math.ceil(totalRows / pageSize),
      },
    };
  }

  private generateFieldValue(fieldName: string): unknown {
    const hash = fieldName.charCodeAt(0) % 5;

    switch (hash) {
      case 0:
        return `Item ${Math.floor(Math.random() * 100)}`;
      case 1:
        return Math.floor(Math.random() * 1000);
      case 2:
        return Math.random() > 0.5;
      case 3:
        return ['Active', 'Inactive', 'Pending'][Math.floor(Math.random() * 3)];
      default:
        return new Date().toISOString();
    }
  }

  private buildCacheKey(reportId: string, parameters: Record<string, unknown>): string {
    return `${reportId}_${JSON.stringify(parameters)}`;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }

  getCacheService(): ReportCacheServiceImpl {
    return this.cacheService;
  }
}

export class ReportCacheServiceImpl {
  private cache: Map<string, ReportCache> = new Map();
  private accessLog: Map<string, number> = new Map();
  private hits = 0;
  private misses = 0;

  async get(reportId: string, parameters: Record<string, unknown>): Promise<ReportCache | null> {
    const key = this.buildKey(reportId, parameters);
    const entry = this.cache.get(key);

    if (entry) {
      if (entry.expiresAt > new Date()) {
        this.hits++;
        this.accessLog.set(key, Date.now());
        return entry;
      } else {
        this.cache.delete(key);
        this.misses++;
        return null;
      }
    }

    this.misses++;
    return null;
  }

  async set(cache: Omit<ReportCache, 'cacheId' | 'generatedAt'>): Promise<ReportCache> {
    const key = this.buildKey(cache.reportId, cache.parameters);

    const fullCache: ReportCache = {
      ...cache,
      cacheId: this.generateId('cache'),
      generatedAt: new Date(),
    };

    this.cache.set(key, fullCache);
    this.accessLog.set(key, Date.now());

    return fullCache;
  }

  async invalidate(reportId: string): Promise<void> {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.reportId === reportId) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.accessLog.delete(key);
    }
  }

  async invalidateByPattern(_reportId: string, _parameterPattern: Record<string, unknown>): Promise<void> {
    // Simplified implementation - in real scenario would match parameter patterns
  }

  async clearExpired(): Promise<number> {
    const now = new Date();
    let cleared = 0;

    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        keysToDelete.push(key);
        cleared++;
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.accessLog.delete(key);
    }

    return cleared;
  }

  async getStats(): Promise<{ totalEntries: number; totalSizeBytes: number; hitRate: number }> {
    let totalSize = 0;

    for (const entry of this.cache.values()) {
      totalSize += entry.sizeBytes;
    }

    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    return {
      totalEntries: this.cache.size,
      totalSizeBytes: totalSize,
      hitRate,
    };
  }

  private buildKey(reportId: string, parameters: Record<string, unknown>): string {
    return `${reportId}_${JSON.stringify(parameters)}`;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export class ChartRendererImpl {
  async render(type: ChartType, data: unknown, config: ChartConfiguration): Promise<unknown> {
    switch (type) {
      case 'gauge':
        return this.renderGaugeData(data as number, config);
      case 'pie':
        return this.renderPieData(data as Record<string, number>, config);
      case 'donut':
        return this.renderDonutData(data as Record<string, number>, config);
      case 'line':
      case 'bar':
      case 'area':
      case 'scatter':
        return this.renderStandardChart(type, data, config);
      default:
        return { type, data, config };
    }
  }

  renderGaugeData(value: number, config: ChartConfiguration): unknown {
    return {
      type: 'gauge',
      value,
      config: {
        title: config.title,
        colors: config.colors,
        animationEnabled: config.animationEnabled,
      },
      renderedAt: new Date(),
    };
  }

  renderPieData(data: Record<string, number>, config: ChartConfiguration): unknown {
    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    const slices = Object.entries(data).map(([label, value]) => ({
      label,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0,
    }));

    return {
      type: 'pie',
      data: slices,
      config: {
        title: config.title,
        colors: config.colors,
        showLegend: config.showLegend,
        dataLabelsEnabled: config.dataLabelsEnabled,
      },
      renderedAt: new Date(),
    };
  }

  renderDonutData(data: Record<string, number>, config: ChartConfiguration): unknown {
    const pieResult = this.renderPieData(data, config) as Record<string, unknown>;
    return {
      ...pieResult,
      type: 'donut',
      innerRadius: 40,
      outerRadius: 80,
    };
  }

  renderStandardChart(type: ChartType, data: unknown, config: ChartConfiguration): unknown {
    return {
      type,
      data,
      config: {
        title: config.title,
        xAxis: config.xAxis,
        yAxis: config.yAxis,
        colors: config.colors,
        showLegend: config.showLegend,
        showGrid: config.showGrid,
        animationEnabled: config.animationEnabled,
        dataLabelsEnabled: config.dataLabelsEnabled,
      },
      renderedAt: new Date(),
    };
  }
}

export class ScheduledReportServiceImpl {
  private schedules: Map<string, ScheduledReport> = new Map();

  async createSchedule(
    schedule: Omit<ScheduledReport, 'scheduleId' | 'createdAt' | 'updatedAt' | 'nextRunAt'>
  ): Promise<ScheduledReport> {
    const scheduleId = this.generateId('sched');
    const now = new Date();

    const fullSchedule: ScheduledReport = {
      ...schedule,
      scheduleId,
      nextRunAt: this.calculateNextRun(schedule.schedule, now),
      createdAt: now,
      updatedAt: now,
    };

    this.schedules.set(scheduleId, fullSchedule);
    return fullSchedule;
  }

  async getSchedule(scheduleId: string): Promise<ScheduledReport | null> {
    return this.schedules.get(scheduleId) || null;
  }

  async updateSchedule(scheduleId: string, updates: Partial<ScheduledReport>): Promise<ScheduledReport> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    const updated: ScheduledReport = {
      ...schedule,
      ...updates,
      scheduleId,
      updatedAt: new Date(),
    };

    if (updates.schedule && updates.schedule !== schedule.schedule) {
      updated.nextRunAt = this.calculateNextRun(updates.schedule, new Date());
    }

    this.schedules.set(scheduleId, updated);
    return updated;
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    this.schedules.delete(scheduleId);
  }

  async enableSchedule(scheduleId: string): Promise<ScheduledReport> {
    return this.updateSchedule(scheduleId, { enabled: true });
  }

  async disableSchedule(scheduleId: string): Promise<ScheduledReport> {
    return this.updateSchedule(scheduleId, { enabled: false });
  }

  async listSchedules(reportId?: string): Promise<ScheduledReport[]> {
    let schedules = Array.from(this.schedules.values());

    if (reportId) {
      schedules = schedules.filter((s) => s.reportId === reportId);
    }

    return schedules;
  }

  async getNextScheduledRun(scheduleId: string): Promise<Date | null> {
    const schedule = this.schedules.get(scheduleId);
    return schedule?.nextRunAt || null;
  }

  private calculateNextRun(schedule: ScheduleType, from: Date): Date {
    const next = new Date(from);

    switch (schedule) {
      case 'once':
        next.setDate(next.getDate() + 1);
        break;
      case 'daily':
        next.setDate(next.getDate() + 1);
        next.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        next.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        next.setDate(1);
        next.setHours(0, 0, 0, 0);
        break;
    }

    return next;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export class ExportServiceImpl {
  async exportToPdf(data: unknown, _options?: Record<string, unknown>): Promise<Buffer> {
    const jsonStr = JSON.stringify(data, null, 2);
    return Buffer.from(`PDF-like content: ${jsonStr.substring(0, 100)}...`, 'utf-8');
  }

  async exportToExcel(data: unknown, _options?: Record<string, unknown>): Promise<Buffer> {
    const jsonStr = JSON.stringify(data, null, 2);
    return Buffer.from(`Excel-like content: ${jsonStr.substring(0, 100)}...`, 'utf-8');
  }

  async exportToCsv(data: unknown, _options?: Record<string, unknown>): Promise<string> {
    if (Array.isArray(data) && data.length > 0) {
      const headers = Object.keys(data[0] as Record<string, unknown>);
      const rows = data.map((row) =>
        headers.map((h) => JSON.stringify((row as Record<string, unknown>)[h] ?? '')).join(',')
      );
      return [headers.join(','), ...rows].join('\n');
    }
    return JSON.stringify(data);
  }

  async exportToJson(data: unknown, _options?: Record<string, unknown>): Promise<string> {
    return JSON.stringify(data, null, 2);
  }

  generateExportId(): string {
    return `exp_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export class DrillDownServiceImpl {
  private configs: Map<string, DrillDownConfig> = new Map();
  private reportBuilder: ReportBuilderImpl;

  constructor(reportBuilder: ReportBuilderImpl) {
    this.reportBuilder = reportBuilder;
  }

  async getDrillDownData(reportId: string, level: number, filters: Record<string, unknown>): Promise<unknown> {
    return this.reportBuilder.getDrillDownData(reportId, level, filters);
  }

  async getAvailableDrillDownLevels(reportId: string): Promise<DrillDownLevel[]> {
    const config = this.configs.get(reportId);
    return config?.levels || [];
  }

  async setDrillDownConfig(reportId: string, config: DrillDownConfig): Promise<void> {
    this.configs.set(reportId, config);
    await this.reportBuilder.setDrillDownConfig(reportId, config);
  }

  async getDrillDownConfig(reportId: string): Promise<DrillDownConfig | null> {
    return this.configs.get(reportId) || null;
  }
}

export class FilterServiceImpl {
  applyFilters(data: unknown[], filters: ReportFilter[]): unknown[] {
    if (!filters || filters.length === 0) {
      return data;
    }

    return data.filter((row) => this.rowMatchesFilters(row, filters));
  }

  validateFilter(filter: ReportFilter, value: unknown): boolean {
    if (filter.required && (value === undefined || value === null || value === '')) {
      return false;
    }

    switch (filter.type) {
      case 'number':
        return typeof value === 'number';
      case 'text':
        return typeof value === 'string';
      case 'date_range':
        return Array.isArray(value) && value.length === 2;
      case 'select':
        return true;
      case 'multi_select':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  getFilterOptions(filter: ReportFilter): FilterOption[] {
    return filter.options || [];
  }

  buildFilterQuery(filters: ReportFilter[]): string {
    const conditions = filters
      .filter((f) => f.value !== undefined && f.value !== null && f.value !== '')
      .map((f) => this.buildSingleCondition(f));

    return conditions.join(' AND ');
  }

  private rowMatchesFilters(row: unknown, filters: ReportFilter[]): boolean {
    if (typeof row !== 'object' || row === null) {
      return false;
    }

    const rowObj = row as Record<string, unknown>;

    for (const filter of filters) {
      if (!this.rowMatchesFilter(rowObj, filter)) {
        return false;
      }
    }

    return true;
  }

  private rowMatchesFilter(row: Record<string, unknown>, filter: ReportFilter): boolean {
    const value = row[filter.field];

    switch (filter.operator) {
      case 'eq':
        return value === filter.value;
      case 'neq':
        return value !== filter.value;
      case 'gt':
        return typeof value === 'number' && typeof filter.value === 'number' && value > filter.value;
      case 'gte':
        return typeof value === 'number' && typeof filter.value === 'number' && value >= filter.value;
      case 'lt':
        return typeof value === 'number' && typeof filter.value === 'number' && value < filter.value;
      case 'lte':
        return typeof value === 'number' && typeof filter.value === 'number' && value <= filter.value;
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(value);
      case 'contains':
        return typeof value === 'string' && typeof filter.value === 'string' && value.includes(filter.value);
      case 'between':
        if (Array.isArray(filter.value) && filter.value.length === 2) {
          return typeof value === 'number' && value >= filter.value[0] && value <= filter.value[1];
        }
        return false;
      default:
        return true;
    }
  }

  private buildSingleCondition(filter: ReportFilter): string {
    const value = filter.value;

    if (Array.isArray(value)) {
      return `${filter.field} IN (${value.join(', ')})`;
    }

    if (typeof value === 'string') {
      return `${filter.field} ${filter.operator} '${value}'`;
    }

    return `${filter.field} ${filter.operator} ${value}`;
  }
}

export class ReportingService {
  private reportBuilder: ReportBuilderImpl;
  private chartRenderer: ChartRendererImpl;
  private scheduledService: ScheduledReportServiceImpl;
  private exportService: ExportServiceImpl;
  private drillDownService: DrillDownServiceImpl;
  private filterService: FilterServiceImpl;

  constructor() {
    this.reportBuilder = new ReportBuilderImpl();
    this.chartRenderer = new ChartRendererImpl();
    this.scheduledService = new ScheduledReportServiceImpl();
    this.exportService = new ExportServiceImpl();
    this.drillDownService = new DrillDownServiceImpl(this.reportBuilder);
    this.filterService = new FilterServiceImpl();
  }

  get builder(): ReportBuilderImpl {
    return this.reportBuilder;
  }

  get charts(): ChartRendererImpl {
    return this.chartRenderer;
  }

  get scheduler(): ScheduledReportServiceImpl {
    return this.scheduledService;
  }

  get exporter(): ExportServiceImpl {
    return this.exportService;
  }

  get drilldown(): DrillDownServiceImpl {
    return this.drillDownService;
  }

  get filter(): FilterServiceImpl {
    return this.filterService;
  }

  async createQuickReport(name: string, type: ReportType): Promise<ReportBuilderState> {
    return this.reportBuilder.createReport(name, type, { type: 'custom' });
  }

  async executeWithFilters(request: ReportDataRequest): Promise<ReportDataResponse> {
    const result = await this.reportBuilder.executeReport(request);

    if (request.filters && request.filters.length > 0) {
      const filters = await this.getFiltersForReport(request.reportId);
      if (Array.isArray(result.data)) {
        result.data = this.filterService.applyFilters(result.data as unknown[], filters);
      }
    }

    return result;
  }

  private async getFiltersForReport(reportId: string): Promise<ReportFilter[]> {
    const report = await this.reportBuilder.getReport(reportId);
    return report?.filters || [];
  }
}

export function createReportingService(): ReportingService {
  return new ReportingService();
}

export function createReportBuilder(): ReportBuilderImpl {
  return new ReportBuilderImpl();
}

export function createChartRenderer(): ChartRendererImpl {
  return new ChartRendererImpl();
}

export function createScheduledReportService(): ScheduledReportServiceImpl {
  return new ScheduledReportServiceImpl();
}

export function createExportService(): ExportServiceImpl {
  return new ExportServiceImpl();
}

export function createDrillDownService(reportBuilder: ReportBuilderImpl): DrillDownServiceImpl {
  return new DrillDownServiceImpl(reportBuilder);
}

export function createFilterService(): FilterServiceImpl {
  return new FilterServiceImpl();
}

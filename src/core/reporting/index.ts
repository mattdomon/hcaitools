/**
 * Reporting & Business Intelligence Module
 * Comprehensive reporting system for Manus AI Platform
 */

export {
  ReportType,
  ChartType,
  DataSourceType,
  FilterType,
  ExportFormat,
  ScheduleType,
  FilterOperator,
  ReportFilter,
  FilterOption,
  DataSourceConfig,
  ChartConfiguration,
  PivotTableConfiguration,
  ReportLayout,
  DragDropItem,
  ReportSection,
  ReportMetric,
  ReportBuilderState,
  ScheduledReport,
  ReportCache,
  DrillDownConfig,
  DrillDownLevel,
  ReportExport,
  ReportFilterValue,
  ReportDataRequest,
  ReportDataResponse,
  ReportMetadata,
  ReportBuilder,
  ChartRenderer,
  ScheduledReportService,
  ReportCacheService,
  ExportService,
  DrillDownService,
  FilterService,
} from './types';

export {
  ReportBuilderImpl,
  ReportCacheServiceImpl,
  ChartRendererImpl,
  ScheduledReportServiceImpl,
  ExportServiceImpl,
  DrillDownServiceImpl,
  FilterServiceImpl,
  ReportingService,
  createReportingService,
  createReportBuilder,
  createChartRenderer,
  createScheduledReportService,
  createExportService,
  createDrillDownService,
  createFilterService,
} from './reporting';

import {
  ReportingService,
  createReportingService,
} from './reporting';

import {
  ReportType,
  ReportDataRequest,
  ReportDataResponse,
  ReportBuilderState,
  ScheduledReport,
  DrillDownConfig,
  ReportFilter,
  ChartType,
  ChartConfiguration,
  ExportFormat,
  DataSourceConfig,
  ReportSection,
  DragDropItem,
} from './types';

export class ReportingManus {
  private service: ReportingService;

  constructor() {
    this.service = createReportingService();
  }

  async createReport(name: string, type: ReportType, dataSource?: DataSourceConfig): Promise<ReportBuilderState> {
    return this.service.builder.createReport(name, type, dataSource || { type: 'custom' });
  }

  async getReport(reportId: string): Promise<ReportBuilderState | null> {
    return this.service.builder.getReport(reportId);
  }

  async updateReport(reportId: string, updates: Partial<ReportBuilderState>): Promise<ReportBuilderState> {
    return this.service.builder.updateReport(reportId, updates);
  }

  async deleteReport(reportId: string): Promise<void> {
    return this.service.builder.deleteReport(reportId);
  }

  async addSection(reportId: string, section: Omit<ReportSection, 'sectionId'>): Promise<ReportSection> {
    return this.service.builder.addSection(reportId, section);
  }

  async removeSection(reportId: string, sectionId: string): Promise<void> {
    return this.service.builder.removeSection(reportId, sectionId);
  }

  async addFilter(reportId: string, filter: Omit<ReportFilter, 'filterId'>): Promise<ReportFilter> {
    return this.service.builder.addFilter(reportId, filter);
  }

  async removeFilter(reportId: string, filterId: string): Promise<void> {
    return this.service.builder.removeFilter(reportId, filterId);
  }

  async addDragDropItem(reportId: string, item: Omit<DragDropItem, 'itemId'>): Promise<DragDropItem> {
    return this.service.builder.addDragDropItem(reportId, item);
  }

  async removeDragDropItem(reportId: string, itemId: string): Promise<void> {
    return this.service.builder.removeDragDropItem(reportId, itemId);
  }

  async executeReport(request: ReportDataRequest): Promise<ReportDataResponse> {
    return this.service.executeWithFilters(request);
  }

  async listReports(): Promise<ReportBuilderState[]> {
    return this.service.builder.listReports();
  }

  async renderChart(type: ChartType, data: unknown, config: ChartConfiguration): Promise<unknown> {
    return this.service.charts.render(type, data, config);
  }

  async createSchedule(schedule: Omit<ScheduledReport, 'scheduleId' | 'createdAt' | 'updatedAt' | 'nextRunAt'>): Promise<ScheduledReport> {
    return this.service.scheduler.createSchedule(schedule);
  }

  async getSchedule(scheduleId: string): Promise<ScheduledReport | null> {
    return this.service.scheduler.getSchedule(scheduleId);
  }

  async updateSchedule(scheduleId: string, updates: Partial<ScheduledReport>): Promise<ScheduledReport> {
    return this.service.scheduler.updateSchedule(scheduleId, updates);
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    return this.service.scheduler.deleteSchedule(scheduleId);
  }

  async enableSchedule(scheduleId: string): Promise<ScheduledReport> {
    return this.service.scheduler.enableSchedule(scheduleId);
  }

  async disableSchedule(scheduleId: string): Promise<ScheduledReport> {
    return this.service.scheduler.disableSchedule(scheduleId);
  }

  async listSchedules(reportId?: string): Promise<ScheduledReport[]> {
    return this.service.scheduler.listSchedules(reportId);
  }

  async exportReport(reportId: string, format: ExportFormat): Promise<string> {
    const report = await this.getReport(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    const data = await this.executeReport({ reportId });

    switch (format) {
      case 'pdf':
        return (await this.service.exporter.exportToPdf(data)).toString('base64');
      case 'excel':
        return (await this.service.exporter.exportToExcel(data)).toString('base64');
      case 'csv':
        return this.service.exporter.exportToCsv(data.data);
      case 'json':
        return this.service.exporter.exportToJson(data);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  async getDrillDownData(reportId: string, level: number, filters: Record<string, unknown>): Promise<unknown> {
    return this.service.drilldown.getDrillDownData(reportId, level, filters);
  }

  async setDrillDownConfig(reportId: string, config: DrillDownConfig): Promise<void> {
    return this.service.drilldown.setDrillDownConfig(reportId, config);
  }

  async getDrillDownConfig(reportId: string): Promise<DrillDownConfig | null> {
    return this.service.drilldown.getDrillDownConfig(reportId);
  }

  async getCacheStats(): Promise<{ totalEntries: number; totalSizeBytes: number; hitRate: number }> {
    return this.service.builder.getCacheService().getStats();
  }

  async clearExpiredCache(): Promise<number> {
    return this.service.builder.getCacheService().clearExpired();
  }

  async invalidateCache(reportId: string): Promise<void> {
    return this.service.builder.getCacheService().invalidate(reportId);
  }

  applyFilters(data: unknown[], filters: ReportFilter[]): unknown[] {
    return this.service.filter.applyFilters(data, filters);
  }

  validateFilter(filter: ReportFilter, value: unknown): boolean {
    return this.service.filter.validateFilter(filter, value);
  }
}

export function createReporting(): ReportingManus {
  return new ReportingManus();
}

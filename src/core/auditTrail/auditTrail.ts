import {
  AuditEvent,
  AuditEventType,
  AuditFilter,
  AuditStats,
  RetentionRule,
  ComplianceReport,
  DataSubjectRequest,
  AccessRecord,
  ComplianceConfig,
  ComplianceFramework,
  ReportType,
  DataSubjectRight,
  DEFAULT_COMPLIANCE_CONFIG,
  generateAuditId,
  isRetentionExpired,
} from './types';

export class InMemoryAuditStore {
  private events: AuditEvent[] = [];
  private maxEvents: number;

  constructor(maxEvents: number = 100000) {
    this.maxEvents = maxEvents;
  }

  add(event: AuditEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  getAll(): AuditEvent[] {
    return [...this.events];
  }

  query(filter: AuditFilter): AuditEvent[] {
    let results = [...this.events];

    if (filter.eventTypes && filter.eventTypes.length > 0) {
      results = results.filter((e) => filter.eventTypes!.includes(e.eventType));
    }

    if (filter.startTime) {
      results = results.filter((e) => (e.timestamp || new Date(0)) >= filter.startTime!);
    }

    if (filter.endTime) {
      results = results.filter((e) => (e.timestamp || new Date()) <= filter.endTime!);
    }

    if (filter.userId) {
      results = results.filter((e) => e.userId === filter.userId);
    }

    if (filter.sessionId) {
      results = results.filter((e) => e.sessionId === filter.sessionId);
    }

    if (filter.resourceType) {
      results = results.filter((e) => e.resourceType === filter.resourceType);
    }

    if (filter.resourceId) {
      results = results.filter((e) => e.resourceId === filter.resourceId);
    }

    if (filter.success !== undefined) {
      results = results.filter((e) => e.success === filter.success);
    }

    if (filter.framework) {
      results = results.filter((e) => e.framework === filter.framework);
    }

    if (filter.dataCategory) {
      results = results.filter((e) => e.dataCategory === filter.dataCategory);
    }

    return results.sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
  }

  clear(): void {
    this.events = [];
  }

  size(): number {
    return this.events.length;
  }
}

export class AuditLogger {
  private store: InMemoryAuditStore;
  private config: ComplianceConfig;
  private retentionRules: Map<string, RetentionRule> = new Map();
  private dataSubjectRequests: Map<string, DataSubjectRequest> = new Map();
  private accessRecords: Map<string, AccessRecord> = new Map();

  constructor(config?: Partial<ComplianceConfig>) {
    this.store = new InMemoryAuditStore();
    this.config = { ...DEFAULT_COMPLIANCE_CONFIG, ...config };
  }

  log(event: Omit<AuditEvent, 'id'>): AuditEvent {
    const entry: AuditEvent = {
      ...event,
      id: generateAuditId('AUDIT'),
      timestamp: event.timestamp || new Date(),
      retentionPolicy: event.retentionPolicy || 'short_term',
    };

    this.store.add(entry);

    this.logAccessRecord(entry);

    return entry;
  }

  logDataAccess(params: {
    userId: string;
    sessionId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
    framework?: ComplianceFramework;
    dataCategory?: string;
  }): AuditEvent {
    return this.log({
      eventType: 'data_access',
      ...params,
    });
  }

  logDataModification(params: {
    userId?: string;
    sessionId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
    framework?: ComplianceFramework;
    dataCategory?: string;
  }): AuditEvent {
    return this.log({
      eventType: 'data_modification',
      ...params,
    });
  }

  logSecurityEvent(params: {
    userId?: string;
    sessionId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
    framework?: ComplianceFramework;
  }): AuditEvent {
    return this.log({
      eventType: 'security_event',
      ...params,
    });
  }

  logComplianceEvent(params: {
    userId?: string;
    sessionId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
    framework: ComplianceFramework;
  }): AuditEvent {
    return this.log({
      eventType: 'compliance',
      ...params,
    });
  }

  private logAccessRecord(event: AuditEvent): void {
    if (!event.userId || !event.resourceType || !event.resourceId) {
      return;
    }

    const accessRecord: AccessRecord = {
      id: generateAuditId('ACC'),
      userId: event.userId,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      accessType: this.inferAccessType(event.action),
      accessedAt: event.timestamp || new Date(),
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      success: event.success,
      metadata: event.metadata,
    };

    this.accessRecords.set(accessRecord.id, accessRecord);
  }

  private inferAccessType(action: string): 'read' | 'write' | 'delete' | 'execute' {
    const lowerAction = action.toLowerCase();
    if (lowerAction.includes('delete') || lowerAction.includes('remove')) {
      return 'delete';
    }
    if (lowerAction.includes('create') || lowerAction.includes('update') || lowerAction.includes('modify')) {
      return 'write';
    }
    if (lowerAction.includes('execute') || lowerAction.includes('run')) {
      return 'execute';
    }
    return 'read';
  }

  getEvents(filter?: AuditFilter): AuditEvent[] {
    return this.store.query(filter || {});
  }

  getEventById(id: string): AuditEvent | null {
    const events = this.store.getAll();
    return events.find((e) => e.id === id) || null;
  }

  getStats(filter?: AuditFilter): AuditStats {
    const events = filter ? this.store.query(filter) : this.store.getAll();

    const eventsByType: Record<AuditEventType, number> = {
      data_access: 0,
      data_modification: 0,
      security_event: 0,
      compliance: 0,
    };
    const eventsByUser: Record<string, number> = {};
    const eventsByResource: Record<string, number> = {};
    let failedEvents = 0;

    for (const event of events) {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;

      if (event.userId) {
        eventsByUser[event.userId] = (eventsByUser[event.userId] || 0) + 1;
      }

      const resourceKey = `${event.resourceType}:${event.resourceId || 'unknown'}`;
      eventsByResource[resourceKey] = (eventsByResource[resourceKey] || 0) + 1;

      if (!event.success) {
        failedEvents++;
      }
    }

    return {
      totalEvents: events.length,
      eventsByType,
      eventsByUser,
      eventsByResource,
      successRate: events.length > 0 ? (events.length - failedEvents) / events.length : 1,
      failedEvents,
      startTime: events.length > 0 ? (events[events.length - 1].timestamp || new Date()) : new Date(),
      endTime: events.length > 0 ? (events[0].timestamp || new Date()) : new Date(),
    };
  }

  addRetentionRule(rule: RetentionRule): void {
    this.retentionRules.set(rule.id, rule);
  }

  getRetentionRule(id: string): RetentionRule | null {
    return this.retentionRules.get(id) || null;
  }

  listRetentionRules(): RetentionRule[] {
    return Array.from(this.retentionRules.values());
  }

  deleteRetentionRule(id: string): boolean {
    return this.retentionRules.delete(id);
  }

  getConfig(): ComplianceConfig {
    return { ...this.config };
  }

  applyRetentionPolicy(): number {
    let deletedCount = 0;

    for (const rule of this.retentionRules.values()) {
      const retentionDays = rule.retentionPeriodDays;
      const events = this.store.getAll();

      for (const event of events) {
        if (rule.dataCategories.length > 0 && event.dataCategory && !rule.dataCategories.includes(event.dataCategory)) {
          continue;
        }

        if (isRetentionExpired(event, retentionDays)) {
          this.store.getAll().splice(this.store.getAll().indexOf(event), 1);
          deletedCount++;
        }
      }
    }

    return deletedCount;
  }

  createDataSubjectRequest(request: Omit<DataSubjectRequest, 'id' | 'requestedAt' | 'status'>): DataSubjectRequest {
    const dataSubjectRequest: DataSubjectRequest = {
      ...request,
      id: generateAuditId('DSR'),
      requestedAt: new Date(),
      status: 'pending',
    };

    this.dataSubjectRequests.set(dataSubjectRequest.id, dataSubjectRequest);

    this.logComplianceEvent({
      action: 'data_subject_request_created',
      resourceType: 'data_subject_request',
      resourceId: dataSubjectRequest.id,
      success: true,
      metadata: { right: request.right, requesterId: request.requesterId },
      framework: 'GDPR',
    });

    return dataSubjectRequest;
  }

  getDataSubjectRequest(id: string): DataSubjectRequest | null {
    return this.dataSubjectRequests.get(id) || null;
  }

  updateDataSubjectRequest(id: string, updates: Partial<DataSubjectRequest>): DataSubjectRequest | null {
    const request = this.dataSubjectRequests.get(id);
    if (!request) {
      return null;
    }

    const updated: DataSubjectRequest = { ...request, ...updates };
    this.dataSubjectRequests.set(id, updated);
    return updated;
  }

  listDataSubjectRequests(filter?: {
    status?: DataSubjectRequest['status'];
    requesterId?: string;
    right?: DataSubjectRight;
  }): DataSubjectRequest[] {
    let results = Array.from(this.dataSubjectRequests.values());

    if (filter?.status) {
      results = results.filter((r) => r.status === filter.status);
    }

    if (filter?.requesterId) {
      results = results.filter((r) => r.requesterId === filter.requesterId);
    }

    if (filter?.right) {
      results = results.filter((r) => r.right === filter.right);
    }

    return results.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  }

  getAccessRecords(filter?: {
    userId?: string;
    resourceType?: string;
    resourceId?: string;
    startTime?: Date;
    endTime?: Date;
  }): AccessRecord[] {
    let results = Array.from(this.accessRecords.values());

    if (filter?.userId) {
      results = results.filter((r) => r.userId === filter.userId);
    }

    if (filter?.resourceType) {
      results = results.filter((r) => r.resourceType === filter.resourceType);
    }

    if (filter?.resourceId) {
      results = results.filter((r) => r.resourceId === filter.resourceId);
    }

    if (filter?.startTime) {
      results = results.filter((r) => r.accessedAt >= filter.startTime!);
    }

    if (filter?.endTime) {
      results = results.filter((r) => r.accessedAt <= filter.endTime!);
    }

    return results.sort((a, b) => b.accessedAt.getTime() - a.accessedAt.getTime());
  }

  generateComplianceReport(
    reportType: ReportType,
    framework: ComplianceFramework,
    periodStart: Date,
    periodEnd: Date
  ): ComplianceReport {
    const filter: AuditFilter = {
      startTime: periodStart,
      endTime: periodEnd,
      framework,
    };

    const events = this.getEvents(filter);
    const stats = this.getStats(filter);

    const eventsByType: Record<AuditEventType, number> = {
      data_access: 0,
      data_modification: 0,
      security_event: 0,
      compliance: 0,
    };

    for (const event of events) {
      eventsByType[event.eventType]++;
    }

    const summary: Record<string, unknown> = {};

    switch (reportType) {
      case 'access_history':
        summary.totalDataAccessEvents = events.filter((e) => e.eventType === 'data_access').length;
        summary.uniqueUsers = new Set(events.filter((e) => e.userId).map((e) => e.userId)).size;
        summary.uniqueResources = new Set(events.filter((e) => e.resourceId).map((e) => e.resourceId)).size;
        break;
      case 'change_log':
        summary.totalModifications = events.filter((e) => e.eventType === 'data_modification').length;
        summary.modificationsByResource = this.groupByResource(events.filter((e) => e.eventType === 'data_modification'));
        break;
      case 'security_events':
        summary.totalSecurityEvents = events.filter((e) => e.eventType === 'security_event').length;
        summary.failedEvents = events.filter((e) => !e.success).length;
        summary.topFailedActions = this.getTopFailedActions(events);
        break;
    }

    return {
      id: generateAuditId('RPT'),
      reportType,
      framework,
      generatedAt: new Date(),
      periodStart,
      periodEnd,
      totalEvents: stats.totalEvents,
      eventsByType,
      summary,
      details: events.slice(0, 1000),
      metadata: {
        generatedBy: 'AuditLogger',
        version: '1.0',
      },
    };
  }

  private groupByResource(events: AuditEvent[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    for (const event of events) {
      const key = `${event.resourceType}:${event.resourceId || 'unknown'}`;
      grouped[key] = (grouped[key] || 0) + 1;
    }
    return grouped;
  }

  private getTopFailedActions(events: AuditEvent[]): Record<string, number> {
    const failedActions: Record<string, number> = {};
    for (const event of events.filter((e) => !e.success)) {
      failedActions[event.action] = (failedActions[event.action] || 0) + 1;
    }
    return Object.fromEntries(Object.entries(failedActions).sort(([, a], [, b]) => b - a).slice(0, 10));
  }

  clear(): void {
    this.store.clear();
    this.accessRecords.clear();
  }

  size(): number {
    return this.store.size();
  }
}

export class ComplianceMonitor {
  private auditLogger: AuditLogger;
  private alertHistory: Array<{ timestamp: Date; alertType: string; message: string }> = [];

  constructor(auditLogger: AuditLogger) {
    this.auditLogger = auditLogger;
  }

  checkThresholds(): { breached: boolean; alerts: string[] } {
    const alerts: string[] = [];
    const config = this.auditLogger.getConfig();

    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentEvents = this.auditLogger.getEvents({
      startTime: oneMinuteAgo,
    });

    if (recentEvents.length > config.alertThresholds.maxEventsPerMinute) {
      alerts.push(`High event rate: ${recentEvents.length} events/min (threshold: ${config.alertThresholds.maxEventsPerMinute})`);
    }

    const failedAuthEvents = recentEvents.filter(
      (e) => e.eventType === 'security_event' && e.action.includes('auth') && !e.success
    );

    if (failedAuthEvents.length > config.alertThresholds.maxFailedAuthPerMinute) {
      alerts.push(`High failed authentication rate: ${failedAuthEvents.length} failed auth/min (threshold: ${config.alertThresholds.maxFailedAuthPerMinute})`);
    }

    return {
      breached: alerts.length > 0,
      alerts,
    };
  }

  validateGdprCompliance(report: ComplianceReport): { compliant: boolean; violations: string[] } {
    const violations: string[] = [];

    if (report.framework !== 'GDPR') {
      violations.push('Report framework is not GDPR');
    }

    const dataAccessEvents = report.details.filter((e) => e.eventType === 'data_access');
    if (dataAccessEvents.length === 0) {
      violations.push('No data access events found in GDPR report');
    }

    const erasureRequests = this.auditLogger
      .listDataSubjectRequests()
      .filter((r) => r.right === 'erasure' && r.status !== 'completed');

    if (erasureRequests.length > 0) {
      violations.push(`${erasureRequests.length} pending erasure requests not fulfilled`);
    }

    return {
      compliant: violations.length === 0,
      violations,
    };
  }

  validateHipaaCompliance(report: ComplianceReport): { compliant: boolean; violations: string[] } {
    const violations: string[] = [];

    if (report.framework !== 'HIPAA') {
      violations.push('Report framework is not HIPAA');
    }

    const phiEvents = report.details.filter((e) => e.dataCategory === 'phi');
    if (phiEvents.length === 0) {
      violations.push('No PHI access events found in HIPAA report');
    }

    return {
      compliant: violations.length === 0,
      violations,
    };
  }

  validateSoc2Compliance(report: ComplianceReport): { compliant: boolean; violations: string[] } {
    const violations: string[] = [];

    if (report.framework !== 'SOC2') {
      violations.push('Report framework is not SOC2');
    }

    const securityEvents = report.details.filter((e) => e.eventType === 'security_event');
    if (securityEvents.length === 0) {
      violations.push('No security events found in SOC2 report');
    }

    return {
      compliant: violations.length === 0,
      violations,
    };
  }

  getAlertHistory(): Array<{ timestamp: Date; alertType: string; message: string }> {
    return [...this.alertHistory];
  }

  clearAlertHistory(): void {
    this.alertHistory = [];
  }
}

export class AuditTrailService {
  logger: AuditLogger;
  monitor: ComplianceMonitor;

  constructor(config?: Partial<ComplianceConfig>) {
    this.logger = new AuditLogger(config);
    this.monitor = new ComplianceMonitor(this.logger);
  }

  logAccess(params: {
    userId: string;
    sessionId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    success?: boolean;
    metadata?: Record<string, unknown>;
    framework?: ComplianceFramework;
    dataCategory?: string;
  }): AuditEvent {
    return this.logger.logDataAccess({
      ...params,
      success: params.success ?? true,
    });
  }

  logModification(params: {
    userId?: string;
    sessionId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    success?: boolean;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
    framework?: ComplianceFramework;
    dataCategory?: string;
  }): AuditEvent {
    return this.logger.logDataModification({
      ...params,
      success: params.success ?? true,
    });
  }

  logSecurity(params: {
    userId?: string;
    sessionId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    success?: boolean;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
    framework?: ComplianceFramework;
  }): AuditEvent {
    return this.logger.logSecurityEvent({
      ...params,
      success: params.success ?? true,
    });
  }

  logCompliance(params: {
    userId?: string;
    sessionId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    success?: boolean;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
    framework: ComplianceFramework;
  }): AuditEvent {
    return this.logger.logComplianceEvent({
      ...params,
      success: params.success ?? true,
    });
  }

  queryEvents(filter?: AuditFilter): AuditEvent[] {
    return this.logger.getEvents(filter);
  }

  getStats(filter?: AuditFilter): AuditStats {
    return this.logger.getStats(filter);
  }

  createRetentionRule(rule: Omit<RetentionRule, 'id'>): RetentionRule {
    const retentionRule: RetentionRule = {
      ...rule,
      id: generateAuditId('RET'),
    };
    this.logger.addRetentionRule(retentionRule);
    return retentionRule;
  }

  applyRetentionPolicy(): number {
    return this.logger.applyRetentionPolicy();
  }

  createDataSubjectRequest(request: Omit<DataSubjectRequest, 'id' | 'requestedAt' | 'status'>): DataSubjectRequest {
    return this.logger.createDataSubjectRequest(request);
  }

  getDataSubjectRequest(id: string): DataSubjectRequest | null {
    return this.logger.getDataSubjectRequest(id);
  }

  updateDataSubjectRequest(id: string, updates: Partial<DataSubjectRequest>): DataSubjectRequest | null {
    return this.logger.updateDataSubjectRequest(id, updates);
  }

  listDataSubjectRequests(filter?: {
    status?: DataSubjectRequest['status'];
    requesterId?: string;
    right?: DataSubjectRight;
  }): DataSubjectRequest[] {
    return this.logger.listDataSubjectRequests(filter);
  }

  generateReport(
    reportType: ReportType,
    framework: ComplianceFramework,
    periodStart: Date,
    periodEnd: Date
  ): ComplianceReport {
    return this.logger.generateComplianceReport(reportType, framework, periodStart, periodEnd);
  }

  getAccessHistory(filter?: {
    userId?: string;
    resourceType?: string;
    resourceId?: string;
    startTime?: Date;
    endTime?: Date;
  }): AccessRecord[] {
    return this.logger.getAccessRecords(filter);
  }

  checkCompliance(): { breached: boolean; alerts: string[] } {
    return this.monitor.checkThresholds();
  }

  validateCompliance(framework: ComplianceFramework, report: ComplianceReport): { compliant: boolean; violations: string[] } {
    switch (framework) {
      case 'GDPR':
        return this.monitor.validateGdprCompliance(report);
      case 'HIPAA':
        return this.monitor.validateHipaaCompliance(report);
      case 'SOC2':
        return this.monitor.validateSoc2Compliance(report);
      default:
        return { compliant: false, violations: ['Unsupported framework'] };
    }
  }

  clear(): void {
    this.logger.clear();
  }
}

export function createAuditTrailService(config?: Partial<ComplianceConfig>): AuditTrailService {
  return new AuditTrailService(config);
}

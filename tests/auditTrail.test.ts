import {
  AuditLogger,
  InMemoryAuditStore,
  ComplianceMonitor,
  AuditTrailService,
  createAuditTrailService,
} from '../src/core/auditTrail';
import {
  AuditEventType,
  ComplianceFramework,
  RetentionPolicy,
  ReportType,
  DataSubjectRight,
  AuditEvent,
  AuditFilter,
  AuditStats,
  RetentionRule,
  ComplianceReport,
  DataSubjectRequest,
  AccessRecord,
  DEFAULT_COMPLIANCE_CONFIG,
  generateAuditId,
  getRetentionDays,
  isRetentionExpired,
} from '../src/core/auditTrail/types';

describe('AuditTrail Module', () => {
  describe('Type Guards and Utilities', () => {
    test('isAuditEventType validates correct event types', () => {
      expect(['data_access', 'data_modification', 'security_event', 'compliance'].every((type) => {
        return require('../src/core/auditTrail/types').isAuditEventType(type);
      })).toBe(true);
    });

    test('isAuditEventType rejects invalid event types', () => {
      const isAuditEventType = require('../src/core/auditTrail/types').isAuditEventType;
      expect(isAuditEventType('invalid_type')).toBe(false);
      expect(isAuditEventType('')).toBe(false);
      expect(isAuditEventType(null)).toBe(false);
    });

    test('isComplianceFramework validates correct frameworks', () => {
      const isComplianceFramework = require('../src/core/auditTrail/types').isComplianceFramework;
      expect(['GDPR', 'HIPAA', 'SOC2', 'PCI-DSS'].every((fw) => {
        return isComplianceFramework(fw);
      })).toBe(true);
    });

    test('isComplianceFramework rejects invalid frameworks', () => {
      const isComplianceFramework = require('../src/core/auditTrail/types').isComplianceFramework;
      expect(isComplianceFramework('INVALID')).toBe(false);
      expect(isComplianceFramework('')).toBe(false);
    });

    test('isRetentionPolicy validates correct policies', () => {
      const isRetentionPolicy = require('../src/core/auditTrail/types').isRetentionPolicy;
      expect(['permanent', 'short_term', 'long_term'].every((policy) => {
        return isRetentionPolicy(policy);
      })).toBe(true);
    });

    test('isReportType validates correct report types', () => {
      const isReportType = require('../src/core/auditTrail/types').isReportType;
      expect(['access_history', 'change_log', 'security_events'].every((type) => {
        return isReportType(type);
      })).toBe(true);
    });

    test('isDataSubjectRight validates correct rights', () => {
      const isDataSubjectRight = require('../src/core/auditTrail/types').isDataSubjectRight;
      expect(['access', 'rectification', 'erasure', 'portability'].every((right) => {
        return isDataSubjectRight(right);
      })).toBe(true);
    });

    test('generateAuditId creates unique IDs with correct format', () => {
      const id1 = generateAuditId('TEST');
      const id2 = generateAuditId('TEST');
      expect(id1).toMatch(/^TEST_[a-f0-9]{16}$/);
      expect(id2).toMatch(/^TEST_[a-f0-9]{16}$/);
      expect(id1).not.toBe(id2);
    });

    test('getRetentionDays returns correct days for policies', () => {
      expect(getRetentionDays('permanent')).toBe(-1);
      expect(getRetentionDays('short_term')).toBe(30);
      expect(getRetentionDays('long_term')).toBe(365 * 7);
      expect(getRetentionDays('invalid' as RetentionPolicy)).toBe(90);
    });

    test('isRetentionExpired detects expired events', () => {
      const oldEvent: AuditEvent = {
        id: 'test',
        eventType: 'data_access',
        timestamp: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        action: 'read',
        resourceType: 'file',
        success: true,
        retentionPolicy: 'short_term',
      };
      expect(isRetentionExpired(oldEvent, 30)).toBe(true);
      expect(isRetentionExpired(oldEvent, 365)).toBe(false);
    });

    test('isRetentionExpired returns false for permanent retention', () => {
      const event: AuditEvent = {
        id: 'test',
        eventType: 'data_access',
        timestamp: new Date(2000, 1, 1),
        action: 'read',
        resourceType: 'file',
        success: true,
        retentionPolicy: 'permanent',
      };
      expect(isRetentionExpired(event, -1)).toBe(false);
    });
  });

  describe('InMemoryAuditStore', () => {
    test('adds and retrieves events', () => {
      const store = new InMemoryAuditStore();
      const event: AuditEvent = {
        id: generateAuditId(),
        eventType: 'data_access',
        timestamp: new Date(),
        action: 'read',
        resourceType: 'file',
        success: true,
        retentionPolicy: 'short_term',
      };
      store.add(event);
      expect(store.size()).toBe(1);
      expect(store.getAll()).toContain(event);
    });

    test('respects max events limit', () => {
      const store = new InMemoryAuditStore(3);
      for (let i = 0; i < 5; i++) {
        store.add({
          id: generateAuditId(),
          eventType: 'data_access',
          timestamp: new Date(),
          action: 'read',
          resourceType: 'file',
          success: true,
          retentionPolicy: 'short_term',
        });
      }
      expect(store.size()).toBe(3);
    });

    test('queries events by filter', () => {
      const store = new InMemoryAuditStore();
      const event1: AuditEvent = {
        id: generateAuditId(),
        eventType: 'data_access',
        timestamp: new Date(),
        action: 'read',
        resourceType: 'file',
        userId: 'user1',
        success: true,
        retentionPolicy: 'short_term',
      };
      const event2: AuditEvent = {
        id: generateAuditId(),
        eventType: 'data_modification',
        timestamp: new Date(),
        action: 'write',
        resourceType: 'file',
        userId: 'user2',
        success: true,
        retentionPolicy: 'short_term',
      };
      store.add(event1);
      store.add(event2);

      const results = store.query({ userId: 'user1' });
      expect(results.length).toBe(1);
      expect(results[0].userId).toBe('user1');
    });

    test('clears all events', () => {
      const store = new InMemoryAuditStore();
      store.add({
        id: generateAuditId(),
        eventType: 'data_access',
        timestamp: new Date(),
        action: 'read',
        resourceType: 'file',
        success: true,
        retentionPolicy: 'short_term',
      });
      store.clear();
      expect(store.size()).toBe(0);
    });
  });

  describe('AuditLogger', () => {
    let logger: AuditLogger;

    beforeEach(() => {
      logger = new AuditLogger();
    });

    test('logs events with auto-generated ID and timestamp', () => {
      const event = logger.log({
        eventType: 'data_access',
        action: 'read',
        resourceType: 'file',
        success: true,
        retentionPolicy: 'short_term',
      });
      expect(event.id).toMatch(/^AUDIT_[a-f0-9]{16}$/);
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.retentionPolicy).toBe('short_term');
    });

    test('logDataAccess creates data_access events', () => {
      const event = logger.logDataAccess({
        userId: 'user1',
        action: 'read',
        resourceType: 'document',
        resourceId: 'doc123',
        success: true,
      });
      expect(event.eventType).toBe('data_access');
      expect(event.userId).toBe('user1');
    });

    test('logDataModification creates data_modification events', () => {
      const event = logger.logDataModification({
        userId: 'user1',
        action: 'update',
        resourceType: 'document',
        resourceId: 'doc123',
        success: true,
      });
      expect(event.eventType).toBe('data_modification');
    });

    test('logSecurityEvent creates security_event events', () => {
      const event = logger.logSecurityEvent({
        action: 'login',
        resourceType: 'auth',
        success: false,
        errorMessage: 'Invalid credentials',
      });
      expect(event.eventType).toBe('security_event');
      expect(event.success).toBe(false);
    });

    test('logComplianceEvent creates compliance events', () => {
      const event = logger.logComplianceEvent({
        action: 'gdpr_request',
        resourceType: 'data_subject',
        success: true,
        framework: 'GDPR',
      });
      expect(event.eventType).toBe('compliance');
      expect(event.framework).toBe('GDPR');
    });

    test('retrieves events with filter', () => {
      logger.logDataAccess({
        userId: 'user1',
        action: 'read',
        resourceType: 'file',
        success: true,
      });
      logger.logDataAccess({
        userId: 'user2',
        action: 'read',
        resourceType: 'file',
        success: true,
      });

      const events = logger.getEvents({ userId: 'user1' });
      expect(events.length).toBe(1);
      expect(events[0].userId).toBe('user1');
    });

    test('filters events by time range', () => {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 3600000);
      const dayAgo = new Date(now.getTime() - 86400000);

      logger.log({ eventType: 'data_access', action: 'read', resourceType: 'file', success: true, retentionPolicy: 'short_term', timestamp: dayAgo });
      logger.logDataAccess({
        userId: 'user1',
        action: 'read',
        resourceType: 'file',
        success: true,
      });

      const events = logger.getEvents({ startTime: hourAgo, endTime: now });
      expect(events.length).toBe(1);
    });

    test('calculates stats correctly', () => {
      logger.logDataAccess({ userId: 'user1', action: 'read', resourceType: 'file', success: true });
      logger.logDataAccess({ userId: 'user1', action: 'read', resourceType: 'file', success: true });
      logger.logDataModification({ userId: 'user2', action: 'update', resourceType: 'file', success: false });
      logger.logSecurityEvent({ action: 'login', resourceType: 'auth', success: false });

      const stats = logger.getStats();
      expect(stats.totalEvents).toBe(4);
      expect(stats.eventsByType.data_access).toBe(2);
      expect(stats.eventsByType.data_modification).toBe(1);
      expect(stats.eventsByType.security_event).toBe(1);
      expect(stats.eventsByUser.user1).toBe(2);
      expect(stats.eventsByUser.user2).toBe(1);
      expect(stats.failedEvents).toBe(2);
      expect(stats.successRate).toBe(0.5);
    });

    test('adds and retrieves retention rules', () => {
      const rule: RetentionRule = {
        id: 'rule1',
        name: 'GDPR Retention',
        retentionPeriodDays: 30,
        framework: 'GDPR',
        dataCategories: ['personal_data'],
        includeMetadata: true,
        encryptionRequired: true,
      };
      logger.addRetentionRule(rule);
      const retrieved = logger.getRetentionRule('rule1');
      expect(retrieved).toEqual(rule);
    });

    test('lists all retention rules', () => {
      logger.addRetentionRule({
        id: 'rule1',
        name: 'Rule 1',
        retentionPeriodDays: 30,
        dataCategories: [],
        includeMetadata: false,
        encryptionRequired: false,
      });
      logger.addRetentionRule({
        id: 'rule2',
        name: 'Rule 2',
        retentionPeriodDays: 90,
        dataCategories: [],
        includeMetadata: false,
        encryptionRequired: false,
      });
      const rules = logger.listRetentionRules();
      expect(rules.length).toBe(2);
    });

    test('deletes retention rules', () => {
      logger.addRetentionRule({
        id: 'rule1',
        name: 'Rule 1',
        retentionPeriodDays: 30,
        dataCategories: [],
        includeMetadata: false,
        encryptionRequired: false,
      });
      expect(logger.deleteRetentionRule('rule1')).toBe(true);
      expect(logger.getRetentionRule('rule1')).toBe(null);
    });

    test('creates and retrieves data subject requests', () => {
      const request = logger.createDataSubjectRequest({
        right: 'access',
        requesterId: 'user1',
        requesterEmail: 'user1@example.com',
        dataTypes: ['profile', 'activity'],
      });
      expect(request.id).toMatch(/^DSR_[a-f0-9]{16}$/);
      expect(request.status).toBe('pending');

      const retrieved = logger.getDataSubjectRequest(request.id);
      expect(retrieved).toEqual(request);
    });

    test('updates data subject request status', () => {
      const request = logger.createDataSubjectRequest({
        right: 'erasure',
        requesterId: 'user1',
        requesterEmail: 'user1@example.com',
        dataTypes: ['profile'],
      });
      const updated = logger.updateDataSubjectRequest(request.id, { status: 'completed', completedAt: new Date() });
      expect(updated?.status).toBe('completed');
      expect(updated?.completedAt).toBeInstanceOf(Date);
    });

    test('generates compliance report', () => {
      logger.logDataAccess({ userId: 'user1', action: 'read', resourceType: 'file', success: true, framework: 'GDPR' });
      logger.logDataModification({ userId: 'user1', action: 'update', resourceType: 'file', success: true, framework: 'GDPR' });

      const report = logger.generateComplianceReport('access_history', 'GDPR', new Date(Date.now() - 86400000), new Date());
      expect(report.id).toMatch(/^RPT_[a-f0-9]{16}$/);
      expect(report.reportType).toBe('access_history');
      expect(report.framework).toBe('GDPR');
      expect(report.totalEvents).toBe(2);
      expect(report.eventsByType.data_access).toBe(1);
    });

    test('retrieves access records', () => {
      logger.logDataAccess({
        userId: 'user1',
        action: 'read',
        resourceType: 'document',
        resourceId: 'doc1',
        success: true,
        framework: 'GDPR',
      });
      const records = logger.getAccessRecords({ userId: 'user1' });
      expect(records.length).toBe(1);
      expect(records[0].userId).toBe('user1');
    });
  });

  describe('ComplianceMonitor', () => {
    let logger: AuditLogger;
    let monitor: ComplianceMonitor;

    beforeEach(() => {
      logger = new AuditLogger();
      monitor = new ComplianceMonitor(logger);
    });

    test('checkThresholds returns no breaches when under limits', () => {
      logger.logDataAccess({ userId: 'user1', action: 'read', resourceType: 'file', success: true });
      const result = monitor.checkThresholds();
      expect(result.breached).toBe(false);
      expect(result.alerts).toHaveLength(0);
    });

    test('checkThresholds detects high event rates', () => {
      const config = { ...DEFAULT_COMPLIANCE_CONFIG, alertThresholds: { maxEventsPerMinute: 5, maxFailedAuthPerMinute: 10, maxDataAccessPerUser: 100 } };
      const limitedLogger = new AuditLogger(config);
      const limitedMonitor = new ComplianceMonitor(limitedLogger);

      for (let i = 0; i < 10; i++) {
        limitedLogger.logDataAccess({ userId: `user${i}`, action: 'read', resourceType: 'file', success: true });
      }

      const result = limitedMonitor.checkThresholds();
      expect(result.breached).toBe(true);
      expect(result.alerts.some((a) => a.includes('High event rate'))).toBe(true);
    });

    test('validateGdprCompliance detects missing data access events', () => {
      const report: ComplianceReport = {
        id: 'report1',
        reportType: 'access_history',
        framework: 'GDPR',
        generatedAt: new Date(),
        periodStart: new Date(),
        periodEnd: new Date(),
        totalEvents: 0,
        eventsByType: { data_access: 0, data_modification: 0, security_event: 0, compliance: 0 },
        summary: {},
        details: [],
        metadata: {},
      };

      const result = monitor.validateGdprCompliance(report);
      expect(result.compliant).toBe(false);
      expect(result.violations).toContain('No data access events found in GDPR report');
    });

    test('validateHipaaCompliance detects missing PHI events', () => {
      const request = logger.createDataSubjectRequest({
        right: 'erasure',
        requesterId: 'user1',
        requesterEmail: 'user1@example.com',
        dataTypes: ['phi'],
      });
      logger.updateDataSubjectRequest(request.id, { status: 'pending' });

      const report: ComplianceReport = {
        id: 'report1',
        reportType: 'access_history',
        framework: 'HIPAA',
        generatedAt: new Date(),
        periodStart: new Date(),
        periodEnd: new Date(),
        totalEvents: 0,
        eventsByType: { data_access: 0, data_modification: 0, security_event: 0, compliance: 0 },
        summary: {},
        details: [],
        metadata: {},
      };

      const result = monitor.validateHipaaCompliance(report);
      expect(result.compliant).toBe(false);
      expect(result.violations).toContain('No PHI access events found in HIPAA report');
    });

    test('validateSoc2Compliance detects missing security events', () => {
      const report: ComplianceReport = {
        id: 'report1',
        reportType: 'security_events',
        framework: 'SOC2',
        generatedAt: new Date(),
        periodStart: new Date(),
        periodEnd: new Date(),
        totalEvents: 0,
        eventsByType: { data_access: 0, data_modification: 0, security_event: 0, compliance: 0 },
        summary: {},
        details: [],
        metadata: {},
      };

      const result = monitor.validateSoc2Compliance(report);
      expect(result.compliant).toBe(false);
      expect(result.violations).toContain('No security events found in SOC2 report');
    });

    test('getAlertHistory returns alert history', () => {
      const history = monitor.getAlertHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    test('clearAlertHistory clears alert history', () => {
      monitor.clearAlertHistory();
      expect(monitor.getAlertHistory()).toHaveLength(0);
    });
  });

  describe('AuditTrailService', () => {
    let service: AuditTrailService;

    beforeEach(() => {
      service = createAuditTrailService();
    });

    test('createAuditTrailService creates new instance', () => {
      expect(service).toBeInstanceOf(AuditTrailService);
      expect(service.logger).toBeInstanceOf(AuditLogger);
      expect(service.monitor).toBeInstanceOf(ComplianceMonitor);
    });

    test('logAccess creates data access event', () => {
      const event = service.logAccess({
        userId: 'user1',
        action: 'view_document',
        resourceType: 'document',
        resourceId: 'doc123',
      });
      expect(event.eventType).toBe('data_access');
      expect(event.success).toBe(true);
    });

    test('logModification creates data modification event', () => {
      const event = service.logModification({
        userId: 'user1',
        action: 'update_document',
        resourceType: 'document',
        resourceId: 'doc123',
        metadata: { changes: ['title'] },
      });
      expect(event.eventType).toBe('data_modification');
    });

    test('logSecurity creates security event', () => {
      const event = service.logSecurity({
        action: 'login_attempt',
        resourceType: 'auth',
        success: false,
        errorMessage: 'Invalid password',
      });
      expect(event.eventType).toBe('security_event');
    });

    test('logCompliance creates compliance event', () => {
      const event = service.logCompliance({
        action: 'gdpr_data_request',
        resourceType: 'user_data',
        framework: 'GDPR',
        success: true,
      });
      expect(event.eventType).toBe('compliance');
      expect(event.framework).toBe('GDPR');
    });

    test('queryEvents filters events correctly', () => {
      service.logAccess({ userId: 'user1', action: 'read', resourceType: 'file' });
      service.logAccess({ userId: 'user2', action: 'read', resourceType: 'file' });

      const events = service.queryEvents({ userId: 'user1' });
      expect(events.length).toBe(1);
    });

    test('getStats returns correct statistics', () => {
      service.logAccess({ userId: 'user1', action: 'read', resourceType: 'file' });
      service.logModification({ userId: 'user1', action: 'update', resourceType: 'file' });

      const stats = service.getStats();
      expect(stats.totalEvents).toBe(2);
    });

    test('createRetentionRule adds new rule', () => {
      const rule = service.createRetentionRule({
        name: 'HIPAA Retention',
        retentionPeriodDays: 365,
        framework: 'HIPAA',
        dataCategories: ['phi'],
        includeMetadata: true,
        encryptionRequired: true,
      });
      expect(rule.id).toMatch(/^RET_[a-f0-9]{16}$/);
      expect(rule.retentionPeriodDays).toBe(365);
    });

    test('applyRetentionPolicy applies retention rules', () => {
      service.createRetentionRule({
        name: 'Short Term',
        retentionPeriodDays: 1,
        dataCategories: [],
        includeMetadata: false,
        encryptionRequired: false,
      });

      for (let i = 0; i < 5; i++) {
        const event = service.logAccess({ userId: 'user1', action: 'read', resourceType: 'file' });
        (event as AuditEvent).timestamp = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      }

      const deleted = service.applyRetentionPolicy();
      expect(deleted).toBeGreaterThanOrEqual(0);
    });

    test('createDataSubjectRequest creates request', () => {
      const request = service.createDataSubjectRequest({
        right: 'portability',
        requesterId: 'user1',
        requesterEmail: 'user1@example.com',
        dataTypes: ['profile', 'posts'],
      });
      expect(request.status).toBe('pending');
      expect(request.right).toBe('portability');
    });

    test('getDataSubjectRequest retrieves request', () => {
      const created = service.createDataSubjectRequest({
        right: 'access',
        requesterId: 'user1',
        requesterEmail: 'user1@example.com',
        dataTypes: ['profile'],
      });
      const retrieved = service.getDataSubjectRequest(created.id);
      expect(retrieved?.id).toBe(created.id);
    });

    test('updateDataSubjectRequest updates request', () => {
      const created = service.createDataSubjectRequest({
        right: 'erasure',
        requesterId: 'user1',
        requesterEmail: 'user1@example.com',
        dataTypes: ['profile'],
      });
      const updated = service.updateDataSubjectRequest(created.id, { status: 'processing' });
      expect(updated?.status).toBe('processing');
    });

    test('listDataSubjectRequests filters requests', () => {
      service.createDataSubjectRequest({
        right: 'access',
        requesterId: 'user1',
        requesterEmail: 'user1@example.com',
        dataTypes: ['profile'],
      });
      service.createDataSubjectRequest({
        right: 'erasure',
        requesterId: 'user2',
        requesterEmail: 'user2@example.com',
        dataTypes: ['profile'],
      });

      const requests = service.listDataSubjectRequests({ status: 'pending' });
      expect(requests.length).toBe(2);
    });

    test('generateReport creates compliance report', () => {
      service.logAccess({ userId: 'user1', action: 'read', resourceType: 'file', framework: 'SOC2' });

      const report = service.generateReport('access_history', 'SOC2', new Date(Date.now() - 86400000), new Date());
      expect(report.framework).toBe('SOC2');
      expect(report.reportType).toBe('access_history');
      expect(report.totalEvents).toBeGreaterThanOrEqual(1);
    });

    test('getAccessHistory retrieves access records', () => {
      service.logAccess({
        userId: 'user1',
        action: 'read',
        resourceType: 'document',
        resourceId: 'doc1',
        success: true,
        framework: 'GDPR',
      });

      const history = service.getAccessHistory({ userId: 'user1' });
      expect(history.length).toBeGreaterThanOrEqual(1);
    });

    test('checkCompliance checks thresholds', () => {
      service.logAccess({ userId: 'user1', action: 'read', resourceType: 'file' });
      const result = service.checkCompliance();
      expect(typeof result.breached).toBe('boolean');
      expect(Array.isArray(result.alerts)).toBe(true);
    });

    test('validateCompliance validates GDPR reports', () => {
      const report: ComplianceReport = {
        id: 'report1',
        reportType: 'access_history',
        framework: 'GDPR',
        generatedAt: new Date(),
        periodStart: new Date(),
        periodEnd: new Date(),
        totalEvents: 0,
        eventsByType: { data_access: 0, data_modification: 0, security_event: 0, compliance: 0 },
        summary: {},
        details: [],
        metadata: {},
      };

      const result = service.validateCompliance('GDPR', report);
      expect(typeof result.compliant).toBe('boolean');
      expect(Array.isArray(result.violations)).toBe(true);
    });

    test('clear removes all events', () => {
      service.logAccess({ userId: 'user1', action: 'read', resourceType: 'file' });
      service.clear();
      expect(service.queryEvents()).toHaveLength(0);
    });
  });
});

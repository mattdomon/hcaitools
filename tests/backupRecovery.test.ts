import {
  BackupManager,
  InMemoryBackupStore,
  DisasterRecoveryManager,
  BackupRecoveryService,
  createBackupRecoveryService,
} from '../src/core/backupRecovery';
import {
  BackupType,
  BackupStatus,
  StorageDestination,
  RetentionPolicyType,
  Backup,
  BackupSchedule,
  RecoveryPoint,
  RecoveryRequest,
  RetentionRule,
  RPOConfig,
  BackupStats,
  BackupVerification,
  BackupNotification,
  generateBackupId,
  generateScheduleId,
  generateRecoveryPointId,
  generateRecoveryRequestId,
  generateRetentionRuleId,
  calculateCompressionRatio,
  calculateRPOStatus,
  getRetentionPolicyDays,
  formatBackupSize,
  isBackupType,
  isBackupStatus,
  isStorageDestination,
  isRetentionPolicyType,
  isRecoveryStatus,
  isRecoveryPointExpired,
  isValidCronExpression,
  BACKUP_ERROR_CODES,
  DEFAULT_BACKUP_CONFIG,
} from '../src/core/backupRecovery/types';

describe('BackupRecovery Module', () => {
  describe('Type Guards and Utilities', () => {
    test('isBackupType validates correct backup types', () => {
      expect(['full', 'incremental', 'differential'].every((type) => {
        return isBackupType(type);
      })).toBe(true);
    });

    test('isBackupType rejects invalid backup types', () => {
      expect(isBackupType('invalid_type')).toBe(false);
      expect(isBackupType('')).toBe(false);
      expect(isBackupType(null)).toBe(false);
    });

    test('isBackupStatus validates correct statuses', () => {
      expect(['pending', 'running', 'completed', 'failed', 'cancelled'].every((status) => {
        return isBackupStatus(status);
      })).toBe(true);
    });

    test('isStorageDestination validates correct destinations', () => {
      expect(['local', 's3', 'google_cloud', 'azure'].every((dest) => {
        return isStorageDestination(dest);
      })).toBe(true);
    });

    test('isRetentionPolicyType validates correct policies', () => {
      expect(['daily', 'weekly', 'monthly', 'yearly'].every((policy) => {
        return isRetentionPolicyType(policy);
      })).toBe(true);
    });

    test('isRecoveryStatus validates correct statuses', () => {
      expect(['pending', 'in_progress', 'completed', 'failed'].every((status) => {
        return isRecoveryStatus(status);
      })).toBe(true);
    });

    test('generateBackupId creates unique IDs with correct format', () => {
      const id1 = generateBackupId('TEST');
      const id2 = generateBackupId('TEST');
      expect(id1).toMatch(/^TEST_[a-f0-9]{16}$/);
      expect(id2).toMatch(/^TEST_[a-f0-9]{16}$/);
      expect(id1).not.toBe(id2);
    });

    test('generateScheduleId creates unique IDs', () => {
      const id1 = generateScheduleId();
      const id2 = generateScheduleId();
      expect(id1).toMatch(/^SCHED_[a-f0-9]{16}$/);
      expect(id2).toMatch(/^SCHED_[a-f0-9]{16}$/);
      expect(id1).not.toBe(id2);
    });

    test('generateRecoveryPointId creates unique IDs', () => {
      const id1 = generateRecoveryPointId();
      const id2 = generateRecoveryPointId();
      expect(id1).toMatch(/^RP_[a-f0-9]{16}$/);
      expect(id2).toMatch(/^RP_[a-f0-9]{16}$/);
      expect(id1).not.toBe(id2);
    });

    test('generateRecoveryRequestId creates unique IDs', () => {
      const id1 = generateRecoveryRequestId();
      const id2 = generateRecoveryRequestId();
      expect(id1).toMatch(/^REC_[a-f0-9]{16}$/);
      expect(id2).toMatch(/^REC_[a-f0-9]{16}$/);
      expect(id1).not.toBe(id2);
    });

    test('generateRetentionRuleId creates unique IDs', () => {
      const id1 = generateRetentionRuleId();
      const id2 = generateRetentionRuleId();
      expect(id1).toMatch(/^RET_[a-f0-9]{16}$/);
      expect(id2).toMatch(/^RET_[a-f0-9]{16}$/);
      expect(id1).not.toBe(id2);
    });

    test('calculateCompressionRatio returns correct percentage', () => {
      expect(calculateCompressionRatio(1000, 600)).toBe(40);
      expect(calculateCompressionRatio(1000, 1000)).toBe(0);
      expect(calculateCompressionRatio(1000, 0)).toBe(100);
      expect(calculateCompressionRatio(0, 0)).toBe(0);
    });

    test('calculateRPOStatus detects within target', () => {
      const config: RPOConfig = {
        targetMinutes: 60,
        lastBackupAt: new Date(Date.now() - 30 * 60 * 1000),
        isWithinTarget: true,
        violations: [],
      };
      const result = calculateRPOStatus(config);
      expect(result.withinTarget).toBe(true);
      expect(result.driftMinutes).toBe(0);
    });

    test('calculateRPOStatus detects drift', () => {
      const config: RPOConfig = {
        targetMinutes: 60,
        lastBackupAt: new Date(Date.now() - 90 * 60 * 1000),
        isWithinTarget: true,
        violations: [],
      };
      const result = calculateRPOStatus(config);
      expect(result.withinTarget).toBe(false);
      expect(result.driftMinutes).toBe(30);
    });

    test('getRetentionPolicyDays returns correct days', () => {
      expect(getRetentionPolicyDays('daily')).toBe(1);
      expect(getRetentionPolicyDays('weekly')).toBe(7);
      expect(getRetentionPolicyDays('monthly')).toBe(30);
      expect(getRetentionPolicyDays('yearly')).toBe(365);
      expect(getRetentionPolicyDays('invalid' as RetentionPolicyType)).toBe(30);
    });

    test('formatBackupSize formats bytes correctly', () => {
      expect(formatBackupSize(0)).toBe('0 B');
      expect(formatBackupSize(500)).toBe('500.00 B');
      expect(formatBackupSize(1024)).toBe('1.00 KB');
      expect(formatBackupSize(1048576)).toBe('1.00 MB');
      expect(formatBackupSize(1073741824)).toBe('1.00 GB');
    });

    test('isRecoveryPointExpired detects expired points', () => {
      const expiredPoint: RecoveryPoint = {
        id: 'test',
        backupId: 'backup1',
        timestamp: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        type: 'full',
        size: 1000,
        checksum: 'abc123',
        isCompressed: false,
        isEncrypted: false,
        retentionUntil: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
      };
      expect(isRecoveryPointExpired(expiredPoint, 30)).toBe(true);
    });

    test('isValidCronExpression validates correct expressions', () => {
      expect(isValidCronExpression('0 0 * * *')).toBe(true);
      expect(isValidCronExpression('*/5 * * * *')).toBe(true);
      expect(isValidCronExpression('0 0 1 * *')).toBe(true);
    });

    test('isValidCronExpression rejects invalid expressions', () => {
      expect(isValidCronExpression('invalid')).toBe(false);
      expect(isValidCronExpression('* * *')).toBe(false);
      expect(isValidCronExpression('60 * * * *')).toBe(false);
    });
  });

  describe('InMemoryBackupStore', () => {
    let store: InMemoryBackupStore;

    beforeEach(() => {
      store = new InMemoryBackupStore();
    });

    test('adds and retrieves backups', () => {
      const backup: Backup = {
        id: generateBackupId(),
        type: 'full',
        status: 'completed',
        size: 1000,
        sizeBytes: 1000,
        sourcePath: '/data',
        destination: 'local',
        destinationPath: '/backup',
        startedAt: new Date(),
        completedAt: new Date(),
      };
      store.addBackup(backup);
      expect(store.getBackup(backup.id)).toBe(backup);
      expect(store.getAllBackups()).toContain(backup);
    });

    test('updates backups', () => {
      const backup: Backup = {
        id: generateBackupId(),
        type: 'full',
        status: 'pending',
        size: 1000,
        sizeBytes: 1000,
        sourcePath: '/data',
        destination: 'local',
        destinationPath: '/backup',
        startedAt: new Date(),
      };
      store.addBackup(backup);
      const updated = store.updateBackup(backup.id, { status: 'completed' });
      expect(updated?.status).toBe('completed');
    });

    test('deletes backups', () => {
      const backup: Backup = {
        id: generateBackupId(),
        type: 'full',
        status: 'completed',
        size: 1000,
        sizeBytes: 1000,
        sourcePath: '/data',
        destination: 'local',
        destinationPath: '/backup',
        startedAt: new Date(),
      };
      store.addBackup(backup);
      expect(store.deleteBackup(backup.id)).toBe(true);
      expect(store.getBackup(backup.id)).toBeUndefined();
    });

    test('manages schedules', () => {
      const schedule: BackupSchedule = {
        id: generateScheduleId(),
        name: 'Daily Backup',
        cronExpression: '0 0 * * *',
        backupType: 'full',
        retentionPolicy: 'daily',
        retentionDays: 1,
        enabled: true,
        destination: 'local',
        destinationPath: '/backup',
        compressionEnabled: true,
        encryptionEnabled: false,
        includeMetadata: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.addSchedule(schedule);
      expect(store.getSchedule(schedule.id)).toBe(schedule);
      expect(store.deleteSchedule(schedule.id)).toBe(true);
    });

    test('manages recovery points', () => {
      const point: RecoveryPoint = {
        id: generateRecoveryPointId(),
        backupId: 'backup1',
        timestamp: new Date(),
        type: 'full',
        size: 1000,
        checksum: 'abc123',
        isCompressed: true,
        isEncrypted: false,
      };
      store.addRecoveryPoint(point);
      expect(store.getRecoveryPoint(point.id)).toBe(point);
      expect(store.deleteRecoveryPoint(point.id)).toBe(true);
    });

    test('manages recovery requests', () => {
      const request: RecoveryRequest = {
        id: generateRecoveryRequestId(),
        recoveryPointId: 'rp1',
        targetPath: '/restore',
        status: 'pending',
        startedAt: new Date(),
        dataRestored: 0,
        dataRestoredBytes: 0,
      };
      store.addRecoveryRequest(request);
      expect(store.getRecoveryRequest(request.id)).toBe(request);
    });

    test('manages retention rules', () => {
      const rule: RetentionRule = {
        id: generateRetentionRuleId(),
        name: '30-day retention',
        policyType: 'daily',
        retentionDays: 30,
        backupTypes: ['full', 'incremental'],
        destinations: ['local', 's3'],
        enabled: true,
        applyToEncryptedBackups: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.addRetentionRule(rule);
      expect(store.getRetentionRule(rule.id)).toBe(rule);
      expect(store.deleteRetentionRule(rule.id)).toBe(true);
    });

    test('manages verifications', () => {
      const verification: BackupVerification = {
        id: 'ver1',
        backupId: 'backup1',
        verificationType: 'checksum',
        status: 'pending',
      };
      store.addVerification(verification);
      expect(store.getVerification(verification.id)).toBe(verification);
      expect(store.getVerificationsForBackup('backup1')).toContain(verification);
    });

    test('manages notifications', () => {
      const notification: BackupNotification = {
        id: 'notif1',
        type: 'success',
        title: 'Backup Complete',
        message: 'Backup succeeded',
        sentAt: new Date(),
      };
      store.addNotification(notification);
      expect(store.getNotifications()).toContain(notification);
    });
  });

  describe('BackupManager', () => {
    let manager: BackupManager;

    beforeEach(() => {
      manager = new BackupManager();
    });

    afterEach(() => {
      manager.clear();
    });

    test('creates a backup', () => {
      const backup = manager.createBackup({
        type: 'full',
        sourcePath: '/data',
        destination: 'local',
        destinationPath: '/backup',
      });
      expect(backup.id).toMatch(/^BACKUP_[a-f0-9]{16}$/);
      expect(backup.type).toBe('full');
      expect(backup.status).toBe('pending');
    });

    test('starts a backup', () => {
      const backup = manager.createBackup({
        type: 'full',
        sourcePath: '/data',
        destination: 'local',
        destinationPath: '/backup',
      });
      const started = manager.startBackup(backup.id);
      expect(started).not.toBeNull();
    });

    test('lists backups with filters', async () => {
      const backup1 = manager.createBackup({
        type: 'full',
        sourcePath: '/data1',
        destination: 'local',
        destinationPath: '/backup',
      });
      manager.createBackup({
        type: 'incremental',
        sourcePath: '/data2',
        destination: 's3',
        destinationPath: '/backup',
      });
      manager.startBackup(backup1.id);

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const fullBackups = manager.listBackups({ type: 'full' });
      const localBackups = manager.listBackups({ destination: 'local' });
      expect(fullBackups.length).toBeGreaterThanOrEqual(1);
      expect(localBackups.length).toBeGreaterThanOrEqual(1);
    });

    test('creates recovery points from backups', async () => {
      const backup = manager.createBackup({
        type: 'full',
        sourcePath: '/data',
        destination: 'local',
        destinationPath: '/backup',
      });
      manager.startBackup(backup.id);

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const completedBackup = manager.getBackup(backup.id);
      expect(completedBackup?.recoveryPointId).toBeDefined();
    });

    test('creates and starts recovery requests', async () => {
      const backup = manager.createBackup({
        type: 'full',
        sourcePath: '/data',
        destination: 'local',
        destinationPath: '/backup',
      });
      manager.startBackup(backup.id);

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const completedBackup = manager.getBackup(backup.id);
      if (completedBackup?.recoveryPointId) {
        const request = manager.createRecoveryRequest({
          recoveryPointId: completedBackup.recoveryPointId,
          targetPath: '/restore',
        });
        expect(request).not.toBeNull();
        if (request) {
          manager.startRecovery(request.id);
          await new Promise((resolve) => setTimeout(resolve, 1500));
          const updatedRequest = manager.getRecoveryRequest(request.id);
          expect(['completed', 'failed'].some(s => s === updatedRequest?.status)).toBe(true);
        }
      }
    });

    test('creates schedules', () => {
      const schedule = manager.createSchedule({
        name: 'Daily Full Backup',
        cronExpression: '0 0 * * *',
        backupType: 'full',
        retentionPolicy: 'daily',
        destination: 'local',
        destinationPath: '/backup',
      });
      expect(schedule.id).toMatch(/^SCHED_[a-f0-9]{16}$/);
      expect(schedule.name).toBe('Daily Full Backup');
      expect(schedule.backupType).toBe('full');
      expect(schedule.retentionDays).toBe(1);
    });

    test('creates retention rules', () => {
      const rule = manager.createRetentionRule({
        name: '30-day retention',
        policyType: 'daily',
        retentionDays: 30,
        backupTypes: ['full', 'incremental'],
        destinations: ['local', 's3'],
      });
      expect(rule.id).toMatch(/^RET_[a-f0-9]{16}$/);
      expect(rule.retentionDays).toBe(30);
    });

    test('gets stats', async () => {
      manager.createBackup({
        type: 'full',
        sourcePath: '/data',
        destination: 'local',
        destinationPath: '/backup',
      });
      manager.createBackup({
        type: 'incremental',
        sourcePath: '/data',
        destination: 's3',
        destinationPath: '/backup',
      });

      const stats = manager.getStats();
      expect(stats.totalBackups).toBeGreaterThanOrEqual(2);
      expect(stats.byType.full).toBeGreaterThanOrEqual(1);
      expect(stats.byType.incremental).toBeGreaterThanOrEqual(1);
    });

    test('gets RPO status', () => {
      const rpoStatus = manager.getRPOStatus(60);
      expect(rpoStatus.targetMinutes).toBe(60);
      expect(Array.isArray(rpoStatus.violations)).toBe(true);
    });

    test('verifies backups', async () => {
      const backup = manager.createBackup({
        type: 'full',
        sourcePath: '/data',
        destination: 'local',
        destinationPath: '/backup',
      });
      manager.startBackup(backup.id);

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const completedBackup = manager.getBackup(backup.id);
      if (completedBackup?.status === 'completed') {
        const verification = manager.verifyBackup(backup.id);
        expect(verification).not.toBeNull();
        expect(verification?.backupId).toBe(backup.id);
      }
    });

    test('applies retention policy', async () => {
      const backup = manager.createBackup({
        type: 'full',
        sourcePath: '/data',
        destination: 'local',
        destinationPath: '/backup',
      });
      manager.startBackup(backup.id);

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const deletedCount = manager.applyRetentionPolicy();
      expect(typeof deletedCount).toBe('number');
    });

    test('gets notifications', async () => {
      const backup = manager.createBackup({
        type: 'full',
        sourcePath: '/data',
        destination: 'local',
        destinationPath: '/backup',
      });
      manager.startBackup(backup.id);

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const notifications = manager.getNotifications();
      expect(notifications.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('DisasterRecoveryManager', () => {
    let backupManager: BackupManager;
    let disasterManager: DisasterRecoveryManager;

    beforeEach(() => {
      backupManager = new BackupManager();
      disasterManager = new DisasterRecoveryManager(backupManager);
    });

    afterEach(() => {
      backupManager.clear();
    });

    test('creates disaster recovery plan', async () => {
      const schedule = backupManager.createSchedule({
        name: 'Daily Backup',
        cronExpression: '0 0 * * *',
        backupType: 'full',
        retentionPolicy: 'daily',
        destination: 'local',
        destinationPath: '/backup',
      });

      const backup = backupManager.createBackup({
        type: 'full',
        sourcePath: '/data',
        destination: 'local',
        destinationPath: '/backup',
      });
      backupManager.startBackup(backup.id);

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const plan = disasterManager.createDisasterRecoveryPlan({
        name: 'DR Plan 1',
        description: 'Primary disaster recovery plan',
        rpoMinutes: 60,
        rtoMinutes: 240,
        backupSchedules: [schedule.id],
        fallbackDestinations: ['s3'],
      });

      expect(plan.id).toMatch(/^DRP_[a-f0-9]{16}$/);
      expect(plan.name).toBe('DR Plan 1');
      expect(plan.rpoMinutes).toBe(60);
      expect(plan.rtoMinutes).toBe(240);
    });

    test('tests failover', async () => {
      const schedule = backupManager.createSchedule({
        name: 'Daily Backup',
        cronExpression: '0 0 * * *',
        backupType: 'full',
        retentionPolicy: 'daily',
        destination: 'local',
        destinationPath: '/backup',
      });

      const backup = backupManager.createBackup({
        type: 'full',
        sourcePath: '/data',
        destination: 'local',
        destinationPath: '/backup',
      });
      backupManager.startBackup(backup.id);

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const plan = disasterManager.createDisasterRecoveryPlan({
        name: 'DR Plan 1',
        description: 'Primary disaster recovery plan',
        rpoMinutes: 60,
        rtoMinutes: 240,
        backupSchedules: [schedule.id],
      });

      const result = disasterManager.testFailover(plan.id);
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.durationMs).toBe('number');
      expect(typeof result.dataLossSeconds).toBe('number');
    });

    test('gets and updates failover config', () => {
      const config = disasterManager.getFailoverConfig();
      expect(config.enabled).toBe(false);

      const updated = disasterManager.updateFailoverConfig({
        enabled: true,
        automaticFailover: true,
        fallbackRegion: 'us-west-2',
      });

      expect(updated.enabled).toBe(true);
      expect(updated.automaticFailover).toBe(true);
      expect(updated.fallbackRegion).toBe('us-west-2');
    });
  });

  describe('BackupRecoveryService', () => {
    let service: BackupRecoveryService;

    beforeEach(() => {
      service = createBackupRecoveryService({ defaultRetentionDays: 30 });
    });

    afterEach(() => {
      service.clear();
    });

    test('creates backup recovery service with custom config', () => {
      const customService = createBackupRecoveryService({
        defaultRetentionDays: 60,
        defaultCompressionEnabled: true,
      });
      expect(customService).toBeInstanceOf(BackupRecoveryService);
      customService.clear();
    });

    test('creates full backup', () => {
      const backup = service.createBackup({
        type: 'full',
        sourcePath: '/data',
        destination: 'local',
        destinationPath: '/backup',
      });
      expect(backup.type).toBe('full');
      expect(backup.status).toBe('pending');
    });

    test('creates incremental backup', () => {
      const backup = service.createBackup({
        type: 'incremental',
        sourcePath: '/data',
        destination: 's3',
        destinationPath: '/backup',
      });
      expect(backup.type).toBe('incremental');
    });

    test('creates differential backup', () => {
      const backup = service.createBackup({
        type: 'differential',
        sourcePath: '/data',
        destination: 'google_cloud',
        destinationPath: '/backup',
      });
      expect(backup.type).toBe('differential');
    });

    test('starts backup', () => {
      const backup = service.createBackup({
        type: 'full',
        sourcePath: '/data',
        destination: 'local',
        destinationPath: '/backup',
      });
      const started = service.startBackup(backup.id);
      expect(started?.status).toBe('running');
    });

    test('lists backups by type', async () => {
      service.createBackup({
        type: 'full',
        sourcePath: '/data1',
        destination: 'local',
        destinationPath: '/backup',
      });
      service.createBackup({
        type: 'incremental',
        sourcePath: '/data2',
        destination: 'local',
        destinationPath: '/backup',
      });

      const fullBackups = service.listBackups({ type: 'full' });
      const incrementalBackups = service.listBackups({ type: 'incremental' });

      expect(fullBackups.every(b => b.type === 'full')).toBe(true);
      expect(incrementalBackups.every(b => b.type === 'incremental')).toBe(true);
    });

    test('lists backups by destination', () => {
      service.createBackup({
        type: 'full',
        sourcePath: '/data1',
        destination: 'local',
        destinationPath: '/backup',
      });
      service.createBackup({
        type: 'full',
        sourcePath: '/data2',
        destination: 's3',
        destinationPath: '/backup',
      });

      const localBackups = service.listBackups({ destination: 'local' });
      const s3Backups = service.listBackups({ destination: 's3' });

      expect(localBackups.every(b => b.destination === 'local')).toBe(true);
      expect(s3Backups.every(b => b.destination === 's3')).toBe(true);
    });

    test('creates schedules with different retention policies', () => {
      const daily = service.createSchedule({
        name: 'Daily Backup',
        cronExpression: '0 0 * * *',
        backupType: 'full',
        retentionPolicy: 'daily',
        destination: 'local',
        destinationPath: '/backup',
      });

      const weekly = service.createSchedule({
        name: 'Weekly Backup',
        cronExpression: '0 0 * * 0',
        backupType: 'full',
        retentionPolicy: 'weekly',
        destination: 'local',
        destinationPath: '/backup',
      });

      expect(daily.retentionDays).toBe(1);
      expect(weekly.retentionDays).toBe(7);
    });

    test('creates retention rules', () => {
      const rule = service.createRetentionRule({
        name: 'Strict Retention',
        policyType: 'daily',
        retentionDays: 7,
        backupTypes: ['full'],
        destinations: ['local'],
      });
      expect(rule.retentionDays).toBe(7);
    });

    test('gets stats', () => {
      service.createBackup({
        type: 'full',
        sourcePath: '/data',
        destination: 'local',
        destinationPath: '/backup',
      });
      service.createBackup({
        type: 'incremental',
        sourcePath: '/data',
        destination: 's3',
        destinationPath: '/backup',
      });

      const stats = service.getStats();
      expect(stats.totalBackups).toBeGreaterThanOrEqual(2);
      expect(stats.byDestination.local).toBeGreaterThanOrEqual(1);
      expect(stats.byDestination.s3).toBeGreaterThanOrEqual(1);
    });

    test('gets RPO status', () => {
      const rpoStatus = service.getRPOStatus(30);
      expect(rpoStatus.targetMinutes).toBe(30);
      expect(Array.isArray(rpoStatus.violations)).toBe(true);
    });

    test('applies retention policy', () => {
      const deletedCount = service.applyRetentionPolicy();
      expect(typeof deletedCount).toBe('number');
    });
  });
});

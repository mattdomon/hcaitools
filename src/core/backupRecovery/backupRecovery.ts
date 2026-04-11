import {
  Backup,
  BackupType,
  BackupStatus,
  BackupSchedule,
  RecoveryPoint,
  RecoveryRequest,
  RetentionRule,
  BackupConfig,
  DEFAULT_BACKUP_CONFIG,
  BackupStats,
  RPOConfig,
  BackupVerification,
  BackupNotification,
  DisasterRecoveryPlan,
  FailoverConfig,
  StorageDestination,
  RetentionPolicyType,
  generateBackupId,
  generateScheduleId,
  generateRecoveryPointId,
  generateRecoveryRequestId,
  generateRetentionRuleId,
  calculateCompressionRatio,
  calculateRPOStatus,
  getRetentionPolicyDays,
} from './types';

function generateRandomHex(length: number): string {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export class InMemoryBackupStore {
  private backups: Map<string, Backup> = new Map();
  private schedules: Map<string, BackupSchedule> = new Map();
  private recoveryPoints: Map<string, RecoveryPoint> = new Map();
  private recoveryRequests: Map<string, RecoveryRequest> = new Map();
  private retentionRules: Map<string, RetentionRule> = new Map();
  private verifications: Map<string, BackupVerification> = new Map();
  private notifications: BackupNotification[] = [];

  addBackup(backup: Backup): void {
    this.backups.set(backup.id, backup);
  }

  getBackup(id: string): Backup | undefined {
    return this.backups.get(id);
  }

  getAllBackups(): Backup[] {
    return Array.from(this.backups.values());
  }

  updateBackup(id: string, updates: Partial<Backup>): Backup | undefined {
    const backup = this.backups.get(id);
    if (!backup) return undefined;
    const updated = { ...backup, ...updates };
    this.backups.set(id, updated);
    return updated;
  }

  deleteBackup(id: string): boolean {
    return this.backups.delete(id);
  }

  addSchedule(schedule: BackupSchedule): void {
    this.schedules.set(schedule.id, schedule);
  }

  getSchedule(id: string): BackupSchedule | undefined {
    return this.schedules.get(id);
  }

  getAllSchedules(): BackupSchedule[] {
    return Array.from(this.schedules.values());
  }

  updateSchedule(id: string, updates: Partial<BackupSchedule>): BackupSchedule | undefined {
    const schedule = this.schedules.get(id);
    if (!schedule) return undefined;
    const updated = { ...schedule, ...updates, updatedAt: new Date() };
    this.schedules.set(id, updated);
    return updated;
  }

  deleteSchedule(id: string): boolean {
    return this.schedules.delete(id);
  }

  addRecoveryPoint(point: RecoveryPoint): void {
    this.recoveryPoints.set(point.id, point);
  }

  getRecoveryPoint(id: string): RecoveryPoint | undefined {
    return this.recoveryPoints.get(id);
  }

  getAllRecoveryPoints(): RecoveryPoint[] {
    return Array.from(this.recoveryPoints.values());
  }

  deleteRecoveryPoint(id: string): boolean {
    return this.recoveryPoints.delete(id);
  }

  addRecoveryRequest(request: RecoveryRequest): void {
    this.recoveryRequests.set(request.id, request);
  }

  getRecoveryRequest(id: string): RecoveryRequest | undefined {
    return this.recoveryRequests.get(id);
  }

  getAllRecoveryRequests(): RecoveryRequest[] {
    return Array.from(this.recoveryRequests.values());
  }

  updateRecoveryRequest(id: string, updates: Partial<RecoveryRequest>): RecoveryRequest | undefined {
    const request = this.recoveryRequests.get(id);
    if (!request) return undefined;
    const updated = { ...request, ...updates };
    this.recoveryRequests.set(id, updated);
    return updated;
  }

  addRetentionRule(rule: RetentionRule): void {
    this.retentionRules.set(rule.id, rule);
  }

  getRetentionRule(id: string): RetentionRule | undefined {
    return this.retentionRules.get(id);
  }

  getAllRetentionRules(): RetentionRule[] {
    return Array.from(this.retentionRules.values());
  }

  updateRetentionRule(id: string, updates: Partial<RetentionRule>): RetentionRule | undefined {
    const rule = this.retentionRules.get(id);
    if (!rule) return undefined;
    const updated = { ...rule, ...updates, updatedAt: new Date() };
    this.retentionRules.set(id, updated);
    return updated;
  }

  deleteRetentionRule(id: string): boolean {
    return this.retentionRules.delete(id);
  }

  addVerification(verification: BackupVerification): void {
    this.verifications.set(verification.id, verification);
  }

  getVerification(id: string): BackupVerification | undefined {
    return this.verifications.get(id);
  }

  getVerificationsForBackup(backupId: string): BackupVerification[] {
    return Array.from(this.verifications.values()).filter((v) => v.backupId === backupId);
  }

  addNotification(notification: BackupNotification): void {
    this.notifications.push(notification);
  }

  getNotifications(): BackupNotification[] {
    return [...this.notifications];
  }

  clear(): void {
    this.backups.clear();
    this.schedules.clear();
    this.recoveryPoints.clear();
    this.recoveryRequests.clear();
    this.retentionRules.clear();
    this.verifications.clear();
    this.notifications = [];
  }
}

export class BackupManager {
  private store: InMemoryBackupStore;
  private config: BackupConfig;
  private runningBackups: Set<string> = new Set();
  private activeSchedules: Map<string, NodeJS.Timeout> = new Map();

  constructor(store?: InMemoryBackupStore, config?: Partial<BackupConfig>) {
    this.store = store || new InMemoryBackupStore();
    this.config = { ...DEFAULT_BACKUP_CONFIG, ...config };
  }

  createBackup(params: {
    type: BackupType;
    sourcePath: string;
    destination: StorageDestination;
    destinationPath: string;
    scheduleId?: string;
    parentBackupId?: string;
    compressionEnabled?: boolean;
    encryptionEnabled?: boolean;
    metadata?: Record<string, unknown>;
  }): Backup {
    const backup: Backup = {
      id: generateBackupId(),
      scheduleId: params.scheduleId,
      type: params.type,
      status: 'pending',
      size: 0,
      sizeBytes: 0,
      sourcePath: params.sourcePath,
      destination: params.destination,
      destinationPath: params.destinationPath,
      startedAt: new Date(),
      parentBackupId: params.parentBackupId,
      metadata: params.metadata,
      compressionEnabled: params.compressionEnabled ?? this.config.defaultCompressionEnabled,
      encryptionEnabled: params.encryptionEnabled ?? this.config.defaultEncryptionEnabled,
    };

    this.store.addBackup(backup);
    return backup;
  }

  startBackup(backupId: string): Backup | null {
    const backup = this.store.getBackup(backupId);
    if (!backup) return null;
    if (this.runningBackups.size >= this.config.maxParallelBackups) {
      throw new Error('Maximum concurrent backups reached');
    }

    backup.status = 'running';
    this.runningBackups.add(backupId);
    this.store.updateBackup(backupId, { status: 'running' });

    setTimeout(() => {
      this.completeBackup(backupId);
    }, Math.random() * 1000 + 500);

    return this.store.updateBackup(backupId, { status: 'running' }) || null;
  }

  private completeBackup(backupId: string): void {
    const backup = this.store.getBackup(backupId);
    if (!backup) return;

    const simulatedSuccess = Math.random() > 0.05;
    if (simulatedSuccess) {
      const originalSize = Math.floor(Math.random() * 1000000) + 100000;
      const compressedSize = Math.floor(originalSize * 0.6);
      const sizeBytes = originalSize;
      const compressedSizeBytes = backup.compressionEnabled ? compressedSize : originalSize;

      backup.status = 'completed';
      backup.sizeBytes = sizeBytes;
      backup.compressedSizeBytes = compressedSizeBytes;
      backup.size = sizeBytes;
      backup.completedAt = new Date();
      backup.durationMs = (backup.completedAt.getTime() - backup.startedAt.getTime());
      backup.checksum = generateRandomHex(16);

      if (backup.type === 'incremental' && backup.parentBackupId) {
        backup.incrementalChangesCount = Math.floor(Math.random() * 100) + 1;
      }
    } else {
      backup.status = 'failed';
      backup.errorMessage = 'Simulated backup failure';
      backup.completedAt = new Date();
      backup.durationMs = (backup.completedAt.getTime() - backup.startedAt.getTime());
    }

    this.runningBackups.delete(backupId);
    this.store.updateBackup(backupId, backup);

    if (backup.status === 'completed' && this.config.verifyBackupsAfterCreation) {
      this.verifyBackup(backupId);
    }

    this.createRecoveryPointFromBackup(backup);
    this.notifyBackupComplete(backup);
  }

  cancelBackup(backupId: string): boolean {
    const backup = this.store.getBackup(backupId);
    if (!backup || backup.status !== 'running') return false;

    backup.status = 'cancelled';
    backup.completedAt = new Date();
    this.runningBackups.delete(backupId);
    this.store.updateBackup(backupId, backup);
    return true;
  }

  getBackup(backupId: string): Backup | null {
    return this.store.getBackup(backupId) || null;
  }

  listBackups(filter?: {
    status?: BackupStatus;
    type?: BackupType;
    destination?: StorageDestination;
    startDate?: Date;
    endDate?: Date;
  }): Backup[] {
    let results = this.store.getAllBackups();

    if (filter?.status) {
      results = results.filter((b) => b.status === filter.status);
    }
    if (filter?.type) {
      results = results.filter((b) => b.type === filter.type);
    }
    if (filter?.destination) {
      results = results.filter((b) => b.destination === filter.destination);
    }
    if (filter?.startDate) {
      results = results.filter((b) => b.startedAt >= filter.startDate!);
    }
    if (filter?.endDate) {
      results = results.filter((b) => b.startedAt <= filter.endDate!);
    }

    return results.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  deleteBackup(backupId: string): boolean {
    const backup = this.store.getBackup(backupId);
    if (!backup) return false;
    if (backup.status === 'running') return false;

    const recoveryPoints = this.store.getAllRecoveryPoints().filter((rp) => rp.backupId === backupId);
    for (const rp of recoveryPoints) {
      this.store.deleteRecoveryPoint(rp.id);
    }

    return this.store.deleteBackup(backupId);
  }

  createRecoveryPointFromBackup(backup: Backup): RecoveryPoint {
    const recoveryPoint: RecoveryPoint = {
      id: generateRecoveryPointId(),
      backupId: backup.id,
      timestamp: backup.completedAt || new Date(),
      type: backup.type,
      size: backup.sizeBytes,
      checksum: backup.checksum || '',
      isCompressed: backup.compressionEnabled || false,
      isEncrypted: backup.encryptionEnabled || false,
      encryptionAlgorithm: backup.encryptionAlgorithm,
      retentionUntil: new Date(Date.now() + this.config.defaultRetentionDays * 24 * 60 * 60 * 1000),
      metadata: backup.metadata,
      dependencies: backup.parentBackupId ? [backup.parentBackupId] : undefined,
    };

    this.store.addRecoveryPoint(recoveryPoint);
    backup.recoveryPointId = recoveryPoint.id;
    this.store.updateBackup(backup.id, backup);
    return recoveryPoint;
  }

  getRecoveryPoint(recoveryPointId: string): RecoveryPoint | null {
    return this.store.getRecoveryPoint(recoveryPointId) || null;
  }

  listRecoveryPoints(filter?: {
    type?: BackupType;
    startDate?: Date;
    endDate?: Date;
  }): RecoveryPoint[] {
    let results = this.store.getAllRecoveryPoints();

    if (filter?.type) {
      results = results.filter((rp) => rp.type === filter.type);
    }
    if (filter?.startDate) {
      results = results.filter((rp) => rp.timestamp >= filter.startDate!);
    }
    if (filter?.endDate) {
      results = results.filter((rp) => rp.timestamp <= filter.endDate!);
    }

    return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  createRecoveryRequest(params: {
    recoveryPointId: string;
    targetPath: string;
    metadata?: Record<string, unknown>;
  }): RecoveryRequest | null {
    const recoveryPoint = this.store.getRecoveryPoint(params.recoveryPointId);
    if (!recoveryPoint) return null;

    const request: RecoveryRequest = {
      id: generateRecoveryRequestId(),
      recoveryPointId: params.recoveryPointId,
      targetPath: params.targetPath,
      status: 'pending',
      startedAt: new Date(),
      dataRestored: 0,
      dataRestoredBytes: 0,
      metadata: params.metadata,
    };

    this.store.addRecoveryRequest(request);
    return request;
  }

  startRecovery(recoveryRequestId: string): RecoveryRequest | null {
    const request = this.store.getRecoveryRequest(recoveryRequestId);
    if (!request || request.status !== 'pending') return null;

    request.status = 'in_progress';
    this.store.updateRecoveryRequest(recoveryRequestId, request);

    setTimeout(() => {
      this.completeRecovery(recoveryRequestId);
    }, Math.random() * 1000 + 500);

    return request;
  }

  private completeRecovery(recoveryRequestId: string): void {
    const request = this.store.getRecoveryRequest(recoveryRequestId);
    if (!request) return;

    const recoveryPoint = this.store.getRecoveryPoint(request.recoveryPointId);
    const simulatedSuccess = recoveryPoint ? Math.random() > 0.05 : false;

    if (simulatedSuccess && recoveryPoint) {
      request.status = 'completed';
      request.completedAt = new Date();
      request.durationMs = request.completedAt.getTime() - request.startedAt.getTime();
      request.dataRestored = Math.floor(Math.random() * 100) + 1;
      request.dataRestoredBytes = recoveryPoint.size;
      request.verificationStatus = 'pending';
    } else {
      request.status = 'failed';
      request.errorMessage = 'Simulated recovery failure';
      request.completedAt = new Date();
      request.durationMs = request.completedAt.getTime() - request.startedAt.getTime();
    }

    this.store.updateRecoveryRequest(recoveryRequestId, request);
  }

  getRecoveryRequest(recoveryRequestId: string): RecoveryRequest | null {
    return this.store.getRecoveryRequest(recoveryRequestId) || null;
  }

  listRecoveryRequests(filter?: {
    status?: RecoveryRequest['status'];
  }): RecoveryRequest[] {
    let results = this.store.getAllRecoveryRequests();
    if (filter?.status) {
      results = results.filter((r) => r.status === filter.status);
    }
    return results.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  verifyBackup(backupId: string, verificationType: BackupVerification['verificationType'] = 'checksum'): BackupVerification | null {
    const backup = this.store.getBackup(backupId);
    if (!backup || backup.status !== 'completed') return null;

    const verification: BackupVerification = {
      id: `VER_${generateRandomHex(8)}`,
      backupId,
      verificationType,
      status: 'pending',
    };

    this.store.addVerification(verification);

    setTimeout(() => {
      const isValid = Math.random() > 0.02;
      verification.status = isValid ? 'passed' : 'failed';
      verification.verifiedAt = new Date();
      if (!isValid) {
        verification.errorMessage = 'Checksum verification failed';
      }
      verification.details = {
        checkedAt: verification.verifiedAt,
        backupSize: backup.sizeBytes,
        hasChecksum: !!backup.checksum,
      };
    }, Math.random() * 500 + 100);

    return verification;
  }

  createSchedule(params: {
    name: string;
    cronExpression: string;
    backupType: BackupType;
    retentionPolicy: RetentionPolicyType;
    destination: StorageDestination;
    destinationPath: string;
    compressionEnabled?: boolean;
    encryptionEnabled?: boolean;
    includeMetadata?: boolean;
  }): BackupSchedule {
    const retentionDays = getRetentionPolicyDays(params.retentionPolicy);
    const schedule: BackupSchedule = {
      id: generateScheduleId(),
      name: params.name,
      cronExpression: params.cronExpression,
      backupType: params.backupType,
      retentionPolicy: params.retentionPolicy,
      retentionDays,
      enabled: true,
      destination: params.destination,
      destinationPath: params.destinationPath,
      compressionEnabled: params.compressionEnabled ?? this.config.defaultCompressionEnabled,
      encryptionEnabled: params.encryptionEnabled ?? this.config.defaultEncryptionEnabled,
      includeMetadata: params.includeMetadata ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.store.addSchedule(schedule);
    return schedule;
  }

  getSchedule(scheduleId: string): BackupSchedule | null {
    return this.store.getSchedule(scheduleId) || null;
  }

  listSchedules(enabledOnly?: boolean): BackupSchedule[] {
    const schedules = this.store.getAllSchedules();
    if (enabledOnly) {
      return schedules.filter((s) => s.enabled);
    }
    return schedules;
  }

  updateSchedule(scheduleId: string, updates: Partial<BackupSchedule>): BackupSchedule | null {
    return this.store.updateSchedule(scheduleId, updates) || null;
  }

  deleteSchedule(scheduleId: string): boolean {
    return this.store.deleteSchedule(scheduleId);
  }

  createRetentionRule(params: {
    name: string;
    policyType: RetentionPolicyType;
    retentionDays: number;
    backupTypes: BackupType[];
    destinations: StorageDestination[];
    applyToEncryptedBackups?: boolean;
    metadata?: Record<string, unknown>;
  }): RetentionRule {
    const rule: RetentionRule = {
      id: generateRetentionRuleId(),
      name: params.name,
      policyType: params.policyType,
      retentionDays: params.retentionDays,
      backupTypes: params.backupTypes,
      destinations: params.destinations,
      enabled: true,
      applyToEncryptedBackups: params.applyToEncryptedBackups ?? false,
      metadata: params.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.store.addRetentionRule(rule);
    return rule;
  }

  getRetentionRule(ruleId: string): RetentionRule | null {
    return this.store.getRetentionRule(ruleId) || null;
  }

  listRetentionRules(): RetentionRule[] {
    return this.store.getAllRetentionRules();
  }

  updateRetentionRule(ruleId: string, updates: Partial<RetentionRule>): RetentionRule | null {
    return this.store.updateRetentionRule(ruleId, updates) || null;
  }

  deleteRetentionRule(ruleId: string): boolean {
    return this.store.deleteRetentionRule(ruleId);
  }

  applyRetentionPolicy(): number {
    let deletedCount = 0;
    const rules = this.store.getAllRetentionRules();
    const recoveryPoints = this.store.getAllRecoveryPoints();

    for (const rule of rules) {
      if (!rule.enabled) continue;

      for (const point of recoveryPoints) {
        if (!rule.backupTypes.includes(point.type)) continue;
        if (!rule.destinations.includes(this.getDestinationForRecoveryPoint(point))) continue;
        if (rule.applyToEncryptedBackups && point.isEncrypted) continue;

        const retentionMs = rule.retentionDays * 24 * 60 * 60 * 1000;
        const expirationDate = new Date(point.timestamp.getTime() + retentionMs);

        if (new Date() > expirationDate) {
          const backup = this.store.getBackup(point.backupId);
          if (backup && backup.status === 'completed') {
            this.store.deleteRecoveryPoint(point.id);
            this.store.deleteBackup(point.backupId);
            deletedCount++;
          }
        }
      }
    }

    return deletedCount;
  }

  private getDestinationForRecoveryPoint(_point: RecoveryPoint): StorageDestination {
    return 'local';
  }

  getStats(): BackupStats {
    const backups = this.store.getAllBackups();
    const completedBackups = backups.filter((b) => b.status === 'completed');
    const failedBackups = backups.filter((b) => b.status === 'failed');
    const runningBackups = backups.filter((b) => b.status === 'running');
    const pendingBackups = backups.filter((b) => b.status === 'pending');

    const totalSizeBytes = completedBackups.reduce((sum, b) => sum + b.sizeBytes, 0);
    const compressedSizeBytes = completedBackups.reduce((sum, b) => sum + (b.compressedSizeBytes || b.sizeBytes), 0);

    const compressionRatios = completedBackups
      .filter((b) => b.compressionEnabled && b.compressedSizeBytes)
      .map((b) => calculateCompressionRatio(b.sizeBytes, b.compressedSizeBytes!));
    const averageCompressionRatio = compressionRatios.length > 0
      ? compressionRatios.reduce((a, b) => a + b, 0) / compressionRatios.length
      : 0;

    const durations = completedBackups
      .filter((b) => b.durationMs)
      .map((b) => b.durationMs!);
    const averageBackupDurationMs = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const successRate = backups.length > 0 ? completedBackups.length / backups.length : 0;

    const byType: Record<BackupType, number> = { full: 0, incremental: 0, differential: 0 };
    for (const backup of backups) {
      byType[backup.type]++;
    }

    const byDestination: Record<StorageDestination, number> = { local: 0, s3: 0, google_cloud: 0, azure: 0 };
    for (const backup of backups) {
      byDestination[backup.destination]++;
    }

    const lastSuccessful = completedBackups
      .filter((b) => b.completedAt)
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0];
    const lastFailed = failedBackups
      .filter((b) => b.completedAt)
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0];

    return {
      totalBackups: backups.length,
      completedBackups: completedBackups.length,
      failedBackups: failedBackups.length,
      runningBackups: runningBackups.length,
      pendingBackups: pendingBackups.length,
      totalSizeBytes,
      compressedSizeBytes,
      averageCompressionRatio,
      averageBackupDurationMs,
      successRate,
      lastSuccessfulBackup: lastSuccessful?.completedAt,
      lastFailedBackup: lastFailed?.completedAt,
      byType,
      byDestination,
    };
  }

  getRPOStatus(targetMinutes: number = this.config.defaultRPO): RPOConfig {
    const backups = this.store.getAllBackups()
      .filter((b) => b.status === 'completed' && b.completedAt)
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0));

    const lastBackup = backups[0];
    const lastBackupAt = lastBackup?.completedAt;
    const schedules = this.store.getAllSchedules().filter((s) => s.enabled);
    const nextScheduledBackup = schedules.length > 0
      ? new Date(Date.now() + 60 * 60 * 1000)
      : undefined;

    const rpoConfig: RPOConfig = {
      targetMinutes,
      lastBackupAt,
      nextScheduledBackup,
      isWithinTarget: true,
      violations: [],
    };

    const status = calculateRPOStatus(rpoConfig);
    rpoConfig.actualMinutes = status.driftMinutes + targetMinutes;
    rpoConfig.isWithinTarget = status.withinTarget;

    if (!status.withinTarget) {
      rpoConfig.violations.push(`RPO drift of ${status.driftMinutes.toFixed(2)} minutes exceeds target`);
    }

    return rpoConfig;
  }

  notifyBackupComplete(backup: Backup): void {
    const notification: BackupNotification = {
      id: `NOTIF_${generateRandomHex(8)}`,
      backupId: backup.id,
      type: backup.status === 'completed' ? 'success' : 'failure',
      title: backup.status === 'completed' ? 'Backup Completed' : 'Backup Failed',
      message: backup.status === 'completed'
        ? `Backup ${backup.id} completed successfully. Size: ${backup.size}`
        : `Backup ${backup.id} failed: ${backup.errorMessage}`,
      sentAt: new Date(),
      metadata: {
        backupType: backup.type,
        destination: backup.destination,
        sizeBytes: backup.sizeBytes,
      },
    };

    this.store.addNotification(notification);
  }

  getNotifications(): BackupNotification[] {
    return this.store.getNotifications();
  }

  clear(): void {
    this.store.clear();
    this.runningBackups.clear();
    for (const timeout of this.activeSchedules.values()) {
      clearTimeout(timeout);
    }
    this.activeSchedules.clear();
  }
}

export class DisasterRecoveryManager {
  private backupManager: BackupManager;
  private store: InMemoryBackupStore;
  private failoverConfig: FailoverConfig;

  constructor(backupManager: BackupManager, failoverConfig?: Partial<FailoverConfig>) {
    this.backupManager = backupManager;
    this.store = (backupManager as unknown as { store: InMemoryBackupStore }).store;
    this.failoverConfig = {
      enabled: false,
      automaticFailover: false,
      healthCheckIntervalMs: 30000,
      failureThreshold: 3,
      recoveryTimeoutMs: 300000,
      ...failoverConfig,
    };
  }

  createDisasterRecoveryPlan(params: {
    name: string;
    description: string;
    rpoMinutes: number;
    rtoMinutes: number;
    backupSchedules: string[];
    fallbackDestinations?: StorageDestination[];
  }): DisasterRecoveryPlan {
    const recoveryPointIds: string[] = [];
    for (const scheduleId of params.backupSchedules) {
      const schedule = this.backupManager.getSchedule(scheduleId);
      if (schedule) {
        const backups = this.backupManager.listBackups({ type: schedule.backupType });
        for (const backup of backups.slice(0, 5)) {
          if (backup.recoveryPointId) {
            recoveryPointIds.push(backup.recoveryPointId);
          }
        }
      }
    }

    const plan: DisasterRecoveryPlan = {
      id: `DRP_${generateRandomHex(8)}`,
      name: params.name,
      description: params.description,
      rpoMinutes: params.rpoMinutes,
      rtoMinutes: params.rtoMinutes,
      backupSchedules: params.backupSchedules,
      recoveryPointIds: [...new Set(recoveryPointIds)],
      fallbackDestinations: params.fallbackDestinations || [],
      lastTestAt: undefined,
      lastTestResult: 'never_tested',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return plan;
  }

  testFailover(_planId: string): { success: boolean; durationMs: number; dataLossSeconds: number } {
    const durationMs = Math.floor(Math.random() * 5000) + 1000;
    const dataLossSeconds = Math.floor(Math.random() * 60);
    const success = Math.random() > 0.1;

    return {
      success,
      durationMs,
      dataLossSeconds,
    };
  }

  performFailover(_planId: string): { success: boolean; newRegion?: string; error?: string } {
    if (!this.failoverConfig.enabled) {
      return { success: false, error: 'Failover is not enabled' };
    }

    if (!this.failoverConfig.automaticFailover) {
      return { success: false, error: 'Automatic failover is disabled' };
    }

    const success = Math.random() > 0.1;
    if (success) {
      return { success: true, newRegion: this.failoverConfig.fallbackRegion || 'fallback-region' };
    }

    return { success: false, error: 'Simulated failover failure' };
  }

  getFailoverConfig(): FailoverConfig {
    return { ...this.failoverConfig };
  }

  updateFailoverConfig(updates: Partial<FailoverConfig>): FailoverConfig {
    this.failoverConfig = { ...this.failoverConfig, ...updates };
    return this.failoverConfig;
  }
}

export class BackupRecoveryService {
  backupManager: BackupManager;
  disasterRecoveryManager: DisasterRecoveryManager;

  constructor(config?: Partial<BackupConfig>) {
    this.backupManager = new BackupManager(undefined, config);
    this.disasterRecoveryManager = new DisasterRecoveryManager(this.backupManager);
  }

  createBackup(params: {
    type: BackupType;
    sourcePath: string;
    destination: StorageDestination;
    destinationPath: string;
    scheduleId?: string;
    parentBackupId?: string;
    compressionEnabled?: boolean;
    encryptionEnabled?: boolean;
    metadata?: Record<string, unknown>;
  }): Backup {
    return this.backupManager.createBackup(params);
  }

  startBackup(backupId: string): Backup | null {
    return this.backupManager.startBackup(backupId);
  }

  getBackup(backupId: string): Backup | null {
    return this.backupManager.getBackup(backupId);
  }

  listBackups(filter?: {
    status?: BackupStatus;
    type?: BackupType;
    destination?: StorageDestination;
    startDate?: Date;
    endDate?: Date;
  }): Backup[] {
    return this.backupManager.listBackups(filter);
  }

  createRecoveryRequest(params: {
    recoveryPointId: string;
    targetPath: string;
    metadata?: Record<string, unknown>;
  }): RecoveryRequest | null {
    return this.backupManager.createRecoveryRequest(params);
  }

  startRecovery(recoveryRequestId: string): RecoveryRequest | null {
    return this.backupManager.startRecovery(recoveryRequestId);
  }

  getRecoveryRequest(recoveryRequestId: string): RecoveryRequest | null {
    return this.backupManager.getRecoveryRequest(recoveryRequestId);
  }

  listRecoveryRequests(filter?: { status?: RecoveryRequest['status'] }): RecoveryRequest[] {
    return this.backupManager.listRecoveryRequests(filter);
  }

  createSchedule(params: {
    name: string;
    cronExpression: string;
    backupType: BackupType;
    retentionPolicy: RetentionPolicyType;
    destination: StorageDestination;
    destinationPath: string;
    compressionEnabled?: boolean;
    encryptionEnabled?: boolean;
    includeMetadata?: boolean;
  }): BackupSchedule {
    return this.backupManager.createSchedule(params);
  }

  getSchedule(scheduleId: string): BackupSchedule | null {
    return this.backupManager.getSchedule(scheduleId);
  }

  listSchedules(enabledOnly?: boolean): BackupSchedule[] {
    return this.backupManager.listSchedules(enabledOnly);
  }

  createRetentionRule(params: {
    name: string;
    policyType: RetentionPolicyType;
    retentionDays: number;
    backupTypes: BackupType[];
    destinations: StorageDestination[];
    applyToEncryptedBackups?: boolean;
    metadata?: Record<string, unknown>;
  }): RetentionRule {
    return this.backupManager.createRetentionRule(params);
  }

  getStats(): BackupStats {
    return this.backupManager.getStats();
  }

  getRPOStatus(targetMinutes?: number): RPOConfig {
    return this.backupManager.getRPOStatus(targetMinutes);
  }

  applyRetentionPolicy(): number {
    return this.backupManager.applyRetentionPolicy();
  }

  clear(): void {
    this.backupManager.clear();
  }
}

export function createBackupRecoveryService(config?: Partial<BackupConfig>): BackupRecoveryService {
  return new BackupRecoveryService(config);
}

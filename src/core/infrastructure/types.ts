/**
 * Cloud Infrastructure
 * Managed cloud infrastructure and deployment system
 */

export interface DeploymentConfig {
  appName: string;
  environment: 'development' | 'staging' | 'production';
  regions: string[];
  replicas: number;
  autoScaling: AutoScalingConfig;
  database: DatabaseConfig;
  monitoring: MonitoringConfig;
}

export interface AutoScalingConfig {
  enabled: boolean;
  minInstances: number;
  maxInstances: number;
  targetCPUUtilization: number;
  targetMemoryUtilization: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
}

export interface DatabaseConfig {
  type: 'postgresql' | 'mongodb' | 'mysql';
  host: string;
  port: number;
  replicated: boolean;
  backupSchedule: string;
  backupRetentionDays: number;
}

export interface MonitoringConfig {
  enabled: boolean;
  metricsCollection: boolean;
  loggingLevel: 'debug' | 'info' | 'warn' | 'error';
  alertThresholds: AlertThreshold[];
}

export interface AlertThreshold {
  metric: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high';
  action: string;
}

export interface DeploymentState {
  deploymentId: string;
  config: DeploymentConfig;
  status: DeploymentStatus;
  instances: Instance[];
  database: DatabaseInstance;
  cdn: CDNConfig;
  loadBalancer: LoadBalancerConfig;
  createdAt: Date;
  lastUpdatedAt: Date;
}

export type DeploymentStatus = 'initializing' | 'healthy' | 'degraded' | 'unhealthy' | 'deploying';

export interface Instance {
  instanceId: string;
  region: string;
  status: 'running' | 'stopping' | 'stopped' | 'failed';
  cpuUtilization: number;
  memoryUtilization: number;
  createdAt: Date;
}

export interface DatabaseInstance {
  instanceId: string;
  status: 'running' | 'replicating' | 'failed';
  size: number;
  backups: Backup[];
  lastBackupTime?: Date;
}

export interface Backup {
  backupId: string;
  timestamp: Date;
  size: number;
  status: 'completed' | 'failed' | 'in_progress';
}

export interface CDNConfig {
  enabled: boolean;
  provider: 'cloudflare' | 'cloudfront' | 'akamai';
  cacheRules: CacheRule[];
}

export interface CacheRule {
  path: string;
  ttl: number;
  compress: boolean;
}

export interface LoadBalancerConfig {
  enabled: boolean;
  algorithm: 'round-robin' | 'least-connections' | 'ip-hash';
  healthCheckInterval: number;
  healthCheckPath: string;
}

export interface DeploymentManager {
  deploy(config: DeploymentConfig): Promise<DeploymentState>;
  getDeploymentStatus(deploymentId: string): Promise<DeploymentStatus>;
  updateDeployment(deploymentId: string, config: Partial<DeploymentConfig>): Promise<DeploymentState>;
  rollback(deploymentId: string, version: string): Promise<DeploymentState>;
  blueGreenDeploy(deploymentId: string, newVersion: string): Promise<DeploymentState>;
}

export interface AutoScalingManager {
  setScalingPolicy(deploymentId: string, policy: AutoScalingConfig): Promise<void>;
  getScalingMetrics(deploymentId: string): Promise<ScalingMetrics>;
  manualScale(deploymentId: string, replicas: number): Promise<void>;
}

export interface ScalingMetrics {
  currentInstances: number;
  averageCPU: number;
  averageMemory: number;
  requestsPerSecond: number;
  responseTime: number;
}

export interface DatabaseManager {
  createDatabase(config: DatabaseConfig): Promise<DatabaseInstance>;
  createBackup(instanceId: string): Promise<Backup>;
  restoreFromBackup(instanceId: string, backupId: string): Promise<void>;
  setupReplication(instanceId: string, replicaCount: number): Promise<void>;
  monitorHealth(instanceId: string): Promise<DatabaseHealth>;
}

export interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connectionPoolUtilization: number;
  queryLatencyMs: number;
  replicationLag: number;
  diskUsage: number;
}

export interface DisasterRecoveryManager {
  setupFailover(deploymentId: string, primaryRegion: string, failoverRegion: string): Promise<void>;
  testFailover(deploymentId: string): Promise<FailoverTestResult>;
  createSnapshot(deploymentId: string): Promise<string>;
  restoreFromSnapshot(deploymentId: string, snapshotId: string): Promise<void>;
}

export interface FailoverTestResult {
  success: boolean;
  failoverTimeMs: number;
  dataLossSeconds: number;
  affectedSessions: number;
}

export interface MonitoringManager {
  getMetrics(deploymentId: string, timeRange: TimeRange): Promise<Metrics>;
  getAlerts(deploymentId: string): Promise<Alert[]>;
  setAlertRule(rule: AlertThreshold): Promise<void>;
  getHealthStatus(deploymentId: string): Promise<HealthStatus>;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface Metrics {
  cpuUsage: number[];
  memoryUsage: number[];
  networkIngress: number[];
  networkEgress: number[];
  requestCount: number[];
  errorRate: number[];
  responseTime: number[];
}

export interface Alert {
  alertId: string;
  metric: string;
  severity: string;
  message: string;
  timestamp: Date;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  componentStatus: Map<string, string>;
  lastCheckTime: Date;
}

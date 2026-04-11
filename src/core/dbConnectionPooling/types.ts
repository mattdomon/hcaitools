import crypto from 'crypto';

export type PoolStrategy = 'fifo' | 'lifo' | 'random';
export type ConnectionState = 'idle' | 'active' | 'stale' | 'closed';
export type QueryType = 'select' | 'insert' | 'update' | 'delete';
export type HealthCheckType = 'ping' | 'query' | 'connection';
export type TransactionIsolationLevel = 'read_uncommitted' | 'read_committed' | 'repeatable_read' | 'serializable';

export interface PoolConfig {
  minConnections: number;
  maxConnections: number;
  connectionTimeout: number;
  idleTimeout: number;
  healthCheckInterval: number;
  maxLifetime: number;
  strategy: PoolStrategy;
  validationQuery?: string;
}

export interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  staleConnections: number;
  closedConnections: number;
  waitingClients: number;
  totalAcquired: number;
  totalReleased: number;
  totalQueries: number;
  totalTransactions: number;
  averageWaitTime: number;
  averageConnectionLifetime: number;
}

export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
  affectedRows: number;
  queryType: QueryType;
  executionTime: number;
  cached: boolean;
}

export interface QueryOptions {
  queryType?: QueryType;
  timeout?: number;
  cache?: boolean;
  transactionId?: string;
}

export interface Transaction {
  id: string;
  connectionId: string;
  isolationLevel: TransactionIsolationLevel;
  startedAt: number;
  status: 'active' | 'committed' | 'rolled_back';
  queries: string[];
}

export interface HealthCheckResult {
  connectionId: string;
  healthy: boolean;
  latency: number;
  checkType: HealthCheckType;
  error?: string;
  checkedAt: number;
}

export interface Connection {
  id: string;
  state: ConnectionState;
  createdAt: number;
  lastUsedAt: number;
  lastHealthCheck: number;
  queryCount: number;
  transactionCount: number;
  acquireTime?: number;
  metadata: Record<string, unknown>;
}

export interface QueryOptimizationHint {
  useIndex?: string;
  forceTableScan?: boolean;
  joinOrder?: string[];
  maxRows?: number;
}

export interface QueryExecutionPlan {
  query: string;
  estimatedCost?: number;
  usedIndexes: string[];
  suggestedHints: QueryOptimizationHint[];
  actualRows?: number;
}

export interface ConnectionAcquisitionOptions {
  timeout?: number;
  preferredConnectionId?: string;
}

export interface ConnectionPoolEvents {
  onConnectionCreated?: (connection: Connection) => void;
  onConnectionAcquired?: (connection: Connection, waitTime: number) => void;
  onConnectionReleased?: (connection: Connection) => void;
  onConnectionClosed?: (connection: Connection, reason: string) => void;
  onConnectionStale?: (connection: Connection) => void;
  onHealthCheckFailed?: (connection: Connection, error: string) => void;
  onPoolExhausted?: () => void;
  onQueryExecuted?: (query: string, result: QueryResult, executionTime: number) => void;
}

export interface PreparedStatement<T = unknown> {
  id: string;
  query: string;
  queryType: QueryType;
  parameterCount: number;
  cachedAt: number;
  hitCount: number;
  lastUsedAt: number;
  result?: QueryResult<T>;
}

export interface CachedQueryResult {
  key: string;
  result: QueryResult;
  cachedAt: number;
  expiresAt: number;
  hitCount: number;
}

export function createPoolConfig(overrides?: Partial<PoolConfig>): PoolConfig {
  return {
    minConnections: 5,
    maxConnections: 20,
    connectionTimeout: 30000,
    idleTimeout: 60000,
    healthCheckInterval: 30000,
    maxLifetime: 3600000,
    strategy: 'fifo',
    validationQuery: 'SELECT 1',
    ...overrides,
  };
}

export function createConnectionId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export function createTransactionId(): string {
  return createConnectionId('txn');
}

export function createPreparedStatementId(): string {
  return createConnectionId('pstmt');
}

export function createHealthCheckResult(
  connectionId: string,
  checkType: HealthCheckType,
  healthy: boolean,
  latency: number,
  error?: string
): HealthCheckResult {
  return {
    connectionId,
    healthy,
    latency,
    checkType,
    error,
    checkedAt: Date.now(),
  };
}

export function isConnectionStale(connection: Connection, idleTimeout: number, maxLifetime: number): boolean {
  const now = Date.now();
  const idleTime = now - connection.lastUsedAt;
  const lifetime = now - connection.createdAt;
  return idleTime > idleTimeout || lifetime > maxLifetime;
}

export function isConnectionHealthy(connection: Connection, healthCheckInterval: number): boolean {
  const now = Date.now();
  return now - connection.lastHealthCheck < healthCheckInterval && connection.state !== 'closed';
}

export function calculateQueryCacheKey(query: string, params?: unknown[]): string {
  const paramsStr = params ? JSON.stringify(params) : '';
  return `${query}_${paramsStr}`;
}

export function isValidPoolConfig(config: Partial<PoolConfig>): config is PoolConfig {
  return (
    typeof config.minConnections === 'number' &&
    config.minConnections >= 0 &&
    typeof config.maxConnections === 'number' &&
    config.maxConnections > 0 &&
    config.maxConnections >= config.minConnections &&
    typeof config.connectionTimeout === 'number' &&
    config.connectionTimeout > 0 &&
    typeof config.idleTimeout === 'number' &&
    config.idleTimeout > 0 &&
    typeof config.healthCheckInterval === 'number' &&
    config.healthCheckInterval > 0 &&
    typeof config.maxLifetime === 'number' &&
    config.maxLifetime > 0 &&
    ['fifo', 'lifo', 'random'].includes(config.strategy as PoolStrategy)
  );
}

export function isValidQueryType(queryType: string): queryType is QueryType {
  return ['select', 'insert', 'update', 'delete'].includes(queryType);
}

export function getQueryTypeFromString(query: string): QueryType {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.startsWith('select')) return 'select';
  if (trimmed.startsWith('insert')) return 'insert';
  if (trimmed.startsWith('update')) return 'update';
  if (trimmed.startsWith('delete')) return 'delete';
  return 'select';
}

export function createEmptyMetrics(): ConnectionMetrics {
  return {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    staleConnections: 0,
    closedConnections: 0,
    waitingClients: 0,
    totalAcquired: 0,
    totalReleased: 0,
    totalQueries: 0,
    totalTransactions: 0,
    averageWaitTime: 0,
    averageConnectionLifetime: 0,
  };
}

export function mergeMetrics(base: ConnectionMetrics, delta: Partial<ConnectionMetrics>): ConnectionMetrics {
  return { ...base, ...delta };
}

export function createDefaultConnectionMetadata(): Record<string, unknown> {
  return {
    version: 1,
    createdBy: 'dbConnectionPooling',
  };
}

export function createConnection(metadata?: Record<string, unknown>): Connection {
  const now = Date.now();
  return {
    id: createConnectionId('conn'),
    state: 'idle',
    createdAt: now,
    lastUsedAt: now,
    lastHealthCheck: now,
    queryCount: 0,
    transactionCount: 0,
    metadata: metadata || createDefaultConnectionMetadata(),
  };
}

export function isTransactionActive(transaction: Transaction): boolean {
  return transaction.status === 'active';
}

export function isTransactionCompleted(transaction: Transaction): boolean {
  return transaction.status === 'committed' || transaction.status === 'rolled_back';
}

export function getTransactionDuration(transaction: Transaction): number {
  return Date.now() - transaction.startedAt;
}

export function createQueryResult<T>(
  queryType: QueryType,
  rows: T[],
  executionTime: number,
  cached: boolean = false
): QueryResult<T> {
  return {
    rows,
    rowCount: rows.length,
    affectedRows: queryType !== 'select' ? rows.length : 0,
    queryType,
    executionTime,
    cached,
  };
}

export function calculateCacheExpiry(ttl: number): number {
  return Date.now() + ttl;
}

export function isCachedResultExpired(cached: CachedQueryResult): boolean {
  return Date.now() > cached.expiresAt;
}

export function createPreparedStatement(
  query: string,
  queryType: QueryType,
  parameterCount: number
): PreparedStatement {
  return {
    id: createPreparedStatementId(),
    query,
    queryType,
    parameterCount,
    cachedAt: Date.now(),
    hitCount: 0,
    lastUsedAt: Date.now(),
  };
}

export function incrementStatementHitCount(statement: PreparedStatement): PreparedStatement {
  return {
    ...statement,
    hitCount: statement.hitCount + 1,
    lastUsedAt: Date.now(),
  };
}

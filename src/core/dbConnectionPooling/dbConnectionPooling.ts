import type {
  PoolConfig,
  Connection,
  ConnectionMetrics,
  ConnectionPoolEvents,
  QueryResult,
  QueryOptions,
  Transaction,
  HealthCheckResult,
  QueryOptimizationHint,
  QueryExecutionPlan,
  ConnectionAcquisitionOptions,
  PreparedStatement,
  CachedQueryResult,
  TransactionIsolationLevel,
} from './types';

import {
  createPoolConfig,
  createConnectionId,
  createTransactionId,
  createHealthCheckResult,
  createConnection,
  createEmptyMetrics,
  createQueryResult,
  createPreparedStatement,
  isConnectionStale,
  isValidPoolConfig,
  getQueryTypeFromString,
  calculateQueryCacheKey,
  isTransactionActive,
  incrementStatementHitCount,
  isCachedResultExpired,
} from './types';

export class ConnectionPool {
  private config: PoolConfig;
  private connections: Map<string, Connection> = new Map();
  private idleConnections: string[] = [];
  private activeConnections: Map<string, string> = new Map();
  private transactions: Map<string, Transaction> = new Map();
  private preparedStatements: Map<string, PreparedStatement> = new Map();
  private queryCache: Map<string, CachedQueryResult> = new Map();
  private waitingClients: Map<string, { resolve: (conn: Connection) => void; reject: (err: Error) => void; timeout: NodeJS.Timeout }> = new Map();
  private metrics: ConnectionMetrics;
  private events: ConnectionPoolEvents;
  private healthCheckIntervalId: NodeJS.Timeout | null = null;
  private cacheCleanupIntervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(config?: Partial<PoolConfig>, events?: ConnectionPoolEvents) {
    const fullConfig = createPoolConfig(config);
    if (!isValidPoolConfig(fullConfig as PoolConfig)) {
      throw new Error('Invalid pool configuration');
    }
    this.config = fullConfig;
    this.metrics = createEmptyMetrics();
    this.events = events || {};
  }

  async initialize(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    for (let i = 0; i < this.config.minConnections; i++) {
      const connection = createConnection();
      this.connections.set(connection.id, connection);
      this.idleConnections.push(connection.id);
      this.metrics.totalConnections++;
      this.events.onConnectionCreated?.(connection);
    }

    this.startHealthCheck();
    this.startCacheCleanup();
  }

  async acquire(options?: ConnectionAcquisitionOptions): Promise<Connection> {
    const timeout = options?.timeout ?? this.config.connectionTimeout;

    if (this.idleConnections.length > 0) {
      const connection = this.getNextConnectionByStrategy();
      if (connection && connection.state !== 'closed') {
        return this.markConnectionActive(connection.id, options?.preferredConnectionId);
      }
    }

    if (this.connections.size < this.config.maxConnections) {
      const connection = createConnection();
      this.connections.set(connection.id, connection);
      this.metrics.totalConnections++;
      this.events.onConnectionCreated?.(connection);
      return this.markConnectionActive(connection.id, options?.preferredConnectionId);
    }

    return this.waitForConnection(timeout);
  }

  private getNextConnectionByStrategy(): Connection | undefined {
    const strategy = this.config.strategy;

    if (strategy === 'fifo') {
      const connectionId = this.idleConnections.shift();
      return connectionId ? this.connections.get(connectionId) : undefined;
    }

    if (strategy === 'lifo') {
      const connectionId = this.idleConnections.pop();
      return connectionId ? this.connections.get(connectionId) : undefined;
    }

    if (strategy === 'random') {
      if (this.idleConnections.length === 0) return undefined;
      const randomIndex = Math.floor(Math.random() * this.idleConnections.length);
      const connectionId = this.idleConnections.splice(randomIndex, 1)[0];
      return this.connections.get(connectionId);
    }

    return undefined;
  }

  private markConnectionActive(connectionId: string, _preferredConnectionId?: string): Connection {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    const now = Date.now();
    connection.state = 'active';
    connection.lastUsedAt = now;
    connection.acquireTime = now;

    this.activeConnections.set(connectionId, connectionId);
    this.idleConnections = this.idleConnections.filter(id => id !== connectionId);

    this.metrics.activeConnections++;
    this.metrics.idleConnections = Math.max(0, this.metrics.idleConnections - 1);
    this.metrics.totalAcquired++;

    const waitTime = connection.acquireTime ? now - connection.acquireTime : 0;
    this.updateAverageWaitTime(waitTime);
    this.events.onConnectionAcquired?.(connection, waitTime);

    return connection;
  }

  private async waitForConnection(timeout: number): Promise<Connection> {
    const clientId = createConnectionId('client');
    this.metrics.waitingClients++;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.waitingClients.delete(clientId);
        this.metrics.waitingClients--;
        this.events.onPoolExhausted?.();
        reject(new Error('Connection acquisition timeout'));
      }, timeout);

      this.waitingClients.set(clientId, { resolve, reject, timeout: timeoutId });

      setTimeout(() => {
        this.processWaitingClients();
      }, 100);
    });
  }

  private processWaitingClients(): void {
    if (this.idleConnections.length === 0) return;

    for (const [clientId, client] of this.waitingClients) {
      const connection = this.getNextConnectionByStrategy();
      if (connection) {
        clearTimeout(client.timeout);
        this.waitingClients.delete(clientId);
        this.metrics.waitingClients--;
        const resolvedConnection = this.markConnectionActive(connection.id);
        client.resolve(resolvedConnection);
      }
    }
  }

  async release(connectionId: string): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    if (this.transactions.has(connectionId)) {
      const transaction = this.transactions.get(connectionId);
      if (transaction && isTransactionActive(transaction)) {
        await this.rollbackTransaction(connectionId);
      }
    }

    connection.state = 'idle';
    connection.acquireTime = undefined;

    this.activeConnections.delete(connectionId);
    this.idleConnections.push(connectionId);

    this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
    this.metrics.idleConnections++;
    this.metrics.totalReleased++;

    this.events.onConnectionReleased?.(connection);
    this.processWaitingClients();

    return true;
  }

  async close(connectionId: string, reason: string = 'manual'): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    if (this.transactions.has(connectionId)) {
      await this.rollbackTransaction(connectionId);
    }

    connection.state = 'closed';
    this.idleConnections = this.idleConnections.filter(id => id !== connectionId);
    this.activeConnections.delete(connectionId);

    this.metrics.totalConnections--;
    this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
    this.metrics.idleConnections = Math.max(0, this.metrics.idleConnections - 1);
    this.metrics.closedConnections++;

    this.events.onConnectionClosed?.(connection, reason);

    return true;
  }

  async executeQuery<T>(
    query: string,
    params?: unknown[],
    options?: QueryOptions
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    const queryType = options?.queryType ?? getQueryTypeFromString(query);

    if (options?.cache && queryType === 'select') {
      const cacheKey = calculateQueryCacheKey(query, params);
      const cached = this.queryCache.get(cacheKey);
      if (cached && !isCachedResultExpired(cached)) {
        cached.hitCount++;
        this.metrics.totalQueries++;
        return {
          rows: cached.result.rows as T[],
          rowCount: cached.result.rowCount,
          affectedRows: cached.result.affectedRows,
          queryType: cached.result.queryType,
          cached: true,
          executionTime: Date.now() - startTime,
        };
      }
    }

    const connection = await this.acquire();

    try {
      await this.simulateQueryExecution(query, params);

      const executionTime = Date.now() - startTime;
      connection.queryCount++;
      this.metrics.totalQueries++;

      const result = createQueryResult<T>(queryType, [], executionTime, false);

      if (options?.cache && queryType === 'select') {
        const cacheKey = calculateQueryCacheKey(query, params);
        this.queryCache.set(cacheKey, {
          key: cacheKey,
          result,
          cachedAt: Date.now(),
          expiresAt: Date.now() + 300000,
          hitCount: 1,
        });
      }

      this.events.onQueryExecuted?.(query, result, executionTime);

      await this.release(connection.id);

      return result;
    } catch (error) {
      await this.release(connection.id);
      throw error;
    }
  }

  private async simulateQueryExecution(_query: string, _params?: unknown[]): Promise<void> {
    const delay = Math.random() * 10 + 5;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async beginTransaction(isolationLevel?: TransactionIsolationLevel): Promise<Transaction> {
    const connection = await this.acquire();

    const transaction: Transaction = {
      id: createTransactionId(),
      connectionId: connection.id,
      isolationLevel: isolationLevel || 'read_committed',
      startedAt: Date.now(),
      status: 'active',
      queries: [],
    };

    this.transactions.set(connection.id, transaction);
    connection.transactionCount++;
    this.metrics.totalTransactions++;

    return transaction;
  }

  async commitTransaction(connectionId: string): Promise<boolean> {
    const transaction = this.transactions.get(connectionId);
    if (!transaction || !isTransactionActive(transaction)) {
      return false;
    }

    transaction.status = 'committed';
    this.transactions.delete(connectionId);

    await this.release(connectionId);

    return true;
  }

  async rollbackTransaction(connectionId: string): Promise<boolean> {
    const transaction = this.transactions.get(connectionId);
    if (!transaction) {
      return false;
    }

    transaction.status = 'rolled_back';
    this.transactions.delete(connectionId);

    await this.release(connectionId);

    return true;
  }

  async executeInTransaction<T>(
    callback: (transaction: Transaction) => Promise<T>,
    isolationLevel?: TransactionIsolationLevel
  ): Promise<T> {
    const transaction = await this.beginTransaction(isolationLevel);

    try {
      const result = await callback(transaction);
      await this.commitTransaction(transaction.connectionId);
      return result;
    } catch (error) {
      await this.rollbackTransaction(transaction.connectionId);
      throw error;
    }
  }

  async healthCheck(connectionId?: string): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    const connectionsToCheck = connectionId
      ? [this.connections.get(connectionId)].filter((c): c is Connection => c !== undefined)
      : Array.from(this.connections.values());

    for (const connection of connectionsToCheck) {
      const result = await this.performHealthCheck(connection);
      results.push(result);

      if (!result.healthy) {
        connection.state = 'stale';
        this.events.onHealthCheckFailed?.(connection, result.error || 'Health check failed');
        await this.close(connection.id, 'health_check_failed');
      } else {
        connection.lastHealthCheck = Date.now();
      }
    }

    return results;
  }

  private async performHealthCheck(connection: Connection): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      if (connection.state === 'closed') {
        return createHealthCheckResult(connection.id, 'connection', false, Date.now() - startTime, 'Connection closed');
      }

      await this.simulateQueryExecution(this.config.validationQuery || 'SELECT 1');

      const latency = Date.now() - startTime;
      return createHealthCheckResult(connection.id, 'ping', true, latency);
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return createHealthCheckResult(connection.id, 'ping', false, latency, errorMessage);
    }
  }

  private startHealthCheck(): void {
    if (this.healthCheckIntervalId) return;

    this.healthCheckIntervalId = setInterval(async () => {
      await this.performScheduledHealthCheck();
    }, this.config.healthCheckInterval);
  }

  private async performScheduledHealthCheck(): Promise<void> {
    const now = Date.now();

    for (const connection of this.connections.values()) {
      if (connection.state === 'idle' && now - connection.lastUsedAt > this.config.idleTimeout) {
        this.events.onConnectionStale?.(connection);
        connection.state = 'stale';
        this.metrics.staleConnections++;
      }

      if (isConnectionStale(connection, this.config.idleTimeout, this.config.maxLifetime)) {
        await this.close(connection.id, 'stale');
      }
    }

    const results = await this.healthCheck();
    for (const result of results) {
      if (!result.healthy) {
        this.events.onHealthCheckFailed?.(this.connections.get(result.connectionId)!, result.error || 'Health check failed');
      }
    }
  }

  private startCacheCleanup(): void {
    if (this.cacheCleanupIntervalId) return;

    this.cacheCleanupIntervalId = setInterval(() => {
      this.cleanupExpiredCacheEntries();
    }, this.config.healthCheckInterval);
  }

  private cleanupExpiredCacheEntries(): void {
    for (const [key, cached] of this.queryCache.entries()) {
      if (isCachedResultExpired(cached)) {
        this.queryCache.delete(key);
      }
    }
  }

  async prepareStatement<T>(query: string): Promise<PreparedStatement<T>> {
    const queryType = getQueryTypeFromString(query);
    const paramCount = (query.match(/\$\d+/g) || []).length;

    const existing = Array.from(this.preparedStatements.values()).find(
      p => p.query === query
    );

    if (existing) {
      return incrementStatementHitCount(existing) as PreparedStatement<T>;
    }

    const statement = createPreparedStatement(query, queryType, paramCount);
    this.preparedStatements.set(statement.id, statement);

    return statement as PreparedStatement<T>;
  }

  async executePreparedStatement<T>(
    statementId: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    const statement = this.preparedStatements.get(statementId);
    if (!statement) {
      throw new Error(`Prepared statement ${statementId} not found`);
    }

    return this.executeQuery<T>(statement.query, params, {
      queryType: statement.queryType,
    });
  }

  async analyzeQuery(query: string): Promise<QueryExecutionPlan> {
    const usedIndexes: string[] = [];
    const hints: QueryOptimizationHint[] = [];

    const tableMatch = query.match(/from\s+(\w+)/i);
    const tableName = tableMatch ? tableMatch[1] : 'unknown';

    if (query.toLowerCase().includes('join')) {
      hints.push({ joinOrder: [tableName] });
    }

    return {
      query,
      usedIndexes,
      suggestedHints: hints,
    };
  }

  async optimizeQuery(query: string): Promise<QueryExecutionPlan> {
    const plan = await this.analyzeQuery(query);

    plan.estimatedCost = plan.suggestedHints.length > 0 ? 100 : 50;

    return plan;
  }

  getMetrics(): ConnectionMetrics {
    return {
      ...this.metrics,
      totalConnections: this.connections.size,
      activeConnections: this.activeConnections.size,
      idleConnections: this.idleConnections.length,
      waitingClients: this.waitingClients.size,
    };
  }

  getConnection(connectionId: string): Connection | undefined {
    return this.connections.get(connectionId);
  }

  getAllConnections(): Connection[] {
    return Array.from(this.connections.values());
  }

  getIdleConnections(): Connection[] {
    return this.idleConnections
      .map(id => this.connections.get(id))
      .filter((c): c is Connection => c !== undefined);
  }

  getActiveConnections(): Connection[] {
    return Array.from(this.activeConnections.values())
      .map(id => this.connections.get(id))
      .filter((c): c is Connection => c !== undefined);
  }

  getTransaction(connectionId: string): Transaction | undefined {
    return this.transactions.get(connectionId);
  }

  getAllTransactions(): Transaction[] {
    return Array.from(this.transactions.values());
  }

  getActiveTransactions(): Transaction[] {
    return Array.from(this.transactions.values()).filter(isTransactionActive);
  }

  private updateAverageWaitTime(newWaitTime: number): void {
    const totalWaitTime = this.metrics.averageWaitTime * (this.metrics.totalAcquired - 1) + newWaitTime;
    this.metrics.averageWaitTime = totalWaitTime / this.metrics.totalAcquired;
  }

  async drain(): Promise<void> {
    const connectionIds = Array.from(this.connections.keys());
    for (const connectionId of connectionIds) {
      await this.close(connectionId, 'pool_drain');
    }

    if (this.healthCheckIntervalId) {
      clearInterval(this.healthCheckIntervalId);
      this.healthCheckIntervalId = null;
    }

    if (this.cacheCleanupIntervalId) {
      clearInterval(this.cacheCleanupIntervalId);
      this.cacheCleanupIntervalId = null;
    }

    for (const client of this.waitingClients.values()) {
      clearTimeout(client.timeout);
      client.reject(new Error('Pool drained'));
    }
    this.waitingClients.clear();

    this.isRunning = false;
  }

  async shrink(): Promise<number> {
    const targetSize = this.config.minConnections;
    let removed = 0;

    while (this.idleConnections.length > targetSize) {
      const connectionId = this.idleConnections.pop();
      if (connectionId) {
        await this.close(connectionId, 'pool_shrink');
        removed++;
      }
    }

    return removed;
  }

  async expand(): Promise<number> {
    const targetSize = this.config.minConnections;
    const currentSize = this.connections.size;
    let added = 0;

    if (currentSize < targetSize) {
      for (let i = currentSize; i < targetSize; i++) {
        const connection = createConnection();
        this.connections.set(connection.id, connection);
        this.idleConnections.push(connection.id);
        this.metrics.totalConnections++;
        this.events.onConnectionCreated?.(connection);
        added++;
      }
    }

    return added;
  }

  clear(): void {
    this.connections.clear();
    this.idleConnections = [];
    this.activeConnections.clear();
    this.transactions.clear();
    this.preparedStatements.clear();
    this.queryCache.clear();
    this.metrics = createEmptyMetrics();
  }
}

export const connectionPool = new ConnectionPool();

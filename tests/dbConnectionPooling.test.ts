import {
  ConnectionPool,
  PoolConfig,
  Connection,
  ConnectionMetrics,
  QueryResult,
  Transaction,
  HealthCheckResult,
  PoolStrategy,
  QueryType,
  HealthCheckType,
  CachedQueryResult,
  createPoolConfig,
  createConnectionId,
  createTransactionId,
  createHealthCheckResult,
  createConnection,
  createEmptyMetrics,
  createQueryResult,
  createPreparedStatement,
  isConnectionStale,
  isConnectionHealthy,
  isValidPoolConfig,
  isValidQueryType,
  getQueryTypeFromString,
  calculateQueryCacheKey,
  isTransactionActive,
  isTransactionCompleted,
  getTransactionDuration,
  incrementStatementHitCount,
  isCachedResultExpired,
} from '../src/core/dbConnectionPooling';

describe('ConnectionPool', () => {
  let pool: ConnectionPool;

  beforeEach(async () => {
    pool = new ConnectionPool();
    await pool.initialize();
  });

  afterEach(async () => {
    await pool.drain();
    pool.clear();
  });

  describe('Pool Initialization', () => {
    test('should initialize with default config', async () => {
      const newPool = new ConnectionPool();
      await newPool.initialize();
      const connections = newPool.getAllConnections();
      expect(connections.length).toBe(5);
      await newPool.drain();
    });

    test('should initialize with custom config', async () => {
      const customPool = new ConnectionPool({
        minConnections: 3,
        maxConnections: 10,
      });
      await customPool.initialize();
      const connections = customPool.getAllConnections();
      expect(connections.length).toBe(3);
      await customPool.drain();
    });

    test('should throw error for invalid config', () => {
      expect(() => new ConnectionPool({
        minConnections: 10,
        maxConnections: 5,
      })).toThrow('Invalid pool configuration');
    });
  });

  describe('Connection Acquisition', () => {
    test('should acquire connection from pool', async () => {
      const connection = await pool.acquire();
      expect(connection).toBeDefined();
      expect(connection.id).toBeDefined();
      expect(connection.state).toBe('active');
    });

    test('should track acquired connections in metrics', async () => {
      await pool.acquire();
      await pool.acquire();
      const metrics = pool.getMetrics();
      expect(metrics.totalAcquired).toBe(2);
      expect(metrics.activeConnections).toBe(2);
    });

    test('should acquire multiple connections up to max', async () => {
      const smallPool = new ConnectionPool({
        minConnections: 1,
        maxConnections: 3,
      });
      await smallPool.initialize();

      await smallPool.acquire();
      await smallPool.acquire();
      await smallPool.acquire();

      const metrics = smallPool.getMetrics();
      expect(metrics.totalConnections).toBe(3);
      expect(metrics.activeConnections).toBe(3);

      await smallPool.drain();
    });

    test('should timeout when pool exhausted', async () => {
      const smallPool = new ConnectionPool({
        minConnections: 1,
        maxConnections: 1,
        connectionTimeout: 100,
      });
      await smallPool.initialize();

      await smallPool.acquire();

      await expect(smallPool.acquire({ timeout: 150 })).rejects.toThrow('Connection acquisition timeout');
      await smallPool.drain();
    });
  });

  describe('Connection Release', () => {
    test('should release connection back to pool', async () => {
      const connection = await pool.acquire();
      const connectionId = connection.id;
      await pool.release(connectionId);

      const released = pool.getConnection(connectionId);
      expect(released?.state).toBe('idle');
    });

    test('should track released connections in metrics', async () => {
      const connection = await pool.acquire();
      await pool.release(connection.id);

      const metrics = pool.getMetrics();
      expect(metrics.totalReleased).toBe(1);
      expect(metrics.idleConnections).toBe(5);
    });

    test('should return false for releasing non-existent connection', async () => {
      const result = await pool.release('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('Connection Closing', () => {
    test('should close connection', async () => {
      const connection = await pool.acquire();
      const connectionId = connection.id;
      await pool.close(connectionId);

      const closed = pool.getConnection(connectionId);
      expect(closed?.state).toBe('closed');
    });

    test('should track closed connections in metrics', async () => {
      const connection = await pool.acquire();
      await pool.close(connection.id);

      const metrics = pool.getMetrics();
      expect(metrics.closedConnections).toBe(1);
    });

    test('should return false for closing non-existent connection', async () => {
      const result = await pool.close('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('Query Execution', () => {
    test('should execute select query', async () => {
      const result = await pool.executeQuery<{ id: number }>('SELECT * FROM users WHERE id = $1', [1]);
      expect(result.queryType).toBe('select');
      expect(result.rows).toBeDefined();
    });

    test('should execute insert query', async () => {
      const result = await pool.executeQuery('INSERT INTO users (name) VALUES ($1)', ['John']);
      expect(result.queryType).toBe('insert');
    });

    test('should execute update query', async () => {
      const result = await pool.executeQuery('UPDATE users SET name = $1 WHERE id = $2', ['Jane', 1]);
      expect(result.queryType).toBe('update');
    });

    test('should execute delete query', async () => {
      const result = await pool.executeQuery('DELETE FROM users WHERE id = $1', [1]);
      expect(result.queryType).toBe('delete');
    });

    test('should track query count in metrics', async () => {
      await pool.executeQuery('SELECT 1');
      await pool.executeQuery('SELECT 2');

      const metrics = pool.getMetrics();
      expect(metrics.totalQueries).toBe(2);
    });

    test('should cache select query results', async () => {
      const result1 = await pool.executeQuery<{ id: number }>('SELECT * FROM users', [], { cache: true });
      const result2 = await pool.executeQuery<{ id: number }>('SELECT * FROM users', [], { cache: true });

      expect(result1.cached).toBe(false);
      expect(result2.cached).toBe(true);
    });
  });

  describe('Transaction Management', () => {
    test('should begin transaction', async () => {
      const transaction = await pool.beginTransaction();
      expect(transaction.id).toBeDefined();
      expect(transaction.status).toBe('active');
      expect(transaction.isolationLevel).toBe('read_committed');
    });

    test('should begin transaction with custom isolation level', async () => {
      const transaction = await pool.beginTransaction('serializable');
      expect(transaction.isolationLevel).toBe('serializable');
    });

    test('should commit transaction', async () => {
      const transaction = await pool.beginTransaction();
      const result = await pool.commitTransaction(transaction.connectionId);
      expect(result).toBe(true);
    });

    test('should rollback transaction', async () => {
      const transaction = await pool.beginTransaction();
      const result = await pool.rollbackTransaction(transaction.connectionId);
      expect(result).toBe(true);
    });

    test('should track transaction count in metrics', async () => {
      await pool.beginTransaction();
      await pool.beginTransaction();

      const metrics = pool.getMetrics();
      expect(metrics.totalTransactions).toBe(2);
    });

    test('should execute callback in transaction', async () => {
      const result = await pool.executeInTransaction(async (_txn) => {
        return { success: true };
      });
      expect(result).toEqual({ success: true });
    });

    test('should rollback on callback error', async () => {
      await expect(pool.executeInTransaction(async (_txn) => {
        throw new Error('Test error');
      })).rejects.toThrow('Test error');
    });

    test('should release connection after transaction commit', async () => {
      const transaction = await pool.beginTransaction();
      const connectionId = transaction.connectionId;
      await pool.commitTransaction(connectionId);

      const connection = pool.getConnection(connectionId);
      expect(connection?.state).toBe('idle');
    });

    test('should release connection after transaction rollback', async () => {
      const transaction = await pool.beginTransaction();
      const connectionId = transaction.connectionId;
      await pool.rollbackTransaction(connectionId);

      const connection = pool.getConnection(connectionId);
      expect(connection?.state).toBe('idle');
    });
  });

  describe('Health Checks', () => {
    test('should perform health check on all connections', async () => {
      const results = await pool.healthCheck();
      expect(results.length).toBeGreaterThan(0);
    });

    test('should perform health check on specific connection', async () => {
      const connection = await pool.acquire();
      const results = await pool.healthCheck(connection.id);
      expect(results).toHaveLength(1);
      expect(results[0].connectionId).toBe(connection.id);
    });

    test('should mark unhealthy connections as stale', async () => {
      const connection = await pool.acquire();
      const connectionId = connection.id;
      await pool.close(connectionId, 'manual');

      const results = await pool.healthCheck(connectionId);
      expect(results[0].healthy).toBe(false);
    });
  });

  describe('Pool Scaling', () => {
    test('should shrink pool', async () => {
      const smallPool = new ConnectionPool({
        minConnections: 2,
        maxConnections: 5,
      });
      await smallPool.initialize();

      const removed = await smallPool.shrink();
      expect(removed).toBeGreaterThanOrEqual(0);

      await smallPool.drain();
    });

    test('should expand pool', async () => {
      const smallPool = new ConnectionPool({
        minConnections: 2,
        maxConnections: 5,
      });
      await smallPool.initialize();

      const added = await smallPool.expand();
      expect(added).toBe(0);

      await smallPool.drain();
    });
  });

  describe('Metrics', () => {
    test('should return accurate metrics', async () => {
      const connection = await pool.acquire();
      const metrics = pool.getMetrics();

      expect(metrics.totalConnections).toBe(5);
      expect(metrics.activeConnections).toBe(1);
      expect(metrics.idleConnections).toBe(4);

      await pool.release(connection.id);
    });

    test('should track waiting clients', async () => {
      const smallPool = new ConnectionPool({
        minConnections: 1,
        maxConnections: 1,
        connectionTimeout: 5000,
      });
      await smallPool.initialize();

      await smallPool.acquire();

      const metrics = smallPool.getMetrics();
      expect(metrics.waitingClients).toBe(0);

      await smallPool.drain();
    });
  });

  describe('Connection Retrieval', () => {
    test('should get connection by id', async () => {
      const connection = await pool.acquire();
      const found = pool.getConnection(connection.id);
      expect(found?.id).toBe(connection.id);
    });

    test('should get all connections', () => {
      const connections = pool.getAllConnections();
      expect(connections.length).toBe(5);
    });

    test('should get idle connections', async () => {
      await pool.acquire();
      const idleConnections = pool.getIdleConnections();
      expect(idleConnections.length).toBe(4);
    });

    test('should get active connections', async () => {
      await pool.acquire();
      await pool.acquire();
      const activeConnections = pool.getActiveConnections();
      expect(activeConnections.length).toBe(2);
    });

    test('should return undefined for non-existent connection', () => {
      const connection = pool.getConnection('non-existent');
      expect(connection).toBeUndefined();
    });
  });

  describe('Transaction Retrieval', () => {
    test('should get transaction by connection id', async () => {
      const transaction = await pool.beginTransaction();
      const found = pool.getTransaction(transaction.connectionId);
      expect(found?.id).toBe(transaction.id);
    });

    test('should get all transactions', async () => {
      await pool.beginTransaction();
      await pool.beginTransaction();
      const transactions = pool.getAllTransactions();
      expect(transactions.length).toBe(2);
    });

    test('should get active transactions only', async () => {
      const tx1 = await pool.beginTransaction();
      await pool.beginTransaction();
      await pool.commitTransaction(tx1.connectionId);

      const active = pool.getActiveTransactions();
      expect(active.length).toBe(1);
    });
  });

  describe('Query Analysis', () => {
    test('should analyze query', async () => {
      const plan = await pool.analyzeQuery('SELECT * FROM users JOIN orders ON users.id = orders.user_id');
      expect(plan.query).toBeDefined();
      expect(plan.suggestedHints).toBeDefined();
    });

    test('should optimize query', async () => {
      const plan = await pool.optimizeQuery('SELECT * FROM users');
      expect(plan.query).toBeDefined();
      expect(plan.estimatedCost).toBeDefined();
    });
  });

  describe('Prepared Statements', () => {
    test('should prepare statement', async () => {
      const statement = await pool.prepareStatement('SELECT * FROM users WHERE id = $1');
      expect(statement.id).toBeDefined();
      expect(statement.query).toBe('SELECT * FROM users WHERE id = $1');
      expect(statement.queryType).toBe('select');
      expect(statement.parameterCount).toBe(1);
    });

    test('should reuse existing prepared statement', async () => {
      const statement1 = await pool.prepareStatement('SELECT * FROM users');
      const statement2 = await pool.prepareStatement('SELECT * FROM users');
      expect(statement1.id).toBe(statement2.id);
      expect(statement2.hitCount).toBe(1);
    });

    test('should throw error for non-existent statement', async () => {
      await expect(pool.executePreparedStatement('non-existent-id')).rejects.toThrow('Prepared statement non-existent-id not found');
    });
  });

  describe('Pool Drain', () => {
    test('should drain pool', async () => {
      await pool.acquire();
      await pool.drain();

      const connections = pool.getAllConnections();
      expect(connections.length).toBeGreaterThanOrEqual(0);
      expect(connections.every(c => c.state === 'closed')).toBe(true);
    });
  });

  describe('Type Helper Functions', () => {
    test('should create pool config with defaults', () => {
      const config = createPoolConfig();
      expect(config.minConnections).toBe(5);
      expect(config.maxConnections).toBe(20);
      expect(config.strategy).toBe('fifo');
    });

    test('should create pool config with overrides', () => {
      const config = createPoolConfig({ minConnections: 10 });
      expect(config.minConnections).toBe(10);
      expect(config.maxConnections).toBe(20);
    });

    test('should create connection ID with prefix', () => {
      const id = createConnectionId('conn');
      expect(id).toMatch(/^conn_[a-f0-9]{16}$/);
    });

    test('should create transaction ID', () => {
      const id = createTransactionId();
      expect(id).toMatch(/^txn_[a-f0-9]{16}$/);
    });

    test('should create health check result', () => {
      const result = createHealthCheckResult('conn1', 'ping', true, 10);
      expect(result.connectionId).toBe('conn1');
      expect(result.healthy).toBe(true);
      expect(result.latency).toBe(10);
      expect(result.checkType).toBe('ping');
    });

    test('should detect stale connection', () => {
      const oldConnection = createConnection();
      oldConnection.lastUsedAt = Date.now() - 120000;

      expect(isConnectionStale(oldConnection, 60000, 3600000)).toBe(true);
    });

    test('should detect healthy connection', () => {
      const connection = createConnection();
      expect(isConnectionHealthy(connection, 30000)).toBe(true);
    });

    test('should validate pool config - valid', () => {
      const config = createPoolConfig();
      expect(isValidPoolConfig(config)).toBe(true);
    });

    test('should validate pool config - invalid maxConnections', () => {
      const config = { ...createPoolConfig(), maxConnections: 0 };
      expect(isValidPoolConfig(config)).toBe(false);
    });

    test('should validate pool config - invalid strategy', () => {
      const config = { ...createPoolConfig(), strategy: 'invalid' as PoolStrategy };
      expect(isValidPoolConfig(config)).toBe(false);
    });

    test('should validate query type', () => {
      expect(isValidQueryType('select')).toBe(true);
      expect(isValidQueryType('insert')).toBe(true);
      expect(isValidQueryType('invalid')).toBe(false);
    });

    test('should get query type from string', () => {
      expect(getQueryTypeFromString('SELECT * FROM users')).toBe('select');
      expect(getQueryTypeFromString('INSERT INTO users')).toBe('insert');
      expect(getQueryTypeFromString('UPDATE users')).toBe('update');
      expect(getQueryTypeFromString('DELETE FROM users')).toBe('delete');
      expect(getQueryTypeFromString('UNKNOWN')).toBe('select');
    });

    test('should calculate query cache key', () => {
      const key1 = calculateQueryCacheKey('SELECT * FROM users', [1, 'test']);
      const key2 = calculateQueryCacheKey('SELECT * FROM users', [1, 'test']);
      const key3 = calculateQueryCacheKey('SELECT * FROM users', [2, 'test']);
      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });

    test('should detect active transaction', () => {
      const transaction: Transaction = {
        id: 'txn1',
        connectionId: 'conn1',
        isolationLevel: 'read_committed',
        startedAt: Date.now(),
        status: 'active',
        queries: [],
      };
      expect(isTransactionActive(transaction)).toBe(true);
      expect(isTransactionCompleted(transaction)).toBe(false);
    });

    test('should detect completed transaction', () => {
      const transaction: Transaction = {
        id: 'txn1',
        connectionId: 'conn1',
        isolationLevel: 'read_committed',
        startedAt: Date.now(),
        status: 'committed',
        queries: [],
      };
      expect(isTransactionActive(transaction)).toBe(false);
      expect(isTransactionCompleted(transaction)).toBe(true);
    });

    test('should get transaction duration', () => {
      const transaction: Transaction = {
        id: 'txn1',
        connectionId: 'conn1',
        isolationLevel: 'read_committed',
        startedAt: Date.now() - 5000,
        status: 'active',
        queries: [],
      };
      const duration = getTransactionDuration(transaction);
      expect(duration).toBeGreaterThanOrEqual(5000);
    });

    test('should create empty metrics', () => {
      const metrics = createEmptyMetrics();
      expect(metrics.totalConnections).toBe(0);
      expect(metrics.activeConnections).toBe(0);
    });

    test('should create query result', () => {
      const result = createQueryResult<{ id: number }>('select', [{ id: 1 }], 100);
      expect(result.rows).toHaveLength(1);
      expect(result.executionTime).toBe(100);
      expect(result.cached).toBe(false);
    });

    test('should create prepared statement', () => {
      const statement = createPreparedStatement('SELECT * FROM users', 'select', 2);
      expect(statement.queryType).toBe('select');
      expect(statement.parameterCount).toBe(2);
      expect(statement.hitCount).toBe(0);
    });

    test('should increment statement hit count', () => {
      const statement = createPreparedStatement('SELECT * FROM users', 'select', 0);
      const updated = incrementStatementHitCount(statement);
      expect(updated.hitCount).toBe(1);
      expect(updated.lastUsedAt).toBeGreaterThanOrEqual(statement.cachedAt);
    });

    test('should detect cached result expiration', () => {
      const cached: CachedQueryResult = {
        key: 'test',
        result: createQueryResult('select', [], 0),
        cachedAt: Date.now() - 2000,
        expiresAt: Date.now() - 1000,
        hitCount: 1,
      };
      expect(isCachedResultExpired(cached)).toBe(true);
    });
  });
});

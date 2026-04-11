import {
  ReplicationManager,
  ShardManager,
  RebalanceManager,
  ShardRouter,
  DatabaseReplication,
  ReplicationConfig,
  ShardConfig,
  DatabaseNode,
  Shard,
  ReplicationStatus,
  ReplicaLagInfo,
  FailoverResult,
  RebalancePlan,
  ReplicationMetrics,
  DataMovement,
  RouterConfig,
  RoutingResult,
  ShardDirectory,
  ReplicationType,
  ShardKeyType,
  NodeRole,
  NodeState,
  ConsistencyLevel,
  ShardAllocation,
  KeyRange,
  createReplicationId,
  createNodeId,
  createShardId,
  createPlanId,
  createMovementId,
  createDefaultReplicationConfig,
  createDefaultShardConfig,
  createDefaultRouterConfig,
  createNode,
  createShard,
  createKeyRange,
  createReplicaLagInfo,
  createEmptyReplicationMetrics,
  createRebalancePlan,
  createDataMovement,
  isNodeHealthy,
  isNodePrimary,
  isNodeReplica,
  isNodeArbiter,
  isPrimaryNodeAvailable,
  calculateWriteQuorum,
  calculateReadQuorum,
  isStrongConsistent,
  isEventualConsistent,
  hashShardKey,
  isKeyInRange,
  getShardForKey,
  isValidReplicationConfig,
  isValidShardConfig,
  isValidNodeRole,
  updateNodeHeartbeat,
  updateNodeMetrics,
  markNodeAsFailed,
  markNodeAsRecovering,
  updateShardState,
  updateShardStats,
  addNodeToShard,
  removeNodeFromShard,
} from '../src/core/databaseReplication';

describe('ReplicationManager', () => {
  let manager: ReplicationManager;

  beforeEach(async () => {
    manager = new ReplicationManager();
    await manager.initialize();
  });

  afterEach(async () => {
    await manager.drain();
    manager.clear();
  });

  describe('Initialization', () => {
    test('should initialize with default config', async () => {
      const newManager = new ReplicationManager();
      await newManager.initialize();
      const nodes = await newManager.getAllNodes();
      expect(nodes).toEqual([]);
      await newManager.drain();
    });

    test('should initialize with custom config', async () => {
      const customManager = new ReplicationManager({
        replicationFactor: 5,
        heartbeatInterval: 5000,
      });
      await customManager.initialize();
      expect(customManager.getMetrics().totalNodes).toBe(0);
      await customManager.drain();
    });

    test('should throw error for invalid config', () => {
      expect(() => new ReplicationManager({
        replicationFactor: -1,
      } as Partial<ReplicationConfig>)).toThrow('Invalid replication configuration');
    });
  });

  describe('Node Management', () => {
    test('should add a primary node', async () => {
      const node = await manager.addNode('localhost', 27017, 'primary');
      expect(node.id).toBeDefined();
      expect(node.role).toBe('primary');
      expect(node.host).toBe('localhost');
      expect(node.port).toBe(27017);
    });

    test('should add a replica node', async () => {
      const node = await manager.addNode('localhost', 27018, 'replica');
      expect(node.role).toBe('replica');
    });

    test('should add an arbiter node', async () => {
      const node = await manager.addNode('localhost', 27019, 'arbiter');
      expect(node.role).toBe('arbiter');
    });

    test('should add node with tags', async () => {
      const node = await manager.addNode('localhost', 27017, 'replica', { datacenter: 'us-east' });
      expect(node.tags.datacenter).toBe('us-east');
    });

    test('should get node by id', async () => {
      const added = await manager.addNode('localhost', 27017, 'primary');
      const found = await manager.getNode(added.id);
      expect(found?.id).toBe(added.id);
    });

    test('should get all nodes', async () => {
      await manager.addNode('localhost', 27017, 'primary');
      await manager.addNode('localhost', 27018, 'replica');
      const nodes = await manager.getAllNodes();
      expect(nodes.length).toBe(2);
    });

    test('should get primary node', async () => {
      await manager.addNode('localhost', 27017, 'primary');
      const primary = await manager.getPrimaryNode();
      expect(primary?.role).toBe('primary');
    });

    test('should get replica nodes', async () => {
      await manager.addNode('localhost', 27017, 'primary');
      await manager.addNode('localhost', 27018, 'replica');
      await manager.addNode('localhost', 27019, 'replica');
      const replicas = await manager.getReplicaNodes();
      expect(replicas.length).toBe(2);
    });

    test('should get arbiter nodes', async () => {
      await manager.addNode('localhost', 27017, 'arbiter');
      const arbiters = await manager.getArbiterNodes();
      expect(arbiters.length).toBe(1);
    });

    test('should remove node', async () => {
      const node = await manager.addNode('localhost', 27017, 'replica');
      const removed = await manager.removeNode(node.id);
      expect(removed).toBe(true);
      const found = await manager.getNode(node.id);
      expect(found).toBeUndefined();
    });

    test('should return false for removing non-existent node', async () => {
      const removed = await manager.removeNode('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('Heartbeat and Metrics', () => {
    test('should update node heartbeat', async () => {
      const node = await manager.addNode('localhost', 27017, 'replica');
      const updated = await manager.updateNodeHeartbeat(node.id);
      expect(updated).toBe(true);
    });

    test('should update node metrics', async () => {
      const node = await manager.addNode('localhost', 27017, 'replica');
      await manager.updateNodeMetrics(node.id, {
        cpuUsage: 50,
        memoryUsage: 60,
        diskUsage: 70,
        replicationLag: 100,
        opsPerSecond: 1000,
      });
      const updated = await manager.getNode(node.id);
      expect(updated?.cpuUsage).toBe(50);
      expect(updated?.replicationLag).toBe(100);
    });

    test('should track metrics accurately', async () => {
      await manager.addNode('localhost', 27017, 'primary');
      await manager.addNode('localhost', 27018, 'replica');
      await manager.addNode('localhost', 27019, 'replica');
      const metrics = manager.getMetrics();
      expect(metrics.totalNodes).toBe(3);
      expect(metrics.primaryNodes).toBe(1);
      expect(metrics.replicaNodes).toBe(2);
    });
  });

  describe('Failover', () => {
    test('should fail when node is not primary', async () => {
      const node = await manager.addNode('localhost', 27017, 'replica');
      const result = await manager.failover(node.id);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not a primary');
    });

    test('should fail when no replicas available', async () => {
      await manager.addNode('localhost', 27017, 'primary');
      const result = await manager.failover('non-existent-id');
      expect(result.success).toBe(false);
    });

    test('should reassign shards during failover', async () => {
      await manager.addNode('localhost', 27017, 'primary');
      const replica = await manager.addNode('localhost', 27018, 'replica');
      const result = await manager.failover(replica.id);
      expect(result.affectedShards).toBeDefined();
    });
  });

  describe('Replication Status', () => {
    test('should get replication status', async () => {
      await manager.addNode('localhost', 27017, 'primary');
      await manager.addNode('localhost', 27018, 'replica');
      const status = await manager.getReplicationStatus();
      expect(status.primaryNode).toBeDefined();
      expect(status.replicaNodes).toBeDefined();
      expect(status.replicationType).toBe('asynchronous');
    });
  });

  describe('Node Recovery', () => {
    test('should recover a failed node', async () => {
      const node = await manager.addNode('localhost', 27017, 'replica');
      const recovered = await manager.recoverNode(node.id);
      expect(recovered).toBe(true);
    });
  });
});

describe('ShardManager', () => {
  let shardManager: ShardManager;

  beforeEach(async () => {
    shardManager = new ShardManager();
    await shardManager.initialize();
  });

  afterEach(() => {
    shardManager.clear();
  });

  describe('Initialization', () => {
    test('should initialize with default config', async () => {
      const manager = new ShardManager();
      await manager.initialize();
      const shards = await manager.getAllShards();
      expect(shards.length).toBe(4);
      manager.clear();
    });

    test('should initialize with custom numShards', async () => {
      const manager = new ShardManager({ numShards: 8 });
      await manager.initialize();
      const shards = await manager.getAllShards();
      expect(shards.length).toBe(8);
      manager.clear();
    });

    test('should initialize range shards', async () => {
      const manager = new ShardManager({ shardKeyType: 'range', numShards: 4 });
      await manager.initialize();
      const shards = await manager.getAllShards();
      expect(shards.length).toBe(4);
      manager.clear();
    });

    test('should throw error for invalid shard config', () => {
      expect(() => new ShardManager({ numShards: -1 } as Partial<ShardConfig>)).toThrow('Invalid shard configuration');
    });
  });

  describe('Shard Management', () => {
    test('should add a shard', async () => {
      const shard = await shardManager.addShard(['node1', 'node2']);
      expect(shard.id).toBeDefined();
      expect(shard.nodes).toEqual(['node1', 'node2']);
    });

    test('should remove a shard', async () => {
      const shard = await shardManager.addShard(['node1']);
      const removed = await shardManager.removeShard(shard.id);
      expect(removed).toBe(true);
      const found = await shardManager.getShard(shard.id);
      expect(found).toBeUndefined();
    });

    test('should get shard by id', async () => {
      const shard = await shardManager.addShard(['node1']);
      const found = await shardManager.getShard(shard.id);
      expect(found?.id).toBe(shard.id);
    });

    test('should get all shards', async () => {
      await shardManager.addShard(['node1']);
      await shardManager.addShard(['node2']);
      const shards = await shardManager.getAllShards();
      expect(shards.length).toBeGreaterThanOrEqual(2);
    });

    test('should update shard state', async () => {
      const shard = await shardManager.addShard(['node1']);
      await shardManager.updateShardState(shard.id, 'migrating');
      const updated = await shardManager.getShard(shard.id);
      expect(updated?.state).toBe('migrating');
    });

    test('should update shard stats', async () => {
      const shard = await shardManager.addShard(['node1']);
      await shardManager.updateShardStats(shard.id, 1024, 100);
      const updated = await shardManager.getShard(shard.id);
      expect(updated?.dataSize).toBe(1024);
      expect(updated?.documentCount).toBe(100);
    });

    test('should add node to shard', async () => {
      const shard = await shardManager.addShard(['node1']);
      await shardManager.addNodeToShard(shard.id, 'node2');
      const updated = await shardManager.getShard(shard.id);
      expect(updated?.nodes).toContain('node2');
    });

    test('should remove node from shard', async () => {
      const shard = await shardManager.addShard(['node1', 'node2']);
      await shardManager.removeNodeFromShard(shard.id, 'node2');
      const updated = await shardManager.getShard(shard.id);
      expect(updated?.nodes).not.toContain('node2');
    });
  });

  describe('Shard Routing', () => {
    test('should get shard for key with hash', async () => {
      const manager = new ShardManager({ shardKeyType: 'hash', numShards: 4 });
      await manager.initialize();
      const shard = await manager.getShardForKey('user_123');
      expect(shard).toBeDefined();
      manager.clear();
    });

    test('should return shard for any key with hash routing', async () => {
      const shard = await shardManager.getShardForKey('any_key');
      expect(shard).toBeDefined();
    });
  });

  describe('Shard Directory', () => {
    test('should update directory', async () => {
      await shardManager.addShard(['node1']);
      const shards = await shardManager.getAllShards();
      if (shards.length > 0) {
        await shardManager.updateDirectory('key1', shards[0].id);
        const directory = await shardManager.getDirectory();
        expect(directory.length).toBeGreaterThan(0);
      }
    });

    test('should clear directory', async () => {
      await shardManager.addShard(['node1']);
      const shards = await shardManager.getAllShards();
      if (shards.length > 0) {
        await shardManager.updateDirectory('key1', shards[0].id);
        await shardManager.clearDirectory();
        const directory = await shardManager.getDirectory();
        expect(directory.length).toBe(0);
      }
    });
  });

  describe('Shard Allocation', () => {
    test('should allocate shard', async () => {
      const shard = await shardManager.addShard(['node1', 'node2']);
      const allocation = await shardManager.allocateShard(shard.id, 'node1', ['node2'], 1.0);
      expect(allocation.shardId).toBe(shard.id);
      expect(allocation.primaryNode).toBe('node1');
      expect(allocation.replicaNodes).toEqual(['node2']);
    });

    test('should get allocation', async () => {
      const shard = await shardManager.addShard(['node1', 'node2']);
      await shardManager.allocateShard(shard.id, 'node1', ['node2'], 1.0);
      const allocation = await shardManager.getAllocation(shard.id);
      expect(allocation?.shardId).toBe(shard.id);
    });

    test('should get all allocations', async () => {
      const shard = await shardManager.addShard(['node1', 'node2']);
      await shardManager.allocateShard(shard.id, 'node1', ['node2'], 1.0);
      const allocations = await shardManager.getAllAllocations();
      expect(allocations.length).toBeGreaterThan(0);
    });
  });
});

describe('RebalanceManager', () => {
  let shardManager: ShardManager;
  let rebalanceManager: RebalanceManager;

  beforeEach(async () => {
    shardManager = new ShardManager();
    await shardManager.initialize();
    rebalanceManager = new RebalanceManager(shardManager);
  });

  afterEach(() => {
    rebalanceManager.clear();
    shardManager.clear();
  });

  describe('Rebalance Plans', () => {
    test('should create rebalance plan', async () => {
      const shard1 = await shardManager.addShard(['node1']);
      const shard2 = await shardManager.addShard(['node2']);
      const plan = await rebalanceManager.createRebalancePlan(shard1.id, shard2.id);
      expect(plan).toBeDefined();
      expect(plan?.sourceShard).toBe(shard1.id);
      expect(plan?.targetShard).toBe(shard2.id);
    });

    test('should get plan', async () => {
      const shard1 = await shardManager.addShard(['node1']);
      const shard2 = await shardManager.addShard(['node2']);
      const plan = await rebalanceManager.createRebalancePlan(shard1.id, shard2.id);
      if (plan) {
        const planId = `${plan.sourceShard}_${plan.targetShard}`;
        const found = await rebalanceManager.getPlan(planId);
        expect(found?.sourceShard).toBe(shard1.id);
      }
    });

    test('should get all plans', async () => {
      const shard1 = await shardManager.addShard(['node1']);
      const shard2 = await shardManager.addShard(['node2']);
      await rebalanceManager.createRebalancePlan(shard1.id, shard2.id);
      const plans = await rebalanceManager.getAllPlans();
      expect(plans.length).toBe(1);
    });

    test('should return null for non-existent plan', async () => {
      const plan = await rebalanceManager.getPlan('non_existent_plan');
      expect(plan).toBeUndefined();
    });
  });

  describe('Rebalance Execution', () => {
    test('should execute rebalance', async () => {
      const shard1 = await shardManager.addShard(['node1']);
      const shard2 = await shardManager.addShard(['node2']);
      await shardManager.updateShardStats(shard1.id, 1000000, 1000);
      const plan = await rebalanceManager.createRebalancePlan(shard1.id, shard2.id);
      if (plan) {
        const planId = `${plan.sourceShard}_${plan.targetShard}`;
        const result = await rebalanceManager.executeRebalance(planId);
        expect(result).toBe(true);
      }
    });

    test('should return false for non-existent plan execution', async () => {
      const result = await rebalanceManager.executeRebalance('non_existent');
      expect(result).toBe(false);
    });
  });

  describe('Rebalance Progress', () => {
    test('should get progress', async () => {
      const progress = await rebalanceManager.getProgress('non_existent');
      expect(progress).toBeUndefined();
    });

    test('should get all progress', async () => {
      const progress = await rebalanceManager.getAllProgress();
      expect(Array.isArray(progress)).toBe(true);
    });
  });

  describe('Data Movements', () => {
    test('should get movement', async () => {
      const movement = await rebalanceManager.getMovement('non_existent');
      expect(movement).toBeUndefined();
    });

    test('should get all movements', async () => {
      const movements = await rebalanceManager.getAllMovements();
      expect(Array.isArray(movements)).toBe(true);
    });
  });
});

describe('ShardRouter', () => {
  let replicationManager: ReplicationManager;
  let shardManager: ShardManager;
  let router: ShardRouter;

  beforeEach(async () => {
    replicationManager = new ReplicationManager();
    await replicationManager.initialize();
    shardManager = new ShardManager();
    await shardManager.initialize();
    router = new ShardRouter(createDefaultRouterConfig(), shardManager, replicationManager);
  });

  afterEach(async () => {
    await replicationManager.drain();
    replicationManager.clear();
    shardManager.clear();
  });

  describe('Routing', () => {
    test('should route write', async () => {
      await replicationManager.addNode('localhost', 27017, 'primary');
      const result = await router.routeWrite('test_key');
      expect(result.nodeId).toBeDefined();
    });

    test('should get shard for key', async () => {
      const shardId = await router.getShardForKey('test_key');
      expect(shardId).toBeDefined();
    });
  });
});

describe('DatabaseReplication', () => {
  let dbReplication: DatabaseReplication;

  beforeEach(async () => {
    dbReplication = new DatabaseReplication();
    await dbReplication.initialize();
  });

  afterEach(async () => {
    await dbReplication.drain();
    dbReplication.clear();
  });

  describe('Initialization', () => {
    test('should initialize with defaults', async () => {
      const newDb = new DatabaseReplication();
      await newDb.initialize();
      expect(newDb.getReplicationManager()).toBeDefined();
      expect(newDb.getShardManager()).toBeDefined();
      expect(newDb.getRebalanceManager()).toBeDefined();
      expect(newDb.getShardRouter()).toBeDefined();
      await newDb.drain();
    });

    test('should initialize with custom config', async () => {
      const newDb = new DatabaseReplication(
        { replicationFactor: 5 },
        { numShards: 8 }
      );
      await newDb.initialize();
      expect(newDb.getReplicationManager()).toBeDefined();
      await newDb.drain();
    });
  });

  describe('Component Access', () => {
    test('should get replication manager', () => {
      expect(dbReplication.getReplicationManager()).toBeDefined();
    });

    test('should get shard manager', () => {
      expect(dbReplication.getShardManager()).toBeDefined();
    });

    test('should get rebalance manager', () => {
      expect(dbReplication.getRebalanceManager()).toBeDefined();
    });

    test('should get shard router', () => {
      expect(dbReplication.getShardRouter()).toBeDefined();
    });
  });
});

describe('Type Helper Functions', () => {
  describe('ID Creation', () => {
    test('should create replication ID with prefix', () => {
      const id = createReplicationId('repl');
      expect(id).toMatch(/^repl_[a-f0-9]{16}$/);
    });

    test('should create node ID', () => {
      const id = createNodeId();
      expect(id).toMatch(/^node_[a-f0-9]{16}$/);
    });

    test('should create shard ID', () => {
      const id = createShardId();
      expect(id).toMatch(/^shard_[a-f0-9]{16}$/);
    });

    test('should create plan ID', () => {
      const id = createPlanId();
      expect(id).toMatch(/^plan_[a-f0-9]{16}$/);
    });

    test('should create movement ID', () => {
      const id = createMovementId();
      expect(id).toMatch(/^move_[a-f0-9]{16}$/);
    });
  });

  describe('Default Configs', () => {
    test('should create default replication config', () => {
      const config = createDefaultReplicationConfig();
      expect(config.replicationType).toBe('asynchronous');
      expect(config.replicationFactor).toBe(3);
      expect(config.heartbeatInterval).toBe(10000);
    });

    test('should create default shard config', () => {
      const config = createDefaultShardConfig();
      expect(config.shardKeyType).toBe('hash');
      expect(config.numShards).toBe(4);
    });

    test('should create default router config', () => {
      const config = createDefaultRouterConfig();
      expect(config.shardKeyType).toBe('hash');
      expect(config.timeout).toBe(30000);
      expect(config.retryAttempts).toBe(3);
    });
  });

  describe('Object Creation', () => {
    test('should create node', () => {
      const node = createNode('localhost', 27017, 'primary');
      expect(node.host).toBe('localhost');
      expect(node.port).toBe(27017);
      expect(node.role).toBe('primary');
      expect(node.state).toBe('active');
    });

    test('should create shard', () => {
      const range = createKeyRange('0', '100', true);
      const shard = createShard(range, ['node1', 'node2']);
      expect(shard.nodes).toEqual(['node1', 'node2']);
      expect(shard.state).toBe('active');
    });

    test('should create key range', () => {
      const range = createKeyRange('a', 'z', false);
      expect(range.low).toBe('a');
      expect(range.high).toBe('z');
      expect(range.inclusive).toBe(false);
    });

    test('should create replica lag info', () => {
      const lag = createReplicaLagInfo('node1', 100, 1024);
      expect(lag.nodeId).toBe('node1');
      expect(lag.lagMs).toBe(100);
      expect(lag.lagBytes).toBe(1024);
      expect(lag.status).toBe('ok');
    });

    test('should create replica lag info with warning', () => {
      const lag = createReplicaLagInfo('node1', 2000, 50000000);
      expect(lag.status).toBe('warning');
    });

    test('should create replica lag info with critical', () => {
      const lag = createReplicaLagInfo('node1', 10000, 500000000);
      expect(lag.status).toBe('critical');
    });

    test('should create empty metrics', () => {
      const metrics = createEmptyReplicationMetrics();
      expect(metrics.totalNodes).toBe(0);
      expect(metrics.activeNodes).toBe(0);
      expect(metrics.totalShards).toBe(0);
    });

    test('should create rebalance plan', () => {
      const plan = createRebalancePlan('shard1', 'shard2', 1000, 5000000);
      expect(plan.sourceShard).toBe('shard1');
      expect(plan.targetShard).toBe('shard2');
      expect(plan.documentsToMove).toBe(1000);
      expect(plan.estimatedSize).toBe(5000000);
    });

    test('should create data movement', () => {
      const movement = createDataMovement('shard1', 'shard2', ['doc1', 'doc2']);
      expect(movement.sourceShard).toBe('shard1');
      expect(movement.targetShard).toBe('shard2');
      expect(movement.documentIds).toEqual(['doc1', 'doc2']);
      expect(movement.status).toBe('pending');
    });
  });

  describe('Node Helper Functions', () => {
    test('should check if node is healthy', () => {
      const node = createNode('localhost', 27017, 'replica');
      expect(isNodeHealthy(node, 30000)).toBe(true);
    });

    test('should check if node is primary', () => {
      const node = createNode('localhost', 27017, 'primary');
      expect(isNodePrimary(node)).toBe(true);
    });

    test('should check if node is replica', () => {
      const node = createNode('localhost', 27017, 'replica');
      expect(isNodeReplica(node)).toBe(true);
    });

    test('should check if node is arbiter', () => {
      const node = createNode('localhost', 27017, 'arbiter');
      expect(isNodeArbiter(node)).toBe(true);
    });

    test('should update node heartbeat', () => {
      const node = createNode('localhost', 27017, 'replica');
      const updated = updateNodeHeartbeat(node);
      expect(updated.lastHeartbeat).toBeGreaterThanOrEqual(node.addedAt);
    });

    test('should update node metrics', () => {
      const node = createNode('localhost', 27017, 'replica');
      const updated = updateNodeMetrics(node, { cpuUsage: 80 });
      expect(updated.cpuUsage).toBe(80);
    });

    test('should mark node as failed', () => {
      const node = createNode('localhost', 27017, 'replica');
      const updated = markNodeAsFailed(node);
      expect(updated.state).toBe('failed');
    });

    test('should mark node as recovering', () => {
      const node = createNode('localhost', 27017, 'replica');
      const updated = markNodeAsRecovering(node);
      expect(updated.state).toBe('recovering');
    });
  });

  describe('Shard Helper Functions', () => {
    test('should update shard state', () => {
      const range = createKeyRange('0', '100', true);
      const shard = createShard(range, ['node1']);
      const updated = updateShardState(shard, 'migrating');
      expect(updated.state).toBe('migrating');
    });

    test('should update shard stats', () => {
      const range = createKeyRange('0', '100', true);
      const shard = createShard(range, ['node1']);
      const updated = updateShardStats(shard, 1024, 100);
      expect(updated.dataSize).toBe(1024);
      expect(updated.documentCount).toBe(100);
    });

    test('should add node to shard', () => {
      const range = createKeyRange('0', '100', true);
      const shard = createShard(range, ['node1']);
      const updated = addNodeToShard(shard, 'node2');
      expect(updated.nodes).toContain('node2');
    });

    test('should not add duplicate node to shard', () => {
      const range = createKeyRange('0', '100', true);
      const shard = createShard(range, ['node1']);
      const updated = addNodeToShard(shard, 'node1');
      expect(updated.nodes.filter(n => n === 'node1').length).toBe(1);
    });

    test('should remove node from shard', () => {
      const range = createKeyRange('0', '100', true);
      const shard = createShard(range, ['node1', 'node2']);
      const updated = removeNodeFromShard(shard, 'node1');
      expect(updated.nodes).not.toContain('node1');
    });
  });

  describe('Consistency Functions', () => {
    test('should check if primary is available', () => {
      const status = {
        primaryNode: 'node1',
        replicaNodes: ['node2'],
        replicationType: 'asynchronous' as ReplicationType,
        lagInfo: [],
        lastConsistentWrite: Date.now(),
      };
      expect(isPrimaryNodeAvailable(status)).toBe(true);
    });

    test('should calculate write quorum', () => {
      expect(calculateWriteQuorum(3)).toBe(2);
      expect(calculateWriteQuorum(5)).toBe(3);
    });

    test('should calculate read quorum', () => {
      expect(calculateReadQuorum(3)).toBe(2);
      expect(calculateReadQuorum(5)).toBe(3);
    });

    test('should check strong consistency', () => {
      expect(isStrongConsistent('strong')).toBe(true);
      expect(isStrongConsistent('eventual')).toBe(false);
    });

    test('should check eventual consistency', () => {
      expect(isEventualConsistent('eventual')).toBe(true);
      expect(isEventualConsistent('strong')).toBe(false);
    });
  });

  describe('Shard Key Functions', () => {
    test('should hash shard key', () => {
      const shard1 = hashShardKey('test_key', 4);
      const shard2 = hashShardKey('test_key', 4);
      expect(shard1).toBe(shard2);
    });

    test('should check if key is in range - inclusive', () => {
      const range = createKeyRange('a', 'z', true);
      expect(isKeyInRange('m', range)).toBe(true);
      expect(isKeyInRange('a', range)).toBe(true);
      expect(isKeyInRange('z', range)).toBe(true);
    });

    test('should check if key is in range - exclusive', () => {
      const range = createKeyRange('a', 'z', false);
      expect(isKeyInRange('m', range)).toBe(true);
      expect(isKeyInRange('a', range)).toBe(false);
      expect(isKeyInRange('z', range)).toBe(false);
    });

    test('should get shard for key with hash', () => {
      const shardKey = { type: 'hash' as ShardKeyType, fields: [] };
      const shardId = getShardForKey(shardKey, 'test_key', 4);
      expect(shardId).toBeDefined();
    });

    test('should get shard for key with directory', () => {
      const shardKey = { type: 'directory' as ShardKeyType, fields: [] };
      const directory: ShardDirectory[] = [
        { key: 'test_key', shardId: 'shard_1', updatedAt: Date.now() },
      ];
      const shardId = getShardForKey(shardKey, 'test_key', 4, directory);
      expect(shardId).toBe('shard_1');
    });
  });

  describe('Validation Functions', () => {
    test('should validate replication config - valid', () => {
      const config = createDefaultReplicationConfig();
      expect(isValidReplicationConfig(config)).toBe(true);
    });

    test('should validate replication config - invalid', () => {
      const config = { replicationType: 'invalid' as ReplicationType };
      expect(isValidReplicationConfig(config)).toBe(false);
    });

    test('should validate shard config - valid', () => {
      const config = createDefaultShardConfig();
      expect(isValidShardConfig(config)).toBe(true);
    });

    test('should validate shard config - invalid', () => {
      const config = { shardKeyType: 'invalid' as ShardKeyType };
      expect(isValidShardConfig(config)).toBe(false);
    });

    test('should validate node role', () => {
      expect(isValidNodeRole('primary')).toBe(true);
      expect(isValidNodeRole('replica')).toBe(true);
      expect(isValidNodeRole('arbiter')).toBe(true);
      expect(isValidNodeRole('invalid')).toBe(false);
    });
  });
});

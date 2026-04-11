import type {
  ReplicationConfig,
  ShardConfig,
  DatabaseNode,
  Shard,
  ReplicationStatus,
  ReplicaLagInfo,
  FailoverResult,
  RebalancePlan,
  RebalanceProgress,
  ReplicationMetrics,
  DataMovement,
  RouterConfig,
  RoutingResult,
  ShardDirectory,
  ShardKey,
  ShardAllocation,
  NodeRole,
  FailoverStatus,
} from './types';

import {
  createNode,
  createShard,
  createKeyRange,
  createReplicaLagInfo,
  createEmptyReplicationMetrics,
  createRebalancePlan,
  createDataMovement,
  createDefaultReplicationConfig,
  createDefaultShardConfig,
  createDefaultRouterConfig,
  isNodePrimary,
  isValidReplicationConfig,
  isValidShardConfig,
  getShardForKey,
  updateNodeHeartbeat,
  updateNodeMetrics,
  markNodeAsFailed,
  markNodeAsRecovering,
  updateShardState,
  updateShardStats,
  addNodeToShard,
  removeNodeFromShard,
} from './types';

export interface ReplicationEvents {
  onNodeAdded?: (node: DatabaseNode) => void;
  onNodeRemoved?: (node: DatabaseNode) => void;
  onNodeFailed?: (node: DatabaseNode) => void;
  onNodeRecovered?: (node: DatabaseNode) => void;
  onPrimaryChanged?: (oldPrimary: string, newPrimary: string) => void;
  onFailoverStart?: (oldPrimary: string) => void;
  onFailoverComplete?: (result: FailoverResult) => void;
  onRebalanceStart?: (plans: RebalancePlan[]) => void;
  onRebalanceProgress?: (progress: RebalanceProgress) => void;
  onRebalanceComplete?: (success: boolean) => void;
  onShardMigrating?: (shard: Shard, targetNode: string) => void;
  onShardMigrated?: (shard: Shard) => void;
  onReplicaLagWarning?: (nodeId: string, lag: ReplicaLagInfo) => void;
}

export class ReplicationManager {
  private config: ReplicationConfig;
  private nodes: Map<string, DatabaseNode> = new Map();
  private shards: Map<string, Shard> = new Map();
  private shardDirectory: ShardDirectory[] = [];
  private primaryNode: string | null = null;
  private replicaNodes: Set<string> = new Set();
  private arbiterNodes: Set<string> = new Set();
  private replicationStatus: ReplicationStatus | null = null;
  private failoverInProgress: boolean = false;
  private failoverStatus: FailoverStatus = 'not_needed';
  private rebalancePlans: RebalancePlan[] = [];
  private rebalanceProgress: Map<string, RebalanceProgress> = new Map();
  private dataMovements: Map<string, DataMovement> = new Map();
  private metrics: ReplicationMetrics;
  private events: ReplicationEvents;
  private heartbeatIntervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(config?: Partial<ReplicationConfig>, events?: ReplicationEvents) {
    const fullConfig = { ...createDefaultReplicationConfig(), ...config };
    if (!isValidReplicationConfig(fullConfig)) {
      throw new Error('Invalid replication configuration');
    }
    this.config = fullConfig;
    this.metrics = createEmptyReplicationMetrics();
    this.events = events || {};
  }

  async initialize(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startHeartbeatMonitor();
  }

  async addNode(host: string, port: number, role: NodeRole = 'replica', tags?: Record<string, string>): Promise<DatabaseNode> {
    const node = createNode(host, port, role, tags);
    this.nodes.set(node.id, node);

    if (role === 'primary' && !this.primaryNode) {
      this.primaryNode = node.id;
    } else if (role === 'replica') {
      this.replicaNodes.add(node.id);
    } else if (role === 'arbiter') {
      this.arbiterNodes.add(node.id);
    }

    this.updateMetrics();
    this.events.onNodeAdded?.(node);

    return node;
  }

  async removeNode(nodeId: string): Promise<boolean> {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    if (this.primaryNode === nodeId) {
      this.primaryNode = null;
    }
    this.replicaNodes.delete(nodeId);
    this.arbiterNodes.delete(nodeId);

    for (const shard of this.shards.values()) {
      if (shard.nodes.includes(nodeId)) {
        removeNodeFromShard(shard, nodeId);
      }
    }

    this.nodes.delete(nodeId);
    this.updateMetrics();
    this.events.onNodeRemoved?.(node);

    return true;
  }

  async getNode(nodeId: string): Promise<DatabaseNode | undefined> {
    return this.nodes.get(nodeId);
  }

  async getAllNodes(): Promise<DatabaseNode[]> {
    return Array.from(this.nodes.values());
  }

  async getPrimaryNode(): Promise<DatabaseNode | undefined> {
    if (!this.primaryNode) return undefined;
    return this.nodes.get(this.primaryNode);
  }

  async getReplicaNodes(): Promise<DatabaseNode[]> {
    return Array.from(this.replicaNodes).map(id => this.nodes.get(id)).filter((n): n is DatabaseNode => n !== undefined);
  }

  async getArbiterNodes(): Promise<DatabaseNode[]> {
    return Array.from(this.arbiterNodes).map(id => this.nodes.get(id)).filter((n): n is DatabaseNode => n !== undefined);
  }

  async updateNodeHeartbeat(nodeId: string): Promise<boolean> {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    const updated = updateNodeHeartbeat(node);
    this.nodes.set(nodeId, updated);
    return true;
  }

  async updateNodeMetrics(
    nodeId: string,
    metrics: { cpuUsage?: number; memoryUsage?: number; diskUsage?: number; replicationLag?: number; opsPerSecond?: number }
  ): Promise<boolean> {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    const updated = updateNodeMetrics(node, metrics);
    this.nodes.set(nodeId, updated);

    if (metrics.replicationLag !== undefined) {
      const lagInfo = createReplicaLagInfo(nodeId, metrics.replicationLag, metrics.replicationLag * 1024);
      if (lagInfo.status === 'warning' || lagInfo.status === 'critical') {
        this.events.onReplicaLagWarning?.(nodeId, lagInfo);
      }
    }

    return true;
  }

  async failover(nodeId: string): Promise<FailoverResult> {
    const startTime = Date.now();
    const failedNode = this.nodes.get(nodeId);

    if (!failedNode) {
      return {
        success: false,
        oldPrimary: nodeId,
        newPrimary: '',
        failoverDuration: Date.now() - startTime,
        affectedShards: [],
        error: 'Node not found',
      };
    }

    if (!isNodePrimary(failedNode)) {
      return {
        success: false,
        oldPrimary: nodeId,
        newPrimary: '',
        failoverDuration: Date.now() - startTime,
        affectedShards: [],
        error: 'Node is not a primary',
      };
    }

    this.failoverInProgress = true;
    this.failoverStatus = 'in_progress';
    this.events.onFailoverStart?.(nodeId);

    const availableReplicas = Array.from(this.replicaNodes)
      .map(id => this.nodes.get(id))
      .filter((n): n is DatabaseNode => n !== undefined && n.state === 'active');

    if (availableReplicas.length === 0) {
      this.failoverInProgress = false;
      this.failoverStatus = 'failed';
      this.metrics.failedFailovers++;
      this.updateMetrics();

      return {
        success: false,
        oldPrimary: nodeId,
        newPrimary: '',
        failoverDuration: Date.now() - startTime,
        affectedShards: [],
        error: 'No available replicas for failover',
      };
    }

    const newPrimary = availableReplicas[0];
    const oldPrimary = this.primaryNode;

    this.primaryNode = newPrimary.id;
    this.replicaNodes.delete(newPrimary.id);
    this.replicaNodes.add(oldPrimary || '');

    const newPrimaryNode = this.nodes.get(newPrimary.id);
    if (newPrimaryNode) {
      this.nodes.set(newPrimary.id, { ...newPrimaryNode, role: 'primary' });
    }

    const oldPrimaryNode = this.nodes.get(oldPrimary || '');
    if (oldPrimaryNode) {
      this.nodes.set(oldPrimary || '', { ...oldPrimaryNode, role: 'replica', state: 'failed' });
    }

    const affectedShards = this.reassignShards(oldPrimary || '', newPrimary.id);

    this.failoverInProgress = false;
    this.failoverStatus = 'completed';
    this.metrics.successfulFailovers++;
    this.updateMetrics();

    const result: FailoverResult = {
      success: true,
      oldPrimary: oldPrimary || '',
      newPrimary: newPrimary.id,
      failoverDuration: Date.now() - startTime,
      affectedShards,
    };

    this.events.onPrimaryChanged?.(oldPrimary || '', newPrimary.id);
    this.events.onFailoverComplete?.(result);

    return result;
  }

  private reassignShards(oldNodeId: string, newNodeId: string): string[] {
    const affectedShards: string[] = [];

    for (const [shardId, shard] of this.shards) {
      if (shard.nodes.includes(oldNodeId)) {
        const updatedNodes = shard.nodes.map(n => n === oldNodeId ? newNodeId : n);
        this.shards.set(shardId, { ...shard, nodes: updatedNodes });
        affectedShards.push(shardId);
      }
    }

    return affectedShards;
  }

  async getReplicationStatus(): Promise<ReplicationStatus> {
    const lagInfos: ReplicaLagInfo[] = [];

    for (const replicaId of this.replicaNodes) {
      const node = this.nodes.get(replicaId);
      if (node) {
        lagInfos.push(createReplicaLagInfo(replicaId, node.replicationLag, node.replicationLag * 1024));
      }
    }

    return {
      primaryNode: this.primaryNode || '',
      replicaNodes: Array.from(this.replicaNodes),
      replicationType: this.config.replicationType,
      lagInfo: lagInfos,
      lastConsistentWrite: Date.now(),
    };
  }

  private startHeartbeatMonitor(): void {
    if (this.heartbeatIntervalId) return;

    this.heartbeatIntervalId = setInterval(() => {
      this.processHeartbeats();
    }, this.config.heartbeatInterval);
  }

  private async processHeartbeats(): Promise<void> {
    const now = Date.now();
    const timeout = this.config.heartbeatInterval * 3;

    for (const [nodeId, node] of this.nodes) {
      if (now - node.lastHeartbeat > timeout && node.state === 'active') {
        const updated = markNodeAsFailed(node);
        this.nodes.set(nodeId, updated);
        this.events.onNodeFailed?.(updated);

        if (nodeId === this.primaryNode) {
          this.failoverStatus = 'not_needed';
          await this.failover(nodeId);
        }
      }
    }

    this.updateMetrics();
  }

  async recoverNode(nodeId: string): Promise<boolean> {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    if (node.state === 'failed') {
      const recovered = markNodeAsRecovering(node);
      this.nodes.set(nodeId, recovered);
      this.events.onNodeRecovered?.(recovered);

      setTimeout(() => {
        const current = this.nodes.get(nodeId);
        if (current && current.state === 'recovering') {
          this.nodes.set(nodeId, { ...current, state: 'active' });
        }
      }, 5000);
    }

    return true;
  }

  private updateMetrics(): void {
    const nodesArray = Array.from(this.nodes.values());

    this.metrics.totalNodes = nodesArray.length;
    this.metrics.activeNodes = nodesArray.filter(n => n.state === 'active').length;
    this.metrics.inactiveNodes = nodesArray.filter(n => n.state === 'inactive' || n.state === 'failed').length;
    this.metrics.primaryNodes = nodesArray.filter(n => n.role === 'primary').length;
    this.metrics.replicaNodes = nodesArray.filter(n => n.role === 'replica').length;
    this.metrics.arbiterNodes = nodesArray.filter(n => n.role === 'arbiter').length;

    const shardsArray = Array.from(this.shards.values());
    this.metrics.totalShards = shardsArray.length;
    this.metrics.activeShards = shardsArray.filter(s => s.state === 'active').length;
    this.metrics.migratingShards = shardsArray.filter(s => s.state === 'migrating').length;

    const lags = nodesArray.map(n => n.replicationLag).filter(lag => lag > 0);
    this.metrics.averageReplicationLag = lags.length > 0 ? lags.reduce((a, b) => a + b, 0) / lags.length : 0;
    this.metrics.maxReplicationLag = lags.length > 0 ? Math.max(...lags) : 0;

    this.metrics.totalFailovers = this.metrics.successfulFailovers + this.metrics.failedFailovers;
  }

  getMetrics(): ReplicationMetrics {
    return { ...this.metrics };
  }

  async drain(): Promise<void> {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
    this.isRunning = false;
  }

  clear(): void {
    this.nodes.clear();
    this.shards.clear();
    this.shardDirectory = [];
    this.primaryNode = null;
    this.replicaNodes.clear();
    this.arbiterNodes.clear();
    this.replicationStatus = null;
    this.failoverInProgress = false;
    this.failoverStatus = 'not_needed';
    this.rebalancePlans = [];
    this.rebalanceProgress.clear();
    this.dataMovements.clear();
    this.metrics = createEmptyReplicationMetrics();
  }
}

export class ShardManager {
  private config: ShardConfig;
  private shards: Map<string, Shard> = new Map();
  private shardKey: ShardKey;
  private shardDirectory: ShardDirectory[] = [];
  private allocations: Map<string, ShardAllocation> = new Map();
  private events: ReplicationEvents;

  constructor(config?: Partial<ShardConfig>, events?: ReplicationEvents) {
    const fullConfig = { ...createDefaultShardConfig(), ...config };
    if (!isValidShardConfig(fullConfig)) {
      throw new Error('Invalid shard configuration');
    }
    this.config = fullConfig;
    this.shardKey = {
      type: fullConfig.shardKeyType,
      fields: [],
      directoryPath: fullConfig.directoryPath,
    };
    this.events = events || {};
  }

  async initialize(): Promise<void> {
    if (this.config.shardKeyType === 'hash') {
      await this.initializeHashShards();
    } else if (this.config.shardKeyType === 'range') {
      await this.initializeRangeShards();
    }
  }

  private async initializeHashShards(): Promise<void> {
    for (let i = 0; i < this.config.numShards; i++) {
      const shardId = `shard_${i.toString(16).padStart(16, '0')}`;
      const keyRange = createKeyRange(
        (i * 4294967296 / this.config.numShards).toString(16),
        ((i + 1) * 4294967296 / this.config.numShards - 1).toString(16),
        true
      );
      const shard = createShard(keyRange, []);
      this.shards.set(shardId, shard);
    }
  }

  private async initializeRangeShards(): Promise<void> {
    const rangeSize = 4294967296 / this.config.numShards;
    for (let i = 0; i < this.config.numShards; i++) {
      const shardId = `shard_${i.toString(16).padStart(16, '0')}`;
      const keyRange = createKeyRange(
        (i * rangeSize).toString(16),
        (i === this.config.numShards - 1 ? 4294967295 : (i + 1) * rangeSize - 1).toString(16),
        i === this.config.numShards - 1
      );
      const shard = createShard(keyRange, []);
      this.shards.set(shardId, shard);
    }
  }

  async addShard(nodes: string[]): Promise<Shard> {
    const shard = createShard(createKeyRange('', '', false), nodes);
    this.shards.set(shard.id, shard);
    return shard;
  }

  async removeShard(shardId: string): Promise<boolean> {
    return this.shards.delete(shardId);
  }

  async getShard(shardId: string): Promise<Shard | undefined> {
    return this.shards.get(shardId);
  }

  async getAllShards(): Promise<Shard[]> {
    return Array.from(this.shards.values());
  }

  async getShardForKey(key: string): Promise<Shard | undefined> {
    const shardId = getShardForKey(this.shardKey, key, this.config.numShards, this.shardDirectory);
    return this.shards.get(shardId);
  }

  async updateShardState(shardId: string, state: Shard['state']): Promise<boolean> {
    const shard = this.shards.get(shardId);
    if (!shard) return false;

    const updated = updateShardState(shard, state);
    this.shards.set(shardId, updated);
    return true;
  }

  async updateShardStats(shardId: string, dataSize: number, documentCount: number): Promise<boolean> {
    const shard = this.shards.get(shardId);
    if (!shard) return false;

    const updated = updateShardStats(shard, dataSize, documentCount);
    this.shards.set(shardId, updated);
    return true;
  }

  async addNodeToShard(shardId: string, nodeId: string): Promise<boolean> {
    const shard = this.shards.get(shardId);
    if (!shard) return false;

    const updated = addNodeToShard(shard, nodeId);
    this.shards.set(shardId, updated);
    return true;
  }

  async removeNodeFromShard(shardId: string, nodeId: string): Promise<boolean> {
    const shard = this.shards.get(shardId);
    if (!shard) return false;

    const updated = removeNodeFromShard(shard, nodeId);
    this.shards.set(shardId, updated);
    return true;
  }

  async allocateShard(shardId: string, primaryNode: string, replicaNodes: string[], weight: number): Promise<ShardAllocation> {
    const allocation: ShardAllocation = {
      shardId,
      primaryNode,
      replicaNodes,
      weight,
      currentDataSize: 0,
    };
    this.allocations.set(shardId, allocation);
    return allocation;
  }

  async getAllocation(shardId: string): Promise<ShardAllocation | undefined> {
    return this.allocations.get(shardId);
  }

  async getAllAllocations(): Promise<ShardAllocation[]> {
    return Array.from(this.allocations.values());
  }

  async updateDirectory(key: string, shardId: string): Promise<void> {
    const existing = this.shardDirectory.findIndex(d => d.key === key);
    if (existing >= 0) {
      this.shardDirectory[existing] = { key, shardId, updatedAt: Date.now() };
    } else {
      this.shardDirectory.push({ key, shardId, updatedAt: Date.now() });
    }
  }

  async getDirectory(): Promise<ShardDirectory[]> {
    return [...this.shardDirectory];
  }

  async clearDirectory(): Promise<void> {
    this.shardDirectory = [];
  }

  clear(): void {
    this.shards.clear();
    this.shardDirectory = [];
    this.allocations.clear();
  }
}

export class RebalanceManager {
  private shardManager: ShardManager;
  private plans: RebalancePlan[] = [];
  private progress: Map<string, RebalanceProgress> = new Map();
  private movements: Map<string, DataMovement> = new Map();
  private events: ReplicationEvents;
  private isRunning: boolean = false;

  constructor(shardManager: ShardManager, events?: ReplicationEvents) {
    this.shardManager = shardManager;
    this.events = events || {};
  }

  async createRebalancePlan(sourceShardId: string, targetShardId: string): Promise<RebalancePlan | null> {
    const sourceShard = await this.shardManager.getShard(sourceShardId);
    const targetShard = await this.shardManager.getShard(targetShardId);

    if (!sourceShard || !targetShard) return null;

    const documentsToMove = Math.floor(sourceShard.documentCount / 2);
    const estimatedSize = Math.floor(sourceShard.dataSize / 2);

    const plan = createRebalancePlan(sourceShardId, targetShardId, documentsToMove, estimatedSize);
    this.plans.push(plan);

    return plan;
  }

  async executeRebalance(planId: string): Promise<boolean> {
    const plan = this.plans.find(p => `${p.sourceShard}_${p.targetShard}` === planId);
    if (!plan) return false;

    this.isRunning = true;
    const progress: RebalanceProgress = {
      planId,
      status: 'in_progress',
      totalPlans: this.plans.length,
      completedPlans: 0,
      currentPlan: plan,
      startedAt: Date.now(),
      estimatedCompletion: Date.now() + plan.estimatedDuration,
      bytesTransferred: 0,
      documentsTransferred: 0,
    };

    this.progress.set(planId, progress);
    this.events.onRebalanceStart?.(this.plans);

    const movement = createDataMovement(plan.sourceShard, plan.targetShard, []);
    this.movements.set(movement.id, { ...movement, status: 'in_progress', startedAt: Date.now() });

    await this.simulateDataMovement(movement.id, plan.estimatedSize, plan.documentsToMove);

    const completedMovement = this.movements.get(movement.id);
    if (completedMovement) {
      this.movements.set(movement.id, { ...completedMovement, status: 'completed', completedAt: Date.now() });
    }

    progress.status = 'completed';
    progress.completedPlans = this.plans.length;
    progress.bytesTransferred = plan.estimatedSize;
    progress.documentsTransferred = plan.documentsToMove;
    this.progress.set(planId, progress);

    await this.shardManager.updateShardState(plan.sourceShard, 'active');
    await this.shardManager.updateShardState(plan.targetShard, 'active');

    this.isRunning = false;
    this.events.onRebalanceComplete?.(true);
    this.events.onRebalanceProgress?.(progress);

    return true;
  }

  private async simulateDataMovement(movementId: string, size: number, documents: number): Promise<void> {
    const chunkSize = 1024 * 1024;
    const chunks = Math.ceil(size / chunkSize);
    let transferred = 0;
    let docsTransferred = 0;

    for (let i = 0; i < chunks; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      transferred += Math.min(chunkSize, size - transferred);
      docsTransferred = Math.floor((transferred / size) * documents);

      const movement = this.movements.get(movementId);
      if (movement) {
        this.movements.set(movementId, {
          ...movement,
          bytesTransferred: transferred,
          documentsTransferred: docsTransferred,
        });
      }
    }
  }

  async getPlan(planId: string): Promise<RebalancePlan | undefined> {
    return this.plans.find(p => `${p.sourceShard}_${p.targetShard}` === planId);
  }

  async getAllPlans(): Promise<RebalancePlan[]> {
    return [...this.plans];
  }

  async getProgress(planId: string): Promise<RebalanceProgress | undefined> {
    return this.progress.get(planId);
  }

  async getAllProgress(): Promise<RebalanceProgress[]> {
    return Array.from(this.progress.values());
  }

  async getMovement(movementId: string): Promise<DataMovement | undefined> {
    return this.movements.get(movementId);
  }

  async getAllMovements(): Promise<DataMovement[]> {
    return Array.from(this.movements.values());
  }

  clear(): void {
    this.plans = [];
    this.progress.clear();
    this.movements.clear();
  }
}

export class ShardRouter {
  private config: RouterConfig;
  private shardManager: ShardManager;
  private replicationManager: ReplicationManager;
  private shardKey: ShardKey;

  constructor(
    config: RouterConfig,
    shardManager: ShardManager,
    replicationManager: ReplicationManager
  ) {
    this.config = { ...createDefaultRouterConfig(), ...config };
    this.shardManager = shardManager;
    this.replicationManager = replicationManager;
    this.shardKey = {
      type: config.shardKeyType,
      fields: [],
    };
  }

  async routeRead(key: string): Promise<RoutingResult> {
    const startTime = Date.now();
    const shard = await this.shardManager.getShardForKey(key);

    if (!shard) {
      throw new Error(`No shard found for key: ${key}`);
    }

    let nodeId = shard.nodes[0];
    let wasSecondary = false;

    if (this.config.replicaPreference === 'secondary') {
      const replicas = await this.replicationManager.getReplicaNodes();
      if (replicas.length > 0) {
        nodeId = replicas[0].id;
        wasSecondary = true;
      }
    } else if (this.config.replicaPreference === 'nearest') {
      const nodes = await this.replicationManager.getAllNodes();
      const activeNodes = nodes.filter(n => n.state === 'active');
      if (activeNodes.length > 0) {
        nodeId = activeNodes[0].id;
      }
    }

    return {
      nodeId,
      shardId: shard.id,
      wasSecondary,
      latency: Date.now() - startTime,
    };
  }

  async routeWrite(key: string): Promise<RoutingResult> {
    const startTime = Date.now();
    const shard = await this.shardManager.getShardForKey(key);

    if (!shard) {
      throw new Error(`No shard found for key: ${key}`);
    }

    const primary = await this.replicationManager.getPrimaryNode();
    if (!primary) {
      throw new Error('No primary node available');
    }

    return {
      nodeId: primary.id,
      shardId: shard.id,
      wasSecondary: false,
      latency: Date.now() - startTime,
    };
  }

  async route(key: string, isWrite: boolean): Promise<RoutingResult> {
    if (isWrite) {
      return this.routeWrite(key);
    }
    return this.routeRead(key);
  }

  async getShardForKey(key: string): Promise<string | null> {
    const shard = await this.shardManager.getShardForKey(key);
    return shard ? shard.id : null;
  }
}

export class DatabaseReplication {
  private replicationManager: ReplicationManager;
  private shardManager: ShardManager;
  private rebalanceManager: RebalanceManager;
  private shardRouter: ShardRouter | null = null;
  private events: ReplicationEvents;

  constructor(
    replicationConfig?: Partial<ReplicationConfig>,
    shardConfig?: Partial<ShardConfig>,
    routerConfig?: Partial<RouterConfig>,
    events?: ReplicationEvents
  ) {
    this.events = events || {};
    this.replicationManager = new ReplicationManager(replicationConfig, events);
    this.shardManager = new ShardManager(shardConfig, events);
    this.rebalanceManager = new RebalanceManager(this.shardManager, events);
  }

  async initialize(): Promise<void> {
    await this.replicationManager.initialize();
    await this.shardManager.initialize();

    this.shardRouter = new ShardRouter(
      createDefaultRouterConfig(),
      this.shardManager,
      this.replicationManager
    );
  }

  getReplicationManager(): ReplicationManager {
    return this.replicationManager;
  }

  getShardManager(): ShardManager {
    return this.shardManager;
  }

  getRebalanceManager(): RebalanceManager {
    return this.rebalanceManager;
  }

  getShardRouter(): ShardRouter {
    if (!this.shardRouter) {
      throw new Error('ShardRouter not initialized');
    }
    return this.shardRouter;
  }

  async drain(): Promise<void> {
    await this.replicationManager.drain();
  }

  clear(): void {
    this.replicationManager.clear();
    this.shardManager.clear();
    this.rebalanceManager.clear();
  }
}

export const databaseReplication = new DatabaseReplication();

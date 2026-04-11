import crypto from 'crypto';

export type ReplicationType = 'synchronous' | 'asynchronous';
export type ShardKeyType = 'hash' | 'range' | 'directory';
export type NodeRole = 'primary' | 'replica' | 'arbiter';
export type NodeState = 'active' | 'inactive' | 'recovering' | 'failed';
export type FailoverStatus = 'not_needed' | 'in_progress' | 'completed' | 'failed';
export type RebalanceStatus = 'idle' | 'in_progress' | 'completed' | 'failed';
export type ConsistencyLevel = 'strong' | 'eventual' | 'bounded';

export interface ReplicationConfig {
  replicationType: ReplicationType;
  consistencyLevel: ConsistencyLevel;
  replicationFactor: number;
  heartbeatInterval: number;
  electionTimeout: number;
  writeQuorum: number;
  readQuorum: number;
}

export interface ShardConfig {
  shardKeyType: ShardKeyType;
  numShards: number;
  shardSize?: number;
  directoryPath?: string;
}

export interface ShardKey {
  type: ShardKeyType;
  fields: string[];
  directoryPath?: string;
}

export interface Shard {
  id: string;
  keyRange: KeyRange;
  nodes: string[];
  state: 'active' | 'migrating' | 'readonly';
  dataSize: number;
  documentCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface KeyRange {
  low: string;
  high: string;
  inclusive: boolean;
}

export interface ShardAllocation {
  shardId: string;
  primaryNode: string;
  replicaNodes: string[];
  weight: number;
  currentDataSize: number;
}

export interface DatabaseNode {
  id: string;
  host: string;
  port: number;
  role: NodeRole;
  state: NodeState;
  datacenter?: string;
  rack?: string;
  tags: Record<string, string>;
  addedAt: number;
  lastHeartbeat: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  replicationLag: number;
  opsPerSecond: number;
}

export interface ReplicaLagInfo {
  nodeId: string;
  lagMs: number;
  lagBytes: number;
  lastUpdated: number;
  status: 'ok' | 'warning' | 'critical';
}

export interface ReplicationStatus {
  primaryNode: string;
  replicaNodes: string[];
  replicationType: ReplicationType;
  lagInfo: ReplicaLagInfo[];
  lastConsistentWrite: number;
  currentLSN?: string;
}

export interface FailoverResult {
  success: boolean;
  oldPrimary: string;
  newPrimary: string;
  failoverDuration: number;
  affectedShards: string[];
  error?: string;
}

export interface RebalancePlan {
  sourceShard: string;
  targetShard: string;
  documentsToMove: number;
  estimatedSize: number;
  estimatedDuration: number;
}

export interface RebalanceProgress {
  planId: string;
  status: RebalanceStatus;
  totalPlans: number;
  completedPlans: number;
  currentPlan?: RebalancePlan;
  startedAt: number;
  estimatedCompletion: number;
  bytesTransferred: number;
  documentsTransferred: number;
}

export interface ReplicationMetrics {
  totalNodes: number;
  activeNodes: number;
  inactiveNodes: number;
  primaryNodes: number;
  replicaNodes: number;
  arbiterNodes: number;
  totalShards: number;
  activeShards: number;
  migratingShards: number;
  averageReplicationLag: number;
  maxReplicationLag: number;
  totalFailovers: number;
  successfulFailovers: number;
  failedFailovers: number;
  totalRebalances: number;
  successfulRebalances: number;
}

export interface DataMovement {
  id: string;
  sourceShard: string;
  targetShard: string;
  documentIds: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  bytesTransferred: number;
  documentsTransferred: number;
  startedAt: number;
  completedAt?: number;
  error?: string;
}

export interface RouterConfig {
  shardKeyType: ShardKeyType;
  consistencyLevel: ConsistencyLevel;
  timeout: number;
  retryAttempts: number;
  replicaPreference?: 'primary' | 'nearest' | 'secondary';
}

export interface RoutingResult {
  nodeId: string;
  shardId: string;
  wasSecondary: boolean;
  latency: number;
}

export interface ShardDirectory {
  key: string;
  shardId: string;
  updatedAt: number;
}

export function createReplicationId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export function createNodeId(): string {
  return createReplicationId('node');
}

export function createShardId(): string {
  return createReplicationId('shard');
}

export function createPlanId(): string {
  return createReplicationId('plan');
}

export function createMovementId(): string {
  return createReplicationId('move');
}

export function createDefaultReplicationConfig(): ReplicationConfig {
  return {
    replicationType: 'asynchronous',
    consistencyLevel: 'eventual',
    replicationFactor: 3,
    heartbeatInterval: 10000,
    electionTimeout: 5000,
    writeQuorum: 2,
    readQuorum: 2,
  };
}

export function createDefaultShardConfig(): ShardConfig {
  return {
    shardKeyType: 'hash',
    numShards: 4,
  };
}

export function createDefaultRouterConfig(): RouterConfig {
  return {
    shardKeyType: 'hash',
    consistencyLevel: 'eventual',
    timeout: 30000,
    retryAttempts: 3,
  };
}

export function createNode(
  host: string,
  port: number,
  role: NodeRole = 'replica',
  tags?: Record<string, string>
): DatabaseNode {
  const now = Date.now();
  return {
    id: createNodeId(),
    host,
    port,
    role,
    state: 'active',
    tags: tags || {},
    addedAt: now,
    lastHeartbeat: now,
    cpuUsage: 0,
    memoryUsage: 0,
    diskUsage: 0,
    replicationLag: 0,
    opsPerSecond: 0,
  };
}

export function createShard(keyRange: KeyRange, nodes: string[]): Shard {
  const now = Date.now();
  return {
    id: createShardId(),
    keyRange,
    nodes,
    state: 'active',
    dataSize: 0,
    documentCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function createKeyRange(low: string, high: string, inclusive: boolean = true): KeyRange {
  return { low, high, inclusive };
}

export function createReplicaLagInfo(nodeId: string, lagMs: number, lagBytes: number): ReplicaLagInfo {
  let status: 'ok' | 'warning' | 'critical' = 'ok';
  if (lagMs > 5000 || lagBytes > 100000000) {
    status = 'critical';
  } else if (lagMs > 1000 || lagBytes > 10000000) {
    status = 'warning';
  }

  return {
    nodeId,
    lagMs,
    lagBytes,
    lastUpdated: Date.now(),
    status,
  };
}

export function createEmptyReplicationMetrics(): ReplicationMetrics {
  return {
    totalNodes: 0,
    activeNodes: 0,
    inactiveNodes: 0,
    primaryNodes: 0,
    replicaNodes: 0,
    arbiterNodes: 0,
    totalShards: 0,
    activeShards: 0,
    migratingShards: 0,
    averageReplicationLag: 0,
    maxReplicationLag: 0,
    totalFailovers: 0,
    successfulFailovers: 0,
    failedFailovers: 0,
    totalRebalances: 0,
    successfulRebalances: 0,
  };
}

export function createRebalancePlan(
  sourceShard: string,
  targetShard: string,
  documentsToMove: number,
  estimatedSize: number
): RebalancePlan {
  return {
    sourceShard,
    targetShard,
    documentsToMove,
    estimatedSize,
    estimatedDuration: Math.ceil(estimatedSize / (1024 * 1024 * 10)),
  };
}

export function createDataMovement(
  sourceShard: string,
  targetShard: string,
  documentIds: string[]
): DataMovement {
  return {
    id: createMovementId(),
    sourceShard,
    targetShard,
    documentIds,
    status: 'pending',
    bytesTransferred: 0,
    documentsTransferred: 0,
    startedAt: Date.now(),
  };
}

export function isNodeHealthy(node: DatabaseNode, heartbeatTimeout: number): boolean {
  return Date.now() - node.lastHeartbeat < heartbeatTimeout && node.state === 'active';
}

export function isNodePrimary(node: DatabaseNode): boolean {
  return node.role === 'primary';
}

export function isNodeReplica(node: DatabaseNode): boolean {
  return node.role === 'replica';
}

export function isNodeArbiter(node: DatabaseNode): boolean {
  return node.role === 'arbiter';
}

export function isPrimaryNodeAvailable(status: ReplicationStatus): boolean {
  return status.replicaNodes.length > 0 || status.primaryNode !== '';
}

export function calculateWriteQuorum(replicationFactor: number): number {
  return Math.floor(replicationFactor / 2) + 1;
}

export function calculateReadQuorum(replicationFactor: number): number {
  return Math.floor(replicationFactor / 2) + 1;
}

export function isStrongConsistent(consistencyLevel: ConsistencyLevel): boolean {
  return consistencyLevel === 'strong';
}

export function isEventualConsistent(consistencyLevel: ConsistencyLevel): boolean {
  return consistencyLevel === 'eventual';
}

export function hashShardKey(key: string, numShards: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % numShards;
}

export function isKeyInRange(key: string, range: KeyRange): boolean {
  if (range.inclusive) {
    return key >= range.low && key <= range.high;
  }
  return key > range.low && key < range.high;
}

export function getShardForKey(shardKey: ShardKey, key: string, numShards: number, directory?: ShardDirectory[]): string {
  if (shardKey.type === 'directory' && directory) {
    const entry = directory.find(d => d.key === key);
    if (entry) {
      return entry.shardId;
    }
  }

  if (shardKey.type === 'hash') {
    const shardIndex = hashShardKey(key, numShards);
    return `shard_${shardIndex.toString(16).padStart(16, '0')}`;
  }

  if (shardKey.type === 'range') {
    for (const shard of directory || []) {
      const range = JSON.parse(shard.key);
      if (isKeyInRange(key, range)) {
        return shard.shardId;
      }
    }
  }

  return `shard_${hashShardKey(key, numShards).toString(16).padStart(16, '0')}`;
}

export function isValidReplicationConfig(config: Partial<ReplicationConfig>): config is ReplicationConfig {
  return (
    typeof config.replicationType === 'string' &&
    ['synchronous', 'asynchronous'].includes(config.replicationType) &&
    typeof config.replicationFactor === 'number' &&
    config.replicationFactor > 0 &&
    typeof config.heartbeatInterval === 'number' &&
    config.heartbeatInterval > 0 &&
    typeof config.electionTimeout === 'number' &&
    config.electionTimeout > 0 &&
    typeof config.writeQuorum === 'number' &&
    config.writeQuorum > 0 &&
    typeof config.readQuorum === 'number' &&
    config.readQuorum > 0
  );
}

export function isValidShardConfig(config: Partial<ShardConfig>): config is ShardConfig {
  return (
    typeof config.shardKeyType === 'string' &&
    ['hash', 'range', 'directory'].includes(config.shardKeyType) &&
    typeof config.numShards === 'number' &&
    config.numShards > 0
  );
}

export function isValidNodeRole(role: string): role is NodeRole {
  return ['primary', 'replica', 'arbiter'].includes(role);
}

export function isValidNodeState(state: string): state is NodeState {
  return ['active', 'inactive', 'recovering', 'failed'].includes(state);
}

export function updateNodeHeartbeat(node: DatabaseNode): DatabaseNode {
  return {
    ...node,
    lastHeartbeat: Date.now(),
  };
}

export function updateNodeMetrics(
  node: DatabaseNode,
  metrics: Partial<Pick<DatabaseNode, 'cpuUsage' | 'memoryUsage' | 'diskUsage' | 'replicationLag' | 'opsPerSecond'>>
): DatabaseNode {
  return {
    ...node,
    ...metrics,
  };
}

export function markNodeAsFailed(node: DatabaseNode): DatabaseNode {
  return {
    ...node,
    state: 'failed',
  };
}

export function markNodeAsRecovering(node: DatabaseNode): DatabaseNode {
  return {
    ...node,
    state: 'recovering',
  };
}

export function updateShardState(shard: Shard, state: Shard['state']): Shard {
  return {
    ...shard,
    state,
    updatedAt: Date.now(),
  };
}

export function updateShardStats(shard: Shard, dataSize: number, documentCount: number): Shard {
  return {
    ...shard,
    dataSize,
    documentCount,
    updatedAt: Date.now(),
  };
}

export function addNodeToShard(shard: Shard, nodeId: string): Shard {
  if (shard.nodes.includes(nodeId)) {
    return shard;
  }
  return {
    ...shard,
    nodes: [...shard.nodes, nodeId],
    updatedAt: Date.now(),
  };
}

export function removeNodeFromShard(shard: Shard, nodeId: string): Shard {
  return {
    ...shard,
    nodes: shard.nodes.filter(id => id !== nodeId),
    updatedAt: Date.now(),
  };
}

export function mergeReplicationMetrics(base: ReplicationMetrics, delta: Partial<ReplicationMetrics>): ReplicationMetrics {
  return { ...base, ...delta };
}

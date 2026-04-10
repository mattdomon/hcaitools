export type WarehouseType = 'snowflake' | 'bigquery' | 'redshift' | 'databricks';
export type SchemaType = 'fact' | 'dimension' | 'aggregate';
export type DataModelType = 'star' | 'snowflake' | 'galaxy';
export type DataQualityLevel = 'low' | 'medium' | 'high' | 'critical';
export type PipelineStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type LineageNodeType = 'source' | 'transform' | 'aggregate' | 'output';
export type MetricType = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct' | 'median';

export interface WarehouseConnection {
  id: string;
  name: string;
  type: WarehouseType;
  host: string;
  port: number;
  database: string;
  schema: string;
  username: string;
  passwordHash?: string;
  sslEnabled: boolean;
  timeout: number;
  maxConnections: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TableSchema {
  id: string;
  name: string;
  type: SchemaType;
  warehouseId: string;
  database: string;
  schema: string;
  columns: ColumnDefinition[];
  rowCount: number;
  sizeBytes: number;
  partitions?: PartitionConfig[];
  indexes?: IndexConfig[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ColumnDefinition {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue?: unknown;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: ForeignKeyRef;
  description?: string;
}

export interface ForeignKeyRef {
  table: string;
  column: string;
  warehouseId?: string;
}

export interface PartitionConfig {
  column: string;
  type: 'range' | 'hash' | 'list';
  expression?: string;
}

export interface IndexConfig {
  name: string;
  columns: string[];
  unique: boolean;
  type: 'btree' | 'hash' | 'bitmap';
}

export interface DimensionAttribute {
  name: string;
  dataType: string;
  hierarchyLevel?: number;
  isSlowlyChanging?: boolean;
  scdType?: 1 | 2 | 3;
}

export interface DimensionTable extends TableSchema {
  type: 'dimension';
  attributes: DimensionAttribute[];
  surrogateKey?: string;
  naturalKey?: string;
  businessKey?: string;
}

export interface FactTable extends TableSchema {
  type: 'fact';
  measureColumns: string[];
  aggregationType: 'sum' | 'count' | 'avg' | 'min' | 'max';
  dateColumn: string;
  foreignKeys: Array<{ dimension: string; column: string }>;
}

export interface AggregateTable extends TableSchema {
  type: 'aggregate';
  rollupLevels: string[];
  preComputedMeasures: string[];
  refreshSchedule?: string;
}

export interface DataModel {
  id: string;
  name: string;
  description?: string;
  type: DataModelType;
  warehouseId: string;
  tables: string[];
  relationships: Relationship[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Relationship {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  isOptional: boolean;
}

export interface ETLStage {
  id: string;
  name: string;
  type: 'extract' | 'transform' | 'load' | 'validate' | 'checkpoint';
  order: number;
  config: Record<string, unknown>;
  retryConfig?: RetryConfig;
  timeout?: number;
  dependencies?: string[];
}

export interface ETLConfig {
  id: string;
  name: string;
  description?: string;
  sourceConnection: WarehouseConnection;
  targetConnection: WarehouseConnection;
  stages: ETLStage[];
  executionMode: 'sequential' | 'parallel' | 'incremental';
  parallelism?: number;
  batchSize?: number;
  errorHandling: 'stop' | 'skip' | 'retry';
  checkpointEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ETLExecution {
  id: string;
  configId: string;
  status: PipelineStatus;
  currentStage?: string;
  stages: Array<{
    stageId: string;
    status: PipelineStatus;
    startedAt?: Date;
    completedAt?: Date;
    recordsProcessed: number;
    recordsFailed: number;
    error?: string;
  }>;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
}

export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

export interface DataQualityRule {
  id: string;
  name: string;
  description?: string;
  targetTable: string;
  targetColumn?: string;
  ruleType: 'not_null' | 'unique' | 'range' | 'regex' | 'custom';
  ruleExpression?: string;
  threshold?: number;
  severity: DataQualityLevel;
  action?: 'alert' | 'block' | 'auto_fix';
}

export interface DataQualityResult {
  ruleId: string;
  passed: boolean;
  actualValue?: unknown;
  expectedRange?: string;
  recordsChecked: number;
  recordsFailed: number;
  failedSample?: unknown[];
  checkedAt: Date;
}

export interface DataQualityReport {
  id: string;
  warehouseId: string;
  tableName: string;
  overallScore: number;
  rules: DataQualityResult[];
  checkedAt: Date;
}

export interface QueryOptimizationHint {
  type: 'index' | 'partition' | 'cache' | 'rewrite' | 'materialized';
  targetTable?: string;
  targetColumn?: string;
  recommendation: string;
  estimatedImpact: 'low' | 'medium' | 'high';
  sqlExample?: string;
}

export interface OptimizerConfig {
  enableIndexSuggestions: boolean;
  enablePartitionPruning: boolean;
  enableQueryRewrite: boolean;
  enableMaterializedViews: boolean;
  cacheThreshold?: number;
  timeout: number;
}

export interface QueryProfile {
  queryId: string;
  sql: string;
  executionTime: number;
  planningTime: number;
  rowsScanned: number;
  rowsReturned: number;
  bytesProcessed: number;
  cacheHit: boolean;
  stages: Array<{
    stageId: string;
    duration: number;
    recordsRead: number;
    recordsWritten: number;
  }>;
  warnings: string[];
  suggestions: QueryOptimizationHint[];
}

export interface LineageNode {
  id: string;
  name: string;
  type: LineageNodeType;
  tableName?: string;
  columnName?: string;
  transformation?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface LineageEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  flowType: 'data' | 'dependency';
  metadata?: Record<string, unknown>;
}

export interface DataLineage {
  id: string;
  warehouseId: string;
  nodes: LineageNode[];
  edges: LineageEdge[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ColumnLineage {
  id: string;
  sourceColumn: string;
  targetColumn: string;
  transformation?: string;
  nodes: string[];
}

export interface DataFlowGraph {
  id: string;
  name: string;
  warehouseId: string;
  nodes: LineageNode[];
  edges: LineageEdge[];
  columns: ColumnLineage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MetricDefinition {
  id: string;
  name: string;
  description?: string;
  table: string;
  column: string;
  aggregationType: MetricType;
  filters?: Array<{
    column: string;
    operator: string;
    value: unknown;
  }>;
  groupByColumns?: string[];
  descriptionOfMeasure?: string;
}

export interface DimensionMapping {
  dimensionTable: string;
  columns: Array<{
    sourceColumn: string;
    targetColumn: string;
    transformation?: string;
  }>;
}

export interface DataWarehouseStats {
  totalTables: number;
  totalSizeBytes: number;
  totalRowCount: number;
  lastRefreshedAt?: Date;
  activeConnections: number;
  queryPerformance: {
    avgExecutionTime: number;
    p50ExecutionTime: number;
    p95ExecutionTime: number;
    p99ExecutionTime: number;
  };
}

export interface SerializedWarehouseConnection {
  id: string;
  name: string;
  type: WarehouseType;
  host: string;
  port: number;
  database: string;
  schema: string;
  username: string;
  sslEnabled: boolean;
  timeout: number;
  maxConnections: number;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseOptions {
  connection: Omit<WarehouseConnection, 'id' | 'createdAt' | 'updatedAt'>;
  optimizerConfig?: Partial<OptimizerConfig>;
  enableLineageTracking?: boolean;
}

export interface DataTransferTask {
  id: string;
  sourceTable: string;
  targetTable: string;
  columns: Array<{
    sourceName: string;
    targetName: string;
    transformation?: string;
  }>;
  filterCondition?: string;
  incrementalKey?: string;
  status: PipelineStatus;
  lastRunAt?: Date;
  nextRunAt?: Date;
}

export interface IncrementalLoadConfig {
  keyColumn: string;
  filterColumn?: string;
  batchSize: number;
  watermark?: string;
}

export interface ChangeDataCapture {
  id: string;
  sourceTable: string;
  captureColumns: string[];
  cdcType: 'timestamp' | 'version' | 'trigger' | 'log';
  targetTable: string;
  transformationRules?: Array<{
    sourceColumn: string;
    targetColumn: string;
    rule: string;
  }>;
}
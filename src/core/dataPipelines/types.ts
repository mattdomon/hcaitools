export type PipelineType = 'etl' | 'elt' | 'streaming';
export type TransformationType = 'filter' | 'map' | 'reduce' | 'join' | 'aggregate';
export type ExecutionMode = 'sequential' | 'parallel' | 'partitioned';
export type TriggerType = 'manual' | 'scheduled' | 'event-based';
export type PipelineState = 'draft' | 'active' | 'paused' | 'completed' | 'failed';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface RetryPolicy {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

export interface RetryConfig {
  enabled: boolean;
  policy: RetryPolicy;
}

export interface FilterConfig {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte';
  value: unknown;
  logicalOperator?: 'and' | 'or';
}

export interface MapConfig {
  fields: Record<string, string>;
  expression?: string;
}

export interface ReduceConfig {
  groupBy: string[];
  aggregations: Array<{
    field: string;
    function: 'sum' | 'count' | 'avg' | 'min' | 'max';
    alias: string;
  }>;
}

export interface JoinConfig {
  leftKey: string;
  rightKey: string;
  joinType: 'inner' | 'left' | 'right' | 'full';
  rightSource: string;
}

export interface AggregateConfig {
  groupByFields: string[];
  operations: Array<{
    field: string;
    operation: 'sum' | 'count' | 'avg' | 'min' | 'max';
    outputField: string;
  }>;
}

export interface Transformation {
  id: string;
  type: TransformationType;
  config: FilterConfig | MapConfig | ReduceConfig | JoinConfig | AggregateConfig;
  inputSource?: string;
  outputTarget?: string;
  order: number;
}

export interface PipelineStage {
  id: string;
  name: string;
  type: 'source' | 'transform' | 'destination' | 'checkpoint';
  config: Record<string, unknown>;
  transformations: Transformation[];
  retryConfig?: RetryConfig;
}

export interface ScheduleConfig {
  cronExpression?: string;
  intervalMs?: number;
  timezone?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface EventTriggerConfig {
  eventType: string;
  filter?: FilterConfig;
  payloadPath?: string;
}

export interface Trigger {
  id: string;
  type: TriggerType;
  config: ScheduleConfig | EventTriggerConfig | Record<string, never>;
  enabled: boolean;
  lastTriggeredAt?: Date;
  nextScheduledAt?: Date;
}

export interface PipelineDefinition {
  id: string;
  name: string;
  description?: string;
  type: PipelineType;
  version: number;
  stages: PipelineStage[];
  triggers: Trigger[];
  executionMode: ExecutionMode;
  retryConfig?: RetryConfig;
  timeoutMs?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineVersion {
  version: number;
  definition: PipelineDefinition;
  createdAt: Date;
  createdBy: string;
  changeDescription: string;
}

export interface ExecutionContext {
  pipelineId: string;
  executionId: string;
  stageId: string;
  variables: Record<string, unknown>;
  data: Map<string, unknown>;
  history: Array<{ stageId: string; timestamp: Date; input: unknown; output: unknown; duration: number }>;
  startedAt: Date;
  updatedAt: Date;
}

export interface ExecutionResult {
  executionId: string;
  pipelineId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  state: PipelineState;
  context: ExecutionContext;
  result?: unknown;
  error?: PipelineError;
  completedAt?: Date;
  progress?: PipelineProgress;
}

export interface PipelineError {
  code: string;
  message: string;
  stageId?: string;
  transformationId?: string;
  stack?: string;
  retries?: number;
  originalError?: unknown;
}

export interface PipelineProgress {
  totalStages: number;
  completedStages: number;
  currentStage?: string;
  processedRecords: number;
  failedRecords: number;
  percentComplete: number;
}

export interface PipelineInstance {
  id: string;
  pipelineId: string;
  version: number;
  state: PipelineState;
  executions: Map<string, ExecutionContext>;
  currentExecutionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StageResult {
  stageId: string;
  success: boolean;
  input: unknown;
  output: unknown;
  duration: number;
  recordsProcessed: number;
  error?: PipelineError;
}

export interface TransformationResult {
  transformationId: string;
  success: boolean;
  inputRecords: unknown[];
  outputRecords: unknown[];
  duration: number;
  error?: PipelineError;
}

export interface DataRecord {
  id: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface PipelineMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  totalRecordsProcessed: number;
  stageExecutionCounts: Record<string, number>;
  transformationExecutionCounts: Record<string, number>;
}

export type PipelineEventType =
  | 'pipeline.created'
  | 'pipeline.activated'
  | 'pipeline.paused'
  | 'pipeline.completed'
  | 'pipeline.failed'
  | 'pipeline.cancelled'
  | 'stage.started'
  | 'stage.completed'
  | 'stage.failed'
  | 'transformation.started'
  | 'transformation.completed'
  | 'transformation.failed'
  | 'execution.started'
  | 'execution.completed'
  | 'execution.failed'
  | 'trigger.fired'
  | 'retry.attempted'
  | 'retry.exhausted';

export interface PipelineEvent {
  type: PipelineEventType;
  pipelineId: string;
  executionId?: string;
  stageId?: string;
  transformationId?: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export type EventHandler = (event: PipelineEvent) => void | Promise<void>;

export interface SerializedPipelineDefinition {
  id: string;
  name: string;
  description?: string;
  type: PipelineType;
  version: number;
  stages: string;
  triggers: string;
  executionMode: ExecutionMode;
  retryConfig?: string;
  timeoutMs?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineCheckpoint {
  stageId: string;
  data: Map<string, unknown>;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export interface PartitionConfig {
  field: string;
  numPartitions: number;
  strategy: 'hash' | 'range' | 'round-robin';
}

export interface StreamingConfig {
  windowSizeMs: number;
  watermarkMs: number;
  maxRecordsPerWindow?: number;
}

export interface PipelineOptions {
  definition: Omit<PipelineDefinition, 'id' | 'version' | 'createdAt' | 'updatedAt'>;
  executionMode?: ExecutionMode;
  retryConfig?: RetryConfig;
  timeoutMs?: number;
}

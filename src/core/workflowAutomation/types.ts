export type WorkflowState = 'draft' | 'active' | 'paused' | 'completed' | 'failed';
export type ExecutionMode = 'sequential' | 'parallel';
export type ConditionOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'is_empty';
export type NodeType = 'trigger' | 'action' | 'condition' | 'loop' | 'parallel' | 'merge';
export type ActionType = 'http_request' | 'email' | 'slack' | 'database' | 'transform' | 'filter';

export interface RetryPolicy {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier?: number;
}

export interface Condition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

export interface LoopConfig {
  iterations: number;
  itemsPath?: string;
}

export interface ParallelConfig {
  branches: string[];
  waitForAll?: boolean;
}

export interface ActionConfig {
  type: ActionType;
  params: Record<string, unknown>;
  retryPolicy?: RetryPolicy;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  config: ActionConfig | Condition | LoopConfig | ParallelConfig | Record<string, never>;
  next?: string;
  branches?: string[];
  conditions?: Condition[];
  parallelConfig?: ParallelConfig;
  loopConfig?: LoopConfig;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: number;
  nodes: WorkflowNode[];
  edges: Array<{ from: string; to: string; label?: string }>;
  initialNodeId: string;
  executionMode: ExecutionMode;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowVersion {
  version: number;
  definition: WorkflowDefinition;
  createdAt: Date;
  createdBy: string;
  changeDescription: string;
}

export interface ExecutionContext {
  workflowId: string;
  executionId: string;
  currentNodeId: string;
  variables: Record<string, unknown>;
  history: Array<{ nodeId: string; timestamp: Date; result: unknown }>;
  startedAt: Date;
  updatedAt: Date;
}

export interface ExecutionResult {
  executionId: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  state: WorkflowState;
  context: ExecutionContext;
  result?: unknown;
  error?: string;
  completedAt?: Date;
}

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  version: number;
  state: WorkflowState;
  executions: Map<string, ExecutionContext>;
  currentExecutionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConditionResult {
  passed: boolean;
  evaluatedConditions: Array<{ condition: Condition; result: boolean }>;
}

export interface NodeResult {
  nodeId: string;
  success: boolean;
  output: unknown;
  error?: string;
  duration?: number;
}

export interface RollbackPoint {
  version: number;
  definition: WorkflowDefinition;
  timestamp: Date;
}

export type WorkflowEventType = 
  | 'workflow.created'
  | 'workflow.activated'
  | 'workflow.paused'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'workflow.rolledback'
  | 'node.executed'
  | 'node.failed'
  | 'execution.started'
  | 'execution.completed';

export interface WorkflowEvent {
  type: WorkflowEventType;
  workflowId: string;
  executionId?: string;
  nodeId?: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export type EventHandler = (event: WorkflowEvent) => void | Promise<void>;

export interface WorkflowMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  nodeExecutionCounts: Record<string, number>;
}

export interface SerializedWorkflowDefinition {
  id: string;
  name: string;
  version: number;
  nodes: string;
  edges: string;
  initialNodeId: string;
  executionMode: ExecutionMode;
  createdAt: string;
  updatedAt: string;
}

import * as crypto from 'crypto';
import {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowState,
  ExecutionContext,
  ExecutionResult,
  WorkflowInstance,
  WorkflowVersion,
  Condition,
  ConditionResult,
  NodeResult,
  RollbackPoint,
  WorkflowEvent,
  EventHandler,
  WorkflowMetrics,
  RetryPolicy,
  ActionConfig,
  LoopConfig,
  ParallelConfig,
  ConditionOperator,
} from './types';

const generateId = (prefix: string): string => {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
};

export class ConditionEvaluator {
  evaluate(condition: Condition, context: Record<string, unknown>): boolean {
    const fieldValue = this.getFieldValue(condition.field, context);
    return this.compare(fieldValue, condition.operator, condition.value);
  }

  private getFieldValue(field: string, context: Record<string, unknown>): unknown {
    const parts = field.split('.');
    let value: unknown = context;
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return value;
  }

  private compare(left: unknown, operator: ConditionOperator, right: unknown): boolean {
    switch (operator) {
      case 'equals':
        return left === right;
      case 'not_equals':
        return left !== right;
      case 'greater_than':
        return typeof left === 'number' && typeof right === 'number' && left > right;
      case 'less_than':
        return typeof left === 'number' && typeof right === 'number' && left < right;
      case 'contains':
        return typeof left === 'string' && typeof right === 'string' && left.includes(right);
      case 'is_empty':
        return this.isEmpty(left);
      default:
        return false;
    }
  }

  private isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }
}

export class ActionExecutor {
  async execute(config: ActionConfig, context: Record<string, unknown>): Promise<unknown> {
    const startTime = Date.now();

    try {
      switch (config.type) {
        case 'http_request':
          return this.executeHttpRequest(config.params, context);
        case 'email':
          return this.executeEmail(config.params, context);
        case 'slack':
          return this.executeSlack(config.params, context);
        case 'database':
          return this.executeDatabase(config.params, context);
        case 'transform':
          return this.executeTransform(config.params, context);
        case 'filter':
          return this.executeFilter(config.params, context);
        default:
          throw new Error(`Unknown action type: ${config.type}`);
      }
    } finally {
      const duration = Date.now() - startTime;
      void duration;
    }
  }

  private async executeHttpRequest(params: Record<string, unknown>, _context: Record<string, unknown>): Promise<unknown> {
    const { url, method = 'GET', headers = {}, body } = params;
    void url;
    void method;
    void headers;
    void body;
    return { status: 200, data: { message: 'HTTP request simulated' } };
  }

  private async executeEmail(params: Record<string, unknown>, _context: Record<string, unknown>): Promise<unknown> {
    const { to, subject, body } = params;
    void to;
    void subject;
    void body;
    return { success: true, messageId: generateId('email') };
  }

  private async executeSlack(params: Record<string, unknown>, _context: Record<string, unknown>): Promise<unknown> {
    const { channel, message } = params;
    void channel;
    void message;
    return { success: true, timestamp: Date.now() };
  }

  private async executeDatabase(params: Record<string, unknown>, _context: Record<string, unknown>): Promise<unknown> {
    const { operation, table, data } = params;
    void operation;
    void table;
    void data;
    return { success: true, affectedRows: 1 };
  }

  private async executeTransform(params: Record<string, unknown>, context: Record<string, unknown>): Promise<unknown> {
    const { mapping } = params;
    void mapping;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(context)) {
      if (key !== 'variables' && key !== 'history') {
        result[key] = value;
      }
    }
    return result;
  }

  private async executeFilter(params: Record<string, unknown>, context: Record<string, unknown>): Promise<unknown> {
    const { conditions } = params;
    void conditions;
    return context;
  }

  async executeWithRetry(config: ActionConfig, context: Record<string, unknown>, retryPolicy?: RetryPolicy): Promise<unknown> {
    if (!retryPolicy) {
      return this.execute(config, context);
    }

    let lastError: Error | undefined;
    const { maxAttempts, delayMs, backoffMultiplier = 1 } = retryPolicy;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.execute(config, context);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxAttempts) {
          const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class WorkflowEngine {
  private conditionEvaluator: ConditionEvaluator;
  private actionExecutor: ActionExecutor;
  private eventHandlers: Map<string, Set<EventHandler>>;
  private nodeMap: Map<string, WorkflowNode>;

  constructor() {
    this.conditionEvaluator = new ConditionEvaluator();
    this.actionExecutor = new ActionExecutor();
    this.eventHandlers = new Map();
    this.nodeMap = new Map();
  }

  async executeNode(
    node: WorkflowNode,
    context: Record<string, unknown>,
    retryPolicy?: RetryPolicy
  ): Promise<NodeResult> {
    const startTime = Date.now();

    try {
      let output: unknown;

      switch (node.type) {
        case 'trigger':
          output = this.executeTrigger(node, context);
          break;
        case 'action':
          output = await this.actionExecutor.executeWithRetry(
            node.config as ActionConfig,
            context,
            retryPolicy
          );
          break;
        case 'condition':
          output = this.executeConditionNode(node, context);
          break;
        case 'loop':
          output = await this.executeLoop(node, context);
          break;
        case 'parallel':
          output = await this.executeParallel(node, context);
          break;
        case 'merge':
          output = context;
          break;
        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }

      return {
        nodeId: node.id,
        success: true,
        output,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        nodeId: node.id,
        success: false,
        output: undefined,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  private executeTrigger(node: WorkflowNode, context: Record<string, unknown>): unknown {
    void node;
    return { triggered: true, timestamp: Date.now(), ...context };
  }

  private executeConditionNode(node: WorkflowNode, context: Record<string, unknown>): ConditionResult {
    const conditions = node.conditions || [];
    const evaluatedConditions = conditions.map(condition => ({
      condition,
      result: this.conditionEvaluator.evaluate(condition, context),
    }));

    const passed = evaluatedConditions.every(ec => ec.result);

    return { passed, evaluatedConditions };
  }

  private async executeLoop(node: WorkflowNode, context: Record<string, unknown>): Promise<unknown> {
    const loopConfig = node.loopConfig as LoopConfig | undefined;
    if (!loopConfig) {
      return context;
    }

    const { iterations, itemsPath } = loopConfig;
    const results: unknown[] = [];

    if (itemsPath) {
      const items = this.getNestedValue(context, itemsPath) as unknown[];
      for (const item of items) {
        results.push(item);
      }
    } else {
      for (let i = 0; i < iterations; i++) {
        results.push(i);
      }
    }

    return { loopResults: results, count: results.length };
  }

  private async executeParallel(node: WorkflowNode, context: Record<string, unknown>): Promise<unknown> {
    const parallelConfig = node.parallelConfig as ParallelConfig | undefined;
    if (!parallelConfig) {
      return context;
    }

    const { branches, waitForAll = true } = parallelConfig;
    const branchResults: unknown[] = [];

    if (waitForAll) {
      const promises = branches.map(async (branchId: string) => {
        void branchId;
        return { branchId, result: context };
      });
      const results = await Promise.all(promises);
      branchResults.push(...results);
    } else {
      for (const branchId of branches) {
        branchResults.push({ branchId, result: context });
      }
    }

    return { parallelResults: branchResults };
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }

  validateWorkflow(definition: WorkflowDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!definition.nodes || definition.nodes.length === 0) {
      errors.push('Workflow must have at least one node');
    }

    if (!definition.initialNodeId) {
      errors.push('Workflow must have an initial node');
    }

    const nodeIds = new Set(definition.nodes.map(n => n.id));
    if (!nodeIds.has(definition.initialNodeId)) {
      errors.push('Initial node ID not found in workflow nodes');
    }

    for (const node of definition.nodes) {
      if (node.type === 'condition' && (!node.conditions || node.conditions.length === 0)) {
        errors.push(`Condition node "${node.id}" must have at least one condition`);
      }
      if (node.type === 'loop' && !node.loopConfig) {
        errors.push(`Loop node "${node.id}" must have loop configuration`);
      }
      if (node.type === 'parallel' && !node.parallelConfig) {
        errors.push(`Parallel node "${node.id}" must have parallel configuration`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  buildNodeMap(definition: WorkflowDefinition): Map<string, WorkflowNode> {
    this.nodeMap.clear();
    for (const node of definition.nodes) {
      this.nodeMap.set(node.id, node);
    }
    return this.nodeMap;
  }

  getNextNode(currentNodeId: string, conditionResult?: ConditionResult): string | undefined {
    const currentNode = this.nodeMap.get(currentNodeId);
    if (!currentNode) {
      return undefined;
    }

    if (currentNode.type === 'condition' && conditionResult) {
      if (conditionResult.passed && currentNode.next) {
        return currentNode.next;
      }
      if (!conditionResult.passed && currentNode.branches && currentNode.branches.length > 1) {
        return currentNode.branches[1];
      }
      return undefined;
    }

    return currentNode.next;
  }

  on(eventType: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
  }

  off(eventType: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  async emit(event: WorkflowEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      await Promise.all(
        Array.from(handlers).map(handler => handler(event))
      );
    }
  }
}

export class Workflow {
  private engine: WorkflowEngine;
  private definition: WorkflowDefinition;
  private instance: WorkflowInstance;
  private versions: WorkflowVersion[];
  private rollbackPoints: RollbackPoint[];
  private currentExecution: ExecutionContext | null;
  private metrics: WorkflowMetrics;

  constructor(definition: Omit<WorkflowDefinition, 'id' | 'version' | 'createdAt' | 'updatedAt'>) {
    this.engine = new WorkflowEngine();
    this.definition = {
      ...definition,
      id: generateId('wf'),
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.instance = {
      id: generateId('wfi'),
      workflowId: this.definition.id,
      version: this.definition.version,
      state: 'draft',
      executions: new Map(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.versions = [];
    this.rollbackPoints = [];
    this.currentExecution = null;
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      nodeExecutionCounts: {},
    };
  }

  getDefinition(): WorkflowDefinition {
    return { ...this.definition };
  }

  getInstance(): WorkflowInstance {
    return {
      ...this.instance,
      executions: new Map(this.instance.executions),
    };
  }

  getMetrics(): WorkflowMetrics {
    return { ...this.metrics };
  }

  getVersions(): WorkflowVersion[] {
    return [...this.versions];
  }

  getCurrentState(): WorkflowState {
    return this.instance.state;
  }

  activate(): void {
    if (this.instance.state !== 'draft' && this.instance.state !== 'paused') {
      throw new Error(`Cannot activate workflow in state: ${this.instance.state}`);
    }
    this.instance.state = 'active';
    this.instance.updatedAt = new Date();
    this.engine.emit({
      type: 'workflow.activated',
      workflowId: this.definition.id,
      timestamp: new Date(),
      data: { state: this.instance.state },
    });
  }

  pause(): void {
    if (this.instance.state !== 'active') {
      throw new Error(`Cannot pause workflow in state: ${this.instance.state}`);
    }
    this.instance.state = 'paused';
    this.instance.updatedAt = new Date();
    this.engine.emit({
      type: 'workflow.paused',
      workflowId: this.definition.id,
      timestamp: new Date(),
      data: { state: this.instance.state },
    });
  }

  async execute(initialContext: Record<string, unknown> = {}): Promise<ExecutionResult> {
    if (this.instance.state !== 'active') {
      throw new Error(`Cannot execute workflow in state: ${this.instance.state}`);
    }

    const executionId = generateId('exec');
    const context: ExecutionContext = {
      workflowId: this.definition.id,
      executionId,
      currentNodeId: this.definition.initialNodeId,
      variables: { ...initialContext },
      history: [],
      startedAt: new Date(),
      updatedAt: new Date(),
    };

    this.currentExecution = context;
    this.instance.executions.set(executionId, context);
    this.instance.currentExecutionId = executionId;
    this.instance.updatedAt = new Date();
    this.metrics.totalExecutions++;

    await this.engine.emit({
      type: 'execution.started',
      workflowId: this.definition.id,
      executionId,
      timestamp: new Date(),
      data: { context },
    });

    try {
      this.engine.buildNodeMap(this.definition);
      const result = await this.executeNext(context);

      this.instance.state = 'completed';
      this.instance.updatedAt = new Date();
      this.metrics.successfulExecutions++;

      const completedAt = new Date();
      const executionTime = completedAt.getTime() - context.startedAt.getTime();
      this.metrics.averageExecutionTime =
        (this.metrics.averageExecutionTime * (this.metrics.successfulExecutions - 1) + executionTime) /
        this.metrics.successfulExecutions;

      await this.engine.emit({
        type: 'execution.completed',
        workflowId: this.definition.id,
        executionId,
        timestamp: completedAt,
        data: { result },
      });

      await this.engine.emit({
        type: 'workflow.completed',
        workflowId: this.definition.id,
        executionId,
        timestamp: completedAt,
        data: { result },
      });

      return {
        executionId,
        workflowId: this.definition.id,
        status: 'completed',
        state: this.instance.state,
        context,
        result,
        completedAt,
      };
    } catch (error) {
      this.instance.state = 'failed';
      this.instance.updatedAt = new Date();
      this.metrics.failedExecutions++;

      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.engine.emit({
        type: 'workflow.failed',
        workflowId: this.definition.id,
        executionId,
        timestamp: new Date(),
        data: { error: errorMessage },
      });

      return {
        executionId,
        workflowId: this.definition.id,
        status: 'failed',
        state: this.instance.state,
        context,
        error: errorMessage,
      };
    } finally {
      this.currentExecution = null;
    }
  }

  private async executeNext(context: ExecutionContext): Promise<unknown> {
    let currentNodeId = context.currentNodeId;
    let result: unknown = context.variables;

    while (currentNodeId) {
      const node = this.engine['nodeMap'].get(currentNodeId);
      if (!node) {
        throw new Error(`Node not found: ${currentNodeId}`);
      }

      const retryPolicy = node.type === 'action' ? (node.config as ActionConfig).retryPolicy : undefined;
      const nodeResult = await this.engine.executeNode(node, context.variables, retryPolicy);

      if (!nodeResult.success) {
        await this.engine.emit({
          type: 'node.failed',
          workflowId: this.definition.id,
          executionId: context.executionId,
          nodeId: node.id,
          timestamp: new Date(),
          data: { error: nodeResult.error },
        });
        throw new Error(`Node ${node.id} failed: ${nodeResult.error}`);
      }

      context.history.push({
        nodeId: node.id,
        timestamp: new Date(),
        result: nodeResult.output,
      });

      this.metrics.nodeExecutionCounts[node.id] = (this.metrics.nodeExecutionCounts[node.id] || 0) + 1;

      await this.engine.emit({
        type: 'node.executed',
        workflowId: this.definition.id,
        executionId: context.executionId,
        nodeId: node.id,
        timestamp: new Date(),
        data: { output: nodeResult.output },
      });

      if (nodeResult.output && typeof nodeResult.output === 'object' && !Array.isArray(nodeResult.output)) {
        context.variables = { ...context.variables, ...(nodeResult.output as Record<string, unknown>) };
      }

      let conditionResult: ConditionResult | undefined;
      if (node.type === 'condition') {
        conditionResult = nodeResult.output as ConditionResult;
      }

      result = nodeResult.output;
      currentNodeId = this.engine.getNextNode(currentNodeId, conditionResult) || '';
      context.currentNodeId = currentNodeId;
      context.updatedAt = new Date();
    }

    return result;
  }

  updateDefinition(newDefinition: Partial<WorkflowDefinition>): void {
    const validation = this.engine.validateWorkflow({
      ...this.definition,
      ...newDefinition,
    });
    if (!validation.valid) {
      throw new Error(`Invalid workflow definition: ${validation.errors.join(', ')}`);
    }

    this.saveVersion('Update definition');
    this.definition = {
      ...this.definition,
      ...newDefinition,
      updatedAt: new Date(),
    };
    this.instance.version = this.definition.version;
    this.instance.updatedAt = new Date();
  }

  private saveVersion(changeDescription: string): void {
    this.rollbackPoints.push({
      version: this.definition.version,
      definition: this.serializeDefinition(this.definition),
      timestamp: new Date(),
    });

    this.versions.push({
      version: this.definition.version,
      definition: this.definition,
      createdAt: new Date(),
      createdBy: 'system',
      changeDescription,
    });

    this.definition.version++;
  }

  private serializeDefinition(definition: WorkflowDefinition): WorkflowDefinition {
    return {
      ...definition,
      nodes: definition.nodes.map(node => ({
        ...node,
        config: typeof node.config === 'object' ? { ...node.config } : node.config,
      })),
    };
  }

  rollback(targetVersion?: number): WorkflowDefinition {
    const rollbackPoint = this.rollbackPoints.find(rp =>
      targetVersion ? rp.version === targetVersion : true
    );

    if (!rollbackPoint) {
      throw new Error('No rollback point found');
    }

    this.definition = {
      ...rollbackPoint.definition,
      version: this.definition.version,
      updatedAt: new Date(),
    };
    this.instance.version = this.definition.version;
    this.instance.updatedAt = new Date();

    this.engine.emit({
      type: 'workflow.rolledback',
      workflowId: this.definition.id,
      timestamp: new Date(),
      data: { rolledBackToVersion: rollbackPoint.version },
    });

    return this.getDefinition();
  }

  async executeParallel(
    nodeIds: string[],
    context: Record<string, unknown>
  ): Promise<Map<string, NodeResult>> {
    const results = new Map<string, NodeResult>();
    this.engine.buildNodeMap(this.definition);

    const promises = nodeIds.map(async nodeId => {
      const node = this.engine['nodeMap'].get(nodeId);
      if (!node) {
        results.set(nodeId, {
          nodeId,
          success: false,
          output: undefined,
          error: `Node not found: ${nodeId}`,
        });
        return;
      }

      const retryPolicy = node.type === 'action' ? (node.config as ActionConfig).retryPolicy : undefined;
      const result = await this.engine.executeNode(node, context, retryPolicy);
      results.set(nodeId, result);
    });

    await Promise.all(promises);
    return results;
  }

  async executeSequential(
    nodeIds: string[],
    context: Record<string, unknown>
  ): Promise<NodeResult[]> {
    const results: NodeResult[] = [];
    this.engine.buildNodeMap(this.definition);

    for (const nodeId of nodeIds) {
      const node = this.engine['nodeMap'].get(nodeId);
      if (!node) {
        results.push({
          nodeId,
          success: false,
          output: undefined,
          error: `Node not found: ${nodeId}`,
        });
        continue;
      }

      const retryPolicy = node.type === 'action' ? (node.config as ActionConfig).retryPolicy : undefined;
      const result = await this.engine.executeNode(node, context, retryPolicy);
      results.push(result);

      if (!result.success) {
        break;
      }
    }

    return results;
  }
}

export class WorkflowManager {
  private workflows: Map<string, Workflow>;

  constructor() {
    this.workflows = new Map();
  }

  createWorkflow(definition: Omit<WorkflowDefinition, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Workflow {
    const workflow = new Workflow(definition);
    this.workflows.set(workflow.getDefinition().id, workflow);

    const wfDef = workflow.getDefinition();
    this.emitGlobalEvent({
      type: 'workflow.created',
      workflowId: wfDef.id,
      timestamp: new Date(),
      data: { definition: wfDef },
    });

    return workflow;
  }

  getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  deleteWorkflow(id: string): boolean {
    return this.workflows.delete(id);
  }

  private async emitGlobalEvent(event: WorkflowEvent): Promise<void> {
    void event;
  }
}

export { generateId };

import {
  WorkflowEngine,
  Workflow,
  WorkflowManager,
  ConditionEvaluator,
  ActionExecutor,
  WorkflowDefinition,
  WorkflowNode,
  ActionConfig,
  Condition,
  RetryPolicy,
  LoopConfig,
  ParallelConfig,
  WorkflowEvent,
  ConditionResult,
  NodeResult,
  generateId,
} from '../src/core/workflowAutomation';

describe('WorkflowAutomation', () => {
  describe('generateId', () => {
    it('should generate ID with correct prefix', () => {
      const id = generateId('wf');
      expect(id.startsWith('wf_')).toBe(true);
    });

    it('should generate unique IDs', () => {
      const id1 = generateId('wf');
      const id2 = generateId('wf');
      expect(id1).not.toBe(id2);
    });

    it('should generate ID with hex string after prefix', () => {
      const id = generateId('test');
      const parts = id.split('_');
      expect(parts.length).toBe(2);
      expect(parts[1]).toMatch(/^[a-f0-9]{16}$/);
    });
  });

  describe('ConditionEvaluator', () => {
    let evaluator: ConditionEvaluator;

    beforeEach(() => {
      evaluator = new ConditionEvaluator();
    });

    it('should evaluate equals condition correctly', () => {
      const condition: Condition = { field: 'status', operator: 'equals', value: 'active' };
      const context = { status: 'active' };
      expect(evaluator.evaluate(condition, context)).toBe(true);
    });

    it('should evaluate not_equals condition correctly', () => {
      const condition: Condition = { field: 'status', operator: 'not_equals', value: 'active' };
      const context = { status: 'pending' };
      expect(evaluator.evaluate(condition, context)).toBe(true);
    });

    it('should evaluate greater_than condition correctly', () => {
      const condition: Condition = { field: 'count', operator: 'greater_than', value: 5 };
      const context = { count: 10 };
      expect(evaluator.evaluate(condition, context)).toBe(true);
    });

    it('should evaluate less_than condition correctly', () => {
      const condition: Condition = { field: 'count', operator: 'less_than', value: 10 };
      const context = { count: 5 };
      expect(evaluator.evaluate(condition, context)).toBe(true);
    });

    it('should evaluate contains condition correctly', () => {
      const condition: Condition = { field: 'message', operator: 'contains', value: 'hello' };
      const context = { message: 'hello world' };
      expect(evaluator.evaluate(condition, context)).toBe(true);
    });

    it('should evaluate is_empty condition for null', () => {
      const condition: Condition = { field: 'value', operator: 'is_empty', value: null };
      const context = { value: null };
      expect(evaluator.evaluate(condition, context)).toBe(true);
    });

    it('should evaluate is_empty condition for empty string', () => {
      const condition: Condition = { field: 'value', operator: 'is_empty', value: null };
      const context = { value: '' };
      expect(evaluator.evaluate(condition, context)).toBe(true);
    });

    it('should evaluate nested field access', () => {
      const condition: Condition = { field: 'user.name', operator: 'equals', value: 'John' };
      const context = { user: { name: 'John' } };
      expect(evaluator.evaluate(condition, context)).toBe(true);
    });

    it('should return false for non-matching equals', () => {
      const condition: Condition = { field: 'status', operator: 'equals', value: 'active' };
      const context = { status: 'pending' };
      expect(evaluator.evaluate(condition, context)).toBe(false);
    });
  });

  describe('ActionExecutor', () => {
    let executor: ActionExecutor;

    beforeEach(() => {
      executor = new ActionExecutor();
    });

    it('should execute http_request action', async () => {
      const config: ActionConfig = {
        type: 'http_request',
        params: { url: 'https://api.example.com', method: 'GET' },
      };
      const result = await executor.execute(config, {});
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('data');
    });

    it('should execute email action', async () => {
      const config: ActionConfig = {
        type: 'email',
        params: { to: 'test@example.com', subject: 'Test', body: 'Hello' },
      };
      const result = await executor.execute(config, {});
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('messageId');
    });

    it('should execute slack action', async () => {
      const config: ActionConfig = {
        type: 'slack',
        params: { channel: '#general', message: 'Hello' },
      };
      const result = await executor.execute(config, {});
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('timestamp');
    });

    it('should execute database action', async () => {
      const config: ActionConfig = {
        type: 'database',
        params: { operation: 'INSERT', table: 'users', data: { name: 'John' } },
      };
      const result = await executor.execute(config, {});
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('affectedRows');
    });

    it('should execute transform action', async () => {
      const config: ActionConfig = {
        type: 'transform',
        params: { mapping: { name: 'user.name' } },
      };
      const result = await executor.execute(config, { user: { name: 'John' } });
      expect(result).toHaveProperty('user');
    });

    it('should execute filter action', async () => {
      const config: ActionConfig = {
        type: 'filter',
        params: { conditions: [] },
      };
      const result = await executor.execute(config, { data: [1, 2, 3] });
      expect(result).toEqual({ data: [1, 2, 3] });
    });

    it('should throw error for unknown action type', async () => {
      const config = { type: 'unknown' as ActionConfig['type'], params: {} };
      await expect(executor.execute(config as ActionConfig, {})).rejects.toThrow('Unknown action type');
    });

    it('should execute with retry policy', async () => {
      const config: ActionConfig = {
        type: 'http_request',
        params: { url: 'https://api.example.com' },
      };
      const retryPolicy: RetryPolicy = { maxAttempts: 3, delayMs: 10 };
      const result = await executor.executeWithRetry(config, {}, retryPolicy);
      expect(result).toHaveProperty('status');
    });
  });

  describe('WorkflowEngine', () => {
    let engine: WorkflowEngine;

    beforeEach(() => {
      engine = new WorkflowEngine();
    });

    it('should execute trigger node', async () => {
      const node: WorkflowNode = {
        id: 'trigger_1',
        type: 'trigger',
        name: 'Start',
        config: {},
      };
      const result = await engine.executeNode(node, {});
      expect(result.success).toBe(true);
      expect(result.output).toHaveProperty('triggered', true);
    });

    it('should execute action node', async () => {
      const node: WorkflowNode = {
        id: 'action_1',
        type: 'action',
        name: 'Send Email',
        config: {
          type: 'email',
          params: { to: 'test@example.com', subject: 'Test', body: 'Hello' },
        } as ActionConfig,
      };
      const result = await engine.executeNode(node, {});
      expect(result.success).toBe(true);
      expect(result.output).toHaveProperty('success', true);
    });

    it('should execute condition node with passing condition', async () => {
      const node: WorkflowNode = {
        id: 'condition_1',
        type: 'condition',
        name: 'Check Status',
        config: {},
        conditions: [{ field: 'status', operator: 'equals', value: 'active' }],
        next: 'action_2',
        branches: ['action_2', 'action_3'],
      };
      const result = await engine.executeNode(node, { status: 'active' });
      expect(result.success).toBe(true);
      const conditionResult = result.output as ConditionResult;
      expect(conditionResult.passed).toBe(true);
    });

    it('should execute condition node with failing condition', async () => {
      const node: WorkflowNode = {
        id: 'condition_1',
        type: 'condition',
        name: 'Check Status',
        config: {},
        conditions: [{ field: 'status', operator: 'equals', value: 'active' }],
        next: 'action_2',
        branches: ['action_2', 'action_3'],
      };
      const result = await engine.executeNode(node, { status: 'pending' });
      expect(result.success).toBe(true);
      const conditionResult = result.output as ConditionResult;
      expect(conditionResult.passed).toBe(false);
    });

    it('should execute loop node', async () => {
      const node: WorkflowNode = {
        id: 'loop_1',
        type: 'loop',
        name: 'Process Items',
        config: {},
        loopConfig: { iterations: 3 } as LoopConfig,
        next: 'action_2',
      };
      const result = await engine.executeNode(node, {});
      expect(result.success).toBe(true);
      expect(result.output).toHaveProperty('loopResults');
      expect(result.output).toHaveProperty('count', 3);
    });

    it('should execute loop node with items path', async () => {
      const node: WorkflowNode = {
        id: 'loop_1',
        type: 'loop',
        name: 'Process Items',
        config: {},
        loopConfig: { iterations: 0, itemsPath: 'items' } as LoopConfig,
        next: 'action_2',
      };
      const result = await engine.executeNode(node, { items: ['a', 'b', 'c'] });
      expect(result.success).toBe(true);
      expect(result.output).toHaveProperty('count', 3);
    });

    it('should execute parallel node', async () => {
      const node: WorkflowNode = {
        id: 'parallel_1',
        type: 'parallel',
        name: 'Parallel Tasks',
        config: {},
        parallelConfig: { branches: ['branch_1', 'branch_2'], waitForAll: true } as ParallelConfig,
        next: 'merge_1',
      };
      const result = await engine.executeNode(node, {});
      expect(result.success).toBe(true);
      expect(result.output).toHaveProperty('parallelResults');
    });

    it('should validate workflow with valid definition', () => {
      const definition: WorkflowDefinition = {
        id: 'wf_1',
        name: 'Test Workflow',
        version: 1,
        nodes: [
          { id: 'trigger_1', type: 'trigger', name: 'Start', config: {} },
          { id: 'action_1', type: 'action', name: 'Do Something', config: {} as ActionConfig },
        ],
        edges: [{ from: 'trigger_1', to: 'action_1' }],
        initialNodeId: 'trigger_1',
        executionMode: 'sequential',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const validation = engine.validateWorkflow(definition);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should validate workflow with missing initial node', () => {
      const definition: WorkflowDefinition = {
        id: 'wf_1',
        name: 'Test Workflow',
        version: 1,
        nodes: [
          { id: 'action_1', type: 'action', name: 'Do Something', config: {} as ActionConfig },
        ],
        edges: [],
        initialNodeId: 'non_existent',
        executionMode: 'sequential',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const validation = engine.validateWorkflow(definition);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Initial node ID not found in workflow nodes');
    });

    it('should validate workflow with empty nodes', () => {
      const definition: WorkflowDefinition = {
        id: 'wf_1',
        name: 'Test Workflow',
        version: 1,
        nodes: [],
        edges: [],
        initialNodeId: '',
        executionMode: 'sequential',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const validation = engine.validateWorkflow(definition);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Workflow must have at least one node');
    });

    it('should get next node for sequential execution', () => {
      const definition: WorkflowDefinition = {
        id: 'wf_1',
        name: 'Test Workflow',
        version: 1,
        nodes: [
          { id: 'trigger_1', type: 'trigger', name: 'Start', config: {}, next: 'action_1' },
          { id: 'action_1', type: 'action', name: 'Do Something', config: {} as ActionConfig },
        ],
        edges: [{ from: 'trigger_1', to: 'action_1' }],
        initialNodeId: 'trigger_1',
        executionMode: 'sequential',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      engine.buildNodeMap(definition);
      const nextNodeId = engine.getNextNode('trigger_1');
      expect(nextNodeId).toBe('action_1');
    });

    it('should emit and receive events', async () => {
      let receivedEvent: WorkflowEvent | null = null;
      const handler = (event: WorkflowEvent) => {
        receivedEvent = event;
      };
      engine.on('workflow.activated', handler);

      const event: WorkflowEvent = {
        type: 'workflow.activated',
        workflowId: 'wf_1',
        timestamp: new Date(),
        data: { state: 'active' },
      };
      await engine.emit(event);

      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent!.type).toBe('workflow.activated');

      engine.off('workflow.activated', handler);
    });
  });

  describe('Workflow', () => {
    let workflow: Workflow;
    let definition: Omit<WorkflowDefinition, 'id' | 'version' | 'createdAt' | 'updatedAt'>;

    beforeEach(() => {
      definition = {
        name: 'Test Workflow',
        nodes: [
          { id: 'trigger_1', type: 'trigger', name: 'Start', config: {} },
          {
            id: 'action_1',
            type: 'action',
            name: 'Send Email',
            config: {
              type: 'email',
              params: { to: 'test@example.com', subject: 'Test', body: 'Hello' },
            } as ActionConfig,
            next: 'trigger_1',
          },
        ],
        edges: [{ from: 'trigger_1', to: 'action_1' }],
        initialNodeId: 'trigger_1',
        executionMode: 'sequential',
      };
      workflow = new Workflow(definition);
    });

    it('should create workflow with draft state', () => {
      expect(workflow.getCurrentState()).toBe('draft');
    });

    it('should get definition', () => {
      const wfDef = workflow.getDefinition();
      expect(wfDef.name).toBe('Test Workflow');
      expect(wfDef.version).toBe(1);
    });

    it('should activate workflow', () => {
      workflow.activate();
      expect(workflow.getCurrentState()).toBe('active');
    });

    it('should pause active workflow', () => {
      workflow.activate();
      workflow.pause();
      expect(workflow.getCurrentState()).toBe('paused');
    });

    it('should not pause draft workflow', () => {
      expect(() => workflow.pause()).toThrow('Cannot pause workflow in state: draft');
    });

    it('should not activate non-draft workflow', () => {
      workflow.activate();
      expect(() => workflow.activate()).toThrow('Cannot activate workflow in state: active');
    });

    it('should not execute non-active workflow', async () => {
      await expect(workflow.execute()).rejects.toThrow('Cannot execute workflow in state: draft');
    });

    it('should execute workflow and complete', async () => {
      workflow.activate();
      const result = await workflow.execute({ input: 'test' });
      expect(result.status).toBe('completed');
      expect(result.state).toBe('completed');
      expect(result.context.variables).toHaveProperty('input', 'test');
    });

    it('should track execution metrics', async () => {
      workflow.activate();
      await workflow.execute();
      const metrics = workflow.getMetrics();
      expect(metrics.totalExecutions).toBe(1);
      expect(metrics.successfulExecutions).toBe(1);
      expect(metrics.failedExecutions).toBe(0);
    });

    it('should save version on update', () => {
      workflow.updateDefinition({ name: 'Updated Workflow' });
      const versions = workflow.getVersions();
      expect(versions.length).toBe(1);
    });

    it('should throw error for invalid update', () => {
      expect(() => workflow.updateDefinition({ initialNodeId: 'non_existent' })).toThrow();
    });

    it('should rollback to previous version', () => {
      const originalName = workflow.getDefinition().name;
      workflow.updateDefinition({ name: 'Modified Name' });
      const rolledBack = workflow.rollback();
      expect(rolledBack.name).toBe(originalName);
    });

    it('should not rollback when no rollback points exist', () => {
      expect(() => workflow.rollback()).toThrow('No rollback point found');
    });

    it('should get workflow instance', () => {
      const instance = workflow.getInstance();
      expect(instance.state).toBe('draft');
      expect(instance.executions).toBeInstanceOf(Map);
    });

    it('should get workflow metrics', () => {
      const metrics = workflow.getMetrics();
      expect(metrics).toHaveProperty('totalExecutions');
      expect(metrics).toHaveProperty('successfulExecutions');
      expect(metrics).toHaveProperty('failedExecutions');
      expect(metrics).toHaveProperty('averageExecutionTime');
      expect(metrics).toHaveProperty('nodeExecutionCounts');
    });

    it('should execute parallel nodes', async () => {
      workflow = new Workflow({
        ...definition,
        nodes: [
          { id: 'trigger_1', type: 'trigger', name: 'Start', config: {} },
          {
            id: 'action_1',
            type: 'action',
            name: 'Action 1',
            config: { type: 'email', params: { to: 'a@test.com' } } as ActionConfig,
          },
          {
            id: 'action_2',
            type: 'action',
            name: 'Action 2',
            config: { type: 'email', params: { to: 'b@test.com' } } as ActionConfig,
          },
        ],
        initialNodeId: 'trigger_1',
      });

      const results = await workflow.executeParallel(
        ['action_1', 'action_2'],
        {}
      );
      expect(results.size).toBe(2);
      expect(results.get('action_1')?.success).toBe(true);
      expect(results.get('action_2')?.success).toBe(true);
    });

    it('should execute sequential nodes', async () => {
      workflow = new Workflow({
        ...definition,
        nodes: [
          { id: 'trigger_1', type: 'trigger', name: 'Start', config: {} },
          {
            id: 'action_1',
            type: 'action',
            name: 'Action 1',
            config: { type: 'email', params: { to: 'a@test.com' } } as ActionConfig,
          },
          {
            id: 'action_2',
            type: 'action',
            name: 'Action 2',
            config: { type: 'email', params: { to: 'b@test.com' } } as ActionConfig,
          },
        ],
        initialNodeId: 'trigger_1',
      });

      const results = await workflow.executeSequential(
        ['action_1', 'action_2'],
        {}
      );
      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });

  describe('WorkflowManager', () => {
    let manager: WorkflowManager;

    beforeEach(() => {
      manager = new WorkflowManager();
    });

    it('should create workflow', () => {
      const workflow = manager.createWorkflow({
        name: 'Test Workflow',
        nodes: [
          { id: 'trigger_1', type: 'trigger', name: 'Start', config: {} },
        ],
        edges: [],
        initialNodeId: 'trigger_1',
        executionMode: 'sequential',
      });
      expect(workflow).toBeInstanceOf(Workflow);
    });

    it('should get workflow by id', () => {
      const created = manager.createWorkflow({
        name: 'Test Workflow',
        nodes: [
          { id: 'trigger_1', type: 'trigger', name: 'Start', config: {} },
        ],
        edges: [],
        initialNodeId: 'trigger_1',
        executionMode: 'sequential',
      });
      const wfDef = created.getDefinition();
      const retrieved = manager.getWorkflow(wfDef.id);
      expect(retrieved).toBeInstanceOf(Workflow);
    });

    it('should return undefined for non-existent workflow', () => {
      const retrieved = manager.getWorkflow('non_existent');
      expect(retrieved).toBeUndefined();
    });

    it('should get all workflows', () => {
      manager.createWorkflow({
        name: 'Workflow 1',
        nodes: [{ id: 't1', type: 'trigger', name: 'Start', config: {} }],
        edges: [],
        initialNodeId: 't1',
        executionMode: 'sequential',
      });
      manager.createWorkflow({
        name: 'Workflow 2',
        nodes: [{ id: 't2', type: 'trigger', name: 'Start', config: {} }],
        edges: [],
        initialNodeId: 't2',
        executionMode: 'sequential',
      });
      const workflows = manager.getAllWorkflows();
      expect(workflows.length).toBe(2);
    });

    it('should delete workflow', () => {
      const workflow = manager.createWorkflow({
        name: 'Test Workflow',
        nodes: [{ id: 'trigger_1', type: 'trigger', name: 'Start', config: {} }],
        edges: [],
        initialNodeId: 'trigger_1',
        executionMode: 'sequential',
      });
      const wfDef = workflow.getDefinition();
      const deleted = manager.deleteWorkflow(wfDef.id);
      expect(deleted).toBe(true);
      expect(manager.getWorkflow(wfDef.id)).toBeUndefined();
    });

    it('should return false when deleting non-existent workflow', () => {
      const deleted = manager.deleteWorkflow('non_existent');
      expect(deleted).toBe(false);
    });
  });
});

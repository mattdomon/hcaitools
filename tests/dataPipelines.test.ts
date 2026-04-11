import {
  Pipeline,
  PipelineManager,
  PipelineEngine,
  TransformationEngine,
  DataTransformer,
  RetryHandler,
  generateId,
  PipelineOptions,
  PipelineDefinition,
  Transformation,
  PipelineStage,
  Trigger,
  FilterConfig,
  MapConfig,
  ReduceConfig,
  JoinConfig,
  AggregateConfig,
  RetryConfig,
} from '../src/core/dataPipelines';

describe('DataPipelines Module', () => {
  describe('generateId', () => {
    it('should generate unique IDs with prefix', () => {
      const id1 = generateId('test');
      const id2 = generateId('test');
      expect(id1).toMatch(/^test_[a-f0-9]{16}$/);
      expect(id2).toMatch(/^test_[a-f0-9]{16}$/);
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with different prefixes', () => {
      const id1 = generateId('pipeline');
      const id2 = generateId('stage');
      expect(id1.startsWith('pipeline_')).toBe(true);
      expect(id2.startsWith('stage_')).toBe(true);
    });
  });

  describe('DataTransformer', () => {
    const transformer = new DataTransformer();

    it('should filter data based on predicate', () => {
      const data = [1, 2, 3, 4, 5];
      const result = transformer.filter(data, x => x > 2);
      expect(result).toEqual([3, 4, 5]);
    });

    it('should map data using mapper function', () => {
      const data = [1, 2, 3];
      const result = transformer.map(data, x => x * 2);
      expect(result).toEqual([2, 4, 6]);
    });

    it('should reduce data to single value', () => {
      const data = [1, 2, 3, 4];
      const result = transformer.reduce(data, (acc, x) => acc + x, 0);
      expect(result).toBe(10);
    });

    it('should group data by key function', () => {
      const data = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 },
      ];
      const result = transformer.groupBy(data, item => item.type);
      expect(result.get('a')).toEqual([
        { type: 'a', value: 1 },
        { type: 'a', value: 3 },
      ]);
      expect(result.get('b')).toEqual([{ type: 'b', value: 2 }]);
    });

    it('should partition data into multiple arrays', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8];
      const result = transformer.partition(data, 3);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual([1, 4, 7]);
      expect(result[1]).toEqual([2, 5, 8]);
      expect(result[2]).toEqual([3, 6]);
    });
  });

  describe('TransformationEngine', () => {
    let engine: TransformationEngine;

    beforeEach(() => {
      engine = new TransformationEngine();
    });

    it('should execute filter transformation', async () => {
      const transformation: Transformation = {
        id: 'filter1',
        type: 'filter',
        config: {
          field: 'age',
          operator: 'greater_than',
          value: 25,
        } as FilterConfig,
        order: 0,
      };

      const records = [
        { data: { name: 'Alice', age: 30 } },
        { data: { name: 'Bob', age: 20 } },
        { data: { name: 'Charlie', age: 35 } },
      ];

      const result = await engine.execute(transformation, records, {});
      expect(result.success).toBe(true);
      expect(result.outputRecords).toHaveLength(2);
      expect(result.outputRecords[0]).toEqual({ data: { name: 'Alice', age: 30 } });
    });

    it('should execute map transformation', async () => {
      const transformation: Transformation = {
        id: 'map1',
        type: 'map',
        config: {
          fields: {
            fullName: 'name',
            userAge: 'age',
          },
        } as MapConfig,
        order: 0,
      };

      const records = [
        { data: { name: 'Alice', age: 30, extra: 'field' } },
      ];

      const result = await engine.execute(transformation, records, {});
      expect(result.success).toBe(true);
      expect(result.outputRecords[0]).toEqual({
        data: { fullName: 'Alice', userAge: 30 },
      });
    });

    it('should execute reduce transformation', async () => {
      const transformation: Transformation = {
        id: 'reduce1',
        type: 'reduce',
        config: {
          groupBy: ['department'],
          aggregations: [
            { field: 'salary', function: 'sum', alias: 'totalSalary' },
            { field: 'salary', function: 'count', alias: 'count' },
            { field: 'salary', function: 'avg', alias: 'avgSalary' },
          ],
        } as ReduceConfig,
        order: 0,
      };

      const records = [
        { data: { department: 'Engineering', salary: 100 } },
        { data: { department: 'Engineering', salary: 200 } },
        { data: { department: 'Sales', salary: 150 } },
      ];

      const result = await engine.execute(transformation, records, {});
      expect(result.success).toBe(true);
      expect(result.outputRecords).toHaveLength(2);
    });

    it('should execute join transformation', async () => {
      const transformation: Transformation = {
        id: 'join1',
        type: 'join',
        config: {
          leftKey: 'id',
          rightKey: 'id',
          joinType: 'inner',
          rightSource: 'orders',
        } as JoinConfig,
        order: 0,
      };

      const leftRecords = [
        { data: { id: 1, name: 'Alice' } },
        { data: { id: 2, name: 'Bob' } },
      ];

      const context = {
        orders: [
          { data: { id: 1, order: 'A' } },
          { data: { id: 3, order: 'C' } },
        ],
      };

      const result = await engine.execute(transformation, leftRecords, context);
      expect(result.success).toBe(true);
      expect(result.outputRecords).toHaveLength(1);
      expect((result.outputRecords[0] as { data: Record<string, unknown> }).data.id).toBe(1);
    });

    it('should execute aggregate transformation', async () => {
      const transformation: Transformation = {
        id: 'agg1',
        type: 'aggregate',
        config: {
          groupByFields: ['category'],
          operations: [
            { field: 'amount', operation: 'sum', outputField: 'total' },
            { field: 'amount', operation: 'count', outputField: 'count' },
          ],
        } as AggregateConfig,
        order: 0,
      };

      const records = [
        { data: { category: 'A', amount: 100 } },
        { data: { category: 'A', amount: 200 } },
        { data: { category: 'B', amount: 150 } },
      ];

      const result = await engine.execute(transformation, records, {});
      expect(result.success).toBe(true);
      expect(result.outputRecords).toHaveLength(2);
    });
  });

  describe('RetryHandler', () => {
    let handler: RetryHandler;

    beforeEach(() => {
      handler = new RetryHandler();
    });

    it('should not retry when disabled', async () => {
      const config: RetryConfig = {
        enabled: false,
        policy: { maxAttempts: 3, delayMs: 10 },
      };

      const fn = jest.fn().mockResolvedValue('success');
      const result = await handler.executeWithRetry(fn, config, {});
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure up to max attempts', async () => {
      const config: RetryConfig = {
        enabled: true,
        policy: { maxAttempts: 3, delayMs: 10 },
      };

      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const result = await handler.executeWithRetry(fn, config, {});
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after exhausting retries', async () => {
      const config: RetryConfig = {
        enabled: true,
        policy: { maxAttempts: 3, delayMs: 10 },
      };

      const fn = jest.fn().mockRejectedValue(new Error('always fails'));

      await expect(handler.executeWithRetry(fn, config, {})).rejects.toThrow('always fails');
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('PipelineEngine', () => {
    let engine: PipelineEngine;

    beforeEach(() => {
      engine = new PipelineEngine();
    });

    it('should validate a valid pipeline', () => {
      const definition: PipelineDefinition = {
        id: 'test',
        name: 'Test Pipeline',
        type: 'etl',
        version: 1,
        stages: [
          {
            id: 'stage1',
            name: 'Stage 1',
            type: 'source',
            config: {},
            transformations: [],
          },
        ],
        triggers: [],
        executionMode: 'sequential',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = engine.validatePipeline(definition);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject pipeline without stages', () => {
      const definition: PipelineDefinition = {
        id: 'test',
        name: 'Test Pipeline',
        type: 'etl',
        version: 1,
        stages: [],
        triggers: [],
        executionMode: 'sequential',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = engine.validatePipeline(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Pipeline must have at least one stage');
    });

    it('should execute stage with transformations', async () => {
      const stage: PipelineStage = {
        id: 'stage1',
        name: 'Test Stage',
        type: 'transform',
        config: {},
        transformations: [
          {
            id: 't1',
            type: 'map',
            config: { fields: { doubled: 'value' } } as MapConfig,
            order: 0,
          },
        ],
      };

      const records = [{ data: { value: 5 } }];
      const context = { inputData: records, stages: [stage] };

      const result = await engine.executeStage(stage, context);
      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(1);
    });

    it('should execute parallel stages', async () => {
      const stages: PipelineStage[] = [
        {
          id: 'stage1',
          name: 'Stage 1',
          type: 'transform',
          config: {},
          transformations: [],
        },
        {
          id: 'stage2',
          name: 'Stage 2',
          type: 'transform',
          config: {},
          transformations: [],
        },
      ];

      engine.buildStageMap(stages);
      const results = await engine.executeParallel(['stage1', 'stage2'], {
        inputData: [{ data: {} }],
        stages,
      });

      expect(results.size).toBe(2);
      expect(results.get('stage1')?.success).toBe(true);
      expect(results.get('stage2')?.success).toBe(true);
    });

    it('should execute sequential stages', async () => {
      const stages: PipelineStage[] = [
        {
          id: 'stage1',
          name: 'Stage 1',
          type: 'transform',
          config: {},
          transformations: [],
        },
        {
          id: 'stage2',
          name: 'Stage 2',
          type: 'transform',
          config: {},
          transformations: [],
        },
      ];

      engine.buildStageMap(stages);
      const results = await engine.executeSequential(['stage1', 'stage2'], {
        inputData: [{ data: {} }],
        stages,
      });

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should register and emit event handlers', async () => {
      const handler = jest.fn();
      engine.on('pipeline.completed', handler);

      await engine.emit({
        type: 'pipeline.completed',
        pipelineId: 'test',
        timestamp: new Date(),
        data: {},
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should remove event handlers', async () => {
      const handler = jest.fn();
      engine.on('pipeline.completed', handler);
      engine.off('pipeline.completed', handler);

      await engine.emit({
        type: 'pipeline.completed',
        pipelineId: 'test',
        timestamp: new Date(),
        data: {},
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Pipeline', () => {
    const createValidPipelineOptions = (): PipelineOptions => ({
      definition: {
        name: 'Test Pipeline',
        type: 'etl',
        stages: [
          {
            id: 'source',
            name: 'Source Stage',
            type: 'source',
            config: {},
            transformations: [],
          },
          {
            id: 'transform',
            name: 'Transform Stage',
            type: 'transform',
            config: {},
            transformations: [
              {
                id: 't1',
                type: 'map',
                config: { fields: { value: 'value' } } as MapConfig,
                order: 0,
              },
            ],
          },
        ],
        triggers: [],
        executionMode: 'sequential',
      },
    });

    it('should create pipeline with draft state', () => {
      const options = createValidPipelineOptions();
      const pipeline = new Pipeline(options);
      expect(pipeline.getCurrentState()).toBe('draft');
    });

    it('should activate pipeline', () => {
      const options = createValidPipelineOptions();
      const pipeline = new Pipeline(options);
      pipeline.activate();
      expect(pipeline.getCurrentState()).toBe('active');
    });

    it('should pause active pipeline', () => {
      const options = createValidPipelineOptions();
      const pipeline = new Pipeline(options);
      pipeline.activate();
      pipeline.pause();
      expect(pipeline.getCurrentState()).toBe('paused');
    });

    it('should not activate non-draft pipeline', () => {
      const options = createValidPipelineOptions();
      const pipeline = new Pipeline(options);
      pipeline.activate();
      expect(() => pipeline.activate()).toThrow('Cannot activate pipeline in state: active');
    });

    it('should not pause non-active pipeline', () => {
      const options = createValidPipelineOptions();
      const pipeline = new Pipeline(options);
      expect(() => pipeline.pause()).toThrow('Cannot pause pipeline in state: draft');
    });

    it('should execute pipeline successfully', async () => {
      const options = createValidPipelineOptions();
      const pipeline = new Pipeline(options);
      pipeline.activate();

      const result = await pipeline.execute([{ data: { value: 5 } }]);
      expect(result.status).toBe('completed');
      expect(result.state).toBe('completed');
    });

    it('should not execute draft pipeline', async () => {
      const options = createValidPipelineOptions();
      const pipeline = new Pipeline(options);

      await expect(pipeline.execute()).rejects.toThrow('Cannot execute pipeline in state: draft');
    });

    it('should track execution metrics', async () => {
      const options = createValidPipelineOptions();
      const pipeline = new Pipeline(options);
      pipeline.activate();

      await pipeline.execute([{ data: { value: 5 } }]);

      const metrics = pipeline.getMetrics();
      expect(metrics.totalExecutions).toBe(1);
      expect(metrics.successfulExecutions).toBe(1);
    });

    it('should update definition', () => {
      const options = createValidPipelineOptions();
      const pipeline = new Pipeline(options);

      pipeline.updateDefinition({ description: 'Updated description' });

      const definition = pipeline.getDefinition();
      expect(definition.description).toBe('Updated description');
    });

    it('should rollback to previous version', () => {
      const options = createValidPipelineOptions();
      const pipeline = new Pipeline(options);

      const originalDefinition = pipeline.getDefinition();
      pipeline.updateDefinition({ description: 'New description' });
      const rolledBack = pipeline.rollback(1);

      expect(rolledBack.description).toBe(originalDefinition.description);
    });

    it('should register event handlers', () => {
      const options = createValidPipelineOptions();
      const pipeline = new Pipeline(options);
      const handler = jest.fn();

      pipeline.on('stage.completed', handler);
      pipeline.off('stage.completed', handler);
    });

    it('should get pipeline definition', () => {
      const options = createValidPipelineOptions();
      const pipeline = new Pipeline(options);

      const definition = pipeline.getDefinition();
      expect(definition.name).toBe('Test Pipeline');
      expect(definition.type).toBe('etl');
    });

    it('should get pipeline instance', () => {
      const options = createValidPipelineOptions();
      const pipeline = new Pipeline(options);

      const instance = pipeline.getInstance();
      expect(instance.pipelineId).toBe(pipeline.getDefinition().id);
      expect(instance.state).toBe('draft');
    });
  });

  describe('PipelineManager', () => {
    let manager: PipelineManager;

    beforeEach(() => {
      manager = new PipelineManager();
    });

    it('should create pipeline', () => {
      const options: PipelineOptions = {
        definition: {
          name: 'Managed Pipeline',
          type: 'etl',
          stages: [
            {
              id: 'stage1',
              name: 'Stage 1',
              type: 'source',
              config: {},
              transformations: [],
            },
          ],
          triggers: [],
          executionMode: 'sequential',
        },
      };

      const pipeline = manager.createPipeline(options);
      expect(pipeline.getDefinition().name).toBe('Managed Pipeline');
    });

    it('should get pipeline by id', () => {
      const options: PipelineOptions = {
        definition: {
          name: 'Test',
          type: 'etl',
          stages: [],
          triggers: [],
          executionMode: 'sequential',
        },
      };

      const pipeline = manager.createPipeline(options);
      const retrieved = manager.getPipeline(pipeline.getDefinition().id);
      expect(retrieved).toBeDefined();
    });

    it('should return undefined for non-existent pipeline', () => {
      const retrieved = manager.getPipeline('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should get all pipelines', () => {
      const options: PipelineOptions = {
        definition: {
          name: 'Test',
          type: 'etl',
          stages: [],
          triggers: [],
          executionMode: 'sequential',
        },
      };

      manager.createPipeline(options);
      manager.createPipeline(options);

      const pipelines = manager.getAllPipelines();
      expect(pipelines).toHaveLength(2);
    });

    it('should delete pipeline', () => {
      const options: PipelineOptions = {
        definition: {
          name: 'Test',
          type: 'etl',
          stages: [],
          triggers: [],
          executionMode: 'sequential',
        },
      };

      const pipeline = manager.createPipeline(options);
      const id = pipeline.getDefinition().id;

      expect(manager.deletePipeline(id)).toBe(true);
      expect(manager.getPipeline(id)).toBeUndefined();
    });

    it('should return false when deleting non-existent pipeline', () => {
      expect(manager.deletePipeline('non-existent')).toBe(false);
    });
  });

  describe('Pipeline with scheduled triggers', () => {
    it('should setup scheduled trigger on activation', () => {
      const options: PipelineOptions = {
        definition: {
          name: 'Scheduled Pipeline',
          type: 'etl',
          stages: [
            {
              id: 'stage1',
              name: 'Stage 1',
              type: 'source',
              config: {},
              transformations: [],
            },
          ],
          triggers: [
            {
              id: 'trigger1',
              type: 'scheduled',
              enabled: true,
              config: {
                intervalMs: 60000,
              },
            },
          ],
          executionMode: 'sequential',
        },
      };

      const pipeline = new Pipeline(options);
      pipeline.activate();
      expect(pipeline.getCurrentState()).toBe('active');
      pipeline.pause();
    });

    it('should cancel scheduled executions on pause', () => {
      const options: PipelineOptions = {
        definition: {
          name: 'Scheduled Pipeline',
          type: 'etl',
          stages: [
            {
              id: 'stage1',
              name: 'Stage 1',
              type: 'source',
              config: {},
              transformations: [],
            },
          ],
          triggers: [
            {
              id: 'trigger1',
              type: 'scheduled',
              enabled: true,
              config: {
                intervalMs: 60000,
              },
            },
          ],
          executionMode: 'sequential',
        },
      };

      const pipeline = new Pipeline(options);
      pipeline.activate();
      pipeline.pause();
      expect(pipeline.getCurrentState()).toBe('paused');
    });
  });

  describe('Pipeline execution modes', () => {
    it('should execute in sequential mode', async () => {
      const options: PipelineOptions = {
        definition: {
          name: 'Sequential Pipeline',
          type: 'etl',
          stages: [
            {
              id: 's1',
              name: 'Stage 1',
              type: 'transform',
              config: {},
              transformations: [],
            },
            {
              id: 's2',
              name: 'Stage 2',
              type: 'transform',
              config: {},
              transformations: [],
            },
          ],
          triggers: [],
          executionMode: 'sequential',
        },
      };

      const pipeline = new Pipeline(options);
      pipeline.activate();
      const result = await pipeline.execute([{ data: { value: 1 } }]);
      expect(result.status).toBe('completed');
    });

    it('should execute in parallel mode', async () => {
      const options: PipelineOptions = {
        definition: {
          name: 'Parallel Pipeline',
          type: 'etl',
          stages: [
            {
              id: 's1',
              name: 'Stage 1',
              type: 'transform',
              config: {},
              transformations: [],
            },
            {
              id: 's2',
              name: 'Stage 2',
              type: 'transform',
              config: {},
              transformations: [],
            },
          ],
          triggers: [],
          executionMode: 'parallel',
        },
      };

      const pipeline = new Pipeline(options);
      pipeline.activate();
      const result = await pipeline.execute([{ data: { value: 1 } }]);
      expect(result.status).toBe('completed');
    });

    it('should execute in partitioned mode', async () => {
      const options: PipelineOptions = {
        definition: {
          name: 'Partitioned Pipeline',
          type: 'etl',
          stages: [
            {
              id: 's1',
              name: 'Stage 1',
              type: 'transform',
              config: {},
              transformations: [],
            },
          ],
          triggers: [],
          executionMode: 'partitioned',
        },
      };

      const pipeline = new Pipeline(options);
      pipeline.activate();
      const result = await pipeline.execute([{ data: { value: 1 } }, { data: { value: 2 } }]);
      expect(result.status).toBe('completed');
    });
  });

  describe('Error handling', () => {
    it('should handle transformation errors', async () => {
      const options: PipelineOptions = {
        definition: {
          name: 'Error Pipeline',
          type: 'etl',
          stages: [
            {
              id: 's1',
              name: 'Stage 1',
              type: 'transform',
              config: {},
              transformations: [
                {
                  id: 't1',
                  type: 'filter',
                  config: {
                    field: 'nonexistent',
                    operator: 'equals',
                    value: 'test',
                  } as FilterConfig,
                  order: 0,
                },
              ],
            },
          ],
          triggers: [],
          executionMode: 'sequential',
        },
      };

      const pipeline = new Pipeline(options);
      pipeline.activate();
      const result = await pipeline.execute([{ data: { value: 1 } }]);
      expect(result.status).toBe('completed');
    });

    it('should track failed executions in metrics', async () => {
      const options: PipelineOptions = {
        definition: {
          name: 'Error Pipeline',
          type: 'etl',
          stages: [
            {
              id: 's1',
              name: 'Stage 1',
              type: 'transform',
              config: {},
              transformations: [],
            },
          ],
          triggers: [],
          executionMode: 'sequential',
        },
      };

      const pipeline = new Pipeline(options);
      pipeline.activate();
      await pipeline.execute([{ data: { value: 1 } }]);

      const metrics = pipeline.getMetrics();
      expect(metrics.totalExecutions).toBe(1);
      expect(metrics.failedExecutions).toBe(0);
    });
  });
});

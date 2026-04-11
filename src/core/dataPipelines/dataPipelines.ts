import * as crypto from 'crypto';
import {
  PipelineDefinition,
  PipelineStage,
  PipelineState,
  PipelineInstance,
  PipelineVersion,
  PipelineEvent,
  EventHandler,
  PipelineMetrics,
  RetryConfig,
  FilterConfig,
  MapConfig,
  ReduceConfig,
  JoinConfig,
  AggregateConfig,
  Transformation,
  TransformationResult,
  StageResult,
  ExecutionContext,
  ExecutionResult,
  PipelineError,
  PipelineProgress,
  ScheduleConfig,
  PipelineOptions,
} from './types';

export const generateId = (prefix: string): string => {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
};

export class RetryHandler {
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    retryConfig: RetryConfig,
    _errorContext: Record<string, unknown>
  ): Promise<T> {
    if (!retryConfig.enabled) {
      return fn();
    }

    const { maxAttempts, delayMs, backoffMultiplier = 1, retryableErrors } = retryConfig.policy;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (retryableErrors && retryableErrors.length > 0) {
          const isRetryable = retryableErrors.some(e =>
            lastError!.message.includes(e) || lastError!.constructor.name === e
          );
          if (!isRetryable) {
            throw lastError;
          }
        }

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

export class TransformationEngine {
  private retryHandler: RetryHandler;

  constructor() {
    this.retryHandler = new RetryHandler();
  }

  async execute(
    transformation: Transformation,
    records: unknown[],
    context: Record<string, unknown>,
    _retryConfig?: RetryConfig
  ): Promise<TransformationResult> {
    const startTime = Date.now();
    const inputRecords = [...records];

    try {
      let outputRecords: unknown[];

      switch (transformation.type) {
        case 'filter':
          outputRecords = this.executeFilter(transformation.config as FilterConfig, inputRecords, context);
          break;
        case 'map':
          outputRecords = this.executeMap(transformation.config as MapConfig, inputRecords, context);
          break;
        case 'reduce':
          outputRecords = this.executeReduce(transformation.config as ReduceConfig, inputRecords, context);
          break;
        case 'join':
          outputRecords = this.executeJoin(transformation.config as JoinConfig, inputRecords, context);
          break;
        case 'aggregate':
          outputRecords = this.executeAggregate(transformation.config as AggregateConfig, inputRecords, context);
          break;
        default:
          throw new Error(`Unknown transformation type: ${transformation.type}`);
      }

      return {
        transformationId: transformation.id,
        success: true,
        inputRecords,
        outputRecords,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        transformationId: transformation.id,
        success: false,
        inputRecords,
        outputRecords: [],
        duration: Date.now() - startTime,
        error: this.normalizeError(error, transformation.id),
      };
    }
  }

  private executeFilter(
    config: FilterConfig,
    records: unknown[],
    _context: Record<string, unknown>
  ): unknown[] {
    return records.filter(record => {
      if (!this.isRecordWithData(record)) return true;
      const value = this.getFieldValue(record.data, config.field);
      return this.evaluateCondition(value, config.operator, config.value);
    });
  }

  private executeMap(
    config: MapConfig,
    records: unknown[],
    _context: Record<string, unknown>
  ): unknown[] {
    return records.map(record => {
      if (!this.isRecordWithData(record)) return record;
      const mapped: Record<string, unknown> = {};
      for (const [targetField, sourceField] of Object.entries(config.fields)) {
        mapped[targetField] = this.getFieldValue(record.data, sourceField);
      }
      if (config.expression) {
        void config.expression;
      }
      return { ...record, data: mapped };
    });
  }

  private executeReduce(
    config: ReduceConfig,
    records: unknown[],
    _context: Record<string, unknown>
  ): unknown[] {
    const groups = new Map<string, unknown[]>();

    for (const record of records) {
      if (!this.isRecordWithData(record)) continue;
      const key = config.groupBy.map(field => this.getFieldValue(record.data, field)).join('|');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    }

    const results: unknown[] = [];
    for (const [key, groupRecords] of groups) {
      const result: Record<string, unknown> = {};
      const keyParts = key.split('|');
      for (let i = 0; i < config.groupBy.length; i++) {
        result[config.groupBy[i]] = keyParts[i];
      }

      for (const agg of config.aggregations) {
        const values = groupRecords
          .filter(r => this.isRecordWithData(r))
          .map(r => this.getFieldValue((r as { data: Record<string, unknown> }).data, agg.field))
          .filter((v): v is number => typeof v === 'number');

        switch (agg.function) {
          case 'sum':
            result[agg.alias] = values.reduce((a, b) => a + b, 0);
            break;
          case 'count':
            result[agg.alias] = values.length;
            break;
          case 'avg':
            result[agg.alias] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            break;
          case 'min':
            result[agg.alias] = Math.min(...values);
            break;
          case 'max':
            result[agg.alias] = Math.max(...values);
            break;
        }
      }
      results.push(result);
    }

    return results;
  }

  private executeJoin(
    config: JoinConfig,
    records: unknown[],
    context: Record<string, unknown>
  ): unknown[] {
    const rightSource = config.rightSource;
    const rightRecords = (context[rightSource] as unknown[]) || [];
    const results: unknown[] = [];

    const leftKey = config.leftKey;
    const rightKey = config.rightKey;

    for (const leftRecord of records) {
      if (!this.isRecordWithData(leftRecord)) continue;

      const leftValue = this.getFieldValue((leftRecord as { data: Record<string, unknown> }).data, leftKey);
      const matchingRight = rightRecords.find(right => {
        if (!this.isRecordWithData(right)) return false;
        const rightValue = this.getFieldValue((right as { data: Record<string, unknown> }).data, rightKey);
        return leftValue === rightValue;
      });

      if (matchingRight && this.isRecordWithData(matchingRight)) {
        results.push({
          ...leftRecord,
          data: {
            ...(leftRecord as { data: Record<string, unknown> }).data,
            ...(matchingRight as { data: Record<string, unknown> }).data,
          },
        });
      } else if (config.joinType === 'left') {
        results.push(leftRecord);
      }
    }

    if (config.joinType === 'right' || config.joinType === 'full') {
      for (const rightRecord of rightRecords) {
        if (!this.isRecordWithData(rightRecord)) continue;
        const rightValue = this.getFieldValue((rightRecord as { data: Record<string, unknown> }).data, rightKey);
        const found = records.some(left => {
          if (!this.isRecordWithData(left)) return false;
          const leftValue = this.getFieldValue((left as { data: Record<string, unknown> }).data, leftKey);
          return leftValue === rightValue;
        });
        if (!found) {
          results.push(rightRecord);
        }
      }
    }

    return results;
  }

  private executeAggregate(
    config: AggregateConfig,
    records: unknown[],
    _context: Record<string, unknown>
  ): unknown[] {
    return this.executeReduce(
      {
        groupBy: config.groupByFields,
        aggregations: config.operations.map(op => ({
          field: op.field,
          function: op.operation,
          alias: op.outputField,
        })),
      },
      records,
      _context
    );
  }

  private isRecordWithData(record: unknown): record is { data: Record<string, unknown> } {
    return typeof record === 'object' && record !== null && 'data' in record;
  }

  private getFieldValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let value: unknown = obj;
    for (const part of parts) {
      if (value && typeof value === 'object' && part in (value as Record<string, unknown>)) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return value;
  }

  private evaluateCondition(value: unknown, operator: string, target: unknown): boolean {
    switch (operator) {
      case 'equals':
        return value === target;
      case 'not_equals':
        return value !== target;
      case 'greater_than':
      case 'gt':
        return typeof value === 'number' && typeof target === 'number' && value > target;
      case 'less_than':
      case 'lt':
        return typeof value === 'number' && typeof target === 'number' && value < target;
      case 'gte':
        return typeof value === 'number' && typeof target === 'number' && value >= target;
      case 'lte':
        return typeof value === 'number' && typeof target === 'number' && value <= target;
      case 'contains':
        return typeof value === 'string' && typeof target === 'string' && value.includes(target);
      default:
        return false;
    }
  }

  private normalizeError(error: unknown, transformationId: string): PipelineError {
    if (error instanceof Error) {
      return {
        code: 'TRANSFORMATION_ERROR',
        message: error.message,
        transformationId,
        stack: error.stack,
        originalError: error,
      };
    }
    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      transformationId,
    };
  }
}

export class PipelineEngine {
  private transformationEngine: TransformationEngine;
  private eventHandlers: Map<string, Set<EventHandler>>;
  private stageMap: Map<string, PipelineStage>;

  constructor() {
    this.transformationEngine = new TransformationEngine();
    this.eventHandlers = new Map();
    this.stageMap = new Map();
  }

  async executeStage(
    stage: PipelineStage,
    context: Record<string, unknown>,
    retryConfig?: RetryConfig
  ): Promise<StageResult> {
    const startTime = Date.now();
    const input: unknown = context['inputData'] || [];
    let records: unknown[] = Array.isArray(input) ? input : [input];

    try {
      for (const transformation of stage.transformations.sort((a, b) => a.order - b.order)) {
        const result = await this.transformationEngine.execute(
          transformation,
          records,
          context,
          retryConfig
        );

        if (!result.success) {
          throw new Error(`Transformation ${transformation.id} failed: ${result.error?.message}`);
        }

        records = result.outputRecords;
      }

      return {
        stageId: stage.id,
        success: true,
        input,
        output: records,
        duration: Date.now() - startTime,
        recordsProcessed: records.length,
      };
    } catch (error) {
      return {
        stageId: stage.id,
        success: false,
        input,
        output: undefined,
        duration: Date.now() - startTime,
        recordsProcessed: 0,
        error: this.normalizeError(error, stage.id),
      };
    }
  }

  async executeParallel(
    stageIds: string[],
    context: Record<string, unknown>,
    retryConfig?: RetryConfig
  ): Promise<Map<string, StageResult>> {
    const results = new Map<string, StageResult>();
    this.buildStageMap(context['stages'] as PipelineStage[] || []);

    const promises = stageIds.map(async stageId => {
      const stage = this.stageMap.get(stageId);
      if (!stage) {
        results.set(stageId, {
          stageId,
          success: false,
          input: undefined,
          output: undefined,
          duration: 0,
          recordsProcessed: 0,
          error: { code: 'STAGE_NOT_FOUND', message: `Stage ${stageId} not found` },
        });
        return;
      }

      const result = await this.executeStage(stage, context, retryConfig);
      results.set(stageId, result);
    });

    await Promise.all(promises);
    return results;
  }

  async executeSequential(
    stageIds: string[],
    context: Record<string, unknown>,
    retryConfig?: RetryConfig
  ): Promise<StageResult[]> {
    const results: StageResult[] = [];
    this.buildStageMap(context['stages'] as PipelineStage[] || []);

    for (const stageId of stageIds) {
      const stage = this.stageMap.get(stageId);
      if (!stage) {
        results.push({
          stageId,
          success: false,
          input: undefined,
          output: undefined,
          duration: 0,
          recordsProcessed: 0,
          error: { code: 'STAGE_NOT_FOUND', message: `Stage ${stageId} not found` },
        });
        continue;
      }

      const result = await this.executeStage(stage, context, retryConfig);
      results.push(result);

      if (!result.success) {
        break;
      }
    }

    return results;
  }

  buildStageMap(stages: PipelineStage[]): Map<string, PipelineStage> {
    this.stageMap.clear();
    for (const stage of stages) {
      this.stageMap.set(stage.id, stage);
    }
    return this.stageMap;
  }

  validatePipeline(definition: PipelineDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!definition.stages || definition.stages.length === 0) {
      errors.push('Pipeline must have at least one stage');
    }

    for (const stage of definition.stages) {
      if (!stage.id || !stage.name) {
        errors.push('Each stage must have an id and name');
      }
      if (!['source', 'transform', 'destination', 'checkpoint'].includes(stage.type)) {
        errors.push(`Stage ${stage.id} has invalid type: ${stage.type}`);
      }
      for (const transformation of stage.transformations) {
        if (!transformation.id || !transformation.type) {
          errors.push(`Transformation in stage ${stage.id} must have id and type`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
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

  async emit(event: PipelineEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      await Promise.all(
        Array.from(handlers).map(handler => handler(event))
      );
    }
  }

  private normalizeError(error: unknown, stageId: string): PipelineError {
    if (error instanceof Error) {
      return {
        code: 'STAGE_ERROR',
        message: error.message,
        stageId,
        stack: error.stack,
        originalError: error,
      };
    }
    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      stageId,
    };
  }
}

export class DataTransformer {
  filter<T>(data: T[], predicate: (item: T) => boolean): T[] {
    return data.filter(predicate);
  }

  map<T, R>(data: T[], mapper: (item: T) => R): R[] {
    return data.map(mapper);
  }

  reduce<T, R>(
    data: T[],
    reducer: (acc: R, item: T) => R,
    initial: R
  ): R {
    return data.reduce(reducer, initial);
  }

  groupBy<T>(data: T[], keyFn: (item: T) => string): Map<string, T[]> {
    const groups = new Map<string, T[]>();
    for (const item of data) {
      const key = keyFn(item);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }
    return groups;
  }

  partition<T>(data: T[], numPartitions: number): T[][] {
    const partitions: T[][] = Array.from({ length: numPartitions }, () => []);
    data.forEach((item, index) => {
      partitions[index % numPartitions].push(item);
    });
    return partitions;
  }
}

export class PipelineScheduler {
  private schedules: Map<string, NodeJS.Timeout>;
  private callbackMap: Map<string, () => void>;

  constructor() {
    this.schedules = new Map();
    this.callbackMap = new Map();
  }

  schedule(
    pipelineId: string,
    config: ScheduleConfig,
    callback: () => void
  ): void {
    this.cancel(pipelineId);

    if (config.intervalMs) {
      const intervalId = setInterval(callback, config.intervalMs);
      this.schedules.set(pipelineId, intervalId);
      this.callbackMap.set(pipelineId, callback);
    }
  }

  cancel(pipelineId: string): void {
    const existing = this.schedules.get(pipelineId);
    if (existing) {
      clearInterval(existing);
      this.schedules.delete(pipelineId);
      this.callbackMap.delete(pipelineId);
    }
  }

  cancelAll(): void {
    for (const intervalId of this.schedules.values()) {
      clearInterval(intervalId);
    }
    this.schedules.clear();
    this.callbackMap.clear();
  }

  isScheduled(pipelineId: string): boolean {
    return this.schedules.has(pipelineId);
  }
}

export class Pipeline {
  private engine: PipelineEngine;
  private definition: PipelineDefinition;
  private instance: PipelineInstance;
  private versions: PipelineVersion[];
  private currentExecution: ExecutionContext | null;
  private metrics: PipelineMetrics;
  private scheduler: PipelineScheduler;

  constructor(options: PipelineOptions) {
    this.engine = new PipelineEngine();
    this.scheduler = new PipelineScheduler();
    this.definition = {
      ...options.definition,
      id: generateId('pl'),
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.instance = {
      id: generateId('pli'),
      pipelineId: this.definition.id,
      version: this.definition.version,
      state: 'draft',
      executions: new Map(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.versions = [];
    this.currentExecution = null;
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      totalRecordsProcessed: 0,
      stageExecutionCounts: {},
      transformationExecutionCounts: {},
    };
  }

  getDefinition(): PipelineDefinition {
    return { ...this.definition };
  }

  getInstance(): PipelineInstance {
    return {
      ...this.instance,
      executions: new Map(this.instance.executions),
    };
  }

  getMetrics(): PipelineMetrics {
    return { ...this.metrics };
  }

  getVersions(): PipelineVersion[] {
    return [...this.versions];
  }

  getCurrentState(): PipelineState {
    return this.instance.state;
  }

  activate(): void {
    if (this.instance.state !== 'draft' && this.instance.state !== 'paused') {
      throw new Error(`Cannot activate pipeline in state: ${this.instance.state}`);
    }
    this.instance.state = 'active';
    this.instance.updatedAt = new Date();
    this.setupTriggers();
    this.engine.emit({
      type: 'pipeline.activated',
      pipelineId: this.definition.id,
      timestamp: new Date(),
      data: { state: this.instance.state },
    });
  }

  pause(): void {
    if (this.instance.state !== 'active') {
      throw new Error(`Cannot pause pipeline in state: ${this.instance.state}`);
    }
    this.instance.state = 'paused';
    this.instance.updatedAt = new Date();
    this.cancelScheduledExecutions();
    this.engine.emit({
      type: 'pipeline.paused',
      pipelineId: this.definition.id,
      timestamp: new Date(),
      data: { state: this.instance.state },
    });
  }

  cancel(): void {
    this.instance.state = 'completed';
    this.instance.updatedAt = new Date();
    this.cancelScheduledExecutions();
    this.engine.emit({
      type: 'pipeline.cancelled',
      pipelineId: this.definition.id,
      timestamp: new Date(),
      data: { state: this.instance.state },
    });
  }

  private setupTriggers(): void {
    for (const trigger of this.definition.triggers) {
      if (trigger.type === 'scheduled' && trigger.enabled) {
        const scheduleConfig = trigger.config as ScheduleConfig;
        if (scheduleConfig.intervalMs) {
          this.scheduler.schedule(this.definition.id, scheduleConfig, () => {
            this.execute().catch(() => {});
          });
        }
      }
    }
  }

  private cancelScheduledExecutions(): void {
    this.scheduler.cancel(this.definition.id);
  }

  async execute(initialData: unknown = {}, initialContext: Record<string, unknown> = {}): Promise<ExecutionResult> {
    if (this.instance.state !== 'active') {
      throw new Error(`Cannot execute pipeline in state: ${this.instance.state}`);
    }

    const executionId = generateId('exec');
    const context: ExecutionContext = {
      pipelineId: this.definition.id,
      executionId,
      stageId: this.definition.stages[0]?.id || '',
      variables: { ...initialContext },
      data: new Map(),
      history: [],
      startedAt: new Date(),
      updatedAt: new Date(),
    };

    context.data.set('inputData', initialData);
    context.data.set('stages', this.definition.stages);

    this.currentExecution = context;
    this.instance.executions.set(executionId, context);
    this.instance.currentExecutionId = executionId;
    this.instance.updatedAt = new Date();
    this.metrics.totalExecutions++;

    await this.engine.emit({
      type: 'execution.started',
      pipelineId: this.definition.id,
      executionId,
      timestamp: new Date(),
      data: { context },
    });

    const progress: PipelineProgress = {
      totalStages: this.definition.stages.length,
      completedStages: 0,
      processedRecords: 0,
      failedRecords: 0,
      percentComplete: 0,
    };

    try {
      this.engine.buildStageMap(this.definition.stages);

      if (this.definition.executionMode === 'parallel') {
        await this.executeParallelMode(context, progress);
      } else if (this.definition.executionMode === 'partitioned') {
        await this.executePartitionedMode(context, progress);
      } else {
        await this.executeSequentialMode(context, progress);
      }

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
        pipelineId: this.definition.id,
        executionId,
        timestamp: completedAt,
        data: { result: context.data, progress },
      });

      await this.engine.emit({
        type: 'pipeline.completed',
        pipelineId: this.definition.id,
        executionId,
        timestamp: completedAt,
        data: { result: context.data, progress },
      });

      return {
        executionId,
        pipelineId: this.definition.id,
        status: 'completed',
        state: this.instance.state,
        context,
        result: context.data,
        completedAt,
        progress,
      };
    } catch (error) {
      this.instance.state = 'failed';
      this.instance.updatedAt = new Date();
      this.metrics.failedExecutions++;

      const pipelineError = this.normalizeError(error);

      await this.engine.emit({
        type: 'pipeline.failed',
        pipelineId: this.definition.id,
        executionId,
        timestamp: new Date(),
        data: { error: pipelineError },
      });

      return {
        executionId,
        pipelineId: this.definition.id,
        status: 'failed',
        state: this.instance.state,
        context,
        error: pipelineError,
        progress,
      };
    } finally {
      this.currentExecution = null;
    }
  }

  private async executeSequentialMode(context: ExecutionContext, progress: PipelineProgress): Promise<void> {
    const retryConfig = this.definition.retryConfig;

    for (const stage of this.definition.stages) {
      progress.currentStage = stage.id;

      await this.engine.emit({
        type: 'stage.started',
        pipelineId: this.definition.id,
        executionId: context.executionId,
        stageId: stage.id,
        timestamp: new Date(),
        data: { progress },
      });

      const result = await this.engine.executeStage(stage, {
        ...context.variables,
        inputData: context.data.get('currentData') || [],
        stages: this.definition.stages,
      }, retryConfig?.enabled ? retryConfig : undefined);

      this.metrics.stageExecutionCounts[stage.id] = (this.metrics.stageExecutionCounts[stage.id] || 0) + 1;
      progress.completedStages++;
      progress.processedRecords += result.recordsProcessed;
      context.data.set('currentData', result.output);

      context.history.push({
        stageId: stage.id,
        timestamp: new Date(),
        input: result.input,
        output: result.output,
        duration: result.duration,
      });

      if (result.success) {
        await this.engine.emit({
          type: 'stage.completed',
          pipelineId: this.definition.id,
          executionId: context.executionId,
          stageId: stage.id,
          timestamp: new Date(),
          data: { result, progress },
        });
      } else {
        await this.engine.emit({
          type: 'stage.failed',
          pipelineId: this.definition.id,
          executionId: context.executionId,
          stageId: stage.id,
          timestamp: new Date(),
          data: { error: result.error, progress },
        });
        throw new Error(`Stage ${stage.id} failed: ${result.error?.message}`);
      }
    }

    progress.percentComplete = 100;
  }

  private async executeParallelMode(context: ExecutionContext, progress: PipelineProgress): Promise<void> {
    const stageIds = this.definition.stages.map(s => s.id);
    const retryConfig = this.definition.retryConfig;

    const results = await this.engine.executeParallel(
      stageIds,
      {
        ...context.variables,
        inputData: context.data.get('inputData') || [],
        stages: this.definition.stages,
      },
      retryConfig?.enabled ? retryConfig : undefined
    );

    let allSuccess = true;
    for (const [stageId, result] of results) {
      this.metrics.stageExecutionCounts[stageId] = (this.metrics.stageExecutionCounts[stageId] || 0) + 1;
      progress.completedStages++;
      progress.processedRecords += result.recordsProcessed;

      context.history.push({
        stageId,
        timestamp: new Date(),
        input: result.input,
        output: result.output,
        duration: result.duration,
      });

      if (!result.success) {
        allSuccess = false;
        await this.engine.emit({
          type: 'stage.failed',
          pipelineId: this.definition.id,
          executionId: context.executionId,
          stageId,
          timestamp: new Date(),
          data: { error: result.error },
        });
      } else {
        await this.engine.emit({
          type: 'stage.completed',
          pipelineId: this.definition.id,
          executionId: context.executionId,
          stageId,
          timestamp: new Date(),
          data: { result },
        });
      }
    }

    if (!allSuccess) {
      throw new Error('One or more parallel stages failed');
    }

    progress.percentComplete = 100;
  }

  private async executePartitionedMode(context: ExecutionContext, progress: PipelineProgress): Promise<void> {
    const transformer = new DataTransformer();
    const inputData = (context.data.get('inputData') || []) as unknown[];
    const partitions = transformer.partition(inputData, 4);

    const partitionResults: unknown[][] = [];
    for (const partition of partitions) {
      context.data.set('currentData', partition);
      await this.executeSequentialMode(context, progress);
      partitionResults.push((context.data.get('currentData') || []) as unknown[]);
    }

    context.data.set('currentData', partitionResults.flat());
    progress.percentComplete = 100;
  }

  updateDefinition(newDefinition: Partial<PipelineDefinition>): void {
    const validation = this.engine.validatePipeline({
      ...this.definition,
      ...newDefinition,
    });
    if (!validation.valid) {
      throw new Error(`Invalid pipeline definition: ${validation.errors.join(', ')}`);
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
    this.versions.push({
      version: this.definition.version,
      definition: this.definition,
      createdAt: new Date(),
      createdBy: 'system',
      changeDescription,
    });
    this.definition.version++;
  }

  rollback(targetVersion?: number): PipelineDefinition {
    const rollbackPoint = this.versions.find(rp =>
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
      type: 'pipeline.activated',
      pipelineId: this.definition.id,
      timestamp: new Date(),
      data: { rolledBackToVersion: rollbackPoint.version },
    });

    return this.getDefinition();
  }

  on(eventType: string, handler: EventHandler): void {
    this.engine.on(eventType, handler);
  }

  off(eventType: string, handler: EventHandler): void {
    this.engine.off(eventType, handler);
  }

  private normalizeError(error: unknown): PipelineError {
    if (error instanceof Error) {
      return {
        code: 'PIPELINE_ERROR',
        message: error.message,
        stack: error.stack,
        originalError: error,
      };
    }
    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
    };
  }
}

export class PipelineManager {
  private pipelines: Map<string, Pipeline>;

  constructor() {
    this.pipelines = new Map();
  }

  createPipeline(options: PipelineOptions): Pipeline {
    const pipeline = new Pipeline(options);
    this.pipelines.set(pipeline.getDefinition().id, pipeline);

    const plDef = pipeline.getDefinition();
    this.emitGlobalEvent({
      type: 'pipeline.created',
      pipelineId: plDef.id,
      timestamp: new Date(),
      data: { definition: plDef },
    });

    return pipeline;
  }

  getPipeline(id: string): Pipeline | undefined {
    return this.pipelines.get(id);
  }

  getAllPipelines(): Pipeline[] {
    return Array.from(this.pipelines.values());
  }

  deletePipeline(id: string): boolean {
    return this.pipelines.delete(id);
  }

  private async emitGlobalEvent(_event: PipelineEvent): Promise<void> {
  }
}

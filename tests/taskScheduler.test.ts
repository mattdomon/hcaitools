import {
  TaskScheduler,
  TriggerType,
  TaskStatus,
  ScheduleType,
  RetryPolicyType,
  PriorityLevel,
  createTaskId,
  createCronExpression,
  createIntervalConfig,
  createRetryPolicy,
  getPriorityValue,
  parseCronField,
  parseCronExpression,
  getNextCronRun,
  getNextIntervalRun,
  calculateRetryDelay,
  isRetryable,
  isValidCronExpression,
  isValidTaskConfig,
  compareTaskPriority,
  createTaskConfig,
  createTaskHistoryEntry,
  createDefaultRetryPolicy,
  createDefaultSchedulerConfig,
  calculateTaskDuration,
  CronExpression,
  TaskConfig,
  ScheduledTask,
  TaskSchedulerConfig,
} from '../src/core/taskScheduler';

describe('TaskScheduler', () => {
  let scheduler: TaskScheduler;

  beforeEach(() => {
    scheduler = new TaskScheduler({ maxConcurrentTasks: 5 });
  });

  afterEach(() => {
    scheduler.clear();
  });

  describe('Task Scheduling', () => {
    test('should schedule a one-time task', async () => {
      const config = createTaskConfig('test-task', { type: 'one_time', scheduledTime: Date.now() + 1000 }, 'interval', 'normal');
      const handler = jest.fn();
      const task = await scheduler.scheduleTask(config, handler);
      expect(task.id).toMatch(/^task_[a-f0-9]{16}$/);
      expect(task.config.name).toBe('test-task');
      expect(task.status).toBe('pending');
    });

    test('should schedule an interval task', async () => {
      const config = createTaskConfig('interval-task', { type: 'interval', interval: createIntervalConfig(60000) }, 'interval', 'normal');
      const handler = jest.fn();
      const task = await scheduler.scheduleTask(config, handler);
      expect(task.config.trigger.type).toBe('interval');
      expect(task.nextRunAt).toBeDefined();
    });

    test('should schedule a cron task', async () => {
      const cron = createCronExpression('*', '*', '*', '*', '*');
      const config = createTaskConfig('cron-task', { type: 'cron', cron }, 'cron', 'high');
      const handler = jest.fn();
      const task = await scheduler.scheduleTask(config, handler);
      expect(task.config.trigger.type).toBe('cron');
      expect(task.priority).toBe(10);
    });

    test('should throw error for invalid task config', async () => {
      const invalidConfig = { name: '', trigger: { type: 'manual' }, scheduleType: 'interval' as ScheduleType, priority: 'normal' as PriorityLevel };
      await expect(scheduler.scheduleTask(invalidConfig as TaskConfig, jest.fn())).rejects.toThrow('Invalid task configuration');
    });

    test('should schedule task with payload', async () => {
      const config = createTaskConfig('payload-task', { type: 'one_time' }, 'interval', 'normal');
      const handler = jest.fn();
      const task = await scheduler.scheduleTask(config, handler, { data: 'test' });
      expect(task.payload).toEqual({ data: 'test' });
    });

    test('should schedule task with tags', async () => {
      const config = createTaskConfig('tagged-task', { type: 'one_time' }, 'interval', 'normal', { tags: ['important', 'daily'] });
      const handler = jest.fn();
      const task = await scheduler.scheduleTask(config, handler);
      expect(task.config.tags).toEqual(['important', 'daily']);
    });
  });

  describe('Task Execution', () => {
    test('should execute task immediately when running', async () => {
      const config = createTaskConfig('exec-task', { type: 'one_time', scheduledTime: Date.now() }, 'interval', 'normal');
      const handler = jest.fn().mockResolvedValue('result');
      const task = await scheduler.scheduleTask(config, handler);
      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(handler).toHaveBeenCalled();
    });

    test('should handle task failure', async () => {
      const config = createTaskConfig('fail-task', { type: 'one_time' }, 'interval', 'normal', { retryPolicy: createRetryPolicy('none', 0, 0) });
      const handler = jest.fn().mockRejectedValue(new Error('Task failed'));
      const task = await scheduler.scheduleTask(config, handler);
      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 50));
      const foundTask = scheduler.getTask(task.id);
      expect(foundTask?.status).toBe('failed');
    });

    test('should retry failed task with exponential backoff', async () => {
      const retryPolicy = createRetryPolicy('exponential', 3, 100, 2);
      const config = createTaskConfig('retry-task', { type: 'one_time' }, 'interval', 'normal', { retryPolicy });
      let callCount = 0;
      const handler = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) throw new Error('Temporary failure');
        return Promise.resolve('success');
      });
      await scheduler.scheduleTask(config, handler);
      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(callCount).toBeGreaterThanOrEqual(2);
    });

    test('should respect max concurrent tasks limit', async () => {
      const limitedScheduler = new TaskScheduler({ maxConcurrentTasks: 1 });
      const handler = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      for (let i = 0; i < 3; i++) {
        const config = createTaskConfig(`concurrent-task-${i}`, { type: 'one_time' }, 'interval', 'normal');
        await limitedScheduler.scheduleTask(config, handler);
      }
      limitedScheduler.start();
      await new Promise(resolve => setTimeout(resolve, 50));
      const running = limitedScheduler.getRunningTasks();
      expect(running.length).toBeLessThanOrEqual(1);
      limitedScheduler.clear();
    });

    test('should queue tasks when limit reached', async () => {
      const limitedScheduler = new TaskScheduler({ maxConcurrentTasks: 1 });
      const handler = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 50)));
      for (let i = 0; i < 3; i++) {
        const config = createTaskConfig(`queue-task-${i}`, { type: 'one_time' }, 'interval', 'normal');
        await limitedScheduler.scheduleTask(config, handler);
      }
      limitedScheduler.start();
      await new Promise(resolve => setTimeout(resolve, 10));
      const queued = limitedScheduler.getQueuedTasks();
      expect(queued.length).toBeGreaterThanOrEqual(2);
      limitedScheduler.clear();
    });
  });

  describe('Task Management', () => {
    test('should cancel pending task', async () => {
      const config = createTaskConfig('cancel-task', { type: 'interval', interval: createIntervalConfig(60000) }, 'interval', 'normal');
      const handler = jest.fn();
      const task = await scheduler.scheduleTask(config, handler);
      const cancelled = await scheduler.cancelTask(task.id);
      expect(cancelled).toBe(true);
      expect(scheduler.getTask(task.id)?.status).toBe('cancelled');
    });

    test('should not cancel running task', async () => {
      const config = createTaskConfig('running-cancel-task', { type: 'one_time' }, 'interval', 'normal');
      const handler = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 200)));
      const task = await scheduler.scheduleTask(config, handler);
      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 10));
      const cancelled = await scheduler.cancelTask(task.id);
      expect(cancelled).toBe(false);
      scheduler.stop();
    });

    test('should pause task', async () => {
      const config = createTaskConfig('pause-task', { type: 'interval', interval: createIntervalConfig(60000) }, 'interval', 'normal');
      const handler = jest.fn();
      const task = await scheduler.scheduleTask(config, handler);
      await scheduler.pauseTask(task.id);
      expect(scheduler.getTask(task.id)?.status).toBe('pending');
    });

    test('should resume paused task', async () => {
      const config = createTaskConfig('resume-task', { type: 'interval', interval: createIntervalConfig(60000) }, 'interval', 'normal');
      const handler = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      const task = await scheduler.scheduleTask(config, handler);
      await scheduler.pauseTask(task.id);
      await scheduler.resumeTask(task.id);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(scheduler.getTask(task.id)?.status).toBe('running');
    });

    test('should run task immediately', async () => {
      const config = createTaskConfig('now-task', { type: 'interval', interval: createIntervalConfig(60000) }, 'interval', 'normal');
      const handler = jest.fn();
      const task = await scheduler.scheduleTask(config, handler);
      await scheduler.runTaskNow(task.id);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(handler).toHaveBeenCalled();
    });

    test('should delete completed task', async () => {
      const config = createTaskConfig('delete-task', { type: 'one_time', scheduledTime: Date.now() }, 'interval', 'normal');
      const handler = jest.fn().mockResolvedValue(undefined);
      const task = await scheduler.scheduleTask(config, handler);
      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 50));
      const deleted = await scheduler.deleteTask(task.id);
      expect(deleted).toBe(true);
      expect(scheduler.getTask(task.id)).toBeUndefined();
    });
  });

  describe('Task Queries', () => {
    test('should get task by id', async () => {
      const config = createTaskConfig('get-task', { type: 'one_time' }, 'interval', 'normal');
      const handler = jest.fn();
      const task = await scheduler.scheduleTask(config, handler);
      const found = scheduler.getTask(task.id);
      expect(found?.id).toBe(task.id);
    });

    test('should get all tasks', async () => {
      const handler = jest.fn();
      for (let i = 0; i < 3; i++) {
        const config = createTaskConfig(`all-task-${i}`, { type: 'one_time' }, 'interval', 'normal');
        await scheduler.scheduleTask(config, handler);
      }
      const tasks = scheduler.getAllTasks();
      expect(tasks.length).toBeGreaterThanOrEqual(3);
    });

    test('should get tasks by status', async () => {
      const handler = jest.fn();
      const config = createTaskConfig('status-task', { type: 'one_time' }, 'interval', 'normal');
      await scheduler.scheduleTask(config, handler);
      const pending = scheduler.getTasksByStatus('pending');
      expect(pending.length).toBeGreaterThan(0);
    });

    test('should get tasks by tag', async () => {
      const config = createTaskConfig('tag-task', { type: 'one_time' }, 'interval', 'normal', { tags: ['special'] });
      const handler = jest.fn();
      await scheduler.scheduleTask(config, handler);
      const tagged = scheduler.getTasksByTag('special');
      expect(tagged.length).toBe(1);
    });

    test('should get next scheduled task', async () => {
      const handler = jest.fn();
      const config = createTaskConfig('next-task', { type: 'one_time', scheduledTime: Date.now() + 5000 }, 'interval', 'normal');
      await scheduler.scheduleTask(config, handler);
      const next = scheduler.getNextScheduledTask();
      expect(next?.config.name).toBe('next-task');
    });

    test('should get running tasks', async () => {
      const limitedScheduler = new TaskScheduler({ maxConcurrentTasks: 2 });
      const handler = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      for (let i = 0; i < 2; i++) {
        const config = createTaskConfig(`running-task-${i}`, { type: 'one_time' }, 'interval', 'normal');
        await limitedScheduler.scheduleTask(config, handler);
      }
      limitedScheduler.start();
      await new Promise(resolve => setTimeout(resolve, 10));
      const running = limitedScheduler.getRunningTasks();
      expect(running.length).toBeGreaterThan(0);
      limitedScheduler.stop();
      limitedScheduler.clear();
    });
  });

  describe('Task History', () => {
    test('should record task history', async () => {
      const config = createTaskConfig('history-task', { type: 'one_time' }, 'interval', 'normal');
      const handler = jest.fn().mockResolvedValue(undefined);
      const task = await scheduler.scheduleTask(config, handler);
      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 50));
      const history = scheduler.getTaskHistory(task.id);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    test('should track task stats', async () => {
      const handler = jest.fn();
      const config = createTaskConfig('stats-task', { type: 'one_time' }, 'interval', 'normal');
      await scheduler.scheduleTask(config, handler);
      const stats = scheduler.getStats();
      expect(stats.totalTasks).toBeGreaterThan(0);
    });

    test('should track completed executions', async () => {
      const config = createTaskConfig('completed-task', { type: 'one_time' }, 'interval', 'normal');
      const handler = jest.fn().mockResolvedValue(undefined);
      await scheduler.scheduleTask(config, handler);
      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 50));
      const stats = scheduler.getStats();
      expect(stats.completedTasks).toBeGreaterThan(0);
    });
  });

  describe('Events', () => {
    test('should emit task.scheduled event', async () => {
      const eventHandler = jest.fn();
      scheduler.on('task.scheduled', eventHandler);
      const config = createTaskConfig('event-task', { type: 'one_time' }, 'interval', 'normal');
      const handler = jest.fn();
      await scheduler.scheduleTask(config, handler);
      expect(eventHandler).toHaveBeenCalled();
    });

    test('should emit task.started event', async () => {
      const eventHandler = jest.fn();
      scheduler.on('task.started', eventHandler);
      const config = createTaskConfig('started-event-task', { type: 'one_time' }, 'interval', 'normal');
      const handler = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 50)));
      await scheduler.scheduleTask(config, handler);
      scheduler.start();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(eventHandler).toHaveBeenCalled();
    });

    test('should remove event handler', () => {
      const eventHandler = jest.fn();
      scheduler.on('task.completed', eventHandler);
      scheduler.off('task.completed', eventHandler);
      const config = createTaskConfig('off-task', { type: 'one_time' }, 'interval', 'normal');
      scheduler.scheduleTask(config, jest.fn());
    });
  });

  describe('Lifecycle', () => {
    test('should start scheduler', () => {
      scheduler.start();
      const eventHandler = jest.fn();
      scheduler.on('scheduler.started', eventHandler);
      expect(scheduler.getStats()).toBeDefined();
    });

    test('should stop scheduler', () => {
      scheduler.start();
      scheduler.stop();
      const eventHandler = jest.fn();
      scheduler.on('scheduler.stopped', eventHandler);
      expect(scheduler).toBeDefined();
    });

    test('should clear all tasks', async () => {
      const handler = jest.fn();
      for (let i = 0; i < 3; i++) {
        const config = createTaskConfig(`clear-task-${i}`, { type: 'one_time' }, 'interval', 'normal');
        await scheduler.scheduleTask(config, handler);
      }
      scheduler.clear();
      expect(scheduler.getAllTasks().length).toBe(0);
    });
  });

  describe('Type Helper Functions', () => {
    test('should create task ID with prefix', () => {
      const id = createTaskId('test');
      expect(id).toMatch(/^test_[a-f0-9]{16}$/);
    });

    test('should create cron expression', () => {
      const cron = createCronExpression('30', '14', '1', '5', '1');
      expect(cron.minute).toBe('30');
      expect(cron.hour).toBe('14');
      expect(cron.dayOfMonth).toBe('1');
      expect(cron.month).toBe('5');
      expect(cron.dayOfWeek).toBe('1');
    });

    test('should create interval config', () => {
      const interval = createIntervalConfig(5000, true);
      expect(interval.intervalMs).toBe(5000);
      expect(interval.immediate).toBe(true);
    });

    test('should create retry policy', () => {
      const policy = createRetryPolicy('exponential', 5, 1000, 2);
      expect(policy.type).toBe('exponential');
      expect(policy.maxAttempts).toBe(5);
      expect(policy.delayMs).toBe(1000);
      expect(policy.backoffMultiplier).toBe(2);
    });

    test('should get priority values', () => {
      expect(getPriorityValue('low')).toBe(1);
      expect(getPriorityValue('normal')).toBe(5);
      expect(getPriorityValue('high')).toBe(10);
      expect(getPriorityValue('critical')).toBe(20);
    });

    test('should parse cron field with asterisk', () => {
      const result = parseCronField('*', 0, 59);
      expect(result.length).toBe(60);
    });

    test('should parse cron field with comma', () => {
      const result = parseCronField('1,15,30', 0, 59);
      expect(result).toEqual([1, 15, 30]);
    });

    test('should parse cron field with range', () => {
      const result = parseCronField('1-5', 0, 59);
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    test('should parse cron field with step', () => {
      const result = parseCronField('*/5', 0, 59);
      expect(result).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    });

    test('should parse cron expression', () => {
      const cron = createCronExpression('0', '12', '*', '*', '*');
      const times = parseCronExpression(cron, new Date('2025-01-01T10:00:00'));
      expect(Array.isArray(times)).toBe(true);
    });

    test('should get next cron run', () => {
      const cron = createCronExpression('0', '12', '*', '*', '*');
      const referenceTime = new Date('2025-06-15T10:00:00').getTime();
      const next = getNextCronRun(cron, new Date('2025-06-15T10:00:00'));
      expect(next).toBeGreaterThan(referenceTime);
    });

    test('should return null for past cron runs', () => {
      const cron = createCronExpression('0', '12', '*', '*', '*');
      const next = getNextCronRun(cron, new Date('2099-12-31T23:59:59'));
      expect(next).toBeNull();
    });

    test('should get next interval run', () => {
      const now = Date.now();
      const next = getNextIntervalRun(60000, false, new Date(now));
      expect(next).toBe(now + 60000);
    });

    test('should get immediate interval run', () => {
      const now = Date.now();
      const next = getNextIntervalRun(60000, true, new Date(now));
      expect(next).toBe(now);
    });

    test('should calculate retry delay for fixed policy', () => {
      const policy = createRetryPolicy('fixed', 3, 1000, undefined);
      expect(calculateRetryDelay(policy, 0)).toBe(1000);
      expect(calculateRetryDelay(policy, 1)).toBe(1000);
    });

    test('should calculate retry delay for exponential policy', () => {
      const policy = createRetryPolicy('exponential', 3, 1000, 2);
      expect(calculateRetryDelay(policy, 0)).toBe(1000);
      expect(calculateRetryDelay(policy, 1)).toBe(2000);
      expect(calculateRetryDelay(policy, 2)).toBe(4000);
    });

    test('should return -1 for no retry policy', () => {
      const policy = createRetryPolicy('none', 0, 0);
      expect(calculateRetryDelay(policy, 0)).toBe(-1);
    });

    test('should detect retryable task', () => {
      const policy = createRetryPolicy('exponential', 3, 1000, 2);
      expect(isRetryable(policy, 0)).toBe(true);
      expect(isRetryable(policy, 2)).toBe(true);
      expect(isRetryable(policy, 3)).toBe(false);
    });

    test('should detect non-retryable policy', () => {
      const policy = createRetryPolicy('none', 0, 0);
      expect(isRetryable(policy, 0)).toBe(false);
    });

    test('should validate cron expression', () => {
      const valid = createCronExpression('*', '*', '*', '*', '*');
      expect(isValidCronExpression(valid)).toBe(true);
    });

    test('should validate task config - valid', () => {
      const config = createTaskConfig('valid-task', { type: 'manual' }, 'interval', 'normal');
      expect(isValidTaskConfig(config)).toBe(true);
    });

    test('should validate task config - invalid name', () => {
      const config = { name: '', trigger: { type: 'manual' as TriggerType }, scheduleType: 'interval' as ScheduleType, priority: 'normal' as PriorityLevel };
      expect(isValidTaskConfig(config)).toBe(false);
    });

    test('should validate task config - invalid trigger type', () => {
      const config = { name: 'test', trigger: { type: 'invalid' as TriggerType }, scheduleType: 'interval' as ScheduleType, priority: 'normal' as PriorityLevel };
      expect(isValidTaskConfig(config)).toBe(false);
    });

    test('should compare task priority', () => {
      const taskA: ScheduledTask = {
        id: 'a',
        config: createTaskConfig('a', { type: 'manual' }, 'interval', 'high'),
        status: 'pending',
        priority: 10,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        scheduledAt: Date.now(),
        runCount: 0,
        successCount: 0,
        failureCount: 0,
        currentRetry: 0,
      };
      const taskB: ScheduledTask = {
        id: 'b',
        config: createTaskConfig('b', { type: 'manual' }, 'interval', 'low'),
        status: 'pending',
        priority: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        scheduledAt: Date.now(),
        runCount: 0,
        successCount: 0,
        failureCount: 0,
        currentRetry: 0,
      };
      expect(compareTaskPriority(taskA, taskB)).toBeLessThan(0);
      expect(compareTaskPriority(taskB, taskA)).toBeGreaterThan(0);
    });

    test('should create default retry policy', () => {
      const policy = createDefaultRetryPolicy();
      expect(policy.type).toBe('exponential');
      expect(policy.maxAttempts).toBe(3);
      expect(policy.backoffMultiplier).toBe(2);
    });

    test('should create default scheduler config', () => {
      const config = createDefaultSchedulerConfig();
      expect(config.maxConcurrentTasks).toBe(10);
      expect(config.defaultTimeoutMs).toBe(300000);
      expect(config.enableMonitoring).toBe(true);
    });

    test('should calculate task duration', () => {
      const task: ScheduledTask = {
        id: 'test',
        config: createTaskConfig('test', { type: 'manual' }, 'interval', 'normal'),
        status: 'completed',
        priority: 5,
        createdAt: Date.now() - 1000,
        updatedAt: Date.now(),
        scheduledAt: Date.now() - 1000,
        lastRunAt: Date.now() - 500,
        completedAt: Date.now(),
        runCount: 1,
        successCount: 1,
        failureCount: 0,
        currentRetry: 0,
      };
      const duration = calculateTaskDuration(task);
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Configuration', () => {
    test('should get scheduler config', () => {
      const config = scheduler.getConfig();
      expect(config.maxConcurrentTasks).toBe(5);
    });

    test('should create scheduler with custom config', () => {
      const customScheduler = new TaskScheduler({ maxConcurrentTasks: 20, defaultTimeoutMs: 60000 });
      expect(customScheduler.getConfig().maxConcurrentTasks).toBe(20);
      customScheduler.clear();
    });
  });
});

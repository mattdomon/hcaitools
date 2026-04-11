import {
  TaskConfig,
  ScheduledTask,
  TaskHistoryEntry,
  TaskStats,
  TaskHandler,
  TaskSchedulerConfig,
  SchedulerEvent,
  SchedulerEventType,
  EventHandler,
  TaskStatus,
  Trigger,
  createTaskId,
  getPriorityValue,
  getNextCronRun,
  getNextIntervalRun,
  calculateRetryDelay,
  isRetryable,
  isValidTaskConfig,
  compareTaskPriority,
  createTaskHistoryEntry,
  createDefaultRetryPolicy,
  createDefaultSchedulerConfig,
  calculateTaskDuration,
} from './types';

export class TaskScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private taskQueue: string[] = [];
  private runningTasks: Set<string> = new Set();
  private history: Map<string, TaskHistoryEntry[]> = new Map();
  private handlers: Map<string, TaskHandler> = new Map();
  private eventHandlers: Map<SchedulerEventType, Set<EventHandler>> = new Map();
  private config: TaskSchedulerConfig;
  private intervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private timeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private isRunning: boolean = false;
  private stats: TaskStats = {
    totalTasks: 0,
    pendingTasks: 0,
    runningTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    cancelledTasks: 0,
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    averageExecutionTime: 0,
  };

  constructor(config?: Partial<TaskSchedulerConfig>) {
    this.config = { ...createDefaultSchedulerConfig(), ...config };
  }

  async scheduleTask<T>(config: TaskConfig, handler: TaskHandler<T>, payload?: T): Promise<ScheduledTask<T>> {
    if (!isValidTaskConfig(config)) {
      throw new Error('Invalid task configuration');
    }

    const scheduledAt = this.calculateScheduledTime(config.trigger, config.scheduleType);

    const task: ScheduledTask<T> = {
      id: createTaskId('task'),
      config,
      status: 'pending',
      priority: getPriorityValue(config.priority),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      scheduledAt,
      nextRunAt: scheduledAt,
      runCount: 0,
      successCount: 0,
      failureCount: 0,
      currentRetry: 0,
      payload,
    };

    this.tasks.set(task.id, task as ScheduledTask);
    this.handlers.set(task.id, handler as TaskHandler);
    this.updateStats();
    this.emit({ type: 'task.scheduled', taskId: task.id, timestamp: Date.now() });

    if (this.isRunning) {
      this.scheduleTaskExecution(task.id);
    }

    return task;
  }

  private calculateScheduledTime(trigger: Trigger, _scheduleType: string): number {
    const now = Date.now();

    switch (trigger.type) {
      case 'one_time':
        return trigger.scheduledTime || now;
      case 'interval':
        return getNextIntervalRun(
          trigger.interval?.intervalMs || 60000,
          trigger.interval?.immediate || false
        );
      case 'cron':
        if (trigger.cron) {
          const nextRun = getNextCronRun(trigger.cron);
          return nextRun || now;
        }
        return now;
      case 'manual':
      default:
        return now;
    }
  }

  private scheduleTaskExecution(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const delay = task.nextRunAt ? task.nextRunAt - Date.now() : 0;

    if (delay <= 0) {
      this.executeTask(taskId);
      return;
    }

    const timeout = setTimeout(() => {
      this.executeTask(taskId);
    }, delay);

    this.timeouts.set(taskId, timeout);
  }

  private async executeTask<T>(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId) as ScheduledTask<T> | undefined;
    if (!task) return;

    if (task.status === 'cancelled' || task.status === 'completed') {
      return;
    }

    if (this.runningTasks.size >= this.config.maxConcurrentTasks) {
      this.taskQueue.push(taskId);
      this.sortTaskQueue();
      return;
    }

    this.runningTasks.add(taskId);
    task.status = 'running';
    task.lastRunAt = Date.now();
    task.updatedAt = Date.now();
    task.runCount++;
    this.updateStats();

    this.emit({ type: 'task.started', taskId, timestamp: Date.now() });

    const handler = this.handlers.get(taskId);

    try {
      let result: unknown;
      const timeoutMs = task.config.timeoutMs || this.config.defaultTimeoutMs;

      if (handler) {
        const handlerPromise = handler(task);
        const timeoutPromise = new Promise<unknown>((_, reject) => {
          setTimeout(() => reject(new Error('Task timeout')), timeoutMs);
        });

        result = await Promise.race([handlerPromise, timeoutPromise]);
      }

      task.status = 'completed';
      task.completedAt = Date.now();
      task.successCount++;
      task.error = undefined;
      this.stats.successfulExecutions++;

      this.addHistoryEntry(taskId, createTaskHistoryEntry(taskId, 'completed', {
        completedAt: task.completedAt,
        duration: calculateTaskDuration(task),
        result,
      }));

      this.emit({ type: 'task.completed', taskId, timestamp: Date.now(), data: { result } });

      this.scheduleNextRun(task);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      task.error = errorMessage;
      task.failureCount++;

      this.emit({ type: 'task.failed', taskId, timestamp: Date.now(), data: { error: errorMessage } });

      const retryPolicy = task.config.retryPolicy || createDefaultRetryPolicy();

      if (isRetryable(retryPolicy, task.currentRetry)) {
        task.currentRetry++;
        const delay = calculateRetryDelay(retryPolicy, task.currentRetry);
        task.nextRunAt = Date.now() + delay;
        task.status = 'pending';

        this.emit({ type: 'task.retried', taskId, timestamp: Date.now(), data: { retry: task.currentRetry, delay } });

        const timeout = setTimeout(() => {
          this.executeTask(taskId);
        }, delay);
        this.timeouts.set(taskId, timeout);
      } else {
        task.status = 'failed';
        task.failedAt = Date.now();
        this.stats.failedExecutions++;

        this.addHistoryEntry(taskId, createTaskHistoryEntry(taskId, 'failed', {
          completedAt: task.failedAt,
          duration: calculateTaskDuration(task),
          error: errorMessage,
        }));

        this.scheduleNextRun(task);
      }
    }

    task.updatedAt = Date.now();
    this.runningTasks.delete(taskId);
    this.updateStats();
    this.processQueue();
  }

  private scheduleNextRun(task: ScheduledTask): void {
    if (task.config.trigger.type === 'one_time') {
      return;
    }

    if (task.config.trigger.type === 'interval' && task.config.trigger.interval) {
      task.nextRunAt = getNextIntervalRun(task.config.trigger.interval.intervalMs, false);
      this.scheduleTaskExecution(task.id);
    } else if (task.config.trigger.type === 'cron' && task.config.trigger.cron) {
      const nextRun = getNextCronRun(task.config.trigger.cron);
      if (nextRun) {
        task.nextRunAt = nextRun;
        this.scheduleTaskExecution(task.id);
      }
    }
  }

  private sortTaskQueue(): void {
    this.taskQueue.sort((a, b) => {
      const taskA = this.tasks.get(a);
      const taskB = this.tasks.get(b);
      if (!taskA || !taskB) return 0;
      return compareTaskPriority(taskA, taskB);
    });
  }

  private processQueue(): void {
    while (
      this.taskQueue.length > 0 &&
      this.runningTasks.size < this.config.maxConcurrentTasks
    ) {
      const taskId = this.taskQueue.shift();
      if (taskId) {
        const task = this.tasks.get(taskId);
        if (task && task.status === 'pending') {
          this.executeTask(taskId);
        }
      }
    }
  }

  private addHistoryEntry(taskId: string, entry: TaskHistoryEntry): void {
    if (!this.history.has(taskId)) {
      this.history.set(taskId, []);
    }
    this.history.get(taskId)!.push(entry);
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === 'running') {
      return false;
    }

    const timeout = this.timeouts.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(taskId);
    }

    const interval = this.intervals.get(taskId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(taskId);
    }

    task.status = 'cancelled';
    task.updatedAt = Date.now();
    this.stats.cancelledTasks++;
    this.updateStats();

    const queueIndex = this.taskQueue.indexOf(taskId);
    if (queueIndex > -1) {
      this.taskQueue.splice(queueIndex, 1);
    }

    this.emit({ type: 'task.cancelled', taskId, timestamp: Date.now() });

    return true;
  }

  async pauseTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status !== 'pending' && task.status !== 'running') {
      return false;
    }

    const timeout = this.timeouts.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(taskId);
    }

    task.status = 'pending';
    task.updatedAt = Date.now();
    this.updateStats();

    return true;
  }

  async resumeTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status !== 'pending') {
      return false;
    }

    task.nextRunAt = Date.now();
    this.scheduleTaskExecution(taskId);

    return true;
  }

  async runTaskNow<T>(taskId: string, payload?: T): Promise<boolean> {
    const task = this.tasks.get(taskId) as ScheduledTask<T> | undefined;
    if (!task) return false;

    if (task.status === 'running') {
      return false;
    }

    if (payload !== undefined) {
      task.payload = payload;
    }

    task.status = 'pending';
    task.nextRunAt = Date.now();
    task.updatedAt = Date.now();

    this.executeTask(taskId);

    return true;
  }

  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  getTasksByStatus(status: TaskStatus): ScheduledTask[] {
    const tasks: ScheduledTask[] = [];
    for (const task of this.tasks.values()) {
      if (task.status === status) {
        tasks.push(task);
      }
    }
    return tasks;
  }

  getTasksByTag(tag: string): ScheduledTask[] {
    const tasks: ScheduledTask[] = [];
    for (const task of this.tasks.values()) {
      if (task.config.tags?.includes(tag)) {
        tasks.push(task);
      }
    }
    return tasks;
  }

  getTaskHistory(taskId: string): TaskHistoryEntry[] {
    return this.history.get(taskId) || [];
  }

  getStats(): TaskStats {
    return { ...this.stats };
  }

  getConfig(): TaskSchedulerConfig {
    return { ...this.config };
  }

  on(event: SchedulerEventType, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: SchedulerEventType, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: SchedulerEvent): void {
    if (!this.config.enableMonitoring) return;

    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch {
        }
      }
    }
  }

  private updateStats(): void {
    let totalDuration = 0;
    let completedCount = 0;

    for (const task of this.tasks.values()) {
      if (task.status === 'pending') this.stats.pendingTasks++;
      if (task.status === 'running') this.stats.runningTasks++;
      if (task.status === 'completed') {
        this.stats.completedTasks++;
        completedCount++;
        totalDuration += calculateTaskDuration(task);
      }
      if (task.status === 'failed') this.stats.failedTasks++;
      if (task.status === 'cancelled') this.stats.cancelledTasks++;
    }

    this.stats.totalTasks = this.tasks.size;
    this.stats.runningTasks = this.runningTasks.size;
    this.stats.totalExecutions = this.stats.successfulExecutions + this.stats.failedExecutions;

    if (completedCount > 0) {
      this.stats.averageExecutionTime = totalDuration / completedCount;
    }
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.emit({ type: 'scheduler.started', taskId: '', timestamp: Date.now() });

    for (const task of this.tasks.values()) {
      if (task.status === 'pending' && task.nextRunAt) {
        this.scheduleTaskExecution(task.id);
      }
    }
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.emit({ type: 'scheduler.stopped', taskId: '', timestamp: Date.now() });

    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }

    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }

    this.timeouts.clear();
    this.intervals.clear();
  }

  async deleteTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === 'running') return false;

    await this.cancelTask(taskId);
    this.tasks.delete(taskId);
    this.handlers.delete(taskId);
    this.history.delete(taskId);

    const queueIndex = this.taskQueue.indexOf(taskId);
    if (queueIndex > -1) {
      this.taskQueue.splice(queueIndex, 1);
    }

    this.updateStats();

    return true;
  }

  clear(): void {
    this.stop();
    this.tasks.clear();
    this.taskQueue = [];
    this.runningTasks.clear();
    this.history.clear();
    this.handlers.clear();
    this.stats = {
      totalTasks: 0,
      pendingTasks: 0,
      runningTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      cancelledTasks: 0,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
    };
  }

  cleanup(): void {
    const cutoff = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;

    for (const [taskId, entries] of this.history.entries()) {
      const filteredEntries = entries.filter(entry => entry.runAt >= cutoff);
      if (filteredEntries.length === 0) {
        this.history.delete(taskId);
      } else {
        this.history.set(taskId, filteredEntries);
      }
    }

    for (const task of this.tasks.values()) {
      if (task.config.trigger.type === 'one_time' &&
          (task.status === 'completed' || task.status === 'failed')) {
        if (task.completedAt && task.completedAt < cutoff) {
          this.tasks.delete(task.id);
        }
      }
    }

    this.updateStats();
  }

  async updateTaskConfig(taskId: string, config: Partial<TaskConfig>): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === 'running') return false;

    const newConfig = { ...task.config, ...config };
    if (!isValidTaskConfig(newConfig)) return false;

    task.config = newConfig;
    task.priority = getPriorityValue(newConfig.priority);
    task.updatedAt = Date.now();

    this.sortTaskQueue();

    return true;
  }

  getNextScheduledTask(): ScheduledTask | undefined {
    let nextTask: ScheduledTask | undefined;
    let nextTime = Infinity;

    for (const task of this.tasks.values()) {
      if (task.status === 'pending' && task.nextRunAt && task.nextRunAt < nextTime) {
        nextTime = task.nextRunAt;
        nextTask = task;
      }
    }

    return nextTask;
  }

  getRunningTasks(): ScheduledTask[] {
    const running: ScheduledTask[] = [];
    for (const taskId of this.runningTasks) {
      const task = this.tasks.get(taskId);
      if (task) {
        running.push(task);
      }
    }
    return running;
  }

  getPendingTasks(): ScheduledTask[] {
    return this.getTasksByStatus('pending');
  }

  getQueuedTasks(): ScheduledTask[] {
    return this.taskQueue
      .map(id => this.tasks.get(id))
      .filter((task): task is ScheduledTask => task !== undefined);
  }
}

export const taskScheduler = new TaskScheduler();

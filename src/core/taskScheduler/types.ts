import crypto from 'crypto';

export type TriggerType = 'cron' | 'interval' | 'one_time' | 'manual';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ScheduleType = 'cron' | 'interval' | 'calendar';
export type RetryPolicyType = 'none' | 'fixed' | 'exponential';
export type PriorityLevel = 'low' | 'normal' | 'high' | 'critical';

export interface CronExpression {
  second?: string;
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

export interface IntervalConfig {
  intervalMs: number;
  immediate?: boolean;
}

export interface CalendarSchedule {
  year?: number;
  month?: number;
  dayOfMonth?: number;
  hour?: number;
  minute?: number;
  second?: number;
}

export interface RetryPolicy {
  type: RetryPolicyType;
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier?: number;
}

export interface Trigger {
  type: TriggerType;
  cron?: CronExpression;
  interval?: IntervalConfig;
  calendar?: CalendarSchedule;
  scheduledTime?: number;
}

export interface TaskConfig {
  name: string;
  description?: string;
  trigger: Trigger;
  scheduleType: ScheduleType;
  retryPolicy?: RetryPolicy;
  priority: PriorityLevel;
  timeoutMs?: number;
  maxDurationMs?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ScheduledTask<T = unknown> {
  id: string;
  config: TaskConfig;
  status: TaskStatus;
  priority: number;
  createdAt: number;
  updatedAt: number;
  scheduledAt: number;
  lastRunAt?: number;
  nextRunAt?: number;
  completedAt?: number;
  failedAt?: number;
  runCount: number;
  successCount: number;
  failureCount: number;
  currentRetry: number;
  payload?: T;
  error?: string;
}

export interface TaskHistoryEntry {
  id: string;
  taskId: string;
  runAt: number;
  completedAt?: number;
  duration?: number;
  status: TaskStatus;
  error?: string;
  result?: unknown;
}

export interface TaskStats {
  totalTasks: number;
  pendingTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  cancelledTasks: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
}

export interface TaskHandler<T = unknown> {
  (task: ScheduledTask<T>): Promise<unknown>;
}

export interface TaskSchedulerConfig {
  maxConcurrentTasks: number;
  defaultTimeoutMs: number;
  enableMonitoring: boolean;
  cleanupIntervalMs: number;
  retentionDays: number;
}

export interface SchedulerEvent {
  type: SchedulerEventType;
  taskId: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export type SchedulerEventType =
  | 'task.scheduled'
  | 'task.started'
  | 'task.completed'
  | 'task.failed'
  | 'task.cancelled'
  | 'task.retried'
  | 'scheduler.started'
  | 'scheduler.stopped';

export type EventHandler = (event: SchedulerEvent) => void | Promise<void>;

export function createTaskId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export function createCronExpression(
  minute: string,
  hour: string,
  dayOfMonth: string = '*',
  month: string = '*',
  dayOfWeek: string = '*',
  second: string = '0'
): CronExpression {
  return { second, minute, hour, dayOfMonth, month, dayOfWeek };
}

export function createIntervalConfig(intervalMs: number, immediate: boolean = false): IntervalConfig {
  return { intervalMs, immediate };
}

export function createRetryPolicy(
  type: RetryPolicyType,
  maxAttempts: number,
  delayMs: number,
  backoffMultiplier?: number
): RetryPolicy {
  return { type, maxAttempts, delayMs, backoffMultiplier };
}

export function getPriorityValue(priority: PriorityLevel): number {
  const values: Record<PriorityLevel, number> = {
    low: 1,
    normal: 5,
    high: 10,
    critical: 20,
  };
  return values[priority];
}

export function parseCronField(field: string, min: number, max: number): number[] {
  const result: number[] = [];

  if (field === '*') {
    for (let i = min; i <= max; i++) {
      result.push(i);
    }
    return result;
  }

  if (field.includes(',')) {
    const parts = field.split(',');
    for (const part of parts) {
      result.push(...parseCronField(part.trim(), min, max));
    }
    return result;
  }

  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number);
    for (let i = start; i <= end; i++) {
      result.push(i);
    }
    return result;
  }

  if (field.includes('/')) {
    const [range, step] = field.split('/');
    const stepNum = Number(step);
    let start = min;
    let end = max;

    if (range !== '*') {
      if (range.includes('-')) {
        [start, end] = range.split('-').map(Number);
      } else {
        start = Number(range);
      }
    }

    for (let i = start; i <= end; i += stepNum) {
      result.push(i);
    }
    return result;
  }

  const num = Number(field);
  if (!isNaN(num) && num >= min && num <= max) {
    result.push(num);
  }

  return result;
}

export function parseCronExpression(expression: CronExpression, referenceTime: Date = new Date()): number[] {
  const minutes = parseCronField(expression.minute, 0, 59);
  const hours = parseCronField(expression.hour, 0, 23);
  const daysOfMonth = parseCronField(expression.dayOfMonth, 1, 31);
  const months = parseCronField(expression.month, 1, 12);
  const daysOfWeek = parseCronField(expression.dayOfWeek, 0, 6);

  const matchingTimes: number[] = [];
  const year = referenceTime.getFullYear();

  for (const month of months) {
    for (const dayOfMonth of daysOfMonth) {
      for (const hour of hours) {
        for (const minute of minutes) {
          const date = new Date(year, month - 1, dayOfMonth, hour, minute);
          if (date.getTime() <= referenceTime.getTime()) continue;
          if (daysOfWeek.includes(date.getDay())) {
            matchingTimes.push(date.getTime());
          }
        }
      }
    }
  }

  return matchingTimes.sort((a, b) => a - b);
}

export function getNextCronRun(expression: CronExpression, afterTime: Date = new Date()): number | null {
  const times = parseCronExpression(expression, afterTime);
  return times.length > 0 ? times[0] : null;
}

export function getNextIntervalRun(intervalMs: number, immediate: boolean = false, afterTime: Date = new Date()): number {
  if (immediate) {
    return afterTime.getTime();
  }
  return afterTime.getTime() + intervalMs;
}

export function calculateRetryDelay(retryPolicy: RetryPolicy, currentRetry: number): number {
  if (retryPolicy.type === 'none') {
    return -1;
  }

  if (retryPolicy.type === 'fixed') {
    return retryPolicy.delayMs;
  }

  if (retryPolicy.type === 'exponential') {
    const multiplier = retryPolicy.backoffMultiplier ?? 2;
    return retryPolicy.delayMs * Math.pow(multiplier, currentRetry);
  }

  return retryPolicy.delayMs;
}

export function isRetryable(retryPolicy: RetryPolicy, currentRetry: number): boolean {
  if (retryPolicy.type === 'none') {
    return false;
  }
  return currentRetry < retryPolicy.maxAttempts;
}

export function isValidCronExpression(expression: CronExpression): boolean {
  try {
    parseCronField(expression.minute, 0, 59);
    parseCronField(expression.hour, 0, 23);
    parseCronField(expression.dayOfMonth, 1, 31);
    parseCronField(expression.month, 1, 12);
    parseCronField(expression.dayOfWeek, 0, 6);
    return true;
  } catch {
    return false;
  }
}

export function isValidTaskConfig(config: Partial<TaskConfig>): config is TaskConfig {
  if (typeof config.name !== 'string' || config.name.length === 0) {
    return false;
  }

  if (!config.trigger || typeof config.trigger !== 'object') {
    return false;
  }

  const validTriggerTypes: TriggerType[] = ['cron', 'interval', 'one_time', 'manual'];
  if (!validTriggerTypes.includes(config.trigger.type)) {
    return false;
  }

  const validScheduleTypes: ScheduleType[] = ['cron', 'interval', 'calendar'];
  if (!config.scheduleType || !validScheduleTypes.includes(config.scheduleType)) {
    return false;
  }

  const validPriorities: PriorityLevel[] = ['low', 'normal', 'high', 'critical'];
  if (!config.priority || !validPriorities.includes(config.priority)) {
    return false;
  }

  return true;
}

export function compareTaskPriority(a: ScheduledTask, b: ScheduledTask): number {
  if (a.priority !== b.priority) {
    return b.priority - a.priority;
  }
  return a.scheduledAt - b.scheduledAt;
}

export function createTaskConfig(
  name: string,
  trigger: Trigger,
  scheduleType: ScheduleType,
  priority: PriorityLevel = 'normal',
  options?: {
    description?: string;
    retryPolicy?: RetryPolicy;
    timeoutMs?: number;
    maxDurationMs?: number;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }
): TaskConfig {
  return {
    name,
    description: options?.description,
    trigger,
    scheduleType,
    retryPolicy: options?.retryPolicy,
    priority,
    timeoutMs: options?.timeoutMs,
    maxDurationMs: options?.maxDurationMs,
    tags: options?.tags,
    metadata: options?.metadata,
  };
}

export function createTaskHistoryEntry(taskId: string, status: TaskStatus, data?: Partial<TaskHistoryEntry>): TaskHistoryEntry {
  return {
    id: createTaskId('hist'),
    taskId,
    runAt: Date.now(),
    completedAt: data?.completedAt,
    duration: data?.duration,
    status,
    error: data?.error,
    result: data?.result,
  };
}

export function createDefaultRetryPolicy(): RetryPolicy {
  return {
    type: 'exponential',
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
  };
}

export function createDefaultSchedulerConfig(): TaskSchedulerConfig {
  return {
    maxConcurrentTasks: 10,
    defaultTimeoutMs: 300000,
    enableMonitoring: true,
    cleanupIntervalMs: 60000,
    retentionDays: 7,
  };
}

export function calculateTaskDuration(task: ScheduledTask): number {
  if (!task.lastRunAt) return 0;
  const endTime = task.completedAt || task.failedAt || Date.now();
  return endTime - task.lastRunAt;
}

/**
 * Error Handling & Fallbacks System Implementation
 */

import {
  ErrorCategory,
  CircuitBreakerState,
  RetryPolicyType,
  ErrorSeverity,
  ErrorContext,
  AppError,
  RetryConfig,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  FallbackConfig,
  ErrorHandlerConfig,
  ErrorTracker,
  ErrorReport,
  ErrorEvent,
  ErrorEventEmitter,
  CacheEntry,
  ErrorCache,
  QueuedError,
  ErrorQueue,
  RetryState,
  OperationResult,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  DEFAULT_FALLBACK_CONFIG,
  DEFAULT_ERROR_HANDLER_CONFIG,
  ERROR_CODES,
  generateErrorId,
  categorizeError,
  isRetryableError,
  calculateRetryDelay,
} from './types';

type ErrorEventHandler = (event: ErrorEvent) => void;

export class SimpleErrorEventEmitter implements ErrorEventEmitter {
  private handlers: Map<string, Set<ErrorEventHandler>> = new Map();

  on(event: ErrorEvent['type'], handler: ErrorEventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: ErrorEvent['type'], handler: ErrorEventHandler): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler);
    }
  }

  emit(event: ErrorEvent): void {
    const eventHandlers = this.handlers.get(event.type);
    if (eventHandlers) {
      eventHandlers.forEach((handler) => handler(event));
    }
  }

  removeAllListeners(): void {
    this.handlers.clear();
  }
}

export class InMemoryErrorCache implements ErrorCache {
  private cache: Map<string, CacheEntry> = new Map();

  get<T = unknown>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt < new Date()) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T = unknown>(key: string, value: T, ttlMs: number = 60000): void {
    const now = new Date();
    this.cache.set(key, {
      key,
      value,
      timestamp: now,
      expiresAt: new Date(now.getTime() + ttlMs),
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }
    if (entry.expiresAt < new Date()) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  size(): number {
    let count = 0;
    for (const [key] of this.cache) {
      if (this.has(key)) {
        count++;
      }
    }
    return count;
  }
}

export class InMemoryErrorQueue implements ErrorQueue {
  private queue: QueuedError[] = [];
  private maxRetries: number = 3;

  enqueue(error: AppError, priority: 'low' | 'normal' | 'high' = 'normal'): string {
    const id = generateErrorId('QERR');
    const queuedError: QueuedError = {
      id,
      error,
      priority,
      queuedAt: new Date(),
      retryCount: 0,
      maxRetries: this.maxRetries,
    };
    this.queue.push(queuedError);
    this.sortByPriority();
    return id;
  }

  private sortByPriority(): void {
    const priorityOrder: Record<'low' | 'normal' | 'high', number> = {
      high: 0,
      normal: 1,
      low: 2,
    };
    this.queue.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return a.queuedAt.getTime() - b.queuedAt.getTime();
    });
  }

  dequeue(): QueuedError | undefined {
    return this.queue.shift();
  }

  peek(): QueuedError | undefined {
    return this.queue[0];
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }

  getAll(): QueuedError[] {
    return [...this.queue];
  }

  updateRetry(id: string, nextRetryAt: Date): boolean {
    const error = this.queue.find((e) => e.id === id);
    if (!error) {
      return false;
    }
    error.nextRetryAt = nextRetryAt;
    error.retryCount++;
    return true;
  }

  setMaxRetries(max: number): void {
    this.maxRetries = max;
  }
}

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private metrics: CircuitBreakerMetrics;
  private state: CircuitBreakerState;
  private halfOpenAttempts: number = 0;
  private lastFailureResponseTime: number = 0;
  private responseTimes: number[] = [];

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    this.state = 'closed';
    this.metrics = {
      totalFailures: 0,
      totalSuccesses: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      state: 'closed',
      averageResponseTimeMs: 0,
      lastStateChange: new Date(),
    };
  }

  async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('half_open');
      } else {
        if (fallback) {
          return fallback();
        }
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const startTime = Date.now();
      const result = await operation();
      const responseTime = Date.now() - startTime;
      this.recordSuccess(responseTime);
      return result;
    } catch (error) {
      const responseTime = Date.now() - this.lastFailureResponseTime;
      this.recordFailure(responseTime);
      if (fallback) {
        return fallback();
      }
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.metrics.lastFailureTime!.getTime() >= this.config.timeoutMs;
  }

  private recordSuccess(responseTimeMs: number): void {
    this.metrics.totalSuccesses++;
    this.metrics.consecutiveSuccesses++;
    this.metrics.consecutiveFailures = 0;
    this.metrics.lastSuccessTime = new Date();
    this.responseTimes.push(responseTimeMs);
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
    this.metrics.averageResponseTimeMs = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;

    if (this.state === 'half_open') {
      if (this.metrics.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    }
  }

  private recordFailure(responseTimeMs: number): void {
    this.metrics.totalFailures++;
    this.metrics.consecutiveFailures++;
    this.metrics.consecutiveSuccesses = 0;
    this.metrics.lastFailureTime = new Date();
    this.lastFailureResponseTime = responseTimeMs;

    if (this.state === 'half_open') {
      this.transitionTo('open');
    } else if (this.state === 'closed') {
      if (this.metrics.consecutiveFailures >= this.config.failureThreshold) {
        this.transitionTo('open');
      }
    }
  }

  private transitionTo(newState: CircuitBreakerState): void {
    if (this.state === newState) {
      return;
    }
    this.state = newState;
    this.metrics.state = newState;
    this.metrics.lastStateChange = new Date();

    if (newState === 'half_open') {
      this.halfOpenAttempts = 0;
      this.metrics.consecutiveSuccesses = 0;
      this.metrics.consecutiveFailures = 0;
    } else if (newState === 'closed') {
      this.metrics.consecutiveFailures = 0;
      this.metrics.consecutiveSuccesses = 0;
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.state = 'closed';
    this.metrics = {
      totalFailures: 0,
      totalSuccesses: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      state: 'closed',
      averageResponseTimeMs: 0,
      lastStateChange: new Date(),
    };
    this.responseTimes = [];
  }

  isHealthy(): boolean {
    return this.state === 'closed';
  }
}

export class RetryManager {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  async execute<T>(
    operation: () => Promise<T>,
    onRetry?: (attempt: number, error: AppError, delay: number) => void
  ): Promise<{ result: T; state: RetryState }> {
    const errors: Error[] = [];
    let lastError: AppError | undefined;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const result = await operation();
        const state: RetryState = {
          currentAttempt: attempt,
          totalAttempts: this.config.maxAttempts,
          lastAttemptAt: new Date(),
          errors,
        };
        return { result, state };
      } catch (error) {
        const appError = this.normalizeError(error as Error);
        lastError = appError;
        errors.push(error as Error);

        if (!isRetryableError(appError, this.config) || attempt === this.config.maxAttempts) {
          throw appError;
        }

        const delay = calculateRetryDelay(attempt, this.config);
        if (onRetry) {
          onRetry(attempt, appError, delay);
        }

        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  private normalizeError(error: Error): AppError {
    const category = categorizeError(error);
    const context: ErrorContext = {
      timestamp: new Date(),
    };

    return {
      id: generateErrorId('ERR'),
      code: this.getErrorCode(category),
      message: error.message,
      category,
      severity: this.getSeverity(category),
      context,
      originalError: error,
      stack: error.stack,
      recoverable: this.isRecoverable(category),
      retryable: category !== 'validation' && category !== 'authentication' && category !== 'authorization',
      fallbackable: true,
    };
  }

  private getErrorCode(category: ErrorCategory): string {
    const codeMap: Record<ErrorCategory, string> = {
      network: ERROR_CODES.NETWORK_ERROR,
      validation: ERROR_CODES.VALIDATION_ERROR,
      authentication: ERROR_CODES.AUTHENTICATION_ERROR,
      authorization: ERROR_CODES.AUTHORIZATION_ERROR,
      not_found: ERROR_CODES.NOT_FOUND_ERROR,
      server_error: ERROR_CODES.SERVER_ERROR,
    };
    return codeMap[category];
  }

  private getSeverity(category: ErrorCategory): ErrorSeverity {
    const severityMap: Record<ErrorCategory, ErrorSeverity> = {
      network: 'high',
      validation: 'low',
      authentication: 'high',
      authorization: 'medium',
      not_found: 'low',
      server_error: 'critical',
    };
    return severityMap[category];
  }

  private isRecoverable(category: ErrorCategory): boolean {
    return category === 'network' || category === 'server_error';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getConfig(): RetryConfig {
    return { ...this.config };
  }

  setMaxAttempts(max: number): void {
    this.config.maxAttempts = max;
  }

  setPolicy(policy: RetryPolicyType): void {
    this.config.policy = policy;
  }
}

export class FallbackManager {
  private config: FallbackConfig;
  private cache: InMemoryErrorCache;
  private queue: InMemoryErrorQueue;

  constructor(config: Partial<FallbackConfig> = {}) {
    this.config = { ...DEFAULT_FALLBACK_CONFIG, ...config };
    this.cache = new InMemoryErrorCache();
    this.queue = new InMemoryErrorQueue();
  }

  async execute<T>(
    operation: () => Promise<T>,
    fallbackValue?: T,
    operationKey?: string
  ): Promise<{ result: T; fallbackUsed: boolean }> {
    switch (this.config.strategy) {
      case 'cache':
        return this.executeCacheFallback(operation, fallbackValue, operationKey);
      case 'default':
        return this.executeDefaultFallback(operation, fallbackValue);
      case 'queue':
        return this.executeQueueFallback(operation, fallbackValue);
      case 'graceful':
        return this.executeGracefulFallback(operation, fallbackValue);
      default:
        return this.executeGracefulFallback(operation, fallbackValue);
    }
  }

  private async executeCacheFallback<T>(
    operation: () => Promise<T>,
    fallbackValue: T | undefined,
    operationKey?: string
  ): Promise<{ result: T; fallbackUsed: boolean }> {
    if (operationKey && this.cache.has(operationKey)) {
      const cached = this.cache.get<T>(operationKey);
      if (cached !== undefined) {
        return { result: cached, fallbackUsed: true };
      }
    }

    try {
      const result = await operation();
      if (operationKey && this.config.cacheTTLMs) {
        this.cache.set(operationKey, result, this.config.cacheTTLMs);
      }
      return { result, fallbackUsed: false };
    } catch {
      if (operationKey) {
        const cached = this.cache.get<T>(operationKey);
        if (cached !== undefined) {
          return { result: cached, fallbackUsed: true };
        }
      }
      if (fallbackValue !== undefined) {
        return { result: fallbackValue, fallbackUsed: true };
      }
      throw new Error('Fallback failed: no cache or default value available');
    }
  }

  private async executeDefaultFallback<T>(
    operation: () => Promise<T>,
    fallbackValue: T | undefined
  ): Promise<{ result: T; fallbackUsed: boolean }> {
    try {
      const result = await operation();
      return { result, fallbackUsed: false };
    } catch {
      if (fallbackValue !== undefined) {
        return { result: fallbackValue, fallbackUsed: true };
      }
      throw new Error('Fallback failed: no default value available');
    }
  }

  private async executeQueueFallback<T>(
    operation: () => Promise<T>,
    fallbackValue: T | undefined
  ): Promise<{ result: T; fallbackUsed: boolean }> {
    try {
      const result = await operation();
      return { result, fallbackUsed: false };
    } catch (error) {
      const appError = this.normalizeError(error as Error);
      this.queue.enqueue(appError, this.config.queuePriority || 'normal');

      if (fallbackValue !== undefined) {
        return { result: fallbackValue, fallbackUsed: true };
      }
      throw appError;
    }
  }

  private async executeGracefulFallback<T>(
    operation: () => Promise<T>,
    fallbackValue: T | undefined
  ): Promise<{ result: T; fallbackUsed: boolean }> {
    const timeout = this.config.gracefulTimeoutMs || 3000;

    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Graceful timeout')), timeout)
        ),
      ]);
      return { result, fallbackUsed: false };
    } catch (error) {
      if (fallbackValue !== undefined) {
        return { result: fallbackValue, fallbackUsed: true };
      }
      throw error;
    }
  }

  private normalizeError(error: Error): AppError {
    const category = categorizeError(error);
    const context: ErrorContext = {
      timestamp: new Date(),
    };

    return {
      id: generateErrorId('ERR'),
      code: ERROR_CODES.FALLBACK_FAILED,
      message: error.message,
      category,
      severity: 'medium',
      context,
      originalError: error,
      stack: error.stack,
      recoverable: true,
      retryable: true,
      fallbackable: false,
    };
  }

  getCache(): InMemoryErrorCache {
    return this.cache;
  }

  getQueue(): InMemoryErrorQueue {
    return this.queue;
  }

  getConfig(): FallbackConfig {
    return { ...this.config };
  }
}

export class ErrorTrackerStore {
  private trackers: Map<string, ErrorTracker> = new Map();
  private maxErrors: number;

  constructor(maxErrors: number = 1000) {
    this.maxErrors = maxErrors;
  }

  add(error: AppError): string {
    const id = error.id;
    const tracker: ErrorTracker = {
      id,
      error,
      occurredAt: error.context.timestamp,
      notificationSent: false,
    };

    this.trackers.set(id, tracker);

    if (this.trackers.size > this.maxErrors) {
      const oldestKey = this.findOldestKey();
      if (oldestKey) {
        this.trackers.delete(oldestKey);
      }
    }

    return id;
  }

  resolve(id: string): boolean {
    const tracker = this.trackers.get(id);
    if (!tracker) {
      return false;
    }
    tracker.resolvedAt = new Date();
    return true;
  }

  markNotificationSent(id: string): boolean {
    const tracker = this.trackers.get(id);
    if (!tracker) {
      return false;
    }
    tracker.notificationSent = true;
    tracker.notificationSentAt = new Date();
    return true;
  }

  get(id: string): ErrorTracker | undefined {
    return this.trackers.get(id);
  }

  getAll(): ErrorTracker[] {
    return Array.from(this.trackers.values());
  }

  getUnresolved(): ErrorTracker[] {
    return Array.from(this.trackers.values()).filter((t) => !t.resolvedAt);
  }

  getRecent(limit: number = 10): ErrorTracker[] {
    return Array.from(this.trackers.values())
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, limit);
  }

  clear(): void {
    this.trackers.clear();
  }

  private findOldestKey(): string | undefined {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, tracker] of this.trackers) {
      if (tracker.occurredAt.getTime() < oldestTime) {
        oldestTime = tracker.occurredAt.getTime();
        oldestKey = key;
      }
    }

    return oldestKey;
  }
}

export class ErrorReporter {
  generateReport(store: ErrorTrackerStore): ErrorReport {
    const trackers = store.getAll();
    const errorsByCategory: Record<ErrorCategory, number> = {
      network: 0,
      validation: 0,
      authentication: 0,
      authorization: 0,
      not_found: 0,
      server_error: 0,
    };
    const errorsBySeverity: Record<ErrorSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    const errorCounts: Record<string, number> = {};
    let oldestDate = new Date();
    let newestDate = new Date(0);

    for (const tracker of trackers) {
      const error = tracker.error;
      errorsByCategory[error.category]++;
      errorsBySeverity[error.severity]++;
      errorCounts[error.code] = (errorCounts[error.code] || 0) + 1;

      if (tracker.occurredAt < oldestDate) {
        oldestDate = tracker.occurredAt;
      }
      if (tracker.occurredAt > newestDate) {
        newestDate = tracker.occurredAt;
      }
    }

    const topErrors = Object.entries(errorCounts)
      .map(([code, count]) => {
        const tracker = trackers.find((t) => t.error.code === code);
        return {
          code,
          count,
          lastOccurrence: tracker?.occurredAt || new Date(),
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const recentErrors = trackers
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, 10)
      .map((t) => t.error);

    return {
      totalErrors: trackers.length,
      errorsByCategory,
      errorsBySeverity,
      recentErrors,
      topErrors,
      timeRange: { start: oldestDate, end: newestDate },
      generatedAt: new Date(),
    };
  }
}

export interface IErrorHandler {
  handle(error: Error | AppError, context?: Partial<ErrorContext>): AppError;
  execute<T>(operation: () => Promise<T>, context?: Partial<ErrorContext>): Promise<OperationResult<T>>;
  getTracker(): ErrorTrackerStore;
  getCircuitBreaker(): CircuitBreaker;
  getRetryManager(): RetryManager;
  getFallbackManager(): FallbackManager;
  getReport(): ErrorReport;
  on(event: ErrorEvent['type'], handler: (event: ErrorEvent) => void): void;
  off(event: ErrorEvent['type'], handler: (event: ErrorEvent) => void): void;
  destroy(): void;
}

export class ErrorHandler implements IErrorHandler {
  private config: ErrorHandlerConfig;
  private eventEmitter: SimpleErrorEventEmitter;
  private tracker: ErrorTrackerStore;
  private circuitBreaker: CircuitBreaker;
  private retryManager: RetryManager;
  private fallbackManager: FallbackManager;
  private reporter: ErrorReporter;

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = { ...DEFAULT_ERROR_HANDLER_CONFIG, ...config };
    this.eventEmitter = new SimpleErrorEventEmitter();
    this.tracker = new ErrorTrackerStore(this.config.maxErrorsStored);
    this.circuitBreaker = new CircuitBreaker();
    this.retryManager = new RetryManager();
    this.fallbackManager = new FallbackManager();
    this.reporter = new ErrorReporter();
  }

  handle(error: Error | AppError, context?: Partial<ErrorContext>): AppError {
    const appError = this.normalizeError(error, context);

    if (this.config.enableErrorTracking) {
      this.tracker.add(appError);
    }

    this.emitErrorEvent(appError);

    return appError;
  }

  private normalizeError(error: Error | AppError, context?: Partial<ErrorContext>): AppError {
    if ('id' in error && 'category' in error) {
      if (context) {
        error.context = { ...error.context, ...context };
      }
      return error as AppError;
    }

    const category = categorizeError(error);
    const fullContext: ErrorContext = {
      timestamp: new Date(),
      ...context,
    };

    return {
      id: generateErrorId('ERR'),
      code: this.getErrorCode(category),
      message: error.message,
      category,
      severity: this.getSeverity(category),
      context: fullContext,
      originalError: error,
      stack: error.stack,
      recoverable: this.isRecoverable(category),
      retryable: category !== 'validation' && category !== 'authentication' && category !== 'authorization',
      fallbackable: true,
    };
  }

  private getErrorCode(category: ErrorCategory): string {
    const codeMap: Record<ErrorCategory, string> = {
      network: ERROR_CODES.NETWORK_ERROR,
      validation: ERROR_CODES.VALIDATION_ERROR,
      authentication: ERROR_CODES.AUTHENTICATION_ERROR,
      authorization: ERROR_CODES.AUTHORIZATION_ERROR,
      not_found: ERROR_CODES.NOT_FOUND_ERROR,
      server_error: ERROR_CODES.SERVER_ERROR,
    };
    return codeMap[category];
  }

  private getSeverity(category: ErrorCategory): ErrorSeverity {
    const severityMap: Record<ErrorCategory, ErrorSeverity> = {
      network: 'high',
      validation: 'low',
      authentication: 'high',
      authorization: 'medium',
      not_found: 'low',
      server_error: 'critical',
    };
    return severityMap[category];
  }

  private isRecoverable(category: ErrorCategory): boolean {
    return category === 'network' || category === 'server_error';
  }

  private emitErrorEvent(error: AppError): void {
    this.eventEmitter.emit({
      type: 'error',
      error,
      timestamp: new Date(),
    });
  }

  async execute<T>(operation: () => Promise<T>, context?: Partial<ErrorContext>): Promise<OperationResult<T>> {
    const startTime = Date.now();
    let fallbackUsed = false;
    let circuitBreakerState: CircuitBreakerState = 'closed';

    try {
      let result: T;

      if (this.config.enableCircuitBreaker) {
        result = await this.circuitBreaker.execute(
          async () => {
            if (this.config.enableRetry) {
              try {
                const retryResult = await this.retryManager.execute(
                  operation,
                  (attempt, appError, delay) => {
                    this.eventEmitter.emit({
                      type: 'retry',
                      error: appError,
                      attempt,
                      timestamp: new Date(),
                      metadata: { delay },
                    });
                  }
                );
                return retryResult.result;
              } catch (error) {
                throw error;
              }
            }
            return operation();
          },
          async () => {
            fallbackUsed = true;
            if (this.config.enableFallback) {
              const fallbackResult = await this.fallbackManager.execute(operation);
              fallbackUsed = fallbackResult.fallbackUsed;
              return fallbackResult.result;
            }
            throw new Error('No fallback available');
          }
        );
        circuitBreakerState = this.circuitBreaker.getState();
      } else if (this.config.enableRetry) {
        try {
          const retryResult = await this.retryManager.execute(
            operation,
            (attempt, appError, delay) => {
              this.eventEmitter.emit({
                type: 'retry',
                error: appError,
                attempt,
                timestamp: new Date(),
                metadata: { delay },
              });
            }
          );
          result = retryResult.result;
        } catch (error) {
          if (this.config.enableFallback) {
            const fallbackResult = await this.fallbackManager.execute(operation);
            fallbackUsed = fallbackResult.fallbackUsed;
            result = fallbackResult.result;
          } else {
            throw error;
          }
        }
      } else {
        result = await operation();
      }

      return {
        success: true,
        data: result,
        fallbackUsed,
        circuitBreakerState,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      const appError = this.handle(error as Error, context);

      return {
        success: false,
        error: appError,
        fallbackUsed,
        circuitBreakerState,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  getTracker(): ErrorTrackerStore {
    return this.tracker;
  }

  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  getRetryManager(): RetryManager {
    return this.retryManager;
  }

  getFallbackManager(): FallbackManager {
    return this.fallbackManager;
  }

  getReport(): ErrorReport {
    return this.reporter.generateReport(this.tracker);
  }

  on(event: ErrorEvent['type'], handler: (event: ErrorEvent) => void): void {
    this.eventEmitter.on(event, handler);
  }

  off(event: ErrorEvent['type'], handler: (event: ErrorEvent) => void): void {
    this.eventEmitter.off(event, handler);
  }

  destroy(): void {
    this.eventEmitter.removeAllListeners();
  }
}

export function createErrorHandler(config?: Partial<ErrorHandlerConfig>): ErrorHandler {
  return new ErrorHandler(config);
}

export function createAppError(
  message: string,
  category: ErrorCategory,
  options?: Partial<Omit<AppError, 'id' | 'message' | 'category'>> & { context?: Partial<ErrorContext> }
): AppError {
  const isRetryable = category !== 'validation' && category !== 'authentication' && category !== 'authorization';
  return {
    id: generateErrorId('ERR'),
    code: options?.code || ERROR_CODES.UNKNOWN_ERROR,
    message,
    category,
    severity: options?.severity || 'medium',
    context: {
      timestamp: new Date(),
      source: options?.context?.source,
      correlationId: options?.context?.correlationId,
      userId: options?.context?.userId,
      sessionId: options?.context?.sessionId,
      metadata: options?.context?.metadata,
    },
    originalError: options?.originalError,
    stack: options?.stack,
    recoverable: options?.recoverable ?? true,
    retryable: options?.retryable ?? isRetryable,
    fallbackable: options?.fallbackable ?? true,
    details: options?.details,
    suggestions: options?.suggestions,
  };
}

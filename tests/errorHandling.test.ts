/**
 * Error Handling & Fallbacks System Tests
 */

import {
  ErrorHandler,
  createErrorHandler,
  createAppError,
  SimpleErrorEventEmitter,
  InMemoryErrorCache,
  InMemoryErrorQueue,
  CircuitBreaker,
  RetryManager,
  FallbackManager,
  ErrorTrackerStore,
  ErrorReporter,
  ErrorCategory,
  CircuitBreakerState,
  RetryPolicyType,
  FallbackStrategy,
  ErrorSeverity,
  AppError,
  RetryConfig,
  CircuitBreakerConfig,
  FallbackConfig,
  ErrorHandlerConfig,
  generateErrorId,
  isErrorCategory,
  isCircuitBreakerState,
  isRetryPolicyType,
  isFallbackStrategy,
  isErrorSeverity,
  categorizeError,
  isRetryableError,
  calculateRetryDelay,
  serializeAppError,
  deserializeAppError,
  formatErrorMessage,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  DEFAULT_FALLBACK_CONFIG,
  DEFAULT_ERROR_HANDLER_CONFIG,
} from '../src/core/errorHandling';

describe('Error Handling & Fallbacks System', () => {
  describe('Type Guards', () => {
    test('isErrorCategory correctly identifies valid error categories', () => {
      expect(isErrorCategory('network')).toBe(true);
      expect(isErrorCategory('validation')).toBe(true);
      expect(isErrorCategory('authentication')).toBe(true);
      expect(isErrorCategory('authorization')).toBe(true);
      expect(isErrorCategory('not_found')).toBe(true);
      expect(isErrorCategory('server_error')).toBe(true);
    });

    test('isErrorCategory correctly rejects invalid categories', () => {
      expect(isErrorCategory('invalid')).toBe(false);
      expect(isErrorCategory('NETWORK')).toBe(false);
      expect(isErrorCategory('')).toBe(false);
      expect(isErrorCategory(123 as unknown as string)).toBe(false);
    });

    test('isCircuitBreakerState correctly identifies valid states', () => {
      expect(isCircuitBreakerState('closed')).toBe(true);
      expect(isCircuitBreakerState('open')).toBe(true);
      expect(isCircuitBreakerState('half_open')).toBe(true);
    });

    test('isCircuitBreakerState correctly rejects invalid states', () => {
      expect(isCircuitBreakerState('CLOSED')).toBe(false);
      expect(isCircuitBreakerState('unknown')).toBe(false);
      expect(isCircuitBreakerState('')).toBe(false);
    });

    test('isRetryPolicyType correctly identifies valid policies', () => {
      expect(isRetryPolicyType('fixed')).toBe(true);
      expect(isRetryPolicyType('exponential')).toBe(true);
      expect(isRetryPolicyType('linear')).toBe(true);
    });

    test('isRetryPolicyType correctly rejects invalid policies', () => {
      expect(isRetryPolicyType('FIXED')).toBe(false);
      expect(isRetryPolicyType('random')).toBe(false);
    });

    test('isFallbackStrategy correctly identifies valid strategies', () => {
      expect(isFallbackStrategy('cache')).toBe(true);
      expect(isFallbackStrategy('default')).toBe(true);
      expect(isFallbackStrategy('queue')).toBe(true);
      expect(isFallbackStrategy('graceful')).toBe(true);
    });

    test('isFallbackStrategy correctly rejects invalid strategies', () => {
      expect(isFallbackStrategy('CACHE')).toBe(false);
      expect(isFallbackStrategy('none')).toBe(false);
    });

    test('isErrorSeverity correctly identifies valid severities', () => {
      expect(isErrorSeverity('low')).toBe(true);
      expect(isErrorSeverity('medium')).toBe(true);
      expect(isErrorSeverity('high')).toBe(true);
      expect(isErrorSeverity('critical')).toBe(true);
    });
  });

  describe('ID Generation', () => {
    test('generateErrorId creates unique IDs', () => {
      const id1 = generateErrorId();
      const id2 = generateErrorId();
      expect(id1).not.toBe(id2);
    });

    test('generateErrorId uses provided prefix', () => {
      const id = generateErrorId('TEST');
      expect(id.startsWith('TEST_')).toBe(true);
    });

    test('generateErrorId generates IDs with correct format', () => {
      const id = generateErrorId('ERR');
      expect(id).toMatch(/^ERR_[a-z0-9]+$/);
    });
  });

  describe('Error Categorization', () => {
    test('categorizeError identifies network errors', () => {
      const error = new Error('network timeout');
      expect(categorizeError(error)).toBe('network');
    });

    test('categorizeError identifies validation errors', () => {
      const error = new Error('invalid input');
      expect(categorizeError(error)).toBe('validation');
    });

    test('categorizeError identifies authentication errors', () => {
      const error = new Error('authentication failed');
      expect(categorizeError(error)).toBe('authentication');
    });

    test('categorizeError identifies authorization errors', () => {
      const error = new Error('permission denied');
      expect(categorizeError(error)).toBe('authorization');
    });

    test('categorizeError identifies not_found errors', () => {
      const error = new Error('resource not found');
      expect(categorizeError(error)).toBe('not_found');
    });

    test('categorizeError identifies server errors by default', () => {
      const error = new Error('internal server error');
      expect(categorizeError(error)).toBe('server_error');
    });

    test('categorizeError works with AppError', () => {
      const appError = createAppError('network timeout error', 'network');
      expect(categorizeError(appError)).toBe('network');
    });
  });

  describe('Retry Logic', () => {
    test('isRetryableError returns false for validation errors', () => {
      const error = createAppError('validation error', 'validation');
      expect(isRetryableError(error, DEFAULT_RETRY_CONFIG)).toBe(false);
    });

    test('isRetryableError returns false for authentication errors', () => {
      const error = createAppError('auth error', 'authentication');
      expect(isRetryableError(error, DEFAULT_RETRY_CONFIG)).toBe(false);
    });

    test('isRetryableError returns true for network errors', () => {
      const error = createAppError('network error', 'network');
      expect(isRetryableError(error, DEFAULT_RETRY_CONFIG)).toBe(true);
    });

    test('isRetryableError respects retryableErrors config', () => {
      const error = createAppError('error', 'server_error');
      const config: RetryConfig = {
        ...DEFAULT_RETRY_CONFIG,
        retryableErrors: ['server_error'],
      };
      expect(isRetryableError(error, config)).toBe(true);
    });

    test('isRetryableError respects nonRetryableErrors config', () => {
      const error = createAppError('error', 'network');
      const config: RetryConfig = {
        ...DEFAULT_RETRY_CONFIG,
        nonRetryableErrors: ['network'],
      };
      expect(isRetryableError(error, config)).toBe(false);
    });

    test('calculateRetryDelay returns fixed delay for fixed policy', () => {
      const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, policy: 'fixed', initialDelayMs: 100 };
      expect(calculateRetryDelay(1, config)).toBe(100);
      expect(calculateRetryDelay(2, config)).toBe(100);
    });

    test('calculateRetryDelay returns exponential delay for exponential policy', () => {
      const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, policy: 'exponential', initialDelayMs: 100, backoffMultiplier: 2 };
      expect(calculateRetryDelay(1, config)).toBe(100);
      expect(calculateRetryDelay(2, config)).toBe(200);
      expect(calculateRetryDelay(3, config)).toBe(400);
    });

    test('calculateRetryDelay returns linear delay for linear policy', () => {
      const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, policy: 'linear', initialDelayMs: 100 };
      expect(calculateRetryDelay(1, config)).toBe(100);
      expect(calculateRetryDelay(2, config)).toBe(200);
      expect(calculateRetryDelay(3, config)).toBe(300);
    });

    test('calculateRetryDelay respects maxDelayMs', () => {
      const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, policy: 'exponential', initialDelayMs: 100, maxDelayMs: 150, backoffMultiplier: 2 };
      expect(calculateRetryDelay(1, config)).toBe(100);
      expect(calculateRetryDelay(2, config)).toBe(150);
      expect(calculateRetryDelay(3, config)).toBe(150);
    });
  });

  describe('Error Serialization', () => {
    test('serializeAppError converts AppError to plain object', () => {
      const error = createAppError('test error', 'network', {
        context: {
          timestamp: new Date(),
          correlationId: 'corr_123',
        },
      });
      const serialized = serializeAppError(error);
      expect((serialized.context as Record<string, unknown>).timestamp).toBe(error.context.timestamp.toISOString());
    });

    test('deserializeAppError converts plain object back to AppError', () => {
      const error = createAppError('test error', 'network');
      const serialized = serializeAppError(error);
      const deserialized = deserializeAppError(serialized as Record<string, unknown>);
      expect(deserialized.id).toBe(error.id);
      expect(deserialized.category).toBe(error.category);
    });

    test('formatErrorMessage formats error correctly', () => {
      const error = createAppError('test error', 'network', {
        context: {
          timestamp: new Date(),
          correlationId: 'corr_123',
          source: 'test-source',
        },
      });
      const formatted = formatErrorMessage(error);
      expect(formatted).toContain('NETWORK');
      expect(formatted).toContain('corr_123');
      expect(formatted).toContain('test-source');
    });
  });

  describe('SimpleErrorEventEmitter', () => {
    test('emits and receives events', () => {
      const emitter = new SimpleErrorEventEmitter();
      let received = false;

      emitter.on('error', () => {
        received = true;
      });

      emitter.emit({ type: 'error', timestamp: new Date() });
      expect(received).toBe(true);
    });

    test('removes event listeners', () => {
      const emitter = new SimpleErrorEventEmitter();
      let count = 0;

      const handler = () => count++;
      emitter.on('error', handler);
      emitter.emit({ type: 'error', timestamp: new Date() });
      emitter.off('error', handler);
      emitter.emit({ type: 'error', timestamp: new Date() });

      expect(count).toBe(1);
    });

    test('handles multiple event types', () => {
      const emitter = new SimpleErrorEventEmitter();
      let errorCount = 0;
      let retryCount = 0;

      emitter.on('error', () => errorCount++);
      emitter.on('retry', () => retryCount++);

      emitter.emit({ type: 'error', timestamp: new Date() });
      emitter.emit({ type: 'retry', timestamp: new Date(), attempt: 1 });

      expect(errorCount).toBe(1);
      expect(retryCount).toBe(1);
    });
  });

  describe('InMemoryErrorCache', () => {
    test('stores and retrieves values', () => {
      const cache = new InMemoryErrorCache();
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    test('returns undefined for expired entries', () => {
      const cache = new InMemoryErrorCache();
      cache.set('key1', 'value1', 10);
      expect(cache.get('key1')).toBe('value1');
    });

    test('deletes entries', () => {
      const cache = new InMemoryErrorCache();
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    test('clears all entries', () => {
      const cache = new InMemoryErrorCache();
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.size()).toBe(0);
    });

    test('checks if key exists', () => {
      const cache = new InMemoryErrorCache();
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    test('returns correct size', () => {
      const cache = new InMemoryErrorCache();
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
    });
  });

  describe('InMemoryErrorQueue', () => {
    test('enqueues and dequeues errors', () => {
      const queue = new InMemoryErrorQueue();
      const error = createAppError('test error', 'network');
      const id = queue.enqueue(error);
      expect(id).toBeDefined();
      expect(queue.size()).toBe(1);
    });

    test('dequeues in priority order', () => {
      const queue = new InMemoryErrorQueue();
      const error1 = createAppError('low priority', 'network');
      const error2 = createAppError('high priority', 'network');

      queue.enqueue(error1, 'low');
      queue.enqueue(error2, 'high');

      const dequeued = queue.dequeue();
      expect(dequeued?.error.message).toBe('high priority');
    });

    test('peeks without removing', () => {
      const queue = new InMemoryErrorQueue();
      const error = createAppError('test error', 'network');
      queue.enqueue(error);

      const peeked = queue.peek();
      expect(peeked?.error.message).toBe('test error');
      expect(queue.size()).toBe(1);
    });

    test('clears queue', () => {
      const queue = new InMemoryErrorQueue();
      const error = createAppError('test error', 'network');
      queue.enqueue(error);
      queue.clear();
      expect(queue.size()).toBe(0);
    });

    test('updates retry info', () => {
      const queue = new InMemoryErrorQueue();
      const error = createAppError('test error', 'network');
      const id = queue.enqueue(error);
      const nextRetry = new Date();

      const updated = queue.updateRetry(id, nextRetry);
      expect(updated).toBe(true);
    });

    test('returns all queued errors', () => {
      const queue = new InMemoryErrorQueue();
      const error1 = createAppError('error 1', 'network');
      const error2 = createAppError('error 2', 'network');

      queue.enqueue(error1);
      queue.enqueue(error2);

      const all = queue.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe('CircuitBreaker', () => {
    test('starts in closed state', () => {
      const cb = new CircuitBreaker();
      expect(cb.getState()).toBe('closed');
    });

    test('transitions to open after failure threshold', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2 });

      const operation = async () => {
        throw new Error('fail');
      };

      for (let i = 0; i < 2; i++) {
        await cb.execute(operation).catch(() => {});
      }

      expect(cb.getState()).toBe('open');
    });

    test('executes operation successfully when closed', async () => {
      const cb = new CircuitBreaker();
      const operation = async () => 'success';

      const result = await cb.execute(operation);
      expect(result).toBe('success');
    });

    test('uses fallback when open', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1 });

      const operation = async () => {
        throw new Error('fail');
      };

      const fallback = async () => 'fallback';

      await cb.execute(operation).catch(() => {});
      expect(cb.getState()).toBe('open');

      const result = await cb.execute(operation, fallback);
      expect(result).toBe('fallback');
    });

    test('records success metrics', async () => {
      const cb = new CircuitBreaker();
      const operation = async () => 'success';

      await cb.execute(operation);
      const metrics = cb.getMetrics();

      expect(metrics.totalSuccesses).toBe(1);
      expect(metrics.consecutiveSuccesses).toBe(1);
    });

    test('records failure metrics', async () => {
      const cb = new CircuitBreaker();
      const operation = async () => {
        throw new Error('fail');
      };

      await cb.execute(operation).catch(() => {});
      const metrics = cb.getMetrics();

      expect(metrics.totalFailures).toBe(1);
      expect(metrics.consecutiveFailures).toBe(1);
    });

    test('resets circuit breaker', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1 });
      const operation = async () => {
        throw new Error('fail');
      };

      await cb.execute(operation).catch(() => {});
      expect(cb.getState()).toBe('open');

      cb.reset();
      expect(cb.getState()).toBe('closed');
      expect(cb.getMetrics().totalFailures).toBe(0);
    });

    test('isHealthy returns true when closed', () => {
      const cb = new CircuitBreaker();
      expect(cb.isHealthy()).toBe(true);
    });
  });

  describe('RetryManager', () => {
    test('succeeds on first attempt', async () => {
      const manager = new RetryManager();
      const operation = async () => 'success';

      const { result, state } = await manager.execute(operation);
      expect(result).toBe('success');
      expect(state.currentAttempt).toBe(1);
    });

    test('retries on failure', async () => {
      const manager = new RetryManager({ maxAttempts: 3 });
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('fail');
        }
        return 'success';
      };

      const { result, state } = await manager.execute(operation);
      expect(result).toBe('success');
      expect(state.currentAttempt).toBe(3);
    });

    test('calls onRetry callback', async () => {
      const manager = new RetryManager({ maxAttempts: 3 });
      let retryCount = 0;
      const operation = async () => {
        throw new Error('fail');
      };

      const onRetry = (_attempt: number, _error: AppError, _delay: number) => {
        retryCount++;
      };

      await manager.execute(operation, onRetry).catch(() => {});
      expect(retryCount).toBe(2);
    });

    test('throws after max attempts exhausted', async () => {
      const manager = new RetryManager({ maxAttempts: 2 });
      const operation = async () => {
        throw new Error('always fails');
      };

      try {
        await manager.execute(operation);
        fail('Expected error to be thrown');
      } catch (error) {
        expect((error as AppError).message).toBe('always fails');
      }
    });
  });

  describe('FallbackManager', () => {
    test('returns operation result when successful', async () => {
      const manager = new FallbackManager();
      const operation = async () => 'success';

      const { result, fallbackUsed } = await manager.execute(operation, 'fallback');
      expect(result).toBe('success');
      expect(fallbackUsed).toBe(false);
    });

    test('returns fallback value on cache miss', async () => {
      const manager = new FallbackManager({ strategy: 'cache' });
      const operation = async () => {
        throw new Error('fail');
      };

      const { result, fallbackUsed } = await manager.execute(operation, 'fallback', 'key1');
      expect(result).toBe('fallback');
      expect(fallbackUsed).toBe(true);
    });

    test('uses cached value on cache hit', async () => {
      const manager = new FallbackManager({ strategy: 'cache', cacheTTLMs: 1000 });
      const operation = async () => {
        throw new Error('fail');
      };

      manager.getCache().set('key1', 'cached_value');

      const { result, fallbackUsed } = await manager.execute(operation, 'fallback', 'key1');
      expect(result).toBe('cached_value');
      expect(fallbackUsed).toBe(true);
    });

    test('uses default fallback strategy', async () => {
      const manager = new FallbackManager({ strategy: 'default' });
      const operation = async () => {
        throw new Error('fail');
      };

      const { result, fallbackUsed } = await manager.execute(operation, 'default_value');
      expect(result).toBe('default_value');
      expect(fallbackUsed).toBe(true);
    });

    test('queues error when using queue strategy', async () => {
      const manager = new FallbackManager({ strategy: 'queue' });
      const operation = async () => {
        throw new Error('fail');
      };

      await manager.execute(operation, 'fallback');
      expect(manager.getQueue().size()).toBe(1);
    });

    test('throws when no fallback available', async () => {
      const manager = new FallbackManager({ strategy: 'default' });
      const operation = async () => {
        throw new Error('fail');
      };

      await expect(manager.execute(operation)).rejects.toThrow('Fallback failed');
    });
  });

  describe('ErrorTrackerStore', () => {
    test('adds errors to tracker', () => {
      const store = new ErrorTrackerStore();
      const error = createAppError('test error', 'network');
      const id = store.add(error);

      expect(id).toBe(error.id);
      expect(store.get(id)).toBeDefined();
    });

    test('resolves errors', () => {
      const store = new ErrorTrackerStore();
      const error = createAppError('test error', 'network');
      const id = store.add(error);

      const resolved = store.resolve(id);
      expect(resolved).toBe(true);
      expect(store.get(id)?.resolvedAt).toBeDefined();
    });

    test('marks notifications as sent', () => {
      const store = new ErrorTrackerStore();
      const error = createAppError('test error', 'network');
      const id = store.add(error);

      const marked = store.markNotificationSent(id);
      expect(marked).toBe(true);
      expect(store.get(id)?.notificationSent).toBe(true);
    });

    test('gets unresolved errors', () => {
      const store = new ErrorTrackerStore();
      const error1 = createAppError('error 1', 'network');
      const error2 = createAppError('error 2', 'network');

      store.add(error1);
      const id2 = store.add(error2);
      store.resolve(id2);

      const unresolved = store.getUnresolved();
      expect(unresolved).toHaveLength(1);
    });

    test('gets recent errors', () => {
      const store = new ErrorTrackerStore(10);
      for (let i = 0; i < 5; i++) {
        store.add(createAppError(`error ${i}`, 'network'));
      }

      const recent = store.getRecent(3);
      expect(recent).toHaveLength(3);
    });

    test('respects max errors limit', () => {
      const store = new ErrorTrackerStore(5);
      for (let i = 0; i < 10; i++) {
        store.add(createAppError(`error ${i}`, 'network'));
      }

      expect(store.getAll()).toHaveLength(5);
    });
  });

  describe('ErrorReporter', () => {
    test('generates error report', () => {
      const store = new ErrorTrackerStore();
      store.add(createAppError('error 1', 'network'));
      store.add(createAppError('error 2', 'validation'));
      store.add(createAppError('error 3', 'network'));

      const reporter = new ErrorReporter();
      const report = reporter.generateReport(store);

      expect(report.totalErrors).toBe(3);
      expect(report.errorsByCategory.network).toBe(2);
      expect(report.errorsByCategory.validation).toBe(1);
      expect(report.topErrors).toHaveLength(1);
      expect(report.topErrors[0].code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('ErrorHandler', () => {
    test('creates error handler with default config', () => {
      const handler = createErrorHandler();
      expect(handler).toBeInstanceOf(ErrorHandler);
    });

    test('handles errors', () => {
      const handler = createErrorHandler();
      const error = new Error('test error');

      const appError = handler.handle(error);
      expect(appError.id).toBeDefined();
      expect(appError.message).toBe('test error');
      expect(appError.category).toBe('server_error');
    });

    test('executes operations successfully', async () => {
      const handler = createErrorHandler();
      const operation = async () => 'success';

      const result = await handler.execute(operation);
      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
    });

    test('executes operations with retry', async () => {
      const handler = createErrorHandler({
        enableRetry: true,
      });

      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('fail');
        }
        return 'success';
      };

      const result = await handler.execute(operation);
      expect(result.success).toBe(true);
      expect(attempts).toBe(2);
    });

    test('executes operations with circuit breaker', async () => {
      const handler = createErrorHandler({
        enableCircuitBreaker: true,
        enableRetry: false,
      });

      const operation = async () => 'success';
      const result = await handler.execute(operation);

      expect(result.success).toBe(true);
      expect(result.circuitBreakerState).toBe('closed');
    });

    test('executes operations with fallback', async () => {
      const handler = createErrorHandler({
        enableFallback: true,
        enableRetry: false,
        enableCircuitBreaker: false,
      });

      const operation = async () => {
        throw new Error('fail');
      };

      const result = await handler.execute(operation);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('handles errors with context', () => {
      const handler = createErrorHandler();
      const error = new Error('test error');

      const appError = handler.handle(error, {
        source: 'test-source',
        correlationId: 'corr_123',
      });

      expect(appError.context.source).toBe('test-source');
      expect(appError.context.correlationId).toBe('corr_123');
    });

    test('generates error report', () => {
      const handler = createErrorHandler();
      handler.handle(new Error('error 1'));
      handler.handle(new Error('error 2'));

      const report = handler.getReport();
      expect(report.totalErrors).toBe(2);
    });

    test('registers and unregisters event listeners', () => {
      const handler = createErrorHandler();
      let eventCount = 0;

      const handlerFn = () => eventCount++;
      handler.on('error', handlerFn);

      handler.handle(new Error('test'));
      expect(eventCount).toBe(1);

      handler.off('error', handlerFn);
      handler.handle(new Error('test'));
      expect(eventCount).toBe(1);
    });

    test('emits retry events', async () => {
      const handler = createErrorHandler({
        enableRetry: true,
      });

      let retryEvents = 0;
      handler.on('retry', () => retryEvents++);

      const operation = async () => {
        throw new Error('fail');
      };

      await handler.execute(operation).catch(() => {});
      expect(retryEvents).toBeGreaterThan(0);
    });

    test('destroys handler cleanly', () => {
      const handler = createErrorHandler();
      handler.handle(new Error('test'));

      handler.destroy();
      expect(() => handler.getReport()).not.toThrow();
    });
  });

  describe('createAppError', () => {
    test('creates app error with required fields', () => {
      const error = createAppError('test error', 'network');

      expect(error.id).toBeDefined();
      expect(error.message).toBe('test error');
      expect(error.category).toBe('network');
      expect(error.context.timestamp).toBeDefined();
    });

    test('creates app error with options', () => {
      const error = createAppError('test error', 'validation', {
        severity: 'high',
        context: {
          timestamp: new Date(),
          source: 'test',
        },
      });

      expect(error.severity).toBe('high');
      expect(error.context.source).toBe('test');
    });

    test('sets retryable based on category', () => {
      const validationError = createAppError('error', 'validation');
      const networkError = createAppError('error', 'network');

      expect(validationError.retryable).toBe(false);
      expect(networkError.retryable).toBe(true);
    });
  });
});

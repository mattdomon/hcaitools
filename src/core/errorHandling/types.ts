/**
 * Error Handling & Fallbacks System Types
 */

export type ErrorCategory = 
  | 'network' 
  | 'validation' 
  | 'authentication' 
  | 'authorization' 
  | 'not_found' 
  | 'server_error';

export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

export type RetryPolicyType = 'fixed' | 'exponential' | 'linear';

export type FallbackStrategy = 'cache' | 'default' | 'queue' | 'graceful';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorContext {
  timestamp: Date;
  source?: string;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface AppError {
  id: string;
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context: ErrorContext;
  originalError?: Error;
  stack?: string;
  recoverable: boolean;
  retryable: boolean;
  fallbackable: boolean;
  details?: Record<string, unknown>;
  suggestions?: string[];
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  policy: RetryPolicyType;
  retryableErrors?: ErrorCategory[];
  nonRetryableErrors?: ErrorCategory[];
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  halfOpenMaxAttempts: number;
  monitoredErrors?: ErrorCategory[];
}

export interface CircuitBreakerMetrics {
  totalFailures: number;
  totalSuccesses: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  state: CircuitBreakerState;
  averageResponseTimeMs: number;
  lastStateChange: Date;
}

export interface FallbackConfig {
  strategy: FallbackStrategy;
  cacheTTLMs?: number;
  defaultValue?: unknown;
  queuePriority?: 'low' | 'normal' | 'high';
  gracefulTimeoutMs?: number;
  fallbackHandlers?: Record<string, () => unknown>;
}

export interface ErrorHandlerConfig {
  enableRetry: boolean;
  enableCircuitBreaker: boolean;
  enableFallback: boolean;
  enableErrorTracking: boolean;
  enableNotifications: boolean;
  maxErrorsStored: number;
  errorRetentionMs?: number;
  notificationChannels?: string[];
}

export interface ErrorTracker {
  id: string;
  error: AppError;
  occurredAt: Date;
  resolvedAt?: Date;
  notificationSent: boolean;
  notificationSentAt?: Date;
}

export interface ErrorReport {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recentErrors: AppError[];
  topErrors: Array<{ code: string; count: number; lastOccurrence: Date }>;
  timeRange: { start: Date; end: Date };
  generatedAt: Date;
}

export interface ErrorEvent {
  type: 'error' | 'retry' | 'fallback' | 'circuit_open' | 'circuit_close' | 'circuit_half_open';
  error?: AppError;
  attempt?: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ErrorEventEmitter {
  on(event: ErrorEvent['type'], handler: (event: ErrorEvent) => void): void;
  off(event: ErrorEvent['type'], handler: (event: ErrorEvent) => void): void;
  emit(event: ErrorEvent): void;
}

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  timestamp: Date;
  expiresAt: Date;
}

export interface ErrorCache {
  get<T = unknown>(key: string): T | undefined;
  set<T = unknown>(key: string, value: T, ttlMs?: number): void;
  delete(key: string): boolean;
  clear(): void;
  has(key: string): boolean;
  size(): number;
}

export interface QueuedError {
  id: string;
  error: AppError;
  priority: 'low' | 'normal' | 'high';
  queuedAt: Date;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
}

export interface ErrorQueue {
  enqueue(error: AppError, priority?: 'low' | 'normal' | 'high'): string;
  dequeue(): QueuedError | undefined;
  peek(): QueuedError | undefined;
  size(): number;
  clear(): void;
  getAll(): QueuedError[];
  updateRetry(id: string, nextRetryAt: Date): boolean;
}

export interface RetryState {
  currentAttempt: number;
  totalAttempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  errors: Error[];
}

export interface OperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: AppError;
  retryState?: RetryState;
  circuitBreakerState?: CircuitBreakerState;
  fallbackUsed: boolean;
  executionTimeMs: number;
}

export const ERROR_CATEGORIES: ErrorCategory[] = [
  'network',
  'validation',
  'authentication',
  'authorization',
  'not_found',
  'server_error',
];

export const CIRCUIT_BREAKER_STATES: CircuitBreakerState[] = ['closed', 'open', 'half_open'];

export const RETRY_POLICIES: RetryPolicyType[] = ['fixed', 'exponential', 'linear'];

export const FALLBACK_STRATEGIES: FallbackStrategy[] = ['cache', 'default', 'queue', 'graceful'];

export const ERROR_SEVERITIES: ErrorSeverity[] = ['low', 'medium', 'high', 'critical'];

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  policy: 'exponential',
};

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeoutMs: 60000,
  halfOpenMaxAttempts: 3,
};

export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  strategy: 'graceful',
  gracefulTimeoutMs: 3000,
};

export const DEFAULT_ERROR_HANDLER_CONFIG: ErrorHandlerConfig = {
  enableRetry: true,
  enableCircuitBreaker: true,
  enableFallback: true,
  enableErrorTracking: true,
  enableNotifications: false,
  maxErrorsStored: 1000,
};

export const ERROR_CODES = {
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  RETRY_EXHAUSTED: 'RETRY_EXHAUSTED',
  CIRCUIT_OPEN: 'CIRCUIT_OPEN',
  FALLBACK_FAILED: 'FALLBACK_FAILED',
  CACHE_ERROR: 'CACHE_ERROR',
  QUEUE_ERROR: 'QUEUE_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
} as const;

export function generateErrorId(prefix: string = 'ERR'): string {
  const timestamp = Date.now().toString(36);
  const random = globalThis.crypto.randomUUID?.().replace(/-/g, '').substring(0, 16) || Math.random().toString(36).substring(2, 18);
  return `${prefix}_${timestamp}${random}`;
}

export function isErrorCategory(value: unknown): value is ErrorCategory {
  return typeof value === 'string' && ERROR_CATEGORIES.includes(value as ErrorCategory);
}

export function isCircuitBreakerState(value: unknown): value is CircuitBreakerState {
  return typeof value === 'string' && CIRCUIT_BREAKER_STATES.includes(value as CircuitBreakerState);
}

export function isRetryPolicyType(value: unknown): value is RetryPolicyType {
  return typeof value === 'string' && RETRY_POLICIES.includes(value as RetryPolicyType);
}

export function isFallbackStrategy(value: unknown): value is FallbackStrategy {
  return typeof value === 'string' && FALLBACK_STRATEGIES.includes(value as FallbackStrategy);
}

export function isErrorSeverity(value: unknown): value is ErrorSeverity {
  return typeof value === 'string' && ERROR_SEVERITIES.includes(value as ErrorSeverity);
}

export function categorizeError(error: Error | AppError): ErrorCategory {
  const isAppError = 'category' in error && 'code' in error;
  const message = error.message.toLowerCase();
  const name = isAppError ? (error as AppError).code : error.name;

  if (message.includes('network') || message.includes('timeout') || message.includes('connection') || name.includes('NETWORK')) {
    return 'network';
  }
  if (message.includes('validation') || message.includes('invalid') || message.includes('schema') || name.includes('VALIDATION')) {
    return 'validation';
  }
  if (message.includes('auth') || message.includes('login') || message.includes('credential') || name.includes('AUTH')) {
    return 'authentication';
  }
  if (message.includes('permission') || message.includes('forbidden') || message.includes('access') || name.includes('AUTHORIZATION')) {
    return 'authorization';
  }
  if (message.includes('not found') || message.includes('404') || message.includes('does not exist') || name.includes('NOT_FOUND')) {
    return 'not_found';
  }
  if (message.includes('server') || message.includes('internal') || message.includes('500') || name.includes('SERVER')) {
    return 'server_error';
  }

  return 'server_error';
}

export function isRetryableError(error: AppError, config: RetryConfig): boolean {
  if (error.category === 'validation' || error.category === 'authentication' || error.category === 'authorization') {
    return false;
  }

  if (config.nonRetryableErrors?.includes(error.category)) {
    return false;
  }

  if (config.retryableErrors?.includes(error.category)) {
    return true;
  }

  return error.retryable;
}

export function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  switch (config.policy) {
    case 'fixed':
      return config.initialDelayMs;
    case 'exponential':
      return Math.min(config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1), config.maxDelayMs);
    case 'linear':
      return Math.min(config.initialDelayMs * attempt, config.maxDelayMs);
    default:
      return config.initialDelayMs;
  }
}

export function serializeAppError(error: AppError): Record<string, unknown> {
  return {
    ...error,
    context: {
      ...error.context,
      timestamp: error.context.timestamp.toISOString(),
    },
    originalError: error.originalError ? {
      name: error.originalError.name,
      message: error.originalError.message,
      stack: error.originalError.stack,
    } : undefined,
  };
}

export function deserializeAppError(data: Record<string, unknown>): AppError {
  const context = data.context as Record<string, unknown>;
  return {
    ...data,
    context: {
      ...context,
      timestamp: new Date(context.timestamp as string),
    },
  } as AppError;
}

export function formatErrorMessage(error: AppError): string {
  let message = `[${error.id}] ${error.category.toUpperCase()} ${error.code}: ${error.message}`;
  
  if (error.context.correlationId) {
    message += ` [corr:${error.context.correlationId}]`;
  }
  
  if (error.context.source) {
    message += ` [source:${error.context.source}]`;
  }
  
  if (error.details && Object.keys(error.details).length > 0) {
    message += ` ${JSON.stringify(error.details)}`;
  }
  
  if (error.stack) {
    message += `\n${error.stack}`;
  }
  
  return message;
}

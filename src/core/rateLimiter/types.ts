/**
 * API Rate Limiting & Throttling Types
 */

export type RateLimitAlgorithm = 'token_bucket' | 'sliding_window' | 'fixed_window';

export interface RateLimitConfig {
  algorithm: RateLimitAlgorithm;
  maxRequests: number;
  windowSizeMs: number;
  burstCapacity?: number;
}

export interface RateLimitKey {
  type: 'user' | 'endpoint' | 'ip' | 'custom';
  identifier: string;
  endpoint?: string;
}

export interface RateLimitEntry {
  key: string;
  count: number;
  remaining: number;
  resetAt: Date;
  algorithm: RateLimitAlgorithm;
  metadata?: Record<string, unknown>;
}

export interface TokenBucketState {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRate: number;
}

export interface SlidingWindowState {
  timestamps: number[];
  windowSizeMs: number;
  maxRequests: number;
}

export interface FixedWindowState {
  count: number;
  windowStart: number;
  windowSizeMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfterMs?: number;
  algorithm: RateLimitAlgorithm;
  requestId: string;
}

export interface RateLimitError extends Error {
  statusCode: 429;
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfterMs: number;
  errorCode: 'RATE_LIMIT_EXCEEDED';
}

export interface RateLimitContext {
  userId?: string;
  endpoint: string;
  ip?: string;
  method?: string;
  headers?: Record<string, string>;
  customKeys?: Record<string, string>;
}

export interface KeyGenerator {
  (context: RateLimitContext): string;
}

export interface DistributedLock {
  acquire(key: string, ttlMs: number): Promise<boolean>;
  release(key: string): Promise<void>;
}

export interface StorageBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
  increment(key: string, ttlMs?: number): Promise<number>;
  getMulti(keys: string[]): Promise<Array<string | null>>;
  setMulti(entries: Array<{ key: string; value: string; ttlMs?: number }>): Promise<void>;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export interface RateLimiterOptions {
  config: RateLimitConfig;
  storage?: StorageBackend;
  lock?: DistributedLock;
  keyGenerator?: KeyGenerator;
  onLimitExceeded?: (context: RateLimitContext, result: RateLimitResult) => void;
  onRequestAllowed?: (context: RateLimitContext, result: RateLimitResult) => void;
}

export interface ThrottleConfig {
  maxConcurrentRequests: number;
  maxQueueSize: number;
  queueTimeoutMs: number;
  backpressureThreshold: number;
}

export interface ThrottleResult {
  allowed: boolean;
  queuePosition?: number;
  estimatedWaitMs?: number;
  concurrentRequests: number;
}

export interface BackpressureEvent {
  type: 'pressure_high' | 'pressure_normal' | 'pressure_critical';
  timestamp: Date;
  metrics: {
    concurrentRequests: number;
    queueSize: number;
    rejectionRate: number;
  };
}

export interface RateLimitMetrics {
  totalRequests: number;
  allowedRequests: number;
  rejectedRequests: number;
  averageLatencyMs: number;
  currentRate: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface HealthCheckResult {
  healthy: boolean;
  storageConnected: boolean;
  latencyMs: number;
  errors: string[];
}

export const ALGORITHM_NAMES: Record<RateLimitAlgorithm, string> = {
  token_bucket: 'Token Bucket',
  sliding_window: 'Sliding Window',
  fixed_window: 'Fixed Window',
};

export const DEFAULT_CONFIG: RateLimitConfig = {
  algorithm: 'sliding_window',
  maxRequests: 100,
  windowSizeMs: 60000,
  burstCapacity: 150,
};

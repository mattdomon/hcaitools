/**
 * Cache Management System Types
 */

export type TTLPolicy = 'fixed' | 'sliding' | 'lazy';

export type InvalidationStrategy = 'manual' | 'ttl' | 'pattern' | 'all';

export type CacheStorageType = 'memory' | 'redis';

export interface CacheConfig {
  storageType: CacheStorageType;
  defaultTTLMs: number;
  ttlPolicy: TTLPolicy;
  maxSize?: number;
  evictionPolicy?: EvictionPolicy;
  keyPrefix?: string;
}

export type EvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'ttl';

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  createdAt: number;
  lastAccessedAt: number;
  expiresAt?: number;
  accessCount: number;
  size?: number;
  metadata?: Record<string, unknown>;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  expirations: number;
  setOperations: number;
  deleteOperations: number;
  totalKeys: number;
  hitRate: number;
  missRate: number;
  averageTTLMs: number;
  totalMemoryBytes?: number;
  startTime: Date;
  lastResetTime: Date;
}

export interface CacheMetrics {
  currentSize: number;
  maxSize?: number;
  itemCount: number;
  hitRate: number;
  memoryUsageBytes?: number;
  uptime: number;
}

export interface CacheOptions<T = unknown> {
  ttlMs?: number;
  ttlPolicy?: TTLPolicy;
  tags?: string[];
  metadata?: Record<string, unknown>;
  bypassCache?: boolean;
  refreshAhead?: boolean;
  onExpired?: (key: string, value: T) => void;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  connectTimeout?: number;
  commandTimeout?: number;
  retryStrategy?: (attempts: number) => number | null;
}

export interface DistributedLock {
  acquire(key: string, ttlMs: number): Promise<boolean>;
  release(key: string): Promise<void>;
  extend(key: string, ttlMs: number): Promise<boolean>;
}

export interface CacheBackend {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  keys(pattern?: string): Promise<string[]>;
  getMulti<T = unknown>(keys: string[]): Promise<Array<T | null>>;
  setMulti<T = unknown>(entries: Array<{ key: string; value: T; ttlMs?: number }>): Promise<void>;
  deleteMulti(keys: string[]): Promise<number>;
  clear(): Promise<void>;
  expire(key: string, ttlMs: number): Promise<boolean>;
  ttl(key: string): Promise<number>;
  size(): Promise<number>;
}

export interface CacheWarmerOptions {
  keys: string[];
  loader: (key: string) => Promise<unknown>;
  parallel?: boolean;
  maxConcurrency?: number;
  ttlMs?: number;
}

export interface CachePreloaderOptions {
  initialData: Array<{ key: string; value: unknown; ttlMs?: number }>;
  replaceExisting?: boolean;
}

export interface CacheAsideOptions<T = unknown> {
  key: string;
  loader: () => Promise<T>;
  options?: CacheOptions<T>;
}

export interface CacheEvent<T = unknown> {
  type: 'hit' | 'miss' | 'set' | 'delete' | 'expire' | 'evict' | 'clear';
  key: string;
  value?: T;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface CacheEventEmitter {
  on<T = unknown>(event: CacheEvent<T>['type'], handler: (event: CacheEvent<T>) => void): void;
  off<T = unknown>(event: CacheEvent<T>['type'], handler: (event: CacheEvent<T>) => void): void;
  emit<T = unknown>(event: CacheEvent<T>): void;
}

export interface PatternInvalidationOptions {
  pattern: string;
  regex?: boolean;
}

export interface BulkInvalidationResult {
  deletedCount: number;
  failedKeys: string[];
}

export interface HealthCheckResult {
  healthy: boolean;
  storageConnected: boolean;
  latencyMs: number;
  errors: string[];
  memoryUsageBytes?: number;
}

export interface SerializedCacheEntry<T = unknown> {
  key: string;
  value: T;
  createdAt: string;
  lastAccessedAt: string;
  expiresAt?: string;
  accessCount: number;
  size?: number;
  metadata?: Record<string, unknown>;
}

export interface CacheSnapshot<T = unknown> {
  entries: SerializedCacheEntry<T>[];
  stats: CacheStats;
  timestamp: Date;
  version: string;
}

export interface DistributedCacheOptions extends CacheConfig {
  redis: RedisConfig;
  lock?: DistributedLock;
  lockTimeoutMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export interface LocalCacheOptions extends CacheConfig {
  cleanupIntervalMs?: number;
  compactionThreshold?: number;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  storageType: 'memory',
  defaultTTLMs: 300000,
  ttlPolicy: 'fixed',
  maxSize: 10000,
  evictionPolicy: 'lru',
  keyPrefix: 'cache:',
};

export const DEFAULT_REDIS_CONFIG: RedisConfig = {
  host: 'localhost',
  port: 6379,
  keyPrefix: 'cache:',
  connectTimeout: 5000,
  commandTimeout: 1000,
};

export const CACHE_ERROR_CODES = {
  KEY_NOT_FOUND: 'CACHE_KEY_NOT_FOUND',
  OPERATION_FAILED: 'CACHE_OPERATION_FAILED',
  SERIALIZATION_ERROR: 'CACHE_SERIALIZATION_ERROR',
  DESERIALIZATION_ERROR: 'CACHE_DESERIALIZATION_ERROR',
  STORAGE_ERROR: 'CACHE_STORAGE_ERROR',
  LOCK_ACQUISITION_FAILED: 'CACHE_LOCK_ACQUISITION_FAILED',
  INVALID_CONFIG: 'CACHE_INVALID_CONFIG',
} as const;

export interface CacheError extends Error {
  code: (typeof CACHE_ERROR_CODES)[keyof typeof CACHE_ERROR_CODES];
  key?: string;
  originalError?: Error;
}

export type CacheSerializer<T = unknown> = {
  serialize: (value: T) => string;
  deserialize: (value: string) => T;
};

export interface SerializerOptions {
  encoding?: 'json' | 'msgpack' | 'protobuf';
}

export function createJSONSerializer<T = unknown>(): CacheSerializer<T> {
  return {
    serialize: (value: T) => JSON.stringify(value),
    deserialize: (value: string) => JSON.parse(value) as T,
  };
}

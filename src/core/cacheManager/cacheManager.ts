import {
  CacheConfig,
  CacheEntry,
  CacheStats,
  CacheOptions,
  CacheBackend,
  CacheWarmerOptions,
  CacheEvent,
  CacheEventEmitter,
  DistributedLock,
  RedisConfig,
  BulkInvalidationResult,
  HealthCheckResult,
  CacheSnapshot,
  SerializedCacheEntry,
  DistributedCacheOptions,
  LocalCacheOptions,
  DEFAULT_CACHE_CONFIG,
  EvictionPolicy,
} from './types';

type CacheEventHandler<T = unknown> = (event: CacheEvent<T>) => void;

export class SimpleEventEmitter implements CacheEventEmitter {
  private handlers: Map<string, Set<CacheEventHandler>> = new Map();

  on<T = unknown>(event: CacheEvent<T>['type'], handler: CacheEventHandler<T>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as CacheEventHandler);
  }

  off<T = unknown>(event: CacheEvent<T>['type'], handler: CacheEventHandler<T>): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler as CacheEventHandler);
    }
  }

  emit<T = unknown>(event: CacheEvent<T>): void {
    const eventHandlers = this.handlers.get(event.type);
    if (eventHandlers) {
      eventHandlers.forEach((handler) => handler(event));
    }
  }

  removeAllListeners(): void {
    this.handlers.clear();
  }
}

export class SimpleLock implements DistributedLock {
  private locks: Map<string, { expiresAt: number }> = new Map();

  async acquire(key: string, ttlMs: number): Promise<boolean> {
    const now = Date.now();
    const existing = this.locks.get(key);

    if (existing && existing.expiresAt > now) {
      return false;
    }

    this.locks.set(key, { expiresAt: now + ttlMs });
    return true;
  }

  async release(key: string): Promise<void> {
    this.locks.delete(key);
  }

  async extend(key: string, ttlMs: number): Promise<boolean> {
    const existing = this.locks.get(key);
    if (!existing || existing.expiresAt <= Date.now()) {
      return false;
    }

    existing.expiresAt = Date.now() + ttlMs;
    return true;
  }
}

export class InMemoryCacheBackend implements CacheBackend {
  private store: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = [];

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      this.removeFromAccessOrder(key);
      return null;
    }

    entry.lastAccessedAt = Date.now();
    entry.accessCount++;
    this.moveToEndOfAccessOrder(key);

    return entry.value as T;
  }

  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: ttlMs ? now + ttlMs : undefined,
      accessCount: 0,
    };

    this.store.set(key, entry);
    this.addToAccessOrder(key);
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.store.delete(key);
    if (deleted) {
      this.removeFromAccessOrder(key);
    }
    return deleted;
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      this.removeFromAccessOrder(key);
      return false;
    }

    return true;
  }

  async keys(pattern?: string): Promise<string[]> {
    const now = Date.now();
    const allKeys = Array.from(this.store.keys());

    if (!pattern) {
      return allKeys.filter((key) => {
        const entry = this.store.get(key);
        if (entry?.expiresAt && entry.expiresAt < now) {
          this.store.delete(key);
          this.removeFromAccessOrder(key);
          return false;
        }
        return true;
      });
    }

    const regex = this.patternToRegex(pattern);
    return allKeys.filter((key) => {
      if (!regex.test(key)) return false;
      const entry = this.store.get(key);
      if (entry?.expiresAt && entry.expiresAt < now) {
        this.store.delete(key);
        this.removeFromAccessOrder(key);
        return false;
      }
      return true;
    });
  }

  async getMulti<T = unknown>(keys: string[]): Promise<Array<T | null>> {
    const results: Array<T | null> = [];
    for (const key of keys) {
      results.push(await this.get<T>(key));
    }
    return results;
  }

  async setMulti<T = unknown>(
    entries: Array<{ key: string; value: T; ttlMs?: number }>
  ): Promise<void> {
    for (const { key, value, ttlMs } of entries) {
      await this.set(key, value, ttlMs);
    }
  }

  async deleteMulti(keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (await this.delete(key)) {
        deleted++;
      }
    }
    return deleted;
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.accessOrder = [];
  }

  async expire(key: string, ttlMs: number): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;

    entry.expiresAt = Date.now() + ttlMs;
    return true;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry || !entry.expiresAt) return -1;

    const remaining = entry.expiresAt - Date.now();
    return remaining > 0 ? remaining : -2;
  }

  async size(): Promise<number> {
    await this.keys();
    return this.store.size;
  }

  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
  }

  private addToAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private moveToEndOfAccessOrder(key: string): void {
    this.addToAccessOrder(key);
  }

  getLRUKey(): string | null {
    return this.accessOrder.length > 0 ? this.accessOrder[0] : null;
  }

  getAllEntries(): Map<string, CacheEntry> {
    return new Map(this.store);
  }
}

interface EvictionPolicyHandler {
  evict(count: number): Promise<string[]>;
}

export class LRUEvictionPolicy implements EvictionPolicyHandler {
  constructor(private backend: InMemoryCacheBackend) {}

  async evict(count: number = 1): Promise<string[]> {
    const evicted: string[] = [];
    for (let i = 0; i < count; i++) {
      const key = this.backend.getLRUKey();
      if (key) {
        await this.backend.delete(key);
        evicted.push(key);
      }
    }
    return evicted;
  }
}

export class LFUEvictionPolicy implements EvictionPolicyHandler {
  constructor(private backend: InMemoryCacheBackend) {}

  async evict(count: number = 1): Promise<string[]> {
    const entries = this.backend.getAllEntries();
    const sorted = Array.from(entries.entries()).sort((a, b) => a[1].accessCount - b[1].accessCount);
    const evicted: string[] = [];

    for (let i = 0; i < Math.min(count, sorted.length); i++) {
      await this.backend.delete(sorted[i][0]);
      evicted.push(sorted[i][0]);
    }

    return evicted;
  }
}

export class FIFOEvictionPolicy implements EvictionPolicyHandler {
  constructor(private backend: InMemoryCacheBackend) {}

  async evict(count: number = 1): Promise<string[]> {
    const entries = this.backend.getAllEntries();
    const sorted = Array.from(entries.entries()).sort((a, b) => a[1].createdAt - b[1].createdAt);
    const evicted: string[] = [];

    for (let i = 0; i < Math.min(count, sorted.length); i++) {
      await this.backend.delete(sorted[i][0]);
      evicted.push(sorted[i][0]);
    }

    return evicted;
  }
}

export class TTLEvictionPolicy implements EvictionPolicyHandler {
  constructor(private backend: InMemoryCacheBackend) {}

  async evict(count: number = 1): Promise<string[]> {
    const entries = this.backend.getAllEntries();
    const now = Date.now();
    const expired = Array.from(entries.entries())
      .filter(([, entry]) => entry.expiresAt !== undefined && entry.expiresAt <= now)
      .sort((a, b) => (a[1].expiresAt || 0) - (b[1].expiresAt || 0));

    const evicted: string[] = [];

    for (let i = 0; i < Math.min(count, expired.length); i++) {
      await this.backend.delete(expired[i][0]);
      evicted.push(expired[i][0]);
    }

    return evicted;
  }
}

export interface ICacheStore {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, options?: CacheOptions<T>): Promise<void>;
  setMulti<T = unknown>(entries: Array<{ key: string; value: T; ttlMs?: number }>): Promise<void>;
  getMulti<T = unknown>(keys: string[]): Promise<Array<T | null>>;
  deleteMulti(keys: string[]): Promise<number>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  keys(pattern?: string): Promise<string[]>;
  clear(): Promise<void>;
  expire(key: string, ttlMs: number): Promise<boolean>;
  ttl(key: string): Promise<number>;
  size(): Promise<number>;
  invalidatePattern(pattern: string): Promise<BulkInvalidationResult>;
  warmCache(options: CacheWarmerOptions): Promise<Map<string, unknown>>;
  preloadCache(data: Array<{ key: string; value: unknown; ttlMs?: number }>, replace?: boolean): Promise<void>;
  getOrLoad<T>(key: string, loader: () => Promise<T>, options?: CacheOptions<T>): Promise<T>;
  getStats(): CacheStats;
  resetStats(): void;
  snapshot(): Promise<CacheSnapshot>;
  restore(snapshot: CacheSnapshot): Promise<void>;
  healthCheck(): Promise<HealthCheckResult>;
  on<T = unknown>(event: CacheEvent<T>['type'], handler: (event: CacheEvent<T>) => void): void;
  off<T = unknown>(event: CacheEvent<T>['type'], handler: (event: CacheEvent<T>) => void): void;
  destroy(): void;
  evict(count: number): Promise<string[]>;
}

export class InMemoryCacheStore implements ICacheStore {
  private backend: InMemoryCacheBackend;
  private stats: CacheStats;
  private eventEmitter: SimpleEventEmitter;
  private config: CacheConfig & LocalCacheOptions;
  private evictionPolicies: Map<EvictionPolicy, EvictionPolicyHandler>;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: Partial<CacheConfig & LocalCacheOptions> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config } as CacheConfig & LocalCacheOptions;
    this.backend = new InMemoryCacheBackend();
    this.eventEmitter = new SimpleEventEmitter();
    this.stats = this.createInitialStats();
    this.evictionPolicies = new Map();
    this.initializeEvictionPolicies();

    if (this.config.cleanupIntervalMs) {
      this.startCleanupInterval();
    }
  }

  private createInitialStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
      setOperations: 0,
      deleteOperations: 0,
      totalKeys: 0,
      hitRate: 0,
      missRate: 0,
      averageTTLMs: 0,
      startTime: new Date(),
      lastResetTime: new Date(),
    };
  }

  private initializeEvictionPolicies(): void {
    this.evictionPolicies.set('lru', new LRUEvictionPolicy(this.backend));
    this.evictionPolicies.set('lfu', new LFUEvictionPolicy(this.backend));
    this.evictionPolicies.set('fifo', new FIFOEvictionPolicy(this.backend));
    this.evictionPolicies.set('ttl', new TTLEvictionPolicy(this.backend));
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs || 60000);
  }

  private async cleanup(): Promise<void> {
    const keys = await this.backend.keys();
    const now = Date.now();
    let expired = 0;

    for (const key of keys) {
      const entry = this.backend.getAllEntries().get(key);
      if (entry?.expiresAt && entry.expiresAt < now) {
        await this.backend.delete(key);
        expired++;
      }
    }

    if (expired > 0) {
      this.stats.expirations += expired;
      this.emitEvent('clear', 'cleanup');
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const value = await this.backend.get<T>(key);

    if (value !== null) {
      this.stats.hits++;
      this.stats.totalKeys = await this.backend.size();
      this.updateRates();
      this.emitEvent('hit', key, value);
      return value;
    }

    this.stats.misses++;
    this.stats.totalKeys = await this.backend.size();
    this.updateRates();
    this.emitEvent('miss', key);
    return null;
  }

  async set<T = unknown>(key: string, value: T, options?: CacheOptions<T>): Promise<void> {
    if (this.config.maxSize) {
      const currentSize = await this.backend.size();
      if (currentSize >= this.config.maxSize) {
        await this.evict(1);
      }
    }

    const ttlMs = options?.ttlMs ?? this.config.defaultTTLMs;
    await this.backend.set(key, value, ttlMs);

    this.stats.setOperations++;
    this.stats.totalKeys = await this.backend.size();
    this.emitEvent('set', key, value);
  }

  async setMulti<T = unknown>(entries: Array<{ key: string; value: T; ttlMs?: number }>): Promise<void> {
    for (const { key, value, ttlMs } of entries) {
      await this.backend.set(key, value, ttlMs);
    }
    this.stats.setOperations += entries.length;
    this.stats.totalKeys = await this.backend.size();
  }

  async getMulti<T = unknown>(keys: string[]): Promise<Array<T | null>> {
    return this.backend.getMulti<T>(keys);
  }

  async deleteMulti(keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (await this.delete(key)) {
        deleted++;
      }
    }
    return deleted;
  }

  async delete(key: string): Promise<boolean> {
    const deleted = await this.backend.delete(key);
    if (deleted) {
      this.stats.deleteOperations++;
      this.stats.totalKeys = await this.backend.size();
      this.emitEvent('delete', key);
    }
    return deleted;
  }

  async exists(key: string): Promise<boolean> {
    return this.backend.exists(key);
  }

  async keys(pattern?: string): Promise<string[]> {
    return this.backend.keys(pattern);
  }

  async clear(): Promise<void> {
    await this.backend.clear();
    this.stats.totalKeys = 0;
    this.emitEvent('clear', 'all');
  }

  async expire(key: string, ttlMs: number): Promise<boolean> {
    return this.backend.expire(key, ttlMs);
  }

  async ttl(key: string): Promise<number> {
    return this.backend.ttl(key);
  }

  async size(): Promise<number> {
    return this.backend.size();
  }

  async evict(count: number = 1): Promise<string[]> {
    const policy = this.evictionPolicies.get(this.config.evictionPolicy || 'lru');
    if (!policy) {
      return [];
    }

    const evicted = await policy.evict(count);
    this.stats.evictions += evicted.length;
    this.stats.totalKeys = await this.backend.size();

    for (const key of evicted) {
      this.emitEvent('evict', key);
    }

    return evicted;
  }

  async invalidatePattern(pattern: string): Promise<BulkInvalidationResult> {
    const keys = await this.backend.keys(pattern);
    let deletedCount = 0;
    const failedKeys: string[] = [];

    for (const key of keys) {
      try {
        if (await this.backend.delete(key)) {
          deletedCount++;
        }
      } catch {
        failedKeys.push(key);
      }
    }

    this.stats.totalKeys = await this.backend.size();
    return { deletedCount, failedKeys };
  }

  async warmCache(options: CacheWarmerOptions): Promise<Map<string, unknown>> {
    const results = new Map<string, unknown>();
    const keys = options.keys;
    const concurrency = options.maxConcurrency || 5;

    if (options.parallel === false) {
      for (const key of keys) {
        try {
          const value = await options.loader(key);
          await this.set(key, value, { ttlMs: options.ttlMs });
          results.set(key, value);
        } catch {
          // Skip failed keys
        }
      }
    } else {
      const chunks: string[][] = [];
      for (let i = 0; i < keys.length; i += concurrency) {
        chunks.push(keys.slice(i, i + concurrency));
      }

      for (const chunk of chunks) {
        const promises = chunk.map(async (key) => {
          try {
            const value = await options.loader(key);
            await this.set(key, value, { ttlMs: options.ttlMs });
            return { key, value };
          } catch {
            return { key, value: null };
          }
        });

        const chunkResults = await Promise.all(promises);
        for (const { key, value } of chunkResults) {
          if (value !== null) {
            results.set(key, value);
          }
        }
      }
    }

    return results;
  }

  async preloadCache(
    data: Array<{ key: string; value: unknown; ttlMs?: number }>,
    replace: boolean = false
  ): Promise<void> {
    for (const { key, value, ttlMs } of data) {
      if (replace || !(await this.exists(key))) {
        await this.set(key, value, { ttlMs });
      }
    }
  }

  async getOrLoad<T>(key: string, loader: () => Promise<T>, options?: CacheOptions<T>): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const value = await loader();
    await this.set(key, value, options);
    return value;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = this.createInitialStats();
  }

  getEventEmitter(): SimpleEventEmitter {
    return this.eventEmitter;
  }

  on<T = unknown>(event: CacheEvent<T>['type'], handler: (event: CacheEvent<T>) => void): void {
    this.eventEmitter.on(event, handler);
  }

  off<T = unknown>(event: CacheEvent<T>['type'], handler: (event: CacheEvent<T>) => void): void {
    this.eventEmitter.off(event, handler);
  }

  private emitEvent<T = unknown>(type: CacheEvent<T>['type'], key: string, value?: T): void {
    this.eventEmitter.emit({
      type,
      key,
      value,
      timestamp: new Date(),
    });
  }

  private updateRates(): void {
    const total = this.stats.hits + this.stats.misses;
    if (total > 0) {
      this.stats.hitRate = this.stats.hits / total;
      this.stats.missRate = this.stats.misses / total;
    }
  }

  async snapshot(): Promise<CacheSnapshot> {
    const entries: SerializedCacheEntry[] = [];
    const allEntries = this.backend.getAllEntries();

    for (const [key, entry] of allEntries) {
      entries.push({
        key,
        value: entry.value,
        createdAt: new Date(entry.createdAt).toISOString(),
        lastAccessedAt: new Date(entry.lastAccessedAt).toISOString(),
        expiresAt: entry.expiresAt ? new Date(entry.expiresAt).toISOString() : undefined,
        accessCount: entry.accessCount,
        size: entry.size,
        metadata: entry.metadata,
      });
    }

    return {
      entries,
      stats: this.getStats(),
      timestamp: new Date(),
      version: '1.0.0',
    };
  }

  async restore(snapshot: CacheSnapshot): Promise<void> {
    await this.clear();

    for (const entry of snapshot.entries) {
      const ttlMs = entry.expiresAt
        ? new Date(entry.expiresAt).getTime() - Date.now()
        : undefined;

      await this.backend.set(entry.key, entry.value, ttlMs);
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const start = Date.now();
      await this.backend.get('__health_check__');
      const latencyMs = Date.now() - start;

      return {
        healthy: true,
        storageConnected: true,
        latencyMs,
        errors: [],
      };
    } catch (error) {
      return {
        healthy: false,
        storageConnected: false,
        latencyMs: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.eventEmitter.removeAllListeners();
  }
}

export class RedisCacheBackend implements CacheBackend {
  private config: RedisConfig;
  private client: Map<string, unknown>;
  private lock: SimpleLock;
  private keyPrefix: string;

  constructor(config: RedisConfig) {
    this.config = config;
    this.client = new Map();
    this.lock = new SimpleLock();
    this.keyPrefix = config.keyPrefix || 'cache:';
  }

  private prefixedKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get<T = unknown>(_key: string): Promise<T | null> {
    return null;
  }

  async set<T = unknown>(_key: string, _value: T, _ttlMs?: number): Promise<void> {
    // Redis implementation placeholder
  }

  async delete(_key: string): Promise<boolean> {
    return false;
  }

  async exists(_key: string): Promise<boolean> {
    return false;
  }

  async keys(_pattern?: string): Promise<string[]> {
    return [];
  }

  async getMulti<T = unknown>(_keys: string[]): Promise<Array<T | null>> {
    return [];
  }

  async setMulti<T = unknown>(_entries: Array<{ key: string; value: T; ttlMs?: number }>): Promise<void> {
    // Redis implementation placeholder
  }

  async deleteMulti(_keys: string[]): Promise<number> {
    return 0;
  }

  async clear(): Promise<void> {
    this.client.clear();
  }

  async expire(_key: string, _ttlMs: number): Promise<boolean> {
    return false;
  }

  async ttl(_key: string): Promise<number> {
    return -1;
  }

  async size(): Promise<number> {
    return this.client.size;
  }

  async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    return this.lock.acquire(this.prefixedKey(key), ttlMs);
  }

  async releaseLock(key: string): Promise<void> {
    return this.lock.release(this.prefixedKey(key));
  }

  async extendLock(key: string, ttlMs: number): Promise<boolean> {
    return this.lock.extend(this.prefixedKey(key), ttlMs);
  }
}

export class DistributedCacheStore implements ICacheStore {
  private localCache: InMemoryCacheStore;
  private redis: RedisCacheBackend;
  private config: DistributedCacheOptions;
  private lock: DistributedLock;
  private lockTimeoutMs: number;

  constructor(config: DistributedCacheOptions) {
    this.config = config;
    this.localCache = new InMemoryCacheStore({
      storageType: 'memory',
      defaultTTLMs: config.defaultTTLMs,
      ttlPolicy: config.ttlPolicy,
      maxSize: config.maxSize,
      evictionPolicy: config.evictionPolicy,
    });
    this.redis = new RedisCacheBackend(config.redis);
    this.lock = config.lock || new SimpleLock();
    this.lockTimeoutMs = config.lockTimeoutMs || 5000;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const localValue = await this.localCache.get<T>(key);
    if (localValue !== null) {
      return localValue;
    }

    const redisValue = await this.redis.get<T>(key);
    if (redisValue !== null) {
      await this.localCache.set(key, redisValue);
      return redisValue;
    }

    return null;
  }

  async set<T = unknown>(key: string, value: T, options?: CacheOptions<T>): Promise<void> {
    await this.redis.set(key, value, options?.ttlMs);
    await this.localCache.set(key, value, options);
  }

  async setMulti<T = unknown>(entries: Array<{ key: string; value: T; ttlMs?: number }>): Promise<void> {
    await this.redis.setMulti(entries);
    await this.localCache.setMulti(entries);
  }

  async getMulti<T = unknown>(keys: string[]): Promise<Array<T | null>> {
    return this.localCache.getMulti<T>(keys);
  }

  async deleteMulti(keys: string[]): Promise<number> {
    await this.localCache.deleteMulti(keys);
    return this.redis.deleteMulti(keys);
  }

  async delete(key: string): Promise<boolean> {
    await this.localCache.delete(key);
    return this.redis.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.localCache.exists(key);
  }

  async keys(pattern?: string): Promise<string[]> {
    return this.localCache.keys(pattern);
  }

  async clear(): Promise<void> {
    await this.localCache.clear();
    await this.redis.clear();
  }

  async expire(key: string, ttlMs: number): Promise<boolean> {
    return this.localCache.expire(key, ttlMs);
  }

  async ttl(key: string): Promise<number> {
    return this.localCache.ttl(key);
  }

  async size(): Promise<number> {
    return this.localCache.size();
  }

  async evict(_count: number = 1): Promise<string[]> {
    return [];
  }

  async invalidatePattern(pattern: string): Promise<BulkInvalidationResult> {
    const localResult = await this.localCache.invalidatePattern(pattern);
    const redisKeys = await this.redis.keys(pattern);
    const redisDeleted = await this.redis.deleteMulti(redisKeys);

    return {
      deletedCount: localResult.deletedCount + redisDeleted,
      failedKeys: [...localResult.failedKeys],
    };
  }

  async warmCache(options: CacheWarmerOptions): Promise<Map<string, unknown>> {
    return this.localCache.warmCache(options);
  }

  async preloadCache(
    data: Array<{ key: string; value: unknown; ttlMs?: number }>,
    replace?: boolean
  ): Promise<void> {
    await this.localCache.preloadCache(data, replace);
  }

  async getOrLoad<T>(key: string, loader: () => Promise<T>, options?: CacheOptions<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const lockKey = `lock_${key}`;
    const acquired = await this.lock.acquire(lockKey, this.lockTimeoutMs);

    if (!acquired) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const retryCached = await this.get<T>(key);
      if (retryCached !== null) {
        return retryCached;
      }
      return this.getOrLoad(key, loader, options);
    }

    try {
      const value = await loader();
      await this.set(key, value, options);
      return value;
    } finally {
      await this.lock.release(lockKey);
    }
  }

  getStats(): CacheStats {
    return this.localCache.getStats();
  }

  resetStats(): void {
    this.localCache.resetStats();
  }

  async snapshot(): Promise<CacheSnapshot> {
    return this.localCache.snapshot();
  }

  async restore(snapshot: CacheSnapshot): Promise<void> {
    await this.localCache.restore(snapshot);
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const localHealth = await this.localCache.healthCheck();

    return {
      healthy: localHealth.healthy,
      storageConnected: localHealth.storageConnected,
      latencyMs: localHealth.latencyMs,
      errors: localHealth.errors,
    };
  }

  on<T = unknown>(event: CacheEvent<T>['type'], handler: (event: CacheEvent<T>) => void): void {
    this.localCache.on(event, handler);
  }

  off<T = unknown>(event: CacheEvent<T>['type'], handler: (event: CacheEvent<T>) => void): void {
    this.localCache.off(event, handler);
  }

  destroy(): void {
    this.localCache.destroy();
  }
}

export class CacheManager {
  private store: ICacheStore;
  private config: CacheConfig;
  private eventEmitter: SimpleEventEmitter;

  constructor(config: Partial<CacheConfig & DistributedCacheOptions> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.eventEmitter = new SimpleEventEmitter();

    if (this.config.storageType === 'redis' && 'redis' in config) {
      this.store = new DistributedCacheStore(config as DistributedCacheOptions);
    } else {
      this.store = new InMemoryCacheStore(this.config as LocalCacheOptions);
    }

    const eventTypes: CacheEvent['type'][] = ['hit', 'miss', 'set', 'delete', 'expire', 'evict', 'clear'];
    for (const eventType of eventTypes) {
      this.store.on(eventType, (event: CacheEvent) => {
        this.eventEmitter.emit(event);
      });
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    return this.store.get<T>(key);
  }

  async set<T = unknown>(key: string, value: T, options?: CacheOptions<T>): Promise<void> {
    return this.store.set<T>(key, value, options);
  }

  async setMulti<T = unknown>(entries: Array<{ key: string; value: T; ttlMs?: number }>): Promise<void> {
    return this.store.setMulti<T>(entries);
  }

  async getMulti<T = unknown>(keys: string[]): Promise<Array<T | null>> {
    return this.store.getMulti<T>(keys);
  }

  async deleteMulti(keys: string[]): Promise<number> {
    return this.store.deleteMulti(keys);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.store.exists(key);
  }

  async keys(pattern?: string): Promise<string[]> {
    return this.store.keys(pattern);
  }

  async clear(): Promise<void> {
    return this.store.clear();
  }

  async expire(key: string, ttlMs: number): Promise<boolean> {
    return this.store.expire(key, ttlMs);
  }

  async ttl(key: string): Promise<number> {
    return this.store.ttl(key);
  }

  async size(): Promise<number> {
    return this.store.size();
  }

  async evict(count: number = 1): Promise<string[]> {
    return this.store.evict(count);
  }

  async invalidatePattern(pattern: string): Promise<BulkInvalidationResult> {
    return this.store.invalidatePattern(pattern);
  }

  async warmCache(options: CacheWarmerOptions): Promise<Map<string, unknown>> {
    return this.store.warmCache(options);
  }

  async preloadCache(data: Array<{ key: string; value: unknown; ttlMs?: number }>): Promise<void> {
    return this.store.preloadCache(data);
  }

  async getOrLoad<T>(key: string, loader: () => Promise<T>, options?: CacheOptions<T>): Promise<T> {
    return this.store.getOrLoad<T>(key, loader, options);
  }

  getStats(): CacheStats {
    return this.store.getStats();
  }

  resetStats(): void {
    this.store.resetStats();
  }

  async snapshot(): Promise<CacheSnapshot> {
    return this.store.snapshot();
  }

  async restore(snapshot: CacheSnapshot): Promise<void> {
    return this.store.restore(snapshot);
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return this.store.healthCheck();
  }

  on<T = unknown>(event: CacheEvent<T>['type'], handler: (event: CacheEvent<T>) => void): void {
    this.eventEmitter.on<T>(event, handler);
  }

  off<T = unknown>(event: CacheEvent<T>['type'], handler: (event: CacheEvent<T>) => void): void {
    this.eventEmitter.off<T>(event, handler);
  }

  destroy(): void {
    this.eventEmitter.removeAllListeners();
    this.store.destroy();
  }
}

export function createCacheManager(config?: Partial<CacheConfig>): CacheManager {
  return new CacheManager(config);
}

export function createLocalCacheManager(config?: Partial<LocalCacheOptions>): CacheManager {
  return new CacheManager({
    ...config,
    storageType: 'memory',
  } as CacheConfig);
}

export function createDistributedCacheManager(config: DistributedCacheOptions): CacheManager {
  return new CacheManager({
    ...config,
    storageType: 'redis',
  } as CacheConfig & DistributedCacheOptions);
}

import {
  CacheManager,
  createCacheManager,
  createLocalCacheManager,
  InMemoryCacheStore,
  InMemoryCacheBackend,
  SimpleLock,
  SimpleEventEmitter,
  LRUEvictionPolicy,
  LFUEvictionPolicy,
  FIFOEvictionPolicy,
  TTLEvictionPolicy,
  CacheConfig,
  CacheOptions,
  CacheWarmerOptions,
  CacheStats,
  CacheEvent,
  LocalCacheOptions,
  TTLPolicy,
  EvictionPolicy,
  BulkInvalidationResult,
  CacheSnapshot,
} from '../src/core/cacheManager';

describe('Cache Manager Module', () => {
  describe('InMemoryCacheBackend', () => {
    let backend: InMemoryCacheBackend;

    beforeEach(() => {
      backend = new InMemoryCacheBackend();
    });

    it('should store and retrieve a value', async () => {
      await backend.set('key1', 'value1');
      const result = await backend.get<string>('key1');
      expect(result).toBe('value1');
    });

    it('should return null for non-existent key', async () => {
      const result = await backend.get<string>('non_existent');
      expect(result).toBeNull();
    });

    it('should delete a value', async () => {
      await backend.set('key1', 'value1');
      const deleted = await backend.delete('key1');
      expect(deleted).toBe(true);
      const result = await backend.get<string>('key1');
      expect(result).toBeNull();
    });

    it('should check existence', async () => {
      await backend.set('key1', 'value1');
      const exists = await backend.exists('key1');
      expect(exists).toBe(true);
    });

    it('should set and get multiple values', async () => {
      await backend.setMulti([
        { key: 'k1', value: 'v1' },
        { key: 'k2', value: 'v2' },
      ]);
      const results = await backend.getMulti<string>(['k1', 'k2', 'k3']);
      expect(results).toEqual(['v1', 'v2', null]);
    });

    it('should delete multiple values', async () => {
      await backend.setMulti([
        { key: 'k1', value: 'v1' },
        { key: 'k2', value: 'v2' },
      ]);
      const deleted = await backend.deleteMulti(['k1', 'k2']);
      expect(deleted).toBe(2);
    });

    it('should clear all values', async () => {
      await backend.setMulti([
        { key: 'k1', value: 'v1' },
        { key: 'k2', value: 'v2' },
      ]);
      await backend.clear();
      const size = await backend.size();
      expect(size).toBe(0);
    });

    it('should set expiration with ttl', async () => {
      await backend.set('key1', 'value1', 1000);
      const exists = await backend.exists('key1');
      expect(exists).toBe(true);
    });

    it('should return ttl for key with expiration', async () => {
      await backend.set('key1', 'value1', 5000);
      const ttl = await backend.ttl('key1');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(5000);
    });

    it('should return -1 for key without expiration', async () => {
      await backend.set('key1', 'value1');
      const ttl = await backend.ttl('key1');
      expect(ttl).toBe(-1);
    });

    it('should get LRU key correctly', async () => {
      await backend.set('key1', 'value1');
      await backend.set('key2', 'value2');
      await backend.get('key1');
      const lruKey = backend.getLRUKey();
      expect(lruKey).toBe('key2');
    });

    it('should filter keys by pattern', async () => {
      await backend.setMulti([
        { key: 'user:1', value: 'v1' },
        { key: 'user:2', value: 'v2' },
        { key: 'post:1', value: 'v3' },
      ]);
      const keys = await backend.keys('user:*');
      expect(keys).toContain('user:1');
      expect(keys).toContain('user:2');
      expect(keys).not.toContain('post:1');
    });
  });

  describe('SimpleLock', () => {
    let lock: SimpleLock;

    beforeEach(() => {
      lock = new SimpleLock();
    });

    it('should acquire an unlocked key', async () => {
      const acquired = await lock.acquire('lock1', 1000);
      expect(acquired).toBe(true);
    });

    it('should fail to acquire a locked key', async () => {
      await lock.acquire('lock1', 1000);
      const acquired = await lock.acquire('lock1', 1000);
      expect(acquired).toBe(false);
    });

    it('should release a lock', async () => {
      await lock.acquire('lock1', 1000);
      await lock.release('lock1');
      const acquired = await lock.acquire('lock1', 1000);
      expect(acquired).toBe(true);
    });

    it('should extend a valid lock', async () => {
      await lock.acquire('lock1', 1000);
      const extended = await lock.extend('lock1', 2000);
      expect(extended).toBe(true);
    });

    it('should not extend an expired lock', async () => {
      const extended = await lock.extend('lock1', 1000);
      expect(extended).toBe(false);
    });

    it('should handle multiple independent locks', async () => {
      await lock.acquire('lock1', 1000);
      await lock.acquire('lock2', 1000);
      const canReacquire1 = await lock.acquire('lock1', 1000);
      expect(canReacquire1).toBe(false);
    });
  });

  describe('SimpleEventEmitter', () => {
    let emitter: SimpleEventEmitter;

    beforeEach(() => {
      emitter = new SimpleEventEmitter();
    });

    it('should register and emit events', (done) => {
      emitter.on<number>('hit', (event) => {
        expect(event.type).toBe('hit');
        expect(event.key).toBe('test_key');
        done();
      });
      emitter.emit({ type: 'hit', key: 'test_key', timestamp: new Date() });
    });

    it('should unregister event handlers', () => {
      const handler = jest.fn();
      emitter.on('miss', handler);
      emitter.off('miss', handler);
      emitter.emit({ type: 'miss', key: 'test_key', timestamp: new Date() });
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle multiple handlers for same event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      emitter.on('set', handler1);
      emitter.on('set', handler2);
      emitter.emit({ type: 'set', key: 'test_key', timestamp: new Date() });
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should remove all listeners', () => {
      const handler = jest.fn();
      emitter.on('hit', handler);
      emitter.removeAllListeners();
      emitter.emit({ type: 'hit', key: 'test_key', timestamp: new Date() });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('InMemoryCacheStore', () => {
    let store: InMemoryCacheStore;

    beforeEach(() => {
      const config: LocalCacheOptions = {
        storageType: 'memory',
        defaultTTLMs: 5000,
        ttlPolicy: 'fixed',
        maxSize: 100,
        evictionPolicy: 'lru',
      };
      store = new InMemoryCacheStore(config);
    });

    afterEach(() => {
      store.destroy();
    });

    it('should get and set values', async () => {
      await store.set('key1', 'value1');
      const result = await store.get<string>('key1');
      expect(result).toBe('value1');
    });

    it('should return null for cache miss', async () => {
      const result = await store.get<string>('non_existent');
      expect(result).toBeNull();
    });

    it('should track hits and misses in stats', async () => {
      await store.set('key1', 'value1');
      await store.get<string>('key1');
      await store.get<string>('non_existent');
      const stats = store.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should delete values', async () => {
      await store.set('key1', 'value1');
      const deleted = await store.delete('key1');
      expect(deleted).toBe(true);
      const result = await store.get<string>('key1');
      expect(result).toBeNull();
    });

    it('should check existence', async () => {
      await store.set('key1', 'value1');
      const exists = await store.exists('key1');
      expect(exists).toBe(true);
    });

    it('should get all keys', async () => {
      await store.setMulti([
        { key: 'k1', value: 'v1' },
        { key: 'k2', value: 'v2' },
      ]);
      const keys = await store.keys();
      expect(keys).toContain('k1');
      expect(keys).toContain('k2');
    });

    it('should clear all values', async () => {
      await store.setMulti([
        { key: 'k1', value: 'v1' },
        { key: 'k2', value: 'v2' },
      ]);
      await store.clear();
      const size = await store.size();
      expect(size).toBe(0);
    });

    it('should set expiration', async () => {
      await store.set('key1', 'value1');
      const expired = await store.expire('key1', 1000);
      expect(expired).toBe(true);
      const ttl = await store.ttl('key1');
      expect(ttl).toBeGreaterThan(0);
    });

    it('should get size', async () => {
      await store.setMulti([
        { key: 'k1', value: 'v1' },
        { key: 'k2', value: 'v2' },
      ]);
      const size = await store.size();
      expect(size).toBe(2);
    });

    it('should evict entries when max size reached', async () => {
      const smallStore = new InMemoryCacheStore({
        storageType: 'memory',
        defaultTTLMs: 60000,
        ttlPolicy: 'fixed',
        maxSize: 2,
        evictionPolicy: 'lru',
      });

      await smallStore.set('k1', 'v1');
      await smallStore.set('k2', 'v2');
      await smallStore.set('k3', 'v3');

      const stats = smallStore.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
      smallStore.destroy();
    });

    it('should invalidate by pattern', async () => {
      await store.setMulti([
        { key: 'user:1', value: 'v1' },
        { key: 'user:2', value: 'v2' },
        { key: 'post:1', value: 'v3' },
      ]);
      const result = await store.invalidatePattern('user:*');
      expect(result.deletedCount).toBe(2);
      expect(await store.exists('post:1')).toBe(true);
    });

    it('should warm cache with loader', async () => {
      const loader = jest.fn().mockImplementation(async (key: string) => `loaded_${key}`);
      const result = await store.warmCache({
        keys: ['key1', 'key2'],
        loader,
        parallel: false,
      });
      expect(loader).toHaveBeenCalledTimes(2);
      expect(result.get('key1')).toBe('loaded_key1');
      expect(result.get('key2')).toBe('loaded_key2');
    });

    it('should preload cache data', async () => {
      await store.preloadCache([
        { key: 'k1', value: 'v1', ttlMs: 5000 },
        { key: 'k2', value: 'v2' },
      ]);
      const v1 = await store.get<string>('k1');
      const v2 = await store.get<string>('k2');
      expect(v1).toBe('v1');
      expect(v2).toBe('v2');
    });

    it('should not preload if key exists by default', async () => {
      await store.set('k1', 'original');
      await store.preloadCache([{ key: 'k1', value: 'new' }]);
      const result = await store.get<string>('k1');
      expect(result).toBe('original');
    });

    it('should replace existing when preloading with replace flag', async () => {
      await store.set('k1', 'original');
      await store.preloadCache([{ key: 'k1', value: 'new' }], true);
      const result = await store.get<string>('k1');
      expect(result).toBe('new');
    });

    it('should get or load value', async () => {
      const loader = jest.fn().mockResolvedValue('loaded');
      const result = await store.getOrLoad('key1', loader);
      expect(result).toBe('loaded');
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('should return cached value on getOrLoad if exists', async () => {
      await store.set('key1', 'cached');
      const loader = jest.fn().mockResolvedValue('loaded');
      const result = await store.getOrLoad('key1', loader);
      expect(result).toBe('cached');
      expect(loader).not.toHaveBeenCalled();
    });

    it('should reset stats', async () => {
      await store.set('key1', 'value1');
      await store.get<string>('key1');
      store.resetStats();
      const stats = store.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should emit events on cache operations', (done) => {
      store.on<string>('hit', (event) => {
        expect(event.type).toBe('hit');
        done();
      });
      store.set('key1', 'value1').then(() => {
        store.get<string>('key1');
      });
    });

    it('should take snapshot and restore', async () => {
      await store.set('k1', 'v1');
      await store.set('k2', 'v2');
      const snapshot = await store.snapshot();
      expect(snapshot.entries.length).toBe(2);
      expect(snapshot.version).toBe('1.0.0');

      await store.clear();
      await store.restore(snapshot);
      const v1 = await store.get<string>('k1');
      const v2 = await store.get<string>('k2');
      expect(v1).toBe('v1');
      expect(v2).toBe('v2');
    });

    it('should perform health check', async () => {
      const health = await store.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.storageConnected).toBe(true);
    });
  });

  describe('LRUEvictionPolicy', () => {
    let backend: InMemoryCacheBackend;
    let policy: LRUEvictionPolicy;

    beforeEach(() => {
      backend = new InMemoryCacheBackend();
      policy = new LRUEvictionPolicy(backend);
    });

    it('should evict least recently used entry', async () => {
      await backend.set('k1', 'v1');
      await backend.set('k2', 'v2');
      await backend.get('k1');
      const evicted = await policy.evict(1);
      expect(evicted).toContain('k2');
    });

    it('should evict multiple entries', async () => {
      await backend.setMulti([
        { key: 'k1', value: 'v1' },
        { key: 'k2', value: 'v2' },
        { key: 'k3', value: 'v3' },
      ]);
      const evicted = await policy.evict(2);
      expect(evicted.length).toBe(2);
    });
  });

  describe('LFUEvictionPolicy', () => {
    let backend: InMemoryCacheBackend;
    let policy: LFUEvictionPolicy;

    beforeEach(() => {
      backend = new InMemoryCacheBackend();
      policy = new LFUEvictionPolicy(backend);
    });

    it('should evict least frequently used entry', async () => {
      await backend.set('k1', 'v1');
      await backend.set('k2', 'v2');
      await backend.get('k1');
      await backend.get('k1');
      await backend.get('k1');
      const evicted = await policy.evict(1);
      expect(evicted).toContain('k2');
    });
  });

  describe('FIFOEvictionPolicy', () => {
    let backend: InMemoryCacheBackend;
    let policy: FIFOEvictionPolicy;

    beforeEach(() => {
      backend = new InMemoryCacheBackend();
      policy = new FIFOEvictionPolicy(backend);
    });

    it('should evict oldest entry first', async () => {
      await backend.set('k1', 'v1');
      await new Promise((resolve) => setTimeout(resolve, 10));
      await backend.set('k2', 'v2');
      const evicted = await policy.evict(1);
      expect(evicted).toContain('k1');
    });
  });

  describe('TTLEvictionPolicy', () => {
    let backend: InMemoryCacheBackend;
    let policy: TTLEvictionPolicy;

    beforeEach(() => {
      backend = new InMemoryCacheBackend();
      policy = new TTLEvictionPolicy(backend);
    });

    it('should evict expired entries first', async () => {
      await backend.set('k1', 'v1', 1);
      await backend.set('k2', 'v2', 10000);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const evicted = await policy.evict(1);
      expect(evicted).toContain('k1');
    });
  });

  describe('CacheManager', () => {
    let cacheManager: CacheManager;

    beforeEach(() => {
      cacheManager = createLocalCacheManager({
        defaultTTLMs: 5000,
        ttlPolicy: 'fixed',
        maxSize: 100,
      });
    });

    afterEach(() => {
      cacheManager.destroy();
    });

    it('should create cache manager with config', () => {
      const manager = createCacheManager({
        storageType: 'memory',
        defaultTTLMs: 3000,
        ttlPolicy: 'sliding',
      });
      expect(manager).toBeInstanceOf(CacheManager);
      manager.destroy();
    });

    it('should set and get values', async () => {
      await cacheManager.set('key1', 'value1');
      const result = await cacheManager.get<string>('key1');
      expect(result).toBe('value1');
    });

    it('should delete values', async () => {
      await cacheManager.set('key1', 'value1');
      await cacheManager.delete('key1');
      const result = await cacheManager.get<string>('key1');
      expect(result).toBeNull();
    });

    it('should check existence', async () => {
      await cacheManager.set('key1', 'value1');
      const exists = await cacheManager.exists('key1');
      expect(exists).toBe(true);
    });

    it('should get all keys', async () => {
      await cacheManager.setMulti([
        { key: 'k1', value: 'v1' },
        { key: 'k2', value: 'v2' },
      ]);
      const keys = await cacheManager.keys();
      expect(keys).toContain('k1');
      expect(keys).toContain('k2');
    });

    it('should clear cache', async () => {
      await cacheManager.setMulti([
        { key: 'k1', value: 'v1' },
        { key: 'k2', value: 'v2' },
      ]);
      await cacheManager.clear();
      const size = await cacheManager.size();
      expect(size).toBe(0);
    });

    it('should set expiration', async () => {
      await cacheManager.set('key1', 'value1');
      await cacheManager.expire('key1', 10000);
      const ttl = await cacheManager.ttl('key1');
      expect(ttl).toBeGreaterThan(0);
    });

    it('should get cache stats', async () => {
      await cacheManager.set('key1', 'value1');
      await cacheManager.get<string>('key1');
      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.setOperations).toBe(1);
    });

    it('should invalidate by pattern', async () => {
      await cacheManager.setMulti([
        { key: 'user:1', value: 'v1' },
        { key: 'user:2', value: 'v2' },
        { key: 'post:1', value: 'v3' },
      ]);
      const result = await cacheManager.invalidatePattern('user:*');
      expect(result.deletedCount).toBe(2);
    });

    it('should warm cache', async () => {
      const loader = jest.fn().mockImplementation(async (key: string) => `loaded_${key}`);
      const result = await cacheManager.warmCache({
        keys: ['k1', 'k2'],
        loader,
        parallel: false,
      });
      expect(result.get('k1')).toBe('loaded_k1');
    });

    it('should preload cache', async () => {
      await cacheManager.preloadCache([
        { key: 'k1', value: 'v1' },
        { key: 'k2', value: 'v2' },
      ]);
      const v1 = await cacheManager.get<string>('k1');
      expect(v1).toBe('v1');
    });

    it('should get or load value', async () => {
      const loader = jest.fn().mockResolvedValue('loaded');
      const result = await cacheManager.getOrLoad('key1', loader);
      expect(result).toBe('loaded');
    });

    it('should reset stats', async () => {
      await cacheManager.set('key1', 'value1');
      cacheManager.resetStats();
      const stats = cacheManager.getStats();
      expect(stats.setOperations).toBe(0);
    });

    it('should take snapshot', async () => {
      await cacheManager.set('k1', 'v1');
      const snapshot = await cacheManager.snapshot();
      expect(snapshot.entries.length).toBe(1);
    });

    it('should restore from snapshot', async () => {
      await cacheManager.set('k1', 'v1');
      const snapshot = await cacheManager.snapshot();
      await cacheManager.clear();
      await cacheManager.restore(snapshot);
      const result = await cacheManager.get<string>('k1');
      expect(result).toBe('v1');
    });

    it('should perform health check', async () => {
      const health = await cacheManager.healthCheck();
      expect(health.healthy).toBe(true);
    });

    it('should evict entries', async () => {
      const smallManager = createLocalCacheManager({
        defaultTTLMs: 60000,
        maxSize: 2,
      });
      await smallManager.set('k1', 'v1');
      await smallManager.set('k2', 'v2');
      const evicted = await smallManager.evict(1);
      expect(evicted.length).toBe(1);
      smallManager.destroy();
    });

    it('should listen to cache events', async () => {
      let eventReceived = false;
      cacheManager.on<string>('set', (event) => {
        expect(event.type).toBe('set');
        expect(event.key).toBe('key1');
        eventReceived = true;
      });
      await cacheManager.set('key1', 'value1');
      expect(eventReceived).toBe(true);
    });
  });

  describe('createLocalCacheManager', () => {
    it('should create local cache manager with defaults', () => {
      const manager = createLocalCacheManager();
      expect(manager).toBeInstanceOf(CacheManager);
      manager.destroy();
    });

    it('should create local cache manager with custom config', () => {
      const manager = createLocalCacheManager({
        defaultTTLMs: 10000,
        ttlPolicy: 'lazy',
        maxSize: 500,
      });
      expect(manager).toBeInstanceOf(CacheManager);
      manager.destroy();
    });
  });
});

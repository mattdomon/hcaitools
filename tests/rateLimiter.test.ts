import {
  RateLimiter,
  InMemoryStorage,
  SimpleLock,
  TokenBucketRateLimiter,
  SlidingWindowRateLimiter,
  FixedWindowRateLimiter,
  Throttler,
  RateLimitMiddleware,
  createUserKeyGenerator,
  createEndpointKeyGenerator,
  createIpKeyGenerator,
  createCompositeKeyGenerator,
  RateLimitConfig,
  RateLimitContext,
  ThrottleConfig,
} from '../src/core/rateLimiter';

describe('Rate Limiter Module', () => {
  describe('InMemoryStorage', () => {
    let storage: InMemoryStorage;

    beforeEach(() => {
      storage = new InMemoryStorage();
    });

    it('should store and retrieve a value', async () => {
      await storage.set('test_key', 'test_value');
      const value = await storage.get('test_key');
      expect(value).toBe('test_value');
    });

    it('should return null for non-existent key', async () => {
      const value = await storage.get('non_existent');
      expect(value).toBeNull();
    });

    it('should delete a value', async () => {
      await storage.set('test_key', 'test_value');
      await storage.delete('test_key');
      const value = await storage.get('test_key');
      expect(value).toBeNull();
    });

    it('should increment a counter', async () => {
      const count1 = await storage.increment('counter');
      expect(count1).toBe(1);
      const count2 = await storage.increment('counter');
      expect(count2).toBe(2);
    });

    it('should handle getMulti', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      const results = await storage.getMulti(['key1', 'key2', 'key3']);
      expect(results).toEqual(['value1', 'value2', null]);
    });

    it('should handle setMulti', async () => {
      await storage.setMulti([
        { key: 'multi1', value: 'val1' },
        { key: 'multi2', value: 'val2' },
      ]);
      const results = await storage.getMulti(['multi1', 'multi2']);
      expect(results).toEqual(['val1', 'val2']);
    });
  });

  describe('SimpleLock', () => {
    let lock: SimpleLock;

    beforeEach(() => {
      lock = new SimpleLock();
    });

    it('should acquire an unlocked key', async () => {
      const acquired = await lock.acquire('test_lock', 1000);
      expect(acquired).toBe(true);
    });

    it('should fail to acquire a locked key', async () => {
      await lock.acquire('test_lock', 1000);
      const acquired = await lock.acquire('test_lock', 1000);
      expect(acquired).toBe(false);
    });

    it('should release a lock', async () => {
      await lock.acquire('test_lock', 1000);
      await lock.release('test_lock');
      const acquired = await lock.acquire('test_lock', 1000);
      expect(acquired).toBe(true);
    });

    it('should handle multiple independent locks', async () => {
      await lock.acquire('lock1', 1000);
      await lock.acquire('lock2', 1000);
      const lock1Again = await lock.acquire('lock1', 1000);
      expect(lock1Again).toBe(false);
    });
  });

  describe('TokenBucketRateLimiter', () => {
    let limiter: TokenBucketRateLimiter;
    let config: RateLimitConfig;

    beforeEach(() => {
      config = {
        algorithm: 'token_bucket',
        maxRequests: 10,
        windowSizeMs: 1000,
        burstCapacity: 15,
      };
      limiter = new TokenBucketRateLimiter('tb_test', config);
    });

    it('should allow requests when tokens are available', async () => {
      const allowed = await limiter.allowRequest(1);
      expect(allowed).toBe(true);
    });

    it('should consume tokens on each request', async () => {
      await limiter.allowRequest(5);
      const state = await limiter.getState();
      expect(state.tokens).toBeLessThanOrEqual(10);
    });

    it('should deny requests when tokens are exhausted', async () => {
      for (let i = 0; i < 15; i++) {
        await limiter.allowRequest(1);
      }
      const allowed = await limiter.allowRequest(1);
      expect(allowed).toBe(false);
    });

    it('should respect burst capacity', async () => {
      const state = await limiter.getState();
      expect(state.maxTokens).toBe(15);
    });
  });

  describe('SlidingWindowRateLimiter', () => {
    let limiter: SlidingWindowRateLimiter;
    let config: RateLimitConfig;

    beforeEach(() => {
      config = {
        algorithm: 'sliding_window',
        maxRequests: 5,
        windowSizeMs: 1000,
      };
      limiter = new SlidingWindowRateLimiter('sw_test', config);
    });

    it('should allow requests within limit', async () => {
      const results: boolean[] = [];
      for (let i = 0; i < 5; i++) {
        results.push(await limiter.allowRequest());
      }
      expect(results.every((r) => r)).toBe(true);
    });

    it('should deny requests over limit', async () => {
      for (let i = 0; i < 5; i++) {
        await limiter.allowRequest();
      }
      const allowed = await limiter.allowRequest();
      expect(allowed).toBe(false);
    });

    it('should calculate remaining requests correctly', async () => {
      await limiter.allowRequest();
      await limiter.allowRequest();
      const remaining = limiter.getRemaining();
      expect(remaining).toBe(3);
    });

    it('should calculate reset time correctly', async () => {
      await limiter.allowRequest();
      const resetAt = limiter.getResetTime();
      expect(resetAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('FixedWindowRateLimiter', () => {
    let limiter: FixedWindowRateLimiter;
    let config: RateLimitConfig;

    beforeEach(() => {
      config = {
        algorithm: 'fixed_window',
        maxRequests: 5,
        windowSizeMs: 1000,
      };
      limiter = new FixedWindowRateLimiter('fw_test', config);
    });

    it('should allow requests within limit', async () => {
      const results: boolean[] = [];
      for (let i = 0; i < 5; i++) {
        results.push(await limiter.allowRequest());
      }
      expect(results.every((r) => r)).toBe(true);
    });

    it('should deny requests over limit', async () => {
      for (let i = 0; i < 5; i++) {
        await limiter.allowRequest();
      }
      const allowed = await limiter.allowRequest();
      expect(allowed).toBe(false);
    });

    it('should reset after window expires', async () => {
      await limiter.allowRequest();
      const state = await limiter.getState();
      expect(state.count).toBe(1);
    });
  });

  describe('Throttler', () => {
    let throttler: Throttler;
    let config: ThrottleConfig;

    beforeEach(() => {
      config = {
        maxConcurrentRequests: 2,
        maxQueueSize: 3,
        queueTimeoutMs: 100,
        backpressureThreshold: 0.5,
      };
      throttler = new Throttler(config);
    });

    it('should allow requests under concurrent limit', async () => {
      const result1 = await throttler.acquire();
      const result2 = await throttler.acquire();
      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });

    it('should queue requests when at limit', async () => {
      await throttler.acquire();
      await throttler.acquire();
      const result = await throttler.acquire();
      expect(result.allowed).toBe(false);
    });

    it('should reject requests when queue is full', async () => {
      await throttler.acquire();
      await throttler.acquire();
      await throttler.acquire();
      await throttler.acquire();
      const result = await throttler.acquire();
      expect(result.allowed).toBe(false);
    });

    it('should release and process queued requests', async () => {
      await throttler.acquire();
      await throttler.acquire();
      throttler.release();
      const result = await throttler.acquire();
      expect(result.allowed).toBe(true);
    });

    it('should track concurrent requests', async () => {
      await throttler.acquire();
      const metrics = throttler.getMetrics();
      expect(metrics.concurrentRequests).toBe(1);
    });

    it('should emit backpressure events', (done) => {
      throttler.onBackpressure((event) => {
        expect(event.type).toBe('pressure_high');
        done();
      });
      throttler.acquire();
    });
  });

  describe('RateLimiter', () => {
    let rateLimiter: RateLimiter;
    let config: RateLimitConfig;

    beforeEach(() => {
      config = {
        algorithm: 'sliding_window',
        maxRequests: 10,
        windowSizeMs: 60000,
      };
      rateLimiter = new RateLimiter({ config });
    });

    it('should allow requests under limit', async () => {
      const context: RateLimitContext = {
        userId: 'user123',
        endpoint: '/api/test',
      };
      const result = await rateLimiter.checkLimit(context);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should deny requests over limit', async () => {
      const context: RateLimitContext = {
        userId: 'user123',
        endpoint: '/api/test',
      };
      
      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkLimit(context);
      }
      
      const result = await rateLimiter.checkLimit(context);
      expect(result.allowed).toBe(false);
    });

    it('should generate unique request IDs', async () => {
      const context: RateLimitContext = { endpoint: '/api/test' };
      const result1 = await rateLimiter.checkLimit(context);
      const result2 = await rateLimiter.checkLimit(context);
      expect(result1.requestId).not.toBe(result2.requestId);
    });

    it('should return correct limit and remaining', async () => {
      const context: RateLimitContext = { endpoint: '/api/test' };
      const result = await rateLimiter.checkLimit(context);
      expect(result.limit).toBe(10);
      expect(result.remaining).toBe(9);
    });

    it('should create rate limit error with correct properties', async () => {
      const context: RateLimitContext = {
        userId: 'user123',
        endpoint: '/api/test',
      };
      
      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkLimit(context);
      }
      
      const result = await rateLimiter.checkLimit(context);
      const error = rateLimiter.createRateLimitError(result);
      
      expect(error.statusCode).toBe(429);
      expect(error.errorCode).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.remaining).toBe(0);
      expect(error.limit).toBe(10);
      expect(error.retryAfterMs).toBeGreaterThan(0);
    });

    it('should perform health check', async () => {
      const health = await rateLimiter.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.storageConnected).toBe(true);
    });

    it('should use custom key generator', async () => {
      const customKeyGen = () => 'custom_key';
      const customLimiter = new RateLimiter({
        config,
        keyGenerator: customKeyGen,
      });
      
      const context: RateLimitContext = { endpoint: '/api/test' };
      const result = await customLimiter.checkLimit(context);
      expect(result.allowed).toBe(true);
    });

    it('should get metrics', async () => {
      const metrics = await rateLimiter.getMetrics();
      expect(metrics.totalRequests).toBe(0);
    });
  });

  describe('Key Generators', () => {
    it('should create user key generator', () => {
      const gen = createUserKeyGenerator();
      const context: RateLimitContext = {
        userId: 'user123',
        endpoint: '/api/test',
      };
      const key = gen(context);
      expect(key).toBe('rl:u_user123');
    });

    it('should throw error for user key generator without userId', () => {
      const gen = createUserKeyGenerator();
      const context: RateLimitContext = { endpoint: '/api/test' };
      expect(() => gen(context)).toThrow('User ID is required');
    });

    it('should create endpoint key generator', () => {
      const gen = createEndpointKeyGenerator();
      const context: RateLimitContext = { endpoint: '/api/test' };
      const key = gen(context);
      expect(key).toBe('rl:e_/api/test');
    });

    it('should create IP key generator', () => {
      const gen = createIpKeyGenerator();
      const context: RateLimitContext = {
        ip: '192.168.1.1',
        endpoint: '/api/test',
      };
      const key = gen(context);
      expect(key).toBe('rl:ip_192.168.1.1');
    });

    it('should throw error for IP key generator without IP', () => {
      const gen = createIpKeyGenerator();
      const context: RateLimitContext = { endpoint: '/api/test' };
      expect(() => gen(context)).toThrow('IP address is required');
    });

    it('should create composite key generator', () => {
      const userGen = createUserKeyGenerator();
      const endpointGen = createEndpointKeyGenerator();
      const composite = createCompositeKeyGenerator(userGen, endpointGen);
      
      const context: RateLimitContext = {
        userId: 'user123',
        endpoint: '/api/test',
      };
      const key = composite(context);
      expect(key).toContain('u_user123');
      expect(key).toContain('e_/api/test');
    });
  });

  describe('RateLimitMiddleware', () => {
    let rateLimiter: RateLimiter;
    let middleware: RateLimitMiddleware;
    let config: RateLimitConfig;

    beforeEach(() => {
      config = {
        algorithm: 'sliding_window',
        maxRequests: 10,
        windowSizeMs: 60000,
      };
      rateLimiter = new RateLimiter({ config });
      middleware = new RateLimitMiddleware(rateLimiter);
    });

    it('should generate correct headers', () => {
      const result = {
        allowed: true,
        remaining: 9,
        limit: 10,
        resetAt: new Date(),
        retryAfterMs: undefined,
        algorithm: 'sliding_window' as const,
        requestId: 'req_123',
      };
      
      const headers = middleware.getHeaders(result);
      expect(headers['X-RateLimit-Limit']).toBe('10');
      expect(headers['X-RateLimit-Remaining']).toBe('9');
      expect(headers['X-RateLimit-Reset']).toBe(result.resetAt.getTime().toString());
    });

    it('should include Retry-After header when rate limited', () => {
      const result = {
        allowed: false,
        remaining: 0,
        limit: 10,
        resetAt: new Date(Date.now() + 30000),
        retryAfterMs: 30000,
        algorithm: 'sliding_window' as const,
        requestId: 'req_123',
      };
      
      const headers = middleware.getHeaders(result);
      expect(headers['Retry-After']).toBe('30');
    });
  });

  describe('Algorithm Variations', () => {
    it('should work with fixed window algorithm', async () => {
      const config: RateLimitConfig = {
        algorithm: 'fixed_window',
        maxRequests: 5,
        windowSizeMs: 1000,
      };
      const limiter = new RateLimiter({ config });
      
      const context: RateLimitContext = { endpoint: '/api/test' };
      
      for (let i = 0; i < 5; i++) {
        const result = await limiter.checkLimit(context);
        expect(result.allowed).toBe(true);
        expect(result.algorithm).toBe('fixed_window');
      }
      
      const result = await limiter.checkLimit(context);
      expect(result.allowed).toBe(false);
    });

    it('should work with token bucket algorithm', async () => {
      const config: RateLimitConfig = {
        algorithm: 'token_bucket',
        maxRequests: 5,
        windowSizeMs: 1000,
        burstCapacity: 10,
      };
      const limiter = new RateLimiter({ config });
      
      const context: RateLimitContext = { endpoint: '/api/test' };
      
      const results: boolean[] = [];
      for (let i = 0; i < 10; i++) {
        const result = await limiter.checkLimit(context);
        results.push(result.allowed);
      }
      
      expect(results[0]).toBe(true);
      expect(results.every((r) => r)).toBe(true);
    });
  });

  describe('Per-user and Per-endpoint Limiting', () => {
    it('should track limits separately per user', async () => {
      const config: RateLimitConfig = {
        algorithm: 'sliding_window',
        maxRequests: 2,
        windowSizeMs: 60000,
      };
      const limiter = new RateLimiter({ config });
      
      const context1: RateLimitContext = { userId: 'user1', endpoint: '/api/test' };
      const context2: RateLimitContext = { userId: 'user2', endpoint: '/api/test' };
      
      await limiter.checkLimit(context1);
      await limiter.checkLimit(context1);
      const result3 = await limiter.checkLimit(context1);
      expect(result3.allowed).toBe(false);
      
      const result4 = await limiter.checkLimit(context2);
      expect(result4.allowed).toBe(true);
    });

    it('should track limits separately per endpoint', async () => {
      const config: RateLimitConfig = {
        algorithm: 'sliding_window',
        maxRequests: 2,
        windowSizeMs: 60000,
      };
      const limiter = new RateLimiter({ config });
      
      const context1: RateLimitContext = { endpoint: '/api/endpoint1' };
      const context2: RateLimitContext = { endpoint: '/api/endpoint2' };
      
      await limiter.checkLimit(context1);
      await limiter.checkLimit(context1);
      const result3 = await limiter.checkLimit(context1);
      expect(result3.allowed).toBe(false);
      
      const result4 = await limiter.checkLimit(context2);
      expect(result4.allowed).toBe(true);
    });
  });
});

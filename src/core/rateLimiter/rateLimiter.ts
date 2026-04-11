import crypto from 'crypto';
import {
  RateLimitConfig,
  RateLimitContext,
  RateLimitResult,
  RateLimitError,
  RateLimiterOptions,
  KeyGenerator,
  StorageBackend,
  DistributedLock,
  TokenBucketState,
  SlidingWindowState,
  FixedWindowState,
  ThrottleConfig,
  ThrottleResult,
  BackpressureEvent,
  RateLimitMetrics,
  HealthCheckResult,
  DEFAULT_CONFIG,
} from './types';

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export class InMemoryStorage implements StorageBackend {
  private store: Map<string, { value: string; expiresAt?: number }> = new Map();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlMs?: number): Promise<void> {
    const expiresAt = ttlMs ? Date.now() + ttlMs : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async increment(key: string, ttlMs?: number): Promise<number> {
    const entry = this.store.get(key);
    let count: number;
    
    if (!entry || (entry.expiresAt && entry.expiresAt < Date.now())) {
      count = 1;
      const expiresAt = ttlMs ? Date.now() + ttlMs : undefined;
      this.store.set(key, { value: '1', expiresAt });
    } else {
      count = parseInt(entry.value, 10) + 1;
      const expiresAt = ttlMs ? Date.now() + ttlMs : undefined;
      this.store.set(key, { value: count.toString(), expiresAt });
    }
    
    return count;
  }

  async getMulti(keys: string[]): Promise<Array<string | null>> {
    return keys.map((key) => this.store.get(key)?.value ?? null);
  }

  async setMulti(entries: Array<{ key: string; value: string; ttlMs?: number }>): Promise<void> {
    for (const { key, value, ttlMs } of entries) {
      const expiresAt = ttlMs ? Date.now() + ttlMs : undefined;
      this.store.set(key, { value, expiresAt });
    }
  }
}

export class SimpleLock implements DistributedLock {
  private locks: Set<string> = new Set();

  async acquire(key: string, _ttlMs: number): Promise<boolean> {
    if (this.locks.has(key)) {
      return false;
    }
    this.locks.add(key);
    return true;
  }

  async release(key: string): Promise<void> {
    this.locks.delete(key);
  }
}

export class TokenBucketRateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;
  private lastRefill: number;
  private key: string;
  private storage?: StorageBackend;

  constructor(key: string, config: RateLimitConfig, storage?: StorageBackend) {
    this.key = key;
    this.maxTokens = config.burstCapacity ?? config.maxRequests;
    this.tokens = this.maxTokens;
    this.refillRate = config.maxRequests / (config.windowSizeMs / 1000);
    this.lastRefill = Date.now();
    this.storage = storage;
  }

  private async refill(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / 1000) * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;

    if (this.storage) {
      const state: TokenBucketState = {
        tokens: this.tokens,
        lastRefill: this.lastRefill,
        maxTokens: this.maxTokens,
        refillRate: this.refillRate,
      };
      await this.storage.set(this.key, JSON.stringify(state));
    }
  }

  async allowRequest(tokensToConsume: number = 1): Promise<boolean> {
    if (this.storage) {
      const stored = await this.storage.get(this.key);
      if (stored) {
        const state: TokenBucketState = JSON.parse(stored);
        this.tokens = state.tokens;
        this.lastRefill = state.lastRefill;
      }
    }

    await this.refill();

    if (this.tokens >= tokensToConsume) {
      this.tokens -= tokensToConsume;
      return true;
    }

    return false;
  }

  async getState(): Promise<TokenBucketState> {
    await this.refill();
    return {
      tokens: this.tokens,
      lastRefill: this.lastRefill,
      maxTokens: this.maxTokens,
      refillRate: this.refillRate,
    };
  }
}

export class SlidingWindowRateLimiter {
  private timestamps: number[] = [];
  private windowSizeMs: number;
  private maxRequests: number;
  private key: string;
  private storage?: StorageBackend;

  constructor(key: string, config: RateLimitConfig, storage?: StorageBackend) {
    this.key = key;
    this.windowSizeMs = config.windowSizeMs;
    this.maxRequests = config.maxRequests;
    this.storage = storage;
  }

  private async loadState(): Promise<void> {
    if (this.storage) {
      const stored = await this.storage.get(this.key);
      if (stored) {
        const state: SlidingWindowState = JSON.parse(stored);
        const now = Date.now();
        this.timestamps = state.timestamps.filter((ts) => now - ts < this.windowSizeMs);
      }
    }
  }

  private async saveState(): Promise<void> {
    if (this.storage) {
      const state: SlidingWindowState = {
        timestamps: this.timestamps,
        windowSizeMs: this.windowSizeMs,
        maxRequests: this.maxRequests,
      };
      await this.storage.set(this.key, JSON.stringify(state), this.windowSizeMs);
    }
  }

  async allowRequest(): Promise<boolean> {
    await this.loadState();

    const now = Date.now();
    const windowStart = now - this.windowSizeMs;
    this.timestamps = this.timestamps.filter((ts) => ts > windowStart);

    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(now);
      await this.saveState();
      return true;
    }

    return false;
  }

  async getState(): Promise<SlidingWindowState> {
    await this.loadState();
    const now = Date.now();
    const windowStart = now - this.windowSizeMs;
    this.timestamps = this.timestamps.filter((ts) => ts > windowStart);
    return {
      timestamps: this.timestamps,
      windowSizeMs: this.windowSizeMs,
      maxRequests: this.maxRequests,
    };
  }

  getRemaining(): number {
    return Math.max(0, this.maxRequests - this.timestamps.length);
  }

  getResetTime(): Date {
    if (this.timestamps.length === 0) {
      return new Date(Date.now() + this.windowSizeMs);
    }
    const oldest = Math.min(...this.timestamps);
    return new Date(oldest + this.windowSizeMs);
  }
}

export class FixedWindowRateLimiter {
  private count: number = 0;
  private windowStart: number;
  private windowSizeMs: number;
  private maxRequests: number;
  private key: string;
  private storage?: StorageBackend;

  constructor(key: string, config: RateLimitConfig, storage?: StorageBackend) {
    this.key = key;
    this.windowSizeMs = config.windowSizeMs;
    this.maxRequests = config.maxRequests;
    this.windowStart = Date.now();
    this.storage = storage;
  }

  private async loadState(): Promise<void> {
    if (this.storage) {
      const stored = await this.storage.get(this.key);
      if (stored) {
        const state: FixedWindowState = JSON.parse(stored);
        const now = Date.now();
        if (now - state.windowStart < state.windowSizeMs) {
          this.count = state.count;
          this.windowStart = state.windowStart;
        } else {
          this.count = 0;
          this.windowStart = now;
        }
      }
    }
  }

  private async saveState(): Promise<void> {
    if (this.storage) {
      const state: FixedWindowState = {
        count: this.count,
        windowStart: this.windowStart,
        windowSizeMs: this.windowSizeMs,
        maxRequests: this.maxRequests,
      };
      await this.storage.set(this.key, JSON.stringify(state), this.windowSizeMs);
    }
  }

  async allowRequest(): Promise<boolean> {
    await this.loadState();

    const now = Date.now();
    if (now - this.windowStart >= this.windowSizeMs) {
      this.count = 0;
      this.windowStart = now;
    }

    if (this.count < this.maxRequests) {
      this.count++;
      await this.saveState();
      return true;
    }

    return false;
  }

  async getState(): Promise<FixedWindowState> {
    await this.loadState();
    return {
      count: this.count,
      windowStart: this.windowStart,
      windowSizeMs: this.windowSizeMs,
      maxRequests: this.maxRequests,
    };
  }

  getRemaining(): number {
    return Math.max(0, this.maxRequests - this.count);
  }

  getResetTime(): Date {
    return new Date(this.windowStart + this.windowSizeMs);
  }
}

export class Throttler {
  private concurrentRequests: number = 0;
  private queue: Array<{
    resolve: (result: ThrottleResult) => void;
    timestamp: number;
  }> = [];
  private config: ThrottleConfig;
  private backpressureCallbacks: Set<(event: BackpressureEvent) => void> = new Set();

  constructor(config: ThrottleConfig) {
    this.config = config;
  }

  async acquire(): Promise<ThrottleResult> {
    if (this.concurrentRequests < this.config.maxConcurrentRequests) {
      this.concurrentRequests++;
      this.checkBackpressure();
      return {
        allowed: true,
        concurrentRequests: this.concurrentRequests,
      };
    }

    if (this.queue.length >= this.config.maxQueueSize) {
      this.checkBackpressure();
      return {
        allowed: false,
        concurrentRequests: this.concurrentRequests,
      };
    }

    return new Promise<ThrottleResult>((resolve) => {
      const entry = {
        resolve,
        timestamp: Date.now(),
      };
      this.queue.push(entry);

      setTimeout(() => {
        const index = this.queue.indexOf(entry);
        if (index !== -1) {
          this.queue.splice(index, 1);
          resolve({
            allowed: false,
            concurrentRequests: this.concurrentRequests,
          });
        }
      }, this.config.queueTimeoutMs);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const entry = this.queue.shift();
      if (entry) {
        this.concurrentRequests++;
        const estimatedWaitMs = Date.now() - entry.timestamp;
        entry.resolve({
          allowed: true,
          queuePosition: 0,
          estimatedWaitMs,
          concurrentRequests: this.concurrentRequests,
        });
      }
    } else {
      this.concurrentRequests = Math.max(0, this.concurrentRequests - 1);
    }
    this.checkBackpressure();
  }

  private checkBackpressure(): void {
    const queueRatio = this.queue.length / this.config.maxQueueSize;
    const concurrentRatio = this.concurrentRequests / this.config.maxConcurrentRequests;

    if (queueRatio >= 0.9 || concurrentRatio >= 0.9) {
      this.emitBackpressure('pressure_critical');
    } else if (queueRatio >= this.config.backpressureThreshold || concurrentRatio >= this.config.backpressureThreshold) {
      this.emitBackpressure('pressure_high');
    } else {
      this.emitBackpressure('pressure_normal');
    }
  }

  onBackpressure(callback: (event: BackpressureEvent) => void): void {
    this.backpressureCallbacks.add(callback);
  }

  private emitBackpressure(type: BackpressureEvent['type']): void {
    const event: BackpressureEvent = {
      type,
      timestamp: new Date(),
      metrics: {
        concurrentRequests: this.concurrentRequests,
        queueSize: this.queue.length,
        rejectionRate: this.queue.length / this.config.maxQueueSize,
      },
    };
    this.backpressureCallbacks.forEach((cb) => cb(event));
  }

  getMetrics(): { concurrentRequests: number; queueSize: number } {
    return {
      concurrentRequests: this.concurrentRequests,
      queueSize: this.queue.length,
    };
  }
}

export class RateLimiter {
  private config: RateLimitConfig;
  private storage: StorageBackend;
  private lock: DistributedLock;
  private keyGenerator: KeyGenerator;
  private onLimitExceeded?: (context: RateLimitContext, result: RateLimitResult) => void;
  private onRequestAllowed?: (context: RateLimitContext, result: RateLimitResult) => void;
  private throttler?: Throttler;
  private limiters: Map<string, SlidingWindowRateLimiter | FixedWindowRateLimiter | TokenBucketRateLimiter> = new Map();

  constructor(options: RateLimiterOptions) {
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    this.storage = options.storage ?? new InMemoryStorage();
    this.lock = options.lock ?? new SimpleLock();
    this.keyGenerator = options.keyGenerator ?? defaultKeyGenerator;
    this.onLimitExceeded = options.onLimitExceeded;
    this.onRequestAllowed = options.onRequestAllowed;

    if (options.config.algorithm === 'token_bucket' && options.config.burstCapacity) {
      this.throttler = new Throttler({
        maxConcurrentRequests: options.config.burstCapacity,
        maxQueueSize: 100,
        queueTimeoutMs: 5000,
        backpressureThreshold: 0.7,
      });
    }
  }

  private getLimiter(key: string): SlidingWindowRateLimiter | FixedWindowRateLimiter | TokenBucketRateLimiter {
    if (this.limiters.has(key)) {
      return this.limiters.get(key)!;
    }

    let limiter: SlidingWindowRateLimiter | FixedWindowRateLimiter | TokenBucketRateLimiter;

    switch (this.config.algorithm) {
      case 'token_bucket':
        limiter = new TokenBucketRateLimiter(key, this.config, this.storage);
        break;
      case 'fixed_window':
        limiter = new FixedWindowRateLimiter(key, this.config, this.storage);
        break;
      case 'sliding_window':
      default:
        limiter = new SlidingWindowRateLimiter(key, this.config, this.storage);
        break;
    }

    this.limiters.set(key, limiter);
    return limiter;
  }

  async checkLimit(context: RateLimitContext): Promise<RateLimitResult> {
    const key = this.keyGenerator(context);
    const lockKey = `lock_${key}`;
    
    const acquired = await this.lock.acquire(lockKey, 1000);
    if (!acquired) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return this.checkLimit(context);
    }

    try {
      const limiter = this.getLimiter(key);
      let allowed: boolean;
      let remaining: number;
      let resetAt: Date;

      if (limiter instanceof TokenBucketRateLimiter) {
        allowed = await limiter.allowRequest();
        const state = await limiter.getState();
        remaining = Math.floor(state.tokens);
        resetAt = new Date(state.lastRefill + (state.maxTokens - state.tokens) / state.refillRate * 1000);
      } else if (limiter instanceof FixedWindowRateLimiter) {
        allowed = await limiter.allowRequest();
        remaining = limiter.getRemaining();
        resetAt = limiter.getResetTime();
      } else {
        allowed = await limiter.allowRequest();
        remaining = limiter.getRemaining();
        resetAt = limiter.getResetTime();
      }

      const result: RateLimitResult = {
        allowed,
        remaining: Math.max(0, remaining),
        limit: this.config.maxRequests,
        resetAt,
        algorithm: this.config.algorithm,
        requestId: generateId('req'),
        retryAfterMs: allowed ? undefined : resetAt.getTime() - Date.now(),
      };

      if (allowed) {
        this.onRequestAllowed?.(context, result);
      } else {
        this.onLimitExceeded?.(context, result);
      }

      return result;
    } finally {
      await this.lock.release(lockKey);
    }
  }

  createRateLimitError(result: RateLimitResult): RateLimitError {
    const error = new Error('Rate limit exceeded') as RateLimitError;
    error.statusCode = 429;
    error.remaining = result.remaining;
    error.limit = result.limit;
    error.resetAt = result.resetAt;
    error.retryAfterMs = result.retryAfterMs ?? 0;
    error.errorCode = 'RATE_LIMIT_EXCEEDED';
    return error;
  }

  async getMetrics(): Promise<RateLimitMetrics> {
    return {
      totalRequests: 0,
      allowedRequests: 0,
      rejectedRequests: 0,
      averageLatencyMs: 0,
      currentRate: 0,
      periodStart: new Date(),
      periodEnd: new Date(),
    };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const start = Date.now();
      await this.storage.get('health_check_test');
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
}

function defaultKeyGenerator(context: RateLimitContext): string {
  const parts: string[] = ['rl'];
  
  if (context.userId) {
    parts.push(`u_${context.userId}`);
  }
  
  if (context.endpoint) {
    parts.push(`e_${context.endpoint}`);
  }
  
  if (context.ip) {
    parts.push(`ip_${context.ip}`);
  }
  
  if (context.customKeys) {
    for (const [key, value] of Object.entries(context.customKeys)) {
      parts.push(`${key}_${value}`);
    }
  }
  
  return parts.join(':');
}

export function createUserKeyGenerator(): KeyGenerator {
  return (context: RateLimitContext): string => {
    if (!context.userId) {
      throw new Error('User ID is required for user-based rate limiting');
    }
    return `rl:u_${context.userId}`;
  };
}

export function createEndpointKeyGenerator(): KeyGenerator {
  return (context: RateLimitContext): string => {
    return `rl:e_${context.endpoint}`;
  };
}

export function createIpKeyGenerator(): KeyGenerator {
  return (context: RateLimitContext): string => {
    if (!context.ip) {
      throw new Error('IP address is required for IP-based rate limiting');
    }
    return `rl:ip_${context.ip}`;
  };
}

export function createCompositeKeyGenerator(...keys: KeyGenerator[]): KeyGenerator {
  return (context: RateLimitContext): string => {
    const generatedKeys = keys.map((gen) => gen(context));
    return generatedKeys.sort().join(':');
  };
}

export class RateLimitMiddleware {
  private rateLimiter: RateLimiter;

  constructor(rateLimiter: RateLimiter) {
    this.rateLimiter = rateLimiter;
  }

  async middleware(context: RateLimitContext): Promise<void> {
    const result = await this.rateLimiter.checkLimit(context);
    
    if (!result.allowed) {
      const error = this.rateLimiter.createRateLimitError(result);
      throw error;
    }
  }

  getHeaders(result: RateLimitResult): Record<string, string> {
    return {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.resetAt.getTime().toString(),
      'Retry-After': result.retryAfterMs ? Math.ceil(result.retryAfterMs / 1000).toString() : '0',
    };
  }
}

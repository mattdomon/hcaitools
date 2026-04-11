import * as crypto from 'crypto';
import {
  ApiKey,
  ApiKeyType,
  ApiScope,
  ApiKeyUsage,
  CreateApiKeyOptions,
  CreateApiKeyResult,
  RotateApiKeyResult,
  ValidateApiKeyResult,
  UsageReport,
  RateLimitInfo,
  ListApiKeysOptions,
  PaginatedResult,
  IApiKeyStore,
  IApiKeyGenerator,
  ApiKeyManagerConfig,
  ApiKeyEvent,
  ApiKeyEventHandler,
  ApiKeyEventType,
} from './types';

const KEY_PREFIXES: Record<ApiKeyType, string> = {
  access_key: 'ak',
  refresh_token: 'rt',
  api_key: 'ap',
};

const DEFAULT_KEY_LENGTH = 32;

function toPublicKey({ hashedKey: _hashedKey, ...rest }: ApiKey): Omit<ApiKey, 'hashedKey'> {
  void _hashedKey;
  return rest;
}

class ApiKeyGenerator implements IApiKeyGenerator {
  private readonly keyLength: number;

  constructor(keyLength: number = DEFAULT_KEY_LENGTH) {
    this.keyLength = keyLength;
  }

  async generateKey(prefix: string): Promise<string> {
    const randomBytes = crypto.randomBytes(this.keyLength);
    const keyBody = randomBytes.toString('hex');
    return `${prefix}_${keyBody}`;
  }

  async hashKey(key: string): Promise<string> {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  async verifyKey(key: string, hashedKey: string): Promise<boolean> {
    const hashedInput = await this.hashKey(key);
    return crypto.timingSafeEqual(
      Buffer.from(hashedInput),
      Buffer.from(hashedKey)
    );
  }
}

class InMemoryApiKeyStore implements IApiKeyStore {
  private readonly keys: Map<string, ApiKey> = new Map();
  private readonly prefixIndex: Map<string, string> = new Map();

  async save(apiKey: ApiKey): Promise<void> {
    this.keys.set(apiKey.id, { ...apiKey });
    this.prefixIndex.set(apiKey.prefix, apiKey.id);
  }

  async findById(id: string): Promise<ApiKey | null> {
    const key = this.keys.get(id);
    return key ? { ...key } : null;
  }

  async findByPrefix(prefix: string): Promise<ApiKey | null> {
    const id = this.prefixIndex.get(prefix);
    if (!id) return null;
    return this.findById(id);
  }

  async update(id: string, updates: Partial<ApiKey>): Promise<ApiKey | null> {
    const existing = this.keys.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.keys.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    const key = this.keys.get(id);
    if (!key) return false;
    this.prefixIndex.delete(key.prefix);
    return this.keys.delete(id);
  }

  async list(options: ListApiKeysOptions): Promise<PaginatedResult<ApiKey>> {
    const {
      page = 1,
      pageSize = 10,
      status,
      keyType,
      createdBy,
      environment,
      tags,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    let filtered = Array.from(this.keys.values());

    if (status) {
      filtered = filtered.filter((k) => k.status === status);
    }
    if (keyType) {
      filtered = filtered.filter((k) => k.keyType === keyType);
    }
    if (createdBy) {
      filtered = filtered.filter((k) => k.metadata.createdBy === createdBy);
    }
    if (environment) {
      filtered = filtered.filter((k) => k.metadata.environment === environment);
    }
    if (tags && tags.length > 0) {
      filtered = filtered.filter((k) =>
        tags.every((tag) => k.metadata.tags?.includes(tag))
      );
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'createdAt':
          comparison = a.metadata.createdAt.getTime() - b.metadata.createdAt.getTime();
          break;
        case 'lastUsedAt':
          const aLastUsed = a.usage.lastUsedAt?.getTime() ?? 0;
          const bLastUsed = b.usage.lastUsedAt?.getTime() ?? 0;
          comparison = aLastUsed - bLastUsed;
          break;
        case 'expiresAt':
          const aExpires = a.expiresAt?.getTime() ?? Infinity;
          const bExpires = b.expiresAt?.getTime() ?? Infinity;
          comparison = aExpires - bExpires;
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    const total = filtered.length;
    const startIndex = (page - 1) * pageSize;
    const items = filtered.slice(startIndex, startIndex + pageSize).map((k) => ({ ...k }));

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: startIndex + pageSize < total,
    };
  }

  async recordUsage(keyId: string, _scope: ApiScope, ip: string): Promise<void> {
    const key = this.keys.get(keyId);
    if (!key) return;
    
    key.usage.totalRequests += 1;
    key.usage.lastUsedAt = new Date();
    key.usage.lastUsedIp = ip;
    key.usage.usageByScope[_scope] += 1;
  }

  async getUsage(keyId: string): Promise<ApiKeyUsage | null> {
    const key = this.keys.get(keyId);
    if (!key) return null;
    return { ...key.usage };
  }
}

export class ApiKeyManager {
  private readonly store: IApiKeyStore;
  private readonly generator: IApiKeyGenerator;
  private readonly eventHandlers: Map<ApiKeyEventType, ApiKeyEventHandler[]> = new Map();
  private readonly maxKeysPerUser: number;
  private readonly keyExpirationDefault: number | undefined;

  constructor(config: ApiKeyManagerConfig) {
    this.store = config.store;
    this.generator = config.generator;
    this.maxKeysPerUser = config.maxKeysPerUser ?? 100;
    this.keyExpirationDefault = config.keyExpirationDefault;
  }

  async createApiKey(options: CreateApiKeyOptions): Promise<CreateApiKeyResult> {
    const prefix = KEY_PREFIXES[options.keyType];
    const plainTextKey = await this.generator.generateKey(prefix);
    const hashedKey = await this.generator.hashKey(plainTextKey);

    const id = `${prefix}_${crypto.randomBytes(8).toString('hex')}`;

    const apiKey: ApiKey = {
      id,
      keyType: options.keyType,
      prefix,
      hashedKey,
      status: 'active',
      permissions: options.permissions,
      usage: {
        totalRequests: 0,
        lastUsedAt: null,
        lastUsedIp: null,
        usageByScope: { read: 0, write: 0, admin: 0 },
      },
      metadata: {
        createdAt: new Date(),
        createdBy: options.createdBy,
        description: options.description,
        environment: options.environment,
        tags: options.tags,
      },
      expiresAt: options.expiresAt ?? null,
      rotatedFrom: null,
      rotatedTo: null,
      lastRotatedAt: null,
    };

    await this.store.save(apiKey);
    await this.emitEvent('key_created', apiKey.id, { keyType: apiKey.keyType });

    return {
      apiKey: toPublicKey(apiKey),
      plainTextKey,
    };
  }

  async rotateApiKey(keyId: string, _notification?: boolean): Promise<RotateApiKeyResult> {
    const existingKey = await this.store.findById(keyId);
    if (!existingKey) {
      throw new Error('API key not found');
    }

    if (existingKey.status !== 'active') {
      throw new Error('Cannot rotate an inactive API key');
    }

    const prefix = KEY_PREFIXES[existingKey.keyType];
    const plainTextKey = await this.generator.generateKey(prefix);
    const hashedKey = await this.generator.hashKey(plainTextKey);

    const newId = `${prefix}_${crypto.randomBytes(8).toString('hex')}`;

    const rotatedKey: ApiKey = {
      id: newId,
      keyType: existingKey.keyType,
      prefix,
      hashedKey,
      status: 'active',
      permissions: existingKey.permissions,
      usage: {
        totalRequests: 0,
        lastUsedAt: null,
        lastUsedIp: null,
        usageByScope: { read: 0, write: 0, admin: 0 },
      },
      metadata: existingKey.metadata,
      expiresAt: existingKey.expiresAt,
      rotatedFrom: keyId,
      rotatedTo: null,
      lastRotatedAt: new Date(),
    };

    await this.store.save(rotatedKey);

    await this.store.update(keyId, {
      status: 'revoked',
      rotatedTo: newId,
    });

    await this.emitEvent('key_rotated', newId, { previousKeyId: keyId });

    return {
      newApiKey: toPublicKey(rotatedKey),
      plainTextKey,
      previousKeyId: keyId,
    };
  }

  async validateApiKey(plainTextKey: string): Promise<ValidateApiKeyResult> {
    const parts = plainTextKey.split('_');
    if (parts.length < 2) {
      return { isValid: false, error: 'Invalid key format', reason: 'invalid_key' };
    }

    const prefix = parts.slice(0, -1).join('_');
    const storedKey = await this.store.findByPrefix(prefix);

    if (!storedKey) {
      return { isValid: false, error: 'API key not found', reason: 'invalid_key' };
    }

    const isValid = await this.generator.verifyKey(plainTextKey, storedKey.hashedKey);
    if (!isValid) {
      return { isValid: false, error: 'Invalid API key', reason: 'invalid_key' };
    }

    if (storedKey.status === 'revoked') {
      return { isValid: false, error: 'API key has been revoked', reason: 'revoked' };
    }

    if (storedKey.status === 'suspended') {
      return { isValid: false, error: 'API key is suspended', reason: 'suspended' };
    }

    if (storedKey.expiresAt && storedKey.expiresAt < new Date()) {
      await this.store.update(storedKey.id, { status: 'expired' });
      return { isValid: false, error: 'API key has expired', reason: 'expired' };
    }

    return { isValid: true, apiKey: toPublicKey(storedKey) };
  }

  async revokeApiKey(keyId: string): Promise<boolean> {
    const key = await this.store.findById(keyId);
    if (!key) return false;

    await this.store.update(keyId, { status: 'revoked' });
    await this.emitEvent('key_revoked', keyId, { reason: 'user_requested' });
    return true;
  }

  async suspendApiKey(keyId: string): Promise<boolean> {
    const key = await this.store.findById(keyId);
    if (!key) return false;

    await this.store.update(keyId, { status: 'suspended' });
    await this.emitEvent('key_suspended', keyId);
    return true;
  }

  async reactivateApiKey(keyId: string): Promise<boolean> {
    const key = await this.store.findById(keyId);
    if (!key) return false;

    await this.store.update(keyId, { status: 'active' });
    return true;
  }

  async getApiKey(keyId: string): Promise<Omit<ApiKey, 'hashedKey'> | null> {
    const key = await this.store.findById(keyId);
    if (!key) return null;
    return toPublicKey(key);
  }

  async listApiKeys(options: ListApiKeysOptions): Promise<PaginatedResult<Omit<ApiKey, 'hashedKey'>>> {
    const result = await this.store.list(options);
    return {
      ...result,
      items: result.items.map((item) => toPublicKey(item)),
    };
  }

  async recordUsage(keyId: string, scope: ApiScope, ip: string): Promise<void> {
    await this.store.recordUsage(keyId, scope, ip);
    await this.emitEvent('key_used', keyId, { scope, ip });
  }

  async getUsageReport(keyId: string, startDate: Date, endDate: Date): Promise<UsageReport | null> {
    const usage = await this.store.getUsage(keyId);
    if (!usage) return null;

    const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const averageRequestsPerDay = usage.totalRequests / daysDiff;

    return {
      keyId,
      period: { start: startDate, end: endDate },
      totalRequests: usage.totalRequests,
      usageByScope: { ...usage.usageByScope },
      averageRequestsPerDay,
      peakUsage: null,
    };
  }

  async checkRateLimit(keyId: string, window: 'minute' | 'hour' | 'day'): Promise<RateLimitInfo> {
    const key = await this.store.findById(keyId);
    if (!key) {
      throw new Error('API key not found');
    }

    const { rateLimit } = key.permissions;
    if (!rateLimit) {
      return {
        remainingRequests: -1,
        resetAt: new Date(),
        limit: -1,
        window,
      };
    }

    let limit: number;
    let windowMs: number;

    switch (window) {
      case 'minute':
        limit = rateLimit.requestsPerMinute;
        windowMs = 60 * 1000;
        break;
      case 'hour':
        limit = rateLimit.requestsPerHour;
        windowMs = 60 * 60 * 1000;
        break;
      case 'day':
        limit = rateLimit.requestsPerDay;
        windowMs = 24 * 60 * 60 * 1000;
        break;
    }

    const now = new Date();
    const resetAt = new Date(now.getTime() + windowMs);

    return {
      remainingRequests: limit,
      resetAt,
      limit,
      window,
    };
  }

  hasScope(apiKey: Omit<ApiKey, 'hashedKey'>, requiredScope: ApiScope): boolean {
    if (apiKey.permissions.scopes.includes('admin')) {
      return true;
    }
    return apiKey.permissions.scopes.includes(requiredScope);
  }

  async deleteApiKey(keyId: string): Promise<boolean> {
    return this.store.delete(keyId);
  }

  on(eventType: ApiKeyEventType, handler: ApiKeyEventHandler): void {
    const handlers = this.eventHandlers.get(eventType) ?? [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);
  }

  off(eventType: ApiKeyEventType, handler: ApiKeyEventHandler): void {
    const handlers = this.eventHandlers.get(eventType) ?? [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  private async emitEvent(
    type: ApiKeyEventType,
    keyId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const event: ApiKeyEvent = {
      type,
      keyId,
      timestamp: new Date(),
      metadata,
    };

    const handlers = this.eventHandlers.get(type) ?? [];
    await Promise.all(handlers.map((handler) => handler(event)));
  }
}

export function createApiKeyManager(config: ApiKeyManagerConfig): ApiKeyManager {
  return new ApiKeyManager(config);
}

export { ApiKeyGenerator, InMemoryApiKeyStore };

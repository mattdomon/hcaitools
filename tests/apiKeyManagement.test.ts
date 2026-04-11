import {
  ApiKeyManager,
  ApiKeyGenerator,
  InMemoryApiKeyStore,
  createApiKeyManager,
  ApiKeyType,
  ApiScope,
  ApiKeyStatus,
  ApiKeyPermissions,
  CreateApiKeyOptions,
  ValidateApiKeyResult,
  ListApiKeysOptions,
  ApiKey,
} from '../src/core/apiKeyManagement';

describe('ApiKeyGenerator', () => {
  let generator: ApiKeyGenerator;

  beforeEach(() => {
    generator = new ApiKeyGenerator(32);
  });

  test('should generate a key with correct prefix', async () => {
    const key = await generator.generateKey('ak');
    expect(key.startsWith('ak_')).toBe(true);
  });

  test('should generate unique keys', async () => {
    const key1 = await generator.generateKey('ak');
    const key2 = await generator.generateKey('ak');
    expect(key1).not.toBe(key2);
  });

  test('should hash key consistently', async () => {
    const key = await generator.generateKey('ak');
    const hash1 = await generator.hashKey(key);
    const hash2 = await generator.hashKey(key);
    expect(hash1).toBe(hash2);
  });

  test('should verify valid key', async () => {
    const key = await generator.generateKey('ak');
    const hash = await generator.hashKey(key);
    const isValid = await generator.verifyKey(key, hash);
    expect(isValid).toBe(true);
  });

  test('should reject invalid key', async () => {
    const key = await generator.generateKey('ak');
    const hash = await generator.hashKey(key);
    const isValid = await generator.verifyKey('invalid_key', hash);
    expect(isValid).toBe(false);
  });

  test('should generate key with custom length', async () => {
    const customGenerator = new ApiKeyGenerator(16);
    const key = await customGenerator.generateKey('ak');
    const parts = key.split('_');
    expect(parts[1].length).toBe(32);
  });
});

describe('InMemoryApiKeyStore', () => {
  let store: InMemoryApiKeyStore;

  beforeEach(() => {
    store = new InMemoryApiKeyStore();
  });

  test('should save and find key by id', async () => {
    const key: ApiKey = createMockApiKey('ak_test123');
    await store.save(key);
    const found = await store.findById('ak_test123');
    expect(found).not.toBeNull();
    expect(found?.id).toBe('ak_test123');
  });

  test('should find key by prefix', async () => {
    const key: ApiKey = createMockApiKey('ak_test123', 'ak');
    await store.save(key);
    const found = await store.findByPrefix('ak');
    expect(found).not.toBeNull();
    expect(found?.id).toBe('ak_test123');
  });

  test('should return null for non-existent key', async () => {
    const found = await store.findById('nonexistent');
    expect(found).toBeNull();
  });

  test('should update existing key', async () => {
    const key: ApiKey = createMockApiKey('ak_test123');
    await store.save(key);
    await store.update('ak_test123', { status: 'revoked' });
    const found = await store.findById('ak_test123');
    expect(found?.status).toBe('revoked');
  });

  test('should delete key', async () => {
    const key: ApiKey = createMockApiKey('ak_test123');
    await store.save(key);
    const deleted = await store.delete('ak_test123');
    expect(deleted).toBe(true);
    const found = await store.findById('ak_test123');
    expect(found).toBeNull();
  });

  test('should record usage', async () => {
    const key: ApiKey = createMockApiKey('ak_test123');
    await store.save(key);
    await store.recordUsage('ak_test123', 'read', '192.168.1.1');
    const usage = await store.getUsage('ak_test123');
    expect(usage?.totalRequests).toBe(1);
    expect(usage?.usageByScope.read).toBe(1);
    expect(usage?.lastUsedIp).toBe('192.168.1.1');
  });

  test('should list keys with pagination', async () => {
    for (let i = 0; i < 15; i++) {
      const key: ApiKey = createMockApiKey(`ak_test${i}`);
      await store.save(key);
    }
    const result = await store.list({ page: 1, pageSize: 10 });
    expect(result.items.length).toBe(10);
    expect(result.total).toBe(15);
    expect(result.hasMore).toBe(true);
  });

  test('should filter keys by status', async () => {
    const key1: ApiKey = createMockApiKey('ak_test1');
    const key2: ApiKey = createMockApiKey('ak_test2', 'ak', 'revoked');
    await store.save(key1);
    await store.save(key2);
    const result = await store.list({ status: 'active' });
    expect(result.items.length).toBe(1);
    expect(result.items[0].status).toBe('active');
  });

  test('should sort keys by createdAt', async () => {
    const key1: ApiKey = createMockApiKey('ak_test1');
    const key2: ApiKey = createMockApiKey('ak_test2');
    key2.metadata.createdAt = new Date(key1.metadata.createdAt.getTime() + 1000);
    await store.save(key1);
    await store.save(key2);
    const result = await store.list({ sortBy: 'createdAt', sortOrder: 'asc' });
    expect(result.items[0].id).toBe('ak_test1');
  });
});

describe('ApiKeyManager', () => {
  let manager: ApiKeyManager;
  let store: InMemoryApiKeyStore;
  let generator: ApiKeyGenerator;

  beforeEach(() => {
    store = new InMemoryApiKeyStore();
    generator = new ApiKeyGenerator();
    manager = createApiKeyManager({ store, generator, maxKeysPerUser: 10 });
  });

  describe('createApiKey', () => {
    test('should create an API key with correct properties', async () => {
      const options: CreateApiKeyOptions = {
        keyType: 'api_key',
        permissions: { scopes: ['read', 'write'] },
        createdBy: 'user123',
        description: 'Test key',
      };
      const result = await manager.createApiKey(options);
      expect(result.plainTextKey).toBeTruthy();
      expect(result.apiKey.keyType).toBe('api_key');
      expect(result.apiKey.status).toBe('active');
      expect(result.apiKey.permissions.scopes).toEqual(['read', 'write']);
      expect(result.apiKey.metadata.createdBy).toBe('user123');
      expect(result.apiKey.metadata.description).toBe('Test key');
    });

    test('should create access_key with correct prefix', async () => {
      const options: CreateApiKeyOptions = {
        keyType: 'access_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      };
      const result = await manager.createApiKey(options);
      expect(result.apiKey.prefix).toBe('ak');
      expect(result.apiKey.id.startsWith('ak_')).toBe(true);
    });

    test('should create refresh_token with correct prefix', async () => {
      const options: CreateApiKeyOptions = {
        keyType: 'refresh_token',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      };
      const result = await manager.createApiKey(options);
      expect(result.apiKey.prefix).toBe('rt');
      expect(result.apiKey.id.startsWith('rt_')).toBe(true);
    });

    test('should set expiration date when provided', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      const options: CreateApiKeyOptions = {
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
        expiresAt: futureDate,
      };
      const result = await manager.createApiKey(options);
      expect(result.apiKey.expiresAt?.getTime()).toBe(futureDate.getTime());
    });

    test('should create key with tags', async () => {
      const options: CreateApiKeyOptions = {
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
        tags: ['production', 'api'],
      };
      const result = await manager.createApiKey(options);
      expect(result.apiKey.metadata.tags).toEqual(['production', 'api']);
    });

    test('should create key with environment', async () => {
      const options: CreateApiKeyOptions = {
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
        environment: 'production',
      };
      const result = await manager.createApiKey(options);
      expect(result.apiKey.metadata.environment).toBe('production');
    });
  });

  describe('validateApiKey', () => {
    test('should validate a valid API key', async () => {
      const { plainTextKey } = await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      });
      const result = await manager.validateApiKey(plainTextKey);
      expect(result.isValid).toBe(true);
      expect(result.apiKey).toBeTruthy();
    });

    test('should reject invalid API key', async () => {
      const result = await manager.validateApiKey('invalid_key_format');
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('invalid_key');
    });

    test('should reject revoked key', async () => {
      const { apiKey } = await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      });
      await manager.revokeApiKey(apiKey.id);
      const result = await manager.validateApiKey(
        await generator.generateKey('ap')
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('invalid_key');
    });

    test('should reject suspended key', async () => {
      const testStore = new InMemoryApiKeyStore();
      const testGenerator = new ApiKeyGenerator();
      const testManager = createApiKeyManager({ store: testStore, generator: testGenerator });
      
      const { apiKey, plainTextKey } = await testManager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      });
      await testStore.update(apiKey.id, { status: 'suspended' });
      const result = await testManager.validateApiKey(plainTextKey);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('suspended');
    });

    test('should reject expired key', async () => {
      const pastDate = new Date(Date.now() - 1000);
      const { plainTextKey } = await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
        expiresAt: pastDate,
      });
      const result = await manager.validateApiKey(plainTextKey);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('expired');
    });
  });

  describe('rotateApiKey', () => {
    test('should rotate an API key', async () => {
      const { apiKey } = await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      });
      const result = await manager.rotateApiKey(apiKey.id);
      expect(result.plainTextKey).toBeTruthy();
      expect(result.previousKeyId).toBe(apiKey.id);
      expect(result.newApiKey.rotatedFrom).toBe(apiKey.id);
    });

    test('should revoke old key after rotation', async () => {
      const { apiKey } = await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      });
      await manager.rotateApiKey(apiKey.id);
      const oldKey = await manager.getApiKey(apiKey.id);
      expect(oldKey?.status).toBe('revoked');
    });

    test('should link rotated keys', async () => {
      const { apiKey } = await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      });
      const result = await manager.rotateApiKey(apiKey.id);
      expect(result.newApiKey.rotatedFrom).toBe(apiKey.id);
      expect(result.newApiKey.rotatedTo).toBeNull();
      const oldKey = await manager.getApiKey(apiKey.id);
      expect(oldKey?.rotatedTo).toBe(result.newApiKey.id);
    });

    test('should throw error for non-existent key', async () => {
      await expect(manager.rotateApiKey('nonexistent')).rejects.toThrow(
        'API key not found'
      );
    });

    test('should throw error for revoked key', async () => {
      const { apiKey } = await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      });
      await manager.revokeApiKey(apiKey.id);
      await expect(manager.rotateApiKey(apiKey.id)).rejects.toThrow(
        'Cannot rotate an inactive API key'
      );
    });
  });

  describe('revokeApiKey', () => {
    test('should revoke an API key', async () => {
      const { apiKey } = await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      });
      const result = await manager.revokeApiKey(apiKey.id);
      expect(result).toBe(true);
      const key = await manager.getApiKey(apiKey.id);
      expect(key?.status).toBe('revoked');
    });

    test('should return false for non-existent key', async () => {
      const result = await manager.revokeApiKey('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('suspendApiKey', () => {
    test('should suspend an API key', async () => {
      const { apiKey } = await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      });
      const result = await manager.suspendApiKey(apiKey.id);
      expect(result).toBe(true);
      const key = await manager.getApiKey(apiKey.id);
      expect(key?.status).toBe('suspended');
    });
  });

  describe('reactivateApiKey', () => {
    test('should reactivate a suspended API key', async () => {
      const { apiKey } = await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      });
      await manager.suspendApiKey(apiKey.id);
      const result = await manager.reactivateApiKey(apiKey.id);
      expect(result).toBe(true);
      const key = await manager.getApiKey(apiKey.id);
      expect(key?.status).toBe('active');
    });
  });

  describe('hasScope', () => {
    test('should return true for key with required scope', async () => {
      const { apiKey } = await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read', 'write'] },
        createdBy: 'user123',
      });
      expect(manager.hasScope(apiKey, 'read')).toBe(true);
      expect(manager.hasScope(apiKey, 'write')).toBe(true);
    });

    test('should return false for key without required scope', async () => {
      const { apiKey } = await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      });
      expect(manager.hasScope(apiKey, 'write')).toBe(false);
    });

    test('should return true for admin scope regardless of permissions', async () => {
      const { apiKey } = await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['admin'] },
        createdBy: 'user123',
      });
      expect(manager.hasScope(apiKey, 'read')).toBe(true);
      expect(manager.hasScope(apiKey, 'write')).toBe(true);
      expect(manager.hasScope(apiKey, 'admin')).toBe(true);
    });
  });

  describe('getUsageReport', () => {
    test('should return usage report', async () => {
      const { apiKey } = await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      });
      await manager.recordUsage(apiKey.id, 'read', '192.168.1.1');
      const report = await manager.getUsageReport(
        apiKey.id,
        new Date(Date.now() - 86400000),
        new Date()
      );
      expect(report).not.toBeNull();
      expect(report?.totalRequests).toBe(1);
      expect(report?.usageByScope.read).toBe(1);
    });

    test('should return null for non-existent key', async () => {
      const report = await manager.getUsageReport(
        'nonexistent',
        new Date(Date.now() - 86400000),
        new Date()
      );
      expect(report).toBeNull();
    });
  });

  describe('checkRateLimit', () => {
    test('should return rate limit info', async () => {
      const { apiKey } = await manager.createApiKey({
        keyType: 'api_key',
        permissions: {
          scopes: ['read'],
          rateLimit: { requestsPerMinute: 100, requestsPerHour: 1000, requestsPerDay: 10000 },
        },
        createdBy: 'user123',
      });
      const info = await manager.checkRateLimit(apiKey.id, 'minute');
      expect(info.limit).toBe(100);
      expect(info.window).toBe('minute');
    });

    test('should throw error for non-existent key', async () => {
      await expect(manager.checkRateLimit('nonexistent', 'minute')).rejects.toThrow(
        'API key not found'
      );
    });
  });

  describe('event handling', () => {
    test('should emit key_created event', async () => {
      let eventEmitted = false;
      manager.on('key_created', async (event) => {
        eventEmitted = true;
        expect(event.type).toBe('key_created');
      });
      await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      });
      expect(eventEmitted).toBe(true);
    });

    test('should emit key_rotated event', async () => {
      const { apiKey } = await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      });
      let eventEmitted = false;
      manager.on('key_rotated', async (event) => {
        eventEmitted = true;
        expect(event.type).toBe('key_rotated');
      });
      await manager.rotateApiKey(apiKey.id);
      expect(eventEmitted).toBe(true);
    });

    test('should allow removing event handlers', async () => {
      let callCount = 0;
      const handler = async () => { callCount++; };
      manager.on('key_created', handler);
      manager.off('key_created', handler);
      await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      });
      expect(callCount).toBe(0);
    });
  });

  describe('deleteApiKey', () => {
    test('should delete an API key', async () => {
      const { apiKey } = await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      });
      const result = await manager.deleteApiKey(apiKey.id);
      expect(result).toBe(true);
      const found = await manager.getApiKey(apiKey.id);
      expect(found).toBeNull();
    });

    test('should return false for non-existent key', async () => {
      const result = await manager.deleteApiKey('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('listApiKeys', () => {
    test('should list API keys with pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await manager.createApiKey({
          keyType: 'api_key',
          permissions: { scopes: ['read'] },
          createdBy: 'user123',
        });
      }
      const result = await manager.listApiKeys({ page: 1, pageSize: 3 });
      expect(result.items.length).toBe(3);
      expect(result.total).toBe(5);
      expect(result.hasMore).toBe(true);
    });

    test('should filter by createdBy', async () => {
      await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      });
      await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user456',
      });
      const result = await manager.listApiKeys({ createdBy: 'user123' });
      expect(result.total).toBe(1);
      expect(result.items[0].metadata.createdBy).toBe('user123');
    });

    test('should filter by keyType', async () => {
      await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      });
      await manager.createApiKey({
        keyType: 'access_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      });
      const result = await manager.listApiKeys({ keyType: 'api_key' });
      expect(result.total).toBe(1);
      expect(result.items[0].keyType).toBe('api_key');
    });

    test('should filter by status', async () => {
      const { apiKey } = await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      });
      await manager.createApiKey({
        keyType: 'api_key',
        permissions: { scopes: ['read'] },
        createdBy: 'user123',
      });
      await manager.revokeApiKey(apiKey.id);
      const result = await manager.listApiKeys({ status: 'active' });
      expect(result.total).toBe(1);
    });
  });
});

function createMockApiKey(
  id: string,
  prefix: string = 'ak',
  status: ApiKeyStatus = 'active'
): ApiKey {
  return {
    id,
    keyType: 'api_key',
    prefix,
    hashedKey: 'mockhashedkey',
    status,
    permissions: {
      scopes: ['read'] as ApiScope[],
      resources: ['*'],
      rateLimit: {
        requestsPerMinute: 100,
        requestsPerHour: 1000,
        requestsPerDay: 10000,
      },
    },
    usage: {
      totalRequests: 0,
      lastUsedAt: null,
      lastUsedIp: null,
      usageByScope: { read: 0, write: 0, admin: 0 },
    },
    metadata: {
      createdAt: new Date(),
      createdBy: 'testuser',
      description: 'Test key',
      environment: 'test',
      tags: ['test'],
    },
    expiresAt: null,
    rotatedFrom: null,
    rotatedTo: null,
    lastRotatedAt: null,
  };
}

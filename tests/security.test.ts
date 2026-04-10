/**
 * Security & Encryption System Tests
 */

import {
  SecurityService,
  createSecurityService,
  InMemoryKeyStore,
  SecurityAuditLogger,
  KeyManager,
  EncryptionService,
  HashingService,
  SignatureService,
  DataMaskingService,
  TokenService,
  SecurityPolicyManager,
  EncryptionKey,
  EncryptedData,
  DecryptedData,
  DigitalSignature,
  HashResult,
  MaskedData,
  TokenInfo,
  SecurityAuditLog,
  AuditFilter,
  AuditStats,
  SecurityPolicy,
  AuditEventType,
  EncryptionAlgorithm,
  HashAlgorithm,
  SignatureAlgorithm,
  MaskingOptions,
  TokenType,
  isEncryptionAlgorithm,
  isHashAlgorithm,
  isKeyStatus,
  isMaskingType,
  isTokenType,
  isSignatureAlgorithm,
  isAuditEventType,
  generateSecurityId,
  generateCryptoId,
  isValidKeyId,
  isExpiredKey,
  isActiveKey,
  KEY_ERROR_CODES,
} from '../src/core/security';

describe('Security & Encryption System', () => {
  describe('Type Guards', () => {
    test('isEncryptionAlgorithm correctly identifies valid algorithms', () => {
      expect(isEncryptionAlgorithm('aes-256-gcm')).toBe(true);
      expect(isEncryptionAlgorithm('aes-256-cbc')).toBe(true);
      expect(isEncryptionAlgorithm('rsa-2048')).toBe(true);
      expect(isEncryptionAlgorithm('rsa-4096')).toBe(true);
    });

    test('isEncryptionAlgorithm correctly rejects invalid algorithms', () => {
      expect(isEncryptionAlgorithm('aes-128')).toBe(false);
      expect(isEncryptionAlgorithm('des')).toBe(false);
      expect(isEncryptionAlgorithm('AES-256-GCM')).toBe(false);
      expect(isEncryptionAlgorithm(123 as unknown as string)).toBe(false);
    });

    test('isHashAlgorithm correctly identifies valid algorithms', () => {
      expect(isHashAlgorithm('sha-256')).toBe(true);
      expect(isHashAlgorithm('sha-512')).toBe(true);
      expect(isHashAlgorithm('bcrypt')).toBe(true);
      expect(isHashAlgorithm('argon2')).toBe(true);
    });

    test('isHashAlgorithm correctly rejects invalid algorithms', () => {
      expect(isHashAlgorithm('md5')).toBe(false);
      expect(isHashAlgorithm('sha-1')).toBe(false);
      expect(isHashAlgorithm('SHA-256')).toBe(false);
    });

    test('isKeyStatus correctly identifies valid statuses', () => {
      expect(isKeyStatus('active')).toBe(true);
      expect(isKeyStatus('expired')).toBe(true);
      expect(isKeyStatus('revoked')).toBe(true);
      expect(isKeyStatus('destroyed')).toBe(true);
    });

    test('isKeyStatus correctly rejects invalid statuses', () => {
      expect(isKeyStatus('pending')).toBe(false);
      expect(isKeyStatus('ACTIVE')).toBe(false);
      expect(isKeyStatus('locked')).toBe(false);
    });

    test('isMaskingType correctly identifies valid types', () => {
      expect(isMaskingType('partial')).toBe(true);
      expect(isMaskingType('full')).toBe(true);
      expect(isMaskingType('format-preserving')).toBe(true);
    });

    test('isTokenType correctly identifies valid types', () => {
      expect(isTokenType('random')).toBe(true);
      expect(isTokenType('sequential')).toBe(true);
      expect(isTokenType('pooled')).toBe(true);
    });

    test('isSignatureAlgorithm correctly identifies valid algorithms', () => {
      expect(isSignatureAlgorithm('RSA-SHA256')).toBe(true);
      expect(isSignatureAlgorithm('RSA-SHA512')).toBe(true);
      expect(isSignatureAlgorithm('HMAC-SHA256')).toBe(true);
      expect(isSignatureAlgorithm('HMAC-SHA512')).toBe(true);
    });

    test('isAuditEventType correctly identifies valid event types', () => {
      expect(isAuditEventType('key_generated')).toBe(true);
      expect(isAuditEventType('encryption_performed')).toBe(true);
      expect(isAuditEventType('decryption_performed')).toBe(true);
      expect(isAuditEventType('data_masked')).toBe(true);
    });
  });

  describe('ID Generation', () => {
    test('generateSecurityId creates unique IDs', () => {
      const id1 = generateSecurityId();
      const id2 = generateSecurityId();
      expect(id1).not.toBe(id2);
    });

    test('generateSecurityId uses provided prefix', () => {
      const id = generateSecurityId('TEST');
      expect(id.startsWith('TEST_')).toBe(true);
    });

    test('generateCryptoId creates unique IDs', () => {
      const id1 = generateCryptoId();
      const id2 = generateCryptoId();
      expect(id1).not.toBe(id2);
    });

    test('generateCryptoId uses provided prefix', () => {
      const id = generateCryptoId('KEY');
      expect(id.startsWith('KEY_')).toBe(true);
    });

    test('isValidKeyId validates key IDs correctly', () => {
      expect(isValidKeyId('KEY_abc123')).toBe(true);
      expect(isValidKeyId('KEY_test')).toBe(true);
      expect(isValidKeyId('')).toBe(false);
      expect(isValidKeyId('nounderscore')).toBe(false);
    });
  });

  describe('Key Expiration Helpers', () => {
    test('isExpiredKey returns false for keys without expiration', () => {
      const key: EncryptionKey = {
        id: 'KEY_test',
        name: 'Test Key',
        algorithm: 'aes',
        keyType: 'aes-256-gcm',
        keyMaterial: 'abc123',
        createdAt: new Date(),
        status: 'active',
      };
      expect(isExpiredKey(key)).toBe(false);
    });

    test('isExpiredKey returns true for expired keys', () => {
      const key: EncryptionKey = {
        id: 'KEY_test',
        name: 'Test Key',
        algorithm: 'aes',
        keyType: 'aes-256-gcm',
        keyMaterial: 'abc123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() - 1000),
        status: 'active',
      };
      expect(isExpiredKey(key)).toBe(true);
    });

    test('isActiveKey returns true for active non-expired keys', () => {
      const key: EncryptionKey = {
        id: 'KEY_test',
        name: 'Test Key',
        algorithm: 'aes',
        keyType: 'aes-256-gcm',
        keyMaterial: 'abc123',
        createdAt: new Date(),
        status: 'active',
      };
      expect(isActiveKey(key)).toBe(true);
    });

    test('isActiveKey returns false for revoked keys', () => {
      const key: EncryptionKey = {
        id: 'KEY_test',
        name: 'Test Key',
        algorithm: 'aes',
        keyType: 'aes-256-gcm',
        keyMaterial: 'abc123',
        createdAt: new Date(),
        status: 'revoked',
      };
      expect(isActiveKey(key)).toBe(false);
    });
  });

  describe('InMemoryKeyStore', () => {
    test('stores and retrieves keys', async () => {
      const store = new InMemoryKeyStore();
      const key: EncryptionKey = {
        id: 'KEY_test',
        name: 'Test Key',
        algorithm: 'aes',
        keyType: 'aes-256-gcm',
        keyMaterial: 'abc123',
        createdAt: new Date(),
        status: 'active',
      };

      await store.storeKey(key);
      const retrieved = await store.getKey('KEY_test');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('KEY_test');
    });

    test('returns null for non-existent keys', async () => {
      const store = new InMemoryKeyStore();
      const retrieved = await store.getKey('NON_EXISTENT');
      expect(retrieved).toBeNull();
    });

    test('deletes keys', async () => {
      const store = new InMemoryKeyStore();
      const key: EncryptionKey = {
        id: 'KEY_test',
        name: 'Test Key',
        algorithm: 'aes',
        keyType: 'aes-256-gcm',
        keyMaterial: 'abc123',
        createdAt: new Date(),
        status: 'active',
      };

      await store.storeKey(key);
      await store.deleteKey('KEY_test');
      const retrieved = await store.getKey('KEY_test');

      expect(retrieved).toBeNull();
    });

    test('lists keys by status', async () => {
      const store = new InMemoryKeyStore();
      await store.storeKey({
        id: 'KEY_active',
        name: 'Active Key',
        algorithm: 'aes',
        keyType: 'aes-256-gcm',
        keyMaterial: 'abc123',
        createdAt: new Date(),
        status: 'active',
      });
      await store.storeKey({
        id: 'KEY_revoked',
        name: 'Revoked Key',
        algorithm: 'aes',
        keyType: 'aes-256-gcm',
        keyMaterial: 'abc123',
        createdAt: new Date(),
        status: 'revoked',
      });

      const activeKeys = await store.listKeys('active');
      const revokedKeys = await store.listKeys('revoked');

      expect(activeKeys).toHaveLength(1);
      expect(activeKeys[0].id).toBe('KEY_active');
      expect(revokedKeys).toHaveLength(1);
      expect(revokedKeys[0].id).toBe('KEY_revoked');
    });
  });

  describe('SecurityAuditLogger', () => {
    test('logs audit events', () => {
      const logger = new SecurityAuditLogger();
      const log = logger.log({
        eventType: 'key_generated',
        action: 'generate_key',
        resourceType: 'encryption_key',
        resourceId: 'KEY_test',
        success: true,
      });

      expect(log.id).toBeDefined();
      expect(log.timestamp).toBeInstanceOf(Date);
      expect(log.eventType).toBe('key_generated');
    });

    test('filters audit logs by event type', () => {
      const logger = new SecurityAuditLogger();
      logger.log({ eventType: 'key_generated', action: 'generate', resourceType: 'key', success: true });
      logger.log({ eventType: 'encryption_performed', action: 'encrypt', resourceType: 'data', success: true });

      const filtered = logger.getLogs({ eventTypes: ['key_generated'] });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].eventType).toBe('key_generated');
    });

    test('filters audit logs by resource type', () => {
      const logger = new SecurityAuditLogger();
      logger.log({ eventType: 'key_generated', action: 'generate', resourceType: 'key', success: true });
      logger.log({ eventType: 'encryption_performed', action: 'encrypt', resourceType: 'data', success: true });

      const filtered = logger.getLogs({ resourceType: 'key' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].resourceType).toBe('key');
    });

    test('calculates audit stats', () => {
      const logger = new SecurityAuditLogger();
      logger.log({ eventType: 'key_generated', action: 'generate', resourceType: 'key', success: true });
      logger.log({ eventType: 'key_generated', action: 'generate', resourceType: 'key', success: true });
      logger.log({ eventType: 'encryption_performed', action: 'encrypt', resourceType: 'data', success: false });

      const stats = logger.getStats();
      expect(stats.totalEvents).toBe(3);
      expect(stats.eventsByType['key_generated']).toBe(2);
      expect(stats.eventsByType['encryption_performed']).toBe(1);
      expect(stats.failedEvents).toBe(1);
    });
  });

  describe('KeyManager', () => {
    test('generates AES keys', async () => {
      const manager = new KeyManager();
      const key = await manager.generateKey({
        algorithm: 'aes-256-gcm',
        name: 'Test Key',
      });

      expect(key.id).toBeDefined();
      expect(key.name).toBe('Test Key');
      expect(key.keyType).toBe('aes-256-gcm');
      expect(key.status).toBe('active');
      expect(key.keyMaterial).toBeDefined();
    });

    test('generates RSA keys', async () => {
      const manager = new KeyManager();
      const key = await manager.generateKey({
        algorithm: 'rsa-2048',
        name: 'RSA Key',
      });

      expect(key.id).toBeDefined();
      expect(key.keyType).toBe('rsa-2048');
      expect(key.algorithm).toBe('rsa');
    });

    test('generates keys with expiration', async () => {
      const manager = new KeyManager();
      const key = await manager.generateKey({
        algorithm: 'aes-256-gcm',
        name: 'Expiring Key',
        expiresInMs: 60000,
      });

      expect(key.expiresAt).toBeDefined();
      expect(key.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });

    test('rotates keys', async () => {
      const manager = new KeyManager();
      const originalKey = await manager.generateKey({
        algorithm: 'aes-256-gcm',
        name: 'Original Key',
      });

      const newKey = await manager.rotateKey(originalKey.id);
      expect(newKey).not.toBeNull();
      expect(newKey!.id).not.toBe(originalKey.id);
    });

    test('destroys keys', async () => {
      const manager = new KeyManager();
      const key = await manager.generateKey({
        algorithm: 'aes-256-gcm',
        name: 'To Destroy',
      });

      const destroyed = await manager.destroyKey(key.id);
      expect(destroyed).toBe(true);

      const retrieved = await manager.getKey(key.id);
      expect(retrieved?.status).toBe('destroyed');
    });
  });

  describe('EncryptionService', () => {
    test('encrypts and decrypts with AES-256-GCM', async () => {
      const service = createSecurityService();
      const key = await service.generateKey({ algorithm: 'aes-256-gcm', name: 'Test Key' });

      const plaintext = 'Hello, World!';
      const encrypted = await service.encrypt(plaintext, key.id);
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();

      const decrypted = await service.decrypt(encrypted, key.id);
      expect(decrypted.plaintext).toBe(plaintext);
    });

    test('encrypts and decrypts with AES-256-CBC', async () => {
      const service = createSecurityService();
      const key = await service.generateKey({ algorithm: 'aes-256-cbc', name: 'Test Key' });

      const plaintext = 'Sensitive Data';
      const encrypted = await service.encrypt(plaintext, key.id);
      const decrypted = await service.decrypt(encrypted, key.id);

      expect(decrypted.plaintext).toBe(plaintext);
    });

    test('throws error for invalid key', async () => {
      const service = createSecurityService();
      const key = await service.generateKey({ algorithm: 'aes-256-gcm', name: 'Test Key' });

      await service.destroyKey(key.id);

      await expect(
        service.encrypt('test', key.id)
      ).rejects.toThrow();
    });
  });

  describe('HashingService', () => {
    test('hashes data with SHA-256', () => {
      const service = createSecurityService();
      const result = service.hash('test data', 'sha-256');

      expect(result.hash).toBeDefined();
      expect(result.algorithm).toBe('sha-256');
      expect(result.id).toBeDefined();
    });

    test('hashes data with SHA-512', () => {
      const service = createSecurityService();
      const result = service.hash('test data', 'sha-512');

      expect(result.hash).toBeDefined();
      expect(result.algorithm).toBe('sha-512');
    });

    test('verifies hash correctly', () => {
      const service = createSecurityService();
      const result = service.hash('test data', 'sha-256');
      const isValid = service.verifyHash('test data', result);

      expect(isValid).toBe(true);
    });

    test('verifies hash correctly returns false for wrong data', () => {
      const service = createSecurityService();
      const result = service.hash('test data', 'sha-256');
      const isValid = service.verifyHash('wrong data', result);

      expect(isValid).toBe(false);
    });

    test('generates salted hashes for bcrypt', () => {
      const service = createSecurityService();
      const result = service.hash('test data', 'bcrypt');

      expect(result.salt).toBeDefined();
      expect(result.hash).toBeDefined();
    });
  });

  describe('SignatureService', () => {
    test('creates and verifies digital signatures', async () => {
      const service = createSecurityService();
      const key = await service.generateKey({ algorithm: 'rsa-2048', name: 'Signing Key' });

      const data = 'Data to sign';
      const signature = await service.sign(data, key.id, 'RSA-SHA256');
      expect(signature.signature).toBeDefined();
      expect(signature.algorithm).toBe('RSA-SHA256');

      const verification = await service.verifySignature(data, signature);
      expect(verification.isValid).toBe(true);
    });

    test('verification fails for tampered data', async () => {
      const service = createSecurityService();
      const key = await service.generateKey({ algorithm: 'rsa-2048', name: 'Signing Key' });

      const data = 'Original data';
      const signature = await service.sign(data, key.id, 'RSA-SHA256');

      const verification = await service.verifySignature('Tampered data', signature);
      expect(verification.isValid).toBe(false);
    });
  });

  describe('DataMaskingService', () => {
    test('fully masks data', () => {
      const service = createSecurityService();
      const result = service.mask('1234567890', { type: 'full' });

      expect(result.maskedValue).toBe('**********');
      expect(result.maskingType).toBe('full');
    });

    test('partially masks data', () => {
      const service = createSecurityService();
      const result = service.mask('1234567890', {
        type: 'partial',
        visibleCharsStart: 2,
        visibleCharsEnd: 2,
      });

      expect(result.maskedValue).toBe('12******90');
      expect(result.maskingType).toBe('partial');
    });

    test('masks emails correctly', () => {
      const service = createSecurityService();
      const masked = service.maskEmail('john.doe@example.com');

      expect(masked).toContain('@');
      expect(masked).not.toContain('john');
    });

    test('masks credit card numbers correctly', () => {
      const service = createSecurityService();
      const masked = service.maskCreditCard('4111111111111111');

      expect(masked).toContain('1111');
      expect(masked).not.toContain('4111');
    });

    test('masks phone numbers correctly', () => {
      const service = createSecurityService();
      const masked = service.maskPhone('1234567890');

      expect(masked).toBeDefined();
      expect(masked).not.toContain('1234567890');
    });
  });

  describe('TokenService', () => {
    test('generates random tokens', () => {
      const service = createSecurityService();
      const token = service.generateToken('random');

      expect(token.token).toBeDefined();
      expect(token.type).toBe('random');
      expect(token.id).toBeDefined();
    });

    test('generates sequential tokens', () => {
      const service = createSecurityService();
      const token = service.generateToken('sequential');

      expect(token.token).toBeDefined();
      expect(token.type).toBe('sequential');
    });

    test('validates tokens correctly', () => {
      const service = createSecurityService();
      const tokenInfo = service.generateToken('random');

      const result = service.validateToken(tokenInfo.token);
      expect(result.isValid).toBe(true);
    });

    test('validates expired tokens', () => {
      const service = createSecurityService();
      const tokenInfo = service.generateToken('random', -1000);

      const result = service.validateToken(tokenInfo.token);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    test('creates token pools', () => {
      const service = createSecurityService();
      const pool = service.createTokenPool('Test Pool', 10);

      expect(pool.id).toBeDefined();
      expect(pool.tokens).toHaveLength(10);
      expect(pool.name).toBe('Test Pool');
    });

    test('retrieves tokens from pool', () => {
      const service = createSecurityService();
      const pool = service.createTokenPool('Test Pool', 5);

      const token = service.getTokenFromPool(pool.id);
      expect(token).toBeDefined();

      const poolAfter = service.getPool(pool.id);
      expect(poolAfter?.tokens).toHaveLength(5);
    });
  });

  describe('SecurityPolicyManager', () => {
    test('validates password policy', () => {
      const manager = new SecurityPolicyManager();
      const result = manager.validatePassword('Weak');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('validates strong password', () => {
      const manager = new SecurityPolicyManager();
      const result = manager.validatePassword('StrongP@ss123');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validates allowed algorithms', () => {
      const manager = new SecurityPolicyManager();
      expect(manager.validateAlgorithm('aes-256-gcm')).toBe(true);
      expect(manager.validateAlgorithm('aes-256-cbc')).toBe(true);
    });

    test('creates custom policies', () => {
      const manager = new SecurityPolicyManager();
      const policy: SecurityPolicy = {
        id: 'custom',
        name: 'Custom Policy',
        minKeyLength: 512,
        requireKeyRotation: true,
        allowedAlgorithms: ['aes-256-gcm'],
        hashAlgorithms: ['sha-256'],
        passwordMinLength: 12,
        requireSpecialChars: true,
        requireNumbers: true,
        requireUppercase: true,
        maxLoginAttempts: 3,
        lockoutDurationMs: 600000,
        enableAuditLogging: true,
      };

      manager.createPolicy(policy);
      const retrieved = manager.getPolicy('custom');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.minKeyLength).toBe(512);
    });
  });

  describe('SecurityService Integration', () => {
    test('complete encryption workflow', async () => {
      const service = createSecurityService();

      const key = await service.generateKey({ algorithm: 'aes-256-gcm', name: 'Workflow Key' });
      const plaintext = 'Integration Test Data';
      const encrypted = await service.encrypt(plaintext, key.id);
      const decrypted = await service.decrypt(encrypted, key.id);

      expect(decrypted.plaintext).toBe(plaintext);
    });

    test('complete hashing workflow', () => {
      const service = createSecurityService();
      const hash = service.hash('test data');
      const isValid = service.verifyHash('test data', hash);

      expect(isValid).toBe(true);
    });

    test('SecurityService creates and manages keys', async () => {
      const service = createSecurityService();
      const key = await service.generateKey({ algorithm: 'aes-256-gcm', name: 'Test Key' });
      
      expect(key.id).toBeDefined();
      expect(key.status).toBe('active');
    });

    test('SecurityService creates and verifies hashes', () => {
      const service = createSecurityService();
      const hash = service.hash('test data');
      const isValid = service.verifyHash('test data', hash);

      expect(isValid).toBe(true);
    });
  });
});

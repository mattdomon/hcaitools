/**
 * Security & Encryption System Implementation
 */

import * as crypto from 'crypto';
import {
  EncryptionAlgorithm,
  HashAlgorithm,
  EncryptionKey,
  KeyGenerationOptions,
  EncryptedData,
  DecryptedData,
  DigitalSignature,
  SignatureVerification,
  HashResult,
  MaskedData,
  TokenInfo,
  TokenPool,
  SecurityAuditLog,
  AuditEventType,
  AuditFilter,
  AuditStats,
  SecurityPolicy,
  SecurityConfig,
  MaskingOptions,
  TokenValidationResult,
  KeyStatus,
  SignatureAlgorithm,
  TokenType,
  DEFAULT_SECURITY_CONFIG,
  generateSecurityId,
  generateCryptoId,
} from './types';

export class InMemoryKeyStore {
  private keys: Map<string, EncryptionKey> = new Map();

  async getKey(id: string): Promise<EncryptionKey | null> {
    return this.keys.get(id) || null;
  }

  async storeKey(key: EncryptionKey): Promise<void> {
    this.keys.set(key.id, key);
  }

  async deleteKey(id: string): Promise<void> {
    this.keys.delete(id);
  }

  async listKeys(status?: KeyStatus): Promise<EncryptionKey[]> {
    const allKeys = Array.from(this.keys.values());
    if (!status) {
      return allKeys;
    }
    return allKeys.filter((k) => k.status === status);
  }

  async updateKeyStatus(id: string, status: KeyStatus): Promise<void> {
    const key = this.keys.get(id);
    if (key) {
      key.status = status;
      this.keys.set(id, key);
    }
  }

  async clear(): Promise<void> {
    this.keys.clear();
  }
}

export class SecurityAuditLogger {
  private logs: SecurityAuditLog[] = [];
  private maxLogs: number;

  constructor(maxLogs: number = 10000) {
    this.maxLogs = maxLogs;
  }

  log(event: Omit<SecurityAuditLog, 'id' | 'timestamp'>): SecurityAuditLog {
    const entry: SecurityAuditLog = {
      ...event,
      id: generateSecurityId('AUDIT'),
      timestamp: new Date(),
    };

    this.logs.push(entry);

    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    return entry;
  }

  getLogs(filter?: AuditFilter): SecurityAuditLog[] {
    let results = [...this.logs];

    if (filter) {
      if (filter.eventTypes && filter.eventTypes.length > 0) {
        results = results.filter((l) => filter.eventTypes!.includes(l.eventType));
      }

      if (filter.startTime) {
        results = results.filter((l) => l.timestamp >= filter.startTime!);
      }

      if (filter.endTime) {
        results = results.filter((l) => l.timestamp <= filter.endTime!);
      }

      if (filter.userId) {
        results = results.filter((l) => l.userId === filter.userId);
      }

      if (filter.sessionId) {
        results = results.filter((l) => l.sessionId === filter.sessionId);
      }

      if (filter.resourceType) {
        results = results.filter((l) => l.resourceType === filter.resourceType);
      }

      if (filter.success !== undefined) {
        results = results.filter((l) => l.success === filter.success);
      }
    }

    return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getStats(filter?: AuditFilter): AuditStats {
    const logs = filter ? this.getLogs(filter) : this.logs;

    const eventsByType: Record<AuditEventType, number> = {} as Record<AuditEventType, number>;
    const eventsByUser: Record<string, number> = {};
    let failedEvents = 0;

    for (const log of logs) {
      eventsByType[log.eventType] = (eventsByType[log.eventType] || 0) + 1;

      if (log.userId) {
        eventsByUser[log.userId] = (eventsByUser[log.userId] || 0) + 1;
      }

      if (!log.success) {
        failedEvents++;
      }
    }

    return {
      totalEvents: logs.length,
      eventsByType,
      eventsByUser,
      successRate: logs.length > 0 ? (logs.length - failedEvents) / logs.length : 1,
      failedEvents,
      startTime: logs.length > 0 ? logs[logs.length - 1].timestamp : new Date(),
      endTime: logs.length > 0 ? logs[0].timestamp : new Date(),
    };
  }

  clear(): void {
    this.logs = [];
  }

  size(): number {
    return this.logs.length;
  }
}

export class KeyManager {
  private store: InMemoryKeyStore;
  private auditLogger: SecurityAuditLogger;

  constructor(store?: InMemoryKeyStore, auditLogger?: SecurityAuditLogger) {
    this.store = store || new InMemoryKeyStore();
    this.auditLogger = auditLogger || new SecurityAuditLogger();
  }

  async generateKey(options: KeyGenerationOptions): Promise<EncryptionKey> {
    let keyMaterial: string;
    let keyLength: number;

    switch (options.algorithm) {
      case 'aes-256-gcm':
      case 'aes-256-cbc':
        keyLength = 32;
        keyMaterial = crypto.randomBytes(keyLength).toString('base64');
        break;
      case 'rsa-2048':
        const key2048 = crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });
        keyMaterial = key2048.privateKey;
        break;
      case 'rsa-4096':
        const key4096 = crypto.generateKeyPairSync('rsa', {
          modulusLength: 4096,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });
        keyMaterial = key4096.privateKey;
        break;
      default:
        keyLength = 32;
        keyMaterial = crypto.randomBytes(keyLength).toString('base64');
    }

    const isRsa = options.algorithm === 'rsa-2048' || options.algorithm === 'rsa-4096';
    const key: EncryptionKey = {
      id: generateCryptoId('KEY'),
      name: options.name,
      algorithm: options.keyType || (isRsa ? 'rsa' : 'aes'),
      keyType: options.algorithm,
      keyMaterial,
      createdAt: new Date(),
      expiresAt: options.expiresInMs
        ? new Date(Date.now() + options.expiresInMs)
        : undefined,
      status: 'active',
      metadata: options.metadata,
    };

    await this.store.storeKey(key);

    this.auditLogger.log({
      eventType: 'key_generated',
      action: 'generate_key',
      resourceType: 'encryption_key',
      resourceId: key.id,
      success: true,
      metadata: { algorithm: options.algorithm, name: options.name },
    });

    return key;
  }

  async getKey(keyId: string): Promise<EncryptionKey | null> {
    const key = await this.store.getKey(keyId);

    this.auditLogger.log({
      eventType: 'key_accessed',
      action: 'get_key',
      resourceType: 'encryption_key',
      resourceId: keyId,
      success: !!key,
      metadata: { found: !!key },
    });

    return key;
  }

  async rotateKey(keyId: string): Promise<EncryptionKey | null> {
    const oldKey = await this.store.getKey(keyId);
    if (!oldKey) {
      return null;
    }

    await this.store.updateKeyStatus(keyId, 'revoked');

    const newKey = await this.generateKey({
      algorithm: oldKey.keyType,
      name: `${oldKey.name}_rotated`,
      keyType: oldKey.algorithm,
      expiresInMs: oldKey.expiresAt
        ? oldKey.expiresAt.getTime() - Date.now()
        : undefined,
    });

    this.auditLogger.log({
      eventType: 'key_rotated',
      action: 'rotate_key',
      resourceType: 'encryption_key',
      resourceId: keyId,
      success: true,
      metadata: { newKeyId: newKey.id },
    });

    return newKey;
  }

  async destroyKey(keyId: string): Promise<boolean> {
    const key = await this.store.getKey(keyId);
    if (!key) {
      return false;
    }

    key.status = 'destroyed';
    key.keyMaterial = '';
    await this.store.updateKeyStatus(keyId, 'destroyed');

    this.auditLogger.log({
      eventType: 'key_destroyed',
      action: 'destroy_key',
      resourceType: 'encryption_key',
      resourceId: keyId,
      success: true,
    });

    return true;
  }

  async listKeys(status?: KeyStatus): Promise<EncryptionKey[]> {
    return this.store.listKeys(status);
  }

  async revokeKey(keyId: string): Promise<boolean> {
    const key = await this.store.getKey(keyId);
    if (!key) {
      return false;
    }

    await this.store.updateKeyStatus(keyId, 'revoked');

    this.auditLogger.log({
      eventType: 'key_destroyed',
      action: 'revoke_key',
      resourceType: 'encryption_key',
      resourceId: keyId,
      success: true,
    });

    return true;
  }

  isKeyValid(key: EncryptionKey): boolean {
    if (key.status === 'destroyed' || key.status === 'revoked') {
      return false;
    }

    if (key.expiresAt && new Date() > key.expiresAt) {
      return false;
    }

    return true;
  }
}

export class EncryptionService {
  private keyManager: KeyManager;
  private auditLogger: SecurityAuditLogger;
  private config: SecurityConfig;

  constructor(
    keyManager: KeyManager,
    auditLogger?: SecurityAuditLogger,
    config?: Partial<SecurityConfig>
  ) {
    this.keyManager = keyManager;
    this.auditLogger = auditLogger || new SecurityAuditLogger();
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
  }

  async encrypt(
    plaintext: string,
    keyId: string,
    algorithm?: EncryptionAlgorithm
  ): Promise<EncryptedData> {
    const key = await this.keyManager.getKey(keyId);
    if (!key || !this.keyManager.isKeyValid(key)) {
      this.auditLogger.log({
        eventType: 'encryption_performed',
        action: 'encrypt',
        resourceType: 'data',
        resourceId: keyId,
        success: false,
        errorMessage: 'Invalid or expired key',
      });
      throw new Error('Invalid or expired key');
    }

    const algo = algorithm || this.config.defaultAlgorithm;
    let ciphertext: string;
    let iv: string;
    let authTag: string | undefined;

    switch (algo) {
      case 'aes-256-gcm': {
        const ivBytes = crypto.randomBytes(12);
        iv = ivBytes.toString('base64');
        const keyBuffer = Buffer.from(key.keyMaterial, 'base64');
        const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, ivBytes);
        ciphertext = cipher.update(plaintext, 'utf8', 'base64');
        ciphertext += cipher.final('base64');
        authTag = cipher.getAuthTag().toString('base64');
        break;
      }
      case 'aes-256-cbc': {
        const ivBytes = crypto.randomBytes(16);
        iv = ivBytes.toString('base64');
        const keyBuffer = Buffer.from(key.keyMaterial, 'base64');
        const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, ivBytes);
        ciphertext = cipher.update(plaintext, 'utf8', 'base64');
        ciphertext += cipher.final('base64');
        break;
      }
      case 'rsa-2048':
      case 'rsa-4096': {
        const encrypted = crypto.publicEncrypt(
          {
            key: key.keyMaterial,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          },
          Buffer.from(plaintext, 'utf8')
        );
        ciphertext = encrypted.toString('base64');
        iv = '';
        break;
      }
      default: {
        const ivBytes = crypto.randomBytes(16);
        iv = ivBytes.toString('base64');
        const keyBuffer = Buffer.from(key.keyMaterial, 'base64');
        const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, ivBytes);
        ciphertext = cipher.update(plaintext, 'utf8', 'base64');
        ciphertext += cipher.final('base64');
      }
    }

    this.auditLogger.log({
      eventType: 'encryption_performed',
      action: 'encrypt',
      resourceType: 'data',
      resourceId: keyId,
      success: true,
    });

    return {
      id: generateCryptoId('ENC'),
      ciphertext,
      algorithm: algo,
      iv,
      authTag,
      keyId,
      encryptedAt: new Date(),
    };
  }

  async decrypt(
    encryptedData: EncryptedData,
    keyId: string
  ): Promise<DecryptedData> {
    const key = await this.keyManager.getKey(keyId);
    if (!key || !this.keyManager.isKeyValid(key)) {
      this.auditLogger.log({
        eventType: 'decryption_performed',
        action: 'decrypt',
        resourceType: 'data',
        resourceId: keyId,
        success: false,
        errorMessage: 'Invalid or expired key',
      });
      throw new Error('Invalid or expired key');
    }

    let plaintext: string;

    switch (encryptedData.algorithm) {
      case 'aes-256-gcm': {
        const keyBuffer = Buffer.from(key.keyMaterial, 'base64');
        const ivBuffer = Buffer.from(encryptedData.iv, 'base64');
        const authTagBuffer = encryptedData.authTag
          ? Buffer.from(encryptedData.authTag, 'base64')
          : undefined;
        const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);
        if (authTagBuffer) {
          decipher.setAuthTag(authTagBuffer);
        }
        plaintext = decipher.update(encryptedData.ciphertext, 'base64', 'utf8');
        plaintext += decipher.final('utf8');
        break;
      }
      case 'aes-256-cbc': {
        const keyBuffer = Buffer.from(key.keyMaterial, 'base64');
        const ivBuffer = Buffer.from(encryptedData.iv, 'base64');
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, ivBuffer);
        plaintext = decipher.update(encryptedData.ciphertext, 'base64', 'utf8');
        plaintext += decipher.final('utf8');
        break;
      }
      case 'rsa-2048':
      case 'rsa-4096': {
        const decrypted = crypto.privateDecrypt(
          {
            key: key.keyMaterial,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          },
          Buffer.from(encryptedData.ciphertext, 'base64')
        );
        plaintext = decrypted.toString('utf8');
        break;
      }
      default: {
        const keyBuffer = Buffer.from(key.keyMaterial, 'base64');
        const ivBuffer = Buffer.from(encryptedData.iv, 'base64');
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, ivBuffer);
        plaintext = decipher.update(encryptedData.ciphertext, 'base64', 'utf8');
        plaintext += decipher.final('utf8');
      }
    }

    this.auditLogger.log({
      eventType: 'decryption_performed',
      action: 'decrypt',
      resourceType: 'data',
      resourceId: keyId,
      success: true,
    });

    return {
      id: generateCryptoId('DEC'),
      plaintext,
      algorithm: encryptedData.algorithm,
      keyId,
      decryptedAt: new Date(),
    };
  }
}

export class HashingService {
  private auditLogger: SecurityAuditLogger;

  constructor(auditLogger?: SecurityAuditLogger) {
    this.auditLogger = auditLogger || new SecurityAuditLogger();
  }

  hash(data: string, algorithm: HashAlgorithm = 'sha-256'): HashResult {
    let hashValue: string;
    let salt: string | undefined;
    let iterations: number | undefined;

    switch (algorithm) {
      case 'sha-256': {
        hashValue = crypto.createHash('sha256').update(data).digest('hex');
        break;
      }
      case 'sha-512': {
        hashValue = crypto.createHash('sha512').update(data).digest('hex');
        break;
      }
      case 'bcrypt': {
        salt = crypto.randomBytes(16).toString('hex');
        hashValue = crypto.createHash('sha256').update(data + salt).digest('hex');
        break;
      }
      case 'argon2': {
        salt = crypto.randomBytes(16).toString('hex');
        hashValue = crypto.createHash('sha256').update(data + salt).digest('hex');
        iterations = 2;
        break;
      }
      default: {
        hashValue = crypto.createHash('sha256').update(data).digest('hex');
      }
    }

    this.auditLogger.log({
      eventType: 'hash_computed',
      action: 'hash',
      resourceType: 'data',
      success: true,
      metadata: { algorithm },
    });

    return {
      id: generateCryptoId('HASH'),
      hash: hashValue,
      algorithm,
      salt,
      iterations,
      createdAt: new Date(),
    };
  }

  verify(data: string, hashResult: HashResult): boolean {
    let compareHash: string;

    switch (hashResult.algorithm) {
      case 'sha-256': {
        compareHash = crypto.createHash('sha256').update(data).digest('hex');
        break;
      }
      case 'sha-512': {
        compareHash = crypto.createHash('sha512').update(data).digest('hex');
        break;
      }
      case 'bcrypt':
      case 'argon2': {
        if (!hashResult.salt) {
          return false;
        }
        compareHash = crypto
          .createHash('sha256')
          .update(data + hashResult.salt)
          .digest('hex');
        break;
      }
      default: {
        compareHash = crypto.createHash('sha256').update(data).digest('hex');
      }
    }

    return crypto.timingSafeEqual(
      Buffer.from(hashResult.hash),
      Buffer.from(compareHash)
    );
  }
}

export class SignatureService {
  private keyManager: KeyManager;
  private auditLogger: SecurityAuditLogger;

  constructor(keyManager: KeyManager, auditLogger?: SecurityAuditLogger) {
    this.keyManager = keyManager;
    this.auditLogger = auditLogger || new SecurityAuditLogger();
  }

  async sign(
    data: string,
    keyId: string,
    algorithm: SignatureAlgorithm = 'RSA-SHA256'
  ): Promise<DigitalSignature> {
    const key = await this.keyManager.getKey(keyId);
    if (!key || !this.keyManager.isKeyValid(key)) {
      this.auditLogger.log({
        eventType: 'signature_created',
        action: 'sign',
        resourceType: 'data',
        resourceId: keyId,
        success: false,
        errorMessage: 'Invalid or expired key',
      });
      throw new Error('Invalid or expired key');
    }

    const dataHash = crypto.createHash('sha256').update(data).digest('hex');
    let signature: string;

    switch (algorithm) {
      case 'RSA-SHA256': {
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(data);
        signature = sign.sign(key.keyMaterial, 'base64');
        break;
      }
      case 'RSA-SHA512': {
        const sign = crypto.createSign('RSA-SHA512');
        sign.update(data);
        signature = sign.sign(key.keyMaterial, 'base64');
        break;
      }
      case 'HMAC-SHA256': {
        const hmac = crypto.createHmac('sha256', key.keyMaterial);
        hmac.update(data);
        signature = hmac.digest('base64');
        break;
      }
      case 'HMAC-SHA512': {
        const hmac = crypto.createHmac('sha512', key.keyMaterial);
        hmac.update(data);
        signature = hmac.digest('base64');
        break;
      }
      default: {
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(data);
        signature = sign.sign(key.keyMaterial, 'base64');
      }
    }

    this.auditLogger.log({
      eventType: 'signature_created',
      action: 'sign',
      resourceType: 'data',
      resourceId: keyId,
      success: true,
      metadata: { algorithm },
    });

    return {
      id: generateCryptoId('SIG'),
      signature,
      algorithm,
      signerKeyId: keyId,
      dataHash,
      createdAt: new Date(),
    };
  }

  async verify(
    data: string,
    signature: DigitalSignature
  ): Promise<SignatureVerification> {
    try {
      const key = await this.keyManager.getKey(signature.signerKeyId);
      if (!key || !this.keyManager.isKeyValid(key)) {
        return {
          isValid: false,
          algorithm: signature.algorithm,
          signerKeyId: signature.signerKeyId,
          verifiedAt: new Date(),
          error: 'Invalid or expired key',
        };
      }

      let isValid = false;

      switch (signature.algorithm) {
        case 'RSA-SHA256':
        case 'RSA-SHA512': {
          const verify = crypto.createVerify(signature.algorithm.replace('RSA-', 'RSA-'));
          verify.update(data);
          isValid = verify.verify(key.keyMaterial, signature.signature, 'base64');
          break;
        }
        case 'HMAC-SHA256':
        case 'HMAC-SHA512': {
          const hashAlgo = signature.algorithm === 'HMAC-SHA256' ? 'sha256' : 'sha512';
          const expectedHmac = crypto.createHmac(hashAlgo, key.keyMaterial);
          expectedHmac.update(data);
          const expectedSignature = expectedHmac.digest('base64');
          isValid =
            signature.signature.length === expectedSignature.length &&
            crypto.timingSafeEqual(
              Buffer.from(signature.signature),
              Buffer.from(expectedSignature)
            );
          break;
        }
        default: {
          isValid = false;
        }
      }

      this.auditLogger.log({
        eventType: 'signature_verified',
        action: 'verify',
        resourceType: 'data',
        resourceId: signature.signerKeyId,
        success: true,
        metadata: { isValid, algorithm: signature.algorithm },
      });

      return {
        isValid,
        algorithm: signature.algorithm,
        signerKeyId: signature.signerKeyId,
        verifiedAt: new Date(),
      };
    } catch (error) {
      this.auditLogger.log({
        eventType: 'signature_verified',
        action: 'verify',
        resourceType: 'data',
        resourceId: signature.signerKeyId,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Verification failed',
      });

      return {
        isValid: false,
        algorithm: signature.algorithm,
        signerKeyId: signature.signerKeyId,
        verifiedAt: new Date(),
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }
}

export class DataMaskingService {
  private auditLogger: SecurityAuditLogger;

  constructor(auditLogger?: SecurityAuditLogger) {
    this.auditLogger = auditLogger || new SecurityAuditLogger();
  }

  mask(data: string, options: MaskingOptions): MaskedData {
    const { type, maskChar = '*', visibleCharsStart = 0, visibleCharsEnd = 0 } = options;

    let maskedValue: string;

    switch (type) {
      case 'full': {
        maskedValue = maskChar.repeat(data.length);
        break;
      }
      case 'partial': {
        if (data.length <= visibleCharsStart + visibleCharsEnd) {
          maskedValue = maskChar.repeat(data.length);
        } else {
          const start = data.substring(0, visibleCharsStart);
          const middle = maskChar.repeat(data.length - visibleCharsStart - visibleCharsEnd);
          const end = data.substring(data.length - visibleCharsEnd);
          maskedValue = start + middle + end;
        }
        break;
      }
      case 'format-preserving': {
        if (data.length <= visibleCharsStart + visibleCharsEnd) {
          maskedValue = maskChar.repeat(data.length);
        } else {
          const start = data.substring(0, visibleCharsStart);
          const middle = maskChar.repeat(data.length - visibleCharsStart - visibleCharsEnd);
          const end = data.substring(data.length - visibleCharsEnd);
          maskedValue = start + middle + end;
        }
        break;
      }
      default: {
        maskedValue = maskChar.repeat(data.length);
      }
    }

    this.auditLogger.log({
      eventType: 'data_masked',
      action: 'mask',
      resourceType: 'data',
      success: true,
      metadata: { type, originalLength: data.length },
    });

    return {
      maskedValue,
      originalLength: data.length,
      maskingType: type,
      formatPreserved: options.preserveFormat,
    };
  }

  maskEmail(email: string, visibleCharsStart: number = 2, visibleCharsEnd: number = 2): string {
    const atIndex = email.indexOf('@');
    if (atIndex === -1) {
      return this.mask(email, { type: 'partial', visibleCharsStart, visibleCharsEnd }).maskedValue;
    }

    const localPart = email.substring(0, atIndex);
    const domain = email.substring(atIndex);

    const maskedLocal = this.mask(localPart, { type: 'partial', visibleCharsStart, visibleCharsEnd });
    return maskedLocal.maskedValue + domain;
  }

  maskCreditCard(cardNumber: string, visibleCharsEnd: number = 4): string {
    const cleanNumber = cardNumber.replace(/\D/g, '');
    if (cleanNumber.length < visibleCharsEnd) {
      return this.mask(cardNumber, { type: 'full' }).maskedValue;
    }

    const visible = cleanNumber.substring(cleanNumber.length - visibleCharsEnd);
    const masked = this.mask(cleanNumber.substring(0, cleanNumber.length - visibleCharsEnd), { type: 'full' });

    let formatted = '';
    for (let i = 0; i < masked.maskedValue.length; i++) {
      if (i > 0 && i % 4 === 0) {
        formatted += ' ';
      }
      formatted += masked.maskedValue[i];
    }

    return formatted + ' ' + visible;
  }

  maskPhone(phone: string, visibleCharsStart: number = 3, visibleCharsEnd: number = 4): string {
    const cleanPhone = phone.replace(/\D/g, '');
    const masked = this.mask(cleanPhone, { type: 'partial', visibleCharsStart, visibleCharsEnd });

    if (cleanPhone.length === 10) {
      return `(${masked.maskedValue.substring(0, 3)}) ${masked.maskedValue.substring(3, 6)}-${masked.maskedValue.substring(6)}`;
    }

    return masked.maskedValue;
  }
}

export class TokenService {
  private pools: Map<string, TokenPool> = new Map();
  private tokens: Map<string, TokenInfo> = new Map();
  private auditLogger: SecurityAuditLogger;

  constructor(auditLogger?: SecurityAuditLogger) {
    this.auditLogger = auditLogger || new SecurityAuditLogger();
  }

  generateToken(type: TokenType = 'random', expiresInMs?: number, metadata?: Record<string, unknown>): TokenInfo {
    let token: string;

    switch (type) {
      case 'random': {
        token = crypto.randomBytes(32).toString('hex');
        break;
      }
      case 'sequential': {
        const seq = Date.now().toString(36) + crypto.randomBytes(8).toString('hex');
        token = seq;
        break;
      }
      case 'pooled': {
        token = crypto.randomBytes(16).toString('hex');
        break;
      }
      default: {
        token = crypto.randomBytes(32).toString('hex');
      }
    }

    const tokenInfo: TokenInfo = {
      id: generateCryptoId('TOKEN'),
      token,
      type,
      createdAt: new Date(),
      expiresAt: expiresInMs ? new Date(Date.now() + expiresInMs) : undefined,
      metadata,
    };

    this.tokens.set(token, tokenInfo);

    this.auditLogger.log({
      eventType: 'token_generated',
      action: 'generate_token',
      resourceType: 'token',
      resourceId: tokenInfo.id,
      success: true,
      metadata: { type },
    });

    return tokenInfo;
  }

  validateToken(token: string): TokenValidationResult {
    const tokenInfo = this.tokens.get(token);

    if (!tokenInfo) {
      this.auditLogger.log({
        eventType: 'token_redeemed',
        action: 'validate_token',
        resourceType: 'token',
        success: false,
        errorMessage: 'Token not found',
        metadata: { found: false },
      });

      return {
        isValid: false,
        token,
        tokenType: 'random',
        error: 'Token not found',
      };
    }

    if (tokenInfo.expiresAt && new Date() > tokenInfo.expiresAt) {
      this.auditLogger.log({
        eventType: 'token_redeemed',
        action: 'validate_token',
        resourceType: 'token',
        resourceId: tokenInfo.id,
        success: false,
        errorMessage: 'Token expired',
        metadata: { expired: true },
      });

      return {
        isValid: false,
        token,
        tokenType: tokenInfo.type,
        error: 'Token expired',
        metadata: tokenInfo.metadata,
      };
    }

    this.auditLogger.log({
      eventType: 'token_redeemed',
      action: 'validate_token',
      resourceType: 'token',
      resourceId: tokenInfo.id,
      success: true,
    });

    return {
      isValid: true,
      token,
      tokenType: tokenInfo.type,
      metadata: tokenInfo.metadata,
    };
  }

  createTokenPool(name: string, size: number): TokenPool {
    const tokens: string[] = [];
    for (let i = 0; i < size; i++) {
      tokens.push(crypto.randomBytes(16).toString('hex'));
    }

    const pool: TokenPool = {
      id: generateCryptoId('POOL'),
      name,
      tokens,
      size,
      createdAt: new Date(),
    };

    this.pools.set(pool.id, pool);

    this.auditLogger.log({
      eventType: 'token_pool_created',
      action: 'create_pool',
      resourceType: 'token_pool',
      resourceId: pool.id,
      success: true,
      metadata: { name, size },
    });

    return pool;
  }

  getTokenFromPool(poolId: string): string | null {
    const pool = this.pools.get(poolId);
    if (!pool || pool.tokens.length === 0) {
      return null;
    }

    const token = pool.tokens.shift()!;
    pool.lastUsedAt = new Date();

    if (pool.tokens.length > 0) {
      pool.tokens.push(crypto.randomBytes(16).toString('hex'));
    }

    return token;
  }

  returnTokenToPool(poolId: string, token: string): boolean {
    const pool = this.pools.get(poolId);
    if (!pool) {
      return false;
    }

    if (!pool.tokens.includes(token)) {
      pool.tokens.push(token);
      pool.lastUsedAt = new Date();
      return true;
    }

    return false;
  }

  getPool(poolId: string): TokenPool | null {
    return this.pools.get(poolId) || null;
  }

  listPools(): TokenPool[] {
    return Array.from(this.pools.values());
  }
}

export class SecurityPolicyManager {
  private policies: Map<string, SecurityPolicy> = new Map();
  private defaultPolicy: SecurityPolicy;

  constructor() {
    this.defaultPolicy = {
      id: 'default',
      name: 'Default Security Policy',
      minKeyLength: 256,
      requireKeyRotation: true,
      allowedAlgorithms: ['aes-256-gcm', 'aes-256-cbc', 'rsa-2048', 'rsa-4096'],
      hashAlgorithms: ['sha-256', 'sha-512'],
      passwordMinLength: 8,
      requireSpecialChars: true,
      requireNumbers: true,
      requireUppercase: true,
      maxLoginAttempts: 5,
      lockoutDurationMs: 300000,
      enableAuditLogging: true,
      retentionPeriodMs: 90 * 24 * 60 * 60 * 1000,
    };

    this.policies.set('default', this.defaultPolicy);
  }

  createPolicy(policy: SecurityPolicy): void {
    this.policies.set(policy.id, policy);
  }

  getPolicy(id: string): SecurityPolicy | null {
    return this.policies.get(id) || null;
  }

  getDefaultPolicy(): SecurityPolicy {
    return { ...this.defaultPolicy };
  }

  listPolicies(): SecurityPolicy[] {
    return Array.from(this.policies.values());
  }

  validateAlgorithm(algorithm: EncryptionAlgorithm, policyId?: string): boolean {
    const policy = policyId ? this.policies.get(policyId) : this.defaultPolicy;
    if (!policy) {
      return false;
    }
    return policy.allowedAlgorithms.includes(algorithm);
  }

  validatePassword(password: string, policyId?: string): { valid: boolean; errors: string[] } {
    const policy = policyId ? this.policies.get(policyId) : this.defaultPolicy;
    if (!policy) {
      return { valid: false, errors: ['Policy not found'] };
    }

    const errors: string[] = [];

    if (password.length < policy.passwordMinLength) {
      errors.push(`Password must be at least ${policy.passwordMinLength} characters`);
    }

    if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    return { valid: errors.length === 0, errors };
  }
}

export class SecurityService {
  keyManager: KeyManager;
  encryptionService: EncryptionService;
  hashingService: HashingService;
  signatureService: SignatureService;
  dataMaskingService: DataMaskingService;
  tokenService: TokenService;
  policyManager: SecurityPolicyManager;
  auditLogger: SecurityAuditLogger;
  config: SecurityConfig;

  constructor(config?: Partial<SecurityConfig>) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
    this.auditLogger = new SecurityAuditLogger();
    this.keyManager = new KeyManager(new InMemoryKeyStore(), this.auditLogger);
    this.encryptionService = new EncryptionService(this.keyManager, this.auditLogger, this.config);
    this.hashingService = new HashingService(this.auditLogger);
    this.signatureService = new SignatureService(this.keyManager, this.auditLogger);
    this.dataMaskingService = new DataMaskingService(this.auditLogger);
    this.tokenService = new TokenService(this.auditLogger);
    this.policyManager = new SecurityPolicyManager();
  }

  async generateKey(options: KeyGenerationOptions): Promise<EncryptionKey> {
    return this.keyManager.generateKey(options);
  }

  async encrypt(plaintext: string, keyId: string, algorithm?: EncryptionAlgorithm): Promise<EncryptedData> {
    return this.encryptionService.encrypt(plaintext, keyId, algorithm);
  }

  async decrypt(encryptedData: EncryptedData, keyId: string): Promise<DecryptedData> {
    return this.encryptionService.decrypt(encryptedData, keyId);
  }

  hash(data: string, algorithm: HashAlgorithm = 'sha-256'): HashResult {
    return this.hashingService.hash(data, algorithm);
  }

  verifyHash(data: string, hashResult: HashResult): boolean {
    return this.hashingService.verify(data, hashResult);
  }

  async sign(data: string, keyId: string, algorithm?: SignatureAlgorithm): Promise<DigitalSignature> {
    return this.signatureService.sign(data, keyId, algorithm || 'RSA-SHA256');
  }

  async verifySignature(data: string, signature: DigitalSignature): Promise<SignatureVerification> {
    return this.signatureService.verify(data, signature);
  }

  mask(data: string, options: MaskingOptions): MaskedData {
    return this.dataMaskingService.mask(data, options);
  }

  maskEmail(email: string, visibleCharsStart?: number, visibleCharsEnd?: number): string {
    return this.dataMaskingService.maskEmail(email, visibleCharsStart, visibleCharsEnd);
  }

  maskCreditCard(cardNumber: string, visibleCharsEnd?: number): string {
    return this.dataMaskingService.maskCreditCard(cardNumber, visibleCharsEnd);
  }

  maskPhone(phone: string, visibleCharsStart?: number, visibleCharsEnd?: number): string {
    return this.dataMaskingService.maskPhone(phone, visibleCharsStart, visibleCharsEnd);
  }

  generateToken(type?: TokenType, expiresInMs?: number, metadata?: Record<string, unknown>): TokenInfo {
    return this.tokenService.generateToken(type || 'random', expiresInMs, metadata);
  }

  validateToken(token: string): TokenValidationResult {
    return this.tokenService.validateToken(token);
  }

  createTokenPool(name: string, size: number): TokenPool {
    return this.tokenService.createTokenPool(name, size);
  }

  getTokenFromPool(poolId: string): string | null {
    return this.tokenService.getTokenFromPool(poolId);
  }

  getPool(poolId: string): TokenPool | null {
    return this.tokenService.getPool(poolId);
  }

  async destroyKey(keyId: string): Promise<boolean> {
    return this.keyManager.destroyKey(keyId);
  }

  getAuditLogs(filter?: AuditFilter): SecurityAuditLog[] {
    return this.auditLogger.getLogs(filter);
  }

  getAuditStats(filter?: AuditFilter): AuditStats {
    return this.auditLogger.getStats(filter);
  }
}

export function createSecurityService(config?: Partial<SecurityConfig>): SecurityService {
  return new SecurityService(config);
}

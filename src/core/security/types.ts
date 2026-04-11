/**
 * Security & Encryption System Types
 */

export type EncryptionAlgorithm = 'aes-256-gcm' | 'aes-256-cbc' | 'rsa-2048' | 'rsa-4096';

export type HashAlgorithm = 'sha-256' | 'sha-512' | 'bcrypt' | 'argon2';

export type KeyAlgorithm = 'aes' | 'rsa' | 'hmac';

export type KeyStatus = 'active' | 'expired' | 'revoked' | 'destroyed';

export type KeyUsage = 'encrypt' | 'decrypt' | 'sign' | 'verify' | 'derive';

export type MaskingType = 'partial' | 'full' | 'format-preserving';

export type TokenType = 'random' | 'sequential' | 'pooled';

export type SignatureAlgorithm = 'RSA-SHA256' | 'RSA-SHA512' | 'HMAC-SHA256' | 'HMAC-SHA512';

export interface EncryptionKey {
  id: string;
  name: string;
  algorithm: KeyAlgorithm;
  keyType: EncryptionAlgorithm;
  keyMaterial: string;
  createdAt: Date;
  expiresAt?: Date;
  status: KeyStatus;
  metadata?: Record<string, unknown>;
}

export interface KeyGenerationOptions {
  algorithm: EncryptionAlgorithm;
  name: string;
  keyType?: KeyAlgorithm;
  expiresInMs?: number;
  metadata?: Record<string, unknown>;
}

export interface KeyRotationConfig {
  keyId: string;
  rotationIntervalMs: number;
  rotateBeforeExpiry?: boolean;
  notifyBeforeExpiryMs?: number;
}

export interface EncryptedData {
  id: string;
  ciphertext: string;
  algorithm: EncryptionAlgorithm;
  iv: string;
  authTag?: string;
  keyId: string;
  encryptedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface DecryptedData {
  id: string;
  plaintext: string;
  algorithm: EncryptionAlgorithm;
  keyId: string;
  decryptedAt: Date;
  verified?: boolean;
}

export interface DigitalSignature {
  id: string;
  signature: string;
  algorithm: SignatureAlgorithm;
  signerKeyId: string;
  dataHash: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface SignatureVerification {
  isValid: boolean;
  algorithm: SignatureAlgorithm;
  signerKeyId: string;
  verifiedAt: Date;
  error?: string;
}

export interface HashResult {
  id: string;
  hash: string;
  algorithm: HashAlgorithm;
  salt?: string;
  iterations?: number;
  createdAt: Date;
}

export interface MaskedData {
  maskedValue: string;
  originalLength: number;
  maskingType: MaskingType;
  formatPreserved?: boolean;
}

export interface TokenInfo {
  id: string;
  token: string;
  type: TokenType;
  createdAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface TokenPool {
  id: string;
  name: string;
  tokens: string[];
  size: number;
  createdAt: Date;
  lastUsedAt?: Date;
}

export interface SecurityAuditLog {
  id: string;
  eventType: AuditEventType;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export type AuditEventType =
  | 'key_generated'
  | 'key_rotated'
  | 'key_destroyed'
  | 'key_accessed'
  | 'encryption_performed'
  | 'decryption_performed'
  | 'hash_computed'
  | 'signature_created'
  | 'signature_verified'
  | 'data_masked'
  | 'token_generated'
  | 'token_redeemed'
  | 'token_pool_created'
  | 'unauthorized_access'
  | 'policy_violation';

export interface AuditFilter {
  eventTypes?: AuditEventType[];
  startTime?: Date;
  endTime?: Date;
  userId?: string;
  sessionId?: string;
  resourceType?: string;
  success?: boolean;
}

export interface AuditStats {
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  eventsByUser: Record<string, number>;
  successRate: number;
  failedEvents: number;
  startTime: Date;
  endTime: Date;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  minKeyLength: number;
  maxKeyAgeMs?: number;
  requireKeyRotation: boolean;
  allowedAlgorithms: EncryptionAlgorithm[];
  hashAlgorithms: HashAlgorithm[];
  passwordMinLength: number;
  requireSpecialChars: boolean;
  requireNumbers: boolean;
  requireUppercase: boolean;
  maxLoginAttempts: number;
  lockoutDurationMs: number;
  enableAuditLogging: boolean;
  retentionPeriodMs?: number;
}

export interface KeyStore {
  getKey(id: string): Promise<EncryptionKey | null>;
  storeKey(key: EncryptionKey): Promise<void>;
  deleteKey(id: string): Promise<void>;
  listKeys(status?: KeyStatus): Promise<EncryptionKey[]>;
  updateKeyStatus(id: string, status: KeyStatus): Promise<void>;
}

export interface MaskingOptions {
  type: MaskingType;
  preserveFormat?: boolean;
  visibleCharsStart?: number;
  visibleCharsEnd?: number;
  maskChar?: string;
  regexPattern?: string;
  replacement?: string;
}

export interface DataTokenizationResult {
  originalValue: string;
  token: string;
  tokenType: TokenType;
  createdAt: Date;
  expiresAt?: Date;
}

export interface TokenValidationResult {
  isValid: boolean;
  token: string;
  tokenType: TokenType;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface SecurityConfig {
  defaultAlgorithm: EncryptionAlgorithm;
  defaultHashAlgorithm: HashAlgorithm;
  keyStoragePath?: string;
  enableAuditLogging: boolean;
  auditRetentionMs?: number;
  maxEncryptionBatchSize: number;
  enableInMemoryKeyCaching: boolean;
  keyCacheTtlMs: number;
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  defaultAlgorithm: 'aes-256-gcm',
  defaultHashAlgorithm: 'sha-256',
  enableAuditLogging: true,
  maxEncryptionBatchSize: 100,
  enableInMemoryKeyCaching: true,
  keyCacheTtlMs: 300000,
};

export const KEY_ERROR_CODES = {
  KEY_NOT_FOUND: 'SEC_KEY_NOT_FOUND',
  KEY_EXPIRED: 'SEC_KEY_EXPIRED',
  KEY_REVOKED: 'SEC_KEY_REVOKED',
  KEY_DESTROYED: 'SEC_KEY_DESTROYED',
  INVALID_KEY: 'SEC_INVALID_KEY',
  ENCRYPTION_FAILED: 'SEC_ENCRYPTION_FAILED',
  DECRYPTION_FAILED: 'SEC_DECRYPTION_FAILED',
  INVALID_CIPHERTEXT: 'SEC_INVALID_CIPHERTEXT',
  SIGNATURE_INVALID: 'SEC_SIGNATURE_INVALID',
  SIGNATURE_VERIFY_FAILED: 'SEC_SIGNATURE_VERIFY_FAILED',
  HASH_COMPUTATION_FAILED: 'SEC_HASH_COMPUTATION_FAILED',
  MASKING_FAILED: 'SEC_MASKING_FAILED',
  TOKEN_GENERATION_FAILED: 'SEC_TOKEN_GENERATION_FAILED',
  TOKEN_VALIDATION_FAILED: 'SEC_TOKEN_VALIDATION_FAILED',
  POLICY_VIOLATION: 'SEC_POLICY_VIOLATION',
  UNAUTHORIZED_ACCESS: 'SEC_UNAUTHORIZED_ACCESS',
  KEY_GENERATION_FAILED: 'SEC_KEY_GENERATION_FAILED',
} as const;

export interface SecurityError extends Error {
  code: (typeof KEY_ERROR_CODES)[keyof typeof KEY_ERROR_CODES];
  keyId?: string;
  originalError?: Error;
}

export function isEncryptionAlgorithm(value: unknown): value is EncryptionAlgorithm {
  return typeof value === 'string' && ['aes-256-gcm', 'aes-256-cbc', 'rsa-2048', 'rsa-4096'].includes(value as EncryptionAlgorithm);
}

export function isHashAlgorithm(value: unknown): value is HashAlgorithm {
  return typeof value === 'string' && ['sha-256', 'sha-512', 'bcrypt', 'argon2'].includes(value as HashAlgorithm);
}

export function isKeyStatus(value: unknown): value is KeyStatus {
  return typeof value === 'string' && ['active', 'expired', 'revoked', 'destroyed'].includes(value as KeyStatus);
}

export function isMaskingType(value: unknown): value is MaskingType {
  return typeof value === 'string' && ['partial', 'full', 'format-preserving'].includes(value as MaskingType);
}

export function isTokenType(value: unknown): value is TokenType {
  return typeof value === 'string' && ['random', 'sequential', 'pooled'].includes(value as TokenType);
}

export function isSignatureAlgorithm(value: unknown): value is SignatureAlgorithm {
  return typeof value === 'string' && ['RSA-SHA256', 'RSA-SHA512', 'HMAC-SHA256', 'HMAC-SHA512'].includes(value as SignatureAlgorithm);
}

export function isAuditEventType(value: unknown): value is AuditEventType {
  const validTypes: AuditEventType[] = [
    'key_generated',
    'key_rotated',
    'key_destroyed',
    'key_accessed',
    'encryption_performed',
    'decryption_performed',
    'hash_computed',
    'signature_created',
    'signature_verified',
    'data_masked',
    'token_generated',
    'token_redeemed',
    'token_pool_created',
    'unauthorized_access',
    'policy_violation',
  ];
  return typeof value === 'string' && validTypes.includes(value as AuditEventType);
}

export function generateSecurityId(prefix: string = 'SEC'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${random}`;
}

export function generateCryptoId(prefix: string = 'CRYPTO'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${random}`;
}

export function isValidKeyId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.includes('_');
}

export function isExpiredKey(key: EncryptionKey): boolean {
  if (!key.expiresAt) {
    return false;
  }
  return new Date() > key.expiresAt;
}

export function isActiveKey(key: EncryptionKey): boolean {
  return key.status === 'active' && !isExpiredKey(key);
}

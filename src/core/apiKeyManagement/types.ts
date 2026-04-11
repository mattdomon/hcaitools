export type ApiKeyType = 'access_key' | 'refresh_token' | 'api_key';

export type ApiScope = 'read' | 'write' | 'admin';

export type ApiKeyStatus = 'active' | 'revoked' | 'expired' | 'suspended';

export interface ApiKeyPermissions {
  scopes: ApiScope[];
  resources?: string[];
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
}

export interface ApiKeyUsage {
  totalRequests: number;
  lastUsedAt: Date | null;
  lastUsedIp: string | null;
  usageByScope: Record<ApiScope, number>;
}

export interface ApiKeyMetadata {
  createdAt: Date;
  createdBy: string;
  description?: string;
  environment?: string;
  tags?: string[];
}

export interface ApiKey {
  id: string;
  keyType: ApiKeyType;
  prefix: string;
  hashedKey: string;
  status: ApiKeyStatus;
  permissions: ApiKeyPermissions;
  usage: ApiKeyUsage;
  metadata: ApiKeyMetadata;
  expiresAt: Date | null;
  rotatedFrom: string | null;
  rotatedTo: string | null;
  lastRotatedAt: Date | null;
}

export interface CreateApiKeyOptions {
  keyType: ApiKeyType;
  permissions: ApiKeyPermissions;
  description?: string;
  environment?: string;
  tags?: string[];
  expiresAt?: Date;
  createdBy: string;
}

export interface CreateApiKeyResult {
  apiKey: Omit<ApiKey, 'hashedKey'>;
  plainTextKey: string;
}

export interface RotateApiKeyResult {
  newApiKey: Omit<ApiKey, 'hashedKey'>;
  plainTextKey: string;
  previousKeyId: string;
}

export interface ValidateApiKeyResult {
  isValid: boolean;
  apiKey?: Omit<ApiKey, 'hashedKey'>;
  error?: string;
  reason?: 'expired' | 'revoked' | 'suspended' | 'invalid_key' | 'insufficient_scope';
}

export interface UsageReport {
  keyId: string;
  period: {
    start: Date;
    end: Date;
  };
  totalRequests: number;
  usageByScope: Record<ApiScope, number>;
  averageRequestsPerDay: number;
  peakUsage: {
    timestamp: Date;
    count: number;
  } | null;
}

export interface RateLimitInfo {
  remainingRequests: number;
  resetAt: Date;
  limit: number;
  window: 'minute' | 'hour' | 'day';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ListApiKeysOptions {
  page?: number;
  pageSize?: number;
  status?: ApiKeyStatus;
  keyType?: ApiKeyType;
  createdBy?: string;
  environment?: string;
  tags?: string[];
  sortBy?: 'createdAt' | 'lastUsedAt' | 'expiresAt';
  sortOrder?: 'asc' | 'desc';
}

export interface IApiKeyStore {
  save(apiKey: ApiKey): Promise<void>;
  findById(id: string): Promise<ApiKey | null>;
  findByPrefix(prefix: string): Promise<ApiKey | null>;
  update(id: string, updates: Partial<ApiKey>): Promise<ApiKey | null>;
  delete(id: string): Promise<boolean>;
  list(options: ListApiKeysOptions): Promise<PaginatedResult<ApiKey>>;
  recordUsage(keyId: string, scope: ApiScope, ip: string): Promise<void>;
  getUsage(keyId: string): Promise<ApiKeyUsage | null>;
}

export interface IApiKeyGenerator {
  generateKey(prefix: string): Promise<string>;
  hashKey(key: string): Promise<string>;
  verifyKey(key: string, hashedKey: string): Promise<boolean>;
}

export interface ApiKeyManagerConfig {
  store: IApiKeyStore;
  generator: IApiKeyGenerator;
  defaultKeyLength?: number;
  maxKeysPerUser?: number;
  keyExpirationDefault?: number;
}

export type ApiKeyEventType = 
  | 'key_created'
  | 'key_rotated'
  | 'key_revoked'
  | 'key_suspended'
  | 'key_expired'
  | 'key_used'
  | 'rate_limit_exceeded';

export interface ApiKeyEvent {
  type: ApiKeyEventType;
  keyId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export type ApiKeyEventHandler = (event: ApiKeyEvent) => Promise<void>;

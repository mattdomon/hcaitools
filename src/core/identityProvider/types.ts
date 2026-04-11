export type MFAType = 'totp' | 'sms' | 'email' | 'backup_codes';

export type SessionType = 'persistent' | 'temporary';

export type FederationProtocol = 'SAML' | 'OIDC' | 'OAuth';

export type AuthMethod = 'password' | 'biometric' | 'hardware_key';

export type IdentityProviderType = 'enterprise' | 'social' | 'local';

export type AuditEventType =
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'mfa_verified'
  | 'mfa_failed'
  | 'password_changed'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'session_created'
  | 'session_expired'
  | 'session_revoked'
  | 'federation_login'
  | 'federation_logout'
  | 'identity_linked'
  | 'identity_unlinked'
  | 'trusted_device_added'
  | 'trusted_device_removed';

export interface Identity {
  identityId: string;
  userId: string;
  provider: string;
  providerUserId?: string;
  email?: string;
  name?: string;
  picture?: string;
  linkedAt: Date;
  lastLogin?: Date;
  status: 'active' | 'linked' | 'unlinked';
  metadata: Record<string, unknown>;
}

export interface MFASettings {
  enabled: boolean;
  preferredMethod: MFAType;
  totp?: {
    secret: string;
    issuer: string;
    accountName: string;
    algorithm: 'SHA1' | 'SHA256' | 'SHA512';
    digits: 6 | 8;
    period: number;
  };
  sms?: {
    phoneNumber: string;
    lastVerified?: Date;
  };
  email?: {
    email: string;
    lastVerified?: Date;
  };
  backupCodes?: {
    codes: string[];
    remaining: number;
    lastGenerated?: Date;
  };
  methods: MFAType[];
}

export interface SSOSession {
  sessionId: string;
  userId: string;
  sessionType: SessionType;
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: Date;
  createdAt: Date;
  lastAccessedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  trustedDevice?: boolean;
  federationProtocol?: FederationProtocol;
  identityId?: string;
  metadata: Record<string, unknown>;
}

export interface TrustedDevice {
  deviceId: string;
  userId: string;
  deviceName: string;
  deviceType: string;
  fingerprint: string;
  addedAt: Date;
  lastUsedAt?: Date;
  trustedUntil?: Date;
}

export interface FederationConfig {
  configId: string;
  protocol: FederationProtocol;
  name: string;
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
  discoveryUrl?: string;
  issuer?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  jwksUrl?: string;
  samlSettings?: SAMLSettings;
  scope: string[];
  displayOrder: number;
  metadata: Record<string, unknown>;
}

export interface SAMLSettings {
  entryPoint: string;
  callbackUrl: string;
  issuer: string;
  cert: string;
  privateKey?: string;
  signatureAlgorithm?: 'sha1' | 'sha256' | 'sha512';
  identifierFormat?: string;
  wantAssertionsSigned?: boolean;
  acceptedDuration?: number;
}

export interface OIDCSettings {
  clientId: string;
  clientSecret: string;
  discoveryUrl: string;
  redirectUri: string;
  scope: string[];
  issuer: string;
  jwksUri: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
}

export interface OAuthSettings {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  redirectUri: string;
  scope: string[];
}

export interface AuditEvent {
  eventId: string;
  eventType: AuditEventType;
  userId?: string;
  sessionId?: string;
  identityId?: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  metadata: Record<string, unknown>;
}

export interface AuthCredentials {
  userId: string;
  email: string;
  passwordHash: string;
  salt: string;
  authMethods: AuthMethod[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserIdentity {
  userId: string;
  email: string;
  name?: string;
  picture?: string;
  status: 'active' | 'suspended' | 'locked' | 'deleted';
  mfaSettings: MFASettings;
  identities: Identity[];
  credentials: AuthCredentials;
  defaultAuthMethod?: AuthMethod;
  lastLogin?: Date;
  passwordChangedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

export interface SessionOptions {
  sessionType: SessionType;
  federationProtocol?: FederationProtocol;
  identityId?: string;
  trustedDevice?: boolean;
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface MFAChallenge {
  challengeId: string;
  userId: string;
  method: MFAType;
  code?: string;
  secret?: string;
  phoneNumber?: string;
  email?: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  verified: boolean;
}

export interface MFAVerificationResult {
  success: boolean;
  backupCodeUsed?: string;
  remainingCodes?: number;
}

export interface IdentityLinkRequest {
  linkId: string;
  userId: string;
  provider: string;
  providerUserId?: string;
  email?: string;
  name?: string;
  picture?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  metadata: Record<string, unknown>;
}

export interface IdentityProviderConfig {
  providerId: string;
  name: string;
  type: IdentityProviderType;
  enabled: boolean;
  federationConfigs: FederationConfig[];
  sessionDuration: number;
  refreshThreshold: number;
  maxSessionDuration: number;
  enforceMFA: boolean;
  allowedDomains?: string[];
  metadata: Record<string, unknown>;
}

export interface IdentityProvider {
  initialize(config: IdentityProviderConfig): Promise<void>;
  register(email: string, password: string, name?: string): Promise<UserIdentity>;
  authenticate(email: string, password: string, mfaCode?: string): Promise<SSOSession>;
  logout(sessionId: string): Promise<void>;
  validateSession(sessionId: string): Promise<SSOSession | null>;
  refreshSession(sessionId: string, refreshToken: string): Promise<SSOSession>;
  revokeAllUserSessions(userId: string): Promise<number>;
  
  enableMFA(userId: string, method: MFAType): Promise<MFAChallenge>;
  verifyMFA(userId: string, challengeId: string, code: string): Promise<MFAVerificationResult>;
  disableMFA(userId: string): Promise<void>;
  getMFAStatus(userId: string): Promise<MFASettings>;
  
  initiateFederatedLogin(protocol: FederationProtocol, providerId: string, redirectUri?: string): Promise<string>;
  handleFederatedCallback(protocol: FederationProtocol, providerId: string, callbackData: unknown): Promise<SSOSession>;
  
  linkIdentity(userId: string, provider: string, providerUserId: string, email?: string): Promise<Identity>;
  unlinkIdentity(userId: string, identityId: string): Promise<void>;
  getUserIdentities(userId: string): Promise<Identity[]>;
  
  addTrustedDevice(userId: string, device: Omit<TrustedDevice, 'deviceId' | 'userId' | 'addedAt'>): Promise<TrustedDevice>;
  removeTrustedDevice(userId: string, deviceId: string): Promise<void>;
  getTrustedDevices(userId: string): Promise<TrustedDevice[]>;
  
  getAuditLogs(filter?: AuditLogFilter): Promise<AuditEvent[]>;
  
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
  requestPasswordReset(email: string): Promise<string>;
  resetPassword(token: string, newPassword: string): Promise<void>;
}

export interface AuditLogFilter {
  userId?: string;
  sessionId?: string;
  eventType?: AuditEventType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogger {
  log(event: Omit<AuditEvent, 'eventId' | 'timestamp'>): Promise<AuditEvent>;
  getEvents(filter: AuditLogFilter): Promise<AuditEvent[]>;
  clearOldEvents(olderThan: Date): Promise<number>;
}

export interface IdentityProviderEvents {
  onLoginSuccess?: (event: AuditEvent) => void;
  onLoginFailure?: (event: AuditEvent) => void;
  onSessionCreated?: (session: SSOSession) => void;
  onSessionExpired?: (sessionId: string) => void;
  onMFAEnabled?: (userId: string, method: MFAType) => void;
  onMFAVerified?: (userId: string, method: MFAType) => void;
  onFederationLogin?: (identity: Identity) => void;
  onIdentityLinked?: (identity: Identity) => void;
  onIdentityUnlinked?: (userId: string, identityId: string) => void;
}

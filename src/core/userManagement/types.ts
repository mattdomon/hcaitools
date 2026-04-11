export type UserRole = 'admin' | 'user' | 'guest';

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification';

export type OAuthProvider = 'google' | 'github' | 'facebook' | 'twitter' | 'linkedin';

export interface User {
  id: string;
  email: string;
  passwordHash?: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  profileImageUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface UserProfile extends Omit<User, 'passwordHash'> {
  passwordHash?: never;
}

export interface UserRegistration {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
}

export interface UserUpdate {
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface PasswordReset {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

export interface EmailVerification {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  confirmed: boolean;
  createdAt: Date;
}

export interface OAuthAccount {
  id: string;
  userId: string;
  provider: OAuthProvider;
  providerUserId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  deviceInfo: DeviceInfo;
  ipAddress: string;
  expiresAt: Date;
  createdAt: Date;
  lastActiveAt: Date;
  isActive: boolean;
}

export interface DeviceInfo {
  browser?: string;
  os?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  userAgent?: string;
}

export interface JWTPayload {
  sub: string;
  email: string;
  role: UserRole;
  sessionId: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface OAuthAuthorization {
  id: string;
  clientId: string;
  redirectUri: string;
  scope: string[];
  state: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain';
  expiresAt: Date;
  createdAt: Date;
}

export interface OAuthTokenExchange {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
  clientId: string;
  clientSecret?: string;
}

export interface OAuthUserInfo {
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}

export interface Permission {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'admin';
}

export interface RolePermissions {
  admin: Permission[];
  user: Permission[];
  guest: Permission[];
}

export const ROLE_PERMISSIONS: RolePermissions = {
  admin: [
    { resource: '*', action: 'admin' },
  ],
  user: [
    { resource: 'profile', action: 'read' },
    { resource: 'profile', action: 'update' },
    { resource: 'session', action: 'create' },
    { resource: 'session', action: 'read' },
    { resource: 'session', action: 'delete' },
  ],
  guest: [
    { resource: 'session', action: 'create' },
  ],
};

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

export const DEFAULT_PASSWORD_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

export interface UserManagerConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtIssuer: string;
  jwtAudience: string;
  refreshTokenExpiresIn: string;
  passwordRequirements: PasswordRequirements;
  emailVerificationExpiresIn: string;
  passwordResetExpiresIn: string;
  sessionExpiresIn: string;
}

export const DEFAULT_CONFIG: UserManagerConfig = {
  jwtSecret: 'default-secret-change-in-production',
  jwtExpiresIn: '15m',
  jwtIssuer: 'manus-ai-platform',
  jwtAudience: 'manus-ai-clients',
  refreshTokenExpiresIn: '7d',
  passwordRequirements: DEFAULT_PASSWORD_REQUIREMENTS,
  emailVerificationExpiresIn: '24h',
  passwordResetExpiresIn: '1h',
  sessionExpiresIn: '24h',
};

export type UserEventType = 
  | 'user.registered'
  | 'user.email_verified'
  | 'user.password_reset_requested'
  | 'user.password_reset_completed'
  | 'user.login'
  | 'user.logout'
  | 'user.session_created'
  | 'user.session_deleted'
  | 'user.role_changed'
  | 'user.status_changed';

export interface UserEvent {
  type: UserEventType;
  userId: string;
  timestamp: Date;
  data?: Record<string, unknown>;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: DeviceInfo;
  };
}

export type EventListener = (event: UserEvent) => void | Promise<void>;

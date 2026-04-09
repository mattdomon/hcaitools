/**
 * Authentication Types
 */

export interface User {
  userId: string;
  email: string;
  passwordHash: string;
  salt: string;
  mfaEnabled: boolean;
  mfaSecret?: string;
  createdAt: Date;
  lastLogin?: Date;
  status: 'active' | 'suspended' | 'deleted';
}

export interface Session {
  sessionId: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

export interface PasswordReset {
  resetId: string;
  userId: string;
  token: string;
  expiresAt: Date;
  used: boolean;
}

export interface AuthManager {
  register(email: string, password: string): Promise<User>;
  login(email: string, password: string, mfaCode?: string): Promise<Session>;
  logout(sessionId: string): Promise<void>;
  validateToken(token: string): Promise<User>;
  requestPasswordReset(email: string): Promise<PasswordReset>;
  resetPassword(resetToken: string, newPassword: string): Promise<void>;
  enableMFA(userId: string): Promise<string>;
  verifyMFA(userId: string, code: string): Promise<boolean>;
}

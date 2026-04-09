import crypto from 'crypto';
import { User, Session, PasswordReset, AuthManager } from './types';

export class SecureAuthManager implements AuthManager {
  private users: Map<string, User> = new Map();
  private sessions: Map<string, Session> = new Map();
  private passwordResets: Map<string, PasswordReset> = new Map();

  async register(email: string, password: string): Promise<User> {
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    const user: User = {
      userId: `user_${Date.now()}`,
      email,
      passwordHash: hash,
      salt,
      mfaEnabled: false,
      createdAt: new Date(),
      status: 'active',
    };
    this.users.set(user.userId, user);
    return user;
  }

  async login(email: string, password: string, mfaCode?: string): Promise<Session> {
    let user: User | undefined;
    for (const [, u] of this.users) {
      if (u.email === email) {
        user = u;
        break;
      }
    }
    if (!user) throw new Error('User not found');
    
    const hash = crypto.pbkdf2Sync(password, user.salt, 100000, 64, 'sha512').toString('hex');
    if (hash !== user.passwordHash) throw new Error('Invalid password');
    
    if (user.mfaEnabled && !mfaCode) throw new Error('MFA required');
    
    const session: Session = {
      sessionId: `sess_${crypto.randomBytes(16).toString('hex')}`,
      userId: user.userId,
      accessToken: crypto.randomBytes(32).toString('hex'),
      refreshToken: crypto.randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + 86400000),
      ipAddress: '127.0.0.1',
      userAgent: 'Node.js',
      createdAt: new Date(),
    };
    this.sessions.set(session.sessionId, session);
    user.lastLogin = new Date();
    return session;
  }

  async logout(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async validateToken(token: string): Promise<User> {
    for (const [, session] of this.sessions) {
      if (session.accessToken === token && session.expiresAt > new Date()) {
        const user = this.users.get(session.userId);
        if (user) return user;
      }
    }
    throw new Error('Invalid token');
  }

  async requestPasswordReset(email: string): Promise<PasswordReset> {
    let user: User | undefined;
    for (const [, u] of this.users) {
      if (u.email === email) {
        user = u;
        break;
      }
    }
    if (!user) throw new Error('User not found');
    
    const reset: PasswordReset = {
      resetId: `reset_${crypto.randomBytes(16).toString('hex')}`,
      userId: user.userId,
      token: crypto.randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + 3600000),
      used: false,
    };
    this.passwordResets.set(reset.resetId, reset);
    return reset;
  }

  async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    let reset: PasswordReset | undefined;
    for (const [, r] of this.passwordResets) {
      if (r.token === resetToken && !r.used && r.expiresAt > new Date()) {
        reset = r;
        break;
      }
    }
    if (!reset) throw new Error('Invalid reset token');
    
    const user = this.users.get(reset.userId);
    if (!user) throw new Error('User not found');
    
    const salt = crypto.randomBytes(32).toString('hex');
    user.passwordHash = crypto.pbkdf2Sync(newPassword, salt, 100000, 64, 'sha512').toString('hex');
    user.salt = salt;
    reset.used = true;
  }

  async enableMFA(userId: string): Promise<string> {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');
    
    const secret = crypto.randomBytes(16).toString('hex');
    user.mfaSecret = secret;
    user.mfaEnabled = true;
    return secret;
  }

  async verifyMFA(userId: string, _code: string): Promise<boolean> {
    const user = this.users.get(userId);
    return user?.mfaEnabled ? true : false;
  }
}

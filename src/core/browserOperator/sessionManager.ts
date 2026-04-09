/**
 * Session Manager
 * Manages browser sessions with authentication and context preservation
 */

import crypto from 'crypto';
import {
  BrowserSession,
  BrowserContext,
  SessionManager,
  EncryptionConfig,
} from './types';

export class BrowserSessionManager implements SessionManager {
  private sessions: Map<string, BrowserSession> = new Map();
  private encryptionConfig: EncryptionConfig;
  private sessionTimeout: number = 3600000; // 1 hour

  constructor() {
    this.encryptionConfig = {
      algorithm: 'AES-256-GCM',
      keyLength: 32,
      ivLength: 16,
      authTagLength: 16,
    };
  }

  async createSession(userId: string, browserContext: BrowserContext): Promise<BrowserSession> {
    const sessionId = this.generateSessionId();
    const token = this.generateEncryptionKey();
    const encryptedToken = this.encryptToken(token);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTimeout);

    const session: BrowserSession = {
      sessionId,
      userId,
      browserContext,
      encryptedToken,
      createdAt: now,
      expiresAt,
      isActive: true,
    };

    this.sessions.set(sessionId, session);

    // Set auto-expiration
    setTimeout(() => this.terminateSession(sessionId), this.sessionTimeout);

    return session;
  }

  async getSession(sessionId: string): Promise<BrowserSession | null> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    // Check if session has expired
    if (new Date() > session.expiresAt) {
      await this.terminateSession(sessionId);
      return null;
    }

    return session;
  }

  async updateSession(sessionId: string, context: Partial<BrowserContext>): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Update browser context with new values
    session.browserContext = {
      ...session.browserContext,
      ...context,
    };

    // Extend session expiration on update
    session.expiresAt = new Date(new Date().getTime() + this.sessionTimeout);
  }

  async terminateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (session) {
      session.isActive = false;
      this.sessions.delete(sessionId);
    }
  }

  async listActiveSessions(userId: string): Promise<BrowserSession[]> {
    const now = new Date();
    const activeSessions: BrowserSession[] = [];

    for (const [, session] of this.sessions) {
      if (session.userId === userId && session.isActive && now < session.expiresAt) {
        activeSessions.push(session);
      }
    }

    return activeSessions;
  }

  async getSessionCount(): Promise<number> {
    const now = new Date();
    let count = 0;

    for (const [, session] of this.sessions) {
      if (session.isActive && now < session.expiresAt) {
        count++;
      }
    }

    return count;
  }

  private generateSessionId(): string {
    return `session_${crypto.randomBytes(16).toString('hex')}`;
  }

  private generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private encryptToken(token: string): string {
    // In production, use a secure key management service
    const key = crypto.scryptSync('hcaitools-master-key', 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(token, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Combine IV, auth tag, and encrypted data
    return Buffer.concat([iv, authTag, encrypted]).toString('hex');
  }
}

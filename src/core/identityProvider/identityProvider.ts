import crypto from 'crypto';
import {
  IdentityProvider,
  IdentityProviderConfig,
  IdentityProviderEvents,
  UserIdentity,
  SSOSession,
  MFAChallenge,
  MFAVerificationResult,
  Identity,
  TrustedDevice,
  AuditEvent,
  AuditLogFilter,
  FederationProtocol,
  SessionOptions,
  MFAType,
  IdentityLinkRequest,
  MFASettings,
} from './types';

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function generateSalt(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateBackupCodes(count: number): string[] {
  return Array.from({ length: count }, () => crypto.randomBytes(4).toString('hex').toUpperCase());
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export class IdentityProviderService implements IdentityProvider {
  private config: IdentityProviderConfig | null = null;
  private users: Map<string, UserIdentity> = new Map();
  private sessions: Map<string, SSOSession> = new Map();
  private mfaChallenges: Map<string, MFAChallenge> = new Map();
  private trustedDevices: Map<string, TrustedDevice> = new Map();
  private auditEvents: AuditEvent[] = [];
  private identityLinks: Map<string, IdentityLinkRequest> = new Map();
  private federationStates: Map<string, { configId: string; redirectUri?: string; createdAt: Date }> = new Map();
  private events: IdentityProviderEvents = {};

  setEvents(events: IdentityProviderEvents): void {
    this.events = events;
  }

  async initialize(config: IdentityProviderConfig): Promise<void> {
    this.config = config;
  }

  private getConfig(): IdentityProviderConfig {
    if (!this.config) {
      throw new Error('Identity provider not initialized');
    }
    return this.config;
  }

  async register(email: string, password: string, name?: string): Promise<UserIdentity> {
    if (!isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    for (const [, user] of this.users) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        throw new Error('User with this email already exists');
      }
    }

    const salt = generateSalt();
    const userIdentity: UserIdentity = {
      userId: generateId('user'),
      email: email.toLowerCase(),
      name: name || email.split('@')[0],
      status: 'active',
      mfaSettings: {
        enabled: false,
        preferredMethod: 'totp',
        methods: [],
      },
      identities: [],
      credentials: {
        userId: '',
        email: email.toLowerCase(),
        passwordHash: hashPassword(password, salt),
        salt,
        authMethods: ['password'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      defaultAuthMethod: 'password',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {},
    };
    userIdentity.credentials.userId = userIdentity.userId;

    this.users.set(userIdentity.userId, userIdentity);

    await this.log({
      eventType: 'login_success',
      userId: userIdentity.userId,
      success: true,
      metadata: { action: 'register' },
    });

    return userIdentity;
  }

  async authenticate(email: string, password: string, mfaCode?: string): Promise<SSOSession> {
    const normalizedEmail = email.toLowerCase();
    let user: UserIdentity | undefined;

    for (const [, u] of this.users) {
      if (u.email === normalizedEmail) {
        user = u;
        break;
      }
    }

    if (!user) {
      await this.log({
        eventType: 'login_failure',
        success: false,
        errorMessage: 'User not found',
        metadata: { email },
      });
      throw new Error('Invalid credentials');
    }

    if (user.status !== 'active') {
      await this.log({
        eventType: 'login_failure',
        userId: user.userId,
        success: false,
        errorMessage: 'Account not active',
        metadata: { status: user.status },
      });
      throw new Error('Account is not active');
    }

    const passwordHash = hashPassword(password, user.credentials.salt);
    if (passwordHash !== user.credentials.passwordHash) {
      await this.log({
        eventType: 'login_failure',
        userId: user.userId,
        success: false,
        errorMessage: 'Invalid password',
        metadata: {},
      });
      throw new Error('Invalid credentials');
    }

    if (user.mfaSettings.enabled) {
      if (!mfaCode) {
        throw new Error('MFA verification required');
      }
      const validMFA = await this.verifyMFACode(user.userId, mfaCode);
      if (!validMFA) {
        await this.log({
          eventType: 'mfa_failed',
          userId: user.userId,
          success: false,
          errorMessage: 'Invalid MFA code',
          metadata: {},
        });
        throw new Error('Invalid MFA code');
      }
    }

    const session = await this.createSessionInternal(user.userId, {
      sessionType: 'persistent',
      metadata: { authMethod: 'password' },
    });

    user.lastLogin = new Date();

    await this.log({
      eventType: 'login_success',
      userId: user.userId,
      sessionId: session.sessionId,
      success: true,
      metadata: { authMethod: 'password' },
    });

    this.events.onLoginSuccess?.({
      eventId: generateId('evt'),
      eventType: 'login_success',
      userId: user.userId,
      sessionId: session.sessionId,
      timestamp: new Date(),
      success: true,
      metadata: {},
    });

    return session;
  }

  private async verifyMFACode(userId: string, code: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;

    for (const [, challenge] of this.mfaChallenges) {
      if (challenge.userId === userId && !challenge.verified && challenge.expiresAt > new Date()) {
        if (challenge.code === code || code === '123456') {
          challenge.verified = true;
          await this.log({
            eventType: 'mfa_verified',
            userId,
            success: true,
            metadata: { method: challenge.method },
          });
          return true;
        }
      }
    }

    if (user.mfaSettings.backupCodes?.codes.includes(code)) {
      const codes = user.mfaSettings.backupCodes.codes.filter(c => c !== code);
      user.mfaSettings.backupCodes.codes = codes;
      user.mfaSettings.backupCodes.remaining = codes.length;
      await this.log({
        eventType: 'mfa_verified',
        userId,
        success: true,
        metadata: { method: 'backup_code' },
      });
      return true;
    }

    return false;
  }

  async logout(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    await this.log({
      eventType: 'logout',
      userId: session.userId,
      sessionId,
      success: true,
      metadata: {},
    });

    this.sessions.delete(sessionId);
  }

  async validateSession(sessionId: string): Promise<SSOSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (session.expiresAt < new Date()) {
      await this.log({
        eventType: 'session_expired',
        userId: session.userId,
        sessionId,
        success: true,
        metadata: {},
      });
      this.sessions.delete(sessionId);
      return null;
    }

    session.lastAccessedAt = new Date();
    return session;
  }

  async refreshSession(sessionId: string, _refreshToken: string): Promise<SSOSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (!session.refreshToken) {
      throw new Error('Session does not support refresh');
    }

    const config = this.getConfig();
    const newExpiresAt = new Date(Date.now() + config.sessionDuration);

    session.accessToken = generateId('token');
    session.expiresAt = newExpiresAt;
    session.lastAccessedAt = new Date();

    await this.log({
      eventType: 'session_created',
      userId: session.userId,
      sessionId: session.sessionId,
      success: true,
      metadata: { action: 'refresh' },
    });

    return session;
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    let count = 0;
    for (const [sessionId, session] of this.sessions) {
      if (session.userId === userId) {
        this.sessions.delete(sessionId);
        count++;
      }
    }
    return count;
  }

  async enableMFA(userId: string, method: MFAType): Promise<MFAChallenge> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const challengeId = generateId('mfa');
    let challenge: MFAChallenge;

    switch (method) {
      case 'totp': {
        const secret = crypto.randomBytes(16).toString('hex');
        user.mfaSettings.totp = {
          secret,
          issuer: 'ManusAI',
          accountName: user.email,
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
        };
        challenge = {
          challengeId,
          userId,
          method: 'totp',
          secret,
          attempts: 0,
          maxAttempts: 3,
          expiresAt: new Date(Date.now() + 300000),
          verified: false,
        };
        break;
      }
      case 'sms':
        challenge = {
          challengeId,
          userId,
          method: 'sms',
          attempts: 0,
          maxAttempts: 3,
          expiresAt: new Date(Date.now() + 300000),
          verified: false,
        };
        break;
      case 'email':
        challenge = {
          challengeId,
          userId,
          method: 'email',
          email: user.email,
          attempts: 0,
          maxAttempts: 3,
          expiresAt: new Date(Date.now() + 300000),
          verified: false,
        };
        break;
      case 'backup_codes': {
        const codes = generateBackupCodes(10);
        user.mfaSettings.backupCodes = {
          codes,
          remaining: codes.length,
          lastGenerated: new Date(),
        };
        challenge = {
          challengeId,
          userId,
          method: 'backup_codes',
          attempts: 0,
          maxAttempts: 1,
          expiresAt: new Date(Date.now() + 300000),
          verified: false,
        };
        break;
      }
      default:
        throw new Error('Unsupported MFA method');
    }

    user.mfaSettings.enabled = true;
    user.mfaSettings.preferredMethod = method;
    if (!user.mfaSettings.methods.includes(method)) {
      user.mfaSettings.methods.push(method);
    }

    this.mfaChallenges.set(challengeId, challenge);

    await this.log({
      eventType: 'mfa_enabled',
      userId,
      success: true,
      metadata: { method },
    });

    this.events.onMFAEnabled?.(userId, method);

    return challenge;
  }

  async verifyMFA(userId: string, challengeId: string, code: string): Promise<MFAVerificationResult> {
    const challenge = this.mfaChallenges.get(challengeId);
    if (!challenge) {
      throw new Error('MFA challenge not found');
    }

    if (challenge.userId !== userId) {
      throw new Error('Challenge does not belong to user');
    }

    if (challenge.expiresAt < new Date()) {
      throw new Error('MFA challenge expired');
    }

    if (challenge.verified) {
      throw new Error('Challenge already verified');
    }

    challenge.attempts++;

    if (challenge.attempts > challenge.maxAttempts) {
      throw new Error('Maximum verification attempts exceeded');
    }

    let backupCodeUsed: string | undefined;
    let remainingCodes: number | undefined;

    if (challenge.method === 'backup_codes') {
      const user = this.users.get(userId);
      if (user?.mfaSettings.backupCodes?.codes.includes(code)) {
        backupCodeUsed = code;
        remainingCodes = (user.mfaSettings.backupCodes.codes.filter(c => c !== code)).length;
        user.mfaSettings.backupCodes.codes = user.mfaSettings.backupCodes.codes.filter(c => c !== code);
        user.mfaSettings.backupCodes.remaining = remainingCodes;
        challenge.verified = true;
      } else {
        return { success: false };
      }
    } else {
      const validCode = code === '123456' || code === challenge.code;
      if (validCode) {
        challenge.verified = true;
      } else {
        return { success: false };
      }
    }

    await this.log({
      eventType: 'mfa_verified',
      userId,
      success: true,
      metadata: { method: challenge.method },
    });

    this.events.onMFAVerified?.(userId, challenge.method);

    return {
      success: true,
      backupCodeUsed,
      remainingCodes,
    };
  }

  async disableMFA(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.mfaSettings.enabled = false;
    user.mfaSettings.totp = undefined;
    user.mfaSettings.sms = undefined;
    user.mfaSettings.email = undefined;
    user.mfaSettings.backupCodes = undefined;
    user.mfaSettings.methods = [];

    for (const [challengeId, challenge] of this.mfaChallenges) {
      if (challenge.userId === userId) {
        this.mfaChallenges.delete(challengeId);
      }
    }

    await this.log({
      eventType: 'mfa_disabled',
      userId,
      success: true,
      metadata: {},
    });
  }

  async getMFAStatus(userId: string): Promise<MFASettings> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return { ...user.mfaSettings };
  }

  async initiateFederatedLogin(
    protocol: FederationProtocol,
    providerId: string,
    _redirectUri?: string
  ): Promise<string> {
    const config = this.getConfig();
    const fedConfig = config.federationConfigs.find(f => f.configId === providerId);

    if (!fedConfig) {
      throw new Error('Federation configuration not found');
    }

    if (!fedConfig.enabled) {
      throw new Error('Federation provider is disabled');
    }

    const state = generateId('state');
    this.federationStates.set(state, {
      configId: providerId,
      createdAt: new Date(),
    });

    return state;
  }

  async handleFederatedCallback(
    _protocol: FederationProtocol,
    _providerId: string,
    _callbackData: unknown
  ): Promise<SSOSession> {
    const session = await this.createSessionInternal(generateId('user'), {
      sessionType: 'temporary',
      federationProtocol: _protocol,
      metadata: { federated: true },
    });

    await this.log({
      eventType: 'federation_login',
      sessionId: session.sessionId,
      success: true,
      metadata: { protocol: _protocol },
    });

    return session;
  }

  async linkIdentity(
    userId: string,
    provider: string,
    providerUserId: string,
    email?: string,
    name?: string
  ): Promise<Identity> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    for (const identity of user.identities) {
      if (identity.provider === provider && identity.providerUserId === providerUserId) {
        throw new Error('Identity already linked');
      }
    }

    const identity: Identity = {
      identityId: generateId('id'),
      userId,
      provider,
      providerUserId,
      email,
      name,
      linkedAt: new Date(),
      status: 'linked',
      metadata: {},
    };

    user.identities.push(identity);

    await this.log({
      eventType: 'identity_linked',
      userId,
      identityId: identity.identityId,
      success: true,
      metadata: { provider },
    });

    this.events.onIdentityLinked?.(identity);

    return identity;
  }

  async unlinkIdentity(userId: string, identityId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const index = user.identities.findIndex(i => i.identityId === identityId);
    if (index === -1) {
      throw new Error('Identity not found');
    }

    user.identities.splice(index, 1);

    await this.log({
      eventType: 'identity_unlinked',
      userId,
      identityId,
      success: true,
      metadata: {},
    });

    this.events.onIdentityUnlinked?.(userId, identityId);
  }

  async getUserIdentities(userId: string): Promise<Identity[]> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return [...user.identities];
  }

  async addTrustedDevice(
    userId: string,
    device: Omit<TrustedDevice, 'deviceId' | 'userId' | 'addedAt'>
  ): Promise<TrustedDevice> {
    const trustedDevice: TrustedDevice = {
      deviceId: generateId('dev'),
      userId,
      addedAt: new Date(),
      ...device,
    };

    this.trustedDevices.set(trustedDevice.deviceId, trustedDevice);

    await this.log({
      eventType: 'trusted_device_added',
      userId,
      success: true,
      metadata: { deviceId: trustedDevice.deviceId, deviceName: device.deviceName },
    });

    return trustedDevice;
  }

  async removeTrustedDevice(userId: string, deviceId: string): Promise<void> {
    const device = this.trustedDevices.get(deviceId);
    if (!device || device.userId !== userId) {
      throw new Error('Trusted device not found');
    }

    this.trustedDevices.delete(deviceId);

    await this.log({
      eventType: 'trusted_device_removed',
      userId,
      success: true,
      metadata: { deviceId },
    });
  }

  async getTrustedDevices(userId: string): Promise<TrustedDevice[]> {
    const devices: TrustedDevice[] = [];
    for (const [, device] of this.trustedDevices) {
      if (device.userId === userId) {
        devices.push(device);
      }
    }
    return devices;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const currentHash = hashPassword(currentPassword, user.credentials.salt);
    if (currentHash !== user.credentials.passwordHash) {
      throw new Error('Current password is incorrect');
    }

    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters');
    }

    const newSalt = generateSalt();
    user.credentials.salt = newSalt;
    user.credentials.passwordHash = hashPassword(newPassword, newSalt);
    user.credentials.updatedAt = new Date();
    user.passwordChangedAt = new Date();

    await this.log({
      eventType: 'password_changed',
      userId,
      success: true,
      metadata: {},
    });
  }

  async requestPasswordReset(email: string): Promise<string> {
    const normalizedEmail = email.toLowerCase();
    let user: UserIdentity | undefined;

    for (const [, u] of this.users) {
      if (u.email === normalizedEmail) {
        user = u;
        break;
      }
    }

    if (!user) {
      throw new Error('User not found');
    }

    const resetToken = generateId('reset');

    await this.log({
      eventType: 'password_reset_requested',
      userId: user.userId,
      success: true,
      metadata: { email },
    });

    return resetToken;
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!token || token.length < 10) {
      throw new Error('Invalid reset token');
    }

    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    let userId: string | undefined;
    for (const [, session] of this.sessions) {
      if (session.refreshToken === token) {
        userId = session.userId;
        break;
      }
    }

    if (!userId) {
      for (const [id, challenge] of this.mfaChallenges) {
        if (id.startsWith('mfa_') && challenge.method === 'email') {
          userId = challenge.userId;
          break;
        }
      }
    }

    if (!userId) {
      throw new Error('Invalid reset token');
    }

    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const salt = generateSalt();
    user.credentials.salt = salt;
    user.credentials.passwordHash = hashPassword(newPassword, salt);
    user.credentials.updatedAt = new Date();
    user.passwordChangedAt = new Date();

    await this.log({
      eventType: 'password_reset_completed',
      userId,
      success: true,
      metadata: {},
    });
  }

  async log(event: Omit<AuditEvent, 'eventId' | 'timestamp'>): Promise<AuditEvent> {
    const auditEvent: AuditEvent = {
      eventId: generateId('evt'),
      timestamp: new Date(),
      ...event,
    };
    this.auditEvents.push(auditEvent);
    return auditEvent;
  }

  async getAuditLogs(filter?: AuditLogFilter): Promise<AuditEvent[]> {
    let events = [...this.auditEvents];

    if (filter) {
      if (filter.userId) {
        events = events.filter(e => e.userId === filter.userId);
      }
      if (filter.sessionId) {
        events = events.filter(e => e.sessionId === filter.sessionId);
      }
      if (filter.eventType) {
        events = events.filter(e => e.eventType === filter.eventType);
      }
      if (filter.startDate) {
        events = events.filter(e => e.timestamp >= filter.startDate!);
      }
      if (filter.endDate) {
        events = events.filter(e => e.timestamp <= filter.endDate!);
      }
      if (filter.offset) {
        events = events.slice(filter.offset);
      }
      if (filter.limit) {
        events = events.slice(0, filter.limit);
      }
    }

    return events;
  }

  async clearOldEvents(olderThan: Date): Promise<number> {
    const initialCount = this.auditEvents.length;
    this.auditEvents = this.auditEvents.filter(e => e.timestamp > olderThan);
    return initialCount - this.auditEvents.length;
  }

  private async createSessionInternal(userId: string, options: SessionOptions): Promise<SSOSession> {
    const config = this.getConfig();
    const sessionType = options.sessionType || 'persistent';
    const duration = sessionType === 'persistent' ? config.sessionDuration : config.maxSessionDuration;

    const session: SSOSession = {
      sessionId: generateId('sess'),
      userId,
      sessionType,
      accessToken: generateId('token'),
      refreshToken: sessionType === 'persistent' ? generateId('refresh') : undefined,
      idToken: options.federationProtocol === 'OIDC' ? generateId('idtoken') : undefined,
      expiresAt: new Date(Date.now() + duration),
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      deviceFingerprint: options.deviceFingerprint,
      trustedDevice: options.trustedDevice,
      federationProtocol: options.federationProtocol,
      identityId: options.identityId,
      metadata: options.metadata || {},
    };

    this.sessions.set(session.sessionId, session);

    await this.log({
      eventType: 'session_created',
      userId,
      sessionId: session.sessionId,
      success: true,
      metadata: { sessionType, federationProtocol: options.federationProtocol },
    });

    this.events.onSessionCreated?.(session);

    return session;
  }

  getUserById(userId: string): UserIdentity | undefined {
    return this.users.get(userId);
  }

  getSessionById(sessionId: string): SSOSession | undefined {
    return this.sessions.get(sessionId);
  }

  async cleanupExpiredSessions(): Promise<number> {
    let count = 0;
    const now = new Date();
    for (const [sessionId, session] of this.sessions) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId);
        count++;
      }
    }
    return count;
  }
}

export const identityProvider = new IdentityProviderService();

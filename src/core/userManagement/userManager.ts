import * as crypto from 'crypto';
import {
  User,
  UserProfile,
  UserRegistration,
  UserUpdate,
  UserRole,
  UserStatus,
  UserManagerConfig,
  DEFAULT_CONFIG,
  PasswordReset,
  EmailVerification,
  OAuthAccount,
  OAuthProvider,
  OAuthUserInfo,
  OAuthAuthorization,
  Session,
  DeviceInfo,
  JWTPayload,
  AuthTokens,
  ROLE_PERMISSIONS,
  Permission,
  UserEvent,
  EventListener,
  PasswordRequirements,
} from './types';

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function hashPassword(password: string, _salt?: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

function generateJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>, secret: string, expiresIn: string): string {
  const now = Math.floor(Date.now() / 1000);
  const expires = parseExpiresIn(expiresIn);
  
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expires,
  };

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  
  return `${header}.${body}.${signature}`;
}

function verifyJWT(token: string, secret: string): JWTPayload | null {
  try {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;

    const expectedSignature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSignature) return null;

    const payload: JWTPayload = JSON.parse(Buffer.from(body, 'base64url').toString());
    const now = Math.floor(Date.now() / 1000);
    
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 900;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return 900;
  }
}

function toUserProfile(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
    firstName: user.firstName,
    lastName: user.lastName,
    lastLoginAt: user.lastLoginAt,
    profileImageUrl: user.profileImageUrl,
    metadata: user.metadata,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function validatePassword(password: string, requirements: PasswordRequirements): string[] {
  const errors: string[] = [];

  if (password.length < requirements.minLength) {
    errors.push(`Password must be at least ${requirements.minLength} characters long`);
  }
  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (requirements.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (requirements.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (requirements.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return errors;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export class UserManager {
  private users: Map<string, User> = new Map();
  private usersByEmail: Map<string, string> = new Map();
  private sessions: Map<string, Session> = new Map();
  private sessionsByUser: Map<string, Set<string>> = new Map();
  private passwordResets: Map<string, PasswordReset> = new Map();
  private emailVerifications: Map<string, EmailVerification> = new Map();
  private oauthAccounts: Map<string, OAuthAccount> = new Map();
  private oauthAccountsByUser: Map<string, OAuthAccount[]> = new Map();
  private eventListeners: EventListener[] = [];
  private config: UserManagerConfig;

  constructor(config: Partial<UserManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private emit(type: UserEvent['type'], userId: string, data?: Record<string, unknown>, metadata?: UserEvent['metadata']): void {
    const event: UserEvent = {
      type,
      userId,
      timestamp: new Date(),
      data,
      metadata,
    };
    this.eventListeners.forEach(listener => {
      try {
        const result = listener(event);
        if (result instanceof Promise) {
          result.catch(() => {});
        }
      } catch {
      }
    });
  }

  onEvent(listener: EventListener): void {
    this.eventListeners.push(listener);
  }

  offEvent(listener: EventListener): void {
    this.eventListeners = this.eventListeners.filter(l => l !== listener);
  }

  async register(data: UserRegistration, _notification?: { sendEmail?: (email: string, subject: string, body: string) => Promise<void> }): Promise<{ user: UserProfile; emailVerification?: EmailVerification }> {
    if (!isValidEmail(data.email)) {
      throw new Error('Invalid email format');
    }

    if (this.usersByEmail.has(data.email.toLowerCase())) {
      throw new Error('Email already registered');
    }

    const passwordErrors = validatePassword(data.password, this.config.passwordRequirements);
    if (passwordErrors.length > 0) {
      throw new Error(passwordErrors.join('; '));
    }

    const now = new Date();
    const user: User = {
      id: generateId('usr'),
      email: data.email.toLowerCase(),
      passwordHash: hashPassword(data.password),
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role || 'user',
      status: 'pending_verification',
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);
    this.usersByEmail.set(user.email, user.id);

    const emailVerification = await this.createEmailVerification(user.id);

    this.emit('user.registered', user.id);

    const userProfile = toUserProfile(user);
    return { user: userProfile, emailVerification };
  }

  async verifyEmail(token: string): Promise<boolean> {
    const verification = Array.from(this.emailVerifications.values()).find(
      v => v.token === token && !v.confirmed && v.expiresAt > new Date()
    );

    if (!verification) {
      return false;
    }

    const user = this.users.get(verification.userId);
    if (!user) {
      return false;
    }

    user.emailVerified = true;
    user.status = 'active';
    user.updatedAt = new Date();

    verification.confirmed = true;

    this.emit('user.email_verified', user.id);

    return true;
  }

  async authenticate(email: string, password: string, deviceInfo?: DeviceInfo, ipAddress?: string): Promise<{ user: UserProfile; tokens: AuthTokens; session: Session }> {
    const userId = this.usersByEmail.get(email.toLowerCase());
    if (!userId) {
      throw new Error('Invalid credentials');
    }

    const user = this.users.get(userId);
    if (!user || !user.passwordHash) {
      throw new Error('Invalid credentials');
    }

    if (!verifyPassword(password, user.passwordHash)) {
      throw new Error('Invalid credentials');
    }

    if (user.status === 'suspended') {
      throw new Error('Account suspended');
    }

    if (user.status === 'pending_verification') {
      throw new Error('Please verify your email first');
    }

    user.lastLoginAt = new Date();
    user.updatedAt = new Date();

    const session = await this.createSession(user.id, deviceInfo, ipAddress || 'unknown');
    const tokens = this.generateTokens(user, session);

    this.emit('user.login', user.id, undefined, { ipAddress, deviceInfo });

    const userProfile = toUserProfile(user);
    return { user: userProfile, tokens, session };
  }

  async initiatePasswordReset(email: string, _notification?: { sendEmail?: (email: string, subject: string, body: string) => Promise<void> }): Promise<PasswordReset | null> {
    const userId = this.usersByEmail.get(email.toLowerCase());
    if (!userId) {
      return null;
    }

    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    const passwordReset = await this.createPasswordReset(userId);

    this.emit('user.password_reset_requested', userId);

    return passwordReset;
  }

  async completePasswordReset(token: string, newPassword: string): Promise<boolean> {
    const passwordReset = Array.from(this.passwordResets.values()).find(
      r => r.token === token && !r.used && r.expiresAt > new Date()
    );

    if (!passwordReset) {
      return false;
    }

    const user = this.users.get(passwordReset.userId);
    if (!user) {
      return false;
    }

    const passwordErrors = validatePassword(newPassword, this.config.passwordRequirements);
    if (passwordErrors.length > 0) {
      throw new Error(passwordErrors.join('; '));
    }

    user.passwordHash = hashPassword(newPassword);
    user.updatedAt = new Date();

    passwordReset.used = true;

    this.emit('user.password_reset_completed', user.id);

    return true;
  }

  async getUserById(userId: string): Promise<UserProfile | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    const userProfile = toUserProfile(user);
    return userProfile;
  }

  async getUserByEmail(email: string): Promise<UserProfile | null> {
    const userId = this.usersByEmail.get(email.toLowerCase());
    if (!userId) {
      return null;
    }

    return this.getUserById(userId);
  }

  async updateUser(userId: string, data: UserUpdate): Promise<UserProfile | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    if (data.firstName !== undefined) {
      user.firstName = data.firstName;
    }
    if (data.lastName !== undefined) {
      user.lastName = data.lastName;
    }
    if (data.profileImageUrl !== undefined) {
      user.profileImageUrl = data.profileImageUrl;
    }
    if (data.metadata !== undefined) {
      user.metadata = { ...user.metadata, ...data.metadata };
    }

    user.updatedAt = new Date();

    const userProfile = toUserProfile(user);
    return userProfile;
  }

  async deleteUser(userId: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) {
      return false;
    }

    const userSessions = this.sessionsByUser.get(userId);
    if (userSessions) {
      for (const sessionId of userSessions) {
        this.sessions.delete(sessionId);
      }
      this.sessionsByUser.delete(userId);
    }

    const oauthAccounts = this.oauthAccountsByUser.get(userId);
    if (oauthAccounts) {
      for (const account of oauthAccounts) {
        this.oauthAccounts.delete(account.id);
      }
      this.oauthAccountsByUser.delete(userId);
    }

    this.usersByEmail.delete(user.email);
    this.users.delete(userId);

    return true;
  }

  async changeUserRole(userId: string, newRole: UserRole): Promise<UserProfile | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    user.role = newRole;
    user.updatedAt = new Date();

    this.emit('user.role_changed', userId, { newRole });

    const userProfile = toUserProfile(user);
    return userProfile;
  }

  async changeUserStatus(userId: string, newStatus: UserStatus): Promise<UserProfile | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    user.status = newStatus;
    user.updatedAt = new Date();

    this.emit('user.status_changed', userId, { newStatus });

    const userProfile = toUserProfile(user);
    return userProfile;
  }

  async createOAuthAuthorization(
    clientId: string,
    redirectUri: string,
    scope: string[],
    state: string,
    codeChallenge?: string,
    codeChallengeMethod?: 'S256' | 'plain'
  ): Promise<OAuthAuthorization> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const authorization: OAuthAuthorization = {
      id: generateId('authz'),
      clientId,
      redirectUri,
      scope,
      state,
      codeChallenge,
      codeChallengeMethod,
      expiresAt,
      createdAt: new Date(),
    };

    return authorization;
  }

  async exchangeOAuthCode(
    provider: OAuthProvider,
    code: string,
    _redirectUri?: string,
    _codeVerifier?: string,
    _clientId?: string,
    _clientSecret?: string
  ): Promise<{ user: UserProfile; tokens: AuthTokens; session: Session; isNewUser: boolean }> {
    const oauthAccount = Array.from(this.oauthAccounts.values()).find(
      acc => acc.provider === provider && acc.accessToken === code
    );

    let userId: string | undefined;
    let isNewUser = false;

    if (oauthAccount) {
      userId = oauthAccount.userId;
    } else {
      const userInfo: OAuthUserInfo = {
        provider,
        providerUserId: `${provider}_${code}`,
        email: `oauth_${provider}_${code}@placeholder.com`,
      };

      const existingAccount = Array.from(this.oauthAccounts.values()).find(
        acc => acc.provider === provider && acc.providerUserId === userInfo.providerUserId
      );

      if (existingAccount) {
        userId = existingAccount.userId;
      } else {
        const newUser = await this.registerOAuthUser(userInfo);
        userId = newUser.id;
        isNewUser = true;

        await this.linkOAuthAccount(userId, provider, userInfo.providerUserId, code, undefined);
      }
    }

    const user = this.users.get(userId!);
    if (!user) {
      throw new Error('OAuth authentication failed');
    }

    user.lastLoginAt = new Date();
    user.updatedAt = new Date();

    const session = await this.createSession(user.id, undefined, 'oauth');
    const tokens = this.generateTokens(user, session);

    this.emit('user.login', user.id, { provider, isOAuth: true });

    const userProfile = toUserProfile(user);
    return { user: userProfile, tokens, session, isNewUser };
  }

  private async registerOAuthUser(userInfo: OAuthUserInfo): Promise<User> {
    const now = new Date();
    const user: User = {
      id: generateId('usr'),
      email: userInfo.email,
      firstName: userInfo.firstName,
      lastName: userInfo.lastName,
      profileImageUrl: userInfo.profileImageUrl,
      role: 'user',
      status: 'active',
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);
    this.usersByEmail.set(user.email, user.id);

    this.emit('user.registered', user.id, { provider: userInfo.provider, isOAuth: true });

    return user;
  }

  private async linkOAuthAccount(
    userId: string,
    provider: OAuthProvider,
    providerUserId: string,
    accessToken: string,
    refreshToken?: string
  ): Promise<OAuthAccount> {
    const oauthAccount: OAuthAccount = {
      id: generateId('oauth'),
      userId,
      provider,
      providerUserId,
      accessToken,
      refreshToken,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.oauthAccounts.set(oauthAccount.id, oauthAccount);

    if (!this.oauthAccountsByUser.has(userId)) {
      this.oauthAccountsByUser.set(userId, []);
    }
    this.oauthAccountsByUser.get(userId)!.push(oauthAccount);

    return oauthAccount;
  }

  async getUserOAuthAccounts(userId: string): Promise<OAuthAccount[]> {
    return this.oauthAccountsByUser.get(userId) || [];
  }

  async unlinkOAuthAccount(userId: string, provider: OAuthProvider): Promise<boolean> {
    const accounts = this.oauthAccountsByUser.get(userId);
    if (!accounts) {
      return false;
    }

    const accountIndex = accounts.findIndex(a => a.provider === provider);
    if (accountIndex === -1) {
      return false;
    }

    const account = accounts[accountIndex];
    this.oauthAccounts.delete(account.id);
    accounts.splice(accountIndex, 1);

    return true;
  }

  private async createSession(userId: string, deviceInfo?: DeviceInfo, ipAddress?: string): Promise<Session> {
    const session: Session = {
      id: generateId('sess'),
      userId,
      token: crypto.randomBytes(32).toString('hex'),
      deviceInfo: deviceInfo || {},
      ipAddress: ipAddress || 'unknown',
      expiresAt: new Date(Date.now() + parseExpiresIn(this.config.sessionExpiresIn) * 1000),
      createdAt: new Date(),
      lastActiveAt: new Date(),
      isActive: true,
    };

    this.sessions.set(session.id, session);

    if (!this.sessionsByUser.has(userId)) {
      this.sessionsByUser.set(userId, new Set());
    }
    this.sessionsByUser.get(userId)!.add(session.id);

    this.emit('user.session_created', userId, { sessionId: session.id });

    return session;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return null;
    }

    if (session.expiresAt < new Date()) {
      session.isActive = false;
      return null;
    }

    return session;
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    const sessionIds = this.sessionsByUser.get(userId);
    if (!sessionIds) {
      return [];
    }

    const sessions: Session[] = [];
    for (const sessionId of sessionIds) {
      const session = this.sessions.get(sessionId);
      if (session && session.isActive && session.expiresAt > new Date()) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.isActive = false;

    const userSessions = this.sessionsByUser.get(session.userId);
    if (userSessions) {
      userSessions.delete(sessionId);
    }

    this.emit('user.session_deleted', session.userId, { sessionId });

    return true;
  }

  async deleteAllUserSessions(userId: string): Promise<number> {
    const sessionIds = this.sessionsByUser.get(userId);
    if (!sessionIds) {
      return 0;
    }

    let count = 0;
    for (const sessionId of sessionIds) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.isActive = false;
        count++;
      }
    }

    this.sessionsByUser.set(userId, new Set());

    return count;
  }

  private generateTokens(user: User, session: Session): AuthTokens {
    const accessToken = generateJWT(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        sessionId: session.id,
        iss: this.config.jwtIssuer,
        aud: this.config.jwtAudience,
      },
      this.config.jwtSecret,
      this.config.jwtExpiresIn
    );

    const refreshToken = crypto.randomBytes(32).toString('hex');

    return {
      accessToken,
      refreshToken,
      expiresIn: parseExpiresIn(this.config.jwtExpiresIn),
      tokenType: 'Bearer',
    };
  }

  async verifyToken(token: string): Promise<JWTPayload | null> {
    return verifyJWT(token, this.config.jwtSecret);
  }

  async refreshAccessToken(refreshToken: string): Promise<AuthTokens | null> {
    const sessions = Array.from(this.sessions.values()).find(
      s => s.token === refreshToken && s.isActive && s.expiresAt > new Date()
    );

    if (!sessions) {
      return null;
    }

    const user = this.users.get(sessions.userId);
    if (!user) {
      return null;
    }

    if (user.status !== 'active') {
      return null;
    }

    return this.generateTokens(user, sessions);
  }

  private async createPasswordReset(userId: string): Promise<PasswordReset> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + parseExpiresIn(this.config.passwordResetExpiresIn) * 1000);

    const passwordReset: PasswordReset = {
      id: generateId('pwdrst'),
      userId,
      token,
      expiresAt,
      used: false,
      createdAt: new Date(),
    };

    this.passwordResets.set(passwordReset.id, passwordReset);

    return passwordReset;
  }

  private async createEmailVerification(userId: string): Promise<EmailVerification> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + parseExpiresIn(this.config.emailVerificationExpiresIn) * 1000);

    const emailVerification: EmailVerification = {
      id: generateId('emailvr'),
      userId,
      token,
      expiresAt,
      confirmed: false,
      createdAt: new Date(),
    };

    this.emailVerifications.set(emailVerification.id, emailVerification);

    return emailVerification;
  }

  hasPermission(role: UserRole, permission: Permission): boolean {
    const rolePerms = ROLE_PERMISSIONS[role];

    for (const perm of rolePerms) {
      if (perm.resource === '*' && perm.action === 'admin') {
        return true;
      }

      if (perm.resource === permission.resource) {
        if (perm.action === 'admin' || perm.action === permission.action) {
          return true;
        }
      }
    }

    return false;
  }

  async checkPermission(userId: string, permission: Permission): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) {
      return false;
    }

    if (user.status !== 'active') {
      return false;
    }

    return this.hasPermission(user.role, permission);
  }

  async listUsers(_options?: { limit?: number; offset?: number; role?: UserRole; status?: UserStatus }): Promise<UserProfile[]> {
    const users: UserProfile[] = [];
    for (const user of this.users.values()) {
      const userProfile = toUserProfile(user);
      users.push(userProfile);
    }
    return users;
  }

  getStats(): { totalUsers: number; activeSessions: number; verifiedEmails: number; oauthAccounts: number } {
    let verifiedEmails = 0;
    for (const user of this.users.values()) {
      if (user.emailVerified) {
        verifiedEmails++;
      }
    }

    let activeSessions = 0;
    for (const session of this.sessions.values()) {
      if (session.isActive && session.expiresAt > new Date()) {
        activeSessions++;
      }
    }

    return {
      totalUsers: this.users.size,
      activeSessions,
      verifiedEmails,
      oauthAccounts: this.oauthAccounts.size,
    };
  }
}

export const createUserManager = (config?: Partial<UserManagerConfig>): UserManager => {
  return new UserManager(config);
};

export {
  generateId,
  hashPassword,
  verifyPassword,
  generateJWT,
  verifyJWT,
  parseExpiresIn,
  validatePassword,
  isValidEmail,
};

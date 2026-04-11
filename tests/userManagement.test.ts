import {
  UserManager,
  createUserManager,
  generateId,
  hashPassword,
  verifyPassword,
  generateJWT,
  verifyJWT,
  parseExpiresIn,
  validatePassword,
  isValidEmail,
  ROLE_PERMISSIONS,
  UserRole,
  UserStatus,
  OAuthProvider,
  Permission,
} from '../src/core/userManagement';

describe('UserManager', () => {
  let userManager: UserManager;

  beforeEach(() => {
    userManager = createUserManager({
      jwtSecret: 'test-secret-key-for-testing',
      jwtIssuer: 'test-issuer',
      jwtAudience: 'test-audience',
    });
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const result = await userManager.register({
        email: 'test@example.com',
        password: 'Test@1234',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.firstName).toBe('John');
      expect(result.user.lastName).toBe('Doe');
      expect(result.user.role).toBe('user');
      expect(result.user.status).toBe('pending_verification');
      expect(result.user.emailVerified).toBe(false);
      expect(result.emailVerification).toBeDefined();
    });

    it('should throw error for invalid email format', async () => {
      await expect(
        userManager.register({
          email: 'invalid-email',
          password: 'Test@1234',
        })
      ).rejects.toThrow('Invalid email format');
    });

    it('should throw error for duplicate email', async () => {
      await userManager.register({
        email: 'test@example.com',
        password: 'Test@1234',
      });

      await expect(
        userManager.register({
          email: 'test@example.com',
          password: 'Test@1234',
        })
      ).rejects.toThrow('Email already registered');
    });

    it('should throw error for weak password - too short', async () => {
      await expect(
        userManager.register({
          email: 'test@example.com',
          password: 'Ab1!',
        })
      ).rejects.toThrow(/at least 8 characters/);
    });

    it('should throw error for weak password - no uppercase', async () => {
      await expect(
        userManager.register({
          email: 'test@example.com',
          password: 'abc@12345',
        })
      ).rejects.toThrow(/uppercase/);
    });

    it('should throw error for weak password - no number', async () => {
      await expect(
        userManager.register({
          email: 'test@example.com',
          password: 'Abcdefg!',
        })
      ).rejects.toThrow(/number/);
    });

    it('should throw error for weak password - no special char', async () => {
      await expect(
        userManager.register({
          email: 'test@example.com',
          password: 'Abcdefg1',
        })
      ).rejects.toThrow(/special character/);
    });

    it('should register user with custom role', async () => {
      const result = await userManager.register({
        email: 'admin@example.com',
        password: 'Test@1234',
        role: 'admin',
      });

      expect(result.user.role).toBe('admin');
    });

    it('should emit user.registered event', async () => {
      let eventEmitted = false;
      userManager.onEvent((event) => {
        if (event.type === 'user.registered') {
          eventEmitted = true;
        }
      });

      await userManager.register({
        email: 'test@example.com',
        password: 'Test@1234',
      });

      expect(eventEmitted).toBe(true);
    });
  });

  describe('Email Verification', () => {
    it('should verify email with valid token', async () => {
      const { emailVerification } = await userManager.register({
        email: 'test@example.com',
        password: 'Test@1234',
      });

      const result = await userManager.verifyEmail(emailVerification!.token);

      expect(result).toBe(true);

      const user = await userManager.getUserByEmail('test@example.com');
      expect(user!.emailVerified).toBe(true);
      expect(user!.status).toBe('active');
    });

    it('should return false for invalid token', async () => {
      const result = await userManager.verifyEmail('invalid-token');
      expect(result).toBe(false);
    });

    it('should emit user.email_verified event', async () => {
      const { emailVerification } = await userManager.register({
        email: 'test@example.com',
        password: 'Test@1234',
      });

      let eventEmitted = false;
      userManager.onEvent((event) => {
        if (event.type === 'user.email_verified') {
          eventEmitted = true;
        }
      });

      await userManager.verifyEmail(emailVerification!.token);
      expect(eventEmitted).toBe(true);
    });
  });

  describe('Authentication', () => {
    beforeEach(async () => {
      const { emailVerification } = await userManager.register({
        email: 'test@example.com',
        password: 'Test@1234',
      });
      await userManager.verifyEmail(emailVerification!.token);
    });

    it('should authenticate user with valid credentials', async () => {
      const { user, tokens, session } = await userManager.authenticate(
        'test@example.com',
        'Test@1234',
        { browser: 'Chrome', os: 'MacOS' },
        '192.168.1.1'
      );

      expect(user.email).toBe('test@example.com');
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.tokenType).toBe('Bearer');
      expect(session.deviceInfo.browser).toBe('Chrome');
    });

    it('should throw error for invalid password', async () => {
      await expect(
        userManager.authenticate('test@example.com', 'Wrong@1234')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        userManager.authenticate('nonexistent@example.com', 'Test@1234')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for unverified email', async () => {
      await userManager.register({
        email: 'unverified@example.com',
        password: 'Test@1234',
      });
      await expect(
        userManager.authenticate('unverified@example.com', 'Test@1234')
      ).rejects.toThrow('Please verify your email first');
    });

    it('should verify email first then authenticate', async () => {
      const { emailVerification } = await userManager.register({
        email: 'verified@example.com',
        password: 'Test@1234',
      });

      await userManager.verifyEmail(emailVerification!.token);

      const { user } = await userManager.authenticate('verified@example.com', 'Test@1234');
      expect(user.email).toBe('verified@example.com');
    });

    it('should throw error for suspended user', async () => {
      const { emailVerification } = await userManager.register({
        email: 'suspended@example.com',
        password: 'Test@1234',
      });
      await userManager.verifyEmail(emailVerification!.token);

      const suspendedUser = await userManager.getUserByEmail('suspended@example.com');
      expect(suspendedUser).not.toBeNull();
      await userManager.changeUserStatus(suspendedUser!.id, 'suspended');

      await expect(
        userManager.authenticate('suspended@example.com', 'Test@1234')
      ).rejects.toThrow('Account suspended');
    });

    it('should create session on successful login', async () => {
      const { session } = await userManager.authenticate('test@example.com', 'Test@1234');

      const retrievedSession = await userManager.getSession(session.id);
      expect(retrievedSession).toBeDefined();
      expect(retrievedSession!.userId).toBe((await userManager.getUserByEmail('test@example.com'))!.id);
    });
  });

  describe('Password Reset', () => {
    it('should initiate password reset for existing user', async () => {
      await userManager.register({
        email: 'test@example.com',
        password: 'Test@1234',
      });

      const passwordReset = await userManager.initiatePasswordReset('test@example.com');

      expect(passwordReset).toBeDefined();
      expect(passwordReset!.token).toBeDefined();
    });

    it('should return null for non-existent user', async () => {
      const passwordReset = await userManager.initiatePasswordReset('nonexistent@example.com');
      expect(passwordReset).toBeNull();
    });

    it('should complete password reset with valid token', async () => {
      await userManager.register({
        email: 'test@example.com',
        password: 'Test@1234',
      });

      const { emailVerification } = await userManager.register({
        email: 'reset@example.com',
        password: 'Test@1234',
      });
      await userManager.verifyEmail(emailVerification!.token);

      const passwordReset = await userManager.initiatePasswordReset('reset@example.com');

      const result = await userManager.completePasswordReset(passwordReset!.token, 'NewTest@1234');

      expect(result).toBe(true);

      const { user } = await userManager.authenticate('reset@example.com', 'NewTest@1234');
      expect(user).toBeDefined();
    });

    it('should fail with invalid token', async () => {
      const result = await userManager.completePasswordReset('invalid-token', 'NewTest@1234');
      expect(result).toBe(false);
    });
  });

  describe('JWT Token', () => {
    it('should generate valid JWT token', async () => {
      const { emailVerification } = await userManager.register({
        email: 'test@example.com',
        password: 'Test@1234',
      });
      await userManager.verifyEmail(emailVerification!.token);

      const { tokens } = await userManager.authenticate('test@example.com', 'Test@1234');

      const payload = await userManager.verifyToken(tokens.accessToken);

      expect(payload).toBeDefined();
      expect(payload!.email).toBe('test@example.com');
      expect(payload!.role).toBe('user');
    });

    it('should return null for invalid token', async () => {
      const payload = await userManager.verifyToken('invalid-token');
      expect(payload).toBeNull();
    });

    it('should return null for tampered token', async () => {
      const { emailVerification } = await userManager.register({
        email: 'tampered@example.com',
        password: 'Test@1234',
      });
      await userManager.verifyEmail(emailVerification!.token);
      
      const { tokens } = await userManager.authenticate(
        'tampered@example.com',
        'Test@1234'
      );

      const [header, body, signature] = tokens.accessToken.split('.');
      const tamperedToken = `${header}.${body}.invalid-signature`;

      const payload = await userManager.verifyToken(tamperedToken);
      expect(payload).toBeNull();
    });
  });

  describe('Session Management', () => {
    let sessionId: string;

    beforeEach(async () => {
      const { emailVerification } = await userManager.register({
        email: 'test@example.com',
        password: 'Test@1234',
      });
      await userManager.verifyEmail(emailVerification!.token);

      const { session } = await userManager.authenticate('test@example.com', 'Test@1234');
      sessionId = session.id;
    });

    it('should get user session by id', async () => {
      const session = await userManager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session!.id).toBe(sessionId);
    });

    it('should get all user sessions', async () => {
      const sessions = await userManager.getUserSessions((await userManager.getUserByEmail('test@example.com'))!.id);
      expect(sessions.length).toBeGreaterThan(0);
    });

    it('should delete a session', async () => {
      const result = await userManager.deleteSession(sessionId);
      expect(result).toBe(true);

      const session = await userManager.getSession(sessionId);
      expect(session).toBeNull();
    });

    it('should delete all user sessions', async () => {
      await userManager.authenticate('test@example.com', 'Test@1234');

      const userId = (await userManager.getUserByEmail('test@example.com'))!.id;
      const count = await userManager.deleteAllUserSessions(userId);

      expect(count).toBeGreaterThan(0);

      const sessions = await userManager.getUserSessions(userId);
      expect(sessions.length).toBe(0);
    });

    it('should emit user.session_deleted event', async () => {
      let eventEmitted = false;
      userManager.onEvent((event) => {
        if (event.type === 'user.session_deleted') {
          eventEmitted = true;
        }
      });

      await userManager.deleteSession(sessionId);
      expect(eventEmitted).toBe(true);
    });
  });

  describe('User Profile', () => {
    it('should get user by id', async () => {
      const { user: registeredUser } = await userManager.register({
        email: 'test@example.com',
        password: 'Test@1234',
        firstName: 'John',
        lastName: 'Doe',
      });

      const user = await userManager.getUserById(registeredUser.id);
      expect(user).toBeDefined();
      expect(user!.email).toBe('test@example.com');
      expect(user!.firstName).toBe('John');
    });

    it('should get user by email', async () => {
      await userManager.register({
        email: 'test@example.com',
        password: 'Test@1234',
      });

      const user = await userManager.getUserByEmail('test@example.com');
      expect(user).toBeDefined();
      expect(user!.email).toBe('test@example.com');
    });

    it('should update user profile', async () => {
      const { user: registeredUser } = await userManager.register({
        email: 'test@example.com',
        password: 'Test@1234',
      });

      const updated = await userManager.updateUser(registeredUser.id, {
        firstName: 'Jane',
        lastName: 'Smith',
      });

      expect(updated).toBeDefined();
      expect(updated!.firstName).toBe('Jane');
      expect(updated!.lastName).toBe('Smith');
    });

    it('should update user metadata', async () => {
      const { user: registeredUser } = await userManager.register({
        email: 'test@example.com',
        password: 'Test@1234',
      });

      await userManager.updateUser(registeredUser.id, {
        metadata: { theme: 'dark' },
      });

      const user = await userManager.getUserById(registeredUser.id);
      expect(user!.metadata).toHaveProperty('theme', 'dark');
    });

    it('should delete user', async () => {
      const { user: registeredUser } = await userManager.register({
        email: 'test@example.com',
        password: 'Test@1234',
      });

      const result = await userManager.deleteUser(registeredUser.id);
      expect(result).toBe(true);

      const user = await userManager.getUserById(registeredUser.id);
      expect(user).toBeNull();
    });
  });

  describe('Role-Based Access Control', () => {
    it('should allow admin to access all resources', () => {
      const hasPermission = userManager.hasPermission('admin', {
        resource: 'users',
        action: 'delete',
      });
      expect(hasPermission).toBe(true);
    });

    it('should allow user to read their own profile', () => {
      const hasPermission = userManager.hasPermission('user', {
        resource: 'profile',
        action: 'read',
      });
      expect(hasPermission).toBe(true);
    });

    it('should allow user to update their own profile', () => {
      const hasPermission = userManager.hasPermission('user', {
        resource: 'profile',
        action: 'update',
      });
      expect(hasPermission).toBe(true);
    });

    it('should not allow user to delete other users', () => {
      const hasPermission = userManager.hasPermission('user', {
        resource: 'users',
        action: 'delete',
      });
      expect(hasPermission).toBe(false);
    });

    it('should allow guest to create session', () => {
      const hasPermission = userManager.hasPermission('guest', {
        resource: 'session',
        action: 'create',
      });
      expect(hasPermission).toBe(true);
    });

    it('should not allow guest to read profile', () => {
      const hasPermission = userManager.hasPermission('guest', {
        resource: 'profile',
        action: 'read',
      });
      expect(hasPermission).toBe(false);
    });

    it('should check permission for authenticated user', async () => {
      const { emailVerification } = await userManager.register({
        email: 'test@example.com',
        password: 'Test@1234',
      });
      await userManager.verifyEmail(emailVerification!.token);

      const { user } = await userManager.authenticate('test@example.com', 'Test@1234');

      const hasPermission = await userManager.checkPermission(user.id, {
        resource: 'profile',
        action: 'read',
      });
      expect(hasPermission).toBe(true);
    });

    it('should deny permission for inactive user', async () => {
      const { emailVerification } = await userManager.register({
        email: 'test@example.com',
        password: 'Test@1234',
      });
      await userManager.verifyEmail(emailVerification!.token);

      const { user } = await userManager.authenticate('test@example.com', 'Test@1234');
      await userManager.changeUserStatus(user.id, 'inactive');

      const hasPermission = await userManager.checkPermission(user.id, {
        resource: 'profile',
        action: 'read',
      });
      expect(hasPermission).toBe(false);
    });
  });

  describe('Role and Status Management', () => {
    it('should change user role', async () => {
      const { user: registeredUser } = await userManager.register({
        email: 'test@example.com',
        password: 'Test@1234',
        role: 'user',
      });

      const updated = await userManager.changeUserRole(registeredUser.id, 'admin');

      expect(updated).toBeDefined();
      expect(updated!.role).toBe('admin');
    });

    it('should change user status', async () => {
      const { user: registeredUser } = await userManager.register({
        email: 'test@example.com',
        password: 'Test@1234',
      });

      const updated = await userManager.changeUserStatus(registeredUser.id, 'suspended');

      expect(updated).toBeDefined();
      expect(updated!.status).toBe('suspended');
    });

    it('should emit role_changed event', async () => {
      const { user: registeredUser } = await userManager.register({
        email: 'test@example.com',
        password: 'Test@1234',
      });

      let eventEmitted = false;
      userManager.onEvent((event) => {
        if (event.type === 'user.role_changed') {
          eventEmitted = true;
        }
      });

      await userManager.changeUserRole(registeredUser.id, 'admin');
      expect(eventEmitted).toBe(true);
    });

    it('should emit status_changed event', async () => {
      const { user: registeredUser } = await userManager.register({
        email: 'test@example.com',
        password: 'Test@1234',
      });

      let eventEmitted = false;
      userManager.onEvent((event) => {
        if (event.type === 'user.status_changed') {
          eventEmitted = true;
        }
      });

      await userManager.changeUserStatus(registeredUser.id, 'suspended');
      expect(eventEmitted).toBe(true);
    });
  });

  describe('OAuth Support', () => {
    it('should create OAuth authorization', async () => {
      const authz = await userManager.createOAuthAuthorization(
        'client-123',
        'https://app.example.com/callback',
        ['openid', 'profile', 'email'],
        'random-state-string'
      );

      expect(authz).toBeDefined();
      expect(authz.clientId).toBe('client-123');
      expect(authz.redirectUri).toBe('https://app.example.com/callback');
      expect(authz.scope).toEqual(['openid', 'profile', 'email']);
      expect(authz.state).toBe('random-state-string');
    });

    it('should exchange OAuth code for tokens', async () => {
      const { user } = await userManager.exchangeOAuthCode(
        'google',
        'auth-code-123',
        'https://app.example.com/callback'
      );

      expect(user).toBeDefined();
      expect(user.email).toContain('oauth_google');
    });

    it('should get user OAuth accounts', async () => {
      await userManager.exchangeOAuthCode(
        'github',
        'auth-code-456',
        'https://app.example.com/callback'
      );

      const { user } = await userManager.exchangeOAuthCode(
        'github',
        'auth-code-456',
        'https://app.example.com/callback'
      );

      const accounts = await userManager.getUserOAuthAccounts(user.id);
      expect(accounts.length).toBeGreaterThan(0);
    });

    it('should unlink OAuth account', async () => {
      await userManager.exchangeOAuthCode(
        'github',
        'auth-code-789',
        'https://app.example.com/callback'
      );

      const { user } = await userManager.exchangeOAuthCode(
        'github',
        'auth-code-789',
        'https://app.example.com/callback'
      );

      const result = await userManager.unlinkOAuthAccount(user.id, 'github');
      expect(result).toBe(true);

      const accounts = await userManager.getUserOAuthAccounts(user.id);
      expect(accounts.find(a => a.provider === 'github')).toBeUndefined();
    });
  });

  describe('List Users', () => {
    it('should list all users', async () => {
      await userManager.register({
        email: 'user1@example.com',
        password: 'Test@1234',
      });
      await userManager.register({
        email: 'user2@example.com',
        password: 'Test@1234',
      });

      const users = await userManager.listUsers();

      expect(users.length).toBe(2);
    });
  });

  describe('Statistics', () => {
    it('should return correct stats', async () => {
      const { emailVerification: ev1 } = await userManager.register({
        email: 'user1@example.com',
        password: 'Test@1234',
      });
      const { emailVerification: ev2 } = await userManager.register({
        email: 'user2@example.com',
        password: 'Test@1234',
      });

      await userManager.verifyEmail(ev1!.token);
      await userManager.verifyEmail(ev2!.token);
      await userManager.authenticate('user1@example.com', 'Test@1234');
      await userManager.authenticate('user2@example.com', 'Test@1234');

      const stats = userManager.getStats();

      expect(stats.totalUsers).toBe(2);
      expect(stats.verifiedEmails).toBe(2);
      expect(stats.activeSessions).toBe(2);
    });
  });

  describe('Utility Functions', () => {
    describe('generateId', () => {
      it('should generate unique IDs with prefix', () => {
        const id1 = generateId('usr');
        const id2 = generateId('usr');

        expect(id1).toMatch(/^usr_[a-f0-9]{16}$/);
        expect(id2).toMatch(/^usr_[a-f0-9]{16}$/);
        expect(id1).not.toBe(id2);
      });
    });

    describe('hashPassword and verifyPassword', () => {
      it('should hash and verify password correctly', () => {
        const hash = hashPassword('Test@1234');
        expect(verifyPassword('Test@1234', hash)).toBe(true);
        expect(verifyPassword('Wrong@1234', hash)).toBe(false);
      });
    });

    describe('parseExpiresIn', () => {
      it('should parse seconds correctly', () => {
        expect(parseExpiresIn('30s')).toBe(30);
      });

      it('should parse minutes correctly', () => {
        expect(parseExpiresIn('15m')).toBe(900);
      });

      it('should parse hours correctly', () => {
        expect(parseExpiresIn('2h')).toBe(7200);
      });

      it('should parse days correctly', () => {
        expect(parseExpiresIn('7d')).toBe(604800);
      });
    });

    describe('validatePassword', () => {
      it('should validate strong password', () => {
        const errors = validatePassword('Strong@123', {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
        });
        expect(errors).toHaveLength(0);
      });
    });

    describe('isValidEmail', () => {
      it('should validate correct email formats', () => {
        expect(isValidEmail('test@example.com')).toBe(true);
        expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      });

      it('should reject invalid email formats', () => {
        expect(isValidEmail('invalid')).toBe(false);
        expect(isValidEmail('invalid@')).toBe(false);
        expect(isValidEmail('@example.com')).toBe(false);
      });
    });
  });
});

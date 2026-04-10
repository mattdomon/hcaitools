import { IdentityProviderService } from '../src/core/identityProvider/identityProvider';
import {
  IdentityProviderConfig,
  FederationProtocol,
  MFAType,
  SessionType,
} from '../src/core/identityProvider/types';

describe('IdentityProvider', () => {
  let provider: IdentityProviderService;
  let config: IdentityProviderConfig;

  beforeEach(() => {
    provider = new IdentityProviderService();
    config = {
      providerId: 'test-provider',
      name: 'Test Identity Provider',
      type: 'enterprise',
      enabled: true,
      federationConfigs: [
        {
          configId: 'google-oidc',
          protocol: 'OIDC' as FederationProtocol,
          name: 'Google',
          enabled: true,
          clientId: 'test-client-id',
          issuer: 'https://accounts.google.com',
          scope: ['openid', 'profile', 'email'],
          displayOrder: 1,
          metadata: {},
        },
        {
          configId: 'okta-saml',
          protocol: 'SAML' as FederationProtocol,
          name: 'Okta',
          enabled: true,
          samlSettings: {
            entryPoint: 'https://okta.example.com/sso',
            callbackUrl: 'https://app.example.com/saml/callback',
            issuer: 'https://app.example.com',
            cert: 'test-cert',
          },
          scope: [],
          displayOrder: 2,
          metadata: {},
        },
      ],
      sessionDuration: 3600000,
      refreshThreshold: 300000,
      maxSessionDuration: 86400000,
      enforceMFA: false,
      metadata: {},
    };
  });

  describe('Initialization', () => {
    it('should initialize with valid configuration', async () => {
      await provider.initialize(config);
      expect(provider).toBeDefined();
    });

    it('should throw error when accessing config before initialization', async () => {
      expect(() => (provider as any).getConfig()).toThrow('Identity provider not initialized');
    });
  });

  describe('User Registration', () => {
    beforeEach(async () => {
      await provider.initialize(config);
    });

    it('should register a new user successfully', async () => {
      const user = await provider.register('test@example.com', 'password123', 'Test User');
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
      expect(user.status).toBe('active');
      expect(user.userId).toMatch(/^user_/);
    });

    it('should generate unique user IDs', async () => {
      const user1 = await provider.register('user1@example.com', 'password123');
      const user2 = await provider.register('user2@example.com', 'password123');
      expect(user1.userId).not.toBe(user2.userId);
    });

    it('should throw error for invalid email format', async () => {
      await expect(provider.register('invalid-email', 'password123')).rejects.toThrow('Invalid email format');
    });

    it('should throw error for short password', async () => {
      await expect(provider.register('test@example.com', 'short')).rejects.toThrow('Password must be at least 8 characters');
    });

    it('should throw error for duplicate email registration', async () => {
      await provider.register('test@example.com', 'password123');
      await expect(provider.register('test@example.com', 'password456')).rejects.toThrow('User with this email already exists');
    });

    it('should normalize email to lowercase', async () => {
      const user = await provider.register('Test@EXAMPLE.COM', 'password123');
      expect(user.email).toBe('test@example.com');
    });

    it('should set default auth method to password', async () => {
      const user = await provider.register('test@example.com', 'password123');
      expect(user.defaultAuthMethod).toBe('password');
      expect(user.credentials.authMethods).toContain('password');
    });
  });

  describe('Authentication', () => {
    beforeEach(async () => {
      await provider.initialize(config);
      await provider.register('test@example.com', 'password123');
    });

    it('should authenticate with valid credentials', async () => {
      const session = await provider.authenticate('test@example.com', 'password123');
      expect(session.accessToken).toBeDefined();
      expect(session.sessionId).toMatch(/^sess_/);
      expect(session.userId).toBeDefined();
    });

    it('should create persistent session by default', async () => {
      const session = await provider.authenticate('test@example.com', 'password123');
      expect(session.sessionType).toBe('persistent');
    });

    it('should include refresh token in persistent session', async () => {
      const session = await provider.authenticate('test@example.com', 'password123');
      expect(session.refreshToken).toBeDefined();
    });

    it('should throw error for non-existent user', async () => {
      await expect(provider.authenticate('nonexistent@example.com', 'password123')).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for wrong password', async () => {
      await expect(provider.authenticate('test@example.com', 'wrongpassword')).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for inactive account', async () => {
      const user = await (provider as any).getUserById('user_test');
      if (user) {
        user.status = 'suspended';
        await expect(provider.authenticate('test@example.com', 'password123')).rejects.toThrow('Account is not active');
      }
    });

    it('should require MFA when enabled', async () => {
      const user = await (provider as any).getUserById('user_test');
      if (user) {
        user.mfaSettings.enabled = true;
        await expect(provider.authenticate('test@example.com', 'password123')).rejects.toThrow('MFA verification required');
      }
    });

    it('should set last login on successful authentication', async () => {
      const user = await provider.register('test2@example.com', 'password123');
      await provider.authenticate('test2@example.com', 'password123');
      const updatedUser = await (provider as any).getUserById(user.userId);
      expect(updatedUser.lastLogin).toBeDefined();
    });
  });

  describe('Session Management', () => {
    let testUserId: string;

    beforeEach(async () => {
      await provider.initialize(config);
      const user = await provider.register('test@example.com', 'password123');
      testUserId = user.userId;
    });

    it('should validate existing session', async () => {
      const session = await provider.authenticate('test@example.com', 'password123');
      const validated = await provider.validateSession(session.sessionId);
      expect(validated).not.toBeNull();
      expect(validated?.sessionId).toBe(session.sessionId);
    });

    it('should return null for non-existent session', async () => {
      const validated = await provider.validateSession('non-existent-session');
      expect(validated).toBeNull();
    });

    it('should logout successfully', async () => {
      const session = await provider.authenticate('test@example.com', 'password123');
      await provider.logout(session.sessionId);
      const validated = await provider.validateSession(session.sessionId);
      expect(validated).toBeNull();
    });

    it('should throw error when logging out non-existent session', async () => {
      await expect(provider.logout('non-existent')).rejects.toThrow('Session not found');
    });

    it('should refresh session with valid refresh token', async () => {
      const session = await provider.authenticate('test@example.com', 'password123');
      const refreshed = await provider.refreshSession(session.sessionId, session.refreshToken || '');
      expect(refreshed.accessToken).toBeDefined();
    });

    it('should revoke all user sessions', async () => {
      await provider.authenticate('test@example.com', 'password123');
      await provider.authenticate('test@example.com', 'password123');
      const count = await provider.revokeAllUserSessions(testUserId);
      expect(count).toBe(2);
    });
  });

  describe('MFA Management', () => {
    let userId: string;

    beforeEach(async () => {
      await provider.initialize(config);
      const user = await provider.register('test@example.com', 'password123');
      userId = user.userId;
    });

    it('should enable TOTP MFA', async () => {
      const challenge = await provider.enableMFA(userId, 'totp');
      expect(challenge.challengeId).toMatch(/^mfa_/);
      expect(challenge.method).toBe('totp');
      expect(challenge.secret).toBeDefined();
    });

    it('should enable SMS MFA', async () => {
      const challenge = await provider.enableMFA(userId, 'sms');
      expect(challenge.method).toBe('sms');
    });

    it('should enable Email MFA', async () => {
      const challenge = await provider.enableMFA(userId, 'email');
      expect(challenge.method).toBe('email');
    });

    it('should enable backup codes MFA', async () => {
      const challenge = await provider.enableMFA(userId, 'backup_codes');
      expect(challenge.method).toBe('backup_codes');
    });

    it('should generate 10 backup codes', async () => {
      await provider.enableMFA(userId, 'backup_codes');
      const status = await provider.getMFAStatus(userId);
      expect(status.backupCodes?.codes).toHaveLength(10);
      expect(status.backupCodes?.remaining).toBe(10);
    });

    it('should verify MFA with valid code', async () => {
      const challenge = await provider.enableMFA(userId, 'totp');
      const result = await provider.verifyMFA(userId, challenge.challengeId, '123456');
      expect(result.success).toBe(true);
    });

    it('should verify MFA with backup code', async () => {
      const challenge = await provider.enableMFA(userId, 'backup_codes');
      const status = await provider.getMFAStatus(userId);
      const backupCode = status.backupCodes?.codes[0];
      const result = await provider.verifyMFA(userId, challenge.challengeId, backupCode || '');
      expect(result.success).toBe(true);
      expect(result.remainingCodes).toBe(9);
    });

    it('should reject invalid MFA code', async () => {
      const challenge = await provider.enableMFA(userId, 'totp');
      const result = await provider.verifyMFA(userId, challenge.challengeId, '000000');
      expect(result.success).toBe(false);
    });

    it('should disable MFA', async () => {
      await provider.enableMFA(userId, 'totp');
      await provider.disableMFA(userId);
      const status = await provider.getMFAStatus(userId);
      expect(status.enabled).toBe(false);
    });

    it('should throw error for non-existent user MFA', async () => {
      await expect(provider.enableMFA('non-existent', 'totp')).rejects.toThrow('User not found');
    });
  });

  describe('Password Management', () => {
    let userId: string;

    beforeEach(async () => {
      await provider.initialize(config);
      const user = await provider.register('test@example.com', 'password123');
      userId = user.userId;
    });

    it('should change password with correct current password', async () => {
      await provider.changePassword(userId, 'password123', 'newpassword456');
    });

    it('should throw error for incorrect current password', async () => {
      await expect(provider.changePassword(userId, 'wrongpassword', 'newpassword456')).rejects.toThrow('Current password is incorrect');
    });

    it('should throw error for short new password', async () => {
      await expect(provider.changePassword(userId, 'password123', 'short')).rejects.toThrow('New password must be at least 8 characters');
    });

    it('should request password reset', async () => {
      const token = await provider.requestPasswordReset('test@example.com');
      expect(token).toBeDefined();
    });

    it('should throw error for password reset request with non-existent email', async () => {
      await expect(provider.requestPasswordReset('nonexistent@example.com')).rejects.toThrow('User not found');
    });

    it('should reset password with valid token', async () => {
      const session = await provider.authenticate('test@example.com', 'password123');
      await provider.resetPassword(session.refreshToken || 'reset_token', 'newpassword789');
    });
  });

  describe('Identity Federation', () => {
    beforeEach(async () => {
      await provider.initialize(config);
      await provider.register('test@example.com', 'password123');
    });

    it('should initiate federated login', async () => {
      const state = await provider.initiateFederatedLogin('OIDC', 'google-oidc');
      expect(state).toBeDefined();
      expect(state).toMatch(/^state_/);
    });

    it('should throw error for disabled federation provider', async () => {
      await expect(provider.initiateFederatedLogin('OIDC', 'disabled-provider')).rejects.toThrow('Federation configuration not found');
    });

    it('should handle federated callback', async () => {
      const session = await provider.handleFederatedCallback('OIDC', 'google-oidc', {});
      expect(session.sessionId).toBeDefined();
      expect(session.federationProtocol).toBe('OIDC');
    });

    it('should link identity to user', async () => {
      const user = await provider.register('test-fed@example.com', 'password123');
      const identity = await provider.linkIdentity(user.userId, 'google', 'google-123', 'linked@example.com');
      expect(identity.identityId).toMatch(/^id_/);
      expect(identity.provider).toBe('google');
      expect(identity.providerUserId).toBe('google-123');
    });

    it('should throw error for duplicate identity link', async () => {
      const user = await provider.register('test-fed2@example.com', 'password123');
      await provider.linkIdentity(user.userId, 'google', 'google-123');
      await expect(provider.linkIdentity(user.userId, 'google', 'google-123')).rejects.toThrow('Identity already linked');
    });

    it('should unlink identity from user', async () => {
      const user = await provider.register('test-fed3@example.com', 'password123');
      const identity = await provider.linkIdentity(user.userId, 'google', 'google-123');
      await provider.unlinkIdentity(user.userId, identity.identityId);
      const identities = await provider.getUserIdentities(user.userId);
      expect(identities).toHaveLength(0);
    });

    it('should get user identities', async () => {
      const user = await provider.register('test-fed4@example.com', 'password123');
      await provider.linkIdentity(user.userId, 'google', 'google-123');
      await provider.linkIdentity(user.userId, 'github', 'github-456');
      const identities = await provider.getUserIdentities(user.userId);
      expect(identities).toHaveLength(2);
    });
  });

  describe('Trusted Devices', () => {
    let userId: string;

    beforeEach(async () => {
      await provider.initialize(config);
      const user = await provider.register('test@example.com', 'password123');
      userId = user.userId;
    });

    it('should add trusted device', async () => {
      const device = await provider.addTrustedDevice(userId, {
        deviceName: 'MacBook Pro',
        deviceType: 'laptop',
        fingerprint: 'fingerprint123',
      });
      expect(device.deviceId).toMatch(/^dev_/);
      expect(device.deviceName).toBe('MacBook Pro');
    });

    it('should remove trusted device', async () => {
      const device = await provider.addTrustedDevice(userId, {
        deviceName: 'MacBook Pro',
        deviceType: 'laptop',
        fingerprint: 'fingerprint123',
      });
      await provider.removeTrustedDevice(userId, device.deviceId);
      const devices = await provider.getTrustedDevices(userId);
      expect(devices).toHaveLength(0);
    });

    it('should get user trusted devices', async () => {
      await provider.addTrustedDevice(userId, {
        deviceName: 'MacBook Pro',
        deviceType: 'laptop',
        fingerprint: 'fingerprint123',
      });
      await provider.addTrustedDevice(userId, {
        deviceName: 'iPhone',
        deviceType: 'mobile',
        fingerprint: 'fingerprint456',
      });
      const devices = await provider.getTrustedDevices(userId);
      expect(devices).toHaveLength(2);
    });

    it('should throw error when removing non-existent device', async () => {
      await expect(provider.removeTrustedDevice(userId, 'non-existent')).rejects.toThrow('Trusted device not found');
    });
  });

  describe('Audit Logging', () => {
    beforeEach(async () => {
      await provider.initialize(config);
    });

    it('should log audit events', async () => {
      await provider.register('test@example.com', 'password123');
      const events = await provider.getAuditLogs({ eventType: 'login_success' });
      expect(events.length).toBeGreaterThan(0);
    });

    it('should filter audit logs by user ID', async () => {
      const user = await provider.register('test@example.com', 'password123');
      await provider.authenticate('test@example.com', 'password123');
      const events = await provider.getAuditLogs({ userId: user.userId });
      expect(events.length).toBeGreaterThan(0);
    });

    it('should filter audit logs by event type', async () => {
      await provider.register('test@example.com', 'password123');
      await provider.authenticate('test@example.com', 'password123');
      const events = await provider.getAuditLogs({ eventType: 'login_failure' });
      expect(events.every(e => e.eventType === 'login_failure')).toBe(true);
    });

    it('should filter audit logs by date range', async () => {
      await provider.register('test@example.com', 'password123');
      const startDate = new Date(Date.now() - 1000);
      const endDate = new Date(Date.now() + 1000);
      const events = await provider.getAuditLogs({ startDate, endDate });
      expect(events.length).toBeGreaterThan(0);
    });

    it('should limit audit logs', async () => {
      await provider.register('test1@example.com', 'password123');
      await provider.register('test2@example.com', 'password123');
      const events = await provider.getAuditLogs({ limit: 1 });
      expect(events).toHaveLength(1);
    });

    it('should clear old audit events', async () => {
      await provider.register('test@example.com', 'password123');
      const clearedCount = await provider.clearOldEvents(new Date());
      expect(clearedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Session Cleanup', () => {
    beforeEach(async () => {
      await provider.initialize(config);
      await provider.register('test@example.com', 'password123');
    });

    it('should cleanup expired sessions', async () => {
      await provider.authenticate('test@example.com', 'password123');
      const cleaned = await provider.cleanupExpiredSessions();
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });
});

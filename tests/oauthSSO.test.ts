import crypto from 'crypto';
import {
  OAuthProvider,
  GrantType,
  OAuthConfig,
  OAuthTokens,
  OAuthUserInfo,
  OAuthState,
  OIDCClaims,
  SAMLSettings,
  SAMLAssertion,
  SessionStore,
  ProviderConfig,
  OAuthSSOConfig,
  OAuthClient,
  AuthorizationUrlResult,
  CallbackResult,
  SAMLClient,
  LogoutRequestResult,
  SSOSessionManager,
} from '../src/core/oauthSSO/types';

import {
  OAuthClientImpl,
  SAMLClientImpl,
  SSOSessionManagerImpl,
  OAuthSSOManager,
  createOAuthSSOManager,
  createOAuthClient,
  createSAMLClient,
  createSessionManager,
} from '../src/core/oauthSSO/oauthSSO';

const createMockProviderConfig = (provider: OAuthProvider): ProviderConfig => ({
  provider,
  enabled: true,
  config: {
    clientId: `client_${provider}`,
    clientSecret: 'test_secret',
    callbackUrl: `https://example.com/callback/${provider}`,
    authorizationUrl: `https://${provider}.com/authorize`,
    tokenUrl: `https://${provider}.com/token`,
    userInfoUrl: `https://${provider}.com/userinfo`,
    scope: ['openid', 'email', 'profile'],
    issuer: `https://${provider}.com`,
  },
});

describe('OAuthClientImpl', () => {
  let client: OAuthClientImpl;
  let googleConfig: ProviderConfig;

  beforeEach(() => {
    googleConfig = createMockProviderConfig('google');
    client = new OAuthClientImpl([googleConfig], true, true);
  });

  describe('constructor', () => {
    it('should create OAuthClientImpl with provided configurations', () => {
      const configs = [googleConfig];
      const oauthClient = new OAuthClientImpl(configs, true, true);
      expect(oauthClient).toBeInstanceOf(OAuthClientImpl);
    });

    it('should disable PKCE when pkceEnabled is false', () => {
      const clientNoPKCE = new OAuthClientImpl([googleConfig], false, true);
      expect(clientNoPKCE).toBeInstanceOf(OAuthClientImpl);
    });

    it('should disable nonce when nonceEnabled is false', () => {
      const clientNoNonce = new OAuthClientImpl([googleConfig], true, false);
      expect(clientNoNonce).toBeInstanceOf(OAuthClientImpl);
    });

    it('should handle multiple providers', () => {
      const githubConfig = createMockProviderConfig('github');
      const multiClient = new OAuthClientImpl([googleConfig, githubConfig], true, true);
      expect(multiClient).toBeInstanceOf(OAuthClientImpl);
    });

    it('should throw error for unconfigured provider', async () => {
      await expect(client.getAuthorizationUrl('github' as OAuthProvider, 'https://example.com/cb', ['openid']))
        .rejects.toThrow('Provider github not configured');
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate authorization URL with state and PKCE', async () => {
      const result = await client.getAuthorizationUrl('google', 'https://example.com/callback', ['openid', 'email']);
      expect(result.url).toContain('https://google.com/authorize');
      expect(result.url).toContain('client_id=client_google');
      expect(result.url).toContain('scope=openid+email');
      expect(result.state).toBeDefined();
      expect(result.codeVerifier).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should generate URL with nonce when openid scope included', async () => {
      const result = await client.getAuthorizationUrl('google', 'https://example.com/callback', ['openid']);
      expect(result.nonce).toBeDefined();
      expect(result.url).toContain('nonce=');
    });

    it('should not generate nonce when nonceEnabled is false', async () => {
      const clientNoNonce = new OAuthClientImpl([googleConfig], true, false);
      const result = await clientNoNonce.getAuthorizationUrl('google', 'https://example.com/callback', ['openid']);
      expect(result.nonce).toBeUndefined();
    });

    it('should use provided state if given', async () => {
      const customState = 'custom_state_123';
      const result = await client.getAuthorizationUrl('google', 'https://example.com/callback', ['openid'], customState);
      expect(result.state).toBe(customState);
    });

    it('should include code_challenge when PKCE enabled', async () => {
      const result = await client.getAuthorizationUrl('google', 'https://example.com/callback', ['openid']);
      expect(result.url).toContain('code_challenge=');
      expect(result.url).toContain('code_challenge_method=S256');
    });

    it('should not include code_challenge when PKCE disabled', async () => {
      const clientNoPKCE = new OAuthClientImpl([googleConfig], false, true);
      const result = await clientNoPKCE.getAuthorizationUrl('google', 'https://example.com/callback', ['openid']);
      expect(result.codeVerifier).toBeUndefined();
      expect(result.url).not.toContain('code_challenge=');
    });

    it('should include response_type=code', async () => {
      const result = await client.getAuthorizationUrl('google', 'https://example.com/callback', ['openid']);
      expect(result.url).toContain('response_type=code');
    });

    it('should not include prompt by default', async () => {
      const result = await client.getAuthorizationUrl('google', 'https://example.com/callback', ['openid']);
      expect(result.url).not.toContain('prompt=');
    });
  });

  describe('exchangeCode', () => {
    it('should throw error for unconfigured provider', async () => {
      await expect(client.exchangeCode('github' as OAuthProvider, 'code123')).rejects.toThrow();
    });
  });

  describe('refreshAccessToken', () => {
    it('should throw error for unconfigured provider', async () => {
      await expect(client.refreshAccessToken('github' as OAuthProvider, 'refresh_token')).rejects.toThrow();
    });
  });

  describe('revokeToken', () => {
    it('should throw error for unconfigured provider', async () => {
      await expect(client.revokeToken('github' as OAuthProvider, 'token123')).rejects.toThrow();
    });
  });

  describe('getUserInfo', () => {
    it('should throw error for unconfigured provider', async () => {
      await expect(client.getUserInfo('github' as OAuthProvider, 'token123')).rejects.toThrow();
    });
  });

  describe('handleCallback', () => {
    it('should throw error for invalid state', async () => {
      await expect(client.handleCallback('google', 'code123', 'invalid_state')).rejects.toThrow('Invalid or expired state');
    });
  });

  describe('validateIdToken', () => {
    it('should throw error for unconfigured provider', async () => {
      const invalidToken = 'header.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaXNzIjoiaHR0cHM6Ly9nb29nbGUuY29tIiwiYXVkIjoiY2xpZW50X2dvb2dsZSIsImV4cCI6OTk5OTk5OTk5OX0.signature';
      await expect(client.validateIdToken('github' as OAuthProvider, invalidToken)).rejects.toThrow();
    });

    it('should throw error for invalid token format', async () => {
      await expect(client.validateIdToken('google', 'invalid_token')).rejects.toThrow('Invalid ID token format');
    });
  });

  describe('discovery', () => {
    it('should throw error for provider without discovery URL', async () => {
      await expect(client.discovery('google')).rejects.toThrow('Discovery not supported for this provider');
    });
  });
});

describe('SAMLClientImpl', () => {
  let samlClient: SAMLClientImpl;
  let samlSettings: SAMLSettings;

  beforeEach(() => {
    samlClient = new SAMLClientImpl();
    samlSettings = {
      entryPoint: 'https://saml.example.com/sso',
      callbackUrl: 'https://example.com/saml/callback',
      issuer: 'manus-platform',
      cert: 'MIICtestcert',
      signatureAlgorithm: 'sha256',
    };
  });

  describe('initialize', () => {
    it('should initialize SAML client with settings', async () => {
      await expect(samlClient.initialize(samlSettings)).resolves.toBeUndefined();
    });
  });

  describe('getLoginUrl', () => {
    it('should throw error if not initialized', async () => {
      await expect(samlClient.getLoginUrl()).rejects.toThrow('SAML client not initialized');
    });

    it('should return URL with SAMLRequest and RelayState', async () => {
      await samlClient.initialize(samlSettings);
      const url = await samlClient.getLoginUrl('relay_state_123');
      expect(url).toContain('SAMLRequest=');
      expect(url).toContain('RelayState=relay_state_123');
    });
  });

  describe('handleAssertion', () => {
    it('should parse SAML response and extract NameID', async () => {
      const samlResponse = Buffer.from(`
        <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol">
          <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
            <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">user@example.com</saml:NameID>
            <saml:Attribute Name="email">
              <saml:AttributeValue>user@example.com</saml:AttributeValue>
            </saml:Attribute>
            <saml:AuthnStatement SessionIndex="session123">2024-01-01T00:00:00Z</saml:AuthnStatement>
          </saml:Assertion>
        </samlp:Response>
      `).toString('base64');

      const result = await samlClient.handleAssertion(samlResponse);
      expect(result.nameID).toBe('user@example.com');
      expect(result.nameIDFormat).toBe('urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress');
      expect(result.sessionIndex).toBe('session123');
      expect(result.attributes.email).toBe('user@example.com');
    });

    it('should handle response without optional fields', async () => {
      const samlResponse = Buffer.from(`
        <samlp:Response>
          <saml:Assertion>
            <saml:NameID>user@example.com</saml:NameID>
          </saml:Assertion>
        </samlp:Response>
      `).toString('base64');

      const result = await samlClient.handleAssertion(samlResponse);
      expect(result.nameID).toBe('user@example.com');
      expect(result.nameIDFormat).toBeUndefined();
      expect(result.sessionIndex).toBeUndefined();
    });
  });

  describe('createLogoutRequest', () => {
    it('should throw error if not initialized', async () => {
      await expect(samlClient.createLogoutRequest('user@example.com')).rejects.toThrow('SAML client not initialized');
    });

    it('should create base64 encoded logout request', async () => {
      await samlClient.initialize(samlSettings);
      const result = await samlClient.createLogoutRequest('user@example.com');
      expect(result.request).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.destination).toBe(samlSettings.entryPoint);
    });

    it('should include NameIDFormat when provided', async () => {
      await samlClient.initialize(samlSettings);
      const result = await samlClient.createLogoutRequest('user@example.com', 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress');
      const decoded = Buffer.from(result.request, 'base64').toString('utf8');
      expect(decoded).toContain('Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"');
    });
  });

  describe('handleLogoutResponse', () => {
    it('should handle logout response without error', async () => {
      await samlClient.initialize(samlSettings);
      await expect(samlClient.handleLogoutResponse('response')).resolves.toBeUndefined();
    });
  });

  describe('signRequest', () => {
    it('should sign request with private key', async () => {
      const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
      const privateKeyPem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
      await samlClient.initialize(samlSettings);
      const signature = await samlClient.signRequest('test body', privateKeyPem);
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
    });
  });
});

describe('SSOSessionManagerImpl', () => {
  let sessionManager: SSOSessionManagerImpl;

  beforeEach(() => {
    sessionManager = new SSOSessionManagerImpl(3600000, 300000);
  });

  describe('constructor', () => {
    it('should create session manager with default values', () => {
      const manager = new SSOSessionManagerImpl();
      expect(manager).toBeInstanceOf(SSOSessionManagerImpl);
    });

    it('should create session manager with custom values', () => {
      const manager = new SSOSessionManagerImpl(7200000, 600000);
      expect(manager).toBeInstanceOf(SSOSessionManagerImpl);
    });
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const tokens: OAuthTokens = {
        accessToken: 'access_123',
        refreshToken: 'refresh_456',
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: 'Bearer',
        scope: ['openid', 'email'],
      };
      const userInfo: OAuthUserInfo = {
        provider: 'google',
        providerUserId: 'google_123',
        email: 'test@example.com',
        name: 'Test User',
      };

      const session = await sessionManager.createSession('user_123', 'google', tokens, userInfo);
      expect(session.sessionId).toBeDefined();
      expect(session.sessionId.startsWith('sess_')).toBe(true);
      expect(session.userId).toBe('user_123');
      expect(session.provider).toBe('google');
      expect(session.accessToken).toBe('access_123');
      expect(session.refreshToken).toBe('refresh_456');
    });
  });

  describe('getSession', () => {
    it('should return null for non-existent session', async () => {
      const session = await sessionManager.getSession('non_existent');
      expect(session).toBeNull();
    });

    it('should return session when it exists and is not expired', async () => {
      const tokens: OAuthTokens = {
        accessToken: 'access_123',
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: 'Bearer',
        scope: [],
      };
      const userInfo: OAuthUserInfo = { provider: 'google', providerUserId: '123' };
      const session = await sessionManager.createSession('user_123', 'google', tokens, userInfo);

      const retrieved = await sessionManager.getSession(session.sessionId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.sessionId).toBe(session.sessionId);
    });

    it('should return null for expired session', async () => {
      const tokens: OAuthTokens = {
        accessToken: 'access_123',
        expiresAt: new Date(Date.now() - 1000),
        tokenType: 'Bearer',
        scope: [],
      };
      const userInfo: OAuthUserInfo = { provider: 'google', providerUserId: '123' };
      const session = await sessionManager.createSession('user_123', 'google', tokens, userInfo);

      const retrieved = await sessionManager.getSession(session.sessionId);
      expect(retrieved).toBeNull();
    });
  });

  describe('updateSession', () => {
    it('should throw error for non-existent session', async () => {
      await expect(sessionManager.updateSession('non_existent', { data: { key: 'value' } }))
        .rejects.toThrow('Session not found');
    });

    it('should update session data', async () => {
      const tokens: OAuthTokens = {
        accessToken: 'access_123',
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: 'Bearer',
        scope: [],
      };
      const userInfo: OAuthUserInfo = { provider: 'google', providerUserId: '123' };
      const session = await sessionManager.createSession('user_123', 'google', tokens, userInfo);

      await sessionManager.updateSession(session.sessionId, { data: { customKey: 'customValue' } });
      const updated = await sessionManager.getSession(session.sessionId);
      expect(updated?.data.customKey).toBe('customValue');
    });
  });

  describe('deleteSession', () => {
    it('should delete existing session', async () => {
      const tokens: OAuthTokens = {
        accessToken: 'access_123',
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: 'Bearer',
        scope: [],
      };
      const userInfo: OAuthUserInfo = { provider: 'google', providerUserId: '123' };
      const session = await sessionManager.createSession('user_123', 'google', tokens, userInfo);

      await sessionManager.deleteSession(session.sessionId);
      const retrieved = await sessionManager.getSession(session.sessionId);
      expect(retrieved).toBeNull();
    });

    it('should not throw for non-existent session', async () => {
      await expect(sessionManager.deleteSession('non_existent')).resolves.toBeUndefined();
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should return 0 when no sessions exist', async () => {
      const count = await sessionManager.cleanupExpiredSessions();
      expect(count).toBe(0);
    });

    it('should clean up expired sessions', async () => {
      const expiredTokens: OAuthTokens = {
        accessToken: 'expired_access',
        expiresAt: new Date(Date.now() - 1000),
        tokenType: 'Bearer',
        scope: [],
      };
      const validTokens: OAuthTokens = {
        accessToken: 'valid_access',
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: 'Bearer',
        scope: [],
      };
      const userInfo: OAuthUserInfo = { provider: 'google', providerUserId: '123' };

      await sessionManager.createSession('user_expired', 'google', expiredTokens, userInfo);
      await sessionManager.createSession('user_valid', 'google', validTokens, userInfo);

      const count = await sessionManager.cleanupExpiredSessions();
      expect(count).toBe(1);
    });
  });

  describe('validateSession', () => {
    it('should return null for non-existent session', async () => {
      const validated = await sessionManager.validateSession('non_existent');
      expect(validated).toBeNull();
    });

    it('should return null for session expiring soon', async () => {
      const tokens: OAuthTokens = {
        accessToken: 'access_123',
        expiresAt: new Date(Date.now() + 100000),
        tokenType: 'Bearer',
        scope: [],
      };
      const userInfo: OAuthUserInfo = { provider: 'google', providerUserId: '123' };
      const session = await sessionManager.createSession('user_123', 'google', tokens, userInfo);

      const validated = await sessionManager.validateSession(session.sessionId);
      expect(validated).toBeNull();
    });

    it('should return session when valid and not expiring soon', async () => {
      const tokens: OAuthTokens = {
        accessToken: 'access_123',
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: 'Bearer',
        scope: [],
      };
      const userInfo: OAuthUserInfo = { provider: 'google', providerUserId: '123' };
      const session = await sessionManager.createSession('user_123', 'google', tokens, userInfo);

      const validated = await sessionManager.validateSession(session.sessionId);
      expect(validated).not.toBeNull();
      expect(validated?.sessionId).toBe(session.sessionId);
    });
  });
});

describe('OAuthSSOManager', () => {
  let manager: OAuthSSOManager;
  let config: OAuthSSOConfig;

  beforeEach(() => {
    config = {
      providers: [createMockProviderConfig('google')],
      defaultProvider: 'google',
      sessionDuration: 3600000,
      refreshThreshold: 300000,
      pkceEnabled: true,
      nonceEnabled: true,
    };
    manager = new OAuthSSOManager(config);
  });

  describe('constructor', () => {
    it('should create OAuthSSOManager with config', () => {
      const m = new OAuthSSOManager(config);
      expect(m).toBeInstanceOf(OAuthSSOManager);
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should delegate to OAuthClient', async () => {
      const result = await manager.getAuthorizationUrl('google', 'https://example.com/callback', ['openid']);
      expect(result.url).toContain('https://google.com/authorize');
    });
  });

  describe('handleOAuthCallback', () => {
    it('should throw error when no default provider', async () => {
      const configNoDefault: OAuthSSOConfig = {
        providers: [createMockProviderConfig('google')],
        sessionDuration: 3600000,
        refreshThreshold: 300000,
        pkceEnabled: true,
        nonceEnabled: true,
      };
      const m = new OAuthSSOManager(configNoDefault);
      await expect(m.handleOAuthCallback('code', 'state')).rejects.toThrow('No default provider configured');
    });
  });

  describe('getDefaultProvider', () => {
    it('should return configured default provider', () => {
      expect(manager.getDefaultProvider()).toBe('google');
    });

    it('should return undefined when no default provider', () => {
      const configNoDefault: OAuthSSOConfig = {
        providers: [createMockProviderConfig('google')],
        sessionDuration: 3600000,
        refreshThreshold: 300000,
        pkceEnabled: true,
        nonceEnabled: true,
      };
      const m = new OAuthSSOManager(configNoDefault);
      expect(m.getDefaultProvider()).toBeUndefined();
    });
  });

  describe('getEnabledProviders', () => {
    it('should return enabled providers', () => {
      const providers = manager.getEnabledProviders();
      expect(providers).toContain('google');
    });
  });

  describe('SAML methods', () => {
    it('should initialize SAML settings', async () => {
      const samlSettings: SAMLSettings = {
        entryPoint: 'https://saml.example.com/sso',
        callbackUrl: 'https://example.com/saml/callback',
        issuer: 'manus-platform',
        cert: 'MIICtestcert',
      };
      await expect(manager.initializeSAML(samlSettings)).resolves.toBeUndefined();
    });

    it('should get SAML login URL', async () => {
      const samlSettings: SAMLSettings = {
        entryPoint: 'https://saml.example.com/sso',
        callbackUrl: 'https://example.com/saml/callback',
        issuer: 'manus-platform',
        cert: 'MIICtestcert',
      };
      await manager.initializeSAML(samlSettings);
      const url = await manager.getSAMLLoginUrl('relay');
      expect(url).toContain('SAMLRequest=');
    });
  });

  describe('session management', () => {
    it('should create session', async () => {
      const tokens: OAuthTokens = {
        accessToken: 'access_123',
        refreshToken: 'refresh_456',
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: 'Bearer',
        scope: ['openid'],
      };
      const userInfo: OAuthUserInfo = {
        provider: 'google',
        providerUserId: 'google_123',
        email: 'test@example.com',
      };

      const session = await manager.createSession('user_123', 'google', tokens, userInfo);
      expect(session.sessionId).toBeDefined();
      expect(session.userId).toBe('user_123');
    });

    it('should get session', async () => {
      const tokens: OAuthTokens = {
        accessToken: 'access_123',
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: 'Bearer',
        scope: [],
      };
      const userInfo: OAuthUserInfo = { provider: 'google', providerUserId: '123' };
      const session = await manager.createSession('user_123', 'google', tokens, userInfo);

      const retrieved = await manager.getSession(session.sessionId);
      expect(retrieved?.sessionId).toBe(session.sessionId);
    });

    it('should delete session', async () => {
      const tokens: OAuthTokens = {
        accessToken: 'access_123',
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: 'Bearer',
        scope: [],
      };
      const userInfo: OAuthUserInfo = { provider: 'google', providerUserId: '123' };
      const session = await manager.createSession('user_123', 'google', tokens, userInfo);

      await manager.deleteSession(session.sessionId);
      const retrieved = await manager.getSession(session.sessionId);
      expect(retrieved).toBeNull();
    });
  });
});

describe('Factory Functions', () => {
  describe('createOAuthSSOManager', () => {
    it('should create OAuthSSOManager instance', () => {
      const config: OAuthSSOConfig = {
        providers: [createMockProviderConfig('google')],
        defaultProvider: 'google',
        sessionDuration: 3600000,
        refreshThreshold: 300000,
        pkceEnabled: true,
        nonceEnabled: true,
      };
      const manager = createOAuthSSOManager(config);
      expect(manager).toBeInstanceOf(OAuthSSOManager);
    });
  });

  describe('createOAuthClient', () => {
    it('should create OAuthClientImpl instance', () => {
      const client = createOAuthClient([createMockProviderConfig('google')]);
      expect(client).toBeInstanceOf(OAuthClientImpl);
    });
  });

  describe('createSAMLClient', () => {
    it('should create SAMLClientImpl instance', () => {
      const client = createSAMLClient();
      expect(client).toBeInstanceOf(SAMLClientImpl);
    });
  });

  describe('createSessionManager', () => {
    it('should create SSOSessionManagerImpl instance', () => {
      const manager = createSessionManager();
      expect(manager).toBeInstanceOf(SSOSessionManagerImpl);
    });

    it('should create with custom durations', () => {
      const manager = createSessionManager(7200000, 600000);
      expect(manager).toBeInstanceOf(SSOSessionManagerImpl);
    });
  });
});

describe('Type Definitions', () => {
  it('should export all OAuth provider types', () => {
    const providers: OAuthProvider[] = ['google', 'github', 'facebook', 'twitter', 'linkedin'];
    expect(providers).toHaveLength(5);
  });

  it('should export all grant types', () => {
    const grants: GrantType[] = ['authorization_code', 'client_credentials', 'refresh_token'];
    expect(grants).toHaveLength(3);
  });
});

import crypto from 'crypto';
import {
  OAuthProvider,
  OAuthConfig,
  OAuthTokens,
  OAuthUserInfo,
  OAuthState,
  OIDCClaims,
  SAMLSettings,
  SAMLAssertion,
  SessionStore,
  AuthorizationRequest,
  TokenRequest,
  DiscoveryDocument,
  PKCEParams,
  ProviderConfig,
  OAuthSSOConfig,
  OAuthClient,
  AuthorizationUrlResult,
  CallbackResult,
  SAMLClient,
  LogoutRequestResult,
  SSOSessionManager,
} from './types';

const generateId = (prefix: string): string => {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
};

const isOAuthError = (response: unknown): response is { error: string; errorDescription?: string } => {
  if (typeof response === 'object' && response !== null) {
    const obj = response as Record<string, unknown>;
    return typeof obj.error === 'string';
  }
  return false;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const parseJWT = (token: string): Record<string, unknown> | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
};

const base64urlEncode = (data: Buffer): string => {
  return data.toString('base64url');
};

const generateCodeVerifier = (): string => {
  return base64urlEncode(crypto.randomBytes(32));
};

const generateCodeChallenge = (verifier: string): string => {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return base64urlEncode(hash);
};

const _PROVIDER_CONFIGS: Record<OAuthProvider, Omit<OAuthConfig, 'clientId' | 'clientSecret' | 'callbackUrl'>> = {
  google: {
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scope: ['openid', 'email', 'profile'],
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    issuer: 'https://accounts.google.com',
    discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
  },
  github: {
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scope: ['read:user', 'user:email'],
  },
  facebook: {
    authorizationUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me',
    scope: ['email', 'public_profile'],
  },
  twitter: {
    authorizationUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    userInfoUrl: 'https://api.twitter.com/2/users/me',
    scope: ['tweet.read', 'users.read', 'offline.access'],
  },
  linkedin: {
    authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoUrl: 'https://api.linkedin.com/v2/me',
    scope: ['r_emailaddress', 'r_liteprofile', 'openid', 'profile'],
  },
};

export class OAuthClientImpl implements OAuthClient {
  private configs: Map<OAuthProvider, ProviderConfig> = new Map();
  private states: Map<string, OAuthState> = new Map();
  private pkceEnabled: boolean = true;
  private nonceEnabled: boolean = true;
  private discoveryCache: Map<OAuthProvider, DiscoveryDocument> = new Map();

  constructor(configs: ProviderConfig[], pkceEnabled: boolean = true, nonceEnabled: boolean = true) {
    for (const providerConfig of configs) {
      this.configs.set(providerConfig.provider, providerConfig);
    }
    this.pkceEnabled = pkceEnabled;
    this.nonceEnabled = nonceEnabled;
  }

  private getConfig(provider: OAuthProvider): OAuthConfig {
    const providerConfig = this.configs.get(provider);
    if (!providerConfig) {
      throw new Error(`Provider ${provider} not configured`);
    }
    return providerConfig.config;
  }

  private createState(): OAuthState {
    const state: OAuthState = {
      state: generateId('state'),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };
    this.states.set(state.state, state);
    return state;
  }

  private validateState(state: string): OAuthState | null {
    const stateObj = this.states.get(state);
    if (!stateObj) return null;
    if (stateObj.expiresAt < new Date()) {
      this.states.delete(state);
      return null;
    }
    this.states.delete(state);
    return stateObj;
  }

  private buildAuthUrl(provider: OAuthProvider, config: OAuthConfig, request: AuthorizationRequest, pkce?: PKCEParams): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: request.redirectUri,
      response_type: request.responseType || 'code',
      scope: request.scope.join(' '),
      state: request.state,
    });

    if (pkce) {
      params.set('code_challenge', pkce.codeChallenge);
      params.set('code_challenge_method', pkce.codeChallengeMethod);
    }

    if (request.nonce) {
      params.set('nonce', request.nonce);
    }

    if (request.prompt) {
      params.set('prompt', request.prompt);
    }

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  private async buildTokenRequest(provider: OAuthProvider, request: TokenRequest): Promise<URLSearchParams> {
    const config = this.getConfig(provider);
    const params = new URLSearchParams({
      grant_type: request.grantType,
      client_id: request.clientId || config.clientId,
      client_secret: request.clientSecret || config.clientSecret,
    });

    if (request.code) {
      params.set('code', request.code);
      params.set('redirect_uri', request.redirectUri || config.callbackUrl);
    }

    if (request.codeVerifier) {
      params.set('code_verifier', request.codeVerifier);
    }

    if (request.refreshToken) {
      params.set('refresh_token', request.refreshToken);
    }

    return params;
  }

  private async fetchToken(provider: OAuthProvider, request: TokenRequest): Promise<{
    accessToken: string;
    refreshToken?: string;
    idToken?: string;
    expiresIn: number;
    tokenType: string;
    scope: string[];
  }> {
    const params = await this.buildTokenRequest(provider, request);
    const config = this.getConfig(provider);

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      if (isOAuthError(errorBody)) {
        throw new Error(`OAuth error: ${errorBody.error} - ${errorBody.errorDescription || ''}`);
      }
      throw new Error(`Token fetch failed: ${response.status}`);
    }

    const data = await response.json() as Record<string, unknown>;
    return {
      accessToken: String(data.access_token ?? ''),
      refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
      idToken: typeof data.id_token === 'string' ? data.id_token : undefined,
      expiresIn: typeof data.expires_in === 'number' ? data.expires_in : 0,
      tokenType: typeof data.token_type === 'string' ? data.token_type : 'Bearer',
      scope: typeof data.scope === 'string' ? data.scope.split(' ') : [],
    };
  }

  private mapUserInfo(provider: OAuthProvider, data: Record<string, unknown>): OAuthUserInfo {
    const getString = (obj: Record<string, unknown>, key: string): string | undefined => {
      const val = obj[key];
      return typeof val === 'string' ? val : undefined;
    };

    const getBool = (obj: Record<string, unknown>, key: string): boolean | undefined => {
      const val = obj[key];
      return typeof val === 'boolean' ? val : undefined;
    };

    const baseInfo: OAuthUserInfo = {
      provider,
      providerUserId: getString(data, 'id') || getString(data, 'sub') || getString(data, 'nameID') || '',
      email: getString(data, 'email'),
      name: getString(data, 'name') || getString(data, 'displayName'),
      picture: getString(data, 'picture') || getString(data, 'avatar_url'),
      rawData: data,
    };

    switch (provider) {
      case 'google':
        baseInfo.emailVerified = getBool(data, 'email_verified');
        break;
      case 'facebook':
        baseInfo.emailVerified = true;
        break;
      case 'github':
        break;
    }

    return baseInfo;
  }

  async getAuthorizationUrl(provider: OAuthProvider, redirectUri: string, scope: string[], state?: string): Promise<AuthorizationUrlResult> {
    const config = this.getConfig(provider);
    const oauthState = this.createState();
    oauthState.redirectUri = redirectUri;
    const finalState = state || oauthState.state;

    let pkce: PKCEParams | undefined;
    if (this.pkceEnabled) {
      const verifier = generateCodeVerifier();
      oauthState.codeVerifier = verifier;
      pkce = {
        codeVerifier: verifier,
        codeChallenge: generateCodeChallenge(verifier),
        codeChallengeMethod: 'S256',
      };
    }

    if (this.nonceEnabled && scope.includes('openid')) {
      oauthState.nonce = generateId('nonce');
    }

    const authUrl = this.buildAuthUrl(provider, config, {
      provider,
      redirectUri,
      scope,
      state: finalState,
      nonce: oauthState.nonce,
      codeVerifier: pkce?.codeVerifier,
    }, pkce);

    return {
      url: authUrl,
      state: finalState,
      nonce: oauthState.nonce,
      codeVerifier: pkce?.codeVerifier,
      expiresAt: oauthState.expiresAt,
    };
  }

  async exchangeCode(provider: OAuthProvider, code: string, codeVerifier?: string): Promise<OAuthTokens> {
    const config = this.getConfig(provider);
    const tokenResponse = await this.fetchToken(provider, {
      provider,
      grantType: 'authorization_code',
      code,
      codeVerifier,
      redirectUri: config.callbackUrl,
    });

    return {
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      idToken: tokenResponse.idToken,
      expiresAt: new Date(Date.now() + tokenResponse.expiresIn * 1000),
      tokenType: tokenResponse.tokenType,
      scope: tokenResponse.scope,
    };
  }

  async refreshAccessToken(provider: OAuthProvider, refreshToken: string): Promise<OAuthTokens> {
    const tokenResponse = await this.fetchToken(provider, {
      provider,
      grantType: 'refresh_token',
      refreshToken,
    });

    return {
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      idToken: tokenResponse.idToken,
      expiresAt: new Date(Date.now() + tokenResponse.expiresIn * 1000),
      tokenType: tokenResponse.tokenType,
      scope: tokenResponse.scope,
    };
  }

  async revokeToken(provider: OAuthProvider, token: string, tokenTypeHint?: 'access_token' | 'refresh_token'): Promise<void> {
    const config = this.getConfig(provider);
    const params = new URLSearchParams({
      token,
    });

    if (tokenTypeHint) {
      params.set('token_type_hint', tokenTypeHint);
    }

    await fetch(`${config.tokenUrl.replace('/token', '/revoke')}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
  }

  async getUserInfo(provider: OAuthProvider, accessToken: string): Promise<OAuthUserInfo> {
    const config = this.getConfig(provider);

    const response = await fetch(config.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`User info fetch failed: ${response.status}`);
    }

    const data = await response.json();
    if (!isRecord(data)) {
      throw new Error('Invalid user info response');
    }
    return this.mapUserInfo(provider, data);
  }

  async handleCallback(provider: OAuthProvider, code: string, state: string, codeVerifier?: string): Promise<CallbackResult> {
    const validatedState = this.validateState(state);
    if (!validatedState) {
      throw new Error('Invalid or expired state');
    }

    const tokens = await this.exchangeCode(provider, code, codeVerifier || validatedState.codeVerifier);
    const userInfo = await this.getUserInfo(provider, tokens.accessToken);

    return {
      tokens,
      userInfo,
      sessionId: generateId('sess'),
    };
  }

  async validateIdToken(provider: OAuthProvider, idToken: string, nonce?: string): Promise<OIDCClaims> {
    const config = this.getConfig(provider);
    const payload = parseJWT(idToken);

    if (!payload) {
      throw new Error('Invalid ID token format');
    }

    const claims = payload as unknown as OIDCClaims;

    if (claims.iss !== config.issuer) {
      throw new Error('Invalid issuer');
    }

    if (claims.exp < Date.now() / 1000) {
      throw new Error('ID token expired');
    }

    if (nonce && claims.nonce !== nonce) {
      throw new Error('Invalid nonce');
    }

    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audience.includes(config.clientId)) {
      throw new Error('Invalid audience');
    }

    return claims;
  }

  async discovery(provider: OAuthProvider): Promise<DiscoveryDocument> {
    const cached = this.discoveryCache.get(provider);
    if (cached) return cached;

    const config = this.getConfig(provider);
    if (!config.discoveryUrl) {
      throw new Error('Discovery not supported for this provider');
    }

    const response = await fetch(config.discoveryUrl);
    if (!response.ok) {
      throw new Error(`Discovery fetch failed: ${response.status}`);
    }

    const doc = await response.json() as DiscoveryDocument;
    this.discoveryCache.set(provider, doc);
    return doc;
  }
}

export class SAMLClientImpl implements SAMLClient {
  private settings: SAMLSettings | null = null;

  async initialize(settings: SAMLSettings): Promise<void> {
    this.settings = settings;
  }

  async getLoginUrl(relayState?: string): Promise<string> {
    if (!this.settings) {
      throw new Error('SAML client not initialized');
    }

    const params = new URLSearchParams({
      SAMLRequest: await this.createAuthnRequest(),
      RelayState: relayState || '',
    });

    return `${this.settings.entryPoint}?${params.toString()}`;
  }

  private async createAuthnRequest(): Promise<string> {
    if (!this.settings) {
      throw new Error('SAML client not initialized');
    }

    const id = `_${generateId('saml')}`;
    const issueInstant = new Date().toISOString();

    const request = `
      <samlp:AuthnRequest
        xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
        ID="${id}"
        Version="2.0"
        IssueInstant="${issueInstant}"
        AssertionConsumerServiceURL="${this.settings.callbackUrl}"
        Destination="${this.settings.entryPoint}">
        <saml:Issuer>${this.settings.issuer}</saml:Issuer>
      </samlp:AuthnRequest>
    `.trim();

    return Buffer.from(request).toString('base64');
  }

  async handleAssertion(samlResponse: string, _relayState?: string): Promise<SAMLAssertion> {
    const decoded = Buffer.from(samlResponse, 'base64').toString('utf8');

    const nameIDMatch = decoded.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/);
    const nameIDFormatMatch = decoded.match(/<saml:NameID[^>]*Format="([^"]+)"[^>]*>/);
    const sessionIndexMatch = decoded.match(/SessionIndex="([^"]+)"/);

    const attributes: Record<string, string | string[]> = {};
    const attrMatches = decoded.matchAll(/<saml:Attribute Name="([^"]+)"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/g);
    for (const match of attrMatches) {
      attributes[match[1]] = match[2];
    }

    return {
      nameID: nameIDMatch ? nameIDMatch[1] : '',
      nameIDFormat: nameIDFormatMatch ? nameIDFormatMatch[1] : undefined,
      sessionIndex: sessionIndexMatch ? sessionIndexMatch[1] : undefined,
      attributes,
    };
  }

  async createLogoutRequest(nameID: string, nameIDFormat?: string): Promise<LogoutRequestResult> {
    if (!this.settings) {
      throw new Error('SAML client not initialized');
    }

    const id = `_${generateId('saml')}`;
    const issueInstant = new Date().toISOString();

    const request = `
      <samlp:LogoutRequest
        xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
        ID="${id}"
        Version="2.0"
        IssueInstant="${issueInstant}"
        Destination="${this.settings.entryPoint}">
        <saml:Issuer>${this.settings.issuer}</saml:Issuer>
        <saml:NameID${nameIDFormat ? ` Format="${nameIDFormat}"` : ''}>${nameID}</saml:NameID>
      </samlp:LogoutRequest>
    `.trim();

    return {
      request: Buffer.from(request).toString('base64'),
      id,
      destination: this.settings.entryPoint,
    };
  }

  async handleLogoutResponse(_response: string): Promise<void> {
    return;
  }

  async signRequest(body: string, privateKey: string): Promise<string> {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(body);
    return sign.sign(privateKey, 'base64');
  }
}

export class SSOSessionManagerImpl implements SSOSessionManager {
  private sessions: Map<string, SessionStore> = new Map();
  private sessionDuration: number;
  private refreshThreshold: number;

  constructor(sessionDuration: number = 3600000, refreshThreshold: number = 300000) {
    this.sessionDuration = sessionDuration;
    this.refreshThreshold = refreshThreshold;
  }

  async createSession(userId: string, provider: OAuthProvider, tokens: OAuthTokens, userInfo: OAuthUserInfo): Promise<SessionStore> {
    const session: SessionStore = {
      sessionId: generateId('sess'),
      userId,
      oauthUserId: userInfo.providerUserId,
      provider,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      data: { userInfo },
    };

    this.sessions.set(session.sessionId, session);
    return session;
  }

  async getSession(sessionId: string): Promise<SessionStore | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (session.expiresAt < new Date()) {
      this.sessions.delete(sessionId);
      return null;
    }

    session.lastAccessedAt = new Date();
    return session;
  }

  async updateSession(sessionId: string, updates: Partial<SessionStore>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    Object.assign(session, updates);
    session.lastAccessedAt = new Date();
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
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

  async validateSession(sessionId: string): Promise<SessionStore | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const timeUntilExpiry = session.expiresAt.getTime() - Date.now();
    if (timeUntilExpiry < this.refreshThreshold) {
      return null;
    }

    return session;
  }
}

export class OAuthSSOManager implements OAuthClient {
  private oauthClient: OAuthClientImpl;
  private samlClient: SAMLClientImpl;
  private sessionManager: SSOSessionManagerImpl;
  private config: OAuthSSOConfig;

  constructor(config: OAuthSSOConfig) {
    this.config = config;
    this.oauthClient = new OAuthClientImpl(config.providers, config.pkceEnabled, config.nonceEnabled);
    this.samlClient = new SAMLClientImpl();
    this.sessionManager = new SSOSessionManagerImpl(config.sessionDuration, config.refreshThreshold);
  }

  async getAuthorizationUrl(provider: OAuthProvider, redirectUri: string, scope: string[], state?: string): Promise<AuthorizationUrlResult> {
    return this.oauthClient.getAuthorizationUrl(provider, redirectUri, scope, state);
  }

  async exchangeCode(provider: OAuthProvider, code: string, codeVerifier?: string): Promise<OAuthTokens> {
    return this.oauthClient.exchangeCode(provider, code, codeVerifier);
  }

  async refreshAccessToken(provider: OAuthProvider, refreshToken: string): Promise<OAuthTokens> {
    return this.oauthClient.refreshAccessToken(provider, refreshToken);
  }

  async revokeToken(provider: OAuthProvider, token: string, tokenTypeHint?: 'access_token' | 'refresh_token'): Promise<void> {
    return this.oauthClient.revokeToken(provider, token, tokenTypeHint);
  }

  async getUserInfo(provider: OAuthProvider, accessToken: string): Promise<OAuthUserInfo> {
    return this.oauthClient.getUserInfo(provider, accessToken);
  }

  async handleCallback(provider: OAuthProvider, code: string, state: string, codeVerifier?: string): Promise<CallbackResult> {
    return this.oauthClient.handleCallback(provider, code, state, codeVerifier);
  }

  async validateIdToken(provider: OAuthProvider, idToken: string, nonce?: string): Promise<OIDCClaims> {
    return this.oauthClient.validateIdToken(provider, idToken, nonce);
  }

  async discovery(provider: OAuthProvider): Promise<DiscoveryDocument> {
    return this.oauthClient.discovery(provider);
  }

  async initializeSAML(settings: SAMLSettings): Promise<void> {
    await this.samlClient.initialize(settings);
  }

  async getSAMLLoginUrl(relayState?: string): Promise<string> {
    return this.samlClient.getLoginUrl(relayState);
  }

  async handleSAMLAssertion(samlResponse: string, relayState?: string): Promise<SAMLAssertion> {
    return this.samlClient.handleAssertion(samlResponse, relayState);
  }

  async createSAMLLogoutRequest(nameID: string, nameIDFormat?: string): Promise<LogoutRequestResult> {
    return this.samlClient.createLogoutRequest(nameID, nameIDFormat);
  }

  async handleSAMLLogoutResponse(response: string): Promise<void> {
    return this.samlClient.handleLogoutResponse(response);
  }

  async signSAMLRequest(body: string, privateKey: string): Promise<string> {
    return this.samlClient.signRequest(body, privateKey);
  }

  async createSession(userId: string, provider: OAuthProvider, tokens: OAuthTokens, userInfo: OAuthUserInfo): Promise<SessionStore> {
    return this.sessionManager.createSession(userId, provider, tokens, userInfo);
  }

  async getSession(sessionId: string): Promise<SessionStore | null> {
    return this.sessionManager.getSession(sessionId);
  }

  async updateSession(sessionId: string, updates: Partial<SessionStore>): Promise<void> {
    return this.sessionManager.updateSession(sessionId, updates);
  }

  async deleteSession(sessionId: string): Promise<void> {
    return this.sessionManager.deleteSession(sessionId);
  }

  async cleanupExpiredSessions(): Promise<number> {
    return this.sessionManager.cleanupExpiredSessions();
  }

  async validateSession(sessionId: string): Promise<SessionStore | null> {
    return this.sessionManager.validateSession(sessionId);
  }

  async handleOAuthCallback(code: string, state: string, codeVerifier?: string): Promise<CallbackResult> {
    const defaultProvider = this.config.defaultProvider;
    if (!defaultProvider) {
      throw new Error('No default provider configured');
    }
    return this.handleCallback(defaultProvider, code, state, codeVerifier);
  }

  getDefaultProvider(): OAuthProvider | undefined {
    return this.config.defaultProvider;
  }

  getEnabledProviders(): OAuthProvider[] {
    return this.config.providers.filter(p => p.enabled).map(p => p.provider);
  }
}

export const createOAuthSSOManager = (config: OAuthSSOConfig): OAuthSSOManager => {
  return new OAuthSSOManager(config);
};

export const createOAuthClient = (providers: ProviderConfig[], pkceEnabled?: boolean, nonceEnabled?: boolean): OAuthClientImpl => {
  return new OAuthClientImpl(providers, pkceEnabled, nonceEnabled);
};

export const createSAMLClient = (): SAMLClientImpl => {
  return new SAMLClientImpl();
};

export const createSessionManager = (sessionDuration?: number, refreshThreshold?: number): SSOSessionManagerImpl => {
  return new SSOSessionManagerImpl(sessionDuration, refreshThreshold);
};

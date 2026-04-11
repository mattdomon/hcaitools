export type OAuthProvider = 'google' | 'github' | 'facebook' | 'twitter' | 'linkedin';

export type GrantType = 'authorization_code' | 'client_credentials' | 'refresh_token';

export type TokenType = 'access_token' | 'refresh_token' | 'id_token';

export type SSOProtocol = 'oauth2' | 'oidc' | 'saml';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  scope: string[];
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  jwksUrl?: string;
  issuer?: string;
  discoveryUrl?: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: Date;
  tokenType: string;
  scope: string[];
}

export interface OAuthUserInfo {
  provider: OAuthProvider;
  providerUserId: string;
  email?: string;
  name?: string;
  picture?: string;
  emailVerified?: boolean;
  rawData?: Record<string, unknown>;
}

export interface OAuthState {
  state: string;
  nonce?: string;
  codeVerifier?: string;
  redirectUri?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface OIDCClaims {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
  zoneinfo?: string;
  updated_at?: number;
}

export interface SAMLSettings {
  entryPoint: string;
  callbackUrl: string;
  issuer: string;
  cert: string;
  privateKey?: string;
  signatureAlgorithm?: 'sha1' | 'sha256' | 'sha512';
  identifierFormat?: string;
  wantAssertionsSigned?: boolean;
  acceptedDuration?: number;
}

export interface SAMLAssertion {
  nameID: string;
  nameIDFormat?: string;
  sessionIndex?: string;
  attributes: Record<string, string | string[]>;
  authnStatement?: string;
  conditions?: {
    notBefore?: Date;
    notOnOrAfter?: Date;
    audience?: string;
  };
}

export interface SessionStore {
  sessionId: string;
  userId?: string;
  oauthUserId?: string;
  provider?: OAuthProvider;
  accessToken?: string;
  refreshToken?: string;
  expiresAt: Date;
  createdAt: Date;
  lastAccessedAt: Date;
  data: Record<string, unknown>;
}

export interface AuthorizationRequest {
  provider: OAuthProvider;
  redirectUri: string;
  scope: string[];
  state: string;
  nonce?: string;
  codeVerifier?: string;
  responseType?: 'code' | 'token';
  prompt?: 'none' | 'consent' | 'select_account';
}

export interface TokenRequest {
  provider: OAuthProvider;
  grantType: GrantType;
  code?: string;
  codeVerifier?: string;
  refreshToken?: string;
  redirectUri?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn: number;
  tokenType: string;
  scope: string[];
}

export interface UserInfoRequest {
  provider: OAuthProvider;
  accessToken: string;
}

export interface RefreshTokenRequest {
  provider: OAuthProvider;
  refreshToken: string;
  clientId?: string;
  clientSecret?: string;
}

export interface RevokeTokenRequest {
  provider: OAuthProvider;
  token: string;
  tokenTypeHint?: 'access_token' | 'refresh_token';
}

export interface DiscoveryDocument {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  jwksUri: string;
  scopesSupported: string[];
  responseTypesSupported: string[];
  grantTypesSupported: GrantType[];
  tokenEndpointAuthMethodsSupported: string[];
  claimsSupported: string[];
  codeChallengeMethodsSupported: string[];
}

export interface PKCEParams {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

export interface OAuthError {
  error: OAuthErrorCode;
  errorDescription?: string;
  errorUri?: string;
  state?: string;
}

export type OAuthErrorCode =
  | 'invalid_request'
  | 'unauthorized_client'
  | 'access_denied'
  | 'unsupported_response_type'
  | 'invalid_scope'
  | 'server_error'
  | 'temporarily_unavailable'
  | 'invalid_grant'
  | 'invalid_client'
  | 'unsupported_grant_type';

export interface ProviderConfig {
  provider: OAuthProvider;
  config: OAuthConfig;
  enabled: boolean;
  discoveryDocument?: DiscoveryDocument;
}

export interface OAuthSSOConfig {
  providers: ProviderConfig[];
  defaultProvider?: OAuthProvider;
  sessionDuration: number;
  refreshThreshold: number;
  pkceEnabled: boolean;
  nonceEnabled: boolean;
}

export interface OAuthClient {
  getAuthorizationUrl(provider: OAuthProvider, redirectUri: string, scope: string[], state?: string): Promise<AuthorizationUrlResult>;
  exchangeCode(provider: OAuthProvider, code: string, codeVerifier?: string): Promise<OAuthTokens>;
  refreshAccessToken(provider: OAuthProvider, refreshToken: string): Promise<OAuthTokens>;
  revokeToken(provider: OAuthProvider, token: string, tokenTypeHint?: 'access_token' | 'refresh_token'): Promise<void>;
  getUserInfo(provider: OAuthProvider, accessToken: string): Promise<OAuthUserInfo>;
  handleCallback(provider: OAuthProvider, code: string, state: string, codeVerifier?: string): Promise<CallbackResult>;
  validateIdToken(provider: OAuthProvider, idToken: string, nonce?: string): Promise<OIDCClaims>;
  discovery(provider: OAuthProvider): Promise<DiscoveryDocument>;
}

export interface AuthorizationUrlResult {
  url: string;
  state: string;
  nonce?: string;
  codeVerifier?: string;
  expiresAt: Date;
}

export interface CallbackResult {
  tokens: OAuthTokens;
  userInfo: OAuthUserInfo;
  sessionId: string;
}

export interface SAMLClient {
  initialize(settings: SAMLSettings): Promise<void>;
  getLoginUrl(relayState?: string): Promise<string>;
  handleAssertion(samlResponse: string, relayState?: string): Promise<SAMLAssertion>;
  createLogoutRequest(nameID: string, nameIDFormat?: string): Promise<LogoutRequestResult>;
  handleLogoutResponse(response: string): Promise<void>;
  signRequest(body: string, privateKey: string): Promise<string>;
}

export interface LogoutRequestResult {
  request: string;
  id?: string;
  destination?: string;
}

export interface SSOSessionManager {
  createSession(userId: string, provider: OAuthProvider, tokens: OAuthTokens, userInfo: OAuthUserInfo): Promise<SessionStore>;
  getSession(sessionId: string): Promise<SessionStore | null>;
  updateSession(sessionId: string, updates: Partial<SessionStore>): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  cleanupExpiredSessions(): Promise<number>;
  validateSession(sessionId: string): Promise<SessionStore | null>;
}

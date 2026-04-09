import { SecureAuthManager } from '../src/core/authentication/authManager';

describe('Authentication', () => {
  let authManager: SecureAuthManager;

  beforeEach(() => {
    authManager = new SecureAuthManager();
  });

  it('should register a user', async () => {
    const user = await authManager.register('test@example.com', 'password123');
    expect(user.email).toBe('test@example.com');
    expect(user.status).toBe('active');
  });

  it('should login with correct password', async () => {
    await authManager.register('test@example.com', 'password123');
    const session = await authManager.login('test@example.com', 'password123');
    expect(session.accessToken).toBeDefined();
    expect(session.refreshToken).toBeDefined();
  });

  it('should fail login with wrong password', async () => {
    await authManager.register('test@example.com', 'password123');
    await expect(authManager.login('test@example.com', 'wrongpassword')).rejects.toThrow();
  });

  it('should validate session tokens', async () => {
    const user = await authManager.register('test@example.com', 'password123');
    const session = await authManager.login('test@example.com', 'password123');
    const validatedUser = await authManager.validateToken(session.accessToken);
    expect(validatedUser.userId).toBe(user.userId);
  });

  it('should support password reset', async () => {
    await authManager.register('test@example.com', 'password123');
    const reset = await authManager.requestPasswordReset('test@example.com');
    expect(reset.token).toBeDefined();
    expect(reset.used).toBe(false);
  });

  it('should enable MFA', async () => {
    const user = await authManager.register('test@example.com', 'password123');
    const secret = await authManager.enableMFA(user.userId);
    expect(secret).toBeDefined();
  });

  it('should require MFA on login when enabled', async () => {
    const user = await authManager.register('test@example.com', 'password123');
    await authManager.enableMFA(user.userId);
    await expect(authManager.login('test@example.com', 'password123')).rejects.toThrow('MFA required');
  });
});

export {
  User,
  Session,
  PasswordReset,
  AuthManager,
} from './types';

export { SecureAuthManager } from './authManager';

import { SecureAuthManager } from './authManager';

export class AuthenticationService {
  private authManager: SecureAuthManager;

  constructor() {
    this.authManager = new SecureAuthManager();
  }

  async register(email: string, password: string) {
    return this.authManager.register(email, password);
  }

  async login(email: string, password: string, mfaCode?: string) {
    return this.authManager.login(email, password, mfaCode);
  }

  async logout(sessionId: string) {
    return this.authManager.logout(sessionId);
  }

  async validateToken(token: string) {
    return this.authManager.validateToken(token);
  }
}

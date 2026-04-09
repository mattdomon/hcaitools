/**
 * Browser Operator Tests
 * Tests for session management, workflow execution, and concurrency control
 */

import {
  BrowserOperator,
  BrowserSessionManager,
  BrowserWorkflowExecutor,
  BrowserConcurrencyControl,
  BrowserContext,
  WorkflowTask,
  WorkflowStep,
} from '../src/core/browserOperator';

describe('BrowserOperator', () => {
  let operator: BrowserOperator;

  beforeEach(() => {
    operator = new BrowserOperator(50);
  });

  describe('Session Management', () => {
    it('should create a new browser session', async () => {
      const context: BrowserContext = {
        userAgent: 'Mozilla/5.0',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        localIP: '192.168.1.100',
        networkConnection: {
          proxyEnabled: false,
          localIPAddress: '192.168.1.100',
          bypassGeoBlocking: true,
          bypassSecurityChecks: false,
        },
      };

      const session = await operator.createSession('user123', context);

      expect(session).toBeDefined();
      expect(session.userId).toBe('user123');
      expect(session.isActive).toBe(true);
      expect(session.sessionId).toMatch(/^session_/);
    });

    it('should retrieve an existing session', async () => {
      const context: BrowserContext = {
        userAgent: 'Mozilla/5.0',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        localIP: '192.168.1.100',
        networkConnection: {
          proxyEnabled: false,
          localIPAddress: '192.168.1.100',
          bypassGeoBlocking: true,
          bypassSecurityChecks: false,
        },
      };

      const createdSession = await operator.createSession('user123', context);
      const retrievedSession = await operator.getSession(createdSession.sessionId);

      expect(retrievedSession).toBeDefined();
      expect(retrievedSession?.sessionId).toBe(createdSession.sessionId);
    });

    it('should return null for non-existent session', async () => {
      const session = await operator.getSession('non-existent-id');
      expect(session).toBeNull();
    });

    it('should list active sessions for a user', async () => {
      const context: BrowserContext = {
        userAgent: 'Mozilla/5.0',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        localIP: '192.168.1.100',
        networkConnection: {
          proxyEnabled: false,
          localIPAddress: '192.168.1.100',
          bypassGeoBlocking: true,
          bypassSecurityChecks: false,
        },
      };

      await operator.createSession('user123', context);
      await operator.createSession('user123', context);

      const sessions = await operator.listActiveSessions('user123');

      expect(sessions).toHaveLength(2);
    });

    it('should terminate a session', async () => {
      const context: BrowserContext = {
        userAgent: 'Mozilla/5.0',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        localIP: '192.168.1.100',
        networkConnection: {
          proxyEnabled: false,
          localIPAddress: '192.168.1.100',
          bypassGeoBlocking: true,
          bypassSecurityChecks: false,
        },
      };

      const session = await operator.createSession('user123', context);
      await operator.terminateSession(session.sessionId);

      const retrieved = await operator.getSession(session.sessionId);
      expect(retrieved).toBeNull();
    });
  });

  describe('Workflow Execution', () => {
    it('should execute a simple navigation workflow', async () => {
      const task: WorkflowTask = {
        taskId: 'task-1',
        sessionId: 'session-1',
        steps: [
          {
            stepId: 'step-1',
            type: 'navigate',
            action: 'https://example.com',
          },
        ],
        timeout: 30000,
        retryPolicy: {
          maxAttempts: 3,
          initialDelayMs: 100,
          maxDelayMs: 1000,
          backoffMultiplier: 2,
        },
        status: 'pending',
        createdAt: new Date(),
      };

      const result = await operator.executeWorkflow(task);

      expect(result.taskId).toBe('task-1');
      expect(result.status).toBe('completed');
      expect(result.executedSteps).toBe(1);
    });

    it('should execute multi-step workflow', async () => {
      const task: WorkflowTask = {
        taskId: 'task-2',
        sessionId: 'session-1',
        steps: [
          {
            stepId: 'step-1',
            type: 'navigate',
            action: 'https://example.com',
          },
          {
            stepId: 'step-2',
            type: 'click',
            selector: '.submit-button',
          },
          {
            stepId: 'step-3',
            type: 'extract',
            selector: '.result',
          },
        ],
        timeout: 30000,
        retryPolicy: {
          maxAttempts: 3,
          initialDelayMs: 100,
          maxDelayMs: 1000,
          backoffMultiplier: 2,
        },
        status: 'pending',
        createdAt: new Date(),
      };

      const result = await operator.executeWorkflow(task);

      expect(result.status).toBe('completed');
      expect(result.executedSteps).toBe(3);
      expect(result.totalSteps).toBe(3);
    });
  });

  describe('Concurrency Control', () => {
    it('should track concurrent operations', async () => {
      const control = new BrowserConcurrencyControl(10);

      await control.addOperation();
      expect(control.currentOperations).toBe(1);

      control.removeOperation();
      expect(control.currentOperations).toBe(0);
    });

    it('should queue operations when at capacity', async () => {
      const control = new BrowserConcurrencyControl(2);

      await control.addOperation();
      await control.addOperation();
      // Third operation would queue since we're at capacity
      expect(control.currentOperations).toBe(2);
    });

    it('should report concurrency status', async () => {
      const control = new BrowserConcurrencyControl(50);

      await control.addOperation();
      await control.addOperation();

      const status = control.getStatus();

      expect(status.currentOperations).toBe(2);
      expect(status.maxConcurrent).toBe(50);
      expect(status.utilizationPercent).toBe(4);
    });
  });

  describe('Form Validation', () => {
    let executor: BrowserWorkflowExecutor;

    beforeEach(() => {
      executor = new BrowserWorkflowExecutor();
    });

    it('should validate email format', () => {
      const validation = { type: 'email' as const };

      expect(executor.validateFormInput('test@example.com', validation)).toBe(true);
      expect(executor.validateFormInput('invalid-email', validation)).toBe(false);
    });

    it('should validate phone format', () => {
      const validation = { type: 'phone' as const };

      expect(executor.validateFormInput('+1-555-0123', validation)).toBe(true);
      expect(executor.validateFormInput('123', validation)).toBe(false);
    });

    it('should validate alphanumeric format', () => {
      const validation = { type: 'alphanumeric' as const };

      expect(executor.validateFormInput('abc123', validation)).toBe(true);
      expect(executor.validateFormInput('abc-123', validation)).toBe(false);
    });

    it('should validate custom regex pattern', () => {
      const validation = { type: 'custom' as const, pattern: '^[A-Z]{3}$' };

      expect(executor.validateFormInput('ABC', validation)).toBe(true);
      expect(executor.validateFormInput('abc', validation)).toBe(false);
    });
  });

  describe('Session Security', () => {
    it('should encrypt session tokens', async () => {
      const manager = new BrowserSessionManager();
      const context: BrowserContext = {
        userAgent: 'Mozilla/5.0',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        localIP: '192.168.1.100',
        networkConnection: {
          proxyEnabled: false,
          localIPAddress: '192.168.1.100',
          bypassGeoBlocking: true,
          bypassSecurityChecks: false,
        },
      };

      const session = await manager.createSession('user123', context);

      expect(session.encryptedToken).toBeDefined();
      expect(session.encryptedToken.length).toBeGreaterThan(0);
      expect(session.encryptedToken).not.toContain('plaintext');
    });

    it('should maintain session authentication context', async () => {
      const manager = new BrowserSessionManager();
      const initialContext: BrowserContext = {
        userAgent: 'Mozilla/5.0',
        cookies: [
          {
            name: 'auth_token',
            value: 'token123',
            domain: 'example.com',
            path: '/',
            secure: true,
            httpOnly: true,
            sameSite: 'Strict',
          },
        ],
        localStorage: { userId: '123' },
        sessionStorage: {},
        localIP: '192.168.1.100',
        networkConnection: {
          proxyEnabled: false,
          localIPAddress: '192.168.1.100',
          bypassGeoBlocking: true,
          bypassSecurityChecks: false,
        },
      };

      const session = await manager.createSession('user123', initialContext);
      expect(session.browserContext.cookies).toHaveLength(1);
      expect(session.browserContext.cookies[0].value).toBe('token123');
    });
  });

  describe('Multi-step Workflow with Form Filling', () => {
    it('should handle login workflow with form validation', async () => {
      const task: WorkflowTask = {
        taskId: 'login-task',
        sessionId: 'session-1',
        steps: [
          {
            stepId: 'step-1',
            type: 'navigate',
            action: 'https://example.com/login',
          },
          {
            stepId: 'step-2',
            type: 'fillForm',
            action: JSON.stringify({
              email: 'user@example.com',
              password: 'password123',
            }),
          },
          {
            stepId: 'step-3',
            type: 'click',
            selector: '.login-button',
          },
          {
            stepId: 'step-4',
            type: 'wait',
            action: '2000',
          },
          {
            stepId: 'step-5',
            type: 'screenshot',
            action: 'post-login',
          },
        ],
        timeout: 60000,
        retryPolicy: {
          maxAttempts: 3,
          initialDelayMs: 500,
          maxDelayMs: 5000,
          backoffMultiplier: 2,
        },
        status: 'pending',
        createdAt: new Date(),
      };

      const result = await operator.executeWorkflow(task);

      expect(result.status).toBe('completed');
      expect(result.executedSteps).toBe(5);
      expect(result.screenshots).toBeDefined();
    });
  });
});

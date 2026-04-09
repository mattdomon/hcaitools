/**
 * Browser Operator
 * Main module for browser automation with local session access
 */

export {
  BrowserSession,
  BrowserContext,
  BrowserCookie,
  NetworkConfig,
  WorkflowTask,
  WorkflowStep,
  WorkflowResult,
  SessionManager,
  WorkflowExecutor,
  ConcurrencyControl,
  StepType,
  TaskStatus,
  MessageType,
  EncryptionConfig,
} from './types';

export { BrowserSessionManager } from './sessionManager';
export { BrowserWorkflowExecutor } from './workflowExecutor';
export { BrowserConcurrencyControl } from './concurrencyControl';

import { BrowserSessionManager } from './sessionManager';
import { BrowserWorkflowExecutor } from './workflowExecutor';
import { BrowserConcurrencyControl } from './concurrencyControl';
import { BrowserContext, WorkflowTask, WorkflowResult } from './types';

/**
 * BrowserOperator
 * Orchestrates browser automation, session management, and concurrency control
 */
export class BrowserOperator {
  private sessionManager: BrowserSessionManager;
  private workflowExecutor: BrowserWorkflowExecutor;
  private concurrencyControl: BrowserConcurrencyControl;

  constructor(maxConcurrentOperations: number = 50) {
    this.sessionManager = new BrowserSessionManager();
    this.workflowExecutor = new BrowserWorkflowExecutor();
    this.concurrencyControl = new BrowserConcurrencyControl(maxConcurrentOperations);
  }

  /**
   * Create a new browser session with local context
   */
  async createSession(userId: string, browserContext: BrowserContext) {
    return this.sessionManager.createSession(userId, browserContext);
  }

  /**
   * Get an existing session
   */
  async getSession(sessionId: string) {
    return this.sessionManager.getSession(sessionId);
  }

  /**
   * Execute a workflow task
   */
  async executeWorkflow(task: WorkflowTask): Promise<WorkflowResult> {
    await this.concurrencyControl.addOperation();

    try {
      return await this.workflowExecutor.executeTask(task);
    } finally {
      this.concurrencyControl.removeOperation();
    }
  }

  /**
   * Terminate a session
   */
  async terminateSession(sessionId: string) {
    return this.sessionManager.terminateSession(sessionId);
  }

  /**
   * Get active sessions for a user
   */
  async listActiveSessions(userId: string) {
    return this.sessionManager.listActiveSessions(userId);
  }

  /**
   * Get current concurrency status
   */
  getConcurrencyStatus() {
    return this.concurrencyControl.getStatus();
  }

  /**
   * Get total active sessions
   */
  async getSessionCount(): Promise<number> {
    return this.sessionManager.getSessionCount();
  }
}

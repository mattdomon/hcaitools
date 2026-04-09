/**
 * Browser Operator Types
 * Defines interfaces for browser automation, session management, and WebSocket communication
 */

export interface BrowserSession {
  sessionId: string;
  userId: string;
  browserContext: BrowserContext;
  encryptedToken: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

export interface BrowserContext {
  userAgent: string;
  cookies: BrowserCookie[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  localIP: string;
  networkConnection: NetworkConfig;
}

export interface BrowserCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
  expirationDate?: number;
}

export interface NetworkConfig {
  proxyEnabled: boolean;
  proxyUrl?: string;
  localIPAddress: string;
  bypassGeoBlocking: boolean;
  bypassSecurityChecks: boolean;
}

export interface WorkflowTask {
  taskId: string;
  sessionId: string;
  steps: WorkflowStep[];
  timeout: number;
  retryPolicy: RetryPolicy;
  status: TaskStatus;
  createdAt: Date;
  completedAt?: Date;
}

export interface WorkflowStep {
  stepId: string;
  type: StepType;
  action: string;
  selector?: string;
  value?: string;
  expectedResult?: string;
  timeout?: number;
  retryAttempts?: number;
}

export type StepType = 
  | 'navigate'
  | 'click'
  | 'fillForm'
  | 'extract'
  | 'wait'
  | 'screenshot'
  | 'execute';

export interface FormFillAction {
  selector: string;
  value: string;
  validation?: FormValidation;
  clearBeforeFill?: boolean;
}

export interface FormValidation {
  type: 'email' | 'phone' | 'alphanumeric' | 'custom';
  pattern?: string;
  required?: boolean;
}

export type TaskStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timedOut';

export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface WorkflowResult {
  taskId: string;
  status: TaskStatus;
  executedSteps: number;
  totalSteps: number;
  extractedData?: Record<string, unknown>;
  screenshots?: string[];
  error?: string;
  executionTimeMs: number;
}

export interface WebSocketMessage {
  type: MessageType;
  sessionId: string;
  payload: Record<string, unknown>;
  timestamp: number;
  encrypted: boolean;
  signature?: string;
}

export type MessageType =
  | 'createSession'
  | 'executeTask'
  | 'getStatus'
  | 'terminateSession'
  | 'response'
  | 'error';

export interface EncryptionConfig {
  algorithm: 'AES-256-GCM';
  keyLength: 32;
  ivLength: 16;
  authTagLength: 16;
}

export interface SessionManager {
  createSession(userId: string, browserContext: BrowserContext): Promise<BrowserSession>;
  getSession(sessionId: string): Promise<BrowserSession | null>;
  updateSession(sessionId: string, context: Partial<BrowserContext>): Promise<void>;
  terminateSession(sessionId: string): Promise<void>;
  listActiveSessions(userId: string): Promise<BrowserSession[]>;
  getSessionCount(): Promise<number>;
}

export interface WorkflowExecutor {
  executeTask(task: WorkflowTask): Promise<WorkflowResult>;
  executeStep(step: WorkflowStep, session: BrowserSession): Promise<StepResult>;
  validateFormInput(input: string, validation: FormValidation): boolean;
  extractDataFromPage(selector: string, session: BrowserSession): Promise<unknown>;
}

export interface StepResult {
  stepId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  executionTimeMs: number;
  retryAttempt?: number;
}

export interface ConcurrencyControl {
  maxConcurrentOperations: number;
  currentOperations: number;
  queuedOperations: number;
  addOperation(): Promise<void>;
  removeOperation(): void;
  waitForSlot(): Promise<void>;
}

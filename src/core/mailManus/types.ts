/**
 * Mail Manus
 * Email-to-task automation for workflow management
 */

export interface EmailMessage {
  messageId: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  attachments: EmailAttachment[];
  receivedAt: Date;
  rawEmail: string;
}

export interface EmailAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  data: Buffer;
}

export interface AutomatedTask {
  taskId: string;
  messageId: string;
  title: string;
  description: string;
  type: TaskType;
  priority: Priority;
  status: TaskStatus;
  assignees: string[];
  dueDate?: Date;
  createdAt: Date;
}

export type TaskType = 'rfp' | 'approval' | 'followup' | 'action_item' | 'project_plan';
export type Priority = 'high' | 'medium' | 'low';
export type TaskStatus = 'created' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';

export interface EmailAutomationRule {
  ruleId: string;
  name: string;
  condition: RuleCondition;
  action: RuleAction;
  enabled: boolean;
}

export interface RuleCondition {
  fromPattern?: string;
  subjectPattern?: string;
  bodyPattern?: string;
  hasAttachments?: boolean;
  priority?: Priority;
}

export interface RuleAction {
  createTask: boolean;
  taskType?: TaskType;
  autoReply?: string;
  assignTo?: string[];
  addLabel?: string;
}

export interface EmailParser {
  parseEmail(rawEmail: string): Promise<EmailMessage>;
  extractTaskDetails(email: EmailMessage): Promise<Partial<AutomatedTask>>;
  detectEmailType(email: EmailMessage): Promise<TaskType>;
}

export interface TaskCreator {
  createTaskFromEmail(email: EmailMessage): Promise<AutomatedTask>;
  createBulkTasksFromEmails(emails: EmailMessage[]): Promise<AutomatedTask[]>;
  updateTaskStatus(taskId: string, status: TaskStatus): Promise<void>;
}

export interface WorkflowAutomation {
  registerRule(rule: EmailAutomationRule): Promise<void>;
  processEmail(email: EmailMessage): Promise<AutomatedTask[]>;
  getActiveRules(): Promise<EmailAutomationRule[]>;
  disableRule(ruleId: string): Promise<void>;
}

export interface EmailReplyGenerator {
  generateReply(task: AutomatedTask, tone: string): Promise<string>;
  sendReply(messageId: string, reply: string): Promise<void>;
}

export interface CollaborationWorkflow {
  inviteTeamMember(taskId: string, email: string): Promise<void>;
  cycleTask(taskId: string, nextPerson: string): Promise<void>;
  getTaskThread(taskId: string): Promise<EmailMessage[]>;
}

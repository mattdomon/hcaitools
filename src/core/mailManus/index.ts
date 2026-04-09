/**
 * Mail Manus
 * Email-to-task automation system
 */

export {
  EmailMessage,
  EmailAttachment,
  AutomatedTask,
  TaskType,
  Priority,
  TaskStatus,
  EmailAutomationRule,
  RuleCondition,
  RuleAction,
  EmailParser,
  TaskCreator,
  WorkflowAutomation,
  EmailReplyGenerator,
  CollaborationWorkflow,
} from './types';

export { MailManusEmailParser } from './emailParser';
export { MailManusTaskCreator } from './taskCreator';

import { MailManusEmailParser } from './emailParser';
import { MailManusTaskCreator } from './taskCreator';
import { AutomatedTask, TaskStatus } from './types';

/**
 * MailManus
 * Main class for email-to-task automation
 */
export class MailManus {
  private parser: MailManusEmailParser;
  private taskCreator: MailManusTaskCreator;

  constructor() {
    this.parser = new MailManusEmailParser();
    this.taskCreator = new MailManusTaskCreator();
  }

  /**
   * Process an email and create tasks
   */
  async processEmail(rawEmail: string): Promise<AutomatedTask> {
    const email = await this.parser.parseEmail(rawEmail);
    return this.taskCreator.createTaskFromEmail(email);
  }

  /**
   * Process multiple emails in bulk
   */
  async processBulkEmails(rawEmails: string[]): Promise<AutomatedTask[]> {
    const emails = await Promise.all(
      rawEmails.map((raw) => this.parser.parseEmail(raw))
    );

    return this.taskCreator.createBulkTasksFromEmails(emails);
  }

  /**
   * List all tasks
   */
  listTasks(status?: string) {
    return this.taskCreator.listTasks(status as TaskStatus | undefined);
  }

  /**
   * Update task status
   */
  async updateTask(taskId: string, status: string) {
    return this.taskCreator.updateTaskStatus(taskId, status as TaskStatus);
  }

  /**
   * Example: Process RFP email
   */
  async processRFP(rfpEmail: string): Promise<AutomatedTask> {
    return this.processEmail(rfpEmail);
  }

  /**
   * Example: Process approval request
   */
  async processApprovalRequest(approvalEmail: string): Promise<AutomatedTask> {
    return this.processEmail(approvalEmail);
  }

  /**
   * Example: Create workflow from email thread
   */
  async createWorkflowFromThread(emails: string[]): Promise<AutomatedTask[]> {
    return this.processBulkEmails(emails);
  }
}

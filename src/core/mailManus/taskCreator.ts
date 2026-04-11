/**
 * Task Creator
 * Creates tasks from emails
 */

import { AutomatedTask, EmailMessage, TaskCreator, TaskStatus } from './types';
import { MailManusEmailParser } from './emailParser';

export class MailManusTaskCreator implements TaskCreator {
  private parser: MailManusEmailParser;
  private tasks: Map<string, AutomatedTask> = new Map();

  constructor() {
    this.parser = new MailManusEmailParser();
  }

  async createTaskFromEmail(email: EmailMessage): Promise<AutomatedTask> {
    const taskDetails = await this.parser.extractTaskDetails(email);

    const task: AutomatedTask = {
      taskId: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      messageId: email.messageId,
      title: taskDetails.title || email.subject,
      description: taskDetails.description || email.body,
      type: taskDetails.type || 'action_item',
      priority: taskDetails.priority || 'medium',
      status: 'created',
      assignees: taskDetails.assignees || [email.from],
      createdAt: new Date(),
    };

    this.tasks.set(task.taskId, task);

    return task;
  }

  async createBulkTasksFromEmails(emails: EmailMessage[]): Promise<AutomatedTask[]> {
    const tasks: AutomatedTask[] = [];

    for (const email of emails) {
      const task = await this.createTaskFromEmail(email);
      tasks.push(task);
    }

    return tasks;
  }

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
    const task = this.tasks.get(taskId);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = status;
  }

  getTask(taskId: string): AutomatedTask | undefined {
    return this.tasks.get(taskId);
  }

  listTasks(status?: TaskStatus): AutomatedTask[] {
    const tasks: AutomatedTask[] = [];

    for (const [, task] of this.tasks) {
      if (!status || task.status === status) {
        tasks.push(task);
      }
    }

    return tasks;
  }
}

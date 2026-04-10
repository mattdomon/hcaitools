/**
 * Slack Integration
 * Team collaboration, notifications, and bot interactions
 */

export {
  SlackChannelType,
  SlackNotificationType,
  SlackCommandType,
  SlackReactionType,
  SlackChannel,
  SlackUser,
  SlackMessage,
  SlackReaction,
  SlackAttachment,
  SlackAction,
  SlackSlashCommand,
  SlackNotification,
  SlackThread,
  SlackMessageSummary,
  SlackReport,
  SlackWorkflowTrigger,
  SlackWorkflowAction,
  SlackBotConfig,
  SlackClient,
  SendMessageOptions,
  SlackEvent,
} from './types';

export { SlackClientImpl } from './slackClient';

import { SlackClientImpl } from './slackClient';
import { SlackMessageSummary } from './types';

/**
 * SlackManus
 * Main class for Slack integration
 */
export class SlackManus {
  private client: SlackClientImpl;

  constructor() {
    this.client = new SlackClientImpl();
  }

  /**
   * Create a new channel
   */
  async createChannel(name: string, type: 'public' | 'private' | 'direct' | 'mpim') {
    return this.client.createChannel(name, type);
  }

  /**
   * Send a message to channel
   */
  async sendMessage(channelId: string, text: string, options?: any) {
    return this.client.sendMessage(channelId, text, options);
  }

  /**
   * Send notification to channel
   */
  async notify(channelId: string, type: 'info' | 'success' | 'warning' | 'error' | 'reminder', title: string, message: string) {
    return this.client.sendNotification({
      channelId,
      type,
      title,
      message,
      sentBy: 'slack-manus',
    });
  }

  /**
   * Register a slash command
   */
  registerCommand(command: string, handler: (text: string, userId: string) => Promise<string>) {
    this.client.registerSlashCommand(command, async (cmd) => {
      return handler(cmd.text, cmd.userId);
    });
  }

  /**
   * Generate message summary
   */
  async summarize(channelId: string, threadId?: string): Promise<SlackMessageSummary> {
    return this.client.generateMessageSummary(channelId, threadId);
  }

  /**
   * Create workflow automation
   */
  async createWorkflow(name: string, channelId: string, events: string[], actions: any[]) {
    return this.client.createWorkflow({
      name,
      channelId,
      events,
      actions,
      isActive: true,
    });
  }

  /**
   * Get channel statistics
   */
  async getChannelStats(channelId: string) {
    return this.client.getChannelStats(channelId);
  }

  /**
   * Generate activity report
   */
  async generateReport(startDate: Date, endDate: Date) {
    return this.client.generateReport(startDate, endDate);
  }

  /**
   * Example: Project update notification
   */
  async notifyProjectUpdate(channelId: string, projectName: string, status: string, updates: string[]) {
    const fields = updates.map((u) => ({
      title: projectName,
      value: u,
      short: false,
    }));

    return this.client.sendNotification({
      channelId,
      type: 'info',
      title: `📋 Project Update: ${projectName}`,
      message: status,
      fields,
      sentBy: 'project-manager',
    } as any);
  }

  /**
   * Example: Deployment notification
   */
  async notifyDeployment(channelId: string, environment: string, version: string, status: 'success' | 'failed') {
    const type = status === 'success' ? 'success' : 'error';
    const emoji = status === 'success' ? '🚀' : '❌';

    return this.client.sendNotification({
      channelId,
      type,
      title: `${emoji} Deployment ${status === 'success' ? 'Successful' : 'Failed'}`,
      message: `Environment: ${environment}\nVersion: ${version}`,
      sentBy: 'ci-cd-bot',
    } as any);
  }

  /**
   * Example: Daily standup reminder
   */
  async sendDailyStandupReminder(channelId: string) {
    return this.client.sendNotification({
      channelId,
      type: 'reminder',
      title: '⏰ Daily Standup Reminder',
      message: "It's time for daily standup! Please share your updates:\n• What did you do yesterday?\n• What will you do today?\n• Any blockers?",
      sentBy: 'standup-bot',
    } as any);
  }

  /**
   * Example: Error alert
   */
  async sendErrorAlert(channelId: string, error: string, service: string, severity: 'high' | 'medium' | 'low') {
    const type = severity === 'high' ? 'error' : severity === 'medium' ? 'warning' : 'info';
    const emoji = severity === 'high' ? '🚨' : severity === 'medium' ? '⚠️' : '🔔';

    return this.client.sendNotification({
      channelId,
      type,
      title: `${emoji} Error Alert: ${service}`,
      message: error,
      sentBy: 'alerting-system',
    } as any);
  }

  /**
   * Example: Task assignment notification
   */
  async assignTask(channelId: string, task: string, assignee: string, dueDate?: string) {
    let message = `New task assigned to @${assignee}:\n*${task}*`;
    if (dueDate) {
      message += `\nDue date: ${dueDate}`;
    }

    return this.client.sendMessage(channelId, message);
  }

  /**
   * Example: Weekly summary
   */
  async sendWeeklySummary(channelId: string, stats: {
    tasksCompleted: number;
    messagesSent: number;
    activeMembers: number;
    topContributor: string;
  }) {
    const message = `📊 *Weekly Summary*\n\n✅ Tasks Completed: ${stats.tasksCompleted}\n💬 Messages Sent: ${stats.messagesSent}\n👥 Active Members: ${stats.activeMembers}\n🏆 Top Contributor: @${stats.topContributor}`;

    return this.client.sendMessage(channelId, message);
  }
}

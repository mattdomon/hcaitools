/**
 * Email Parser
 * Parses emails and extracts task information
 */

import {
  EmailMessage,
  AutomatedTask,
  TaskType,
  Priority,
  EmailParser,
} from './types';

export class MailManusEmailParser implements EmailParser {
  async parseEmail(rawEmail: string): Promise<EmailMessage> {
    // Parse raw email format
    const lines = rawEmail.split('\n');

    let from = '';
    let to: string[] = [];
    let cc: string[] = [];
    let subject = '';
    let body = '';
    let inBody = false;

    for (const line of lines) {
      if (!inBody) {
        if (line.startsWith('From: ')) {
          from = line.substring(6).trim();
        } else if (line.startsWith('To: ')) {
          to = line.substring(4).trim().split(',').map((e) => e.trim());
        } else if (line.startsWith('Cc: ')) {
          cc = line.substring(4).trim().split(',').map((e) => e.trim());
        } else if (line.startsWith('Subject: ')) {
          subject = line.substring(9).trim();
        } else if (line.trim() === '') {
          inBody = true;
        }
      } else {
        body += line + '\n';
      }
    }

    return {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from,
      to,
      cc,
      subject,
      body: body.trim(),
      attachments: [],
      receivedAt: new Date(),
      rawEmail,
    };
  }

  async extractTaskDetails(email: EmailMessage): Promise<Partial<AutomatedTask>> {
    const type = await this.detectEmailType(email);
    const priority = this.detectPriority(email);

    let title = email.subject;
    let description = email.body.substring(0, 500); // First 500 chars

    if (type === 'rfp') {
      title = `RFP: ${email.subject}`;
      description = `Received RFP from ${email.from}\n\n${email.body}`;
    } else if (type === 'approval') {
      title = `Approval Required: ${email.subject}`;
      description = `Approval request from ${email.from}\n\n${email.body}`;
    }

    return {
      title,
      description,
      type,
      priority,
      assignees: email.cc.length > 0 ? email.cc : [email.from],
    };
  }

  async detectEmailType(email: EmailMessage): Promise<TaskType> {
    const subject = email.subject.toLowerCase();
    const body = email.body.toLowerCase();

    if (subject.includes('rfp') || body.includes('request for proposal')) {
      return 'rfp';
    } else if (subject.includes('approval') || subject.includes('approve')) {
      return 'approval';
    } else if (subject.includes('follow') || subject.includes('follow up')) {
      return 'followup';
    } else if (subject.includes('action') || body.includes('please do')) {
      return 'action_item';
    } else if (subject.includes('project') || subject.includes('plan')) {
      return 'project_plan';
    }

    return 'action_item'; // Default
  }

  private detectPriority(email: EmailMessage): Priority {
    const subject = email.subject.toLowerCase();
    const body = email.body.toLowerCase();

    if (
      subject.includes('urgent') ||
      subject.includes('asap') ||
      subject.includes('critical') ||
      body.includes('urgent')
    ) {
      return 'high';
    } else if (subject.includes('low') || subject.includes('whenever')) {
      return 'low';
    }

    return 'medium'; // Default
  }
}

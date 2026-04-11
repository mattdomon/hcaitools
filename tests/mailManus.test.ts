/**
 * Mail Manus Tests
 */

import {
  MailManus,
  MailManusEmailParser,
  MailManusTaskCreator,
  TaskType,
} from '../src/core/mailManus';

describe('MailManus', () => {
  let mailManus: MailManus;

  beforeEach(() => {
    mailManus = new MailManus();
  });

  describe('Email Parsing', () => {
    it('should parse a basic email', async () => {
      const parser = new MailManusEmailParser();
      const rawEmail = `From: sender@example.com
To: recipient@example.com
Cc: cc@example.com
Subject: Test Email

This is the email body with important content.`;

      const email = await parser.parseEmail(rawEmail);

      expect(email.from).toBe('sender@example.com');
      expect(email.to).toContain('recipient@example.com');
      expect(email.cc).toContain('cc@example.com');
      expect(email.subject).toBe('Test Email');
      expect(email.body).toContain('important content');
    });

    it('should detect RFP email type', async () => {
      const parser = new MailManusEmailParser();
      const rfpEmail = `From: client@example.com
To: sales@company.com
Subject: RFP - Software Development Services

We are requesting a proposal for custom software development.`;

      const email = await parser.parseEmail(rfpEmail);
      const type = await parser.detectEmailType(email);

      expect(type).toBe('rfp');
    });

    it('should detect approval email type', async () => {
      const parser = new MailManusEmailParser();
      const approvalEmail = `From: manager@example.com
To: team@company.com
Subject: Please approve this proposal

We need your approval on the budget proposal.`;

      const email = await parser.parseEmail(approvalEmail);
      const type = await parser.detectEmailType(email);

      expect(type).toBe('approval');
    });

    it('should detect action item email type', async () => {
      const parser = new MailManusEmailParser();
      const actionEmail = `From: boss@example.com
To: employee@company.com
Subject: Action items from meeting

Please complete the following action items.`;

      const email = await parser.parseEmail(actionEmail);
      const type = await parser.detectEmailType(email);

      expect(type).toBe('action_item');
    });

    it('should extract task details from email', async () => {
      const parser = new MailManusEmailParser();
      const email = `From: sender@example.com
To: recipient@example.com
Subject: Urgent: Complete Project Report

The project report needs to be completed ASAP.`;

      const parsed = await parser.parseEmail(email);
      const details = await parser.extractTaskDetails(parsed);

      expect(details.title).toBeDefined();
      expect(details.description).toBeDefined();
      expect(details.priority).toBe('high');
    });
  });

  describe('Task Creation', () => {
    it('should create a task from email', async () => {
      const creator = new MailManusTaskCreator();
      const email = `From: client@example.com
To: team@company.com
Subject: New project request

We need a new website built.`;

      const parser = new MailManusEmailParser();
      const parsedEmail = await parser.parseEmail(email);
      const task = await creator.createTaskFromEmail(parsedEmail);

      expect(task).toBeDefined();
      expect(task.taskId).toMatch(/^task_/);
      expect(task.title).toContain('New project request');
      expect(task.status).toBe('created');
    });

    it('should create bulk tasks from multiple emails', async () => {
      const creator = new MailManusTaskCreator();
      const parser = new MailManusEmailParser();

      const emails = [
        `From: user1@example.com
To: team@company.com
Subject: Task 1

Description 1`,
        `From: user2@example.com
To: team@company.com
Subject: Task 2

Description 2`,
      ];

      const parsedEmails = await Promise.all(
        emails.map((e) => parser.parseEmail(e))
      );

      const tasks = await creator.createBulkTasksFromEmails(parsedEmails);

      expect(tasks).toHaveLength(2);
      expect(tasks[0].title).toContain('Task 1');
      expect(tasks[1].title).toContain('Task 2');
    });

    it('should update task status', async () => {
      const creator = new MailManusTaskCreator();
      const parser = new MailManusEmailParser();

      const email = await parser.parseEmail(`From: test@example.com
To: team@company.com
Subject: Test task

This is a test.`);

      const task = await creator.createTaskFromEmail(email);
      await creator.updateTaskStatus(task.taskId, 'in_progress');

      const updated = creator.getTask(task.taskId);
      expect(updated?.status).toBe('in_progress');
    });
  });

  describe('Mail Manus Main', () => {
    it('should process an email and create a task', async () => {
      const email = `From: user@example.com
To: team@company.com
Subject: Customer Support: Website Issues

Customer reports the website is down.`;

      const task = await mailManus.processEmail(email);

      expect(task).toBeDefined();
      expect(task.taskId).toBeDefined();
      expect(task.type).toBe('action_item');
    });

    it('should process bulk emails', async () => {
      const emails = [
        `From: user1@example.com
To: team@company.com
Subject: Email 1

Content 1`,
        `From: user2@example.com
To: team@company.com
Subject: Email 2

Content 2`,
      ];

      const tasks = await mailManus.processBulkEmails(emails);

      expect(tasks).toHaveLength(2);
    });

    it('should list tasks', async () => {
      const email1 = `From: user1@example.com
To: team@company.com
Subject: Task 1

Content`;

      const email2 = `From: user2@example.com
To: team@company.com
Subject: Task 2

Content`;

      await mailManus.processEmail(email1);
      await mailManus.processEmail(email2);

      const tasks = mailManus.listTasks();

      expect(tasks.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle RFP workflow', async () => {
      const rfpEmail = `From: client@example.com
To: sales@company.com
Cc: manager@company.com
Subject: RFP - Enterprise Software Solution

We are requesting a proposal for an enterprise software solution.
Timeline: 30 days
Budget: $100,000`;

      const task = await mailManus.processRFP(rfpEmail);

      expect(task.type).toBe('rfp');
      expect(task.priority).toBe('medium');
      expect(task.title).toContain('RFP');
    });

    it('should handle approval workflow', async () => {
      const approvalEmail = `From: director@example.com
To: team@company.com
Subject: Urgent: Budget Approval Required

Please approve the attached Q4 budget proposal ASAP.`;

      const task = await mailManus.processApprovalRequest(approvalEmail);

      expect(task.type).toBe('approval');
      expect(task.priority).toBe('high');
    });

    it('should create workflow from email thread', async () => {
      const thread = [
        `From: user1@example.com
To: team@company.com
Subject: Project discussion

Let's discuss the new project.`,
        `From: user2@example.com
To: team@company.com
Subject: Re: Project discussion

Great idea. Let's move forward.`,
      ];

      const tasks = await mailManus.createWorkflowFromThread(thread);

      expect(tasks).toHaveLength(2);
    });
  });

  describe('Email Type Detection', () => {
    it('should detect follow-up emails', async () => {
      const parser = new MailManusEmailParser();
      const email = await parser.parseEmail(`From: user@example.com
To: team@company.com
Subject: Follow up on the proposal

Just following up on the proposal we discussed.`);

      const type = await parser.detectEmailType(email);
      expect(type).toBe('followup');
    });

    it('should detect project planning emails', async () => {
      const parser = new MailManusEmailParser();
      const email = await parser.parseEmail(`From: pm@example.com
To: team@company.com
Subject: Project Plan for Q4

Here is the project plan for Q4.`);

      const type = await parser.detectEmailType(email);
      expect(type).toBe('project_plan');
    });
  });

  describe('Priority Detection', () => {
    it('should detect high priority emails', async () => {
      const parser = new MailManusEmailParser();
      const email = await parser.parseEmail(`From: boss@example.com
To: team@company.com
Subject: URGENT: Fix production issue

The system is down. Fix it ASAP!`);

      const details = await parser.extractTaskDetails(email);
      expect(details.priority).toBe('high');
    });

    it('should detect low priority emails', async () => {
      const parser = new MailManusEmailParser();
      const email = await parser.parseEmail(`From: coworker@example.com
To: team@company.com
Subject: Low priority: Nice to have improvement

This is a low priority item whenever you have time.`);

      const details = await parser.extractTaskDetails(email);
      expect(details.priority).toBe('low');
    });
  });
});

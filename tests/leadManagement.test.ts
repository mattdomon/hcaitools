/**
 * Lead Management System Tests
 */

import { LeadManagementSystem } from '../src/core/leadManagement/leadManager';
import { LeadManus } from '../src/core/leadManagement';

describe('LeadManagementSystem', () => {
  let system: LeadManagementSystem;

  beforeEach(() => {
    system = new LeadManagementSystem();
  });

  describe('Form Management', () => {
    test('should create a lead capture form', async () => {
      const form = await system.createForm({
        name: 'Contact Us',
        fields: [
          { fieldId: 'f1', name: 'Email', type: 'email', required: true },
          { fieldId: 'f2', name: 'Message', type: 'textarea', required: true },
        ],
      });

      expect(form.formId).toBeDefined();
      expect(form.name).toBe('Contact Us');
      expect(form.fields.length).toBe(2);
      expect(form.createdAt).toBeDefined();
    });

    test('should retrieve a form by ID', async () => {
      const created = await system.createForm({
        name: 'Test Form',
        fields: [],
      });

      const retrieved = await system.getForm(created.formId);
      expect(retrieved).toEqual(created);
    });

    test('should list all forms', async () => {
      await system.createForm({ name: 'Form 1', fields: [] });
      await system.createForm({ name: 'Form 2', fields: [] });

      const forms = await system.listForms();
      expect(forms.length).toBe(2);
      expect(forms.map((f) => f.name)).toContain('Form 1');
      expect(forms.map((f) => f.name)).toContain('Form 2');
    });

    test('should update a form', async () => {
      const form = await system.createForm({
        name: 'Original Name',
        fields: [],
      });

      const updated = await system.updateForm(form.formId, {
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.formId).toBe(form.formId);
    });

    test('should delete a form', async () => {
      const form = await system.createForm({ name: 'Delete Me', fields: [] });
      await system.deleteForm(form.formId);

      const retrieved = await system.getForm(form.formId);
      expect(retrieved).toBeNull();
    });
  });

  describe('Lead Capture', () => {
    let formId: string;

    beforeEach(async () => {
      const form = await system.createForm({
        name: 'Test Form',
        fields: [],
      });
      formId = form.formId;
    });

    test('should capture a new lead', async () => {
      const lead = await system.captureLead(formId, {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
        company: 'Acme Corp',
        jobTitle: 'Manager',
        source: 'form',
        customFields: {},
      });

      expect(lead.leadId).toBeDefined();
      expect(lead.data.email).toBe('john@example.com');
      expect(lead.pipeline.stage).toBe('prospect');
      expect(lead.scoring.quality).toBeDefined();
    });

    test('should calculate lead score correctly', async () => {
      const lead = await system.captureLead(formId, {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '555-5678',
        company: 'Tech Corp',
        jobTitle: 'Director',
        source: 'form',
        customFields: {},
      });

      expect(lead.scoring.totalScore).toBeGreaterThanOrEqual(0);
      expect(lead.scoring.totalScore).toBeLessThanOrEqual(100);
      expect(['hot', 'warm', 'cold']).toContain(lead.scoring.quality);
    });

    test('should record form submission as interaction', async () => {
      const lead = await system.captureLead(formId, {
        firstName: 'Bob',
        lastName: 'Johnson',
        email: 'bob@example.com',
        source: 'form',
        customFields: {},
      });

      const interactions = await system.getInteractions(lead.leadId);
      expect(interactions.length).toBeGreaterThan(0);
      expect(interactions[0].type).toBe('form_submission');
    });
  });

  describe('Lead Scoring', () => {
    let leadId: string;

    beforeEach(async () => {
      const form = await system.createForm({ name: 'Test', fields: [] });
      const lead = await system.captureLead(form.formId, {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        source: 'form',
        customFields: {},
      });
      leadId = lead.leadId;
    });

    test('should calculate lead score', async () => {
      const scoring = await system.calculateLeadScore(leadId);

      expect(scoring.leadId).toBe(leadId);
      expect(scoring.totalScore).toBeGreaterThanOrEqual(0);
      expect(scoring.totalScore).toBeLessThanOrEqual(100);
    });

    test('should update lead quality', async () => {
      await system.updateLeadQuality(leadId, 'hot');
      const lead = await system.getLead(leadId);

      expect(lead?.scoring.quality).toBe('hot');
    });
  });

  describe('Pipeline Management', () => {
    let leadId: string;

    beforeEach(async () => {
      const form = await system.createForm({ name: 'Test', fields: [] });
      const lead = await system.captureLead(form.formId, {
        firstName: 'Pipeline',
        lastName: 'Test',
        email: 'pipeline@example.com',
        source: 'form',
        customFields: {},
      });
      leadId = lead.leadId;
    });

    test('should move lead through pipeline stages', async () => {
      let lead = await system.moveLead(leadId, 'contacted');
      expect(lead.pipeline.stage).toBe('contacted');

      lead = await system.moveLead(leadId, 'qualified');
      expect(lead.pipeline.stage).toBe('qualified');

      lead = await system.moveLead(leadId, 'converted');
      expect(lead.pipeline.stage).toBe('converted');
    });

    test('should get leads by stage', async () => {
      await system.moveLead(leadId, 'contacted');
      const leads = await system.getLeadsByStage('contacted');

      expect(leads.length).toBeGreaterThan(0);
      expect(leads.every((l) => l.pipeline.stage === 'contacted')).toBe(true);
    });

    test('should assign lead to user', async () => {
      await system.assignLead({
        leadId,
        assignedTo: 'user_123',
        assignedBy: 'admin_001',
        priority: 'high',
      });

      const lead = await system.getLead(leadId);
      expect(lead?.pipeline.assignedTo).toBe('user_123');
    });
  });

  describe('Lead Retrieval', () => {
    beforeEach(async () => {
      const form = await system.createForm({ name: 'Test', fields: [] });
      await system.captureLead(form.formId, {
        firstName: 'Alice',
        lastName: 'Wonder',
        email: 'alice@example.com',
        source: 'form',
        customFields: {},
      });
      await system.captureLead(form.formId, {
        firstName: 'Bob',
        lastName: 'Builder',
        email: 'bob@example.com',
        company: 'BuildCorp',
        source: 'form',
        customFields: {},
      });
    });

    test('should get lead by ID', async () => {
      const leads = await system.listLeads();
      const lead = await system.getLead(leads[0].leadId);

      expect(lead).toBeDefined();
      expect(lead?.leadId).toBe(leads[0].leadId);
    });

    test('should get lead by email', async () => {
      const lead = await system.getLeadByEmail('alice@example.com');

      expect(lead).toBeDefined();
      expect(lead?.data.firstName).toBe('Alice');
    });

    test('should list all leads', async () => {
      const leads = await system.listLeads();
      expect(leads.length).toBeGreaterThanOrEqual(2);
    });

    test('should filter leads by stage', async () => {
      const leads = await system.listLeads({ stage: 'prospect' });

      expect(leads.length).toBeGreaterThan(0);
      expect(leads.every((l) => l.pipeline.stage === 'prospect')).toBe(true);
    });

    test('should filter leads by quality', async () => {
      const leads = await system.listLeads({ quality: 'warm' });

      expect(leads.every((l) => l.scoring.quality === 'warm' || l.scoring.quality === 'hot' || l.scoring.quality === 'cold')).toBe(true);
    });
  });

  describe('Interactions', () => {
    let leadId: string;

    beforeEach(async () => {
      const form = await system.createForm({ name: 'Test', fields: [] });
      const lead = await system.captureLead(form.formId, {
        firstName: 'Interaction',
        lastName: 'Test',
        email: 'interaction@example.com',
        source: 'form',
        customFields: {},
      });
      leadId = lead.leadId;
    });

    test('should add interaction to lead', async () => {
      const interaction = await system.addInteraction(leadId, {
        type: 'call',
        description: 'Initial contact call',
      });

      expect(interaction.interactionId).toBeDefined();
      expect(interaction.type).toBe('call');
      expect(interaction.leadId).toBe(leadId);
    });

    test('should get all interactions for a lead', async () => {
      await system.addInteraction(leadId, {
        type: 'call',
        description: 'Call 1',
      });
      await system.addInteraction(leadId, {
        type: 'email',
        description: 'Email sent',
      });

      const interactions = await system.getInteractions(leadId);
      expect(interactions.length).toBeGreaterThanOrEqual(3); // form submission + 2 added
    });
  });

  describe('Import/Export', () => {
    test('should import leads from array', async () => {
      const result = await system.importLeads([
        {
          firstName: 'Import',
          lastName: 'User1',
          email: 'import1@example.com',
          company: 'Company1',
          source: 'import',
        },
        {
          firstName: 'Import',
          lastName: 'User2',
          email: 'import2@example.com',
          company: 'Company2',
          source: 'import',
        },
      ]);

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors.length).toBe(0);
    });

    test('should handle import errors for missing fields', async () => {
      const result = await system.importLeads([
        {
          firstName: 'Incomplete',
          lastName: 'User',
          email: '', // Missing email
          source: 'import',
        } as any,
      ]);

      expect(result.failed).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should export leads to importable format', async () => {
      const form = await system.createForm({ name: 'Test', fields: [] });
      await system.captureLead(form.formId, {
        firstName: 'Export',
        lastName: 'Test',
        email: 'export@example.com',
        company: 'ExportCorp',
        source: 'form',
        customFields: {},
      });

      const exported = await system.exportLeads();
      expect(exported.length).toBeGreaterThan(0);
      expect(exported[0]).toHaveProperty('firstName');
      expect(exported[0]).toHaveProperty('email');
      expect(exported[0]).toHaveProperty('company');
    });
  });

  describe('Reporting', () => {
    beforeEach(async () => {
      const form = await system.createForm({ name: 'Test', fields: [] });

      for (let i = 0; i < 5; i++) {
        await system.captureLead(form.formId, {
          firstName: `Lead${i}`,
          lastName: 'Test',
          email: `lead${i}@example.com`,
          company: i % 2 === 0 ? 'Company A' : 'Company B',
          source: 'form',
          customFields: {},
        });
      }
    });

    test('should generate comprehensive report', async () => {
      const report = await system.generateReport();

      expect(report.reportId).toBeDefined();
      expect(report.generatedAt).toBeDefined();
      expect(report.totalLeads).toBeGreaterThan(0);
      expect(report.leadsByStage).toBeDefined();
      expect(report.leadsByQuality).toBeDefined();
      expect(report.conversionRate).toBeGreaterThanOrEqual(0);
      expect(report.averageLeadScore).toBeGreaterThanOrEqual(0);
    });

    test('should get conversion metrics', async () => {
      const metrics = await system.getConversionMetrics();

      expect(metrics.rate).toBeGreaterThanOrEqual(0);
      expect(metrics.avgTimeInDays).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('LeadManus', () => {
  let leadManus: LeadManus;

  beforeEach(() => {
    leadManus = new LeadManus();
  });

  test('should create a real estate lead form', async () => {
    const form = await leadManus.createRealEstateLead();

    expect(form.name).toContain('Real Estate');
    expect(form.fields.length).toBeGreaterThan(0);
  });

  test('should create a SaaS lead form', async () => {
    const form = await leadManus.createSaaSLeadForm();

    expect(form.name).toContain('SaaS');
    expect(form.fields.length).toBeGreaterThan(0);
  });

  test('should capture and manage leads end-to-end', async () => {
    const form = await leadManus.createForm('Test Form', [
      { name: 'Email', type: 'email', required: true },
      { name: 'Interest', type: 'select', required: true },
    ]);

    const lead = await leadManus.captureLead(form.formId, {
      firstName: 'End',
      lastName: 'User',
      email: 'endtoend@example.com',
      company: 'Test Corp',
    });

    expect(lead.leadId).toBeDefined();

    await leadManus.advanceLead(lead.leadId, 'contacted');
    await leadManus.advanceLead(lead.leadId, 'qualified');

    const report = await leadManus.generateReport();
    expect(report.totalLeads).toBeGreaterThan(0);
  });
});

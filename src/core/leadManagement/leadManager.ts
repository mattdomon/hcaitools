/**
 * Lead Manager Implementation
 * Manages lead capture, scoring, and pipeline tracking
 */

import crypto from 'crypto';
import {
  Lead,
  LeadCaptureForm,
  LeadData,
  LeadScoring,
  LeadPipeline,
  LeadInteraction,
  LeadReport,
  LeadImportData,
  LeadAssignment,
  LeadManager,
  LeadStage,
  LeadSource,
  LeadQuality,
} from './types';

export class LeadManagementSystem implements LeadManager {
  private forms: Map<string, LeadCaptureForm> = new Map();
  private leads: Map<string, Lead> = new Map();
  private interactions: Map<string, LeadInteraction[]> = new Map();
  private assignments: Map<string, LeadAssignment> = new Map();

  async createForm(form: Omit<LeadCaptureForm, 'createdAt' | 'updatedAt' | 'formId'>): Promise<LeadCaptureForm> {
    const formId = this.generateId('form');
    const now = new Date();

    const newForm: LeadCaptureForm = {
      ...form,
      formId,
      createdAt: now,
      updatedAt: now,
    };

    this.forms.set(formId, newForm);
    return newForm;
  }

  async getForm(formId: string): Promise<LeadCaptureForm | null> {
    return this.forms.get(formId) || null;
  }

  async listForms(): Promise<LeadCaptureForm[]> {
    return Array.from(this.forms.values());
  }

  async updateForm(formId: string, updates: Partial<LeadCaptureForm>): Promise<LeadCaptureForm> {
    const form = this.forms.get(formId);
    if (!form) {
      throw new Error(`Form ${formId} not found`);
    }

    const updated: LeadCaptureForm = {
      ...form,
      ...updates,
      formId,
      createdAt: form.createdAt,
      updatedAt: new Date(),
    };

    this.forms.set(formId, updated);
    return updated;
  }

  async deleteForm(formId: string): Promise<void> {
    this.forms.delete(formId);
  }

  async captureLead(formId: string, data: Omit<LeadData, 'leadId' | 'formId' | 'capturedAt'>): Promise<Lead> {
    const form = this.forms.get(formId);
    if (!form) {
      throw new Error(`Form ${formId} not found`);
    }

    const leadId = this.generateId('lead');
    const now = new Date();

    const leadData: LeadData = {
      ...data,
      leadId,
      formId,
      capturedAt: now,
    };

    const scoring: LeadScoring = await this.calculateInitialScore(leadData);

    const pipeline: LeadPipeline = {
      leadId,
      stage: 'prospect',
      stageEnteredAt: now,
      dayInStage: 0,
    };

    const lead: Lead = {
      leadId,
      data: leadData,
      scoring,
      pipeline,
      interactions: [],
      createdAt: now,
      updatedAt: now,
    };

    this.leads.set(leadId, lead);
    this.interactions.set(leadId, []);

    // Record form submission as interaction
    await this.addInteraction(leadId, {
      type: 'form_submission',
      description: `Submitted form: ${form.name}`,
      metadata: { formId, formName: form.name },
    });

    return lead;
  }

  async calculateLeadScore(leadId: string): Promise<LeadScoring> {
    const lead = this.leads.get(leadId);
    if (!lead) {
      throw new Error(`Lead ${leadId} not found`);
    }

    const scoring = await this.calculateInitialScore(lead.data);
    lead.scoring = scoring;
    this.leads.set(leadId, lead);

    return scoring;
  }

  private async calculateInitialScore(data: LeadData): Promise<LeadScoring> {
    const baseScore = 50;

    // Email engagement score
    const emailScore = data.email ? 20 : 0;

    // Profile completeness
    let completeFields = 0;
    if (data.firstName) completeFields++;
    if (data.lastName) completeFields++;
    if (data.email) completeFields++;
    if (data.phone) completeFields++;
    if (data.company) completeFields++;
    if (data.jobTitle) completeFields++;
    const completenessScore = (completeFields / 6) * 20;

    // Company signals (if company is provided)
    const companyScore = data.company ? 10 : 0;

    const totalScore = Math.min(100, baseScore + emailScore + completenessScore + companyScore);
    const quality = this.getQualityFromScore(totalScore);

    return {
      leadId: data.leadId,
      baseScore,
      emailEngagementScore: emailScore,
      websiteActivityScore: 0,
      profileCompletenessScore: completenessScore,
      companySignalsScore: companyScore,
      totalScore,
      quality,
      lastCalculatedAt: new Date(),
    };
  }

  private getQualityFromScore(score: number): LeadQuality {
    if (score >= 70) return 'hot';
    if (score >= 40) return 'warm';
    return 'cold';
  }

  async updateLeadQuality(leadId: string, quality: LeadQuality): Promise<void> {
    const lead = this.leads.get(leadId);
    if (!lead) {
      throw new Error(`Lead ${leadId} not found`);
    }

    lead.scoring.quality = quality;
    this.leads.set(leadId, lead);
  }

  async moveLead(leadId: string, stage: LeadStage): Promise<Lead> {
    const lead = this.leads.get(leadId);
    if (!lead) {
      throw new Error(`Lead ${leadId} not found`);
    }

    const now = new Date();
    lead.pipeline.stage = stage;
    lead.pipeline.stageEnteredAt = now;
    lead.pipeline.dayInStage = 0;
    lead.updatedAt = now;

    // Record stage change as interaction
    await this.addInteraction(leadId, {
      type: 'form_submission',
      description: `Moved to stage: ${stage}`,
      metadata: { newStage: stage },
    });

    this.leads.set(leadId, lead);
    return lead;
  }

  async assignLead(assignment: Omit<LeadAssignment, 'assignedAt'>): Promise<void> {
    const lead = this.leads.get(assignment.leadId);
    if (!lead) {
      throw new Error(`Lead ${assignment.leadId} not found`);
    }

    const now = new Date();
    const fullAssignment: LeadAssignment = {
      ...assignment,
      assignedAt: now,
    };

    lead.pipeline.assignedTo = assignment.assignedTo;
    this.leads.set(assignment.leadId, lead);
    this.assignments.set(assignment.leadId, fullAssignment);
  }

  async getLeadsByStage(stage: LeadStage): Promise<Lead[]> {
    return Array.from(this.leads.values()).filter((lead) => lead.pipeline.stage === stage);
  }

  async getLead(leadId: string): Promise<Lead | null> {
    return this.leads.get(leadId) || null;
  }

  async getLeadByEmail(email: string): Promise<Lead | null> {
    for (const lead of this.leads.values()) {
      if (lead.data.email === email) {
        return lead;
      }
    }
    return null;
  }

  async listLeads(filters?: { stage?: LeadStage; quality?: LeadQuality; assignedTo?: string }): Promise<Lead[]> {
    let results = Array.from(this.leads.values());

    if (filters?.stage) {
      results = results.filter((l) => l.pipeline.stage === filters.stage);
    }

    if (filters?.quality) {
      results = results.filter((l) => l.scoring.quality === filters.quality);
    }

    if (filters?.assignedTo) {
      results = results.filter((l) => l.pipeline.assignedTo === filters.assignedTo);
    }

    return results;
  }

  async addInteraction(leadId: string, interaction: Omit<LeadInteraction, 'interactionId' | 'leadId' | 'timestamp'>): Promise<LeadInteraction> {
    if (!this.leads.has(leadId)) {
      throw new Error(`Lead ${leadId} not found`);
    }

    const interactionId = this.generateId('interaction');
    const now = new Date();

    const newInteraction: LeadInteraction = {
      ...interaction,
      interactionId,
      leadId,
      timestamp: now,
    };

    const interactions = this.interactions.get(leadId) || [];
    interactions.push(newInteraction);
    this.interactions.set(leadId, interactions);

    // Update lead's interaction count
    const lead = this.leads.get(leadId);
    if (lead) {
      lead.interactions = interactions;
      this.leads.set(leadId, lead);
    }

    return newInteraction;
  }

  async getInteractions(leadId: string): Promise<LeadInteraction[]> {
    return this.interactions.get(leadId) || [];
  }

  async importLeads(leads: LeadImportData[]): Promise<{ successful: number; failed: number; errors: string[] }> {
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < leads.length; i++) {
      try {
        const leadData = leads[i];
        if (!leadData.email || !leadData.firstName || !leadData.lastName) {
          throw new Error('Missing required fields: firstName, lastName, email');
        }

        // Create temporary form for importing
        const tempFormId = this.generateId('form');
        this.forms.set(tempFormId, {
          formId: tempFormId,
          name: 'Bulk Import',
          fields: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await this.captureLead(tempFormId, {
          ...leadData,
          customFields: leadData.customFields || {},
        } as any);

        successful++;
      } catch (error) {
        failed++;
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { successful, failed, errors };
  }

  async exportLeads(filters?: { stage?: LeadStage; quality?: LeadQuality }): Promise<LeadImportData[]> {
    const leads = await this.listLeads(filters);
    return leads.map((lead) => ({
      firstName: lead.data.firstName,
      lastName: lead.data.lastName,
      email: lead.data.email,
      phone: lead.data.phone,
      company: lead.data.company,
      jobTitle: lead.data.jobTitle,
      source: lead.data.source,
      customFields: lead.data.customFields,
    }));
  }

  async generateReport(): Promise<LeadReport> {
    const allLeads = Array.from(this.leads.values());
    const now = new Date();

    const leadsByStage: Record<LeadStage, number> = {
      prospect: 0,
      contacted: 0,
      qualified: 0,
      converted: 0,
      lost: 0,
    };

    const leadsByQuality: Record<LeadQuality, number> = {
      hot: 0,
      warm: 0,
      cold: 0,
    };

    const sourceCount: Record<LeadSource, number> = {
      form: 0,
      api: 0,
      import: 0,
      email: 0,
      phone: 0,
    };

    let totalScore = 0;
    let conversionCount = 0;
    let totalTimeInPipeline = 0;
    const recentConversions: Lead[] = [];

    for (const lead of allLeads) {
      leadsByStage[lead.pipeline.stage]++;
      leadsByQuality[lead.scoring.quality]++;
      sourceCount[lead.data.source]++;
      totalScore += lead.scoring.totalScore;

      if (lead.pipeline.stage === 'converted') {
        conversionCount++;
        const timeInPipeline = Math.floor((now.getTime() - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        totalTimeInPipeline += timeInPipeline;
        recentConversions.push(lead);
      }
    }

    const topSources = Object.entries(sourceCount)
      .map(([source, count]) => ({ source: source as LeadSource, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      reportId: this.generateId('report'),
      generatedAt: now,
      totalLeads: allLeads.length,
      leadsByStage,
      conversionRate: allLeads.length > 0 ? (conversionCount / allLeads.length) * 100 : 0,
      averageTimeInPipeline: conversionCount > 0 ? totalTimeInPipeline / conversionCount : 0,
      topSources,
      leadsByQuality,
      averageLeadScore: allLeads.length > 0 ? totalScore / allLeads.length : 0,
      recentConversions: recentConversions.slice(-10),
    };
  }

  async getConversionMetrics(): Promise<{ rate: number; avgTimeInDays: number }> {
    const report = await this.generateReport();
    return {
      rate: report.conversionRate,
      avgTimeInDays: report.averageTimeInPipeline,
    };
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

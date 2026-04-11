/**
 * Lead Management
 * Lead capture, scoring, and pipeline management system
 */

export {
  LeadStage,
  LeadSource,
  LeadQuality,
  LeadField,
  LeadCaptureForm,
  LeadData,
  LeadScoring,
  LeadPipeline,
  Lead,
  LeadInteraction,
  LeadReport,
  LeadImportData,
  LeadAssignment,
  LeadManager,
} from './types';

export { LeadManagementSystem } from './leadManager';

import { LeadManagementSystem } from './leadManager';
import { LeadImportData, LeadReport } from './types';

/**
 * LeadManus
 * Main class for lead management system
 */
export class LeadManus {
  private manager: LeadManagementSystem;

  constructor() {
    this.manager = new LeadManagementSystem();
  }

  /**
   * Create a new lead capture form
   */
  async createForm(name: string, fields: Array<{ name: string; type: string; required: boolean }>) {
    return this.manager.createForm({
      name,
      fields: fields.map((f, idx) => ({
        fieldId: `field_${idx}`,
        name: f.name,
        type: f.type as 'text' | 'email' | 'phone' | 'number' | 'date' | 'select' | 'textarea',
        required: f.required,
      })),
    });
  }

  /**
   * Capture a new lead from form submission
   */
  async captureLead(formId: string, data: Record<string, unknown>) {
    return this.manager.captureLead(formId, {
      ...data,
      source: 'form',
      customFields: {},
    } as any);
  }

  /**
   * Get all leads in a specific stage
   */
  async getLeadsByStage(stage: string) {
    return this.manager.getLeadsByStage(stage as any);
  }

  /**
   * Move lead to next stage
   */
  async advanceLead(leadId: string, newStage: string) {
    return this.manager.moveLead(leadId, newStage as any);
  }

  /**
   * Import leads in bulk
   */
  async importLeads(leads: LeadImportData[]) {
    return this.manager.importLeads(leads);
  }

  /**
   * Export leads to CSV format
   */
  async exportLeads(stage?: string, quality?: string) {
    return this.manager.exportLeads({
      stage: stage as any,
      quality: quality as any,
    });
  }

  /**
   * Generate lead pipeline report
   */
  async generateReport(): Promise<LeadReport> {
    return this.manager.generateReport();
  }

  /**
   * Get conversion metrics
   */
  async getMetrics() {
    return this.manager.getConversionMetrics();
  }

  /**
   * Example: Create a real estate lead form
   */
  async createRealEstateLead() {
    const form = await this.manager.createForm({
      name: 'Real Estate Lead Form',
      fields: [
        {
          fieldId: 'field_1',
          name: 'Looking for',
          type: 'select',
          required: true,
          options: ['Buy', 'Sell', 'Rent'],
        },
        {
          fieldId: 'field_2',
          name: 'Budget',
          type: 'number',
          required: true,
        },
        {
          fieldId: 'field_3',
          name: 'Timeline',
          type: 'select',
          required: true,
          options: ['ASAP', '1-3 months', '3-6 months', 'Not sure'],
        },
      ],
    });

    return form;
  }

  /**
   * Example: Create a B2B SaaS lead form
   */
  async createSaaSLeadForm() {
    const form = await this.manager.createForm({
      name: 'SaaS Lead Form',
      fields: [
        {
          fieldId: 'field_1',
          name: 'Company Size',
          type: 'select',
          required: true,
          options: ['1-10', '10-50', '50-200', '200+'],
        },
        {
          fieldId: 'field_2',
          name: 'Use Case',
          type: 'textarea',
          required: true,
        },
        {
          fieldId: 'field_3',
          name: 'Implementation Timeline',
          type: 'date',
          required: false,
        },
      ],
    });

    return form;
  }
}

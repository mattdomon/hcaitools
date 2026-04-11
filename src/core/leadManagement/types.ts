/**
 * Lead Management Types
 * Types for lead capture, scoring, and pipeline tracking
 */

export type LeadStage = 'prospect' | 'contacted' | 'qualified' | 'converted' | 'lost';
export type LeadSource = 'form' | 'api' | 'import' | 'email' | 'phone';
export type LeadQuality = 'hot' | 'warm' | 'cold';

export interface LeadField {
  fieldId: string;
  name: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'date' | 'select' | 'textarea';
  required: boolean;
  placeholder?: string;
  options?: string[]; // for select fields
}

export interface LeadCaptureForm {
  formId: string;
  name: string;
  description?: string;
  fields: LeadField[];
  thankYouMessage?: string;
  redirectUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadData {
  leadId: string;
  formId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  customFields: Record<string, unknown>;
  source: LeadSource;
  capturedAt: Date;
}

export interface LeadScoring {
  leadId: string;
  baseScore: number; // 0-100
  emailEngagementScore: number;
  websiteActivityScore: number;
  profileCompletenessScore: number;
  companySignalsScore: number;
  totalScore: number;
  quality: LeadQuality;
  lastCalculatedAt: Date;
}

export interface LeadPipeline {
  leadId: string;
  stage: LeadStage;
  assignedTo?: string; // user ID
  stageEnteredAt: Date;
  dayInStage: number;
  expectedCloseDate?: Date;
  notes?: string;
}

export interface Lead {
  leadId: string;
  data: LeadData;
  scoring: LeadScoring;
  pipeline: LeadPipeline;
  interactions: LeadInteraction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadInteraction {
  interactionId: string;
  leadId: string;
  type: 'email' | 'call' | 'meeting' | 'website_visit' | 'form_submission' | 'social_engagement';
  description: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface LeadReport {
  reportId: string;
  generatedAt: Date;
  totalLeads: number;
  leadsByStage: Record<LeadStage, number>;
  conversionRate: number;
  averageTimeInPipeline: number;
  topSources: Array<{ source: LeadSource; count: number }>;
  leadsByQuality: Record<LeadQuality, number>;
  averageLeadScore: number;
  recentConversions: Lead[];
}

export interface LeadImportData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  source: LeadSource;
  customFields?: Record<string, unknown>;
}

export interface LeadAssignment {
  leadId: string;
  assignedTo: string; // user ID
  assignedBy: string; // user ID
  assignedAt: Date;
  priority: 'high' | 'medium' | 'low';
  notes?: string;
}

export interface LeadManager {
  // Form management
  createForm(form: Omit<LeadCaptureForm, 'createdAt' | 'updatedAt' | 'formId'>): Promise<LeadCaptureForm>;
  getForm(formId: string): Promise<LeadCaptureForm | null>;
  listForms(): Promise<LeadCaptureForm[]>;
  updateForm(formId: string, updates: Partial<LeadCaptureForm>): Promise<LeadCaptureForm>;
  deleteForm(formId: string): Promise<void>;

  // Lead capture
  captureLead(formId: string, data: Omit<LeadData, 'leadId' | 'formId' | 'capturedAt'>): Promise<Lead>;

  // Lead scoring
  calculateLeadScore(leadId: string): Promise<LeadScoring>;
  updateLeadQuality(leadId: string, quality: LeadQuality): Promise<void>;

  // Pipeline management
  moveLead(leadId: string, stage: LeadStage): Promise<Lead>;
  assignLead(assignment: Omit<LeadAssignment, 'assignedAt'>): Promise<void>;
  getLeadsByStage(stage: LeadStage): Promise<Lead[]>;

  // Lead retrieval
  getLead(leadId: string): Promise<Lead | null>;
  getLeadByEmail(email: string): Promise<Lead | null>;
  listLeads(filters?: { stage?: LeadStage; quality?: LeadQuality; assignedTo?: string }): Promise<Lead[]>;

  // Interactions
  addInteraction(leadId: string, interaction: Omit<LeadInteraction, 'interactionId' | 'leadId' | 'timestamp'>): Promise<LeadInteraction>;
  getInteractions(leadId: string): Promise<LeadInteraction[]>;

  // Import/Export
  importLeads(leads: LeadImportData[]): Promise<{ successful: number; failed: number; errors: string[] }>;
  exportLeads(filters?: { stage?: LeadStage; quality?: LeadQuality }): Promise<LeadImportData[]>;

  // Reporting
  generateReport(): Promise<LeadReport>;
  getConversionMetrics(): Promise<{ rate: number; avgTimeInDays: number }>;
}

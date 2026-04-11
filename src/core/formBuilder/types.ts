export type FieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'multi-select'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'datetime'
  | 'time'
  | 'number'
  | 'email'
  | 'phone'
  | 'url'
  | 'file'
  | 'signature';

export type ValidationType =
  | 'required'
  | 'minLength'
  | 'maxLength'
  | 'pattern'
  | 'min'
  | 'max'
  | 'custom'
  | 'email'
  | 'url'
  | 'phone'
  | 'fileType'
  | 'fileSize';

export interface ValidationRule {
  type: ValidationType;
  value?: unknown;
  message: string;
  customValidator?: CustomValidator;
}

export type CustomValidator = (value: unknown, field?: FormField) => ValidationResult;

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export interface FieldOption {
  label: string;
  value: string;
}

export interface ConditionalLogic {
  action: 'show' | 'hide' | 'enable' | 'disable';
  condition: ConditionalCondition;
}

export interface ConditionalCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
  value?: unknown;
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: unknown;
  options?: FieldOption[];
  validation?: ValidationRule[];
  conditionalLogic?: ConditionalLogic;
  required?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  helpText?: string;
  fileTypes?: string[];
  maxFileSize?: number;
  minValue?: number;
  maxValue?: number;
  step?: number;
  rows?: number;
  cols?: number;
  acceptMultiple?: boolean;
  width?: 'full' | 'half' | 'third' | 'quarter';
}

export interface FormSection {
  id: string;
  title?: string;
  description?: string;
  fields: FormField[];
  conditionalLogic?: ConditionalLogic;
  columns?: 1 | 2 | 3 | 4;
}

export interface FormLayout {
  sections: FormSection[];
  columns?: 1 | 2 | 3 | 4;
}

export interface FormSubmitConfig {
  endpoint?: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  successMessage?: string;
  errorMessage?: string;
  redirectUrl?: string;
  confirmationRequired?: boolean;
  confirmationMessage?: string;
}

export interface FormConfig {
  id: string;
  title: string;
  description?: string;
  layout: FormLayout;
  submit?: FormSubmitConfig;
  successMessage?: string;
  errorMessage?: string;
  cssClass?: string;
  attributes?: Record<string, string>;
}

export interface FormValues {
  [fieldName: string]: unknown;
}

export interface FormErrors {
  [fieldName: string]: string[];
}

export interface FieldValidationContext {
  values: FormValues;
  allValues: FormValues;
  field: FormField;
}

export interface FormSubmission {
  id: string;
  formId: string;
  values: FormValues;
  submittedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'xml';
  includeMetadata?: boolean;
  dateFormat?: string;
  delimiter?: string;
}

export interface DragDropItem {
  id: string;
  type: 'field' | 'section';
  fieldType?: FieldType;
  index: number;
  sectionId?: string;
}

export interface DragDropResult {
  item: DragDropItem;
  fromIndex: number;
  toIndex: number;
  fromSection?: string;
  toSection?: string;
}

export interface FieldTemplate {
  type: FieldType;
  label: string;
  defaultOptions?: FieldOption[];
  defaultValidation?: ValidationRule[];
}

export const DEFAULT_FIELD_TEMPLATES: FieldTemplate[] = [
  { type: 'text', label: 'Text Field' },
  { type: 'textarea', label: 'Text Area' },
  { type: 'select', label: 'Dropdown', defaultOptions: [{ label: 'Option 1', value: 'option1' }] },
  { type: 'multi-select', label: 'Multi-Select', defaultOptions: [{ label: 'Option 1', value: 'option1' }] },
  { type: 'checkbox', label: 'Checkbox', defaultOptions: [{ label: 'Checkbox', value: 'checked' }] },
  { type: 'radio', label: 'Radio Buttons', defaultOptions: [{ label: 'Option 1', value: 'option1' }] },
  { type: 'date', label: 'Date' },
  { type: 'datetime', label: 'Date & Time' },
  { type: 'time', label: 'Time' },
  { type: 'number', label: 'Number' },
  { type: 'email', label: 'Email', defaultValidation: [{ type: 'email', message: 'Invalid email address' }] },
  { type: 'phone', label: 'Phone', defaultValidation: [{ type: 'phone', message: 'Invalid phone number' }] },
  { type: 'url', label: 'URL', defaultValidation: [{ type: 'url', message: 'Invalid URL' }] },
  { type: 'file', label: 'File Upload' },
  { type: 'signature', label: 'Signature' },
];

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const URL_PATTERN = /^https?:\/\/.+/;
export const PHONE_PATTERN = /^[\d\s\-\+\(\)]+$/;

export function createDefaultValidation(type: FieldType): ValidationRule[] {
  switch (type) {
    case 'email':
      return [{ type: 'email', message: 'Invalid email address' }];
    case 'url':
      return [{ type: 'url', message: 'Invalid URL' }];
    case 'phone':
      return [{ type: 'phone', message: 'Invalid phone number' }];
    case 'file':
      return [
        { type: 'fileType', value: '*', message: 'Invalid file type' },
        { type: 'fileSize', value: 10485760, message: 'File size exceeds limit' },
      ];
    default:
      return [];
  }
}

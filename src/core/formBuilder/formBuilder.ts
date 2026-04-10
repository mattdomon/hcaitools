import crypto from 'crypto';
import {
  FormConfig,
  FormField,
  FormSection,
  FormValues,
  FormErrors,
  ValidationRule,
  ValidationResult,
  FieldValidationContext,
  FieldType,
  ConditionalLogic,
  ConditionalCondition,
  DragDropResult,
  FormSubmission,
  ExportOptions,
  FieldTemplate,
  DEFAULT_FIELD_TEMPLATES,
  EMAIL_PATTERN,
  URL_PATTERN,
  PHONE_PATTERN,
  FieldOption,
  createDefaultValidation,
} from './types';

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export class FormBuilder {
  private config: FormConfig;
  private values: FormValues = {};
  private errors: FormErrors = {};
  private touched: Set<string> = new Set();
  private submissions: FormSubmission[] = [];

  constructor(config: FormConfig) {
    this.config = this.deepClone(config);
    this.initializeValues();
  }

  private deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item)) as unknown as T;
    }
    const cloned = {} as T;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    return cloned;
  }

  private initializeValues(): void {
    for (const section of this.config.layout.sections) {
      for (const field of section.fields) {
        if (field.defaultValue !== undefined) {
          this.values[field.name] = field.defaultValue;
        } else if (field.type === 'checkbox') {
          this.values[field.name] = false;
        } else if (field.type === 'multi-select') {
          this.values[field.name] = [];
        } else {
          this.values[field.name] = '';
        }
      }
    }
  }

  getConfig(): FormConfig {
    return this.deepClone(this.config);
  }

  getValues(): FormValues {
    return this.deepClone(this.values);
  }

  setValues(values: FormValues): void {
    this.values = { ...this.values, ...values };
  }

  getValue(name: string): unknown {
    return this.values[name];
  }

  setValue(name: string, value: unknown): void {
    this.values[name] = value;
    this.touched.add(name);
    this.validateField(name);
  }

  getErrors(): FormErrors {
    return this.deepClone(this.errors);
  }

  getFieldError(name: string): string[] {
    return this.errors[name] || [];
  }

  clearErrors(): void {
    this.errors = {};
  }

  clearFieldError(name: string): void {
    delete this.errors[name];
  }

  isValid(): boolean {
    this.validate();
    return Object.keys(this.errors).length === 0;
  }

  isFieldVisible(fieldName: string): boolean {
    const field = this.findFieldByName(fieldName);
    if (!field) return true;
    if (field.hidden) return false;

    const section = this.findSectionByFieldName(fieldName);
    if (section && section.conditionalLogic) {
      return this.evaluateCondition(section.conditionalLogic);
    }

    if (field.conditionalLogic) {
      return this.evaluateCondition(field.conditionalLogic);
    }

    return true;
  }

  isFieldDisabled(fieldName: string): boolean {
    const field = this.findFieldByName(fieldName);
    if (!field) return false;
    if (field.disabled) return true;

    const section = this.findSectionByFieldName(fieldName);
    if (section && section.conditionalLogic) {
      const condition = section.conditionalLogic;
      if (condition.action === 'disable') {
        return this.evaluateCondition(condition);
      }
    }

    if (field.conditionalLogic) {
      const condition = field.conditionalLogic;
      if (condition.action === 'disable') {
        return this.evaluateCondition(condition);
      }
    }

    return false;
  }

  private evaluateCondition(logic: ConditionalLogic): boolean {
    const condition = logic.condition;
    const fieldValue = this.values[condition.field];

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'contains':
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(condition.value);
        }
        if (typeof fieldValue === 'string') {
          return fieldValue.includes(String(condition.value));
        }
        return false;
      case 'not_contains':
        if (Array.isArray(fieldValue)) {
          return !fieldValue.includes(condition.value);
        }
        if (typeof fieldValue === 'string') {
          return !fieldValue.includes(String(condition.value));
        }
        return true;
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      case 'is_empty':
        return fieldValue === undefined || fieldValue === null || fieldValue === '' ||
          (Array.isArray(fieldValue) && fieldValue.length === 0);
      case 'is_not_empty':
        return fieldValue !== undefined && fieldValue !== null && fieldValue !== '' &&
          !(Array.isArray(fieldValue) && fieldValue.length === 0);
      default:
        return true;
    }
  }

  private findFieldByName(name: string): FormField | undefined {
    for (const section of this.config.layout.sections) {
      const field = section.fields.find((f) => f.name === name);
      if (field) return field;
    }
    return undefined;
  }

  private findSectionByFieldName(name: string): FormSection | undefined {
    for (const section of this.config.layout.sections) {
      if (section.fields.some((f) => f.name === name)) {
        return section;
      }
    }
    return undefined;
  }

  validate(): boolean {
    this.errors = {};

    for (const section of this.config.layout.sections) {
      if (!this.isSectionVisible(section)) continue;

      for (const field of section.fields) {
        if (!this.isFieldVisible(field.name)) continue;
        this.validateField(field.name);
      }
    }

    return Object.keys(this.errors).length === 0;
  }

  private isSectionVisible(section: FormSection): boolean {
    if (section.conditionalLogic) {
      return this.evaluateCondition(section.conditionalLogic);
    }
    return true;
  }

  validateField(name: string): ValidationResult {
    const field = this.findFieldByName(name);
    if (!field) {
      return { valid: true };
    }

    if (!this.isFieldVisible(name)) {
      delete this.errors[name];
      return { valid: true };
    }

    const value = this.values[name];
    const context: FieldValidationContext = {
      values: this.values,
      allValues: this.values,
      field,
    };

    if (field.required && this.isRequired(value, field)) {
      this.errors[name] = [`${field.label} is required`];
      return { valid: false, message: `${field.label} is required` };
    }

    if (value === '' || value === undefined || value === null) {
      delete this.errors[name];
      return { valid: true };
    }

    const validationResults: string[] = [];

    if (field.validation) {
      for (const rule of field.validation) {
        const result = this.applyValidationRule(value, rule, context);
        if (!result.valid) {
          validationResults.push(result.message || 'Invalid value');
        }
      }
    }

    if (validationResults.length > 0) {
      this.errors[name] = validationResults;
      return { valid: false, message: validationResults[0] };
    }

    delete this.errors[name];
    return { valid: true };
  }

  private isRequired(value: unknown, field: FormField): boolean {
    if (field.required) return true;

    if (value === undefined || value === null) return true;

    if (typeof value === 'string' && value.trim() === '') return true;

    if (Array.isArray(value) && value.length === 0) return true;

    return false;
  }

  private applyValidationRule(value: unknown, rule: ValidationRule, context: FieldValidationContext): ValidationResult {
    if (rule.customValidator) {
      const result = rule.customValidator(value, context.field);
      if (!result.valid) {
        return result;
      }
      return { valid: true };
    }

    switch (rule.type) {
      case 'required':
        return this.validateRequired(value, rule);
      case 'minLength':
        return this.validateMinLength(value, rule);
      case 'maxLength':
        return this.validateMaxLength(value, rule);
      case 'pattern':
        return this.validatePattern(value, rule);
      case 'min':
        return this.validateMin(value, rule);
      case 'max':
        return this.validateMax(value, rule);
      case 'email':
        return this.validateEmail(value, rule);
      case 'url':
        return this.validateUrl(value, rule);
      case 'phone':
        return this.validatePhone(value, rule);
      case 'fileType':
        return this.validateFileType(value, rule);
      case 'fileSize':
        return this.validateFileSize(value, rule);
      case 'custom':
        return { valid: true };
      default:
        return { valid: true };
    }
  }

  private validateRequired(value: unknown, rule: ValidationRule): ValidationResult {
    const isEmpty = value === undefined || value === null || value === '' ||
      (Array.isArray(value) && value.length === 0);
    return {
      valid: !isEmpty,
      message: rule.message,
    };
  }

  private validateMinLength(value: unknown, rule: ValidationRule): ValidationResult {
    if (typeof value !== 'string') {
      return { valid: false, message: 'Value must be a string' };
    }
    const minLength = Number(rule.value);
    return {
      valid: value.length >= minLength,
      message: rule.message,
    };
  }

  private validateMaxLength(value: unknown, rule: ValidationRule): ValidationResult {
    if (typeof value !== 'string') {
      return { valid: false, message: 'Value must be a string' };
    }
    const maxLength = Number(rule.value);
    return {
      valid: value.length <= maxLength,
      message: rule.message,
    };
  }

  private validatePattern(value: unknown, rule: ValidationRule): ValidationResult {
    if (typeof value !== 'string') {
      return { valid: false, message: 'Value must be a string' };
    }
    const pattern = new RegExp(String(rule.value));
    return {
      valid: pattern.test(value),
      message: rule.message,
    };
  }

  private validateMin(value: unknown, rule: ValidationRule): ValidationResult {
    const numValue = Number(value);
    const minValue = Number(rule.value);
    return {
      valid: numValue >= minValue,
      message: rule.message,
    };
  }

  private validateMax(value: unknown, rule: ValidationRule): ValidationResult {
    const numValue = Number(value);
    const maxValue = Number(rule.value);
    return {
      valid: numValue <= maxValue,
      message: rule.message,
    };
  }

  private validateEmail(value: unknown, rule: ValidationRule): ValidationResult {
    if (typeof value !== 'string') {
      return { valid: false, message: 'Value must be a string' };
    }
    return {
      valid: EMAIL_PATTERN.test(value),
      message: rule.message,
    };
  }

  private validateUrl(value: unknown, rule: ValidationRule): ValidationResult {
    if (typeof value !== 'string') {
      return { valid: false, message: 'Value must be a string' };
    }
    return {
      valid: URL_PATTERN.test(value),
      message: rule.message,
    };
  }

  private validatePhone(value: unknown, rule: ValidationRule): ValidationResult {
    if (typeof value !== 'string') {
      return { valid: false, message: 'Value must be a string' };
    }
    return {
      valid: PHONE_PATTERN.test(value),
      message: rule.message,
    };
  }

  private validateFileType(value: unknown, rule: ValidationRule): ValidationResult {
    if (!Array.isArray(value)) {
      return { valid: true };
    }
    const allowedTypes = String(rule.value).split(',').map((t) => t.trim());
    const file = value[0] as { type?: string; name?: string };
    if (!file || !file.type) {
      return { valid: true };
    }
    const isValid = allowedTypes.includes('*') ||
      allowedTypes.some((type) => file.type?.includes(type) || file.name?.endsWith(type));
    return {
      valid: isValid,
      message: rule.message,
    };
  }

  private validateFileSize(value: unknown, rule: ValidationRule): ValidationResult {
    if (!Array.isArray(value)) {
      return { valid: true };
    }
    const maxSize = Number(rule.value);
    const file = value[0] as { size?: number };
    if (!file || !file.size) {
      return { valid: true };
    }
    return {
      valid: file.size <= maxSize,
      message: rule.message,
    };
  }

  addField(sectionId: string, field: FormField, index?: number): void {
    const section = this.config.layout.sections.find((s) => s.id === sectionId);
    if (!section) {
      throw new Error(`Section with id ${sectionId} not found`);
    }

    const newField = { ...field, id: field.id || generateId('field') };

    if (index !== undefined && index >= 0 && index <= section.fields.length) {
      section.fields.splice(index, 0, newField);
    } else {
      section.fields.push(newField);
    }

    this.initializeFieldValue(newField);
  }

  removeField(fieldName: string): void {
    for (const section of this.config.layout.sections) {
      const index = section.fields.findIndex((f) => f.name === fieldName);
      if (index !== -1) {
        section.fields.splice(index, 1);
        delete this.values[fieldName];
        delete this.errors[fieldName];
        this.touched.delete(fieldName);
        return;
      }
    }
  }

  updateField(fieldName: string, updates: Partial<FormField>): void {
    const field = this.findFieldByName(fieldName);
    if (!field) {
      throw new Error(`Field with name ${fieldName} not found`);
    }

    Object.assign(field, updates);
    this.validateField(fieldName);
  }

  moveField(result: DragDropResult): void {
    const { item, fromIndex, toIndex, fromSection: fromSectionId, toSection: toSectionId } = result;

    const fromSection = fromSectionId
      ? this.config.layout.sections.find((s) => s.id === fromSectionId)
      : this.config.layout.sections.find((s) => s.fields.some((f) => f.id === item.id));

    const toSection = toSectionId
      ? this.config.layout.sections.find((s) => s.id === toSectionId)
      : this.config.layout.sections.find((s) => s.fields.some((f) => f.id === item.id));

    if (!fromSection || !toSection) {
      throw new Error('Source or destination section not found');
    }

    const fromFieldIndex = fromSection.fields.findIndex((f) => f.id === item.id);
    if (fromFieldIndex === -1) {
      throw new Error('Field not found in source section');
    }

    const [field] = fromSection.fields.splice(fromFieldIndex, 1);

    if (fromSection.id === toSection.id) {
      const adjustedIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
      toSection.fields.splice(adjustedIndex, 0, field);
    } else {
      toSection.fields.splice(toIndex, 0, field);
    }
  }

  addSection(section: FormSection, index?: number): void {
    const newSection = { ...section, id: section.id || generateId('section') };

    if (index !== undefined && index >= 0 && index <= this.config.layout.sections.length) {
      this.config.layout.sections.splice(index, 0, newSection);
    } else {
      this.config.layout.sections.push(newSection);
    }

    for (const field of newSection.fields) {
      this.initializeFieldValue(field);
    }
  }

  removeSection(sectionId: string): void {
    const index = this.config.layout.sections.findIndex((s) => s.id === sectionId);
    if (index === -1) {
      throw new Error(`Section with id ${sectionId} not found`);
    }

    const section = this.config.layout.sections[index];
    for (const field of section.fields) {
      delete this.values[field.name];
      delete this.errors[field.name];
      this.touched.delete(field.name);
    }

    this.config.layout.sections.splice(index, 1);
  }

  updateSection(sectionId: string, updates: Partial<FormSection>): void {
    const section = this.config.layout.sections.find((s) => s.id === sectionId);
    if (!section) {
      throw new Error(`Section with id ${sectionId} not found`);
    }

    Object.assign(section, updates);
  }

  private initializeFieldValue(field: FormField): void {
    if (field.defaultValue !== undefined) {
      this.values[field.name] = field.defaultValue;
    } else if (field.type === 'checkbox') {
      this.values[field.name] = false;
    } else if (field.type === 'multi-select') {
      this.values[field.name] = [];
    } else {
      this.values[field.name] = '';
    }
  }

  reset(): void {
    this.values = {};
    this.errors = {};
    this.touched.clear();
    this.initializeValues();
  }

  touchField(name: string): void {
    this.touched.add(name);
    this.validateField(name);
  }

  isFieldTouched(name: string): boolean {
    return this.touched.has(name);
  }

  getTouchedFields(): string[] {
    return Array.from(this.touched);
  }

  async submit(): Promise<FormSubmission> {
    if (!this.isValid()) {
      throw new Error('Form validation failed');
    }

    const submission: FormSubmission = {
      id: generateId('sub'),
      formId: this.config.id,
      values: this.deepClone(this.values),
      submittedAt: new Date(),
      metadata: {},
    };

    this.submissions.push(submission);
    return submission;
  }

  getSubmissions(): FormSubmission[] {
    return [...this.submissions];
  }

  exportData(options: ExportOptions): string {
    switch (options.format) {
      case 'json':
        return this.exportToJson(options);
      case 'csv':
        return this.exportToCsv(options);
      case 'xml':
        return this.exportToXml(options);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  private exportToJson(options: ExportOptions): string {
    const data = options.includeMetadata
      ? {
          formId: this.config.id,
          formTitle: this.config.title,
          exportedAt: new Date().toISOString(),
          submissions: this.submissions,
        }
      : this.submissions.map((s) => s.values);

    return JSON.stringify(data, null, 2);
  }

  private exportToCsv(options: ExportOptions): string {
    const delimiter = options.delimiter || ',';
    const headers = this.getAllFieldNames();
    const rows: string[] = [headers.join(delimiter)];

    for (const submission of this.submissions) {
      const row = headers.map((header) => {
        const value = submission.values[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      });
      rows.push(row.join(delimiter));
    }

    return rows.join('\n');
  }

  private exportToXml(options: ExportOptions): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<form id="${this.config.id}" title="${this.config.title}">\n`;

    if (options.includeMetadata) {
      xml += `  <exportedAt>${new Date().toISOString()}</exportedAt>\n`;
    }

    xml += '  <submissions>\n';
    for (const submission of this.submissions) {
      xml += `    <submission id="${submission.id}" submittedAt="${submission.submittedAt.toISOString()}">\n`;
      for (const [key, value] of Object.entries(submission.values)) {
        const safeValue = value === undefined ? '' : String(value);
        xml += `      <${key}><![CDATA[${safeValue}]]></${key}>\n`;
      }
      xml += '    </submission>\n';
    }
    xml += '  </submissions>\n';
    xml += '</form>';

    return xml;
  }

  private getAllFieldNames(): string[] {
    const names = new Set<string>();
    for (const section of this.config.layout.sections) {
      for (const field of section.fields) {
        names.add(field.name);
      }
    }
    return Array.from(names);
  }

  static createField(type: FieldType, name: string, label: string, options?: Partial<FormField>): FormField {
    const field: FormField = {
      id: generateId('field'),
      type,
      name,
      label,
      ...options,
    };

    if (!field.validation && ['email', 'url', 'phone', 'file'].includes(type)) {
      field.validation = createDefaultValidation(type);
    }

    return field;
  }

  static createSection(title?: string, description?: string): FormSection {
    return {
      id: generateId('section'),
      title,
      description,
      fields: [],
      columns: 1,
    };
  }

  static createConfig(title: string, sections?: FormSection[]): FormConfig {
    return {
      id: generateId('form'),
      title,
      layout: {
        sections: sections || [],
        columns: 1,
      },
    };
  }

  static getFieldTemplates(): FieldTemplate[] {
    return DEFAULT_FIELD_TEMPLATES;
  }

  static createFieldOption(label: string, value: string): FieldOption {
    return { label, value };
  }

  static createConditionalLogic(
    action: ConditionalLogic['action'],
    field: string,
    operator: ConditionalCondition['operator'],
    value?: unknown
  ): ConditionalLogic {
    return {
      action,
      condition: {
        field,
        operator,
        value,
      },
    };
  }

  static createValidationRule(type: ValidationRule['type'], message: string, value?: unknown): ValidationRule {
    return { type, message, value };
  }
}

export { generateId };

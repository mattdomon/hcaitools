/**
 * CRUD Generator Types
 * Types for data validation, optimistic locking, and audit trails
 */

export type ValidationType = 'required' | 'email' | 'phone' | 'url' | 'minLength' | 'maxLength' | 'min' | 'max' | 'pattern' | 'enum' | 'custom' | 'unique' | 'compare';
export type OperationType = 'create' | 'read' | 'update' | 'delete' | 'list' | 'count' | 'batch_update' | 'batch_delete' | 'restore';
export type BatchOperationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';

export interface ValidationRule {
  ruleId: string;
  fieldName: string;
  validationType: ValidationType;
  value?: unknown;
  message: string;
  severity: 'error' | 'warning';
}

export interface CrossFieldValidation {
  validationId: string;
  name: string;
  fields: string[];
  validator: (values: Record<string, unknown>) => boolean;
  message: string;
}

export interface OptimisticLock {
  version: number;
  lastModifiedAt: Date;
  lastModifiedBy?: string;
}

export interface EntityVersion {
  entityId: string;
  version: number;
  changes: EntityChange[];
  modifiedAt: Date;
  modifiedBy?: string;
}

export interface EntityChange {
  changeId: string;
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
  changedAt: Date;
}

export interface AuditEntry {
  auditId: string;
  entityType: string;
  entityId: string;
  operation: OperationType;
  performedBy?: string;
  performedAt: Date;
  changes: EntityChange[];
  metadata?: Record<string, unknown>;
}

export interface SoftDeletable {
  deletedAt?: Date;
  deletedBy?: string;
  isDeleted: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  fieldName: string;
  message: string;
  ruleId?: string;
}

export interface ValidationWarning {
  fieldName: string;
  message: string;
  ruleId?: string;
}

export interface BatchOperation {
  operationId: string;
  type: 'batch_update' | 'batch_delete';
  entityType: string;
  filters: Record<string, unknown>;
  data?: Record<string, unknown>;
  status: BatchOperationStatus;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  errors: string[];
  startedAt: Date;
  completedAt?: Date;
}

export interface ImportResult {
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errors: Array<{ row: number; message: string }>;
  warnings: Array<{ row: number; field: string; message: string }>;
}

export interface ExportOptions {
  format: 'csv' | 'json' | 'xlsx' | 'xml';
  fields?: string[];
  filters?: Record<string, unknown>;
  includeDeleted?: boolean;
  compression?: boolean;
}

export interface CRUDValidationConfig {
  entityName: string;
  entityType: string;
  validations: ValidationRule[];
  crossFieldValidations?: CrossFieldValidation[];
  enableOptimisticLocking: boolean;
  enableSoftDelete: boolean;
  enableAuditTrail: boolean;
  versionField?: string;
  deletedField?: string;
}

export interface CRUDOperations<T> {
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  read(id: string): Promise<T | null>;
  update(id: string, data: Partial<T>, version?: number): Promise<T>;
  delete(id: string, hard?: boolean): Promise<void>;
  list(options?: ListOptions): Promise<ListResult<T>>;
  count(filters?: Record<string, unknown>): Promise<number>;
  batchUpdate(ids: string[], data: Partial<T>): Promise<BatchOperation>;
  batchDelete(ids: string[], hard?: boolean): Promise<BatchOperation>;
  restore(id: string): Promise<T>;
}

export interface ListOptions {
  filters?: Record<string, unknown>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
}

export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ImportExportService {
  importData(
    entityType: string,
    data: Array<Record<string, unknown>>,
    options?: { skipDuplicates?: boolean; updateExisting?: boolean }
  ): Promise<ImportResult>;

  exportData(
    entityType: string,
    options: ExportOptions
  ): Promise<string | Buffer>;

  validateImportData(
    entityType: string,
    data: Array<Record<string, unknown>>
  ): Promise<ValidationResult>;
}

export interface AuditService {
  logOperation(entry: Omit<AuditEntry, 'auditId' | 'performedAt'>): Promise<AuditEntry>;
  getAuditHistory(entityType: string, entityId: string): Promise<AuditEntry[]>;
  getChanges(entityType: string, entityId: string, since?: Date): Promise<EntityChange[]>;
  revertToVersion(entityType: string, entityId: string, version: number): Promise<void>;
}

export interface ValidationService {
  validate(data: Record<string, unknown>, rules: ValidationRule[]): ValidationResult;
  validateCrossField(data: Record<string, unknown>, rules: CrossFieldValidation[]): ValidationResult;
  addRule(entityType: string, rule: ValidationRule): void;
  removeRule(entityType: string, ruleId: string): void;
  getRules(entityType: string): ValidationRule[];
}

export interface CRUDGenerator {
  generateOperations<T>(config: CRUDValidationConfig): CRUDOperations<T>;
  generateValidationRules<T>(fields: Record<keyof T, ValidationRuleConfig>): ValidationRule[];
  generateFromDatabaseModel(model: any): CRUDValidationConfig;
}

export interface ValidationRuleConfig {
  type: ValidationType;
  value?: unknown;
  message: string;
  severity?: 'error' | 'warning';
  when?: (data: Record<string, unknown>) => boolean;
}

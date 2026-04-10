/**
 * API Framework Types
 * Complete type definitions for REST API Framework
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type ValidationType = 'required' | 'email' | 'phone' | 'url' | 'minLength' | 'maxLength' | 'min' | 'max' | 'pattern' | 'enum' | 'unique' | 'compare' | 'custom';
export type OperationType = 'create' | 'read' | 'update' | 'delete' | 'list' | 'count' | 'batch_update' | 'batch_delete' | 'restore';
export type BatchOperationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';
export type ExportFormat = 'csv' | 'json' | 'xlsx' | 'xml';
export type SortOrder = 'asc' | 'desc';

export interface ValidationRule {
  ruleId: string;
  fieldName: string;
  validationType: ValidationType;
  value?: unknown;
  message: string;
  severity: 'error' | 'warning';
  customValidator?: (value: unknown, data: Record<string, unknown>) => boolean;
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
  format: ExportFormat;
  fields?: string[];
  filters?: Record<string, unknown>;
  includeDeleted?: boolean;
  compression?: boolean;
}

export interface APIRoute {
  method: HttpMethod;
  path: string;
  handler: string;
  middlewares?: string[];
}

export interface APIEndpoint {
  name: string;
  route: APIRoute;
  description?: string;
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

export interface CRUDOperations<T = unknown> {
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
  sortOrder?: SortOrder;
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
  exportData(entityType: string, options: ExportOptions): Promise<string | Buffer>;
  validateImportData(entityType: string, data: Array<Record<string, unknown>>): Promise<ValidationResult>;
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

export interface APIFrameworkConfig {
  basePath?: string;
  apiPrefix?: string;
  enableCors?: boolean;
  enableLogging?: boolean;
  timeout?: number;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T = unknown> extends APIResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface BatchResult {
  operationId: string;
  status: BatchOperationStatus;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  errors: string[];
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  version: string;
  uptime: number;
  checks: Record<string, unknown>;
}

export interface APIFramework {
  config: APIFrameworkConfig;
  generateOperations<T = unknown>(config: CRUDValidationConfig): CRUDOperations<T>;
  generateValidationRules<T = unknown>(fields: Record<keyof T, ValidationRuleConfig>): ValidationRule[];
  generateFromDatabaseModel(model: unknown): CRUDValidationConfig;
  getRegisteredEntities(): string[];
  getEndpoints(): APIEndpoint[];
}

export interface ValidationRuleConfig {
  type: ValidationType;
  value?: unknown;
  message: string;
  severity?: 'error' | 'warning';
  when?: (data: Record<string, unknown>) => boolean;
  customValidator?: (value: unknown, data: Record<string, unknown>) => boolean;
}

export interface EntityMetadata {
  entityType: string;
  entityName: string;
  createdAt: Date;
  updatedAt: Date;
  recordCount: number;
}

export interface FieldDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  required: boolean;
  defaultValue?: unknown;
  validationRules?: ValidationRule[];
  description?: string;
}

export interface SchemaDefinition {
  entityName: string;
  entityType: string;
  fields: FieldDefinition[];
  indexes?: string[];
  relationships?: RelationshipDefinition[];
}

export interface RelationshipDefinition {
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  targetEntity: string;
  foreignKey?: string;
  joinTable?: string;
}

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'startsWith' | 'endsWith';
  value: unknown;
}

export interface QueryOptions {
  filters?: QueryFilter[];
  sortBy?: string;
  sortOrder?: SortOrder;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
}

export interface BulkImportOptions {
  skipDuplicates?: boolean;
  updateExisting?: boolean;
  batchSize?: number;
  validateOnly?: boolean;
}

export interface BulkExportOptions {
  format: ExportFormat;
  fields?: string[];
  filters?: QueryFilter[];
  includeDeleted?: boolean;
  compression?: boolean;
}

/**
 * API Framework Implementation
 * Complete REST API Framework with CRUD, validation, audit trails, and import/export
 */

import crypto from 'crypto';
import {
  ValidationRule,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  CrossFieldValidation,
  OptimisticLock,
  AuditEntry,
  EntityChange,
  BatchOperation,
  ImportResult,
  CRUDValidationConfig,
  CRUDOperations,
  ListOptions,
  ListResult,
  SoftDeletable,
  APIFrameworkConfig,
  APIEndpoint,
  APIFramework,
  ValidationRuleConfig,
  BulkImportOptions,
  BulkExportOptions,
  FieldDefinition,
  SchemaDefinition,
  HealthCheckResult,
  EntityMetadata,
} from './types';

export class APIFrameworkImpl implements APIFramework {
  public config: APIFrameworkConfig;
  private storage: Map<string, Map<string, unknown>> = new Map();
  private auditLog: AuditEntry[] = [];
  private batchOperations: Map<string, BatchOperation> = new Map();
  private validationRules: Map<string, ValidationRule[]> = new Map();
  private crossFieldValidations: Map<string, CrossFieldValidation[]> = new Map();
  private entityConfigs: Map<string, CRUDValidationConfig> = new Map();
  private startTime: Date = new Date();

  constructor(config: APIFrameworkConfig = {}) {
    this.config = {
      basePath: config.basePath || '/api',
      apiPrefix: config.apiPrefix || 'v1',
      enableCors: config.enableCors ?? true,
      enableLogging: config.enableLogging ?? true,
      timeout: config.timeout || 30000,
    };
  }

  generateOperations<T = unknown>(config: CRUDValidationConfig): CRUDOperations<T> {
    this.entityConfigs.set(config.entityType, config);
    this.validationRules.set(config.entityType, config.validations);
    if (config.crossFieldValidations) {
      this.crossFieldValidations.set(config.entityType, config.crossFieldValidations);
    }
    if (!this.storage.has(config.entityType)) {
      this.storage.set(config.entityType, new Map());
    }

    return {
      create: (data) => this.create<T>(config.entityType, data),
      read: (id) => this.read<T>(config.entityType, id),
      update: (id, data, version) => this.update<T>(config.entityType, id, data, version),
      delete: (id, hard) => this.delete(config.entityType, id, hard),
      list: (options) => this.list<T>(config.entityType, options),
      count: (filters) => this.count(config.entityType, filters),
      batchUpdate: (ids, data) => this.batchUpdate<T>(config.entityType, ids, data),
      batchDelete: (ids, hard) => this.batchDelete(config.entityType, ids, hard),
      restore: (id) => this.restore<T>(config.entityType, id),
    };
  }

  generateValidationRules<T>(_fields: Record<keyof T, ValidationRuleConfig>): ValidationRule[] {
    const rules: ValidationRule[] = [];
    const fields = _fields as Record<string, ValidationRuleConfig>;
    for (const [fieldName, config] of Object.entries(fields)) {
      rules.push(this.createValidationRule(
        fieldName,
        config.type,
        config.message,
        config.value,
        config.severity,
        config.customValidator
      ));
    }
    return rules;
  }

  generateFromDatabaseModel(_model: unknown): CRUDValidationConfig {
    return {
      entityName: 'GeneratedEntity',
      entityType: 'generated_entities',
      validations: [],
      enableOptimisticLocking: true,
      enableSoftDelete: true,
      enableAuditTrail: true,
    };
  }

  getRegisteredEntities(): string[] {
    return Array.from(this.entityConfigs.keys());
  }

  getEndpoints(): APIEndpoint[] {
    const endpoints: APIEndpoint[] = [];
    for (const [entityType, config] of this.entityConfigs.entries()) {
      const basePath = `/${this.config.apiPrefix}/${entityType}`;
      endpoints.push(
        { name: `Create ${config.entityName}`, route: { method: 'POST', path: basePath, handler: 'create' }, description: `Create a new ${config.entityName}` },
        { name: `List ${config.entityName}`, route: { method: 'GET', path: basePath, handler: 'list' }, description: `List all ${config.entityName}` },
        { name: `Get ${config.entityName}`, route: { method: 'GET', path: `${basePath}/:id`, handler: 'read' }, description: `Get a ${config.entityName} by ID` },
        { name: `Update ${config.entityName}`, route: { method: 'PUT', path: `${basePath}/:id`, handler: 'update' }, description: `Update a ${config.entityName}` },
        { name: `Delete ${config.entityName}`, route: { method: 'DELETE', path: `${basePath}/:id`, handler: 'delete' }, description: `Delete a ${config.entityName}` },
        { name: `Restore ${config.entityName}`, route: { method: 'POST', path: `${basePath}/:id/restore`, handler: 'restore' }, description: `Restore a deleted ${config.entityName}` },
        { name: `Batch Update ${config.entityName}`, route: { method: 'PUT', path: `${basePath}/batch`, handler: 'batchUpdate' }, description: `Batch update ${config.entityName}` },
        { name: `Batch Delete ${config.entityName}`, route: { method: 'DELETE', path: `${basePath}/batch`, handler: 'batchDelete' }, description: `Batch delete ${config.entityName}` },
        { name: `Count ${config.entityName}`, route: { method: 'GET', path: `${basePath}/count`, handler: 'count' }, description: `Count ${config.entityName}` },
        { name: `Export ${config.entityName}`, route: { method: 'GET', path: `${basePath}/export`, handler: 'export' }, description: `Export ${config.entityName} data` },
        { name: `Import ${config.entityName}`, route: { method: 'POST', path: `${basePath}/import`, handler: 'import' }, description: `Import ${config.entityName} data` }
      );
    }
    return endpoints;
  }

  private async create<T>(entityType: string, data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const config = this.entityConfigs.get(entityType);
    if (!config) throw new Error(`Entity type ${entityType} not registered`);

    const id = this.generateId();
    const now = new Date();

    const entity = {
      ...(data as Record<string, unknown>),
      id,
    };

    (entity as Record<string, unknown>).createdAt = now;
    (entity as Record<string, unknown>).updatedAt = now;

    if (config.enableOptimisticLocking) {
      (entity as Record<string, unknown>)._optimisticLock = {
        version: 1,
        lastModifiedAt: now,
      } as OptimisticLock;
    }

    if (config.enableSoftDelete) {
      (entity as Record<string, unknown>)._softDelete = {
        isDeleted: false,
      } as SoftDeletable;
    }

    const validationResult = this.validate(entity, entityType);
    if (!validationResult.isValid) {
      throw new Error(`Validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`);
    }

    const entityStorage = this.storage.get(entityType)!;
    entityStorage.set(id, entity);

    if (config.enableAuditTrail) {
      await this.logOperation({
        entityType,
        entityId: id,
        operation: 'create',
        changes: [],
      });
    }

    return this.removeInternalFields<T>(entity);
  }

  private async read<T>(entityType: string, id: string): Promise<T | null> {
    const config = this.entityConfigs.get(entityType);
    if (!config) throw new Error(`Entity type ${entityType} not registered`);

    const entityStorage = this.storage.get(entityType);
    if (!entityStorage) return null;

    const entity = entityStorage.get(id) as Record<string, unknown> | undefined;
    if (!entity) return null;

    if (config.enableSoftDelete && (entity._softDelete as SoftDeletable | undefined)?.isDeleted) {
      return null;
    }

    return this.removeInternalFields<T>(entity);
  }

  private async update<T>(entityType: string, id: string, data: Partial<T>, version?: number): Promise<T> {
    const config = this.entityConfigs.get(entityType);
    if (!config) throw new Error(`Entity type ${entityType} not registered`);

    const entityStorage = this.storage.get(entityType);
    if (!entityStorage) throw new Error(`Entity ${id} not found`);

    const entity = entityStorage.get(id) as Record<string, unknown>;
    if (!entity) throw new Error(`Entity ${id} not found`);

    if (config.enableSoftDelete && (entity._softDelete as SoftDeletable | undefined)?.isDeleted) {
      throw new Error(`Entity ${id} is deleted`);
    }

    if (config.enableOptimisticLocking && version !== undefined) {
      const optimisticLock = entity._optimisticLock as OptimisticLock | undefined;
      if (optimisticLock && optimisticLock.version !== version) {
        throw new Error(`Version conflict: expected ${version}, got ${optimisticLock.version}`);
      }
    }

    const now = new Date();
    const changes: EntityChange[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id' && key !== 'createdAt' && entity[key] !== value) {
        changes.push({
          changeId: this.generateId('ch'),
          fieldName: key,
          oldValue: entity[key],
          newValue: value,
          changedAt: now,
        });
        entity[key] = value;
      }
    }

    entity.updatedAt = now;

    if (config.enableOptimisticLocking && entity._optimisticLock) {
      const optimisticLock = entity._optimisticLock as OptimisticLock;
      optimisticLock.version++;
      optimisticLock.lastModifiedAt = now;
    }

    const validationResult = this.validate(entity, entityType);
    if (!validationResult.isValid) {
      throw new Error(`Validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`);
    }

    entityStorage.set(id, entity);

    if (config.enableAuditTrail && changes.length > 0) {
      await this.logOperation({
        entityType,
        entityId: id,
        operation: 'update',
        changes,
      });
    }

    return this.removeInternalFields<T>(entity);
  }

  private async delete(entityType: string, id: string, hard: boolean = false): Promise<void> {
    const config = this.entityConfigs.get(entityType);
    if (!config) throw new Error(`Entity type ${entityType} not registered`);

    const entityStorage = this.storage.get(entityType);
    if (!entityStorage) throw new Error(`Entity ${id} not found`);

    const entity = entityStorage.get(id) as Record<string, unknown>;
    if (!entity) throw new Error(`Entity ${id} not found`);

    if (config.enableSoftDelete && !hard) {
      (entity._softDelete as SoftDeletable) = {
        isDeleted: true,
        deletedAt: new Date(),
      };
      entityStorage.set(id, entity);

      if (config.enableAuditTrail) {
        await this.logOperation({
          entityType,
          entityId: id,
          operation: 'delete',
          changes: [],
        });
      }
    } else {
      entityStorage.delete(id);

      if (config.enableAuditTrail) {
        await this.logOperation({
          entityType,
          entityId: id,
          operation: 'delete',
          changes: [],
        });
      }
    }
  }

  private async list<T>(entityType: string, options?: ListOptions): Promise<ListResult<T>> {
    const config = this.entityConfigs.get(entityType);
    if (!config) throw new Error(`Entity type ${entityType} not registered`);

    const entityStorage = this.storage.get(entityType);
    if (!entityStorage) {
      return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
    }

    let items = Array.from(entityStorage.values()) as Record<string, unknown>[];

    if (!options?.includeDeleted && config.enableSoftDelete) {
      items = items.filter((item) => !(item._softDelete as SoftDeletable | undefined)?.isDeleted);
    }

    if (options?.filters) {
      items = items.filter((item) => {
        for (const [key, value] of Object.entries(options.filters!)) {
          if (item[key] !== value) return false;
        }
        return true;
      });
    }

    if (options?.sortBy) {
      const sortKey = options.sortBy;
      const sortOrder = options.sortOrder || 'asc';
      items.sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (aVal === bVal) return 0;
        if (aVal == null) return sortOrder === 'asc' ? 1 : -1;
        if (bVal == null) return sortOrder === 'asc' ? -1 : 1;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return 0;
      });
    }

    const total = items.length;
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const start = (page - 1) * pageSize;
    const paginatedItems = items.slice(start, start + pageSize);

    return {
      items: paginatedItems.map((item) => this.removeInternalFields<T>(item)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private async count(entityType: string, filters?: Record<string, unknown>): Promise<number> {
    const config = this.entityConfigs.get(entityType);
    if (!config) throw new Error(`Entity type ${entityType} not registered`);

    const entityStorage = this.storage.get(entityType);
    if (!entityStorage) return 0;

    let items = Array.from(entityStorage.values()) as Record<string, unknown>[];

    if (!config.enableSoftDelete) {
      items = items.filter((item) => !(item._softDelete as SoftDeletable | undefined)?.isDeleted);
    }

    if (filters) {
      items = items.filter((item) => {
        for (const [key, value] of Object.entries(filters)) {
          if (item[key] !== value) return false;
        }
        return true;
      });
    }

    return items.length;
  }

  private async batchUpdate<T>(entityType: string, ids: string[], data: Partial<T>): Promise<BatchOperation> {
    const operationId = this.generateId('batch');
    const operation: BatchOperation = {
      operationId,
      type: 'batch_update',
      entityType,
      filters: { id: { $in: ids } },
      data: data as Record<string, unknown>,
      status: 'pending',
      totalItems: ids.length,
      processedItems: 0,
      failedItems: 0,
      errors: [],
      startedAt: new Date(),
    };

    this.batchOperations.set(operationId, operation);

    try {
      operation.status = 'in_progress';

      for (const id of ids) {
        try {
          await this.update<T>(entityType, id, data);
          operation.processedItems++;
        } catch (error) {
          operation.failedItems++;
          operation.errors.push(`Failed to update ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      operation.status = operation.failedItems === 0 ? 'completed' : operation.processedItems > 0 ? 'partial' : 'failed';
      operation.completedAt = new Date();
    } catch (error) {
      operation.status = 'failed';
      operation.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    this.batchOperations.set(operationId, operation);
    return operation;
  }

  private async batchDelete(entityType: string, ids: string[], hard: boolean = false): Promise<BatchOperation> {
    const operationId = this.generateId('batch');
    const operation: BatchOperation = {
      operationId,
      type: 'batch_delete',
      entityType,
      filters: { id: { $in: ids } },
      status: 'pending',
      totalItems: ids.length,
      processedItems: 0,
      failedItems: 0,
      errors: [],
      startedAt: new Date(),
    };

    this.batchOperations.set(operationId, operation);

    try {
      operation.status = 'in_progress';

      for (const id of ids) {
        try {
          await this.delete(entityType, id, hard);
          operation.processedItems++;
        } catch (error) {
          operation.failedItems++;
          operation.errors.push(`Failed to delete ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      operation.status = operation.failedItems === 0 ? 'completed' : operation.processedItems > 0 ? 'partial' : 'failed';
      operation.completedAt = new Date();
    } catch (error) {
      operation.status = 'failed';
      operation.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    this.batchOperations.set(operationId, operation);
    return operation;
  }

  private async restore<T>(entityType: string, id: string): Promise<T> {
    const config = this.entityConfigs.get(entityType);
    if (!config) throw new Error(`Entity type ${entityType} not registered`);

    if (!config.enableSoftDelete) {
      throw new Error('Soft delete is not enabled');
    }

    const entityStorage = this.storage.get(entityType);
    if (!entityStorage) throw new Error(`Entity ${id} not found`);

    const entity = entityStorage.get(id) as Record<string, unknown>;
    if (!entity) throw new Error(`Entity ${id} not found`);

    if (!(entity._softDelete as SoftDeletable | undefined)?.isDeleted) {
      throw new Error(`Entity ${id} is not deleted`);
    }

    (entity._softDelete as SoftDeletable) = {
      isDeleted: false,
    };
    entity.updatedAt = new Date();

    entityStorage.set(id, entity);

    if (config.enableAuditTrail) {
      await this.logOperation({
        entityType,
        entityId: id,
        operation: 'restore',
        changes: [],
      });
    }

    return this.removeInternalFields<T>(entity);
  }

  validate(data: Record<string, unknown>, entityType: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const rules = this.validationRules.get(entityType) || [];

    for (const rule of rules) {
      const value = data[rule.fieldName];

      if (value === undefined || value === null) {
        continue;
      }

      let isValid = true;

      switch (rule.validationType) {
        case 'required':
          isValid = value !== undefined && value !== null && value !== '';
          break;
        case 'email':
          isValid = typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
          break;
        case 'phone':
          isValid = typeof value === 'string' && /^[\d\s\-\+\(\)]+$/.test(value);
          break;
        case 'url':
          isValid = typeof value === 'string' && /^https?:\/\/.+/.test(value);
          break;
        case 'minLength':
          isValid = typeof value === 'string' && value.length >= (rule.value as number);
          break;
        case 'maxLength':
          isValid = typeof value === 'string' && value.length <= (rule.value as number);
          break;
        case 'min':
          isValid = typeof value === 'number' && value >= (rule.value as number);
          break;
        case 'max':
          isValid = typeof value === 'number' && value <= (rule.value as number);
          break;
        case 'pattern':
          if (typeof value === 'string') {
            isValid = new RegExp(rule.value as string).test(value);
          }
          break;
        case 'enum':
          isValid = Array.isArray(rule.value) && rule.value.includes(value);
          break;
        case 'unique':
          isValid = this.isUniqueValue(entityType, rule.fieldName, value, data['id'] as string);
          break;
        case 'custom':
          if (rule.customValidator) {
            isValid = rule.customValidator(value, data);
          }
          break;
      }

      if (!isValid) {
        if (rule.severity === 'warning') {
          warnings.push({ fieldName: rule.fieldName, message: rule.message, ruleId: rule.ruleId });
        } else {
          errors.push({ fieldName: rule.fieldName, message: rule.message, ruleId: rule.ruleId });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateCrossField(data: Record<string, unknown>, entityType: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const rules = this.crossFieldValidations.get(entityType) || [];

    for (const rule of rules) {
      try {
        if (!rule.validator(data)) {
          errors.push({ fieldName: rule.fields.join(', '), message: rule.message, ruleId: rule.validationId });
        }
      } catch (error) {
        warnings.push({
          fieldName: rule.fields.join(', '),
          message: `Validation error: ${error instanceof Error ? error.message : 'Unknown'}`,
          ruleId: rule.validationId,
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async importData(
    entityType: string,
    data: Array<Record<string, unknown>>,
    options?: BulkImportOptions
  ): Promise<ImportResult> {
    const result: ImportResult = {
      totalRows: data.length,
      successfulRows: 0,
      failedRows: 0,
      errors: [],
      warnings: [],
    };

    const batchSize = options?.batchSize || 100;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);

      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const rowIndex = i + j;
        const validation = this.validate(row, entityType);

        if (!validation.isValid) {
          result.failedRows++;
          result.errors.push({
            row: rowIndex + 1,
            message: validation.errors.map((e) => e.message).join(', '),
          });
          continue;
        }

        try {
          const entityStorage = this.storage.get(entityType);
          if (!entityStorage) {
            throw new Error(`Entity type ${entityType} not registered`);
          }

          if (options?.skipDuplicates) {
            const existing = this.findByFields(entityType, row);
            if (existing) {
              continue;
            }
          } else if (options?.updateExisting) {
            const uniqueFieldMatch = ['email', 'id', 'name'].find(field => field in row);
            const existing = this.findByFields(entityType, row, uniqueFieldMatch ? [uniqueFieldMatch] : undefined);
            if (existing) {
              await this.update(entityType, existing.id as string, row as Partial<unknown>);
              result.successfulRows++;
              continue;
            }
          }

          await this.create(entityType, row as Omit<unknown, 'id' | 'createdAt' | 'updatedAt'>);
          result.successfulRows++;
        } catch (error) {
          result.failedRows++;
          result.errors.push({
            row: rowIndex + 1,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return result;
  }

  async exportData(entityType: string, options: BulkExportOptions): Promise<string | Buffer> {
    const entityStorage = this.storage.get(entityType);
    if (!entityStorage) {
      throw new Error(`Entity type ${entityType} not registered`);
    }

    let items = Array.from(entityStorage.values()) as Record<string, unknown>[];

    if (!options.includeDeleted) {
      items = items.filter((item) => !(item._softDelete as SoftDeletable | undefined)?.isDeleted);
    }

    if (options.filters && options.filters.length > 0) {
      items = items.filter((item) => {
        return options.filters!.every((filter) => {
          const value = item[filter.field];
          switch (filter.operator) {
            case 'eq': return value === filter.value;
            case 'ne': return value !== filter.value;
            case 'gt': return typeof value === 'number' && value > (filter.value as number);
            case 'gte': return typeof value === 'number' && value >= (filter.value as number);
            case 'lt': return typeof value === 'number' && value < (filter.value as number);
            case 'lte': return typeof value === 'number' && value <= (filter.value as number);
            case 'in': return Array.isArray(filter.value) && filter.value.includes(value);
            case 'nin': return Array.isArray(filter.value) && !filter.value.includes(value);
            case 'contains': return typeof value === 'string' && value.includes(filter.value as string);
            case 'startsWith': return typeof value === 'string' && value.startsWith(filter.value as string);
            case 'endsWith': return typeof value === 'string' && value.endsWith(filter.value as string);
            default: return true;
          }
        });
      });
    }

    if (options.fields && options.fields.length > 0) {
      items = items.map((item) => {
        const filtered: Record<string, unknown> = {};
        for (const field of options.fields!) {
          filtered[field] = item[field];
        }
        return filtered;
      });
    }

    switch (options.format) {
      case 'csv':
        return this.convertToCSV(items);
      case 'json':
        return JSON.stringify(items, null, 2);
      case 'xml':
        return this.convertToXML(entityType, items);
      default:
        return JSON.stringify(items, null, 2);
    }
  }

  async logOperation(entry: Omit<AuditEntry, 'auditId' | 'performedAt'>): Promise<AuditEntry> {
    const fullEntry: AuditEntry = {
      ...entry,
      auditId: this.generateId('audit'),
      performedAt: new Date(),
    };
    this.auditLog.push(fullEntry);
    return fullEntry;
  }

  getAuditHistory(entityType: string, entityId: string): AuditEntry[] {
    return this.auditLog.filter((entry) => entry.entityType === entityType && entry.entityId === entityId);
  }

  getChanges(entityType: string, entityId: string, since?: Date): EntityChange[] {
    const history = this.getAuditHistory(entityType, entityId);
    const changes: EntityChange[] = [];

    for (const entry of history) {
      if (since && entry.performedAt < since) continue;
      changes.push(...entry.changes);
    }

    return changes;
  }

  async revertToVersion(entityType: string, entityId: string, version: number): Promise<void> {
    const changes = this.getChanges(entityType, entityId);
    const entityStorage = this.storage.get(entityType);
    if (!entityStorage) throw new Error(`Entity type ${entityType} not registered`);

    const entity = entityStorage.get(entityId) as Record<string, unknown>;
    if (!entity) throw new Error(`Entity ${entityId} not found`);

    const versionChanges = changes.filter((c) => {
      const changeVersion = c.changeId.split('_')[0];
      return parseInt(changeVersion, 10) <= version;
    });

    const reverseChanges: EntityChange[] = [];
    for (const change of versionChanges.reverse()) {
      reverseChanges.push({
        changeId: this.generateId('rev'),
        fieldName: change.fieldName,
        oldValue: change.newValue,
        newValue: change.oldValue,
        changedAt: new Date(),
      });
      entity[change.fieldName] = change.oldValue;
    }

    entityStorage.set(entityId, entity);

    await this.logOperation({
      entityType,
      entityId,
      operation: 'update',
      changes: reverseChanges,
    });
  }

  private generateId(prefix: string = 'id'): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private removeInternalFields<T>(entity: Record<string, unknown>): T {
    const clean: Record<string, unknown> = { ...entity };
    delete clean._optimisticLock;
    delete clean._softDelete;
    return clean as T;
  }

  private isUniqueValue(entityType: string, fieldName: string, value: unknown, excludeId?: string): boolean {
    const entityStorage = this.storage.get(entityType);
    if (!entityStorage) return true;

    for (const [id, entity] of entityStorage.entries()) {
      if (excludeId && id === excludeId) continue;
      if ((entity as Record<string, unknown>)[fieldName] === value) {
        return false;
      }
    }

    return true;
  }

  private findByFields(entityType: string, data: Record<string, unknown>, matchFields?: string[]): Record<string, unknown> | null {
    const entityStorage = this.storage.get(entityType);
    if (!entityStorage) return null;

    const fieldsToMatch = matchFields || Object.keys(data);

    for (const entity of entityStorage.values()) {
      let matches = true;
      for (const key of fieldsToMatch) {
        const value = data[key];
        if ((entity as Record<string, unknown>)[key] !== value) {
          matches = false;
          break;
        }
      }
      if (matches) return entity as Record<string, unknown>;
    }
    return null;
  }

  private convertToCSV(items: Record<string, unknown>[]): string {
    if (items.length === 0) return '';

    const headers = Object.keys(items[0]);
    const rows = items.map((item) =>
      headers.map((h) => {
        const value = item[h];
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value ?? '');
      }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  private convertToXML(entityType: string, items: Record<string, unknown>[]): string {
    const rows = items.map((item) => {
      const fields = Object.entries(item)
        .map(([key, value]) => `    <${key}>${this.escapeXML(String(value ?? ''))}</${key}>`)
        .join('\n');
      return `  <${entityType.slice(0, -1)}>\n${fields}\n  </${entityType.slice(0, -1)}>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>\n<${entityType}>\n${rows.join('\n')}\n</${entityType}>`;
  }

  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  createValidationRule(
    fieldName: string,
    type: ValidationRule['validationType'],
    message: string,
    value?: unknown,
    severity: 'error' | 'warning' = 'error',
    customValidator?: (value: unknown, data: Record<string, unknown>) => boolean
  ): ValidationRule {
    return {
      ruleId: crypto.randomBytes(4).toString('hex'),
      fieldName,
      validationType: type,
      message,
      value,
      severity,
      customValidator,
    };
  }

  createSchema(entityName: string, entityType: string, fields: FieldDefinition[]): SchemaDefinition {
    return {
      entityName,
      entityType,
      fields,
    };
  }

  getEntityMetadata(entityType: string): EntityMetadata | null {
    const config = this.entityConfigs.get(entityType);
    const entityStorage = this.storage.get(entityType);

    if (!config) return null;

    const items = entityStorage ? Array.from(entityStorage.values()) : [];
    const now = new Date();
    let earliest: Date = now;
    let latest: Date = new Date(0);

    for (const item of items) {
      const record = item as Record<string, unknown>;
      if (record.createdAt instanceof Date) {
        if (record.createdAt < earliest) earliest = record.createdAt;
        if (record.createdAt > latest) latest = record.createdAt;
      }
    }

    return {
      entityType,
      entityName: config.entityName,
      createdAt: earliest,
      updatedAt: latest,
      recordCount: items.length,
    };
  }

  healthCheck(): HealthCheckResult {
    const now = new Date();
    return {
      status: 'healthy',
      timestamp: now,
      version: '1.0.0',
      uptime: now.getTime() - this.startTime.getTime(),
      checks: {
        storage: this.storage.size > 0 ? 'ok' : 'empty',
        entities: this.entityConfigs.size,
        auditEntries: this.auditLog.length,
      },
    };
  }

  clear(): void {
    this.storage.clear();
    this.auditLog = [];
    this.batchOperations.clear();
  }
}

export function createAPIFramework(config?: APIFrameworkConfig): APIFramework {
  return new APIFrameworkImpl(config);
}

export function createValidationRules() {
  return {
    required: (fieldName: string) =>
      createValidationRuleFn(fieldName, 'required', `${fieldName} is required`),
    email: (fieldName: string) =>
      createValidationRuleFn(fieldName, 'email', `Invalid email format for ${fieldName}`),
    phone: (fieldName: string) =>
      createValidationRuleFn(fieldName, 'phone', `Invalid phone format for ${fieldName}`),
    url: (fieldName: string) =>
      createValidationRuleFn(fieldName, 'url', `Invalid URL format for ${fieldName}`),
    minLength: (fieldName: string, min: number) =>
      createValidationRuleFn(fieldName, 'minLength', `${fieldName} must be at least ${min} characters`, min),
    maxLength: (fieldName: string, max: number) =>
      createValidationRuleFn(fieldName, 'maxLength', `${fieldName} must be at most ${max} characters`, max),
    min: (fieldName: string, min: number) =>
      createValidationRuleFn(fieldName, 'min', `${fieldName} must be at least ${min}`, min),
    max: (fieldName: string, max: number) =>
      createValidationRuleFn(fieldName, 'max', `${fieldName} must be at most ${max}`, max),
    pattern: (fieldName: string, regex: string, message?: string) =>
      createValidationRuleFn(fieldName, 'pattern', message || `Invalid format for ${fieldName}`, regex),
    enum: (fieldName: string, values: string[]) =>
      createValidationRuleFn(fieldName, 'enum', `${fieldName} must be one of: ${values.join(', ')}`, values),
    unique: (fieldName: string) =>
      createValidationRuleFn(fieldName, 'unique', `${fieldName} must be unique`),
    custom: (fieldName: string, validator: (value: unknown, data: Record<string, unknown>) => boolean, message: string) =>
      createValidationRuleFn(fieldName, 'custom', message, undefined, 'error', validator),
  };
}

function createValidationRuleFn(
  fieldName: string,
  type: ValidationRule['validationType'],
  message: string,
  value?: unknown,
  severity: 'error' | 'warning' = 'error',
  customValidator?: (value: unknown, data: Record<string, unknown>) => boolean
): ValidationRule {
  return {
    ruleId: crypto.randomBytes(4).toString('hex'),
    fieldName,
    validationType: type,
    message,
    value,
    severity,
    customValidator,
  };
}

export class APIManus {
  private framework: APIFramework;

  constructor(config?: APIFrameworkConfig) {
    this.framework = createAPIFramework(config);
  }

  createGenerator<T extends { id: string }>(entityName: string, entityType: string, options?: {
    enableOptimisticLocking?: boolean;
    enableSoftDelete?: boolean;
    enableAuditTrail?: boolean;
    validations?: ValidationRule[];
  }) {
    return this.framework.generateOperations<T>({
      entityName,
      entityType,
      validations: options?.validations || [],
      crossFieldValidations: [],
      enableOptimisticLocking: options?.enableOptimisticLocking ?? true,
      enableSoftDelete: options?.enableSoftDelete ?? true,
      enableAuditTrail: options?.enableAuditTrail ?? true,
    });
  }

  createUserCRUD() {
    const validations = [
      createValidationRules().required('email'),
      createValidationRules().email('email'),
      createValidationRules().required('name'),
      createValidationRules().minLength('name', 2),
      createValidationRules().maxLength('name', 100),
      createValidationRules().unique('email'),
    ];
    return this.createGenerator('User', 'users', { validations });
  }

  createProductCRUD() {
    const validations = [
      createValidationRules().required('name'),
      createValidationRules().minLength('name', 3),
      createValidationRules().required('price'),
      createValidationRules().min('price', 0),
      createValidationRules().maxLength('name', 200),
      createValidationRules().enum('status', ['draft', 'active', 'archived']),
    ];
    return this.createGenerator('Product', 'products', { validations });
  }

  createOrderCRUD() {
    const validations = [
      createValidationRules().required('customerId'),
      createValidationRules().required('total'),
      createValidationRules().min('total', 0),
      createValidationRules().enum('status', ['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
    ];
    return this.createGenerator('Order', 'orders', {
      validations,
      enableOptimisticLocking: true,
      enableSoftDelete: true,
      enableAuditTrail: true,
    });
  }

  getFramework(): APIFramework {
    return this.framework;
  }
}

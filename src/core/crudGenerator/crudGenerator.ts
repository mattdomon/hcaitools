/**
 * CRUD Generator Implementation
 * Complete CRUD operations with validation, optimistic locking, and audit trails
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
  ExportOptions,
  CRUDValidationConfig,
  CRUDOperations,
  ListOptions,
  ListResult,
  SoftDeletable,
  ValidationRuleConfig,
} from './types';

export class CRUDGenerator<T extends { id: string }> implements CRUDOperations<T> {
  private config: CRUDValidationConfig;
  private storage: Map<string, T & { _optimisticLock?: OptimisticLock; _softDelete?: SoftDeletable }> = new Map();
  private auditLog: AuditEntry[] = [];
  private batchOperations: Map<string, BatchOperation> = new Map();
  private validationRules: Map<string, ValidationRule[]> = new Map();

  constructor(config: CRUDValidationConfig) {
    this.config = config;
    this.validationRules.set(config.entityType, config.validations);
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const id = this.generateId();
    const now = new Date();

    const entity: T & { _optimisticLock?: OptimisticLock; _softDelete?: SoftDeletable } = {
      ...(data as T),
      id,
    } as T & { _optimisticLock?: OptimisticLock; _softDelete?: SoftDeletable };

    // Add timestamps
    (entity as any).createdAt = now;
    (entity as any).updatedAt = now;

    // Add optimistic locking
    if (this.config.enableOptimisticLocking) {
      entity._optimisticLock = {
        version: 1,
        lastModifiedAt: now,
      };
    }

    // Add soft delete
    if (this.config.enableSoftDelete) {
      entity._softDelete = {
        isDeleted: false,
      };
    }

    // Validate before creating
    const validationResult = this.validate(entity as unknown as Record<string, unknown>);
    if (!validationResult.isValid) {
      throw new Error(`Validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`);
    }

    this.storage.set(id, entity);

    // Log audit
    if (this.config.enableAuditTrail) {
      await this.logOperation({
        entityType: this.config.entityType,
        entityId: id,
        operation: 'create',
        changes: [],
      });
    }

    return this.removeInternalFields(entity);
  }

  async read(id: string): Promise<T | null> {
    const entity = this.storage.get(id);

    if (!entity) {
      return null;
    }

    // Check soft delete
    if (this.config.enableSoftDelete && entity._softDelete?.isDeleted) {
      return null;
    }

    return this.removeInternalFields(entity);
  }

  async update(id: string, data: Partial<T>, version?: number): Promise<T> {
    const entity = this.storage.get(id);

    if (!entity) {
      throw new Error(`Entity ${id} not found`);
    }

    // Check soft delete
    if (this.config.enableSoftDelete && entity._softDelete?.isDeleted) {
      throw new Error(`Entity ${id} is deleted`);
    }

    // Optimistic locking check
    if (this.config.enableOptimisticLocking && version !== undefined) {
      const currentVersion = entity._optimisticLock?.version;
      if (currentVersion !== version) {
        throw new Error(`Version conflict: expected ${version}, got ${currentVersion}`);
      }
    }

    const now = new Date();
    const changes: EntityChange[] = [];

    // Track changes
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id' && key !== 'createdAt' && entity[key as keyof T] !== value) {
        changes.push({
          changeId: this.generateId('ch'),
          fieldName: key,
          oldValue: entity[key as keyof T],
          newValue: value,
          changedAt: now,
        });
      }
    }

    // Update entity
    const updated = {
      ...entity,
      ...data,
      id, // Ensure ID doesn't change
      updatedAt: now,
    } as T & { _optimisticLock?: OptimisticLock; _softDelete?: SoftDeletable };

    // Increment version
    if (this.config.enableOptimisticLocking && updated._optimisticLock) {
      updated._optimisticLock.version++;
      updated._optimisticLock.lastModifiedAt = now;
    }

    // Validate before updating
    const validationResult = this.validate(updated as unknown as Record<string, unknown>);
    if (!validationResult.isValid) {
      throw new Error(`Validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`);
    }

    this.storage.set(id, updated);

    // Log audit
    if (this.config.enableAuditTrail && changes.length > 0) {
      await this.logOperation({
        entityType: this.config.entityType,
        entityId: id,
        operation: 'update',
        changes,
      });
    }

    return this.removeInternalFields(updated);
  }

  async delete(id: string, hard: boolean = false): Promise<void> {
    const entity = this.storage.get(id);

    if (!entity) {
      throw new Error(`Entity ${id} not found`);
    }

    if (this.config.enableSoftDelete && !hard) {
      // Soft delete
      entity._softDelete = {
        isDeleted: true,
        deletedAt: new Date(),
      };
      this.storage.set(id, entity);

      if (this.config.enableAuditTrail) {
        await this.logOperation({
          entityType: this.config.entityType,
          entityId: id,
          operation: 'delete',
          changes: [],
        });
      }
    } else {
      // Hard delete
      this.storage.delete(id);

      if (this.config.enableAuditTrail) {
        await this.logOperation({
          entityType: this.config.entityType,
          entityId: id,
          operation: 'delete',
          changes: [],
        });
      }
    }
  }

  async list(options?: ListOptions): Promise<ListResult<T>> {
    let items = Array.from(this.storage.values()) as T[];

    // Filter out deleted if not including
    if (!options?.includeDeleted && this.config.enableSoftDelete) {
      items = items.filter((item) => !(item as any)._softDelete?.isDeleted);
    }

    // Apply filters
    if (options?.filters) {
      items = items.filter((item) => {
        for (const [key, value] of Object.entries(options.filters!)) {
          if ((item as any)[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    // Sort
    if (options?.sortBy) {
      const sortKey = options.sortBy;
      const sortOrder = options.sortOrder || 'asc';
      items.sort((a, b) => {
        const aVal = (a as any)[sortKey];
        const bVal = (b as any)[sortKey];
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    const total = items.length;

    // Pagination
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const start = (page - 1) * pageSize;
    const paginatedItems = items.slice(start, start + pageSize);

    return {
      items: paginatedItems.map((item) => this.removeInternalFields(item)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async count(filters?: Record<string, unknown>): Promise<number> {
    let items = Array.from(this.storage.values()) as T[];

    if (!this.config.enableSoftDelete) {
      items = items.filter((item) => !(item as any)._softDelete?.isDeleted);
    }

    if (filters) {
      items = items.filter((item) => {
        for (const [key, value] of Object.entries(filters)) {
          if ((item as any)[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    return items.length;
  }

  async batchUpdate(ids: string[], data: Partial<T>): Promise<BatchOperation> {
    const operationId = this.generateId('batch');
    const operation: BatchOperation = {
      operationId,
      type: 'batch_update',
      entityType: this.config.entityType,
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
          await this.update(id, data);
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

  async batchDelete(ids: string[], hard: boolean = false): Promise<BatchOperation> {
    const operationId = this.generateId('batch');
    const operation: BatchOperation = {
      operationId,
      type: 'batch_delete',
      entityType: this.config.entityType,
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
          await this.delete(id, hard);
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

  async restore(id: string): Promise<T> {
    const entity = this.storage.get(id);

    if (!entity) {
      throw new Error(`Entity ${id} not found`);
    }

    if (!this.config.enableSoftDelete) {
      throw new Error('Soft delete is not enabled');
    }

    if (!entity._softDelete?.isDeleted) {
      throw new Error(`Entity ${id} is not deleted`);
    }

    entity._softDelete = {
      isDeleted: false,
    };
    (entity as any).updatedAt = new Date();

    this.storage.set(id, entity);

    if (this.config.enableAuditTrail) {
      await this.logOperation({
        entityType: this.config.entityType,
        entityId: id,
        operation: 'restore',
        changes: [],
      });
    }

    return this.removeInternalFields(entity);
  }

  // Validation
  validate(data: Record<string, unknown>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const rules = this.validationRules.get(this.config.entityType) || [];

    for (const rule of rules) {
      const value = data[rule.fieldName];
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
          isValid = value === undefined || value === null || (typeof value === 'number' && value >= (rule.value as number));
          break;
        case 'max':
          isValid = value === undefined || value === null || (typeof value === 'number' && value <= (rule.value as number));
          break;
        case 'pattern':
          isValid = value === undefined || value === null || (typeof value === 'string' && new RegExp(rule.value as string).test(value));
          break;
        case 'enum':
          isValid = value === undefined || value === null || (Array.isArray(rule.value) && rule.value.includes(value));
          break;
        case 'unique':
          isValid = this.isUniqueValue(this.config.entityType, rule.fieldName, value, data['id'] as string);
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

  // Cross-field validation
  validateCrossField(data: Record<string, unknown>, rules: CrossFieldValidation[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

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

  // Audit log
  async logOperation(entry: Omit<AuditEntry, 'auditId' | 'performedAt'>): Promise<AuditEntry> {
    const fullEntry: AuditEntry = {
      ...entry,
      auditId: this.generateId('audit'),
      performedAt: new Date(),
    };
    this.auditLog.push(fullEntry);
    return fullEntry;
  }

  getAuditHistory(entityId: string): AuditEntry[] {
    return this.auditLog.filter((entry) => entry.entityId === entityId);
  }

  // Import/Export
  async importData(
    data: Array<Record<string, unknown>>,
    options?: { skipDuplicates?: boolean; updateExisting?: boolean }
  ): Promise<ImportResult> {
    const result: ImportResult = {
      totalRows: data.length,
      successfulRows: 0,
      failedRows: 0,
      errors: [],
      warnings: [],
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const validation = this.validate(row);

      if (!validation.isValid) {
        result.failedRows++;
        result.errors.push({
          row: i + 1,
          message: validation.errors.map((e) => e.message).join(', '),
        });
        continue;
      }

      try {
        // Check for duplicates if needed
        if (options?.skipDuplicates || options?.updateExisting) {
          const existing = await this.findByFields(row);
          if (existing) {
            if (options.updateExisting) {
              await this.update(existing.id, row as Partial<T>);
            }
            result.successfulRows++;
            continue;
          }
        }

        await this.create(row as any);
        result.successfulRows++;
      } catch (error) {
        result.failedRows++;
        result.errors.push({
          row: i + 1,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  async exportData(options: ExportOptions): Promise<string> {
    const items = Array.from(this.storage.values());

    let filteredItems = items;
    if (!options.includeDeleted && this.config.enableSoftDelete) {
      filteredItems = items.filter((item) => !(item as any)._softDelete?.isDeleted);
    }

    // Apply field filters
    if (options.fields && options.fields.length > 0) {
      filteredItems = filteredItems.map((item) => {
        const filtered: any = {};
        for (const field of options.fields!) {
          filtered[field] = (item as any)[field];
        }
        return filtered;
      });
    }

    switch (options.format) {
      case 'csv':
        return this.convertToCSV(filteredItems);
      case 'json':
        return JSON.stringify(filteredItems, null, 2);
      default:
        return JSON.stringify(filteredItems, null, 2);
    }
  }

  // Helper methods
  private generateId(prefix: string = 'id'): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private removeInternalFields(entity: any): T {
    const clean = { ...entity };
    delete clean._optimisticLock;
    delete clean._softDelete;
    return clean as T;
  }

  private isUniqueValue(entityType: string, fieldName: string, value: unknown, excludeId?: string): boolean {
    const rules = this.validationRules.get(entityType) || [];
    const uniqueRules = rules.filter((r) => r.validationType === 'unique' && r.fieldName === fieldName);

    if (uniqueRules.length === 0) {
      return true; // No unique constraint on this field
    }

    for (const entity of this.storage.values()) {
      if (excludeId && entity.id === excludeId) {
        continue;
      }
      if ((entity as any)[fieldName] === value) {
        return false;
      }
    }

    return true;
  }

  private async findByFields(data: Record<string, unknown>): Promise<T | null> {
    // Find by unique fields - simplified implementation
    for (const entity of this.storage.values()) {
      let matches = true;
      for (const [key, value] of Object.entries(data)) {
        if ((entity as any)[key] !== value) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return entity;
      }
    }
    return null;
  }

  private convertToCSV(items: any[]): string {
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
}

// Factory function
export function createCRUDGenerator<T extends { id: string }>(
  entityName: string,
  entityType: string,
  config: Partial<CRUDValidationConfig> = {}
): CRUDGenerator<T> {
  const fullConfig: CRUDValidationConfig = {
    entityName,
    entityType,
    validations: [],
    enableOptimisticLocking: true,
    enableSoftDelete: true,
    enableAuditTrail: true,
    ...config,
  };

  return new CRUDGenerator<T>(fullConfig);
}

// Validation rule builder
export function createValidationRule(
  fieldName: string,
  type: ValidationRule['validationType'],
  message: string,
  value?: unknown,
  severity: 'error' | 'warning' = 'error'
): ValidationRule {
  return {
    ruleId: crypto.randomBytes(4).toString('hex'),
    fieldName,
    validationType: type,
    message,
    value,
    severity,
  };
}

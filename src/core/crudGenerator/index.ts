/**
 * CRUD Generator
 * Data validation, optimistic locking, audit trails, and batch operations
 */

export {
  ValidationType,
  OperationType,
  BatchOperationStatus,
  ValidationRule,
  CrossFieldValidation,
  OptimisticLock,
  EntityVersion,
  EntityChange,
  AuditEntry,
  SoftDeletable,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  BatchOperation,
  ImportResult,
  ExportOptions,
  CRUDValidationConfig,
  CRUDOperations,
  ListOptions,
  ListResult,
  ImportExportService,
  AuditService,
  ValidationService,
  ValidationRuleConfig,
} from './types';

export { CRUDGenerator, createCRUDGenerator, createValidationRule } from './crudGenerator';

import { CRUDGenerator, createCRUDGenerator, createValidationRule } from './crudGenerator';
import { ValidationRule } from './types';

/**
 * CRUDManus
 * Main class for CRUD operations with validation
 */
export class CRUDManus {
  private generators: Map<string, CRUDGenerator<any>> = new Map();

  /**
   * Create a CRUD generator for an entity type
   */
  createGenerator<T extends { id: string }>(
    entityName: string,
    entityType: string,
    options?: {
      enableOptimisticLocking?: boolean;
      enableSoftDelete?: boolean;
      enableAuditTrail?: boolean;
      validations?: ValidationRule[];
    }
  ) {
    const generator = createCRUDGenerator<T>(entityName, entityType, {
      enableOptimisticLocking: options?.enableOptimisticLocking ?? true,
      enableSoftDelete: options?.enableSoftDelete ?? true,
      enableAuditTrail: options?.enableAuditTrail ?? true,
      validations: options?.validations || [],
    });

    this.generators.set(entityType, generator);
    return generator;
  }

  /**
   * Get existing generator
   */
  getGenerator(entityType: string) {
    return this.generators.get(entityType);
  }

  /**
   * Create validation rules for common scenarios
   */
  static createValidationRules = {
    email: (fieldName: string) =>
      createValidationRule(fieldName, 'email', `Invalid email format for ${fieldName}`),

    required: (fieldName: string) =>
      createValidationRule(fieldName, 'required', `${fieldName} is required`),

    phone: (fieldName: string) =>
      createValidationRule(fieldName, 'phone', `Invalid phone format for ${fieldName}`),

    minLength: (fieldName: string, min: number) =>
      createValidationRule(fieldName, 'minLength', `${fieldName} must be at least ${min} characters`, min),

    maxLength: (fieldName: string, max: number) =>
      createValidationRule(fieldName, 'maxLength', `${fieldName} must be at most ${max} characters`, max),

    min: (fieldName: string, min: number) =>
      createValidationRule(fieldName, 'min', `${fieldName} must be at least ${min}`, min),

    max: (fieldName: string, max: number) =>
      createValidationRule(fieldName, 'max', `${fieldName} must be at most ${max}`, max),

    pattern: (fieldName: string, regex: string, message?: string) =>
      createValidationRule(fieldName, 'pattern', message || `Invalid format for ${fieldName}`, regex),

    enum: (fieldName: string, values: string[]) =>
      createValidationRule(fieldName, 'enum', `${fieldName} must be one of: ${values.join(', ')}`, values),

    url: (fieldName: string) =>
      createValidationRule(fieldName, 'url', `Invalid URL format for ${fieldName}`),

    unique: (fieldName: string) =>
      createValidationRule(fieldName, 'unique', `${fieldName} must be unique`),
  };

  /**
   * Example: Create a User entity CRUD
   */
  exampleUserCRUD() {
    const validations = [
      CRUDManus.createValidationRules.required('email'),
      CRUDManus.createValidationRules.email('email'),
      CRUDManus.createValidationRules.required('name'),
      CRUDManus.createValidationRules.minLength('name', 2),
      CRUDManus.createValidationRules.maxLength('name', 100),
      CRUDManus.createValidationRules.unique('email'),
    ];

    return this.createGenerator('User', 'users', { validations });
  }

  /**
   * Example: Create a Product entity CRUD
   */
  exampleProductCRUD() {
    const validations = [
      CRUDManus.createValidationRules.required('name'),
      CRUDManus.createValidationRules.minLength('name', 3),
      CRUDManus.createValidationRules.required('price'),
      CRUDManus.createValidationRules.min('price', 0),
      CRUDManus.createValidationRules.maxLength('name', 200),
      CRUDManus.createValidationRules.enum('status', ['draft', 'active', 'archived']),
    ];

    return this.createGenerator('Product', 'products', { validations });
  }

  /**
   * Example: Create an Order entity CRUD
   */
  exampleOrderCRUD() {
    const validations = [
      CRUDManus.createValidationRules.required('customerId'),
      CRUDManus.createValidationRules.required('total'),
      CRUDManus.createValidationRules.min('total', 0),
      CRUDManus.createValidationRules.enum('status', ['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
    ];

    return this.createGenerator('Order', 'orders', {
      validations,
      enableOptimisticLocking: true,
      enableSoftDelete: true,
      enableAuditTrail: true,
    });
  }
}

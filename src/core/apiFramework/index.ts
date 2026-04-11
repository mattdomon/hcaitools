/**
 * API Framework
 * Complete REST API Framework with CRUD, validation, audit trails, and import/export
 */

export {
  HttpMethod,
  ValidationType,
  OperationType,
  BatchOperationStatus,
  ExportFormat,
  SortOrder,
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
  APIRoute,
  APIEndpoint,
  CRUDValidationConfig,
  CRUDOperations,
  ListOptions,
  ListResult,
  ImportExportService,
  AuditService,
  ValidationService,
  APIFrameworkConfig,
  APIResponse,
  PaginatedResponse,
  BatchResult,
  HealthCheckResult,
  APIFramework,
  ValidationRuleConfig,
  EntityMetadata,
  FieldDefinition,
  SchemaDefinition,
  RelationshipDefinition,
  QueryFilter,
  QueryOptions,
  BulkImportOptions,
  BulkExportOptions,
} from './types';

export {
  APIFrameworkImpl,
  createAPIFramework,
  createValidationRules,
} from './apiFramework';

import { APIFrameworkImpl, createAPIFramework, createValidationRules } from './apiFramework';
import { ValidationRule, CRUDOperations } from './types';

export function createFramework(config?: Parameters<typeof createAPIFramework>[0]) {
  return createAPIFramework(config);
}

export class APIFrameworkClass extends APIFrameworkImpl {
  constructor(config?: Parameters<typeof createAPIFramework>[0]) {
    super(config);
  }

  createGenerator<T extends { id: string }>(
    entityName: string,
    entityType: string,
    options?: {
      enableOptimisticLocking?: boolean;
      enableSoftDelete?: boolean;
      enableAuditTrail?: boolean;
      validations?: ValidationRule[];
    }
  ): CRUDOperations<T> {
    return this.generateOperations<T>({
      entityName,
      entityType,
      validations: options?.validations || [],
      crossFieldValidations: [],
      enableOptimisticLocking: options?.enableOptimisticLocking ?? true,
      enableSoftDelete: options?.enableSoftDelete ?? true,
      enableAuditTrail: options?.enableAuditTrail ?? true,
    });
  }

  createUserGenerator<T extends { id: string } = { id: string }>(): CRUDOperations<T> {
    const validations = [
      createValidationRules().required('email'),
      createValidationRules().email('email'),
      createValidationRules().required('name'),
      createValidationRules().minLength('name', 2),
      createValidationRules().maxLength('name', 100),
      createValidationRules().unique('email'),
    ];
    return this.createGenerator<T>('User', 'users', { validations });
  }

  createProductGenerator<T extends { id: string } = { id: string }>(): CRUDOperations<T> {
    const validations = [
      createValidationRules().required('name'),
      createValidationRules().minLength('name', 3),
      createValidationRules().required('price'),
      createValidationRules().min('price', 0),
      createValidationRules().maxLength('name', 200),
      createValidationRules().enum('status', ['draft', 'active', 'archived']),
    ];
    return this.createGenerator<T>('Product', 'products', { validations });
  }

  createOrderGenerator<T extends { id: string } = { id: string }>(): CRUDOperations<T> {
    const validations = [
      createValidationRules().required('customerId'),
      createValidationRules().required('total'),
      createValidationRules().min('total', 0),
      createValidationRules().enum('status', ['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
    ];
    return this.createGenerator<T>('Order', 'orders', {
      validations,
      enableOptimisticLocking: true,
      enableSoftDelete: true,
      enableAuditTrail: true,
    });
  }
}

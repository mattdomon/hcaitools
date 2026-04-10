/**
 * API Framework Tests
 */

import {
  APIFrameworkClass,
  createFramework,
  createValidationRules,
  APIFrameworkImpl,
} from '../src/core/apiFramework';
import {
  CRUDValidationConfig,
  CRUDOperations,
  ValidationRule,
  ListOptions,
  BatchOperation,
  ExportOptions,
  ImportResult,
  HealthCheckResult,
  EntityMetadata,
  SchemaDefinition,
  ValidationResult,
  AuditEntry,
} from '../src/core/apiFramework/types';

interface TestEntity {
  id: string;
  name: string;
  email: string;
  age?: number;
  status?: string;
  price?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

describe('APIFramework', () => {
  let framework: APIFrameworkClass;

  beforeEach(() => {
    framework = new APIFrameworkClass({ enableLogging: false });
  });

  afterEach(() => {
    framework.clear();
  });

  describe('Framework Creation', () => {
    test('should create framework with default config', () => {
      const fw = createFramework();
      expect(fw).toBeDefined();
      expect(fw.config.basePath).toBe('/api');
      expect(fw.config.apiPrefix).toBe('v1');
    });

    test('should create framework with custom config', () => {
      const fw = createFramework({
        basePath: '/custom',
        apiPrefix: 'v2',
        enableCors: false,
      });
      expect(fw.config.basePath).toBe('/custom');
      expect(fw.config.apiPrefix).toBe('v2');
      expect(fw.config.enableCors).toBe(false);
    });

    test('should create APIFrameworkClass instance', () => {
      const fw = new APIFrameworkClass();
      expect(fw).toBeDefined();
    });
  });

  describe('CRUD Operations', () => {
    let config: CRUDValidationConfig;
    let operations: CRUDOperations<TestEntity>;

    beforeEach(() => {
      config = {
        entityName: 'TestEntity',
        entityType: 'test_entities',
        validations: [
          createValidationRules().required('name'),
          createValidationRules().required('email'),
          createValidationRules().email('email'),
          createValidationRules().min('age', 0),
          createValidationRules().maxLength('name', 100),
          createValidationRules().enum('status', ['active', 'inactive', 'pending']),
        ],
        enableOptimisticLocking: true,
        enableSoftDelete: true,
        enableAuditTrail: true,
      };
      operations = framework.createGenerator<TestEntity>('TestEntity', 'test_entities', {
        validations: config.validations,
        enableOptimisticLocking: true,
        enableSoftDelete: true,
        enableAuditTrail: true,
      });
    });

    test('should create entity with valid data', async () => {
      const entity = await operations.create({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      });

      expect(entity.id).toBeDefined();
      expect(entity.name).toBe('John Doe');
      expect(entity.email).toBe('john@example.com');
      expect(entity.age).toBe(30);
      expect(entity.createdAt).toBeDefined();
      expect(entity.updatedAt).toBeDefined();
    });

    test('should reject entity with missing required field', async () => {
      await expect(
        operations.create({
          name: '',
          email: 'john@example.com',
        } as Omit<TestEntity, 'id' | 'createdAt' | 'updatedAt'>)
      ).rejects.toThrow('Validation failed');
    });

    test('should reject entity with invalid email', async () => {
      await expect(
        operations.create({
          name: 'Jane',
          email: 'invalid-email',
        } as Omit<TestEntity, 'id' | 'createdAt' | 'updatedAt'>)
      ).rejects.toThrow('Invalid email format');
    });

    test('should reject entity with negative age', async () => {
      await expect(
        operations.create({
          name: 'Jane',
          email: 'jane@example.com',
          age: -5,
        } as Omit<TestEntity, 'id' | 'createdAt' | 'updatedAt'>)
      ).rejects.toThrow('age must be at least 0');
    });

    test('should reject entity with invalid enum value', async () => {
      await expect(
        operations.create({
          name: 'Jane',
          email: 'jane@example.com',
          status: 'invalid_status',
        } as Omit<TestEntity, 'id' | 'createdAt' | 'updatedAt'>)
      ).rejects.toThrow('must be one of');
    });

    test('should read created entity', async () => {
      const created = await operations.create({
        name: 'Read Test',
        email: 'read@test.com',
      });

      const read = await operations.read(created.id);

      expect(read).not.toBeNull();
      expect(read?.name).toBe('Read Test');
      expect(read?.email).toBe('read@test.com');
    });

    test('should return null for non-existent entity', async () => {
      const result = await operations.read('non-existent-id');
      expect(result).toBeNull();
    });

    test('should not return soft-deleted entity', async () => {
      const created = await operations.create({
        name: 'Delete Test',
        email: 'delete@test.com',
      });

      await operations.delete(created.id);

      const read = await operations.read(created.id);
      expect(read).toBeNull();
    });

    test('should update entity', async () => {
      const created = await operations.create({
        name: 'Update Test',
        email: 'update@test.com',
      });

      const updated = await operations.update(created.id, { name: 'Updated Name' });

      expect(updated.name).toBe('Updated Name');
    });

    test('should track changes in audit log', async () => {
      const created = await operations.create({
        name: 'Audit Test',
        email: 'audit@test.com',
      });

      await operations.update(created.id, { name: 'Audited Name' });

      const auditHistory = framework.getAuditHistory('test_entities', created.id);
      const updateAudit = auditHistory.find((a) => a.operation === 'update');

      expect(updateAudit).toBeDefined();
      expect(updateAudit?.changes.length).toBeGreaterThan(0);
      expect(updateAudit?.changes[0].fieldName).toBe('name');
    });

    test('should soft delete entity by default', async () => {
      const created = await operations.create({
        name: 'Soft Delete Test',
        email: 'softdelete@test.com',
      });

      await operations.delete(created.id);

      const deleted = await operations.read(created.id);
      expect(deleted).toBeNull();
    });

    test('should restore soft-deleted entity', async () => {
      const created = await operations.create({
        name: 'Restore Test',
        email: 'restore@test.com',
      });

      await operations.delete(created.id);
      const restored = await operations.restore(created.id);

      expect(restored.name).toBe('Restore Test');
      const read = await operations.read(created.id);
      expect(read).not.toBeNull();
    });
  });

  describe('Batch Operations', () => {
    let operations: CRUDOperations<TestEntity>;

    beforeEach(() => {
      operations = framework.createGenerator<TestEntity>('TestEntity', 'test_entities', {
        enableOptimisticLocking: true,
        enableSoftDelete: true,
        enableAuditTrail: true,
      });
    });

    test('should batch update entities', async () => {
      const e1 = await operations.create({ name: 'Batch 1', email: 'batch1@test.com' });
      const e2 = await operations.create({ name: 'Batch 2', email: 'batch2@test.com' });
      const e3 = await operations.create({ name: 'Batch 3', email: 'batch3@test.com' });

      const result = await operations.batchUpdate([e1.id, e2.id, e3.id], { status: 'active' });

      expect(result.status).toBe('completed');
      expect(result.processedItems).toBe(3);
      expect(result.failedItems).toBe(0);
    });

    test('should batch delete entities', async () => {
      const e1 = await operations.create({ name: 'Batch 1', email: 'batch1@test.com' });
      const e2 = await operations.create({ name: 'Batch 2', email: 'batch2@test.com' });

      const result = await operations.batchDelete([e1.id, e2.id]);

      expect(result.status).toBe('completed');
      expect(result.processedItems).toBe(2);
    });

    test('should report partial batch failures', async () => {
      const e1 = await operations.create({ name: 'Batch 1', email: 'batch1@test.com' });

      const result = await operations.batchUpdate(
        [e1.id, 'invalid-id'],
        { status: 'active' }
      );

      expect(result.failedItems).toBe(1);
      expect(result.processedItems).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('List Operations', () => {
    let operations: CRUDOperations<TestEntity>;

    beforeEach(async () => {
      operations = framework.createGenerator<TestEntity>('TestEntity', 'test_entities');
      await operations.create({ name: 'User 1', email: 'user1@test.com' });
      await operations.create({ name: 'User 2', email: 'user2@test.com' });
      await operations.create({ name: 'User 3', email: 'user3@test.com' });
    });

    test('should list all non-deleted entities', async () => {
      const list = await operations.list();

      expect(list.items.length).toBeGreaterThanOrEqual(3);
      expect(list.total).toBeGreaterThanOrEqual(3);
    });

    test('should paginate results', async () => {
      const list = await operations.list({ page: 1, pageSize: 2 });

      expect(list.items.length).toBeLessThanOrEqual(2);
      expect(list.totalPages).toBeGreaterThan(1);
    });

    test('should sort results ascending', async () => {
      const list = await operations.list({ sortBy: 'name', sortOrder: 'asc' });

      for (let i = 0; i < list.items.length - 1; i++) {
        expect(list.items[i].name <= list.items[i + 1].name).toBe(true);
      }
    });

    test('should sort results descending', async () => {
      const list = await operations.list({ sortBy: 'name', sortOrder: 'desc' });

      for (let i = 0; i < list.items.length - 1; i++) {
        expect(list.items[i].name >= list.items[i + 1].name).toBe(true);
      }
    });

    test('should filter results', async () => {
      const list = await operations.list({ filters: { name: 'User 1' } });

      expect(list.items.length).toBe(1);
      expect(list.items[0].name).toBe('User 1');
    });

    test('should count entities', async () => {
      const count = await operations.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Validation Rules', () => {
    test('should create required validation rule', () => {
      const rule = createValidationRules().required('email');
      expect(rule.fieldName).toBe('email');
      expect(rule.validationType).toBe('required');
      expect(rule.message).toContain('email');
    });

    test('should create email validation rule', () => {
      const rule = createValidationRules().email('email');
      expect(rule.fieldName).toBe('email');
      expect(rule.validationType).toBe('email');
    });

    test('should create minLength validation rule', () => {
      const rule = createValidationRules().minLength('name', 3);
      expect(rule.validationType).toBe('minLength');
      expect(rule.value).toBe(3);
    });

    test('should create maxLength validation rule', () => {
      const rule = createValidationRules().maxLength('name', 100);
      expect(rule.validationType).toBe('maxLength');
      expect(rule.value).toBe(100);
    });

    test('should create min validation rule', () => {
      const rule = createValidationRules().min('price', 0);
      expect(rule.validationType).toBe('min');
      expect(rule.value).toBe(0);
    });

    test('should create max validation rule', () => {
      const rule = createValidationRules().max('price', 1000);
      expect(rule.validationType).toBe('max');
      expect(rule.value).toBe(1000);
    });

    test('should create pattern validation rule', () => {
      const rule = createValidationRules().pattern('username', '^[a-z]+$');
      expect(rule.validationType).toBe('pattern');
      expect(rule.value).toBe('^[a-z]+$');
    });

    test('should create enum validation rule', () => {
      const rule = createValidationRules().enum('status', ['active', 'inactive']);
      expect(rule.validationType).toBe('enum');
      expect(rule.value).toEqual(['active', 'inactive']);
    });

    test('should create unique validation rule', () => {
      const rule = createValidationRules().unique('email');
      expect(rule.validationType).toBe('unique');
    });

    test('should create phone validation rule', () => {
      const rule = createValidationRules().phone('phone');
      expect(rule.validationType).toBe('phone');
    });

    test('should create url validation rule', () => {
      const rule = createValidationRules().url('website');
      expect(rule.validationType).toBe('url');
    });

    test('should create custom validation rule', () => {
      const customValidator = (value: unknown) => typeof value === 'string' && value.startsWith('admin_');
      const rule = createValidationRules().custom('username', customValidator, 'Username must start with admin_');
      expect(rule.validationType).toBe('custom');
      expect(rule.severity).toBe('error');
    });
  });

  describe('Import/Export', () => {
    let operations: CRUDOperations<TestEntity>;

    beforeEach(() => {
      operations = framework.createGenerator<TestEntity>('TestEntity', 'test_entities', {
        validations: [
          createValidationRules().required('name'),
          createValidationRules().required('email'),
          createValidationRules().email('email'),
        ],
      });
    });

    test('should import valid data', async () => {
      const data = [
        { name: 'Import 1', email: 'import1@test.com' },
        { name: 'Import 2', email: 'import2@test.com' },
        { name: 'Import 3', email: 'import3@test.com' },
      ];

      const result = await framework.importData('test_entities', data);

      expect(result.totalRows).toBe(3);
      expect(result.successfulRows).toBe(3);
      expect(result.failedRows).toBe(0);
    });

    test('should report import errors', async () => {
      const data = [
        { name: 'Valid', email: 'valid@test.com' },
        { name: 'Invalid', email: 'not-an-email' },
      ];

      const result = await framework.importData('test_entities', data);

      expect(result.failedRows).toBe(1);
      expect(result.errors[0].row).toBe(2);
    });

    test('should export data as JSON', async () => {
      await operations.create({ name: 'Export 1', email: 'export1@test.com' });
      await operations.create({ name: 'Export 2', email: 'export2@test.com' });

      const json = await framework.exportData('test_entities', { format: 'json' });

      expect(json).toContain('"name"');
      expect(json).toContain('Export 1');
      expect(json).toContain('Export 2');
    });

    test('should export data as CSV', async () => {
      await operations.create({ name: 'CSV Export', email: 'csv@test.com' });

      const csv = await framework.exportData('test_entities', { format: 'csv' });

      expect(csv).toContain('name,email');
      expect(csv).toContain('CSV Export');
    });

    test('should export data as XML', async () => {
      await operations.create({ name: 'XML Export', email: 'xml@test.com' });

      const xml = await framework.exportData('test_entities', { format: 'xml' });

      expect(xml).toContain('<?xml');
      expect(xml).toContain('<name>XML Export</name>');
    });
  });

  describe('Entity Management', () => {
    test('should get registered entities', () => {
      framework.createGenerator<TestEntity>('TestEntity', 'test_entities');
      framework.createGenerator<TestEntity>('Product', 'products');

      const entities = framework.getRegisteredEntities();

      expect(entities).toContain('test_entities');
      expect(entities).toContain('products');
    });

    test('should get endpoints for registered entities', () => {
      framework.createGenerator<TestEntity>('TestEntity', 'test_entities');

      const endpoints = framework.getEndpoints();

      expect(endpoints.length).toBeGreaterThan(0);
      expect(endpoints.some((e) => e.route.path === '/v1/test_entities')).toBe(true);
      expect(endpoints.some((e) => e.route.method === 'POST')).toBe(true);
      expect(endpoints.some((e) => e.route.method === 'GET')).toBe(true);
    });

    test('should get entity metadata', () => {
      const operations = framework.createGenerator<TestEntity>('TestEntity', 'test_entities');
      framework.createGenerator<TestEntity>('Product', 'products');

      operations.create({ name: 'Meta Test', email: 'meta@test.com' });

      const metadata = framework.getEntityMetadata('test_entities');

      expect(metadata).not.toBeNull();
      expect(metadata?.entityType).toBe('test_entities');
      expect(metadata?.entityName).toBe('TestEntity');
      expect(metadata?.recordCount).toBe(1);
    });
  });

  describe('Health Check', () => {
    test('should return healthy status', () => {
      const health = framework.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeDefined();
      expect(health.version).toBe('1.0.0');
      expect(health.uptime).toBeGreaterThanOrEqual(0);
      expect(health.checks).toBeDefined();
    });
  });

  describe('Audit Trail', () => {
    let operations: CRUDOperations<TestEntity>;

    beforeEach(() => {
      operations = framework.createGenerator<TestEntity>('TestEntity', 'test_entities', {
        enableAuditTrail: true,
      });
    });

    test('should log create operations', async () => {
      const created = await operations.create({
        name: 'Audit Create',
        email: 'auditcreate@test.com',
      });

      const history = framework.getAuditHistory('test_entities', created.id);
      const createAudit = history.find((a) => a.operation === 'create');

      expect(createAudit).toBeDefined();
      expect(createAudit?.entityType).toBe('test_entities');
    });

    test('should log update operations', async () => {
      const created = await operations.create({
        name: 'Audit Update',
        email: 'auditupdate@test.com',
      });

      await operations.update(created.id, { name: 'Updated Name' });

      const history = framework.getAuditHistory('test_entities', created.id);
      const updateAudit = history.find((a) => a.operation === 'update');

      expect(updateAudit).toBeDefined();
    });

    test('should log delete operations', async () => {
      const created = await operations.create({
        name: 'Audit Delete',
        email: 'auditdelete@test.com',
      });

      await operations.delete(created.id);

      const history = framework.getAuditHistory('test_entities', created.id);
      const deleteAudit = history.find((a) => a.operation === 'delete');

      expect(deleteAudit).toBeDefined();
    });

    test('should get changes since date', async () => {
      const created = await operations.create({
        name: 'Change Test',
        email: 'change@test.com',
      });

      const since = new Date(Date.now() - 1000);
      const changes = framework.getChanges('test_entities', created.id, since);

      expect(Array.isArray(changes)).toBe(true);
    });
  });

  describe('Schema Definition', () => {
    test('should create schema definition', () => {
      const schema = framework.createSchema('User', 'users', [
        { name: 'id', type: 'string', required: false },
        { name: 'name', type: 'string', required: true },
        { name: 'email', type: 'string', required: true },
        { name: 'age', type: 'number', required: false },
      ]);

      expect(schema.entityName).toBe('User');
      expect(schema.entityType).toBe('users');
      expect(schema.fields.length).toBe(4);
      expect(schema.fields[0].name).toBe('id');
      expect(schema.fields[1].required).toBe(true);
    });
  });

  describe('Optimistic Locking', () => {
    test('should detect version conflict', async () => {
      const operations = framework.createGenerator<TestEntity>('TestEntity', 'test_entities', {
        enableOptimisticLocking: true,
      });

      const created = await operations.create({
        name: 'Version Test',
        email: 'version@test.com',
      });

      await expect(
        operations.update(created.id, { name: 'Updated' }, 0)
      ).rejects.toThrow('Version conflict');
    });

    test('should allow update with correct version', async () => {
      const operations = framework.createGenerator<TestEntity>('TestEntity', 'test_entities', {
        enableOptimisticLocking: true,
      });

      const created = await operations.create({
        name: 'Version Test',
        email: 'version@test.com',
      });

      const updated = await operations.update(created.id, { name: 'Updated' });
      expect(updated.name).toBe('Updated');
    });
  });

  describe('APIManus Pre-configured Generators', () => {
    test('should create user generator', () => {
      const fw = new APIFrameworkClass();
      const userGen = fw.createUserGenerator();

      expect(userGen).toBeDefined();
    });

    test('should create product generator', () => {
      const fw = new APIFrameworkClass();
      const productGen = fw.createProductGenerator();

      expect(productGen).toBeDefined();
    });

    test('should create order generator', () => {
      const fw = new APIFrameworkClass();
      const orderGen = fw.createOrderGenerator();

      expect(orderGen).toBeDefined();
    });
  });

  describe('Bulk Import Options', () => {
    let operations: CRUDOperations<TestEntity>;

    beforeEach(() => {
      operations = framework.createGenerator<TestEntity>('TestEntity', 'test_entities', {
        validations: [
          createValidationRules().required('name'),
          createValidationRules().required('email'),
        ],
      });
    });

    test('should skip duplicates when option is set', async () => {
      const data = [
        { name: 'Duplicate Test', email: 'dup@test.com' },
        { name: 'Duplicate Test', email: 'dup@test.com' },
      ];

      const result = await framework.importData('test_entities', data, {
        skipDuplicates: true,
      });

      expect(result.successfulRows).toBe(1);
    });

    test('should update existing when option is set', async () => {
      await operations.create({ name: 'Original', email: 'update@test.com' });

      const data = [
        { name: 'Updated', email: 'update@test.com' },
      ];

      const result = await framework.importData('test_entities', data, {
        updateExisting: true,
      });

      expect(result.successfulRows).toBe(1);

      const list = await operations.list();
      const updated = list.items.find((e) => e.email === 'update@test.com');
      expect(updated?.name).toBe('Updated');
    });
  });

  describe('Query Filters in Export', () => {
    let operations: CRUDOperations<TestEntity>;

    beforeEach(async () => {
      operations = framework.createGenerator<TestEntity>('TestEntity', 'test_entities');
      await operations.create({ name: 'Alice', email: 'alice@test.com', status: 'active' });
      await operations.create({ name: 'Bob', email: 'bob@test.com', status: 'inactive' });
      await operations.create({ name: 'Charlie', email: 'charlie@test.com', status: 'active' });
    });

    test('should filter by equals operator', async () => {
      const result = await framework.exportData('test_entities', {
        format: 'json',
        filters: [{ field: 'status', operator: 'eq', value: 'active' }],
      });

      const data = JSON.parse(result as string);
      expect(data.length).toBe(2);
      expect(data.every((item: TestEntity) => item.status === 'active')).toBe(true);
    });

    test('should filter by contains operator', async () => {
      const result = await framework.exportData('test_entities', {
        format: 'json',
        filters: [{ field: 'name', operator: 'contains', value: 'li' }],
      });

      const data = JSON.parse(result as string);
      expect(data.length).toBe(2);
      expect(data.some((item: TestEntity) => item.name === 'Alice')).toBe(true);
      expect(data.some((item: TestEntity) => item.name === 'Charlie')).toBe(true);
    });
  });
});

describe('createValidationRules', () => {
  test('should create all validation rule types', () => {
    const rules = createValidationRules();

    expect(rules.required('field')).toBeDefined();
    expect(rules.email('field')).toBeDefined();
    expect(rules.phone('field')).toBeDefined();
    expect(rules.url('field')).toBeDefined();
    expect(rules.minLength('field', 5)).toBeDefined();
    expect(rules.maxLength('field', 10)).toBeDefined();
    expect(rules.min('field', 0)).toBeDefined();
    expect(rules.max('field', 100)).toBeDefined();
    expect(rules.pattern('field', '^abc$')).toBeDefined();
    expect(rules.enum('field', ['a', 'b'])).toBeDefined();
    expect(rules.unique('field')).toBeDefined();
  });
});

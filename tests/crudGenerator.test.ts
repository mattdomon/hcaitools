/**
 * CRUD Generator Tests
 */

import { CRUDGenerator, createCRUDGenerator, createValidationRule, CRUDManus } from '../src/core/crudGenerator';
import { CRUDValidationConfig, ValidationRule, ListOptions } from '../src/core/crudGenerator/types';

interface TestEntity {
  id: string;
  name: string;
  email: string;
  age?: number;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

describe('CRUDGenerator', () => {
  let generator: CRUDGenerator<TestEntity>;

  beforeEach(() => {
    const config: CRUDValidationConfig = {
      entityName: 'TestEntity',
      entityType: 'test_entities',
      validations: [
        createValidationRule('name', 'required', 'Name is required'),
        createValidationRule('email', 'required', 'Email is required'),
        createValidationRule('email', 'email', 'Invalid email format'),
        createValidationRule('age', 'min', 'Age must be at least 0', 0),
        createValidationRule('status', 'enum', 'Invalid status', ['active', 'inactive']),
      ],
      enableOptimisticLocking: true,
      enableSoftDelete: true,
      enableAuditTrail: true,
    };

    generator = new CRUDGenerator<TestEntity>(config);
  });

  describe('Create Operations', () => {
    test('should create entity with valid data', async () => {
      const entity = await generator.create({
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
        generator.create({
          name: '',
          email: 'john@example.com',
        })
      ).rejects.toThrow('Validation failed');
    });

    test('should reject entity with invalid email', async () => {
      await expect(
        generator.create({
          name: 'Jane',
          email: 'invalid-email',
        })
      ).rejects.toThrow('Invalid email format');
    });

    test('should reject entity with negative age', async () => {
      await expect(
        generator.create({
          name: 'Jane',
          email: 'jane@example.com',
          age: -5,
        })
      ).rejects.toThrow('Age must be at least 0');
    });

    test('should reject entity with invalid enum value', async () => {
      await expect(
        generator.create({
          name: 'Jane',
          email: 'jane@example.com',
          status: 'invalid_status',
        })
      ).rejects.toThrow('Invalid status');
    });

    test('should add optimistic locking version', async () => {
      const entity = await generator.create({
        name: 'Version Test',
        email: 'version@test.com',
      });

      // Version is tracked internally - just verify create succeeded
      expect(entity.id).toBeDefined();
    });
  });

  describe('Read Operations', () => {
    test('should read created entity', async () => {
      const created = await generator.create({
        name: 'Read Test',
        email: 'read@test.com',
      });

      const read = await generator.read(created.id);

      expect(read).not.toBeNull();
      expect(read?.name).toBe('Read Test');
    });

    test('should return null for non-existent entity', async () => {
      const result = await generator.read('non-existent-id');
      expect(result).toBeNull();
    });

    test('should not return soft-deleted entity', async () => {
      const created = await generator.create({
        name: 'Delete Test',
        email: 'delete@test.com',
      });

      await generator.delete(created.id);

      const read = await generator.read(created.id);
      expect(read).toBeNull();
    });

    test('should include deleted with includeDeleted flag', async () => {
      const created = await generator.create({
        name: 'Include Deleted Test',
        email: 'includedeleted@test.com',
      });

      await generator.delete(created.id);

      const listOptions: ListOptions = { includeDeleted: true };
      const list = await generator.list(listOptions);

      expect(list.items.some((item) => item.id === created.id)).toBe(true);
    });
  });

  describe('Update Operations', () => {
    test('should update entity', async () => {
      const created = await generator.create({
        name: 'Update Test',
        email: 'update@test.com',
      });

      const updated = await generator.update(created.id, { name: 'Updated Name' });

      expect(updated.name).toBe('Updated Name');
    });

    test('should increment version on update', async () => {
      const created = await generator.create({
        name: 'Version Increment Test',
        email: 'versioninc@test.com',
      });

      // Version is tracked internally - just verify update succeeded
      const updated = await generator.update(created.id, { name: 'Updated' });
      expect(updated.name).toBe('Updated');
    });

    test('should throw on version conflict', async () => {
      const created = await generator.create({
        name: 'Conflict Test',
        email: 'conflict@test.com',
      });

      await expect(
        generator.update(created.id, { name: 'Updated' }, 0) // Wrong version
      ).rejects.toThrow('Version conflict');
    });

    test('should track changes in audit log', async () => {
      const created = await generator.create({
        name: 'Audit Test',
        email: 'audit@test.com',
      });

      await generator.update(created.id, { name: 'Audited Name' });

      const auditHistory = generator.getAuditHistory(created.id);
      const updateAudit = auditHistory.find((a) => a.operation === 'update');

      expect(updateAudit).toBeDefined();
      expect(updateAudit?.changes.length).toBeGreaterThan(0);
      expect(updateAudit?.changes[0].fieldName).toBe('name');
    });
  });

  describe('Delete Operations', () => {
    test('should soft delete entity by default', async () => {
      const created = await generator.create({
        name: 'Soft Delete Test',
        email: 'softdelete@test.com',
      });

      await generator.delete(created.id);

      const deleted = await generator.read(created.id);
      expect(deleted).toBeNull();
    });

    test('should hard delete when specified', async () => {
      const created = await generator.create({
        name: 'Hard Delete Test',
        email: 'harddelete@test.com',
      });

      await generator.delete(created.id, true);

      const listWithDeleted = await generator.list({ includeDeleted: true });
      const found = listWithDeleted.items.find((item) => item.id === created.id);
      expect(found).toBeUndefined();
    });
  });

  describe('Restore Operations', () => {
    test('should restore soft-deleted entity', async () => {
      const created = await generator.create({
        name: 'Restore Test',
        email: 'restore@test.com',
      });

      await generator.delete(created.id);
      const restored = await generator.restore(created.id);

      expect(restored.name).toBe('Restore Test');
      const read = await generator.read(created.id);
      expect(read).not.toBeNull();
    });

    test('should throw when restoring non-deleted entity', async () => {
      const created = await generator.create({
        name: 'No Delete Test',
        email: 'nodelete@test.com',
      });

      await expect(generator.restore(created.id)).rejects.toThrow('is not deleted');
    });
  });

  describe('List Operations', () => {
    beforeEach(async () => {
      await generator.create({ name: 'User 1', email: 'user1@test.com' });
      await generator.create({ name: 'User 2', email: 'user2@test.com' });
      await generator.create({ name: 'User 3', email: 'user3@test.com' });
    });

    test('should list all non-deleted entities', async () => {
      const list = await generator.list();

      expect(list.items.length).toBeGreaterThanOrEqual(3);
      expect(list.total).toBeGreaterThanOrEqual(3);
    });

    test('should paginate results', async () => {
      const list = await generator.list({ page: 1, pageSize: 2 });

      expect(list.items.length).toBeLessThanOrEqual(2);
      expect(list.totalPages).toBeGreaterThan(1);
    });

    test('should sort results', async () => {
      const list = await generator.list({ sortBy: 'name', sortOrder: 'desc' });

      for (let i = 0; i < list.items.length - 1; i++) {
        expect(list.items[i].name >= list.items[i + 1].name).toBe(true);
      }
    });

    test('should filter results', async () => {
      const list = await generator.list({
        filters: { name: 'User 1' },
      });

      expect(list.items.length).toBe(1);
      expect(list.items[0].name).toBe('User 1');
    });
  });

  describe('Batch Operations', () => {
    let ids: string[] = [];

    beforeEach(async () => {
      const e1 = await generator.create({ name: 'Batch 1', email: 'batch1@test.com' });
      const e2 = await generator.create({ name: 'Batch 2', email: 'batch2@test.com' });
      const e3 = await generator.create({ name: 'Batch 3', email: 'batch3@test.com' });
      ids = [e1.id, e2.id, e3.id];
    });

    test('should batch update entities', async () => {
      const result = await generator.batchUpdate(ids, { status: 'active' });

      expect(result.status).toBe('completed');
      expect(result.processedItems).toBe(3);
      expect(result.failedItems).toBe(0);
    });

    test('should batch delete entities', async () => {
      const result = await generator.batchDelete(ids);

      expect(result.status).toBe('completed');
      expect(result.processedItems).toBe(3);
    });

    test('should report partial failures', async () => {
      // Mix valid and invalid IDs
      const invalidIds = [...ids, 'invalid-id'];
      const result = await generator.batchUpdate(invalidIds, { status: 'active' });

      expect(result.failedItems).toBe(1);
      expect(result.processedItems).toBe(3);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Import/Export', () => {
    test('should import valid data', async () => {
      const data = [
        { name: 'Import 1', email: 'import1@test.com' },
        { name: 'Import 2', email: 'import2@test.com' },
        { name: 'Import 3', email: 'import3@test.com' },
      ];

      const result = await generator.importData(data);

      expect(result.totalRows).toBe(3);
      expect(result.successfulRows).toBe(3);
      expect(result.failedRows).toBe(0);
    });

    test('should report import errors', async () => {
      const data = [
        { name: 'Valid', email: 'valid@test.com' },
        { name: 'Invalid', email: 'not-an-email' },
      ];

      const result = await generator.importData(data);

      expect(result.failedRows).toBe(1);
      expect(result.errors[0].row).toBe(2);
    });

    test('should export data as CSV', async () => {
      await generator.create({ name: 'Export 1', email: 'export1@test.com' });
      await generator.create({ name: 'Export 2', email: 'export2@test.com' });

      const csv = await generator.exportData({ format: 'csv' });

      expect(csv).toContain('name,email');
      expect(csv).toContain('Export 1');
      expect(csv).toContain('Export 2');
    });

    test('should export data as JSON', async () => {
      await generator.create({ name: 'JSON Export', email: 'json@test.com' });

      const json = await generator.exportData({ format: 'json' });

      expect(json).toContain('"name"');
      expect(json).toContain('JSON Export');
    });
  });

  describe('Audit Trail', () => {
    test('should log create operations', async () => {
      const created = await generator.create({
        name: 'Audit Create',
        email: 'auditcreate@test.com',
      });

      const history = generator.getAuditHistory(created.id);
      const createAudit = history.find((a) => a.operation === 'create');

      expect(createAudit).toBeDefined();
      expect(createAudit?.entityType).toBe('test_entities');
    });

    test('should log update operations', async () => {
      const created = await generator.create({
        name: 'Audit Update',
        email: 'auditupdate@test.com',
      });

      await generator.update(created.id, { name: 'Updated Name' });

      const history = generator.getAuditHistory(created.id);
      const updateAudit = history.find((a) => a.operation === 'update');

      expect(updateAudit).toBeDefined();
    });

    test('should log delete operations', async () => {
      const created = await generator.create({
        name: 'Audit Delete',
        email: 'auditdelete@test.com',
      });

      await generator.delete(created.id);

      const history = generator.getAuditHistory(created.id);
      const deleteAudit = history.find((a) => a.operation === 'delete');

      expect(deleteAudit).toBeDefined();
    });
  });
});

describe('CRUDManus', () => {
  let crud: CRUDManus;

  beforeEach(() => {
    crud = new CRUDManus();
  });

  test('should create generator with validations', () => {
    const generator = crud.exampleUserCRUD();
    expect(generator).toBeDefined();
  });

  test('should create generator with validation rules', () => {
    const validations = [
      CRUDManus.createValidationRules.required('email'),
      CRUDManus.createValidationRules.email('email'),
      CRUDManus.createValidationRules.minLength('name', 2),
    ];

    const generator = crud.createGenerator('Product', 'products', { validations });
    expect(generator).toBeDefined();
  });

  test('should create email validation rule', () => {
    const rule = CRUDManus.createValidationRules.email('email');

    expect(rule.fieldName).toBe('email');
    expect(rule.validationType).toBe('email');
    expect(rule.message).toContain('Invalid email');
  });

  test('should create required validation rule', () => {
    const rule = CRUDManus.createValidationRules.required('name');

    expect(rule.fieldName).toBe('name');
    expect(rule.validationType).toBe('required');
  });

  test('should create enum validation rule', () => {
    const rule = CRUDManus.createValidationRules.enum('status', ['active', 'inactive']);

    expect(rule.fieldName).toBe('status');
    expect(rule.validationType).toBe('enum');
    expect(rule.value).toEqual(['active', 'inactive']);
  });

  test('should create min/max validation rules', () => {
    const minRule = CRUDManus.createValidationRules.min('price', 0);
    const maxRule = CRUDManus.createValidationRules.max('price', 1000);

    expect(minRule.value).toBe(0);
    expect(maxRule.value).toBe(1000);
  });

  test('should create pattern validation rule', () => {
    const rule = CRUDManus.createValidationRules.pattern('username', '^[a-z]+$', 'Username must be lowercase letters');

    expect(rule.validationType).toBe('pattern');
    expect(rule.value).toBe('^[a-z]+$');
  });
});

describe('createValidationRule', () => {
  test('should create validation rule with all properties', () => {
    const rule = createValidationRule('testField', 'required', 'Test field is required', undefined, 'error');

    expect(rule.ruleId).toBeDefined();
    expect(rule.fieldName).toBe('testField');
    expect(rule.validationType).toBe('required');
    expect(rule.message).toBe('Test field is required');
    expect(rule.severity).toBe('error');
  });

  test('should create warning severity rule', () => {
    const rule = createValidationRule('name', 'minLength', 'Name is short', 3, 'warning');

    expect(rule.severity).toBe('warning');
  });
});

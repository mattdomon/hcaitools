/**
 * Database Integration Tests
 */

import { PostgreSQLDatabaseManager } from '../src/core/database/databaseManager';
import { DatabaseManus } from '../src/core/database';
import { DataModel, ModelField, IndexDefinition, DataType } from '../src/core/database/types';

describe('PostgreSQLDatabaseManager', () => {
  let db: PostgreSQLDatabaseManager;

  beforeEach(async () => {
    db = new PostgreSQLDatabaseManager();
    await db.connect();
  });

  afterEach(async () => {
    await db.disconnect();
  });

  describe('Connection Management', () => {
    test('should connect to database', async () => {
      const connected = await db.testConnection();
      expect(connected).toBe(true);
    });

    test('should update configuration', () => {
      db.updateConfig({
        host: 'localhost',
        port: 5432,
        database: 'testdb',
      });

      const config = db.getConfig();
      expect(config.host).toBe('localhost');
      expect(config.port).toBe(5432);
    });

    test('should throw error when getting config before setup', () => {
      const newDb = new PostgreSQLDatabaseManager();
      expect(() => newDb.getConfig()).toThrow('Database not configured');
    });
  });

  describe('Schema Generation', () => {
    test('should generate table schema from model', () => {
      const model: DataModel = {
        modelId: 'model_1',
        modelName: 'User',
        tableName: 'users',
        fields: [
          {
            fieldId: 'field_1',
            fieldName: 'id',
            columnName: 'id',
            dataType: 'uuid',
            isRequired: true,
            isUnique: false,
            isIndexed: false,
          },
          {
            fieldId: 'field_2',
            fieldName: 'email',
            columnName: 'email',
            dataType: 'string',
            isRequired: true,
            isUnique: true,
            isIndexed: true,
          },
          {
            fieldId: 'field_3',
            fieldName: 'name',
            columnName: 'name',
            dataType: 'string',
            isRequired: false,
            isUnique: false,
            isIndexed: false,
          },
        ],
        relationships: [],
        indexes: [],
        timestamps: true,
        softDeletes: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const schema = db.generateSchema(model);

      expect(schema.tableName).toBe('users');
      expect(schema.columns.length).toBeGreaterThanOrEqual(3); // includes id, email, name, created_at, updated_at
      expect(schema.primaryKey).toBe('id');
      expect(schema.timestamps).toBe(true);

      const idColumn = schema.columns.find((c) => c.columnName === 'id');
      expect(idColumn?.dataType).toBe('uuid');
      expect(idColumn?.isPrimaryKey).toBe(true);

      const emailColumn = schema.columns.find((c) => c.columnName === 'email');
      expect(emailColumn?.isUnique).toBe(true);
    });

    test('should generate indexes from model', () => {
      const model: DataModel = {
        modelId: 'model_1',
        modelName: 'Product',
        tableName: 'products',
        fields: [
          {
            fieldId: 'field_1',
            fieldName: 'id',
            columnName: 'id',
            dataType: 'uuid',
            isRequired: true,
            isUnique: false,
            isIndexed: false,
          },
          {
            fieldId: 'field_2',
            fieldName: 'category',
            columnName: 'category',
            dataType: 'string',
            isRequired: true,
            isUnique: false,
            isIndexed: true,
          },
          {
            fieldId: 'field_3',
            fieldName: 'sku',
            columnName: 'sku',
            dataType: 'string',
            isRequired: true,
            isUnique: true,
            isIndexed: true,
          },
        ],
        relationships: [],
        indexes: [],
        timestamps: false,
        softDeletes: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const indexes = db.generateIndexes(model);

      expect(indexes.length).toBe(2);
      expect(indexes.find((i) => i.columns.includes('category'))).toBeDefined();
      expect(indexes.find((i) => i.columns.includes('sku'))).toBeDefined();
    });

    test('should add soft delete column when enabled', () => {
      const model: DataModel = {
        modelId: 'model_1',
        modelName: 'Post',
        tableName: 'posts',
        fields: [
          {
            fieldId: 'field_1',
            fieldName: 'id',
            columnName: 'id',
            dataType: 'uuid',
            isRequired: true,
            isUnique: false,
            isIndexed: false,
          },
        ],
        relationships: [],
        indexes: [],
        timestamps: true,
        softDeletes: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const schema = db.generateSchema(model);

      expect(schema.columns.find((c) => c.columnName === 'deleted_at')).toBeDefined();
    });
  });

  describe('SQL Query Building', () => {
    test('should build INSERT query', () => {
      const sql = db.buildInsertQuery('users', {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      });

      expect(sql).toContain('INSERT INTO "users"');
      expect(sql).toContain('"name"');
      expect(sql).toContain('"email"');
      expect(sql).toContain('"age"');
      expect(sql).toContain("'John Doe'");
      expect(sql).toContain("'john@example.com'");
      expect(sql).toContain('30');
    });

    test('should build UPDATE query', () => {
      const sql = db.buildUpdateQuery('users', '123', {
        name: 'Jane Doe',
        email: 'jane@example.com',
      });

      expect(sql).toContain('UPDATE "users"');
      expect(sql).toContain('SET');
      expect(sql).toContain('"name" = \'Jane Doe\'');
      expect(sql).toContain('"email" = \'jane@example.com\'');
      expect(sql).toContain('WHERE id = \'123\'');
    });

    test('should build SELECT query with filters', () => {
      const sql = db.buildSelectQuery('users', { status: 'active', role: 'admin' });

      expect(sql).toContain('SELECT * FROM "users"');
      expect(sql).toContain('WHERE');
      expect(sql).toContain('"status" = \'active\'');
      expect(sql).toContain('"role" = \'admin\'');
    });

    test('should build SELECT query with options', () => {
      const sql = db.buildSelectQuery('users', {}, {
        orderBy: 'created_at',
        orderDirection: 'DESC',
        limit: 10,
        offset: 20,
      });

      expect(sql).toContain('ORDER BY "created_at" DESC');
      expect(sql).toContain('LIMIT 10');
      expect(sql).toContain('OFFSET 20');
    });

    test('should build DELETE query', () => {
      const sql = db.buildDeleteQuery('users', '456');

      expect(sql).toContain('DELETE FROM "users"');
      expect(sql).toContain('WHERE id = \'456\'');
    });

    test('should build COUNT query', () => {
      const sql = db.buildCountQuery('users', { active: true });

      expect(sql).toContain('SELECT COUNT(*) as count FROM "users"');
      expect(sql).toContain('"active" = TRUE');
    });

    test('should build CREATE TABLE SQL', () => {
      const table = {
        tableName: 'products',
        columns: [
          {
            columnName: 'id',
            dataType: 'uuid' as DataType,
            isNullable: false,
            isPrimaryKey: true,
            isUnique: true,
          },
          {
            columnName: 'name',
            dataType: 'string' as DataType,
            isNullable: false,
            isPrimaryKey: false,
            isUnique: false,
            maxLength: 255,
          },
          {
            columnName: 'price',
            dataType: 'decimal' as DataType,
            isNullable: false,
            isPrimaryKey: false,
            isUnique: false,
            precision: 10,
            scale: 2,
          },
        ],
        indexes: [],
        constraints: [],
        primaryKey: 'id',
      };

      const sql = db.buildCreateTableSQL(table);

      expect(sql).toContain('CREATE TABLE "products"');
      expect(sql).toContain('"id" UUID NOT NULL');
      expect(sql).toContain('"name" VARCHAR(255) NOT NULL');
      expect(sql).toContain('"price" DECIMAL(10,2) NOT NULL');
      expect(sql).toContain('PRIMARY KEY ("id")');
    });

    test('should build CREATE INDEX SQL', () => {
      const index: IndexDefinition = {
        indexName: 'idx_products_category',
        tableName: 'products',
        columns: ['category', 'created_at'],
        isUnique: false,
        indexType: 'btree',
      };

      const sql = db.buildCreateIndexSQL(index);

      expect(sql).toContain('CREATE INDEX "idx_products_category"');
      expect(sql).toContain('ON "products"');
      expect(sql).toContain('("category", "created_at")');
    });

    test('should build unique index SQL', () => {
      const index: IndexDefinition = {
        indexName: 'idx_users_email',
        tableName: 'users',
        columns: ['email'],
        isUnique: true,
        indexType: 'btree',
      };

      const sql = db.buildCreateIndexSQL(index);

      expect(sql).toContain('CREATE UNIQUE INDEX');
    });
  });

  describe('Type Conversions', () => {
    test('should escape identifiers correctly', () => {
      expect(db.escapeIdentifier('users')).toBe('"users"');
      expect(db.escapeIdentifier('user_groups')).toBe('"user_groups"');
      expect(db.escapeIdentifier('table with spaces')).toBe('"table with spaces"');
      expect(db.escapeIdentifier('test"quote')).toBe('"test""quote"');
    });

    test('should quote values correctly', () => {
      expect(db.quoteValue('hello')).toBe("'hello'");
      expect(db.quoteValue(42)).toBe('42');
      expect(db.quoteValue(true)).toBe('TRUE');
      expect(db.quoteValue(false)).toBe('FALSE');
      expect(db.quoteValue(null)).toBe('NULL');
      expect(db.quoteValue({ foo: 'bar' })).toContain("'{\"foo\":\"bar\"}'");
    });
  });

  describe('CRUD Generation', () => {
    test('should generate CRUD operations', () => {
      const model: DataModel = {
        modelId: 'model_1',
        modelName: 'Article',
        tableName: 'articles',
        fields: [
          {
            fieldId: 'field_1',
            fieldName: 'id',
            columnName: 'id',
            dataType: 'uuid',
            isRequired: true,
            isUnique: false,
            isIndexed: false,
          },
        ],
        relationships: [],
        indexes: [],
        timestamps: false,
        softDeletes: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const crud = db.generateCRUD(model);

      expect(crud.modelName).toBe('Article');
      expect(crud.tableName).toBe('articles');
      expect(crud.operations.create).toContain('INSERT');
      expect(crud.operations.read).toContain('SELECT');
      expect(crud.operations.update).toContain('UPDATE');
      expect(crud.operations.delete).toContain('DELETE');
      expect(crud.operations.list).toContain('SELECT');
      expect(crud.operations.count).toContain('COUNT');
    });

    test('should generate TypeScript types', () => {
      const model: DataModel = {
        modelId: 'model_1',
        modelName: 'User',
        tableName: 'users',
        fields: [
          {
            fieldId: 'field_1',
            fieldName: 'id',
            columnName: 'id',
            dataType: 'uuid',
            isRequired: true,
            isUnique: false,
            isIndexed: false,
          },
          {
            fieldId: 'field_2',
            fieldName: 'email',
            columnName: 'email',
            dataType: 'string',
            isRequired: true,
            isUnique: false,
            isIndexed: false,
          },
          {
            fieldId: 'field_3',
            fieldName: 'age',
            columnName: 'age',
            dataType: 'number',
            isRequired: false,
            isUnique: false,
            isIndexed: false,
          },
        ],
        relationships: [],
        indexes: [],
        timestamps: false,
        softDeletes: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const crud = db.generateCRUD(model);

      expect(crud.typeScriptTypes).toContain('export interface UserType');
      expect(crud.typeScriptTypes).toContain('id: string');
      expect(crud.typeScriptTypes).toContain('email: string');
      expect(crud.typeScriptTypes).toContain('age?: number');
    });

    test('should generate enum types', () => {
      const model: DataModel = {
        modelId: 'model_1',
        modelName: 'Order',
        tableName: 'orders',
        fields: [
          {
            fieldId: 'field_1',
            fieldName: 'status',
            columnName: 'status',
            dataType: 'enum',
            isRequired: true,
            isUnique: false,
            isIndexed: false,
            enumValues: ['pending', 'processing', 'completed'],
          },
        ],
        relationships: [],
        indexes: [],
        timestamps: false,
        softDeletes: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const crud = db.generateCRUD(model);

      expect(crud.typeScriptTypes).toContain("'pending' | 'processing' | 'completed'");
    });
  });

  describe('Seed Data Generation', () => {
    test('should generate seed data', () => {
      const seed = db.generateSeedData('users', 5);

      expect(seed.tableName).toBe('users');
      expect(seed.data.length).toBe(5);
      expect(seed.data[0]).toHaveProperty('id');
      expect(seed.data[0]).toHaveProperty('created_at');
      expect(seed.data[0]).toHaveProperty('updated_at');
    });

    test('should generate different IDs for each seed', () => {
      const seed = db.generateSeedData('users', 3);

      const ids = seed.data.map((d: Record<string, unknown>) => d.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(3); // All unique
    });
  });
});

describe('DatabaseManus', () => {
  let db: DatabaseManus;

  beforeEach(async () => {
    db = new DatabaseManus();
    await db.connect({
      host: 'localhost',
      port: 5432,
      database: 'test',
    });
  });

  test('should create model from field definitions', () => {
    const model = db.createModel('User', 'users', [
      { name: 'id', type: 'uuid', required: true },
      { name: 'email', type: 'string', required: true, unique: true },
      { name: 'name', type: 'string', required: true },
    ], { timestamps: true });

    expect(model.modelName).toBe('User');
    expect(model.tableName).toBe('users');
    expect(model.fields.length).toBe(3);
    expect(model.timestamps).toBe(true);
    expect(model.fields.find((f) => f.fieldName === 'email')?.isUnique).toBe(true);
  });

  test('should convert camelCase to snake_case for column names', () => {
    const model = db.createModel('BlogPost', 'blog_posts', [
      { name: 'postId', type: 'uuid' },
      { name: 'createdAt', type: 'timestamp' },
    ]);

    expect(model.fields.find((f) => f.fieldName === 'postId')?.columnName).toBe('post_id');
    expect(model.fields.find((f) => f.fieldName === 'createdAt')?.columnName).toBe('created_at');
  });

  test('should generate CRUD for model', () => {
    const model = db.createModel('Product', 'products', [
      { name: 'id', type: 'uuid', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'price', type: 'decimal', required: true },
    ]);

    const crud = db.generateCRUD(model);

    expect(crud.modelName).toBe('Product');
    expect(crud.operations.create).toContain('INSERT');
  });

  test('should generate seed data', () => {
    const seed = db.generateSeedData('users', 10);

    expect(seed.tableName).toBe('users');
    expect(seed.data.length).toBe(10);
  });

  test('should create users table', async () => {
    const model = await db.createUsersTable();

    expect(model.modelName).toBe('User');
    expect(model.tableName).toBe('users');
    expect(model.fields.some((f) => f.fieldName === 'email')).toBe(true);
    expect(model.timestamps).toBe(true);
    expect(model.softDeletes).toBe(true);
  });

  test('should create posts table', async () => {
    const model = await db.createPostsTable();

    expect(model.modelName).toBe('Post');
    expect(model.tableName).toBe('posts');
    expect(model.fields.some((f) => f.fieldName === 'userId')).toBe(true);
  });

  test('should create complete blog schema', async () => {
    const schema = await db.createBlogSchema();

    expect(schema.users).toBeDefined();
    expect(schema.posts).toBeDefined();
    expect(schema.crud.users).toBeDefined();
    expect(schema.crud.posts).toBeDefined();
  });

  test('should create e-commerce schema', async () => {
    const schema = await db.createEcommerceSchema();

    expect(schema.customers).toBeDefined();
    expect(schema.products).toBeDefined();
    expect(schema.orders).toBeDefined();

    // Check relationships
    const orderModel = schema.orders;
    expect(orderModel.fields.some((f) => f.fieldName === 'customerId')).toBe(true);
    expect(orderModel.fields.some((f) => f.fieldName === 'status')).toBe(true);
  });
});

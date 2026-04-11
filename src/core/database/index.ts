/**
 * Database Integration
 * Schema generation, migrations, CRUD operations, and database management
 */

export {
  DataType,
  ColumnConstraint,
  IndexType,
  RelationshipType,
  MigrationAction,
  ConstraintAction,
  ColumnDefinition,
  ForeignKeyDefinition,
  IndexDefinition,
  CheckConstraint,
  TableDefinition,
  RelationshipDefinition,
  DataModel,
  ModelField,
  FieldValidation,
  Migration,
  SeedData,
  DatabaseConfig,
  CRUDOperations,
  GeneratedCRUD,
  DatabaseMigration,
  QueryResult,
  Transaction,
  TableAlteration,
  SelectOptions,
  DatabaseManager,
} from './types';

export { PostgreSQLDatabaseManager } from './databaseManager';

import { PostgreSQLDatabaseManager } from './databaseManager';
import { DataModel, ModelField, DatabaseConfig } from './types';

/**
 * DatabaseManus
 * Main class for database schema management and CRUD operations
 */
export class DatabaseManus {
  private manager: PostgreSQLDatabaseManager;

  constructor() {
    this.manager = new PostgreSQLDatabaseManager();
  }

  /**
   * Connect to database
   */
  async connect(config?: Partial<DatabaseConfig>) {
    if (config) {
      this.manager.updateConfig(config as DatabaseConfig);
    }
    return this.manager.connect();
  }

  /**
   * Test database connection
   */
  async testConnection() {
    return this.manager.testConnection();
  }

  /**
   * Create a data model from field definitions
   */
  createModel(modelName: string, tableName: string, fields: Array<{
    name: string;
    type: string;
    required?: boolean;
    unique?: boolean;
    indexed?: boolean;
    default?: unknown;
    enum?: string[];
  }>, options?: { timestamps?: boolean; softDeletes?: boolean }) {
    const modelFields: ModelField[] = fields.map((f, idx) => ({
      fieldId: `field_${idx}`,
      fieldName: f.name,
      columnName: f.name
        .replace(/([A-Z])/g, '_$1')  // Add underscore before uppercase
        .replace(/^_/, '')           // Remove leading underscore
        .toLowerCase(),             // Convert to lowercase
      dataType: f.type as any,
      isRequired: f.required || false,
      isUnique: f.unique || false,
      isIndexed: f.indexed || false,
      defaultValue: f.default,
      enumValues: f.enum,
    }));

    return {
      modelId: `model_${Date.now()}`,
      modelName,
      tableName,
      fields: modelFields,
      relationships: [],
      indexes: [],
      timestamps: options?.timestamps ?? true,
      softDeletes: options?.softDeletes ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Create a table from model
   */
  async createTable(model: DataModel) {
    return this.manager.createTable(model);
  }

  /**
   * Drop a table
   */
  async dropTable(tableName: string, cascade?: boolean) {
    return this.manager.dropTable(tableName, cascade);
  }

  /**
   * List all tables
   */
  async listTables() {
    return this.manager.listTables();
  }

  /**
   * Generate CRUD operations for a model
   */
  generateCRUD(model: DataModel) {
    return this.manager.generateCRUD(model);
  }

  /**
   * Generate seed data for a table
   */
  generateSeedData(tableName: string, count: number) {
    return this.manager.generateSeedData(tableName, count);
  }

  /**
   * Insert data
   */
  async insert(tableName: string, data: Record<string, unknown>) {
    return this.manager.insert(tableName, data);
  }

  /**
   * Select data
   */
  async select(tableName: string, filters?: Record<string, unknown>, options?: any) {
    return this.manager.select(tableName, filters, options);
  }

  /**
   * Update data
   */
  async update(tableName: string, id: string | number, data: Record<string, unknown>) {
    return this.manager.update(tableName, id, data);
  }

  /**
   * Delete data
   */
  async delete(tableName: string, id: string | number) {
    return this.manager.delete(tableName, id);
  }

  /**
   * Count records
   */
  async count(tableName: string, filters?: Record<string, unknown>) {
    return this.manager.count(tableName, filters);
  }

  /**
   * Example: Create a users table model
   */
  async createUsersTable() {
    const model = this.createModel('User', 'users', [
      { name: 'id', type: 'uuid', required: true },
      { name: 'email', type: 'string', required: true, unique: true, indexed: true },
      { name: 'name', type: 'string', required: true },
      { name: 'age', type: 'number', required: false },
      { name: 'status', type: 'enum', enum: ['active', 'inactive', 'suspended'], default: 'active' },
    ], { timestamps: true, softDeletes: true });

    await this.createTable(model);

    return model;
  }

  /**
   * Example: Create a posts table with foreign key to users
   */
  async createPostsTable() {
    const model = this.createModel('Post', 'posts', [
      { name: 'id', type: 'uuid', required: true },
      { name: 'userId', type: 'uuid', required: true, indexed: true },
      { name: 'title', type: 'string', required: true },
      { name: 'content', type: 'text', required: true },
      { name: 'published', type: 'boolean', default: false },
    ], { timestamps: true, softDeletes: true });

    await this.createTable(model);

    return model;
  }

  /**
   * Example: Create blog schema with users and posts
   */
  async createBlogSchema() {
    const usersModel = await this.createUsersTable();
    const postsModel = await this.createPostsTable();

    const crud = {
      users: this.generateCRUD(usersModel),
      posts: this.generateCRUD(postsModel),
    };

    return {
      users: usersModel,
      posts: postsModel,
      crud,
    };
  }

  /**
   * Example: Create e-commerce schema
   */
  async createEcommerceSchema() {
    const customersModel = this.createModel('Customer', 'customers', [
      { name: 'id', type: 'uuid', required: true },
      { name: 'email', type: 'string', required: true, unique: true },
      { name: 'name', type: 'string', required: true },
      { name: 'phone', type: 'string' },
    ], { timestamps: true });

    const productsModel = this.createModel('Product', 'products', [
      { name: 'id', type: 'uuid', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'price', type: 'decimal', required: true },
      { name: 'stock', type: 'number', default: 0 },
    ], { timestamps: true });

    const ordersModel = this.createModel('Order', 'orders', [
      { name: 'id', type: 'uuid', required: true },
      { name: 'customerId', type: 'uuid', required: true, indexed: true },
      { name: 'total', type: 'decimal', required: true },
      { name: 'status', type: 'enum', enum: ['pending', 'processing', 'shipped', 'delivered'], default: 'pending' },
    ], { timestamps: true });

    await this.createTable(customersModel);
    await this.createTable(productsModel);
    await this.createTable(ordersModel);

    return {
      customers: customersModel,
      products: productsModel,
      orders: ordersModel,
    };
  }
}

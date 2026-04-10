/**
 * Database Integration Types
 * Types for schema generation, migrations, and CRUD operations
 */

export type DataType = 'string' | 'number' | 'boolean' | 'date' | 'timestamp' | 'enum' | 'json' | 'uuid' | 'text' | 'integer' | 'bigint' | 'decimal' | 'boolean';
export type ColumnConstraint = 'primary_key' | 'not_null' | 'unique' | 'check' | 'default' | 'foreign_key';
export type IndexType = 'btree' | 'hash' | 'gin' | 'gist' | 'spgist' | 'brin';
export type RelationshipType = 'one_to_one' | 'one_to_many' | 'many_to_many';
export type MigrationAction = 'create_table' | 'drop_table' | 'add_column' | 'drop_column' | 'alter_column' | 'create_index' | 'drop_index' | 'create_constraint' | 'drop_constraint' | 'create_relationship' | 'drop_relationship';
export type ConstraintAction = 'cascade' | 'restrict' | 'set_null' | 'set_default' | 'no_action';

export interface ColumnDefinition {
  columnName: string;
  dataType: DataType;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  defaultValue?: unknown;
  checkConstraint?: string;
  foreignKey?: ForeignKeyDefinition;
  enumValues?: string[]; // for enum type
  precision?: number; // for decimal type
  scale?: number; // for decimal type
  maxLength?: number; // for string/text types
}

export interface ForeignKeyDefinition {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  onUpdate: ConstraintAction;
  onDelete: ConstraintAction;
}

export interface IndexDefinition {
  indexName: string;
  tableName: string;
  columns: string[];
  isUnique: boolean;
  indexType: IndexType;
  whereClause?: string; // for partial indexes
}

export interface CheckConstraint {
  constraintName: string;
  tableName: string;
  expression: string;
}

export interface TableDefinition {
  tableName: string;
  columns: ColumnDefinition[];
  indexes: IndexDefinition[];
  constraints: CheckConstraint[];
  primaryKey: string | string[]; // can be composite
  timestamps?: boolean; // adds created_at and updated_at
  softDeletes?: boolean; // adds deleted_at
}

export interface RelationshipDefinition {
  relationshipId: string;
  relationshipName: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  relationshipType: RelationshipType;
  onUpdate: ConstraintAction;
  onDelete: ConstraintAction;
  isOwningSide: boolean;
}

export interface DataModel {
  modelId: string;
  modelName: string;
  tableName: string;
  description?: string;
  fields: ModelField[];
  relationships: RelationshipDefinition[];
  indexes: IndexDefinition[];
  timestamps: boolean;
  softDeletes: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelField {
  fieldId: string;
  fieldName: string;
  columnName: string;
  dataType: DataType;
  isRequired: boolean;
  isUnique: boolean;
  isIndexed: boolean;
  defaultValue?: unknown;
  validation?: FieldValidation;
  enumValues?: string[];
  description?: string;
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  custom?: string; // custom validation expression
}

export interface Migration {
  migrationId: string;
  version: string;
  description?: string;
  upStatements: string[];
  downStatements: string[];
  appliedAt?: Date;
  rolledBackAt?: Date;
  status: 'pending' | 'applied' | 'rolled_back' | 'failed';
}

export interface SeedData {
  seedId: string;
  tableName: string;
  data: Record<string, unknown>[];
  dependencies: string[]; // tables that must be seeded first
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  poolMin?: number;
  poolMax?: number;
  poolIdleTimeout?: number;
}

export interface CRUDOperations {
  create: string;
  read: string;
  update: string;
  delete: string;
  list: string;
  count: string;
}

export interface GeneratedCRUD {
  modelName: string;
  tableName: string;
  operations: CRUDOperations;
  typeScriptTypes: string;
  validationSchema: string;
}

export interface DatabaseMigration {
  // Schema operations
  generateSchema(model: DataModel): TableDefinition;
  generateIndexes(model: DataModel): IndexDefinition[];
  generateRelationships(models: DataModel[]): RelationshipDefinition[];
  
  // Migration operations
  createMigration(version: string, description: string, up: string[], down: string[]): Migration;
  applyMigration(migration: Migration): Promise<void>;
  rollbackMigration(migration: Migration): Promise<void>;
  getMigrationHistory(): Promise<Migration[]>;
  
  // CRUD generation
  generateCRUD(model: DataModel): GeneratedCRUD;
  
  // Seed data
  generateSeedData(tableName: string, count: number): SeedData;
  applySeeds(seeds: SeedData[]): Promise<void>;
  
  // Connection
  connect(config: DatabaseConfig): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<boolean>;
  
  // Query builder helpers
  buildInsertQuery(tableName: string, data: Record<string, unknown>): string;
  buildUpdateQuery(tableName: string, id: string | number, data: Record<string, unknown>): string;
  buildSelectQuery(tableName: string, filters?: Record<string, unknown>): string;
  buildDeleteQuery(tableName: string, id: string | number): string;
  buildCountQuery(tableName: string, filters?: Record<string, unknown>): string;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  fields: string[];
  duration: number; // in milliseconds
}

export interface Transaction {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
}

export interface TableAlteration {
  type: 'add_column' | 'drop_column' | 'rename_column' | 'alter_column_type';
  columnName?: string;
  dataType?: string;
  from?: string;
  to?: string;
}

export interface SelectOptions {
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
  include?: string[]; // for eager loading relations
}

export interface DatabaseManager {
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<boolean>;
  getConfig(): DatabaseConfig;
  updateConfig(config: Partial<DatabaseConfig>): void;
  
  // Schema operations
  createTable(model: DataModel): Promise<void>;
  dropTable(tableName: string, cascade?: boolean): Promise<void>;
  alterTable(tableName: string, alterations: TableAlteration[]): Promise<void>;
  listTables(): Promise<string[]>;
  describeTable(tableName: string): Promise<TableDefinition>;
  
  // Index operations
  createIndex(index: IndexDefinition): Promise<void>;
  dropIndex(indexName: string): Promise<void>;
  listIndexes(tableName?: string): Promise<IndexDefinition[]>;
  
  // Relationship operations
  createRelationship(relationship: RelationshipDefinition): Promise<void>;
  dropRelationship(relationshipName: string): Promise<void>;
  listRelationships(): Promise<RelationshipDefinition[]>;
  
  // Data operations
  insert(tableName: string, data: Record<string, unknown>): Promise<QueryResult>;
  select(tableName: string, filters?: Record<string, unknown>, options?: SelectOptions): Promise<QueryResult>;
  update(tableName: string, id: string | number, data: Record<string, unknown>): Promise<QueryResult>;
  delete(tableName: string, id: string | number): Promise<QueryResult>;
  count(tableName: string, filters?: Record<string, unknown>): Promise<number>;
  
  // Transaction support
  transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T>;
  
  // Migration management
  runMigrations(): Promise<void>;
  rollbackMigration(version?: string): Promise<void>;
  getMigrationStatus(): Promise<Migration[]>;
  
  // Seed data
  seed(tableName: string, data: Record<string, unknown>[]): Promise<void>;
  seedAll(): Promise<void>;
  
  // Utilities
  escapeIdentifier(identifier: string): string;
  quoteValue(value: unknown): string;
}

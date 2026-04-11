/**
 * Database Manager Implementation
 * Handles schema generation, migrations, CRUD operations, and seed data
 */

import crypto from 'crypto';
import {
  DataModel,
  TableDefinition,
  ColumnDefinition,
  IndexDefinition,
  RelationshipDefinition,
  Migration,
  SeedData,
  DatabaseConfig,
  DatabaseManager,
  GeneratedCRUD,
  QueryResult,
  Transaction,
  TableAlteration,
  SelectOptions,
  DataType,
  ConstraintAction,
  IndexType,
} from './types';

export class PostgreSQLDatabaseManager implements DatabaseManager {
  private config: DatabaseConfig | null = null;
  private migrations: Map<string, Migration> = new Map();
  private seeds: Map<string, SeedData> = new Map();
  private isConnected: boolean = false;

  async connect(): Promise<void> {
    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
  }

  async testConnection(): Promise<boolean> {
    return this.isConnected;
  }

  getConfig(): DatabaseConfig {
    if (!this.config) {
      throw new Error('Database not configured');
    }
    return this.config;
  }

  updateConfig(config: Partial<DatabaseConfig>): void {
    this.config = { ...this.config, ...config } as DatabaseConfig;
  }

  async createTable(model: DataModel): Promise<void> {
    const table = this.generateSchema(model);
    const createSQL = this.buildCreateTableSQL(table);

    // Execute the create table statement
    await this.executeDirect(createSQL);

    // Create indexes
    for (const index of table.indexes) {
      await this.createIndex(index);
    }
  }

  async dropTable(tableName: string, cascade: boolean = false): Promise<void> {
    const sql = `DROP TABLE IF EXISTS ${this.escapeIdentifier(tableName)}${cascade ? ' CASCADE' : ''}`;
    await this.executeDirect(sql);
  }

  async alterTable(tableName: string, alterations: TableAlteration[]): Promise<void> {
    for (const alteration of alterations) {
      const sql = this.buildAlterTableSQL(tableName, alteration);
      await this.executeDirect(sql);
    }
  }

  async listTables(): Promise<string[]> {
    // Query information_schema to get all tables
    const result = await this.executeDirect(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    return result.rows.map((row) => row.table_name as string);
  }

  async describeTable(tableName: string): Promise<TableDefinition> {
    // Get columns
    const columnsResult = await this.executeDirect(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = '${tableName}'
      ORDER BY ordinal_position
    `);

    // Get primary key
    const pkResult = await this.executeDirect(`
      SELECT column_name
      FROM information_schema.key_column_usage
      WHERE table_name = '${tableName}' AND constraint_name LIKE '%pkey'
    `);

    const columns: ColumnDefinition[] = columnsResult.rows.map((row) => ({
      columnName: row.column_name as string,
      dataType: this.mapPostgresType(row.data_type as string),
      isNullable: row.is_nullable === 'YES',
      isPrimaryKey: pkResult.rows.some((pk) => pk.column_name === row.column_name),
      isUnique: false,
    }));

    // Get indexes
    const indexes = await this.listIndexes(tableName);

    return {
      tableName,
      columns,
      indexes,
      constraints: [],
      primaryKey: (pkResult.rows[0]?.column_name as string) || 'id',
    };
  }

  async createIndex(index: IndexDefinition): Promise<void> {
    const sql = this.buildCreateIndexSQL(index);
    await this.executeDirect(sql);
  }

  async dropIndex(indexName: string): Promise<void> {
    await this.executeDirect(`DROP INDEX IF EXISTS ${this.escapeIdentifier(indexName)}`);
  }

  async listIndexes(tableName?: string): Promise<IndexDefinition[]> {
    let sql = `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
    `;

    if (tableName) {
      sql += ` AND tablename = '${tableName}'`;
    }

    const result = await this.executeDirect(sql);

    return result.rows.map((row) => {
      const indexDef = row.indexdef as string;
      const isUnique = indexDef.includes('UNIQUE');
      const columnsMatch = indexDef.match(/\(([^)]+)\)/);
      const columns = columnsMatch ? columnsMatch[1].split(',').map((c) => c.trim()) : [];

      return {
        indexName: row.indexname as string,
        tableName: tableName || '',
        columns,
        isUnique,
        indexType: this.detectIndexType(indexDef),
      };
    });
  }

  async createRelationship(relationship: RelationshipDefinition): Promise<void> {
    const sql = this.buildAddForeignKeySQL(relationship);
    await this.executeDirect(sql);
  }

  async dropRelationship(relationshipName: string): Promise<void> {
    await this.executeDirect(`ALTER TABLE DROP CONSTRAINT IF EXISTS ${this.escapeIdentifier(relationshipName)}`);
  }

  async listRelationships(): Promise<RelationshipDefinition[]> {
    const result = await this.executeDirect(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
    `);

    return result.rows.map((row) => ({
      relationshipId: row.constraint_name as string,
      relationshipName: row.constraint_name as string,
      sourceTable: row.table_name as string,
      sourceColumn: row.column_name as string,
      targetTable: row.foreign_table_name as string,
      targetColumn: row.foreign_column_name as string,
      relationshipType: 'one_to_many' as const,
      onUpdate: row.update_rule as ConstraintAction,
      onDelete: row.delete_rule as ConstraintAction,
      isOwningSide: true,
    }));
  }

  async insert(tableName: string, data: Record<string, unknown>): Promise<QueryResult> {
    const sql = this.buildInsertQuery(tableName, data);
    return this.executeDirect(sql);
  }

  async select(
    tableName: string,
    filters?: Record<string, unknown>,
    options?: SelectOptions
  ): Promise<QueryResult> {
    const sql = this.buildSelectQuery(tableName, filters, options);
    return this.executeDirect(sql);
  }

  async update(tableName: string, id: string | number, data: Record<string, unknown>): Promise<QueryResult> {
    const sql = this.buildUpdateQuery(tableName, id, data);
    return this.executeDirect(sql);
  }

  async delete(tableName: string, id: string | number): Promise<QueryResult> {
    const sql = this.buildDeleteQuery(tableName, id);
    return this.executeDirect(sql);
  }

  async count(tableName: string, filters?: Record<string, unknown>): Promise<number> {
    const sql = this.buildCountQuery(tableName, filters);
    const result = await this.executeDirect(sql);
    return parseInt(result.rows[0]?.count as string, 10) || 0;
  }

  async transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> {
    const tx: Transaction = {
      async begin() {},
      async commit() {},
      async rollback() {},
      async execute(sql: string, params?: unknown[]) {
        return this.execute(sql, params);
      },
    };

    await tx.begin();
    try {
      const result = await callback(tx);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  async runMigrations(): Promise<void> {
    for (const migration of this.migrations.values()) {
      if (migration.status === 'pending') {
        try {
          for (const statement of migration.upStatements) {
            await this.executeDirect(statement);
          }
          migration.status = 'applied';
          migration.appliedAt = new Date();
        } catch (error) {
          migration.status = 'failed';
          throw error;
        }
      }
    }
  }

  async rollbackMigration(version?: string): Promise<void> {
    const migrationToRollback = version
      ? this.migrations.get(version)
      : Array.from(this.migrations.values()).find((m) => m.status === 'applied');

    if (!migrationToRollback) {
      throw new Error('No migration to rollback');
    }

    for (const statement of migrationToRollback.downStatements.reverse()) {
      await this.executeDirect(statement);
    }

    migrationToRollback.status = 'rolled_back';
    migrationToRollback.rolledBackAt = new Date();
  }

  async getMigrationStatus(): Promise<Migration[]> {
    return Array.from(this.migrations.values());
  }

  async seed(tableName: string, data: Record<string, unknown>[]): Promise<void> {
    for (const row of data) {
      await this.insert(tableName, row);
    }
  }

  async seedAll(): Promise<void> {
    const sortedSeeds = Array.from(this.seeds.values()).sort((a, b) => a.dependencies.length - b.dependencies.length);

    for (const seed of sortedSeeds) {
      await this.seed(seed.tableName, seed.data);
    }
  }

  escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  quoteValue(value: unknown): string {
    if (value === null) return 'NULL';
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (value instanceof Date) return `'${value.toISOString()}'`;
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }

  // Schema generation methods
  generateSchema(model: DataModel): TableDefinition {
    const columns: ColumnDefinition[] = [];

    for (const field of model.fields) {
      const column: ColumnDefinition = {
        columnName: field.columnName,
        dataType: field.dataType,
        isNullable: !field.isRequired,
        isPrimaryKey: field.fieldName.toLowerCase() === 'id',
        isUnique: field.isUnique,
        defaultValue: field.defaultValue,
        enumValues: field.enumValues,
      };

      if (field.dataType === 'enum' && field.enumValues) {
        // Handle enum type
      }

      columns.push(column);
    }

    // Add timestamps
    if (model.timestamps) {
      columns.push({
        columnName: 'created_at',
        dataType: 'timestamp',
        isNullable: false,
        isPrimaryKey: false,
        isUnique: false,
        defaultValue: 'CURRENT_TIMESTAMP',
      });
      columns.push({
        columnName: 'updated_at',
        dataType: 'timestamp',
        isNullable: false,
        isPrimaryKey: false,
        isUnique: false,
        defaultValue: 'CURRENT_TIMESTAMP',
      });
    }

    // Add soft deletes
    if (model.softDeletes) {
      columns.push({
        columnName: 'deleted_at',
        dataType: 'timestamp',
        isNullable: true,
        isPrimaryKey: false,
        isUnique: false,
      });
    }

    return {
      tableName: model.tableName,
      columns,
      indexes: model.indexes,
      constraints: [],
      primaryKey: model.fields.find((f) => f.fieldName.toLowerCase() === 'id')?.columnName || 'id',
      timestamps: model.timestamps,
      softDeletes: model.softDeletes,
    };
  }

  generateIndexes(model: DataModel): IndexDefinition[] {
    const indexes: IndexDefinition[] = [];

    for (const field of model.fields) {
      if (field.isIndexed) {
        indexes.push({
          indexName: `idx_${model.tableName}_${field.columnName}`,
          tableName: model.tableName,
          columns: [field.columnName],
          isUnique: field.isUnique,
          indexType: 'btree',
        });
      }
    }

    return indexes;
  }

  generateRelationships(models: DataModel[]): RelationshipDefinition[] {
    const relationships: RelationshipDefinition[] = [];

    for (const model of models) {
      for (const rel of model.relationships) {
        relationships.push(rel);
      }
    }

    return relationships;
  }

  // CRUD generation
  generateCRUD(model: DataModel): GeneratedCRUD {
    const operations = this.generateOperations(model);
    const typeScriptTypes = this.generateTypeScriptTypes(model);
    const validationSchema = this.generateValidationSchema(model);

    return {
      modelName: model.modelName,
      tableName: model.tableName,
      operations,
      typeScriptTypes,
      validationSchema,
    };
  }

  // Seed data generation
  generateSeedData(tableName: string, count: number): SeedData {
    const data: Record<string, unknown>[] = [];

    for (let i = 0; i < count; i++) {
      data.push({
        id: this.generateId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return {
      seedId: `seed_${tableName}`,
      tableName,
      data,
      dependencies: [],
    };
  }

  // SQL query builders
  buildInsertQuery(tableName: string, data: Record<string, unknown>): string {
    const columns = Object.keys(data);
    const values = Object.values(data).map((v) => this.quoteValue(v));

    return `INSERT INTO ${this.escapeIdentifier(tableName)} (${columns.map((c) => this.escapeIdentifier(c)).join(', ')}) VALUES (${values.join(', ')})`;
  }

  buildUpdateQuery(tableName: string, id: string | number, data: Record<string, unknown>): string {
    const setClauses = Object.entries(data)
      .map(([k, v]) => `${this.escapeIdentifier(k)} = ${this.quoteValue(v)}`)
      .join(', ');

    return `UPDATE ${this.escapeIdentifier(tableName)} SET ${setClauses} WHERE id = ${this.quoteValue(id)}`;
  }

  buildSelectQuery(
    tableName: string,
    filters?: Record<string, unknown>,
    options?: SelectOptions
  ): string {
    let sql = `SELECT * FROM ${this.escapeIdentifier(tableName)}`;

    if (filters) {
      const whereClauses = Object.entries(filters)
        .map(([k, v]) => `${this.escapeIdentifier(k)} = ${this.quoteValue(v)}`)
        .join(' AND ');
      sql += ` WHERE ${whereClauses}`;
    }

    if (options?.orderBy) {
      sql += ` ORDER BY ${this.escapeIdentifier(options.orderBy)}`;
      if (options.orderDirection) {
        sql += ` ${options.orderDirection}`;
      }
    }

    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`;
    }

    if (options?.offset) {
      sql += ` OFFSET ${options.offset}`;
    }

    return sql;
  }

  buildDeleteQuery(tableName: string, id: string | number): string {
    return `DELETE FROM ${this.escapeIdentifier(tableName)} WHERE id = ${this.quoteValue(id)}`;
  }

  buildCountQuery(tableName: string, filters?: Record<string, unknown>): string {
    let sql = `SELECT COUNT(*) as count FROM ${this.escapeIdentifier(tableName)}`;

    if (filters) {
      const whereClauses = Object.entries(filters)
        .map(([k, v]) => `${this.escapeIdentifier(k)} = ${this.quoteValue(v)}`)
        .join(' AND ');
      sql += ` WHERE ${whereClauses}`;
    }

    return sql;
  }

  buildCreateTableSQL(table: TableDefinition): string {
    const columnDefs = table.columns.map((col) => {
      let def = this.escapeIdentifier(col.columnName);
      def += ` ${this.getPostgresType(col)}`;

      if (!col.isNullable) {
        def += ' NOT NULL';
      }

      if (col.isUnique) {
        def += ' UNIQUE';
      }

      if (col.defaultValue !== undefined) {
        def += ` DEFAULT ${this.quoteValue(col.defaultValue)}`;
      }

      return def;
    });

    // Add primary key
    const pkColumns = Array.isArray(table.primaryKey) ? table.primaryKey : [table.primaryKey];
    if (pkColumns.length > 0) {
      columnDefs.push(`PRIMARY KEY (${pkColumns.map((c) => this.escapeIdentifier(c)).join(', ')})`);
    }

    return `CREATE TABLE ${this.escapeIdentifier(table.tableName)} (\n  ${columnDefs.join(',\n  ')}\n)`;
  }

  buildCreateIndexSQL(index: IndexDefinition): string {
    const unique = index.isUnique ? 'UNIQUE ' : '';
    const columns = index.columns.map((c) => this.escapeIdentifier(c)).join(', ');

    return `CREATE ${unique}INDEX ${this.escapeIdentifier(index.indexName)} ON ${this.escapeIdentifier(index.tableName)} (${columns})`;
  }

  buildAddForeignKeySQL(rel: RelationshipDefinition): string {
    return `ALTER TABLE ${this.escapeIdentifier(rel.sourceTable)} ADD CONSTRAINT ${this.escapeIdentifier(rel.relationshipName)} FOREIGN KEY (${this.escapeIdentifier(rel.sourceColumn)}) REFERENCES ${this.escapeIdentifier(rel.targetTable)}(${this.escapeIdentifier(rel.targetColumn)}) ON UPDATE ${rel.onUpdate} ON DELETE ${rel.onDelete}`;
  }

  buildAlterTableSQL(tableName: string, alteration: TableAlteration): string {
    switch (alteration.type) {
      case 'add_column':
        return `ALTER TABLE ${this.escapeIdentifier(tableName)} ADD COLUMN ${this.escapeIdentifier(alteration.columnName || '')} ${alteration.dataType || 'VARCHAR(255)'}`;
      case 'drop_column':
        return `ALTER TABLE ${this.escapeIdentifier(tableName)} DROP COLUMN ${this.escapeIdentifier(alteration.columnName || '')}`;
      case 'rename_column':
        return `ALTER TABLE ${this.escapeIdentifier(tableName)} RENAME COLUMN ${this.escapeIdentifier(alteration.from || '')} TO ${this.escapeIdentifier(alteration.to || '')}`;
      default:
        throw new Error(`Unknown alteration type: ${alteration.type}`);
    }
  }

  private buildCreateMigrationSQL(migration: Migration): string[] {
    return migration.upStatements;
  }

  private generateOperations(model: DataModel): GeneratedCRUD['operations'] {
    const tableName = model.tableName;

    return {
      create: this.buildInsertQuery(tableName, {}).replace('VALUES ()', 'VALUES ($1)'),
      read: `SELECT * FROM ${this.escapeIdentifier(tableName)} WHERE id = $1`,
      update: this.buildUpdateQuery(tableName, 0, {}).replace('WHERE id = $0', 'WHERE id = $1'),
      delete: this.buildDeleteQuery(tableName, 0).replace('WHERE id = 0', 'WHERE id = $1'),
      list: `SELECT * FROM ${this.escapeIdentifier(tableName)} LIMIT $1 OFFSET $2`,
      count: `SELECT COUNT(*) as count FROM ${this.escapeIdentifier(tableName)}`,
    };
  }

  private generateTypeScriptTypes(model: DataModel): string {
    const interfaceName = `${model.modelName}Type`;

    const fields = model.fields
      .map((field) => {
        const tsType = this.getTypeScriptType(field.dataType, field.enumValues);
        const optional = field.isRequired ? '' : '?';
        return `  ${field.fieldName}${optional}: ${tsType};`;
      })
      .join('\n');

    return `export interface ${interfaceName} {\n${fields}\n}`;
  }

  private generateValidationSchema(model: DataModel): string {
    const rules: string[] = [];

    for (const field of model.fields) {
      if (field.isRequired) {
        rules.push(`${field.fieldName}: { required: true }`);
      }

      if (field.validation?.minLength) {
        rules.push(`${field.fieldName}: { minLength: ${field.validation.minLength} }`);
      }

      if (field.validation?.maxLength) {
        rules.push(`${field.fieldName}: { maxLength: ${field.validation.maxLength} }`);
      }
    }

    return `const schema = {\n  ${rules.join(',\n  ')}\n}`;
  }

  private getPostgresType(column: ColumnDefinition): string {
    switch (column.dataType) {
      case 'string':
        return column.maxLength ? `VARCHAR(${column.maxLength})` : 'VARCHAR(255)';
      case 'text':
        return 'TEXT';
      case 'number':
        return 'INTEGER';
      case 'bigint':
        return 'BIGINT';
      case 'decimal':
        return column.precision ? `DECIMAL(${column.precision},${column.scale || 0})` : 'DECIMAL(10,2)';
      case 'boolean':
        return 'BOOLEAN';
      case 'date':
        return 'DATE';
      case 'timestamp':
        return 'TIMESTAMP';
      case 'uuid':
        return 'UUID';
      case 'json':
        return 'JSONB';
      case 'enum':
        return column.enumValues ? `ENUM('${column.enumValues.join("', '")}')` : 'VARCHAR(50)';
      default:
        return 'VARCHAR(255)';
    }
  }

  private mapPostgresType(pgType: string): DataType {
    const typeMap: Record<string, DataType> = {
      varchar: 'string',
      text: 'text',
      integer: 'number',
      bigint: 'bigint',
      decimal: 'decimal',
      numeric: 'decimal',
      boolean: 'boolean',
      date: 'date',
      timestamp: 'timestamp',
      timestamptz: 'timestamp',
      uuid: 'uuid',
      jsonb: 'json',
      json: 'json',
    };

    return typeMap[pgType.toLowerCase()] || 'string';
  }

  private getTypeScriptType(dataType: DataType, enumValues?: string[]): string {
    if (dataType === 'enum' && enumValues) {
      return enumValues.map((v) => `'${v}'`).join(' | ');
    }

    const typeMap: Record<DataType, string> = {
      string: 'string',
      text: 'string',
      number: 'number',
      integer: 'number',
      bigint: 'number',
      decimal: 'number',
      boolean: 'boolean',
      date: 'string',
      timestamp: 'Date',
      uuid: 'string',
      json: 'Record<string, unknown>',
      enum: 'string',
    };

    return typeMap[dataType] || 'any';
  }

  private detectIndexType(indexDef: string): IndexType {
    if (indexDef.includes('USING hash')) return 'hash';
    if (indexDef.includes('USING gin')) return 'gin';
    if (indexDef.includes('USING gist')) return 'gist';
    if (indexDef.includes('USING spgist')) return 'spgist';
    if (indexDef.includes('USING brin')) return 'brin';
    return 'btree';
  }

  private async executeDirect(_sql: string): Promise<QueryResult> {
    const start = Date.now();

    // Simulate execution
    return {
      rows: [],
      rowCount: 0,
      fields: [],
      duration: Date.now() - start,
    };
  }

  private generateId(): string {
    return crypto.randomBytes(12).toString('hex');
  }
}

import {
  generateId,
  ConnectionManager,
  SchemaManager,
  DimensionManager,
  FactManager,
  AggregateManager,
  DataModelManager,
  ETLPipelineManager,
  DataQualityChecker,
  QueryOptimizer,
  LineageTracker,
  MetricCalculator,
  DataWarehouse,
  DataWarehouseManager,
  WarehouseConnection,
  TableSchema,
  ColumnDefinition,
  SchemaType,
  DimensionTable,
  FactTable,
  AggregateTable,
  DataModel,
  DataModelType,
  ETLStage,
  ETLConfig,
  ETLExecution,
  RetryConfig,
  DataQualityRule,
  DataQualityResult,
  DataQualityReport,
  QueryOptimizationHint,
  OptimizerConfig,
  QueryProfile,
  LineageNode,
  LineageNodeType,
  LineageEdge,
  DataLineage,
  ColumnLineage,
  DataFlowGraph,
  MetricDefinition,
  DataWarehouseStats,
  WarehouseOptions,
} from '../src/core/dataWarehouse';

describe('DataWarehouse Module', () => {
  describe('generateId', () => {
    it('should generate unique IDs with prefix', () => {
      const id1 = generateId('conn');
      const id2 = generateId('conn');
      expect(id1).toMatch(/^conn_[a-f0-9]{16}$/);
      expect(id2).toMatch(/^conn_[a-f0-9]{16}$/);
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with different prefixes', () => {
      const id1 = generateId('warehouse');
      const id2 = generateId('table');
      expect(id1.startsWith('warehouse_')).toBe(true);
      expect(id2.startsWith('table_')).toBe(true);
    });
  });

  describe('ConnectionManager', () => {
    let manager: ConnectionManager;

    beforeEach(() => {
      manager = new ConnectionManager();
    });

    it('should create a connection', () => {
      const connection = manager.createConnection({
        name: 'Test Connection',
        type: 'snowflake',
        host: 'localhost',
        port: 443,
        database: 'testdb',
        schema: 'public',
        username: 'user',
        sslEnabled: true,
        timeout: 30000,
        maxConnections: 10,
      });

      expect(connection.id).toMatch(/^conn_[a-f0-9]{16}$/);
      expect(connection.name).toBe('Test Connection');
      expect(connection.type).toBe('snowflake');
      expect(connection.createdAt).toBeInstanceOf(Date);
    });

    it('should get a connection by id', () => {
      const created = manager.createConnection({
        name: 'Test',
        type: 'bigquery',
        host: 'localhost',
        port: 443,
        database: 'db',
        schema: 'public',
        username: 'user',
        sslEnabled: false,
        timeout: 10000,
        maxConnections: 5,
      });

      const retrieved = manager.getConnection(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test');
    });

    it('should return undefined for non-existent connection', () => {
      const result = manager.getConnection('non-existent');
      expect(result).toBeUndefined();
    });

    it('should get all connections', () => {
      manager.createConnection({
        name: 'Conn1',
        type: 'snowflake',
        host: 'host1',
        port: 443,
        database: 'db1',
        schema: 'public',
        username: 'user',
        sslEnabled: true,
        timeout: 10000,
        maxConnections: 5,
      });

      manager.createConnection({
        name: 'Conn2',
        type: 'redshift',
        host: 'host2',
        port: 5439,
        database: 'db2',
        schema: 'public',
        username: 'user',
        sslEnabled: true,
        timeout: 10000,
        maxConnections: 5,
      });

      const all = manager.getAllConnections();
      expect(all).toHaveLength(2);
    });

    it('should update a connection', () => {
      const created = manager.createConnection({
        name: 'Original',
        type: 'snowflake',
        host: 'localhost',
        port: 443,
        database: 'db',
        schema: 'public',
        username: 'user',
        sslEnabled: true,
        timeout: 10000,
        maxConnections: 5,
      });

      const updated = manager.updateConnection(created.id, { name: 'Updated' });
      expect(updated?.name).toBe('Updated');
    });

    it('should delete a connection', () => {
      const created = manager.createConnection({
        name: 'ToDelete',
        type: 'snowflake',
        host: 'localhost',
        port: 443,
        database: 'db',
        schema: 'public',
        username: 'user',
        sslEnabled: true,
        timeout: 10000,
        maxConnections: 5,
      });

      const result = manager.deleteConnection(created.id);
      expect(result).toBe(true);
      expect(manager.getConnection(created.id)).toBeUndefined();
    });

    it('should serialize and deserialize connection', () => {
      const created = manager.createConnection({
        name: 'Serialization Test',
        type: 'databricks',
        host: 'localhost',
        port: 443,
        database: 'db',
        schema: 'public',
        username: 'user',
        sslEnabled: true,
        timeout: 10000,
        maxConnections: 5,
      });

      const serialized = manager.serializeConnection(created);
      expect(serialized.id).toBe(created.id);
      expect(typeof serialized.createdAt).toBe('string');

      const deserialized = manager.deserializeConnection(serialized);
      expect(deserialized.id).toBe(created.id);
      expect(deserialized.name).toBe('Serialization Test');
    });
  });

  describe('SchemaManager', () => {
    let manager: SchemaManager;
    const warehouseId = 'test_warehouse';

    beforeEach(() => {
      manager = new SchemaManager();
    });

    it('should create a table schema', () => {
      const columns: ColumnDefinition[] = [
        { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'name', dataType: 'string', nullable: true, isPrimaryKey: false, isForeignKey: false },
      ];

      const schema = manager.createTableSchema(warehouseId, 'users', 'dimension', columns);
      expect(schema.id).toMatch(/^tbl_[a-f0-9]{16}$/);
      expect(schema.name).toBe('users');
      expect(schema.type).toBe('dimension');
      expect(schema.columns).toHaveLength(2);
    });

    it('should get table schema by id', () => {
      const columns: ColumnDefinition[] = [
        { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
      ];

      const created = manager.createTableSchema(warehouseId, 'test', 'fact', columns);
      const retrieved = manager.getTableSchema(created.id);
      expect(retrieved?.name).toBe('test');
    });

    it('should get table by name', () => {
      const columns: ColumnDefinition[] = [
        { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
      ];

      manager.createTableSchema(warehouseId, 'products', 'dimension', columns);
      const found = manager.getTableByName(warehouseId, 'products');
      expect(found?.name).toBe('products');
    });

    it('should get all tables for warehouse', () => {
      const columns: ColumnDefinition[] = [
        { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
      ];

      manager.createTableSchema(warehouseId, 'table1', 'fact', columns);
      manager.createTableSchema(warehouseId, 'table2', 'dimension', columns);

      const all = manager.getAllTables(warehouseId);
      expect(all).toHaveLength(2);
    });

    it('should get tables by type', () => {
      const columns: ColumnDefinition[] = [
        { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
      ];

      manager.createTableSchema(warehouseId, 'fact1', 'fact', columns);
      manager.createTableSchema(warehouseId, 'dim1', 'dimension', columns);
      manager.createTableSchema(warehouseId, 'fact2', 'fact', columns);

      const facts = manager.getTablesByType(warehouseId, 'fact');
      expect(facts).toHaveLength(2);
    });

    it('should update table stats', () => {
      const columns: ColumnDefinition[] = [
        { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
      ];

      const schema = manager.createTableSchema(warehouseId, 'stats_test', 'fact', columns);
      manager.updateTableStats(schema.id, 1000, 50000);

      const updated = manager.getTableSchema(schema.id);
      expect(updated?.rowCount).toBe(1000);
      expect(updated?.sizeBytes).toBe(50000);
    });

    it('should add column to table', () => {
      const columns: ColumnDefinition[] = [
        { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
      ];

      const schema = manager.createTableSchema(warehouseId, 'add_col_test', 'dimension', columns);
      manager.addColumn(schema.id, {
        name: 'new_col',
        dataType: 'string',
        nullable: true,
        isPrimaryKey: false,
        isForeignKey: false,
      });

      const updated = manager.getTableSchema(schema.id);
      expect(updated?.columns).toHaveLength(2);
    });

    it('should add partition to table', () => {
      const columns: ColumnDefinition[] = [
        { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'created_at', dataType: 'timestamp', nullable: false, isPrimaryKey: false, isForeignKey: false },
      ];

      const schema = manager.createTableSchema(warehouseId, 'partition_test', 'fact', columns);
      manager.addPartition(schema.id, { column: 'created_at', type: 'range' });

      const updated = manager.getTableSchema(schema.id);
      expect(updated?.partitions).toHaveLength(1);
    });

    it('should add index to table', () => {
      const columns: ColumnDefinition[] = [
        { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'email', dataType: 'string', nullable: true, isPrimaryKey: false, isForeignKey: false },
      ];

      const schema = manager.createTableSchema(warehouseId, 'index_test', 'dimension', columns);
      manager.addIndex(schema.id, { name: 'idx_email', columns: ['email'], unique: true, type: 'btree' });

      const updated = manager.getTableSchema(schema.id);
      expect(updated?.indexes).toHaveLength(1);
    });
  });

  describe('DimensionManager', () => {
    let manager: DimensionManager;
    const warehouseId = 'dim_test_warehouse';

    beforeEach(() => {
      manager = new DimensionManager();
    });

    it('should create a dimension table', () => {
      const dimension = manager.createDimension(
        warehouseId,
        'customers',
        [
          { name: 'customer_id', dataType: 'integer' },
          { name: 'name', dataType: 'string' },
          { name: 'email', dataType: 'string' },
        ]
      );

      expect(dimension.id).toMatch(/^dim_[a-f0-9]{16}$/);
      expect(dimension.name).toBe('customers');
      expect(dimension.type).toBe('dimension');
      expect(dimension.attributes).toHaveLength(3);
    });

    it('should create dimension with slowly changing attributes', () => {
      const dimension = manager.createDimension(
        warehouseId,
        'addresses',
        [
          { name: 'address_id', dataType: 'integer' },
          { name: 'address', dataType: 'string', isSlowlyChanging: true, scdType: 2 },
        ]
      );

      const attr = dimension.attributes.find(a => a.name === 'address');
      expect(attr?.isSlowlyChanging).toBe(true);
      expect(attr?.scdType).toBe(2);
    });

    it('should get dimension by id', () => {
      const created = manager.createDimension(warehouseId, 'test_dim', [
        { name: 'id', dataType: 'integer' },
      ]);

      const retrieved = manager.getDimension(created.id);
      expect(retrieved?.name).toBe('test_dim');
    });

    it('should get all dimensions for warehouse', () => {
      manager.createDimension(warehouseId, 'dim1', [{ name: 'id', dataType: 'integer' }]);
      manager.createDimension(warehouseId, 'dim2', [{ name: 'id', dataType: 'integer' }]);

      const all = manager.getAllDimensions(warehouseId);
      expect(all).toHaveLength(2);
    });

    it('should add slowly changing attribute', () => {
      const dimension = manager.createDimension(warehouseId, 'scd_test', [
        { name: 'id', dataType: 'integer' },
      ]);

      manager.addSlowlyChangingAttribute(dimension.id, {
        name: 'address',
        dataType: 'string',
        scdType: 2,
      });

      const updated = manager.getDimension(dimension.id);
      expect(updated?.attributes).toHaveLength(2);
      expect(updated?.attributes[1].isSlowlyChanging).toBe(true);
    });
  });

  describe('FactManager', () => {
    let manager: FactManager;
    const warehouseId = 'fact_test_warehouse';

    beforeEach(() => {
      manager = new FactManager();
    });

    it('should create a fact table', () => {
      const fact = manager.createFact(
        warehouseId,
        'sales',
        ['amount', 'quantity'],
        'sale_date',
        [{ dimension: 'dim_customers', column: 'customer_id' }]
      );

      expect(fact.id).toMatch(/^fact_[a-f0-9]{16}$/);
      expect(fact.name).toBe('sales');
      expect(fact.type).toBe('fact');
      expect(fact.measureColumns).toEqual(['amount', 'quantity']);
    });

    it('should get fact by id', () => {
      const created = manager.createFact(
        warehouseId,
        'orders',
        ['total'],
        'order_date',
        []
      );

      const retrieved = manager.getFact(created.id);
      expect(retrieved?.name).toBe('orders');
    });

    it('should get all facts for warehouse', () => {
      manager.createFact(warehouseId, 'fact1', ['m1'], 'date1', []);
      manager.createFact(warehouseId, 'fact2', ['m2'], 'date2', []);

      const all = manager.getAllFacts(warehouseId);
      expect(all).toHaveLength(2);
    });
  });

  describe('AggregateManager', () => {
    let manager: AggregateManager;
    const warehouseId = 'agg_test_warehouse';

    beforeEach(() => {
      manager = new AggregateManager();
    });

    it('should create an aggregate table', () => {
      const aggregate = manager.createAggregate(
        warehouseId,
        'monthly_sales',
        ['year', 'month'],
        ['total_sales', 'avg_quantity']
      );

      expect(aggregate.id).toMatch(/^agg_[a-f0-9]{16}$/);
      expect(aggregate.name).toBe('monthly_sales');
      expect(aggregate.type).toBe('aggregate');
      expect(aggregate.rollupLevels).toEqual(['year', 'month']);
    });

    it('should get aggregate by id', () => {
      const created = manager.createAggregate(warehouseId, 'test_agg', ['dim1'], ['measure1']);

      const retrieved = manager.getAggregate(created.id);
      expect(retrieved?.name).toBe('test_agg');
    });

    it('should update refresh schedule', () => {
      const aggregate = manager.createAggregate(warehouseId, 'scheduled_agg', ['col1'], ['measure1']);

      manager.updateRefreshSchedule(aggregate.id, '0 0 * * *');

      const updated = manager.getAggregate(aggregate.id);
      expect(updated?.refreshSchedule).toBe('0 0 * * *');
    });
  });

  describe('DataModelManager', () => {
    let dimensionManager: DimensionManager;
    let factManager: FactManager;
    let manager: DataModelManager;
    const warehouseId = 'model_test_warehouse';

    beforeEach(() => {
      dimensionManager = new DimensionManager();
      factManager = new FactManager();
      manager = new DataModelManager(dimensionManager, factManager);
    });

    it('should create a data model', () => {
      const model = manager.createModel('Sales Model', 'star', warehouseId);

      expect(model.id).toMatch(/^model_[a-f0-9]{16}$/);
      expect(model.name).toBe('Sales Model');
      expect(model.type).toBe('star');
    });

    it('should add table to model', () => {
      const model = manager.createModel('Test Model', 'snowflake', warehouseId);
      const dimension = dimensionManager.createDimension(warehouseId, 'customers', [
        { name: 'id', dataType: 'integer' },
      ]);

      manager.addTable(model.id, dimension.id);

      const updated = manager.getModel(model.id);
      expect(updated?.tables).toContain(dimension.id);
    });

    it('should add relationship to model', () => {
      const model = manager.createModel('Rel Model', 'star', warehouseId);

      manager.addRelationship(model.id, {
        sourceTable: 'fact_sales',
        sourceColumn: 'customer_id',
        targetTable: 'dim_customers',
        targetColumn: 'id',
        type: 'one-to-many',
        isOptional: false,
      });

      const updated = manager.getModel(model.id);
      expect(updated?.relationships).toHaveLength(1);
    });

    it('should get star schema', () => {
      const model = manager.createModel('Star Model', 'star', warehouseId);
      const fact = factManager.createFact(warehouseId, 'sales', ['amount'], 'date', []);
      const dim = dimensionManager.createDimension(warehouseId, 'customers', [
        { name: 'id', dataType: 'integer' },
      ]);

      manager.addTable(model.id, fact.id);
      manager.addTable(model.id, dim.id);

      const schema = manager.getStarSchema(model.id);
      expect(schema.fact).toBeDefined();
      expect(schema.dimensions).toHaveLength(1);
    });
  });

  describe('ETLPipelineManager', () => {
    let schemaManager: SchemaManager;
    let dimensionManager: DimensionManager;
    let factManager: FactManager;
    let aggregateManager: AggregateManager;
    let manager: ETLPipelineManager;

    beforeEach(() => {
      schemaManager = new SchemaManager();
      dimensionManager = new DimensionManager();
      factManager = new FactManager();
      aggregateManager = new AggregateManager();
      manager = new ETLPipelineManager(
        schemaManager,
        dimensionManager,
        factManager,
        aggregateManager
      );
    });

    it('should create an ETL pipeline', () => {
      const pipeline = manager.createPipeline({
        name: 'Test ETL',
        description: 'Test pipeline',
        sourceConnection: {
          id: 'conn1',
          name: 'Source',
          type: 'snowflake',
          host: 'localhost',
          port: 443,
          database: 'db',
          schema: 'public',
          username: 'user',
          sslEnabled: true,
          timeout: 10000,
          maxConnections: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        targetConnection: {
          id: 'conn2',
          name: 'Target',
          type: 'bigquery',
          host: 'localhost',
          port: 443,
          database: 'db',
          schema: 'public',
          username: 'user',
          sslEnabled: true,
          timeout: 10000,
          maxConnections: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        stages: [],
        executionMode: 'sequential',
        errorHandling: 'stop',
        checkpointEnabled: false,
      });

      expect(pipeline.id).toMatch(/^etl_[a-f0-9]{16}$/);
      expect(pipeline.name).toBe('Test ETL');
    });

    it('should get pipeline by id', () => {
      const created = manager.createPipeline({
        name: 'Get Test',
        sourceConnection: {
          id: 'conn1',
          name: 'Source',
          type: 'snowflake',
          host: 'localhost',
          port: 443,
          database: 'db',
          schema: 'public',
          username: 'user',
          sslEnabled: true,
          timeout: 10000,
          maxConnections: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        targetConnection: {
          id: 'conn2',
          name: 'Target',
          type: 'bigquery',
          host: 'localhost',
          port: 443,
          database: 'db',
          schema: 'public',
          username: 'user',
          sslEnabled: true,
          timeout: 10000,
          maxConnections: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        stages: [],
        executionMode: 'sequential',
        errorHandling: 'stop',
        checkpointEnabled: false,
      });

      const retrieved = manager.getPipeline(created.id);
      expect(retrieved?.name).toBe('Get Test');
    });

    it('should execute pipeline', () => {
      const pipeline = manager.createPipeline({
        name: 'Execute Test',
        sourceConnection: {
          id: 'conn1',
          name: 'Source',
          type: 'snowflake',
          host: 'localhost',
          port: 443,
          database: 'db',
          schema: 'public',
          username: 'user',
          sslEnabled: true,
          timeout: 10000,
          maxConnections: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        targetConnection: {
          id: 'conn2',
          name: 'Target',
          type: 'bigquery',
          host: 'localhost',
          port: 443,
          database: 'db',
          schema: 'public',
          username: 'user',
          sslEnabled: true,
          timeout: 10000,
          maxConnections: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        stages: [
          {
            id: 'stage1',
            name: 'Extract',
            type: 'extract',
            order: 0,
            config: {},
          },
        ],
        executionMode: 'sequential',
        errorHandling: 'stop',
        checkpointEnabled: false,
      });

      const execution = manager.executePipeline(pipeline.id);
      expect(execution.id).toMatch(/^exec_[a-f0-9]{16}$/);
      expect(execution.configId).toBe(pipeline.id);
      expect(execution.status).toBe('running');
    });

    it('should get execution by id', async () => {
      const pipeline = manager.createPipeline({
        name: 'Get Exec Test',
        sourceConnection: {
          id: 'conn1',
          name: 'Source',
          type: 'snowflake',
          host: 'localhost',
          port: 443,
          database: 'db',
          schema: 'public',
          username: 'user',
          sslEnabled: true,
          timeout: 10000,
          maxConnections: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        targetConnection: {
          id: 'conn2',
          name: 'Target',
          type: 'bigquery',
          host: 'localhost',
          port: 443,
          database: 'db',
          schema: 'public',
          username: 'user',
          sslEnabled: true,
          timeout: 10000,
          maxConnections: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        stages: [],
        executionMode: 'sequential',
        errorHandling: 'stop',
        checkpointEnabled: false,
      });

      const execution = manager.executePipeline(pipeline.id);

      await new Promise(resolve => setTimeout(resolve, 50));

      const retrieved = manager.getExecution(execution.id);
      expect(retrieved).toBeDefined();
    });
  });

  describe('DataQualityChecker', () => {
    let checker: DataQualityChecker;

    beforeEach(() => {
      checker = new DataQualityChecker();
    });

    it('should create a quality rule', () => {
      const rule = checker.createRule({
        name: 'Not Null Rule',
        targetTable: 'users',
        targetColumn: 'email',
        ruleType: 'not_null',
        severity: 'high',
        action: 'alert',
      });

      expect(rule.id).toMatch(/^rule_[a-f0-9]{16}$/);
      expect(rule.name).toBe('Not Null Rule');
    });

    it('should get rule by id', () => {
      const created = checker.createRule({
        name: 'Test Rule',
        targetTable: 'orders',
        ruleType: 'unique',
        severity: 'medium',
      });

      const retrieved = checker.getRule(created.id);
      expect(retrieved?.name).toBe('Test Rule');
    });

    it('should get rules by table', () => {
      checker.createRule({
        name: 'Rule1',
        targetTable: 'users',
        ruleType: 'not_null',
        severity: 'high',
      });
      checker.createRule({
        name: 'Rule2',
        targetTable: 'users',
        ruleType: 'unique',
        severity: 'medium',
      });

      const rules = checker.getRulesByTable('users');
      expect(rules).toHaveLength(2);
    });

    it('should check rule', async () => {
      const rule = checker.createRule({
        name: 'Check Rule',
        targetTable: 'test',
        targetColumn: 'value',
        ruleType: 'range',
        severity: 'low',
        threshold: 100,
      });

      const result = await checker.checkRule(rule, []);
      expect(result.ruleId).toBe(rule.id);
      expect(result.recordsChecked).toBe(100);
    });

    it('should run quality checks', async () => {
      checker.createRule({
        name: 'Quality Test',
        targetTable: 'quality_table',
        targetColumn: 'col1',
        ruleType: 'not_null',
        severity: 'high',
      });

      const report = await checker.runQualityChecks('warehouse1', 'quality_table');
      expect(report.warehouseId).toBe('warehouse1');
      expect(report.tableName).toBe('quality_table');
    });
  });

  describe('QueryOptimizer', () => {
    let optimizer: QueryOptimizer;

    beforeEach(() => {
      optimizer = new QueryOptimizer();
    });

    it('should analyze query and suggest optimizations', () => {
      const hints = optimizer.analyzeQuery('SELECT * FROM users WHERE id = 1');
      expect(hints.length).toBeGreaterThan(0);
    });

    it('should profile query', () => {
      const profile = optimizer.profileQuery('q1', 'SELECT * FROM test', 100, 1000, 100);
      expect(profile.queryId).toBe('q1');
      expect(profile.executionTime).toBe(100);
      expect(profile.rowsScanned).toBe(1000);
    });

    it('should get optimizer config', () => {
      const config = optimizer.getOptimizerConfig();
      expect(config.enableIndexSuggestions).toBe(true);
      expect(config.enablePartitionPruning).toBe(true);
    });

    it('should update config', () => {
      optimizer.updateConfig({ enableIndexSuggestions: false });
      const config = optimizer.getOptimizerConfig();
      expect(config.enableIndexSuggestions).toBe(false);
    });

    it('should suggest materialized view', () => {
      const suggestion = optimizer.suggestMaterializedView('sales', ['region', 'year'], ['total']);
      expect(suggestion).toContain('CREATE MATERIALIZED VIEW');
    });
  });

  describe('LineageTracker', () => {
    let tracker: LineageTracker;

    beforeEach(() => {
      tracker = new LineageTracker();
    });

    it('should create lineage', () => {
      const lineage = tracker.createLineage('warehouse1');
      expect(lineage.id).toMatch(/^lin_[a-f0-9]{16}$/);
      expect(lineage.warehouseId).toBe('warehouse1');
    });

    it('should add node to lineage', () => {
      const lineage = tracker.createLineage('warehouse1');
      const node = tracker.addNode(lineage.id, 'source_table', 'source', 'source_table');

      expect(node).toBeDefined();
      expect(node?.name).toBe('source_table');
      expect(node?.type).toBe('source');
    });

    it('should add edge to lineage', () => {
      const lineage = tracker.createLineage('warehouse1');
      const sourceNode = tracker.addNode(lineage.id, 'source', 'source', 'src');
      const targetNode = tracker.addNode(lineage.id, 'target', 'output', 'tgt');

      const edge = tracker.addEdge(lineage.id, sourceNode!.id, targetNode!.id, 'data');

      expect(edge).toBeDefined();
      expect(edge?.flowType).toBe('data');
    });

    it('should get lineage by id', () => {
      const created = tracker.createLineage('warehouse1');
      const retrieved = tracker.getLineage(created.id);
      expect(retrieved?.id).toBe(created.id);
    });

    it('should get lineage by warehouse', () => {
      tracker.createLineage('warehouse1');
      const found = tracker.getLineageByWarehouse('warehouse1');
      expect(found?.warehouseId).toBe('warehouse1');
    });

    it('should create flow graph', () => {
      const graph = tracker.createFlowGraph('warehouse1', 'Sales Flow');
      expect(graph.id).toMatch(/^graph_[a-f0-9]{16}$/);
      expect(graph.name).toBe('Sales Flow');
    });

    it('should track column lineage', () => {
      const graph = tracker.createFlowGraph('warehouse1', 'Test Graph');
      const columnLineage = tracker.trackColumnLineage(
        graph.id,
        'source_col',
        'target_col',
        'upper(source_col)'
      );

      expect(columnLineage).toBeDefined();
      expect(columnLineage?.sourceColumn).toBe('source_col');
      expect(columnLineage?.targetColumn).toBe('target_col');
    });

    it('should check if tracking is enabled', () => {
      expect(tracker.isTrackingEnabled()).toBe(true);

      const disabledTracker = new LineageTracker(false);
      expect(disabledTracker.isTrackingEnabled()).toBe(false);
    });
  });

  describe('MetricCalculator', () => {
    let calculator: MetricCalculator;

    beforeEach(() => {
      calculator = new MetricCalculator();
    });

    it('should define a metric', () => {
      const metric = calculator.defineMetric('total_sales', 'sales', 'amount', 'sum');
      expect(metric.id).toMatch(/^metric_[a-f0-9]{16}$/);
      expect(metric.name).toBe('total_sales');
      expect(metric.aggregationType).toBe('sum');
    });

    it('should get metric by id', () => {
      const created = calculator.defineMetric('test_metric', 'orders', 'total', 'count');
      const retrieved = calculator.getMetric(created.id);
      expect(retrieved?.name).toBe('test_metric');
    });

    it('should get all metrics', () => {
      calculator.defineMetric('metric1', 'table1', 'col1', 'sum');
      calculator.defineMetric('metric2', 'table2', 'col2', 'count');

      const all = calculator.getAllMetrics();
      expect(all).toHaveLength(2);
    });

    it('should get metrics by table', () => {
      calculator.defineMetric('m1', 'orders', 'c1', 'sum');
      calculator.defineMetric('m2', 'orders', 'c2', 'avg');
      calculator.defineMetric('m3', 'customers', 'c3', 'count');

      const orderMetrics = calculator.getMetricsByTable('orders');
      expect(orderMetrics).toHaveLength(2);
    });

    it('should calculate metric', () => {
      const metric = calculator.defineMetric('calc_test', 'test', 'value', 'sum');
      const result = calculator.calculateMetric(metric, []);
      expect(typeof result).toBe('number');
    });
  });

  describe('DataWarehouse', () => {
    let warehouse: DataWarehouse;

    beforeEach(() => {
      warehouse = new DataWarehouse({
        connection: {
          name: 'Test Warehouse',
          type: 'snowflake',
          host: 'localhost',
          port: 443,
          database: 'testdb',
          schema: 'public',
          username: 'user',
          sslEnabled: true,
          timeout: 30000,
          maxConnections: 10,
        },
      });
    });

    it('should get warehouse id', () => {
      expect(warehouse.getWarehouseId()).toMatch(/^conn_[a-f0-9]{16}$/);
    });

    it('should get connection manager', () => {
      const connManager = warehouse.getConnectionManager();
      expect(connManager).toBeInstanceOf(ConnectionManager);
    });

    it('should get schema manager', () => {
      const schemaManager = warehouse.getSchemaManager();
      expect(schemaManager).toBeInstanceOf(SchemaManager);
    });

    it('should get dimension manager', () => {
      const dimManager = warehouse.getDimensionManager();
      expect(dimManager).toBeInstanceOf(DimensionManager);
    });

    it('should get fact manager', () => {
      const factManager = warehouse.getFactManager();
      expect(factManager).toBeInstanceOf(FactManager);
    });

    it('should get aggregate manager', () => {
      const aggManager = warehouse.getAggregateManager();
      expect(aggManager).toBeInstanceOf(AggregateManager);
    });

    it('should get model manager', () => {
      const modelManager = warehouse.getModelManager();
      expect(modelManager).toBeInstanceOf(DataModelManager);
    });

    it('should get ETL pipeline manager', () => {
      const etlManager = warehouse.getETLPipelineManager();
      expect(etlManager).toBeInstanceOf(ETLPipelineManager);
    });

    it('should get quality checker', () => {
      const qualityChecker = warehouse.getQualityChecker();
      expect(qualityChecker).toBeInstanceOf(DataQualityChecker);
    });

    it('should get optimizer', () => {
      const optimizer = warehouse.getOptimizer();
      expect(optimizer).toBeInstanceOf(QueryOptimizer);
    });

    it('should get lineage tracker', () => {
      const lineageTracker = warehouse.getLineageTracker();
      expect(lineageTracker).toBeInstanceOf(LineageTracker);
    });

    it('should get metric calculator', () => {
      const metricCalculator = warehouse.getMetricCalculator();
      expect(metricCalculator).toBeInstanceOf(MetricCalculator);
    });

    it('should get stats', () => {
      const stats = warehouse.getStats();
      expect(stats.totalTables).toBe(0);
      expect(stats.activeConnections).toBe(1);
    });

    it('should update query performance stats', () => {
      warehouse.updateStats({
        queryPerformance: {
          avgExecutionTime: 100,
          p50ExecutionTime: 80,
          p95ExecutionTime: 200,
          p99ExecutionTime: 500,
        },
      });
      const stats = warehouse.getStats();
      expect(stats.queryPerformance.avgExecutionTime).toBe(100);
    });
  });

  describe('DataWarehouseManager', () => {
    let manager: DataWarehouseManager;

    beforeEach(() => {
      manager = new DataWarehouseManager();
    });

    it('should create warehouse', () => {
      const warehouse = manager.createWarehouse({
        connection: {
          name: 'Manager Test',
          type: 'bigquery',
          host: 'localhost',
          port: 443,
          database: 'testdb',
          schema: 'public',
          username: 'user',
          sslEnabled: true,
          timeout: 30000,
          maxConnections: 10,
        },
      });

      expect(warehouse.getWarehouseId()).toMatch(/^conn_[a-f0-9]{16}$/);
    });

    it('should get warehouse by id', () => {
      const created = manager.createWarehouse({
        connection: {
          name: 'Get Test',
          type: 'redshift',
          host: 'localhost',
          port: 5439,
          database: 'testdb',
          schema: 'public',
          username: 'user',
          sslEnabled: true,
          timeout: 30000,
          maxConnections: 10,
        },
      });

      const retrieved = manager.getWarehouse(created.getWarehouseId());
      expect(retrieved).toBeDefined();
    });

    it('should return undefined for non-existent warehouse', () => {
      const result = manager.getWarehouse('non-existent');
      expect(result).toBeUndefined();
    });

    it('should get all warehouses', () => {
      manager.createWarehouse({
        connection: {
          name: 'WH1',
          type: 'snowflake',
          host: 'localhost',
          port: 443,
          database: 'db',
          schema: 'public',
          username: 'user',
          sslEnabled: true,
          timeout: 30000,
          maxConnections: 10,
        },
      });
      manager.createWarehouse({
        connection: {
          name: 'WH2',
          type: 'bigquery',
          host: 'localhost',
          port: 443,
          database: 'db',
          schema: 'public',
          username: 'user',
          sslEnabled: true,
          timeout: 30000,
          maxConnections: 10,
        },
      });

      const all = manager.getAllWarehouses();
      expect(all).toHaveLength(2);
    });

    it('should delete warehouse', () => {
      const warehouse = manager.createWarehouse({
        connection: {
          name: 'Delete Test',
          type: 'snowflake',
          host: 'localhost',
          port: 443,
          database: 'db',
          schema: 'public',
          username: 'user',
          sslEnabled: true,
          timeout: 30000,
          maxConnections: 10,
        },
      });

      const id = warehouse.getWarehouseId();
      const result = manager.deleteWarehouse(id);
      expect(result).toBe(true);
      expect(manager.getWarehouse(id)).toBeUndefined();
    });

    it('should get warehouse connection manager', () => {
      const warehouse = manager.createWarehouse({
        connection: {
          name: 'Conn Manager Test',
          type: 'snowflake',
          host: 'localhost',
          port: 443,
          database: 'db',
          schema: 'public',
          username: 'user',
          sslEnabled: true,
          timeout: 30000,
          maxConnections: 10,
        },
      });

      const connManager = manager.getWarehouseConnectionManager(warehouse.getWarehouseId());
      expect(connManager).toBeInstanceOf(ConnectionManager);
    });

    it('should get warehouse stats', () => {
      const warehouse = manager.createWarehouse({
        connection: {
          name: 'Stats Test',
          type: 'snowflake',
          host: 'localhost',
          port: 443,
          database: 'db',
          schema: 'public',
          username: 'user',
          sslEnabled: true,
          timeout: 30000,
          maxConnections: 10,
        },
      });

      const stats = manager.getWarehouseStats(warehouse.getWarehouseId());
      expect(stats).toBeDefined();
      expect(stats?.activeConnections).toBe(1);
    });
  });
});
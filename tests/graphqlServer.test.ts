import {
  GraphQLSchemaDefinition,
  GraphQLObjectType,
  GraphQLInputType,
  GraphQLEnumType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLField,
  GraphQLArg,
  GraphQLDirective,
  CacheConfig,
  DataLoaderOptions,
  AuthConfig,
  ExecutionRequest,
  OperationType,
  SchemaType,
  GraphQLScalarType,
  CacheKeyStrategy,
  GraphQLServerConfig,
  TypeDefinition,
  DirectiveLocation,
  ValidationResult,
} from '../src/core/graphqlServer/types';

import {
  GraphQLServerImpl,
  InMemoryCache,
  DataLoaderImpl,
  DataLoaderRegistryImpl,
  InMemorySubscriptionHandler,
  SchemaBuilderImpl,
  ResolverValidatorImpl,
  AuthHandler,
  QueryHandlerImpl,
  MutationHandlerImpl,
  SubscriptionManagerImpl,
  GraphQLServerMetricsCollector,
  createGraphQLServer,
  createSchemaBuilder,
  createCache,
  createDataLoaderRegistry,
  createSubscriptionHandler,
  createAuthHandler,
  createResolverValidator,
} from '../src/core/graphqlServer/graphqlServer';

describe('GraphQL Server Module', () => {
  describe('Types and Enums', () => {
    it('should define valid operation types', () => {
      const operationTypes: OperationType[] = ['query', 'mutation', 'subscription'];
      expect(operationTypes).toContain('query');
      expect(operationTypes).toContain('mutation');
      expect(operationTypes).toContain('subscription');
    });

    it('should define valid schema types', () => {
      const schemaTypes: SchemaType[] = ['object', 'input', 'enum', 'scalar', 'interface', 'union', 'extension'];
      expect(schemaTypes).toContain('object');
      expect(schemaTypes).toContain('input');
      expect(schemaTypes).toContain('enum');
      expect(schemaTypes).toContain('scalar');
    });

    it('should define valid graphql scalar types', () => {
      const scalarTypes: GraphQLScalarType[] = ['String', 'Int', 'Float', 'Boolean', 'ID'];
      expect(scalarTypes).toContain('String');
      expect(scalarTypes).toContain('Int');
      expect(scalarTypes).toContain('Float');
      expect(scalarTypes).toContain('Boolean');
      expect(scalarTypes).toContain('ID');
    });

    it('should define valid cache key strategies', () => {
      const strategies: CacheKeyStrategy[] = ['field', 'type', 'global'];
      expect(strategies).toContain('field');
      expect(strategies).toContain('type');
      expect(strategies).toContain('global');
    });

    it('should define valid directive locations', () => {
      const locations: DirectiveLocation[] = [
        'QUERY',
        'MUTATION',
        'SUBSCRIPTION',
        'FIELD',
        'FRAGMENT_DEFINITION',
        'FRAGMENT_SPREAD',
        'INLINE_FRAGMENT',
      ];
      expect(locations).toContain('QUERY');
      expect(locations).toContain('FIELD');
    });
  });

  describe('SchemaBuilder', () => {
    let builder: SchemaBuilderImpl;

    beforeEach(() => {
      builder = new SchemaBuilderImpl();
    });

    it('should create object type', () => {
      const objectType = builder.createObjectType({
        fields: [
          { name: 'id', type: 'ID!' },
          { name: 'name', type: 'String!' },
        ],
        description: 'User type',
      });

      expect(objectType.name).toBeDefined();
      expect(objectType.fields).toHaveLength(2);
      expect(objectType.description).toBe('User type');
    });

    it('should create input type', () => {
      const inputType = builder.createInputType({
        fields: [
          { name: 'email', type: 'String!' },
          { name: 'password', type: 'String!' },
        ],
      });

      expect(inputType.name).toBeDefined();
      expect(inputType.fields).toHaveLength(2);
    });

    it('should create enum type', () => {
      const enumType = builder.createEnumType({
        values: [
          { name: 'ACTIVE', value: 'active' },
          { name: 'INACTIVE', value: 'inactive' },
        ],
      });

      expect(enumType.name).toBeDefined();
      expect(enumType.values).toHaveLength(2);
    });

    it('should create interface type', () => {
      const interfaceType = builder.createInterfaceType({
        fields: [
          { name: 'id', type: 'ID!' },
        ],
      });

      expect(interfaceType.name).toBeDefined();
      expect(interfaceType.fields).toHaveLength(1);
    });

    it('should create union type', () => {
      const unionType = builder.createUnionType({
        types: ['TypeA', 'TypeB'],
      });

      expect(unionType.name).toBeDefined();
      expect(unionType.types).toHaveLength(2);
    });

    it('should build schema with query type', () => {
      const queryType: GraphQLObjectType = {
        name: 'Query',
        fields: [
          { name: 'users', type: '[User!]!' },
        ],
      };

      const schema = builder.buildSchema({
        query: queryType,
      });

      expect(schema.queryTypeName).toBe('Query');
      expect(schema.types.size).toBeGreaterThan(0);
      expect(schema.types.get('Query')).toBeDefined();
    });

    it('should build schema with mutation type', () => {
      const queryType: GraphQLObjectType = {
        name: 'Query',
        fields: [{ name: 'users', type: '[User!]!' }],
      };

      const mutationType: GraphQLObjectType = {
        name: 'Mutation',
        fields: [{ name: 'createUser', type: 'User!' }],
      };

      const schema = builder.buildSchema({
        query: queryType,
        mutation: mutationType,
      });

      expect(schema.mutationTypeName).toBe('Mutation');
      expect(schema.types.get('Mutation')).toBeDefined();
    });

    it('should build schema with subscription type', () => {
      const queryType: GraphQLObjectType = {
        name: 'Query',
        fields: [{ name: 'users', type: '[User!]!' }],
      };

      const subscriptionType: GraphQLObjectType = {
        name: 'Subscription',
        fields: [{ name: 'userCreated', type: 'User!' }],
      };

      const schema = builder.buildSchema({
        query: queryType,
        subscription: subscriptionType,
      });

      expect(schema.subscriptionTypeName).toBe('Subscription');
    });

    it('should build schema with custom types', () => {
      const queryType: GraphQLObjectType = {
        name: 'Query',
        fields: [{ name: 'user', type: 'User' }],
      };

      const userType: GraphQLObjectType = {
        name: 'User',
        fields: [
          { name: 'id', type: 'ID!' },
          { name: 'name', type: 'String!' },
        ],
      };

      const schema = builder.buildSchema({
        query: queryType,
        types: [userType],
      });

      expect(schema.types.get('User')).toBeDefined();
    });

    it('should build schema with directives', () => {
      const queryType: GraphQLObjectType = {
        name: 'Query',
        fields: [{ name: 'user', type: 'User' }],
      };

      const directive: GraphQLDirective = {
        name: 'deprecated',
        args: [{ name: 'reason', type: 'String' }],
        locations: ['FIELD_DEFINITION'],
      };

      const schema = builder.buildSchema({
        query: queryType,
        directives: [directive],
      });

      expect(schema.directives.get('deprecated')).toBeDefined();
    });
  });

  describe('InMemoryCache', () => {
    let cache: InMemoryCache;
    const config: CacheConfig = {
      defaultTtl: 1000,
      maxSize: 10,
      keyStrategy: 'field',
    };

    beforeEach(() => {
      cache = new InMemoryCache(config);
    });

    it('should store and retrieve value', async () => {
      await cache.set('key1', { data: 'value' });
      const result = await cache.get('key1');
      expect(result).toEqual({ data: 'value' });
    });

    it('should return null for non-existent key', async () => {
      const result = await cache.get('non_existent');
      expect(result).toBeNull();
    });

    it('should delete key', async () => {
      await cache.set('key1', 'value');
      const deleted = await cache.delete('key1');
      expect(deleted).toBe(true);
      const result = await cache.get('key1');
      expect(result).toBeNull();
    });

    it('should return false when deleting non-existent key', async () => {
      const deleted = await cache.delete('non_existent');
      expect(deleted).toBe(false);
    });

    it('should clear all keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.clear();
      const stats = cache.getStats();
      expect(stats.size).toBe(0);
    });

    it('should track hits and misses', async () => {
      await cache.set('key1', 'value');
      await cache.get('key1');
      await cache.get('key2');
      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should expire entries after ttl', async () => {
      await cache.set('key1', 'value', 50);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const result = await cache.get('key1');
      expect(result).toBeNull();
    });

    it('should enforce max size limit', async () => {
      const smallCache = new InMemoryCache({ defaultTtl: 1000, maxSize: 2, keyStrategy: 'field' });
      await smallCache.set('key1', 'value1');
      await smallCache.set('key2', 'value2');
      await smallCache.set('key3', 'value3');
      const stats = smallCache.getStats();
      expect(stats.size).toBeLessThanOrEqual(2);
    });

    it('should update existing key without increasing size', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key1', 'value2');
      const stats = cache.getStats();
      expect(stats.size).toBe(1);
    });
  });

  describe('DataLoader', () => {
    let registry: DataLoaderRegistryImpl;

    beforeEach(() => {
      registry = new DataLoaderRegistryImpl();
    });

    it('should create data loader', () => {
      const loader = registry.create(
        'test-loader',
        { maxBatchSize: 10, cache: true },
        async (keys) => keys.map((k) => ({ id: k }))
      );
      expect(loader).toBeDefined();
    });

    it('should get created loader', () => {
      registry.create(
        'test-loader',
        { maxBatchSize: 10, cache: true },
        async (keys) => keys.map((k) => ({ id: k }))
      );
      const loader = registry.get('test-loader');
      expect(loader).toBeDefined();
    });

    it('should return undefined for non-existent loader', () => {
      const loader = registry.get('non_existent');
      expect(loader).toBeUndefined();
    });

    it('should load single key', async () => {
      const loader = registry.create(
        'user-loader',
        { maxBatchSize: 10, cache: false },
        async (keys) => keys.map((k) => ({ id: k, name: `user_${k}` }))
      );

      const result = await loader.load('123');
      expect(result).toEqual({ id: '123', name: 'user_123' });
    });

    it('should load many keys', async () => {
      const loader = registry.create(
        'user-loader',
        { maxBatchSize: 10, cache: false },
        async (keys) => keys.map((k) => ({ id: k, name: `user_${k}` }))
      );

      const results = await loader.loadMany(['123', '456']);
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ id: '123', name: 'user_123' });
      expect(results[1]).toEqual({ id: '456', name: 'user_456' });
    });

    it('should clear loader', () => {
      const loader = registry.create(
        'test-loader',
        { maxBatchSize: 10, cache: true },
        async (keys) => keys.map((k) => ({ id: k }))
      );
      loader.clearAll();
      expect(loader).toBeDefined();
    });

    it('should clear specific loader', () => {
      registry.create(
        'loader1',
        { maxBatchSize: 10, cache: true },
        async (keys) => keys.map((k) => ({ id: k }))
      );
      registry.clear('loader1');
      const loader = registry.get('loader1');
      expect(loader).toBeUndefined();
    });

    it('should clear all loaders', () => {
      registry.create('loader1', { maxBatchSize: 10, cache: true }, async () => []);
      registry.create('loader2', { maxBatchSize: 10, cache: true }, async () => []);
      registry.clearAll();
      expect(registry.get('loader1')).toBeUndefined();
      expect(registry.get('loader2')).toBeUndefined();
    });
  });

  describe('SubscriptionHandler', () => {
    let handler: InMemorySubscriptionHandler;

    beforeEach(() => {
      handler = new InMemorySubscriptionHandler();
    });

    it('should subscribe to topic', () => {
      const unsubscribe = handler.subscribe('topic1', (_event) => {});
      expect(unsubscribe).toBeDefined();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should receive published event', () => {
      let receivedEvent: unknown = null;
      handler.subscribe('topic1', (event) => {
        receivedEvent = event;
      });
      handler.publish('topic1', { data: 'test' });
      expect(receivedEvent).toEqual({
        topic: 'topic1',
        payload: { data: 'test' },
        timestamp: expect.any(Number),
      });
    });

    it('should not receive events for different topic', () => {
      let received = false;
      handler.subscribe('topic1', (_event) => {
        received = true;
      });
      handler.publish('topic2', { data: 'test' });
      expect(received).toBe(false);
    });

    it('should unsubscribe from topic', () => {
      const events: unknown[] = [];
      const unsubscribe = handler.subscribe('topic1', (event) => {
        events.push(event);
      });
      unsubscribe();
      handler.publish('topic1', { data: 'test' });
      expect(events).toHaveLength(0);
    });

    it('should publish to multiple subscribers', () => {
      const events1: unknown[] = [];
      const events2: unknown[] = [];
      handler.subscribe('topic1', (event) => events1.push(event));
      handler.subscribe('topic1', (event) => events2.push(event));
      handler.publish('topic1', { data: 'test' });
      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
    });

    it('should unsubscribe from topic', () => {
      handler.subscribe('topic1', (_event) => {});
      handler.unsubscribe('topic1');
    });
  });

  describe('AuthHandler', () => {
    it('should authenticate with valid api key', async () => {
      const auth = new AuthHandler({ apiKey: 'secret-key' });
      const result = await auth.authenticate({ apiKey: 'secret-key' });
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
    });

    it('should reject invalid api key', async () => {
      const auth = new AuthHandler({ apiKey: 'secret-key' });
      const result = await auth.authenticate({ apiKey: 'wrong-key' });
      expect(result.success).toBe(false);
    });

    it('should authorize user with correct permissions', () => {
      const auth = new AuthHandler();
      const user = { id: '1', roles: ['user'], permissions: ['read', 'write'] };
      expect(auth.authorize(user, ['read'])).toBe(true);
      expect(auth.authorize(user, ['read', 'write'])).toBe(true);
    });

    it('should not authorize user without permissions', () => {
      const auth = new AuthHandler();
      const user = { id: '1', roles: ['user'], permissions: ['read'] };
      expect(auth.authorize(user, ['write'])).toBe(false);
    });

    it('should authorize admin user for any permission', () => {
      const auth = new AuthHandler();
      const admin = { id: '1', roles: ['admin'], permissions: [] };
      expect(auth.authorize(admin, ['any', 'permission'])).toBe(true);
    });

    it('should not authorize undefined user', () => {
      const auth = new AuthHandler();
      expect(auth.authorize(undefined, ['read'])).toBe(false);
    });

    it('should allow access without auth config', async () => {
      const auth = new AuthHandler();
      const result = await auth.authenticate({});
      expect(result.success).toBe(true);
    });

    it('should authenticate with custom validateUser function', async () => {
      const auth = new AuthHandler({
        jwtSecret: 'secret',
        validateUser: async (creds) => {
          if (creds.bearerToken === 'valid-token') {
            return { id: '123', roles: ['user'], permissions: ['read'] };
          }
          return null;
        },
      });
      const result = await auth.authenticate({ bearerToken: 'valid-token' });
      expect(result.success).toBe(true);
      expect(result.user?.id).toBe('123');
    });
  });

  describe('ResolverValidator', () => {
    let validator: ResolverValidatorImpl;

    beforeEach(() => {
      validator = new ResolverValidatorImpl();
    });

    it('should validate matching args', () => {
      const result = validator.validateArgs(
        { id: '123', name: 'Test' },
        [
          { name: 'id', type: 'ID!' },
          { name: 'name', type: 'String!' },
        ]
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required args', () => {
      const result = validator.validateArgs(
        { id: '123' },
        [
          { name: 'id', type: 'ID!' },
          { name: 'name', type: 'String!' },
        ]
      );
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate array return type', () => {
      const result = validator.validateReturnType(['a', 'b'], '[String!]!');
      expect(result.valid).toBe(true);
    });

    it('should reject non-array for array type', () => {
      const result = validator.validateReturnType('not-array', '[String!]!');
      expect(result.valid).toBe(false);
    });

    it('should validate non-null type', () => {
      const result = validator.validateNonNull('value', 'String!');
      expect(result.valid).toBe(true);
    });

    it('should reject null for non-null type', () => {
      const result = validator.validateNonNull(null, 'String!');
      expect(result.valid).toBe(false);
    });
  });

  describe('QueryHandler', () => {
    let queryHandler: QueryHandlerImpl;
    let auth: AuthHandler;
    let cache: InMemoryCache;
    let loaders: DataLoaderRegistryImpl;

    beforeEach(() => {
      auth = new AuthHandler();
      cache = new InMemoryCache({ defaultTtl: 1000, maxSize: 100, keyStrategy: 'field' });
      loaders = new DataLoaderRegistryImpl();

      const builder = new SchemaBuilderImpl();
      const schema = builder.buildSchema({
        query: {
          name: 'Query',
          fields: [
            {
              name: 'hello',
              type: 'String!',
              resolve: () => 'Hello World',
            },
            {
              name: 'user',
              type: 'User',
              resolve: (_source, args) => ({ id: args.id, name: 'Test User' }),
            },
          ],
        },
        types: [
          {
            name: 'User',
            fields: [
              { name: 'id', type: 'ID!' },
              { name: 'name', type: 'String!' },
            ],
          },
        ],
      });

      queryHandler = new QueryHandlerImpl(schema, auth, cache, loaders);
    });

    it('should execute query successfully', async () => {
      const request: ExecutionRequest = {
        query: 'query { hello }',
      };
      const result = await queryHandler.execute(request);
      expect(result.data).toBeDefined();
    });

    it('should execute query with variables', async () => {
      const request: ExecutionRequest = {
        query: 'query { user(id: $id) }',
        variables: { id: '123' },
      };
      const result = await queryHandler.execute(request);
      expect(result.data).toBeDefined();
    });

    it('should handle query errors', async () => {
      const request: ExecutionRequest = {
        query: 'invalid query',
      };
      const result = await queryHandler.execute(request);
      expect(result.errors).toBeDefined();
    });

    it('should return latency in extensions', async () => {
      const request: ExecutionRequest = {
        query: 'query { hello }',
      };
      const result = await queryHandler.execute(request);
      expect(result.extensions?.latency).toBeDefined();
    });
  });

  describe('MutationHandler', () => {
    let mutationHandler: MutationHandlerImpl;
    let auth: AuthHandler;

    beforeEach(() => {
      auth = new AuthHandler();

      const builder = new SchemaBuilderImpl();
      const schema = builder.buildSchema({
        query: {
          name: 'Query',
          fields: [{ name: 'dummy', type: 'String' }],
        },
        mutation: {
          name: 'Mutation',
          fields: [
            {
              name: 'createUser',
              type: 'User!',
              args: [
                { name: 'name', type: 'String!' },
                { name: 'email', type: 'String!' },
              ],
              resolve: (_source, args) => ({
                id: 'new-id',
                name: args.name,
                email: args.email,
              }),
            },
          ],
        },
        types: [
          {
            name: 'User',
            fields: [
              { name: 'id', type: 'ID!' },
              { name: 'name', type: 'String!' },
              { name: 'email', type: 'String!' },
            ],
          },
        ],
      });

      mutationHandler = new MutationHandlerImpl(schema, auth);
    });

    it('should execute mutation successfully', async () => {
      const request: ExecutionRequest = {
        query: 'mutation { createUser(name: "Test", email: "test@example.com") }',
      };
      const result = await mutationHandler.execute(request);
      expect(result.data).toBeDefined();
    });

    it('should return error for invalid mutation', async () => {
      const request: ExecutionRequest = {
        query: 'mutation { invalidMutation }',
      };
      const result = await mutationHandler.execute(request);
      expect(result.errors).toBeDefined();
    });
  });

  describe('SubscriptionManager', () => {
    let manager: SubscriptionManagerImpl;
    let handler: InMemorySubscriptionHandler;

    beforeEach(() => {
      handler = new InMemorySubscriptionHandler();
      manager = new SubscriptionManagerImpl(handler);
    });

    it('should create subscription', () => {
      const subscriptionId = manager.createSubscription('topic1', 'query { user }');
      expect(subscriptionId).toBeDefined();
      expect(subscriptionId.startsWith('sub_')).toBe(true);
    });

    it('should close subscription', () => {
      const subscriptionId = manager.createSubscription('topic1', 'query { user }');
      manager.closeSubscription(subscriptionId);
    });

    it('should publish to topic', () => {
      manager.createSubscription('topic1', 'query { user }');
      manager.publish('topic1', { data: 'test' });
    });
  });

  describe('MetricsCollector', () => {
    let metrics: GraphQLServerMetricsCollector;

    beforeEach(() => {
      metrics = new GraphQLServerMetricsCollector();
    });

    it('should record query', () => {
      metrics.recordQuery();
      const result = metrics.getMetrics();
      expect(result.queryCount).toBe(1);
      expect(result.totalRequests).toBe(1);
    });

    it('should record mutation', () => {
      metrics.recordMutation();
      const result = metrics.getMetrics();
      expect(result.mutationCount).toBe(1);
    });

    it('should record subscription', () => {
      metrics.recordSubscription();
      const result = metrics.getMetrics();
      expect(result.subscriptionCount).toBe(1);
    });

    it('should record error', () => {
      metrics.recordError();
      const result = metrics.getMetrics();
      expect(result.errorCount).toBe(1);
    });

    it('should record latency', () => {
      metrics.recordLatency(100);
      metrics.recordLatency(200);
      const result = metrics.getMetrics();
      expect(result.averageLatency).toBe(150);
    });

    it('should calculate cache hit rate', () => {
      metrics.updateCacheHitRate(80, 20);
      const result = metrics.getMetrics();
      expect(result.cacheHitRate).toBe(0.8);
    });
  });

  describe('GraphQL Server Integration', () => {
    let server: GraphQLServerImpl;

    const createTestSchema = (): GraphQLServerConfig => ({
      schema: {
        query: {
          name: 'Query',
          fields: [
            {
              name: 'hello',
              type: 'String!',
              resolve: () => 'Hello World',
            },
            {
              name: 'user',
              type: 'User',
              args: [{ name: 'id', type: 'ID!' }],
              resolve: (_source, args) => ({ id: args.id, name: 'Test User' }),
            },
          ],
        },
        mutation: {
          name: 'Mutation',
          fields: [
            {
              name: 'createUser',
              type: 'User!',
              args: [
                { name: 'name', type: 'String!' },
                { name: 'email', type: 'String!' },
              ],
              resolve: (_source, args) => ({
                id: 'new-id',
                name: args.name,
                email: args.email,
              }),
            },
          ],
        },
        types: [
          {
            name: 'User',
            fields: [
              { name: 'id', type: 'ID!' },
              { name: 'name', type: 'String!' },
              { name: 'email', type: 'String!' },
            ],
          },
        ],
      },
      auth: { apiKey: 'test-key' },
      cache: { defaultTtl: 1000, maxSize: 100, keyStrategy: 'field' },
    });

    beforeEach(() => {
      server = createGraphQLServer(createTestSchema());
    });

    it('should create server', () => {
      expect(server).toBeDefined();
    });

    it('should get schema', () => {
      const schema = server.getSchema();
      expect(schema).toBeDefined();
      expect(schema.queryTypeName).toBe('Query');
    });

    it('should get cache', () => {
      const cache = server.getCache();
      expect(cache).toBeDefined();
    });

    it('should get data loaders', () => {
      const loaders = server.getDataLoaders();
      expect(loaders).toBeDefined();
    });

    it('should get auth handler', () => {
      const auth = server.getAuthHandler();
      expect(auth).toBeDefined();
    });

    it('should get validator', () => {
      const validator = server.getValidator();
      expect(validator).toBeDefined();
    });

    it('should get metrics', () => {
      const metrics = server.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalRequests).toBe(0);
    });

    it('should execute query', async () => {
      const result = await server.execute({
        query: 'query { hello }',
        context: { headers: { 'x-api-key': 'test-key' } },
      });
      expect(result.data).toBeDefined();
    });

    it('should reject unauthorized request', async () => {
      const result = await server.execute({
        query: 'query { hello }',
        context: { headers: { 'x-api-key': 'wrong-key' } },
      });
      expect(result.errors).toBeDefined();
    });

    it('should execute mutation', async () => {
      const result = await server.executeMutation({
        query: 'mutation { createUser(name: "Test", email: "test@example.com") }',
        context: { headers: { 'x-api-key': 'test-key' } },
      });
      expect(result.data).toBeDefined();
    });

    it('should create subscription', () => {
      const subscriptionId = server.createSubscription('topic1', 'query { user(id: "123") }');
      expect(subscriptionId).toBeDefined();
      expect(subscriptionId.startsWith('sub_')).toBe(true);
    });

    it('should close subscription', () => {
      const subscriptionId = server.createSubscription('topic1', 'query { user(id: "123") }');
      server.closeSubscription(subscriptionId);
    });

    it('should publish to subscription', () => {
      const subscriptionId = server.createSubscription('topic1', 'query { user(id: "123") }');
      server.publishSubscription('topic1', { data: 'test' });
    });

    it('should track metrics on execute', async () => {
      await server.execute({
        query: 'query { hello }',
        context: { headers: { 'x-api-key': 'test-key' } },
      });
      const metrics = server.getMetrics();
      expect(metrics.totalRequests).toBeGreaterThan(0);
    });
  });

  describe('Factory Functions', () => {
    it('should create schema builder', () => {
      const builder = createSchemaBuilder();
      expect(builder).toBeInstanceOf(SchemaBuilderImpl);
    });

    it('should create cache', () => {
      const cache = createCache({ defaultTtl: 1000, maxSize: 100, keyStrategy: 'field' });
      expect(cache).toBeInstanceOf(InMemoryCache);
    });

    it('should create data loader registry', () => {
      const registry = createDataLoaderRegistry();
      expect(registry).toBeInstanceOf(DataLoaderRegistryImpl);
    });

    it('should create subscription handler', () => {
      const handler = createSubscriptionHandler();
      expect(handler).toBeInstanceOf(InMemorySubscriptionHandler);
    });

    it('should create auth handler', () => {
      const handler = createAuthHandler({ apiKey: 'key' });
      expect(handler).toBeInstanceOf(AuthHandler);
    });

    it('should create resolver validator', () => {
      const validator = createResolverValidator();
      expect(validator).toBeInstanceOf(ResolverValidatorImpl);
    });

    it('should create graphql server', () => {
      const server = createGraphQLServer({
        schema: {
          query: { name: 'Query', fields: [{ name: 'hello', type: 'String!' }] },
        },
      });
      expect(server).toBeInstanceOf(GraphQLServerImpl);
    });
  });
});

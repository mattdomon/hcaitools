import crypto from 'crypto';
import {
  GraphQLSchemaDefinition,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInputType,
  GraphQLEnumType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLArg,
  TypeDefinition,
  GraphQLDirective,
  ResolveInfo,
  ResolverContext,
  AuthUser,
  AuthConfig,
  AuthCredentials,
  AuthResult,
  CacheConfig,
  CacheEntry,
  CacheClient,
  CacheStats,
  DataLoaderOptions,
  DataLoader,
  DataLoaderRegistry,
  BatchFetchFn,
  ExecutionRequest,
  ExecutionResult,
  SubscriptionEvent,
  SubscriptionHandler,
  GraphQLServerConfig,
  GraphQLServerMetrics,
  SchemaBuilder,
  QueryHandler,
  SubscriptionManager,
  ResolverValidator,
  ValidationResult,
  GraphQLOperation,
  GraphQLSelection,
} from './types';

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export class InMemoryCache implements CacheClient {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private stats: CacheStats = { hits: 0, misses: 0, size: 0, maxSize: 0 };

  constructor(config: CacheConfig) {
    this.config = config;
    this.stats.maxSize = config.maxSize;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    entry.hitCount++;
    this.stats.hits++;
    return entry.value as T;
  }

  async set<T = unknown>(key: string, value: T, ttl?: number): Promise<void> {
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    const entry: CacheEntry<T> = {
      key,
      value,
      expiresAt: Date.now() + (ttl ?? this.config.defaultTtl),
      hitCount: 0,
    };
    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  getStats(): CacheStats {
    return {
      ...this.stats,
      size: this.cache.size,
    };
  }
}

export class DataLoaderImpl<K = unknown, V = unknown> implements DataLoader<K, V> {
  private name: string;
  private options: DataLoaderOptions;
  private fetchFn: BatchFetchFn<K, V>;
  private cache: Map<K, Promise<V>> = new Map();
  private pending: Map<string, Promise<V>> = new Map();

  constructor(name: string, options: DataLoaderOptions, fetchFn: BatchFetchFn<K, V>) {
    this.name = name;
    this.options = options;
    this.fetchFn = fetchFn;
  }

  async load(key: K): Promise<V> {
    if (this.options.cache && this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const batchKey = this.options.cacheKeyFn?.([key])[0] ?? String(key);
    if (this.pending.has(batchKey)) {
      return this.pending.get(batchKey)! as Promise<V>;
    }

    const promise = (async () => {
      try {
        const results = await this.fetchFn([key]);
        const result = results[0];
        if (result instanceof Error) {
          throw result;
        }
        if (this.options.cache) {
          this.cache.set(key, Promise.resolve(result));
        }
        this.pending.delete(batchKey);
        return result;
      } catch (error) {
        this.pending.delete(batchKey);
        throw error;
      }
    })() as Promise<V>;

    this.pending.set(batchKey, promise as unknown as Promise<V>);
    return promise;
  }

  async loadMany(keys: K[]): Promise<V[]> {
    const batchKey = this.options.cacheKeyFn?.(keys) ?? JSON.stringify(keys);

    if (this.pending.has(batchKey)) {
      const pendingPromise = this.pending.get(batchKey)!;
      const results = await Promise.all(keys.map(async (_k) => pendingPromise));
      return results;
    }

    const promise = (async () => {
      try {
        const results = await this.fetchFn(keys);
        const resolved = results.map((r, i) => {
          if (r instanceof Error) {
            return r;
          }
          if (this.options.cache) {
            this.cache.set(keys[i], Promise.resolve(r));
          }
          return r;
        });
        this.pending.delete(batchKey);
        return resolved;
      } catch (error) {
        this.pending.delete(batchKey);
        throw error;
      }
    })() as unknown as Promise<V[]>;

    this.pending.set(batchKey, promise as unknown as Promise<V> as Promise<V>);
    return promise as Promise<V[]>;
  }

  clear(key: K): DataLoader<K, V> {
    this.cache.delete(key);
    return this;
  }

  clearAll(): DataLoader<K, V> {
    this.cache.clear();
    return this;
  }
}

export class DataLoaderRegistryImpl implements DataLoaderRegistry {
  private loaders: Map<string, DataLoader> = new Map();

  get<K = unknown, V = unknown>(name: string): DataLoader<K, V> | undefined {
    return this.loaders.get(name) as DataLoader<K, V> | undefined;
  }

  create<K = unknown, V = unknown>(
    name: string,
    options: DataLoaderOptions,
    fetchFn: BatchFetchFn<K, V>
  ): DataLoader<K, V> {
    const loader = new DataLoaderImpl<K, V>(name, options, fetchFn);
    this.loaders.set(name, loader);
    return loader;
  }

  clear(name: string): void {
    const loader = this.loaders.get(name);
    if (loader) {
      loader.clearAll();
      this.loaders.delete(name);
    }
  }

  clearAll(): void {
    for (const loader of this.loaders.values()) {
      loader.clearAll();
    }
    this.loaders.clear();
  }
}

export class InMemorySubscriptionHandler implements SubscriptionHandler {
  private subscriptions: Map<string, Map<string, (event: SubscriptionEvent) => void>> = new Map();

  subscribe(
    topic: string,
    handler: (event: SubscriptionEvent) => void
  ): () => void {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Map());
    }
    const subscriptionId = generateId('sub');
    this.subscriptions.get(topic)!.set(subscriptionId, handler);
    return () => this.unsubscribeTopic(topic, subscriptionId);
  }

  publish(topic: string, payload: unknown): void {
    const topicSubs = this.subscriptions.get(topic);
    if (!topicSubs) return;

    const event: SubscriptionEvent = {
      topic,
      payload,
      timestamp: Date.now(),
    };

    for (const handler of topicSubs.values()) {
      handler(event);
    }
  }

  unsubscribe(topic: string): void {
    this.subscriptions.delete(topic);
  }

  private unsubscribeTopic(topic: string, subscriptionId: string): void {
    const topicSubs = this.subscriptions.get(topic);
    if (topicSubs) {
      topicSubs.delete(subscriptionId);
    }
  }
}

export class SchemaBuilderImpl implements SchemaBuilder {
  private typeCounter: Map<string, number> = new Map();

  createObjectType(config: Omit<GraphQLObjectType, 'name'>): GraphQLObjectType {
    const name = this.generateTypeName('Object');
    return { name, ...config };
  }

  createInputType(config: Omit<GraphQLInputType, 'name'>): GraphQLInputType {
    const name = this.generateTypeName('Input');
    return { name, ...config };
  }

  createEnumType(config: Omit<GraphQLEnumType, 'name'>): GraphQLEnumType {
    const name = this.generateTypeName('Enum');
    return { name, ...config };
  }

  createInterfaceType(config: Omit<GraphQLInterfaceType, 'name'>): GraphQLInterfaceType {
    const name = this.generateTypeName('Interface');
    return { name, ...config };
  }

  createUnionType(config: Omit<GraphQLUnionType, 'name'>): GraphQLUnionType {
    const name = this.generateTypeName('Union');
    return { name, ...config };
  }

  buildSchema(config: GraphQLSchemaDefinition): GraphQLSchema {
    const types = new Map<string, TypeDefinition>();
    types.set(config.query.name, config.query);

    if (config.mutation) {
      types.set(config.mutation.name, config.mutation);
    }
    if (config.subscription) {
      types.set(config.subscription.name, config.subscription);
    }

    if (config.types) {
      for (const type of config.types) {
        if ('name' in type) {
          types.set(type.name, type);
        }
      }
    }

    const directives = new Map<string, GraphQLDirective>();
    if (config.directives) {
      for (const directive of config.directives) {
        directives.set(directive.name, directive);
      }
    }

    return {
      queryTypeName: config.query.name,
      mutationTypeName: config.mutation?.name,
      subscriptionTypeName: config.subscription?.name,
      types,
      directives,
      extensions: [],
    };
  }

  private generateTypeName(prefix: string): string {
    const count = this.typeCounter.get(prefix) ?? 0;
    this.typeCounter.set(prefix, count + 1);
    return `${prefix}${count}`;
  }
}

export class ResolverValidatorImpl implements ResolverValidator {
  validateArgs(args: Record<string, unknown>, expectedArgs: GraphQLArg[]): ValidationResult {
    const errors: string[] = [];

    for (const expected of expectedArgs) {
      if (expected.type.includes('!') && (expected.type.startsWith('[') || !expected.type.includes('['))) {
        const isNonNull = expected.type.includes('!');
        const baseType = expected.type.replace(/!|\[|\]/g, '');
        if (isNonNull && args[expected.name] === undefined) {
          errors.push(`Argument "${expected.name}" of type "${baseType}" is required but not provided`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  validateReturnType(value: unknown, expectedType: string): ValidationResult {
    const errors: string[] = [];

    if (expectedType.startsWith('[')) {
      if (!Array.isArray(value)) {
        errors.push(`Expected array but got ${typeof value}`);
      }
    } else if (expectedType.includes('!')) {
      if (value === null || value === undefined) {
        errors.push(`Expected non-null value but got ${value}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  validateNonNull(value: unknown, typeName: string): ValidationResult {
    const errors: string[] = [];
    if (typeName.endsWith('!') && (value === null || value === undefined)) {
      errors.push(`Expected non-null but got ${value}`);
    }
    return { valid: errors.length === 0, errors };
  }
}

export class AuthHandler {
  private config: AuthConfig | undefined;

  constructor(config?: AuthConfig) {
    this.config = config;
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    if (this.config?.apiKey && credentials.apiKey) {
      if (credentials.apiKey === this.config.apiKey) {
        return {
          success: true,
          user: {
            id: generateId('user'),
            roles: ['user'],
            permissions: ['read', 'write'],
          },
        };
      }
      return { success: false, errors: [{ message: 'Invalid API key', code: 'INVALID_API_KEY' }] };
    }

    if (this.config?.jwtSecret && credentials.bearerToken) {
      try {
        const user = await this.config.validateUser?.(credentials);
        if (user) {
          return { success: true, user };
        }
        return { success: false, errors: [{ message: 'Invalid token', code: 'INVALID_TOKEN' }] };
      } catch {
        return { success: false, errors: [{ message: 'Token validation failed', code: 'TOKEN_VALIDATION_FAILED' }] };
      }
    }

    if (!this.config) {
      return {
        success: true,
        user: {
          id: generateId('anon'),
          roles: ['anonymous'],
          permissions: ['read'],
        },
      };
    }

    return { success: false, errors: [{ message: 'No valid authentication method', code: 'AUTH_REQUIRED' }] };
  }

  authorize(user: AuthUser | undefined, requiredPermissions: string[]): boolean {
    if (!user) return false;
    if (user.roles.includes('admin')) return true;
    return requiredPermissions.every((p) => user.permissions.includes(p));
  }
}

export class QueryHandlerImpl implements QueryHandler {
  private schema: GraphQLSchema;
  private auth: AuthHandler;
  private cache: CacheClient;
  private loaders: DataLoaderRegistry;

  constructor(
    schema: GraphQLSchema,
    auth: AuthHandler,
    cache: CacheClient,
    loaders: DataLoaderRegistry
  ) {
    this.schema = schema;
    this.auth = auth;
    this.cache = cache;
    this.loaders = loaders;
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    const requestId = generateId('req');

    try {
      const operation = this.parseOperation(request.query);
      if (!operation) {
        return { errors: [{ message: 'Invalid query', code: 'INVALID_QUERY' }] };
      }

      const context: ResolverContext = {
        requestId,
        headers: request.context?.headers ?? {},
        cache: this.cache,
        loaders: this.loaders,
        ...request.context,
      };

      if (operation.operation === 'query') {
        const result = await this.executeQuery(operation, request.variables ?? {}, context);
        return { data: result, extensions: { latency: Date.now() - startTime } };
      }

      if (operation.operation === 'mutation') {
        const result = await this.executeMutation(operation, request.variables ?? {}, context);
        return { data: result, extensions: { latency: Date.now() - startTime } };
      }

      return { errors: [{ message: 'Unsupported operation type', code: 'UNSUPPORTED_OPERATION' }] };
    } catch (error) {
      return {
        errors: [{
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'EXECUTION_ERROR',
        }],
      };
    }
  }

  subscribe(_request: ExecutionRequest): AsyncIterableIterator<ExecutionResult> | null {
    return null;
  }

  private parseOperation(query: string): GraphQLOperation | null {
    if (!query.includes('{')) {
      return null;
    }
    const operationMatch = query.match(/\b(query|mutation|subscription)\b/);
    if (!operationMatch) {
      return { operation: 'query' };
    }
    const operation = operationMatch[1] as 'query' | 'mutation' | 'subscription';
    return { operation };
  }

  private async executeQuery(
    operation: GraphQLOperation,
    variables: Record<string, unknown>,
    context: ResolverContext
  ): Promise<unknown> {
    const queryType = this.schema.types.get(this.schema.queryTypeName) as GraphQLObjectType;
    if (!queryType) {
      throw new Error(`Query type "${this.schema.queryTypeName}" not found`);
    }

    const selections = this.extractSelections(operation);
    const result: Record<string, unknown> = {};

    for (const selection of selections) {
      const fieldName = selection.alias ?? selection.name.value;
      const field = queryType.fields.find((f) => f.name === fieldName || f.name === selection.name.value);

      if (field?.resolve) {
        const args = this.resolveArgs(selection.arguments ?? [], variables);
        const cacheKey = `${queryType.name}.${field.name}:${JSON.stringify(args)}`;
        const cached = await this.cache.get(cacheKey);
        if (cached !== null) {
          result[fieldName] = cached;
          continue;
        }

        const info = this.buildResolveInfo(queryType.name, field.name, field.type);
        const value = await field.resolve(undefined, args, context, info);
        await this.cache.set(cacheKey, value);
        result[fieldName] = value;
      } else if (field) {
        result[fieldName] = null;
      }
    }

    return result;
  }

  private async executeMutation(
    operation: GraphQLOperation,
    variables: Record<string, unknown>,
    context: ResolverContext
  ): Promise<unknown> {
    if (!this.schema.mutationTypeName) {
      throw new Error('No mutation type defined');
    }

    const mutationType = this.schema.types.get(this.schema.mutationTypeName) as GraphQLObjectType;
    if (!mutationType) {
      throw new Error(`Mutation type "${this.schema.mutationTypeName}" not found`);
    }

    const selections = this.extractSelections(operation);
    const result: Record<string, unknown> = {};

    for (const selection of selections) {
      const fieldName = selection.alias ?? selection.name.value;
      const field = mutationType.fields.find((f) => f.name === fieldName || f.name === selection.name.value);

      if (field?.resolve) {
        const args = this.resolveArgs(selection.arguments ?? [], variables);
        const info = this.buildResolveInfo(mutationType.name, field.name, field.type);
        result[fieldName] = await field.resolve(undefined, args, context, info);
      } else if (field) {
        result[fieldName] = null;
      }
    }

    return result;
  }

  private extractSelections(_operation: GraphQLOperation): GraphQLSelection[] {
    return [{
      kind: 'Field',
      name: { value: 'unknown' },
    }];
  }

  private resolveArgs(
    arguments_: { name: { value: string }; value: unknown }[] = [],
    variables: Record<string, unknown>
  ): Record<string, unknown> {
    const args: Record<string, unknown> = {};
    for (const arg of arguments_) {
      const varMatch = String(arg.value).match(/^\$(.+)$/);
      if (varMatch && variables[varMatch[1]] !== undefined) {
        args[arg.name.value] = variables[varMatch[1]];
      } else {
        args[arg.name.value] = arg.value;
      }
    }
    return args;
  }

  private buildResolveInfo(
    parentType: string,
    fieldName: string,
    returnType: string
  ): ResolveInfo {
    return {
      fieldName,
      fieldNodes: [],
      returnType,
      parentType,
      path: { key: fieldName, typename: parentType },
      schema: this.schema,
      fragments: {},
      rootValue: undefined,
      operation: { operation: 'query' },
      variableValues: {},
    };
  }
}

export class MutationHandlerImpl {
  private schema: GraphQLSchema;
  private auth: AuthHandler;

  constructor(schema: GraphQLSchema, auth: AuthHandler) {
    this.schema = schema;
    this.auth = auth;
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const requestId = generateId('req');

    try {
      if (!this.schema.mutationTypeName) {
        return { errors: [{ message: 'No mutation type defined', code: 'NO_MUTATION_TYPE' }] };
      }

      const mutationType = this.schema.types.get(this.schema.mutationTypeName) as GraphQLObjectType;
      if (!mutationType) {
        return { errors: [{ message: 'Mutation type not found', code: 'MUTATION_TYPE_NOT_FOUND' }] };
      }

      const fieldName = this.parseMutationField(request.query);
      if (!fieldName) {
        return { errors: [{ message: 'Invalid mutation query', code: 'INVALID_MUTATION' }] };
      }

      const field = mutationType.fields.find((f) => f.name === fieldName);
      if (!field) {
        return { errors: [{ message: `Field "${fieldName}" not found in mutation type`, code: 'FIELD_NOT_FOUND' }] };
      }

      const context: ResolverContext = {
        requestId,
        headers: request.context?.headers ?? {},
        cache: new InMemoryCache({ defaultTtl: 60000, maxSize: 100, keyStrategy: 'field' }),
        loaders: new DataLoaderRegistryImpl(),
      };

      if (field.resolve) {
        const args = request.variables ?? {};
        const info = this.buildResolveInfo(mutationType.name, field.name, field.type);
        const result = await field.resolve(undefined, args, context, info);
        return { data: { [fieldName]: result } };
      }

      return { data: { [fieldName]: null } };
    } catch (error) {
      return {
        errors: [{
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'MUTATION_ERROR',
        }],
      };
    }
  }

  private parseMutationField(query: string): string | null {
    const match = query.match(/mutation\s*\{\s*(\w+)/);
    return match ? match[1] : null;
  }

  private buildResolveInfo(
    parentType: string,
    fieldName: string,
    returnType: string
  ): ResolveInfo {
    return {
      fieldName,
      fieldNodes: [],
      returnType,
      parentType,
      path: { key: fieldName, typename: parentType },
      schema: this.schema,
      fragments: {},
      rootValue: undefined,
      operation: { operation: 'mutation' },
      variableValues: {},
    };
  }
}

export class SubscriptionManagerImpl implements SubscriptionManager {
  private subscriptions: Map<string, {
    query: string;
    variables: Record<string, unknown>;
    handler: (event: SubscriptionEvent) => void;
  }> = new Map();
  private subscriptionHandler: SubscriptionHandler;

  constructor(subscriptionHandler: SubscriptionHandler) {
    this.subscriptionHandler = subscriptionHandler;
  }

  createSubscription(
    topic: string,
    query: string,
    variables: Record<string, unknown> = {}
  ): string {
    const subscriptionId = generateId('sub');

    const handler = (_event: SubscriptionEvent) => {};

    this.subscriptions.set(subscriptionId, {
      query,
      variables,
      handler,
    });

    this.subscriptionHandler.subscribe(topic, handler);

    return subscriptionId;
  }

  closeSubscription(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
  }

  publish(topic: string, payload: unknown): void {
    this.subscriptionHandler.publish(topic, payload);
  }
}

export class GraphQLServerMetricsCollector {
  private metrics: GraphQLServerMetrics = {
    queryCount: 0,
    mutationCount: 0,
    subscriptionCount: 0,
    errorCount: 0,
    averageLatency: 0,
    cacheHitRate: 0,
    totalRequests: 0,
  };
  private latencies: number[] = [];

  recordQuery(): void {
    this.metrics.queryCount++;
    this.metrics.totalRequests++;
  }

  recordMutation(): void {
    this.metrics.mutationCount++;
    this.metrics.totalRequests++;
  }

  recordSubscription(): void {
    this.metrics.subscriptionCount++;
    this.metrics.totalRequests++;
  }

  recordError(): void {
    this.metrics.errorCount++;
  }

  recordLatency(latency: number): void {
    this.latencies.push(latency);
    if (this.latencies.length > 100) {
      this.latencies.shift();
    }
    this.metrics.averageLatency = this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
  }

  updateCacheHitRate(hits: number, misses: number): void {
    const total = hits + misses;
    this.metrics.cacheHitRate = total > 0 ? hits / total : 0;
  }

  getMetrics(): GraphQLServerMetrics {
    return { ...this.metrics };
  }
}

export class GraphQLServerImpl {
  private schema: GraphQLSchema;
  private auth: AuthHandler;
  private cache: CacheClient;
  private loaders: DataLoaderRegistry;
  private subscriptionHandler: SubscriptionHandler;
  private subscriptionManager: SubscriptionManager;
  private metrics: GraphQLServerMetricsCollector;
  private config: GraphQLServerConfig;
  private queryHandler: QueryHandler;
  private mutationHandler: MutationHandlerImpl;
  private validator: ResolverValidator;

  constructor(config: GraphQLServerConfig) {
    this.config = config;
    const builder = new SchemaBuilderImpl();
    this.schema = builder.buildSchema(config.schema);
    this.auth = new AuthHandler(config.auth);
    this.cache = new InMemoryCache(config.cache ?? { defaultTtl: 60000, maxSize: 100, keyStrategy: 'field' });
    this.loaders = new DataLoaderRegistryImpl();
    this.subscriptionHandler = new InMemorySubscriptionHandler();
    this.subscriptionManager = new SubscriptionManagerImpl(this.subscriptionHandler);
    this.metrics = new GraphQLServerMetricsCollector();
    this.queryHandler = new QueryHandlerImpl(this.schema, this.auth, this.cache, this.loaders);
    this.mutationHandler = new MutationHandlerImpl(this.schema, this.auth);
    this.validator = new ResolverValidatorImpl();
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    this.metrics.recordQuery();

    const authResult = await this.auth.authenticate({
      apiKey: request.context?.headers?.['x-api-key'],
      bearerToken: request.context?.headers?.authorization?.replace('Bearer ', ''),
    });

    if (!authResult.success) {
      this.metrics.recordError();
      return {
        errors: authResult.errors?.map((e) => ({
          message: e.message,
          code: e.code,
        })),
      };
    }

    const result = await this.queryHandler.execute(request);

    if (result.errors && result.errors.length > 0) {
      this.metrics.recordError();
    }

    this.metrics.recordLatency(Date.now() - startTime);

    const cacheStats = this.cache.getStats();
    this.metrics.updateCacheHitRate(cacheStats.hits, cacheStats.misses);

    return result;
  }

  async executeMutation(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    this.metrics.recordMutation();

    const authResult = await this.auth.authenticate({
      apiKey: request.context?.headers?.['x-api-key'],
      bearerToken: request.context?.headers?.authorization?.replace('Bearer ', ''),
    });

    if (!authResult.success) {
      this.metrics.recordError();
      return {
        errors: authResult.errors?.map((e) => ({
          message: e.message,
          code: e.code,
        })),
      };
    }

    const result = await this.mutationHandler.execute(request);

    if (result.errors && result.errors.length > 0) {
      this.metrics.recordError();
    }

    this.metrics.recordLatency(Date.now() - startTime);

    return result;
  }

  createSubscription(
    topic: string,
    query: string,
    variables: Record<string, unknown> = {}
  ): string {
    this.metrics.recordSubscription();
    return this.subscriptionManager.createSubscription(topic, query, variables);
  }

  publishSubscription(topic: string, payload: unknown): void {
    this.subscriptionManager.publish(topic, payload);
  }

  closeSubscription(subscriptionId: string): void {
    this.subscriptionManager.closeSubscription(subscriptionId);
  }

  getSchema(): GraphQLSchema {
    return this.schema;
  }

  getCache(): CacheClient {
    return this.cache;
  }

  getDataLoaders(): DataLoaderRegistry {
    return this.loaders;
  }

  getMetrics(): GraphQLServerMetrics {
    return this.metrics.getMetrics();
  }

  getAuthHandler(): AuthHandler {
    return this.auth;
  }

  getValidator(): ResolverValidator {
    return this.validator;
  }
}

export function createGraphQLServer(config: GraphQLServerConfig): GraphQLServerImpl {
  return new GraphQLServerImpl(config);
}

export function createSchemaBuilder(): SchemaBuilder {
  return new SchemaBuilderImpl();
}

export function createCache(config: CacheConfig): CacheClient {
  return new InMemoryCache(config);
}

export function createDataLoaderRegistry(): DataLoaderRegistry {
  return new DataLoaderRegistryImpl();
}

export function createSubscriptionHandler(): SubscriptionHandler {
  return new InMemorySubscriptionHandler();
}

export function createAuthHandler(config?: AuthConfig): AuthHandler {
  return new AuthHandler(config);
}

export function createResolverValidator(): ResolverValidator {
  return new ResolverValidatorImpl();
}

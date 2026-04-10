export type OperationType = 'query' | 'mutation' | 'subscription';

export type SchemaType = 'object' | 'input' | 'enum' | 'scalar' | 'interface' | 'union' | 'extension';

export type GraphQLScalarType = 'String' | 'Int' | 'Float' | 'Boolean' | 'ID';

export type CacheKeyStrategy = 'field' | 'type' | 'global';

export interface GraphQLField {
  name: string;
  type: string;
  args?: GraphQLArg[];
  resolve?: FieldResolver;
  description?: string;
  deprecationReason?: string;
}

export interface GraphQLArg {
  name: string;
  type: string;
  defaultValue?: unknown;
  description?: string;
}

export interface GraphQLObjectType {
  name: string;
  fields: GraphQLField[];
  description?: string;
  interfaces?: string[];
}

export interface GraphQLInputType {
  name: string;
  fields: GraphQLArg[];
  description?: string;
}

export interface GraphQLEnumType {
  name: string;
  values: GraphQLEnumValue[];
  description?: string;
}

export interface GraphQLEnumValue {
  name: string;
  value: string | number;
  description?: string;
  deprecationReason?: string;
}

export interface GraphQLInterfaceType {
  name: string;
  fields: GraphQLField[];
  resolveType?: ResolveType;
  description?: string;
}

export interface GraphQLUnionType {
  name: string;
  types: string[];
  resolveType?: ResolveType;
  description?: string;
}

export interface GraphQLScalarDefinition {
  name: string;
  serialize?: (value: unknown) => unknown;
  parseValue?: (value: unknown) => unknown;
  parseLiteral?: (ast: unknown) => unknown;
}

export interface GraphQLSchemaDefinition {
  query: GraphQLObjectType;
  mutation?: GraphQLObjectType;
  subscription?: GraphQLObjectType;
  types?: (GraphQLObjectType | GraphQLInputType | GraphQLEnumType | GraphQLInterfaceType | GraphQLUnionType | GraphQLScalarDefinition)[];
  directives?: GraphQLDirective[];
}

export interface GraphQLDirective {
  name: string;
  args?: GraphQLArg[];
  locations: DirectiveLocation[];
  description?: string;
}

export type DirectiveLocation =
  | 'QUERY'
  | 'MUTATION'
  | 'SUBSCRIPTION'
  | 'FIELD'
  | 'FRAGMENT_DEFINITION'
  | 'FRAGMENT_SPREAD'
  | 'INLINE_FRAGMENT'
  | 'SCHEMA'
  | 'SCALAR'
  | 'OBJECT'
  | 'FIELD_DEFINITION'
  | 'ARGUMENT_DEFINITION'
  | 'INTERFACE'
  | 'UNION'
  | 'ENUM'
  | 'ENUM_VALUE'
  | 'INPUT_OBJECT'
  | 'INPUT_FIELD_DEFINITION';

export interface FieldResolver {
  (
    source: unknown,
    args: Record<string, unknown>,
    context: ResolverContext,
    info: ResolveInfo
  ): Promise<unknown> | unknown;
}

export interface ResolveType {
  (source: unknown, context: ResolverContext, info: ResolveInfo): Promise<string> | string;
}

export interface ResolveInfo {
  fieldName: string;
  fieldNodes: unknown[];
  returnType: string;
  parentType: string;
  path: ResolvePath;
  schema: GraphQLSchema;
  fragments: Record<string, unknown>;
  rootValue: unknown;
  operation: GraphQLOperation;
  variableValues: Record<string, unknown>;
}

export interface ResolvePath {
  prev?: ResolvePath;
  key: string | number;
  typename?: string;
}

export interface GraphQLOperation {
  operation: OperationType;
  selectionSet?: GraphQLSelectionSet;
  name?: string;
  variableDefinitions?: GraphQLVariableDefinition[];
}

export interface GraphQLSelectionSet {
  selections: GraphQLSelection[];
}

export interface GraphQLSelection {
  kind: 'Field' | 'FragmentSpread' | 'InlineFragment';
  alias?: string;
  name: { value: string };
  arguments?: { name: { value: string }; value: unknown }[];
  selectionSet?: GraphQLSelectionSet;
}

export interface GraphQLVariableDefinition {
  variable: { name: { value: string } };
  type: { name?: { value: string }; kind?: string; type?: unknown };
  defaultValue?: unknown;
  typeName?: string;
}

export interface GraphQLSchema {
  queryTypeName: string;
  mutationTypeName?: string;
  subscriptionTypeName?: string;
  types: Map<string, TypeDefinition>;
  directives: Map<string, GraphQLDirective>;
  extensions: GraphQLExtension[];
}

export type TypeDefinition =
  | GraphQLObjectType
  | GraphQLInputType
  | GraphQLEnumType
  | GraphQLInterfaceType
  | GraphQLUnionType
  | GraphQLScalarDefinition;

export interface GraphQLExtension {
  type: 'object' | 'interface';
  name: string;
  fields: GraphQLField[];
}

export interface ResolverContext {
  requestId: string;
  user?: AuthUser;
  headers: Record<string, string>;
  cache: CacheClient;
  loaders: DataLoaderRegistry;
}

export interface AuthUser {
  id: string;
  email?: string;
  roles: string[];
  permissions: string[];
  metadata?: Record<string, unknown>;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  errors?: AuthError[];
}

export interface AuthError {
  message: string;
  code: string;
  path?: string[];
}

export interface AuthConfig {
  apiKey?: string;
  jwtSecret?: string;
  validateUser?: (credentials: AuthCredentials) => Promise<AuthUser | null>;
}

export interface AuthCredentials {
  apiKey?: string;
  bearerToken?: string;
  headers?: Record<string, string>;
}

export interface CacheConfig {
  defaultTtl: number;
  maxSize: number;
  keyStrategy: CacheKeyStrategy;
}

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  expiresAt: number;
  hitCount: number;
}

export interface CacheClient {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  getStats(): CacheStats;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
}

export interface DataLoaderOptions {
  maxBatchSize: number;
  cache: boolean;
  cacheKeyFn?: (keys: unknown[]) => string;
}

export interface DataLoaderRegistry {
  get<K = unknown, V = unknown>(name: string): DataLoader<K, V> | undefined;
  create<K = unknown, V = unknown>(name: string, options: DataLoaderOptions, fetchFn: BatchFetchFn<K, V>): DataLoader<K, V>;
  clear(name: string): void;
  clearAll(): void;
}

export interface DataLoader<K = unknown, V = unknown> {
  load(key: K): Promise<V>;
  loadMany(keys: K[]): Promise<V[]>;
  clear(key: K): DataLoader<K, V>;
  clearAll(): DataLoader<K, V>;
}

export type BatchFetchFn<K = unknown, V = unknown> = (keys: K[]) => Promise<(V | Error)[]>;

export interface ExecutionRequest {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
  context?: Partial<ResolverContext>;
}

export interface ExecutionResult<T = unknown> {
  data?: T;
  errors?: GraphQLError[];
  extensions?: Record<string, unknown>;
}

export interface GraphQLError {
  message: string;
  locations?: { line: number; column: number }[];
  path?: (string | number)[];
  extensions?: Record<string, unknown>;
  code?: string;
}

export interface SubscriptionEvent {
  topic: string;
  payload: unknown;
  timestamp: number;
}

export interface SubscriptionHandler {
  subscribe(
    topic: string,
    handler: (event: SubscriptionEvent) => void
  ): () => void;
  publish(topic: string, payload: unknown): void;
  unsubscribe(topic: string): void;
}

export interface GraphQLServerConfig {
  schema: GraphQLSchemaDefinition;
  auth?: AuthConfig;
  cache?: CacheConfig;
  dataLoaders?: DataLoaderOptions;
  introspection?: boolean;
  playground?: boolean;
}

export interface GraphQLServerMetrics {
  queryCount: number;
  mutationCount: number;
  subscriptionCount: number;
  errorCount: number;
  averageLatency: number;
  cacheHitRate: number;
  totalRequests: number;
}

export interface SchemaBuilder {
  createObjectType(config: Omit<GraphQLObjectType, 'name'>): GraphQLObjectType;
  createInputType(config: Omit<GraphQLInputType, 'name'>): GraphQLInputType;
  createEnumType(config: Omit<GraphQLEnumType, 'name'>): GraphQLEnumType;
  createInterfaceType(config: Omit<GraphQLInterfaceType, 'name'>): GraphQLInterfaceType;
  createUnionType(config: Omit<GraphQLUnionType, 'name'>): GraphQLUnionType;
  buildSchema(config: GraphQLSchemaDefinition): GraphQLSchema;
}

export interface QueryHandler {
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
  subscribe(request: ExecutionRequest): AsyncIterableIterator<ExecutionResult> | null;
}

export interface MutationHandler {
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}

export interface SubscriptionManager {
  createSubscription(
    topic: string,
    query: string,
    variables?: Record<string, unknown>
  ): string;
  closeSubscription(subscriptionId: string): void;
  publish(topic: string, payload: unknown): void;
}

export interface ResolverValidator {
  validateArgs(args: Record<string, unknown>, expectedArgs: GraphQLArg[]): ValidationResult;
  validateReturnType(value: unknown, expectedType: string): ValidationResult;
  validateNonNull(value: unknown, typeName: string): ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * API Documentation Generator Types
 * Complete type definitions for OpenAPI/Swagger documentation generator
 */

export type OpenAPIVersion = '3.0' | '3.1';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type ParameterType = 'path' | 'query' | 'header' | 'cookie';
export type SchemaType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'integer' | 'null';
export type AuthenticationType = 'bearer' | 'api_key' | 'oauth2' | 'basic' | 'none';
export type SecuritySchemeType = 'http' | 'apiKey' | 'oauth2' | 'openIdConnect';

export interface SchemaDefinition {
  type?: SchemaType;
  format?: string;
  description?: string;
  example?: unknown;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  items?: SchemaDefinition;
  properties?: Record<string, SchemaDefinition>;
  required?: string[];
  additionalProperties?: boolean | SchemaDefinition;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  $ref?: string;
  allOf?: SchemaDefinition[];
  oneOf?: SchemaDefinition[];
  anyOf?: SchemaDefinition[];
}

export interface ParameterDefinition {
  name: string;
  in: ParameterType;
  required?: boolean;
  description?: string;
  schema?: SchemaDefinition;
  example?: unknown;
  deprecated?: boolean;
}

export interface RequestBodyDefinition {
  description?: string;
  required?: boolean;
  contentType?: string;
  schema?: SchemaDefinition;
  examples?: Record<string, { value?: unknown; summary?: string }>;
}

export interface ResponseDefinition {
  description: string;
  schema?: SchemaDefinition;
  contentType?: string;
  example?: unknown;
  headers?: Record<string, ParameterDefinition>;
}

export interface EndpointDefinition {
  endpointId: string;
  method: HttpMethod;
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterDefinition[];
  requestBody?: RequestBodyDefinition;
  responses: Record<string, ResponseDefinition>;
  deprecated?: boolean;
  security?: SecurityRequirement[];
  servers?: string[];
  summaryEN?: string;
  summaryZH?: string;
}

export interface SecurityScheme {
  name: string;
  type: SecuritySchemeType;
  scheme?: string;
  bearerFormat?: string;
  in?: 'query' | 'header' | 'cookie';
  flows?: OAuth2Flows;
  description?: string;
}

export interface OAuth2Flows {
  implicit?: OAuth2Flow;
  password?: OAuth2Flow;
  clientCredentials?: OAuth2Flow;
  authorizationCode?: OAuth2Flow;
}

export interface OAuth2Flow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface SecurityRequirement {
  name: string;
  scopes?: string[];
}

export interface ContactInfo {
  name?: string;
  email?: string;
  url?: string;
}

export interface LicenseInfo {
  name: string;
  url?: string;
}

export interface ServerInfo {
  url: string;
  description?: string;
  variables?: Record<string, { default: string; description?: string; enum?: string[] }>;
}

export interface TagDefinition {
  name: string;
  description?: string;
}

export interface APIComponent {
  schemas: Record<string, SchemaDefinition>;
  securitySchemes: Record<string, SecurityScheme>;
}

export interface ChangelogEntry {
  version: string;
  date: Date;
  changes: ChangelogChange[];
  breaking?: boolean;
}

export interface ChangelogChange {
  type: 'added' | 'changed' | 'deprecated' | 'removed' | 'fixed' | 'security';
  description: string;
  endpoints?: string[];
}

export interface Changelog {
  versions: ChangelogEntry[];
}

export interface APIExplorerRequest {
  method: HttpMethod;
  path: string;
  parameters?: Record<string, unknown>;
  headers?: Record<string, string>;
  body?: unknown;
  authentication?: { type: AuthenticationType; token?: string; apiKey?: string };
}

export interface APIExplorerResponse {
  statusCode: number;
  headers: Record<string, string>;
  body?: unknown;
  duration: number;
  error?: string;
}

export interface APIExplorerConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  timeout?: number;
  validateResponses?: boolean;
}

export interface APIVersion {
  version: string;
  status: 'current' | 'deprecated' | ' sunset';
  sunsetDate?: Date;
  deprecationMessage?: string;
  changelog?: Changelog;
}

export interface OpenAPIDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
    termsOfService?: string;
    contact?: ContactInfo;
    license?: LicenseInfo;
  };
  servers?: ServerInfo[];
  paths: Record<string, Record<HttpMethod, Omit<EndpointDefinition, 'method' | 'path' | 'endpointId'>>>;
  components?: APIComponent;
  tags?: TagDefinition[];
  security?: SecurityRequirement[];
  externalDocs?: { description?: string; url: string };
}

export interface DocumentationConfig {
  title: string;
  description?: string;
  version: string;
  openapiVersion: OpenAPIVersion;
  baseUrl?: string;
  tags?: TagDefinition[];
  servers?: ServerInfo[];
  auth?: { type: AuthenticationType; name: string; description?: string };
}

export interface DocumentationGenerator {
  config: DocumentationConfig;
  generateDocument(): OpenAPIDocument;
  generateChangelog(fromVersion?: string, toVersion?: string): Changelog;
  addEndpoint(endpoint: Omit<EndpointDefinition, 'endpointId'>): EndpointDefinition;
  removeEndpoint(endpointId: string): boolean;
  updateEndpoint(endpointId: string, updates: Partial<EndpointDefinition>): EndpointDefinition | null;
  getEndpoint(endpointId: string): EndpointDefinition | null;
  getEndpointsByTag(tag: string): EndpointDefinition[];
  getEndpointsByMethod(method: HttpMethod): EndpointDefinition[];
  addSchema(name: string, schema: SchemaDefinition): void;
  getSchema(name: string): SchemaDefinition | null;
  getAllSchemas(): Record<string, SchemaDefinition>;
  addVersion(version: APIVersion): void;
  getVersions(): APIVersion[];
  addSecurityScheme(scheme: SecurityScheme): void;
  getSecuritySchemes(): Record<string, SecurityScheme>;
  exportToJSON(): string;
  exportToYAML(): string;
}

export interface SchemaGenerator {
  fromTypeScriptInterface(interfaceDef: Record<string, unknown>): SchemaDefinition;
  fromEntity<T extends Record<string, unknown>>(entity: T): SchemaDefinition;
  arrayOf(schema: SchemaDefinition): SchemaDefinition;
  enumOf(values: unknown[]): SchemaDefinition;
  required(fields: string[]): (schema: SchemaDefinition) => SchemaDefinition;
  withExample(schema: SchemaDefinition, example: unknown): SchemaDefinition;
}

export interface APIExplorer {
  config: APIExplorerConfig;
  executeRequest(request: APIExplorerRequest): Promise<APIExplorerResponse>;
  validateRequest(request: APIExplorerRequest): { valid: boolean; errors: string[] };
  generateCode(request: APIExplorerRequest, language: 'curl' | 'javascript' | 'python'): string;
}

export interface CodeSnippet {
  language: 'curl' | 'javascript' | 'python' | 'typescript' | 'go' | 'java';
  code: string;
  description?: string;
}

export interface EndpointTest {
  endpointId: string;
  name: string;
  request: APIExplorerRequest;
  expectedStatus?: number;
  expectedResponseSchema?: SchemaDefinition;
}

export interface DocumentationStats {
  totalEndpoints: number;
  endpointsByMethod: Record<HttpMethod, number>;
  endpointsByTag: Record<string, number>;
  totalSchemas: number;
  authenticatedEndpoints: number;
  deprecatedEndpoints: number;
}

export function isValidHttpMethod(method: string): method is HttpMethod {
  return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
}

export function isValidParameterType(type: string): type is ParameterType {
  return ['path', 'query', 'header', 'cookie'].includes(type);
}

export function isValidSchemaType(type: string): type is SchemaType {
  return ['string', 'number', 'boolean', 'object', 'array', 'integer', 'null'].includes(type);
}

export function createReference(ref: string): { $ref: string } {
  return { $ref: `#${ref}` };
}

export function createSchemaRef(path: string[]): string {
  return `#/components/schemas/${path.join('/')}`;
}

export function createParameterRef(name: string, location: ParameterType): string {
  return `#/components/parameters/${location}/${name}`;
}

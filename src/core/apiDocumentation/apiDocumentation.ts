/**
 * API Documentation Generator Implementation
 * OpenAPI/Swagger documentation generator with versioning and interactive explorer
 */

import crypto from 'crypto';
import {
  HttpMethod,
  ParameterType,
  SchemaType,
  AuthenticationType,
  SecuritySchemeType,
  SchemaDefinition,
  ParameterDefinition,
  RequestBodyDefinition,
  ResponseDefinition,
  EndpointDefinition,
  SecurityScheme,
  OAuth2Flows,
  SecurityRequirement,
  APIComponent,
  ChangelogEntry,
  Changelog,
  APIExplorerRequest,
  APIExplorerResponse,
  APIExplorerConfig,
  APIVersion,
  OpenAPIDocument,
  DocumentationConfig,
  DocumentationGenerator,
  SchemaGenerator,
  APIExplorer,
  DocumentationStats,
  isValidHttpMethod,
} from './types';

export class SchemaGeneratorImpl implements SchemaGenerator {
  fromTypeScriptInterface(_interfaceDef: Record<string, unknown>): SchemaDefinition {
    const properties: Record<string, SchemaDefinition> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(_interfaceDef)) {
      const schema = this.inferSchema(value);
      properties[key] = schema;
      if (value !== undefined && value !== null) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  fromEntity<T extends Record<string, unknown>>(entity: T): SchemaDefinition {
    const properties: Record<string, SchemaDefinition> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(entity)) {
      const schema = this.inferSchema(value);
      properties[key] = schema;
      if (value !== undefined && value !== null) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  arrayOf(schema: SchemaDefinition): SchemaDefinition {
    return {
      type: 'array',
      items: schema,
    };
  }

  enumOf(values: unknown[]): SchemaDefinition {
    return {
      type: typeof values[0] as SchemaType,
      enum: values,
    };
  }

  required(fields: string[]): (_schema: SchemaDefinition) => SchemaDefinition {
    return (schema: SchemaDefinition): SchemaDefinition => ({
      ...schema,
      required: fields,
    });
  }

  withExample(schema: SchemaDefinition, example: unknown): SchemaDefinition {
    return {
      ...schema,
      example,
    };
  }

  private inferSchema(value: unknown): SchemaDefinition {
    if (value === null) {
      return { type: 'string', nullable: true };
    }
    if (value === undefined) {
      return { type: 'string' };
    }
    if (typeof value === 'string') {
      return { type: 'string' };
    }
    if (typeof value === 'number') {
      return Number.isInteger(value) ? { type: 'integer' } : { type: 'number' };
    }
    if (typeof value === 'boolean') {
      return { type: 'boolean' };
    }
    if (Array.isArray(value)) {
      const itemSchema = value.length > 0 ? this.inferSchema(value[0]) : { type: 'string' as const };
      return { type: 'array', items: itemSchema };
    }
    if (typeof value === 'object') {
      const properties: Record<string, SchemaDefinition> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        properties[k] = this.inferSchema(v);
      }
      return { type: 'object', properties };
    }
    return { type: 'string' };
  }
}

export class APIExplorerImpl implements APIExplorer {
  public config: APIExplorerConfig;

  constructor(config: APIExplorerConfig) {
    this.config = {
      baseUrl: config.baseUrl,
      defaultHeaders: config.defaultHeaders || {},
      timeout: config.timeout || 30000,
      validateResponses: config.validateResponses ?? true,
    };
  }

  async executeRequest(request: APIExplorerRequest): Promise<APIExplorerResponse> {
    const startTime = Date.now();
    const headers: Record<string, string> = { ...this.config.defaultHeaders };

    if (request.headers) {
      Object.assign(headers, request.headers);
    }

    if (request.authentication) {
      switch (request.authentication.type) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${request.authentication.token}`;
          break;
        case 'api_key':
          headers['X-API-Key'] = request.authentication.apiKey || '';
          break;
        case 'basic':
          if (request.authentication.token) {
            headers['Authorization'] = `Basic ${request.authentication.token}`;
          }
          break;
      }
    }

    const url = new URL(request.path, this.config.baseUrl);
    if (request.parameters) {
      for (const [key, value] of Object.entries(request.parameters)) {
        if (request.method === 'GET' && value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      }
    }

    try {
      const response = await fetch(url.toString(), {
        method: request.method,
        headers,
        body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
        signal: AbortSignal.timeout(this.config.timeout ?? 30000),
      });

      const duration = Date.now() - startTime;
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let body: unknown;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        body = await response.json();
      } else {
        body = await response.text();
      }

      return {
        statusCode: response.status,
        headers: responseHeaders,
        body,
        duration,
      };
    } catch (error) {
      return {
        statusCode: 0,
        headers: {},
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  validateRequest(request: APIExplorerRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!isValidHttpMethod(request.method)) {
      errors.push(`Invalid HTTP method: ${request.method}`);
    }

    if (!request.path || !request.path.startsWith('/')) {
      errors.push('Path must be a valid URL path starting with /');
    }

    if (request.authentication) {
      switch (request.authentication.type) {
        case 'bearer':
          if (!request.authentication.token) {
            errors.push('Bearer token is required');
          }
          break;
        case 'api_key':
          if (!request.authentication.apiKey) {
            errors.push('API key is required');
          }
          break;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  generateCode(request: APIExplorerRequest, language: 'curl' | 'javascript' | 'python'): string {
    switch (language) {
      case 'curl':
        return this.generateCurl(request);
      case 'javascript':
        return this.generateJavaScript(request);
      case 'python':
        return this.generatePython(request);
      default:
        return this.generateCurl(request);
    }
  }

  private generateCurl(request: APIExplorerRequest): string {
    const lines: string[] = [`curl -X ${request.method} '${this.config.baseUrl}${request.path}'`];

    if (request.headers) {
      for (const [key, value] of Object.entries(request.headers)) {
        lines.push(`  -H '${key}: ${value}'`);
      }
    }

    if (request.authentication) {
      switch (request.authentication.type) {
        case 'bearer':
          lines.push(`  -H 'Authorization: Bearer ${request.authentication.token || ''}'`);
          break;
        case 'api_key':
          lines.push(`  -H 'X-API-Key: ${request.authentication.apiKey || ''}'`);
          break;
      }
    }

    if (request.body !== undefined) {
      lines.push(`  -d '${JSON.stringify(request.body)}'`);
    }

    return lines.join(' \\\n');
  }

  private generateJavaScript(request: APIExplorerRequest): string {
    const headers: Record<string, string> = { ...(request.headers || {}) };
    
    if (request.authentication) {
      switch (request.authentication.type) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${request.authentication.token || ''}`;
          break;
        case 'api_key':
          headers['X-API-Key'] = request.authentication.apiKey || '';
          break;
      }
    }

    if (request.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const options: Record<string, unknown> = {
      method: request.method,
      headers,
    };

    if (request.body !== undefined) {
      options.body = JSON.stringify(request.body);
    }

    return `const response = await fetch('${this.config.baseUrl}${request.path}', ${JSON.stringify(options, null, 2)});
const data = await response.json();
console.log(data);`;
  }

  private generatePython(request: APIExplorerRequest): string {
    const headers: Record<string, string> = { ...(request.headers || {}) };
    
    if (request.authentication) {
      switch (request.authentication.type) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${request.authentication.token || ''}`;
          break;
        case 'api_key':
          headers['X-API-Key'] = request.authentication.apiKey || '';
          break;
      }
    }

    let code = `import requests

`;
    
    if (request.body !== undefined) {
      code += `payload = ${JSON.stringify(request.body, null, 4)}

`;
    }

    const paramsPart = request.method === 'GET' && request.parameters
      ? `params=${JSON.stringify(request.parameters, null, 4)}
`
      : '';

    const dataPart = request.body !== undefined ? `data=json.dumps(payload)
` : '';

    code += `response = requests.${request.method.toLowerCase()}(
    '${this.config.baseUrl}${request.path}',
    ${paramsPart}${dataPart}headers=${JSON.stringify(headers, null, 4)}
)

print(response.json())`;

    return code;
  }
}

export class DocumentationGeneratorImpl implements DocumentationGenerator {
  public config: DocumentationConfig;
  private endpoints: Map<string, EndpointDefinition> = new Map();
  private schemas: Map<string, SchemaDefinition> = new Map();
  private securitySchemes: Map<string, SecurityScheme> = new Map();
  private versions: Map<string, APIVersion> = new Map();
  private changelog: Changelog = { versions: [] };

  constructor(config: DocumentationConfig) {
    this.config = {
      title: config.title,
      description: config.description,
      version: config.version,
      openapiVersion: config.openapiVersion || '3.1',
      baseUrl: config.baseUrl,
      tags: config.tags || [],
      servers: config.servers,
      auth: config.auth,
    };

    if (config.auth) {
      this.addSecurityScheme({
        name: config.auth.name,
        type: this.getSecuritySchemeType(config.auth.type),
        description: config.auth.description,
        scheme: config.auth.type === 'basic' ? 'basic' : undefined,
        bearerFormat: config.auth.type === 'bearer' ? 'JWT' : undefined,
        in: config.auth.type === 'api_key' ? 'header' : undefined,
      });
    }
  }

  generateDocument(): OpenAPIDocument {
    const paths: OpenAPIDocument['paths'] = {};

    for (const endpoint of this.endpoints.values()) {
      const { method, path, ...endpointWithoutMethod } = endpoint;
      
      if (!paths[path]) {
        paths[path] = {} as Record<HttpMethod, Omit<EndpointDefinition, 'method' | 'path' | 'endpointId'>>;
      }
      
      (paths[path] as Record<string, unknown>)[method] = {
        ...endpointWithoutMethod,
        responses: endpoint.responses,
        parameters: endpoint.parameters,
      };
    }

    const components: APIComponent | undefined = {
      schemas: Object.fromEntries(this.schemas),
      securitySchemes: Object.fromEntries(this.securitySchemes),
    };

    return {
      openapi: this.config.openapiVersion,
      info: {
        title: this.config.title,
        version: this.config.version,
        description: this.config.description,
      },
      servers: this.config.servers,
      paths,
      components: Object.keys(components.schemas).length > 0 || Object.keys(components.securitySchemes).length > 0
        ? components
        : undefined,
      tags: this.config.tags,
    };
  }

  generateChangelog(_fromVersion?: string, _toVersion?: string): Changelog {
    return this.changelog;
  }

  addEndpoint(endpoint: Omit<EndpointDefinition, 'endpointId'>): EndpointDefinition {
    const endpointId = this.generateEndpointId();
    const fullEndpoint: EndpointDefinition = {
      ...endpoint,
      endpointId,
      responses: endpoint.responses || { '200': { description: 'Successful response' } },
    };
    
    this.endpoints.set(endpointId, fullEndpoint);
    return fullEndpoint;
  }

  removeEndpoint(endpointId: string): boolean {
    return this.endpoints.delete(endpointId);
  }

  updateEndpoint(endpointId: string, updates: Partial<EndpointDefinition>): EndpointDefinition | null {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) return null;

    const updated: EndpointDefinition = {
      ...endpoint,
      ...updates,
      endpointId,
    };
    
    this.endpoints.set(endpointId, updated);
    return updated;
  }

  getEndpoint(endpointId: string): EndpointDefinition | null {
    return this.endpoints.get(endpointId) || null;
  }

  getEndpointsByTag(tag: string): EndpointDefinition[] {
    const result: EndpointDefinition[] = [];
    for (const endpoint of this.endpoints.values()) {
      if (endpoint.tags && endpoint.tags.includes(tag)) {
        result.push(endpoint);
      }
    }
    return result;
  }

  getEndpointsByMethod(method: HttpMethod): EndpointDefinition[] {
    const result: EndpointDefinition[] = [];
    for (const endpoint of this.endpoints.values()) {
      if (endpoint.method === method) {
        result.push(endpoint);
      }
    }
    return result;
  }

  addSchema(name: string, schema: SchemaDefinition): void {
    this.schemas.set(name, schema);
  }

  getSchema(name: string): SchemaDefinition | null {
    return this.schemas.get(name) || null;
  }

  getAllSchemas(): Record<string, SchemaDefinition> {
    return Object.fromEntries(this.schemas);
  }

  addVersion(version: APIVersion): void {
    this.versions.set(version.version, version);
  }

  getVersions(): APIVersion[] {
    return Array.from(this.versions.values());
  }

  addSecurityScheme(scheme: SecurityScheme): void {
    this.securitySchemes.set(scheme.name, scheme);
  }

  getSecuritySchemes(): Record<string, SecurityScheme> {
    return Object.fromEntries(this.securitySchemes);
  }

  exportToJSON(): string {
    return JSON.stringify(this.generateDocument(), null, 2);
  }

  exportToYAML(): string {
    const doc = this.generateDocument();
    return this.jsonToYaml(JSON.stringify(doc));
  }

  private generateEndpointId(): string {
    return `ep_${crypto.randomBytes(8).toString('hex')}`;
  }

  private getSecuritySchemeType(authType: AuthenticationType): SecuritySchemeType {
    switch (authType) {
      case 'bearer':
      case 'basic':
        return 'http';
      case 'api_key':
        return 'apiKey';
      case 'oauth2':
        return 'oauth2';
      default:
        return 'http';
    }
  }

  private jsonToYaml(json: string, indent: number = 0): string {
    const spaces = '  '.repeat(indent);
    const lines: string[] = [];
    
    try {
      const obj = JSON.parse(json);
      this.writeYamlValue(obj, lines, spaces);
    } catch {
      return json;
    }
    
    return lines.join('\n');
  }

  private writeYamlValue(value: unknown, lines: string[], spaces: string): void {
    if (value === null || value === undefined) {
      lines.push('null');
    } else if (typeof value === 'boolean' || typeof value === 'number') {
      lines.push(String(value));
    } else if (typeof value === 'string') {
      if (value.includes('\n') || value.includes(':') || value.includes('#')) {
        lines.push(`"${value.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(value);
      }
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push('[]');
      } else {
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            lines.push('-');
            this.writeYamlValue(item, lines, spaces + '  ');
          } else {
            lines.push(`- ${item}`);
          }
        }
      }
    } else if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) {
        lines.push('{}');
      } else {
        for (const [key, val] of entries) {
          if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            lines.push(`${key}:`);
            this.writeYamlValue(val, lines, spaces + '  ');
          } else {
            lines.push(`${key}: ${JSON.stringify(val)}`);
          }
        }
      }
    }
  }

  getStats(): DocumentationStats {
    const stats: DocumentationStats = {
      totalEndpoints: this.endpoints.size,
      endpointsByMethod: {
        GET: 0,
        POST: 0,
        PUT: 0,
        PATCH: 0,
        DELETE: 0,
      },
      endpointsByTag: {},
      totalSchemas: this.schemas.size,
      authenticatedEndpoints: 0,
      deprecatedEndpoints: 0,
    };

    for (const endpoint of this.endpoints.values()) {
      stats.endpointsByMethod[endpoint.method]++;
      
      if (endpoint.tags) {
        for (const tag of endpoint.tags) {
          stats.endpointsByTag[tag] = (stats.endpointsByTag[tag] || 0) + 1;
        }
      }
      
      if (endpoint.security && endpoint.security.length > 0) {
        stats.authenticatedEndpoints++;
      }
      
      if (endpoint.deprecated) {
        stats.deprecatedEndpoints++;
      }
    }

    return stats;
  }

  addChangelogEntry(entry: ChangelogEntry): void {
    this.changelog.versions.push(entry);
    this.changelog.versions.sort((a, b) => b.version.localeCompare(a.version));
  }
}

export function createDocumentationGenerator(config: DocumentationConfig): DocumentationGenerator {
  return new DocumentationGeneratorImpl(config);
}

export function createSchemaGenerator(): SchemaGenerator {
  return new SchemaGeneratorImpl();
}

export function createAPIExplorer(config: APIExplorerConfig): APIExplorer {
  return new APIExplorerImpl(config);
}

export function createEndpoint(
  method: HttpMethod,
  path: string,
  options?: {
    summary?: string;
    description?: string;
    tags?: string[];
    parameters?: ParameterDefinition[];
    requestBody?: RequestBodyDefinition;
    responses?: Record<string, ResponseDefinition>;
    deprecated?: boolean;
    security?: SecurityRequirement[];
  }
): Omit<EndpointDefinition, 'endpointId'> {
  return {
    method,
    path,
    operationId: `${method.toLowerCase()}_${path.replace(/\//g, '_').replace(/[{}]/g, '')}`,
    summary: options?.summary,
    description: options?.description,
    tags: options?.tags,
    parameters: options?.parameters,
    requestBody: options?.requestBody,
    responses: options?.responses || { '200': { description: 'Successful response' } },
    deprecated: options?.deprecated,
    security: options?.security,
  };
}

export function createSchema(
  type: SchemaType,
  options?: {
    format?: string;
    description?: string;
    example?: unknown;
    enum?: unknown[];
    properties?: Record<string, SchemaDefinition>;
    required?: string[];
    items?: SchemaDefinition;
  }
): SchemaDefinition {
  return {
    type,
    format: options?.format,
    description: options?.description,
    example: options?.example,
    enum: options?.enum,
    properties: options?.properties,
    required: options?.required,
    items: options?.items,
  };
}

export function createParameter(
  name: string,
  location: ParameterType,
  options?: {
    required?: boolean;
    description?: string;
    schema?: SchemaDefinition;
    example?: unknown;
    deprecated?: boolean;
  }
): ParameterDefinition {
  return {
    name,
    in: location,
    required: location === 'path' ? true : options?.required,
    description: options?.description,
    schema: options?.schema,
    example: options?.example,
    deprecated: options?.deprecated,
  };
}

export function createResponse(
  description: string,
  options?: {
    schema?: SchemaDefinition;
    contentType?: string;
    example?: unknown;
    headers?: Record<string, ParameterDefinition>;
  }
): ResponseDefinition {
  return {
    description,
    schema: options?.schema,
    contentType: options?.contentType || 'application/json',
    example: options?.example,
    headers: options?.headers,
  };
}

export function createRequestBody(
  schema: SchemaDefinition,
  options?: {
    description?: string;
    required?: boolean;
    contentType?: string;
    examples?: Record<string, { value?: unknown; summary?: string }>;
  }
): RequestBodyDefinition {
  return {
    description: options?.description,
    required: options?.required ?? true,
    contentType: options?.contentType || 'application/json',
    schema,
    examples: options?.examples,
  };
}

export function createSecurityScheme(
  name: string,
  type: SecuritySchemeType,
  options?: {
    scheme?: string;
    bearerFormat?: string;
    in?: 'query' | 'header' | 'cookie';
    flows?: OAuth2Flows;
    description?: string;
  }
): SecurityScheme {
  return {
    name,
    type,
    scheme: options?.scheme,
    bearerFormat: options?.bearerFormat,
    in: options?.in,
    flows: options?.flows,
    description: options?.description,
  };
}

export function createOAuth2Flows(
  flows: {
    implicit?: { authorizationUrl: string; scopes: Record<string, string> };
    authorizationCode?: { authorizationUrl: string; tokenUrl: string; scopes: Record<string, string> };
  }
): OAuth2Flows {
  const result: OAuth2Flows = {};
  
  if (flows.implicit) {
    result.implicit = {
      authorizationUrl: flows.implicit.authorizationUrl,
      scopes: flows.implicit.scopes,
    };
  }
  
  if (flows.authorizationCode) {
    result.authorizationCode = {
      authorizationUrl: flows.authorizationCode.authorizationUrl,
      tokenUrl: flows.authorizationCode.tokenUrl,
      scopes: flows.authorizationCode.scopes,
    };
  }
  
  return result;
}

export class APIDocumentationManager {
  private generators: Map<string, DocumentationGenerator> = new Map();

  createDocumentation(name: string, config: DocumentationConfig): DocumentationGenerator {
    const generator = createDocumentationGenerator(config);
    this.generators.set(name, generator);
    return generator;
  }

  getDocumentation(name: string): DocumentationGenerator | null {
    return this.generators.get(name) || null;
  }

  listDocumentations(): string[] {
    return Array.from(this.generators.keys());
  }

  removeDocumentation(name: string): boolean {
    return this.generators.delete(name);
  }
}

export function createAPIDocumentationManager(): APIDocumentationManager {
  return new APIDocumentationManager();
}

/**
 * API Documentation Generator
 * OpenAPI/Swagger documentation generator with versioning and interactive explorer
 */

export {
  OpenAPIVersion,
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
  OAuth2Flow,
  SecurityRequirement,
  ContactInfo,
  LicenseInfo,
  ServerInfo,
  TagDefinition,
  APIComponent,
  ChangelogEntry,
  ChangelogChange,
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
  CodeSnippet,
  EndpointTest,
  DocumentationStats,
  isValidHttpMethod,
  isValidParameterType,
  isValidSchemaType,
  createReference,
  createSchemaRef,
  createParameterRef,
} from './types';

export {
  DocumentationGeneratorImpl,
  createDocumentationGenerator,
  createSchemaGenerator,
  createAPIExplorer,
  createEndpoint,
  createSchema,
  createParameter,
  createResponse,
  createRequestBody,
  createSecurityScheme,
  createOAuth2Flows,
  createAPIDocumentationManager,
  APIDocumentationManager,
} from './apiDocumentation';

import {
  DocumentationGeneratorImpl,
  createDocumentationGenerator,
  createSchemaGenerator,
  createAPIExplorer,
  createEndpoint,
  createParameter,
  createResponse,
  createRequestBody,
  createSecurityScheme,
  createOAuth2Flows,
} from './apiDocumentation';

import {
  DocumentationConfig,
  SchemaGenerator,
  APIExplorer,
  APIExplorerConfig,
  HttpMethod,
  ParameterType,
  SchemaType,
  SchemaDefinition,
  ParameterDefinition,
  RequestBodyDefinition,
  ResponseDefinition,
  SecurityScheme,
  SecurityRequirement,
  OAuth2Flows,
  EndpointDefinition,
} from './types';

export class APIDocGenerator extends DocumentationGeneratorImpl {
  constructor(config: DocumentationConfig) {
    super(config);
  }
}

export class SchemaBuilder implements SchemaGenerator {
  private innerGenerator: SchemaGenerator;

  constructor() {
    this.innerGenerator = createSchemaGenerator();
  }

  fromTypeScriptInterface(interfaceDef: Record<string, unknown>): SchemaDefinition {
    return this.innerGenerator.fromTypeScriptInterface(interfaceDef);
  }

  fromEntity<T extends Record<string, unknown>>(entity: T): SchemaDefinition {
    return this.innerGenerator.fromEntity(entity);
  }

  arrayOf(schema: SchemaDefinition): SchemaDefinition {
    return this.innerGenerator.arrayOf(schema);
  }

  enumOf(values: unknown[]): SchemaDefinition {
    return this.innerGenerator.enumOf(values);
  }

  required(fields: string[]): (_schema: SchemaDefinition) => SchemaDefinition {
    return this.innerGenerator.required(fields);
  }

  withExample(schema: SchemaDefinition, example: unknown): SchemaDefinition {
    return this.innerGenerator.withExample(schema, example);
  }
}

export class APIEndpointBuilder {
  private endpoint: Omit<EndpointDefinition, 'endpointId'>;

  constructor(method: HttpMethod, path: string) {
    this.endpoint = createEndpoint(method, path);
  }

  withSummary(summary: string): this {
    this.endpoint.summary = summary;
    return this;
  }

  withDescription(description: string): this {
    this.endpoint.description = description;
    return this;
  }

  withTags(...tags: string[]): this {
    this.endpoint.tags = tags;
    return this;
  }

  withParameters(parameters: ParameterDefinition[]): this {
    this.endpoint.parameters = parameters;
    return this;
  }

  withRequestBody(requestBody: RequestBodyDefinition): this {
    this.endpoint.requestBody = requestBody;
    return this;
  }

  withResponses(responses: Record<string, ResponseDefinition>): this {
    this.endpoint.responses = responses;
    return this;
  }

  withSecurity(security: SecurityRequirement[]): this {
    this.endpoint.security = security;
    return this;
  }

  deprecated(): this {
    this.endpoint.deprecated = true;
    return this;
  }

  build(): Omit<EndpointDefinition, 'endpointId'> {
    return this.endpoint;
  }
}

export class SchemaDefinitionBuilder {
  private schema: SchemaDefinition;

  constructor(type: SchemaType) {
    this.schema = { type };
  }

  withFormat(format: string): this {
    this.schema.format = format;
    return this;
  }

  withDescription(description: string): this {
    this.schema.description = description;
    return this;
  }

  withExample(example: unknown): this {
    this.schema.example = example;
    return this;
  }

  withEnum(values: unknown[]): this {
    this.schema.enum = values;
    return this;
  }

  withProperties(properties: Record<string, SchemaDefinition>): this {
    this.schema.properties = properties;
    return this;
  }

  withRequired(fields: string[]): this {
    this.schema.required = fields;
    return this;
  }

  withItems(items: SchemaDefinition): this {
    this.schema.items = items;
    return this;
  }

  nullable(): this {
    this.schema.nullable = true;
    return this;
  }

  readOnly(): this {
    this.schema.readOnly = true;
    return this;
  }

  writeOnly(): this {
    this.schema.writeOnly = true;
    return this;
  }

  build(): SchemaDefinition {
    return this.schema;
  }
}

export class APIExplorerClient implements APIExplorer {
  private explorer: APIExplorer;
  public config: APIExplorerConfig;

  constructor(config: APIExplorerConfig) {
    this.config = config;
    this.explorer = createAPIExplorer(config);
  }

  executeRequest(request: Parameters<APIExplorer['executeRequest']>[0]): ReturnType<APIExplorer['executeRequest']> {
    return this.explorer.executeRequest(request);
  }

  validateRequest(request: Parameters<APIExplorer['validateRequest']>[0]): ReturnType<APIExplorer['validateRequest']> {
    return this.explorer.validateRequest(request);
  }

  generateCode(request: Parameters<APIExplorer['generateCode']>[0], language: Parameters<APIExplorer['generateCode']>[1]): ReturnType<APIExplorer['generateCode']> {
    return this.explorer.generateCode(request, language);
  }
}

export function createBuilder() {
  return {
    endpoint: (method: HttpMethod, path: string) => new APIEndpointBuilder(method, path),
    schema: (type: SchemaType) => new SchemaDefinitionBuilder(type),
    generator: () => new SchemaBuilder(),
    explorer: (config: APIExplorerConfig) => new APIExplorerClient(config),
    documentation: (config: DocumentationConfig) => createDocumentationGenerator(config),
    oauth2Flows: (flows: Parameters<typeof createOAuth2Flows>[0]) => createOAuth2Flows(flows),
    securityScheme: (
      name: string,
      type: SecurityScheme['type'],
      options?: {
        scheme?: string;
        bearerFormat?: string;
        in?: 'query' | 'header' | 'cookie';
        flows?: OAuth2Flows;
        description?: string;
      }
    ) => createSecurityScheme(name, type, options),
    parameter: (
      name: string,
      location: ParameterType,
      options?: {
        required?: boolean;
        description?: string;
        schema?: SchemaDefinition;
        example?: unknown;
        deprecated?: boolean;
      }
    ) => createParameter(name, location, options),
    response: (
      description: string,
      options?: {
        schema?: SchemaDefinition;
        contentType?: string;
        example?: unknown;
        headers?: Record<string, ParameterDefinition>;
      }
    ) => createResponse(description, options),
    requestBody: (
      schema: SchemaDefinition,
      options?: {
        description?: string;
        required?: boolean;
        contentType?: string;
        examples?: Record<string, { value?: unknown; summary?: string }>;
      }
    ) => createRequestBody(schema, options),
  };
}

export function createUserSchema(): SchemaDefinition {
  return new SchemaDefinitionBuilder('object')
    .withProperties({
      id: new SchemaDefinitionBuilder('string').build(),
      email: new SchemaDefinitionBuilder('string').withFormat('email').build(),
      name: new SchemaDefinitionBuilder('string').build(),
      age: new SchemaDefinitionBuilder('integer').withDescription('User age in years').build(),
      createdAt: new SchemaDefinitionBuilder('string').withFormat('date-time').build(),
      updatedAt: new SchemaDefinitionBuilder('string').withFormat('date-time').build(),
    })
    .withRequired(['id', 'email', 'name'])
    .build();
}

export function createPaginatedResponseSchema(itemSchema: SchemaDefinition): SchemaDefinition {
  return new SchemaDefinitionBuilder('object')
    .withProperties({
      items: new SchemaDefinitionBuilder('array').withItems(itemSchema).build(),
      total: new SchemaDefinitionBuilder('integer').build(),
      page: new SchemaDefinitionBuilder('integer').build(),
      pageSize: new SchemaDefinitionBuilder('integer').build(),
      totalPages: new SchemaDefinitionBuilder('integer').build(),
    })
    .withRequired(['items', 'total', 'page', 'pageSize', 'totalPages'])
    .build();
}

export function createErrorSchema(): SchemaDefinition {
  return new SchemaDefinitionBuilder('object')
    .withProperties({
      error: new SchemaDefinitionBuilder('string').build(),
      message: new SchemaDefinitionBuilder('string').build(),
      code: new SchemaDefinitionBuilder('string').build(),
      details: new SchemaDefinitionBuilder('object').build(),
    })
    .withRequired(['error', 'message'])
    .build();
}

export function createBearerAuthScheme(name: string = 'BearerAuth'): SecurityScheme {
  return createSecurityScheme(name, 'http', {
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });
}

export function createApiKeyScheme(name: string = 'ApiKeyAuth', inLocation: 'query' | 'header' | 'cookie' = 'header'): SecurityScheme {
  return createSecurityScheme(name, 'apiKey', {
    in: inLocation,
  });
}

export function createOAuth2Scheme(name: string = 'OAuth2', flows: OAuth2Flows): SecurityScheme {
  return createSecurityScheme(name, 'oauth2', {
    flows,
  });
}

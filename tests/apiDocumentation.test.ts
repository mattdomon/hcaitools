/**
 * API Documentation Generator Tests
 */

import {
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
  APIDocGenerator,
  APIDocumentationManager,
  SchemaBuilder,
  APIEndpointBuilder,
  SchemaDefinitionBuilder,
  APIExplorerClient,
  createBuilder,
  createUserSchema,
  createPaginatedResponseSchema,
  createErrorSchema,
  createBearerAuthScheme,
  createApiKeyScheme,
  createOAuth2Scheme,
} from '../src/core/apiDocumentation';

import {
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
  DocumentationConfig,
  ChangelogEntry,
  APIVersion,
  OpenAPIDocument,
  APIExplorerRequest,
  APIExplorerResponse,
  APIExplorerConfig,
  DocumentationStats,
  DocumentationGenerator,
  APIExplorer,
  SchemaGenerator,
} from '../src/core/apiDocumentation/types';

describe('API Documentation Generator', () => {
  let generator: DocumentationGenerator;
  let schemaBuilder: SchemaBuilder;
  let explorer: APIExplorer;

  beforeEach(() => {
    generator = createDocumentationGenerator({
      title: 'Test API',
      description: 'Test API Documentation',
      version: '1.0.0',
      openapiVersion: '3.1',
      baseUrl: 'https://api.example.com',
    });

    schemaBuilder = new SchemaBuilder();
    explorer = createAPIExplorer({
      baseUrl: 'https://api.example.com',
      timeout: 5000,
    });
  });

  describe('DocumentationGenerator', () => {
    test('should create documentation generator with config', () => {
      expect(generator).toBeDefined();
      expect(generator.config.title).toBe('Test API');
      expect(generator.config.version).toBe('1.0.0');
    });

    test('should generate empty OpenAPI document', () => {
      const doc = generator.generateDocument();
      expect(doc.openapi).toBe('3.1');
      expect(doc.info.title).toBe('Test API');
      expect(doc.info.version).toBe('1.0.0');
      expect(doc.paths).toEqual({});
    });

    test('should add endpoint and generate document', () => {
      const endpoint = createEndpoint('GET', '/users', {
        summary: 'List users',
        description: 'Get all users',
        tags: ['users'],
        responses: {
          '200': { description: 'Successful response' },
        },
      });

      generator.addEndpoint(endpoint);
      const doc = generator.generateDocument();

      expect(Object.keys(doc.paths)).toContain('/users');
      expect(doc.paths['/users']).toBeDefined();
    });

    test('should add multiple endpoints', () => {
      generator.addEndpoint(createEndpoint('GET', '/users', { summary: 'List users' }));
      generator.addEndpoint(createEndpoint('POST', '/users', { summary: 'Create user' }));
      generator.addEndpoint(createEndpoint('GET', '/users/{id}', { summary: 'Get user' }));

      const doc = generator.generateDocument();
      expect(Object.keys(doc.paths)).toHaveLength(2);
      expect(doc.paths['/users']).toHaveProperty('GET');
      expect(doc.paths['/users']).toHaveProperty('POST');
      expect(doc.paths['/users/{id}']).toHaveProperty('GET');
    });

    test('should remove endpoint', () => {
      const endpoint = createEndpoint('GET', '/users', { summary: 'List users' });
      const added = generator.addEndpoint(endpoint);
      
      expect(generator.removeEndpoint(added.endpointId)).toBe(true);
      expect(generator.removeEndpoint('nonexistent')).toBe(false);
    });

    test('should update endpoint', () => {
      const endpoint = createEndpoint('GET', '/users', { summary: 'List users' });
      const added = generator.addEndpoint(endpoint);
      
      const updated = generator.updateEndpoint(added.endpointId, { summary: 'Updated summary' });
      
      expect(updated).toBeDefined();
      expect(updated?.summary).toBe('Updated summary');
    });

    test('should get endpoint by id', () => {
      const endpoint = createEndpoint('GET', '/users', { summary: 'List users' });
      const added = generator.addEndpoint(endpoint);
      
      const retrieved = generator.getEndpoint(added.endpointId);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.path).toBe('/users');
    });

    test('should get endpoints by tag', () => {
      generator.addEndpoint(createEndpoint('GET', '/users', { summary: 'List users', tags: ['users'] }));
      generator.addEndpoint(createEndpoint('POST', '/users', { summary: 'Create user', tags: ['users'] }));
      generator.addEndpoint(createEndpoint('GET', '/products', { summary: 'List products', tags: ['products'] }));

      const userEndpoints = generator.getEndpointsByTag('users');
      expect(userEndpoints).toHaveLength(2);
    });

    test('should get endpoints by method', () => {
      generator.addEndpoint(createEndpoint('GET', '/users', { summary: 'List users' }));
      generator.addEndpoint(createEndpoint('POST', '/users', { summary: 'Create user' }));
      generator.addEndpoint(createEndpoint('GET', '/products', { summary: 'List products' }));

      const getEndpoints = generator.getEndpointsByMethod('GET');
      expect(getEndpoints).toHaveLength(2);
    });

    test('should add and retrieve schemas', () => {
      const userSchema = createSchema('object', {
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
      });

      generator.addSchema('User', userSchema);
      
      const retrieved = generator.getSchema('User');
      expect(retrieved).toBeDefined();
      expect(retrieved?.type).toBe('object');
    });

    test('should add security schemes', () => {
      const scheme = createSecurityScheme('BearerAuth', 'http', {
        scheme: 'bearer',
        bearerFormat: 'JWT',
      });

      generator.addSecurityScheme(scheme);
      const schemes = generator.getSecuritySchemes();
      
      expect(schemes['BearerAuth']).toBeDefined();
      expect(schemes['BearerAuth']?.type).toBe('http');
    });

    test('should add versions', () => {
      const version: APIVersion = {
        version: '2.0.0',
        status: 'current',
      };

      generator.addVersion(version);
      const versions = generator.getVersions();
      
      expect(versions).toHaveLength(1);
      expect(versions[0].version).toBe('2.0.0');
    });

    test('should export to JSON', () => {
      const json = generator.exportToJSON();
      expect(json).toBeDefined();
      expect(() => JSON.parse(json)).not.toThrow();
    });

    test('should get documentation stats', () => {
      generator.addEndpoint(createEndpoint('GET', '/users', { summary: 'List users' }));
      generator.addEndpoint(createEndpoint('POST', '/users', { summary: 'Create user' }));
      generator.addEndpoint(createEndpoint('DELETE', '/users/{id}', { summary: 'Delete user', deprecated: true }));

      const stats = (generator as DocumentationGeneratorImpl).getStats();
      
      expect(stats.totalEndpoints).toBe(3);
      expect(stats.endpointsByMethod.GET).toBe(1);
      expect(stats.endpointsByMethod.POST).toBe(1);
      expect(stats.endpointsByMethod.DELETE).toBe(1);
      expect(stats.deprecatedEndpoints).toBe(1);
    });

    test('should add changelog entry', () => {
      const entry: ChangelogEntry = {
        version: '1.1.0',
        date: new Date(),
        changes: [
          { type: 'added', description: 'New endpoint added' },
        ],
      };

      (generator as DocumentationGeneratorImpl).addChangelogEntry(entry);
      const changelog = generator.generateChangelog();
      
      expect(changelog.versions).toHaveLength(1);
      expect(changelog.versions[0].version).toBe('1.1.0');
    });
  });

  describe('SchemaGenerator', () => {
    test('should create schema generator', () => {
      expect(schemaBuilder).toBeDefined();
    });

    test('should generate schema from interface definition', () => {
      const schema = schemaBuilder.fromTypeScriptInterface({
        id: 'string',
        name: 'string',
        age: 25,
      });

      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
    });

    test('should generate schema from entity', () => {
      const entity = {
        id: '123',
        name: 'John',
        active: true,
      };

      const schema = schemaBuilder.fromEntity(entity);
      expect(schema.type).toBe('object');
    });

    test('should create array schema', () => {
      const itemSchema = schemaBuilder.fromEntity({ id: '123' });
      const arraySchema = schemaBuilder.arrayOf(itemSchema);

      expect(arraySchema.type).toBe('array');
      expect(arraySchema.items).toBeDefined();
    });

    test('should create enum schema', () => {
      const enumSchema = schemaBuilder.enumOf(['active', 'inactive', 'pending']);

      expect(enumSchema.type).toBe('string');
      expect(enumSchema.enum).toEqual(['active', 'inactive', 'pending']);
    });

    test('should add required fields to schema', () => {
      const schema = schemaBuilder.fromEntity({ id: '123', name: 'John' });
      const withRequired = schemaBuilder.required(['id'])(schema);

      expect(withRequired.required).toContain('id');
    });

    test('should add example to schema', () => {
      const schema = schemaBuilder.fromEntity({ id: '123' });
      const withExample = schemaBuilder.withExample(schema, { id: '456' });

      expect(withExample.example).toEqual({ id: '456' });
    });
  });

  describe('APIEndpointBuilder', () => {
    test('should create endpoint with builder pattern', () => {
      const endpoint = new APIEndpointBuilder('GET', '/users')
        .withSummary('List users')
        .withDescription('Get all users')
        .withTags('users', 'list')
        .withResponses({ '200': { description: 'Success' } })
        .build();

      expect(endpoint.method).toBe('GET');
      expect(endpoint.path).toBe('/users');
      expect(endpoint.summary).toBe('List users');
      expect(endpoint.tags).toEqual(['users', 'list']);
    });

    test('should mark endpoint as deprecated', () => {
      const endpoint = new APIEndpointBuilder('DELETE', '/users/{id}')
        .withSummary('Delete user')
        .deprecated()
        .build();

      expect(endpoint.deprecated).toBe(true);
    });

    test('should add security to endpoint', () => {
      const endpoint = new APIEndpointBuilder('POST', '/users')
        .withSummary('Create user')
        .withSecurity([{ name: 'BearerAuth' }])
        .build();

      expect(endpoint.security).toBeDefined();
      expect(endpoint.security?.[0].name).toBe('BearerAuth');
    });
  });

  describe('SchemaDefinitionBuilder', () => {
    test('should create string schema', () => {
      const schema = new SchemaDefinitionBuilder('string')
        .withFormat('email')
        .withDescription('User email')
        .build();

      expect(schema.type).toBe('string');
      expect(schema.format).toBe('email');
      expect(schema.description).toBe('User email');
    });

    test('should create object schema with properties', () => {
      const schema = new SchemaDefinitionBuilder('object')
        .withProperties({
          id: { type: 'string' },
          name: { type: 'string' },
        })
        .withRequired(['id', 'name'])
        .build();

      expect(schema.type).toBe('object');
      expect(Object.keys(schema.properties || {})).toHaveLength(2);
      expect(schema.required).toEqual(['id', 'name']);
    });

    test('should create array schema', () => {
      const schema = new SchemaDefinitionBuilder('array')
        .withItems({ type: 'string' })
        .build();

      expect(schema.type).toBe('array');
      expect(schema.items).toBeDefined();
    });

    test('should mark schema as nullable', () => {
      const schema = new SchemaDefinitionBuilder('string')
        .nullable()
        .build();

      expect(schema.nullable).toBe(true);
    });

    test('should mark schema as readOnly', () => {
      const schema = new SchemaDefinitionBuilder('string')
        .readOnly()
        .build();

      expect(schema.readOnly).toBe(true);
    });

    test('should add enum values', () => {
      const schema = new SchemaDefinitionBuilder('string')
        .withEnum(['active', 'inactive'])
        .build();

      expect(schema.enum).toEqual(['active', 'inactive']);
    });

    test('should add example', () => {
      const schema = new SchemaDefinitionBuilder('string')
        .withExample('test@example.com')
        .build();

      expect(schema.example).toBe('test@example.com');
    });
  });

  describe('APIExplorer', () => {
    test('should create API explorer', () => {
      expect(explorer).toBeDefined();
      expect(explorer.config.baseUrl).toBe('https://api.example.com');
    });

    test('should validate request with valid method and path', () => {
      const request: APIExplorerRequest = {
        method: 'GET',
        path: '/users',
      };

      const result = explorer.validateRequest(request);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate request with invalid method', () => {
      const request = {
        method: 'INVALID' as HttpMethod,
        path: '/users',
      };

      const result = explorer.validateRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate request with invalid path', () => {
      const request: APIExplorerRequest = {
        method: 'GET',
        path: 'users', // missing leading /
      };

      const result = explorer.validateRequest(request);
      expect(result.valid).toBe(false);
    });

    test('should validate bearer token authentication', () => {
      const request: APIExplorerRequest = {
        method: 'GET',
        path: '/users',
        authentication: { type: 'bearer', token: 'abc123' },
      };

      const result = explorer.validateRequest(request);
      expect(result.valid).toBe(true);
    });

    test('should fail validation when bearer token is missing', () => {
      const request: APIExplorerRequest = {
        method: 'GET',
        path: '/users',
        authentication: { type: 'bearer' },
      };

      const result = explorer.validateRequest(request);
      expect(result.valid).toBe(false);
    });

    test('should generate curl code', () => {
      const request: APIExplorerRequest = {
        method: 'POST',
        path: '/users',
        body: { name: 'John' },
        authentication: { type: 'bearer', token: 'abc123' },
      };

      const curl = explorer.generateCode(request, 'curl');
      expect(curl).toContain('curl -X POST');
      expect(curl).toContain('Authorization: Bearer abc123');
    });

    test('should generate JavaScript code', () => {
      const request: APIExplorerRequest = {
        method: 'GET',
        path: '/users',
      };

      const js = explorer.generateCode(request, 'javascript');
      expect(js).toContain("fetch('https://api.example.com/users'");
    });

    test('should generate Python code', () => {
      const request: APIExplorerRequest = {
        method: 'POST',
        path: '/users',
        body: { name: 'John' },
      };

      const python = explorer.generateCode(request, 'python');
      expect(python).toContain("requests.post(");
      expect(python).toContain("'https://api.example.com/users'");
    });
  });

  describe('APIExplorerClient', () => {
    test('should create API explorer client', () => {
      const client = new APIExplorerClient({
        baseUrl: 'https://api.example.com',
      });

      expect(client).toBeDefined();
      expect(client.config.baseUrl).toBe('https://api.example.com');
    });
  });

  describe('createBuilder', () => {
    test('should create builder factory', () => {
      const builder = createBuilder();
      
      expect(builder.endpoint).toBeDefined();
      expect(builder.schema).toBeDefined();
      expect(builder.generator).toBeDefined();
      expect(builder.explorer).toBeDefined();
      expect(builder.documentation).toBeDefined();
    });

    test('should create endpoint with builder', () => {
      const endpoint = createBuilder().endpoint('GET', '/users').withSummary('List users').build();
      
      expect(endpoint.method).toBe('GET');
      expect(endpoint.path).toBe('/users');
      expect(endpoint.summary).toBe('List users');
    });
  });

  describe('createEndpoint helper', () => {
    test('should create endpoint with all HTTP methods', () => {
      const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      
      methods.forEach(method => {
        const endpoint = createEndpoint(method, '/test');
        expect(endpoint.method).toBe(method);
      });
    });

    test('should create endpoint with parameters', () => {
      const param = createParameter('id', 'path', { required: true });
      const endpoint = createEndpoint('GET', '/users/{id}', {
        parameters: [param],
      });

      expect(endpoint.parameters).toHaveLength(1);
      expect(endpoint.parameters?.[0].name).toBe('id');
    });

    test('should create endpoint with request body', () => {
      const requestBody = createRequestBody(
        { type: 'object' },
        { description: 'User data' }
      );

      const endpoint = createEndpoint('POST', '/users', {
        requestBody,
      });

      expect(endpoint.requestBody).toBeDefined();
      expect(endpoint.requestBody?.description).toBe('User data');
    });
  });

  describe('createSchema helper', () => {
    test('should create schema with type', () => {
      const schema = createSchema('string');
      expect(schema.type).toBe('string');
    });

    test('should create schema with all options', () => {
      const schema = createSchema('string', {
        format: 'email',
        description: 'User email',
        example: 'test@example.com',
        enum: ['a@b.com', 'c@d.com'],
      });

      expect(schema.format).toBe('email');
      expect(schema.description).toBe('User email');
      expect(schema.example).toBe('test@example.com');
      expect(schema.enum).toEqual(['a@b.com', 'c@d.com']);
    });
  });

  describe('createParameter helper', () => {
    test('should create parameter for each location type', () => {
      const locations: ParameterType[] = ['path', 'query', 'header', 'cookie'];
      
      locations.forEach(location => {
        const param = createParameter('test', location);
        expect(param.in).toBe(location);
      });
    });

    test('should create required path parameter', () => {
      const param = createParameter('id', 'path', { required: true });
      expect(param.required).toBe(true);
    });
  });

  describe('createResponse helper', () => {
    test('should create response with description', () => {
      const response = createResponse('Success');
      expect(response.description).toBe('Success');
    });

    test('should create response with schema', () => {
      const response = createResponse('Success', {
        schema: { type: 'object' },
        contentType: 'application/json',
      });

      expect(response.schema).toBeDefined();
      expect(response.contentType).toBe('application/json');
    });
  });

  describe('createRequestBody helper', () => {
    test('should create request body with schema', () => {
      const requestBody = createRequestBody({ type: 'object' });
      expect(requestBody.required).toBe(true);
      expect(requestBody.contentType).toBe('application/json');
    });

    test('should create optional request body', () => {
      const requestBody = createRequestBody({ type: 'object' }, { required: false });
      expect(requestBody.required).toBe(false);
    });
  });

  describe('createSecurityScheme helper', () => {
    test('should create bearer security scheme', () => {
      const scheme = createSecurityScheme('Bearer', 'http', {
        scheme: 'bearer',
        bearerFormat: 'JWT',
      });

      expect(scheme.type).toBe('http');
      expect(scheme.scheme).toBe('bearer');
      expect(scheme.bearerFormat).toBe('JWT');
    });

    test('should create API key security scheme', () => {
      const scheme = createSecurityScheme('ApiKey', 'apiKey', {
        in: 'header',
      });

      expect(scheme.type).toBe('apiKey');
      expect(scheme.in).toBe('header');
    });
  });

  describe('createOAuth2Flows helper', () => {
    test('should create implicit flow', () => {
      const flows = createOAuth2Flows({
        implicit: {
          authorizationUrl: 'https://auth.example.com',
          scopes: { read: 'Read access' },
        },
      });

      expect(flows.implicit).toBeDefined();
      expect(flows.implicit?.authorizationUrl).toBe('https://auth.example.com');
    });

    test('should create authorization code flow', () => {
      const flows = createOAuth2Flows({
        authorizationCode: {
          authorizationUrl: 'https://auth.example.com',
          tokenUrl: 'https://auth.example.com/token',
          scopes: { read: 'Read access' },
        },
      });

      expect(flows.authorizationCode).toBeDefined();
      expect(flows.authorizationCode?.tokenUrl).toBe('https://auth.example.com/token');
    });
  });

  describe('Pre-built schemas', () => {
    test('should create user schema', () => {
      const schema = createUserSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.properties?.['email']).toBeDefined();
    });

    test('should create paginated response schema', () => {
      const itemSchema: SchemaDefinition = { type: 'string' };
      const schema = createPaginatedResponseSchema(itemSchema);
      
      expect(schema.type).toBe('object');
      expect(schema.properties?.['items']).toBeDefined();
      expect(schema.properties?.['total']).toBeDefined();
    });

    test('should create error schema', () => {
      const schema = createErrorSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties?.['error']).toBeDefined();
      expect(schema.properties?.['message']).toBeDefined();
    });
  });

  describe('Pre-built security schemes', () => {
    test('should create bearer auth scheme', () => {
      const scheme = createBearerAuthScheme();
      expect(scheme.type).toBe('http');
      expect(scheme.scheme).toBe('bearer');
    });

    test('should create API key scheme', () => {
      const scheme = createApiKeyScheme('MyApiKey', 'header');
      expect(scheme.type).toBe('apiKey');
      expect(scheme.in).toBe('header');
    });

    test('should create OAuth2 scheme', () => {
      const flows = createOAuth2Flows({
        authorizationCode: {
          authorizationUrl: 'https://auth.example.com',
          tokenUrl: 'https://auth.example.com/token',
          scopes: { read: 'Read' },
        },
      });
      
      const scheme = createOAuth2Scheme('OAuth2', flows);
      expect(scheme.type).toBe('oauth2');
      expect(scheme.flows?.authorizationCode).toBeDefined();
    });
  });

  describe('APIDocumentationManager', () => {
    let manager: APIDocumentationManager;

    beforeEach(() => {
      manager = createAPIDocumentationManager();
    });

    test('should create documentation', () => {
      const doc = manager.createDocumentation('test', {
        title: 'Test API',
        version: '1.0.0',
        openapiVersion: '3.1',
      });

      expect(doc).toBeDefined();
    });

    test('should get created documentation', () => {
      manager.createDocumentation('test', {
        title: 'Test API',
        version: '1.0.0',
        openapiVersion: '3.1',
      });

      const doc = manager.getDocumentation('test');
      expect(doc).toBeDefined();
    });

    test('should list documentations', () => {
      manager.createDocumentation('test1', { title: 'Test 1', version: '1.0.0', openapiVersion: '3.1' });
      manager.createDocumentation('test2', { title: 'Test 2', version: '1.0.0', openapiVersion: '3.1' });

      const names = manager.listDocumentations();
      expect(names).toContain('test1');
      expect(names).toContain('test2');
    });

    test('should remove documentation', () => {
      manager.createDocumentation('test', { title: 'Test', version: '1.0.0', openapiVersion: '3.1' });
      expect(manager.removeDocumentation('test')).toBe(true);
      expect(manager.getDocumentation('test')).toBeNull();
    });
  });

  describe('APIDocGenerator class', () => {
    test('should extend DocumentationGeneratorImpl', () => {
      const docGen = new APIDocGenerator({
        title: 'Test API',
        version: '1.0.0',
        openapiVersion: '3.1',
      });

      expect(docGen).toBeDefined();
      expect(docGen.config.title).toBe('Test API');
    });
  });

  describe('OpenAPI document generation', () => {
    test('should generate complete OpenAPI document', () => {
      generator.addSchema('User', createUserSchema());
      generator.addSecurityScheme(createBearerAuthScheme());
      generator.addEndpoint(
        createEndpoint('GET', '/users', {
          summary: 'List users',
          tags: ['users'],
          security: [{ name: 'BearerAuth' }],
          responses: {
            '200': {
              description: 'List of users',
              schema: { type: 'array', items: { $ref: '#/components/schemas/User' } },
            },
          },
        })
      );

      const doc = generator.generateDocument();

      expect(doc.paths['/users']).toBeDefined();
      expect(doc.components?.schemas?.['User']).toBeDefined();
      expect(doc.components?.securitySchemes?.['BearerAuth']).toBeDefined();
    });

    test('should handle multiple API versions', () => {
      generator.addVersion({ version: '1.0.0', status: 'current' });
      generator.addVersion({ version: '0.9.0', status: 'deprecated', deprecationMessage: 'Use 1.0.0' });

      const versions = generator.getVersions();
      expect(versions).toHaveLength(2);
    });
  });
});

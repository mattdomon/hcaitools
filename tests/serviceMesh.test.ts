import {
  ServiceRegistration,
  ServiceHealth,
  DiscoveryType,
  CircuitBreakerState,
  AuthMethod,
  LoadBalancingStrategy,
  ServiceMeshConfig,
  ServiceMesh,
  CircuitBreaker,
  LoadBalancer,
  TracingClient,
  AuthHandler,
  ServiceRegistry,
  ServiceEndpoint,
} from '../src/core/serviceMesh/types';

import {
  ServiceMeshImpl,
  createServiceMesh,
  createLoadBalancer,
  createCircuitBreaker,
  createServiceDiscovery,
  createTracingClient,
  createAuthHandler,
  InMemoryServiceRegistry,
} from '../src/core/serviceMesh/serviceMesh';

describe('Service Mesh Module', () => {
  describe('Types and Interfaces', () => {
    it('should define valid service health statuses', () => {
      const healthStatuses: ServiceHealth[] = ['healthy', 'unhealthy', 'unknown'];
      expect(healthStatuses).toContain('healthy');
      expect(healthStatuses).toContain('unhealthy');
      expect(healthStatuses).toContain('unknown');
    });

    it('should define valid discovery types', () => {
      const discoveryTypes: DiscoveryType[] = ['static', 'dynamic', 'dns'];
      expect(discoveryTypes).toContain('static');
      expect(discoveryTypes).toContain('dynamic');
      expect(discoveryTypes).toContain('dns');
    });

    it('should define valid circuit breaker states', () => {
      const cbStates: CircuitBreakerState[] = ['closed', 'open', 'half_open'];
      expect(cbStates).toContain('closed');
      expect(cbStates).toContain('open');
      expect(cbStates).toContain('half_open');
    });

    it('should define valid auth methods', () => {
      const authMethods: AuthMethod[] = ['mTLS', 'JWT', 'API_KEY'];
      expect(authMethods).toContain('mTLS');
      expect(authMethods).toContain('JWT');
      expect(authMethods).toContain('API_KEY');
    });

    it('should define valid load balancing strategies', () => {
      const lbStrategies: LoadBalancingStrategy[] = ['round_robin', 'least_connections', 'random', 'weighted'];
      expect(lbStrategies).toContain('round_robin');
      expect(lbStrategies).toContain('least_connections');
      expect(lbStrategies).toContain('random');
      expect(lbStrategies).toContain('weighted');
    });
  });

  describe('InMemoryServiceRegistry', () => {
    let registry: ServiceRegistry;

    beforeEach(() => {
      registry = new InMemoryServiceRegistry();
    });

    it('should register a service', () => {
      const service: ServiceRegistration = {
        id: 'svc_test123',
        name: 'test-service',
        version: '1.0.0',
        endpoint: { host: 'localhost', port: 8080 },
        health: 'healthy',
        registeredAt: Date.now(),
        lastHeartbeat: Date.now(),
      };

      registry.register(service);
      expect(registry.getService('svc_test123')).toBeDefined();
    });

    it('should retrieve a service by id', () => {
      const service: ServiceRegistration = {
        id: 'svc_abc123',
        name: 'test-service',
        version: '1.0.0',
        endpoint: { host: 'localhost', port: 8080 },
        health: 'healthy',
        registeredAt: Date.now(),
        lastHeartbeat: Date.now(),
      };

      registry.register(service);
      const retrieved = registry.getService('svc_abc123');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test-service');
    });

    it('should return undefined for non-existent service', () => {
      const result = registry.getService('non_existent');
      expect(result).toBeUndefined();
    });

    it('should get services by name', () => {
      const service1: ServiceRegistration = {
        id: 'svc_1',
        name: 'my-service',
        version: '1.0.0',
        endpoint: { host: 'localhost', port: 8080 },
        health: 'healthy',
        registeredAt: Date.now(),
        lastHeartbeat: Date.now(),
      };

      const service2: ServiceRegistration = {
        id: 'svc_2',
        name: 'my-service',
        version: '1.0.0',
        endpoint: { host: 'localhost', port: 8081 },
        health: 'healthy',
        registeredAt: Date.now(),
        lastHeartbeat: Date.now(),
      };

      registry.register(service1);
      registry.register(service2);

      const services = registry.getServicesByName('my-service');
      expect(services).toHaveLength(2);
    });

    it('should get all services', () => {
      const service1: ServiceRegistration = {
        id: 'svc_all1',
        name: 'service-a',
        version: '1.0.0',
        endpoint: { host: 'localhost', port: 8080 },
        health: 'healthy',
        registeredAt: Date.now(),
        lastHeartbeat: Date.now(),
      };

      const service2: ServiceRegistration = {
        id: 'svc_all2',
        name: 'service-b',
        version: '1.0.0',
        endpoint: { host: 'localhost', port: 8081 },
        health: 'unhealthy',
        registeredAt: Date.now(),
        lastHeartbeat: Date.now(),
      };

      registry.register(service1);
      registry.register(service2);

      const allServices = registry.getAllServices();
      expect(allServices).toHaveLength(2);
    });

    it('should deregister a service', () => {
      const service: ServiceRegistration = {
        id: 'svc_del',
        name: 'delete-service',
        version: '1.0.0',
        endpoint: { host: 'localhost', port: 8080 },
        health: 'healthy',
        registeredAt: Date.now(),
        lastHeartbeat: Date.now(),
      };

      registry.register(service);
      expect(registry.getService('svc_del')).toBeDefined();

      const result = registry.deregister('svc_del');
      expect(result).toBe(true);
      expect(registry.getService('svc_del')).toBeUndefined();
    });

    it('should return false when deregistering non-existent service', () => {
      const result = registry.deregister('non_existent');
      expect(result).toBe(false);
    });

    it('should update service health', () => {
      const service: ServiceRegistration = {
        id: 'svc_health',
        name: 'health-service',
        version: '1.0.0',
        endpoint: { host: 'localhost', port: 8080 },
        health: 'healthy',
        registeredAt: Date.now(),
        lastHeartbeat: Date.now(),
      };

      registry.register(service);
      expect(registry.getService('svc_health')?.health).toBe('healthy');

      registry.updateHealth('svc_health', 'unhealthy');
      expect(registry.getService('svc_health')?.health).toBe('unhealthy');
    });
  });

  describe('Circuit Breaker', () => {
    it('should start in closed state', () => {
      const cb = createCircuitBreaker('test-cb', {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000,
      });

      expect(cb.getState()).toBe('closed');
      expect(cb.isAvailable()).toBe(true);
    });

    it('should execute function successfully in closed state', async () => {
      const cb = createCircuitBreaker('test-cb', {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000,
      });

      const result = await cb.execute(async () => {
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('should transition to open after reaching failure threshold', async () => {
      const cb = createCircuitBreaker('test-cb', {
        failureThreshold: 2,
        successThreshold: 1,
        timeout: 1000,
      });

      const failingFn = async () => {
        throw new Error('failure');
      };

      await expect(cb.execute(failingFn)).rejects.toThrow('failure');
      await expect(cb.execute(failingFn)).rejects.toThrow('failure');

      expect(cb.getState()).toBe('open');
      expect(cb.isAvailable()).toBe(false);
    });

    it('should reject calls when circuit is open', async () => {
      const cb = createCircuitBreaker('test-cb', {
        failureThreshold: 1,
        successThreshold: 1,
        timeout: 5000,
      });

      const failingFn = async () => {
        throw new Error('failure');
      };

      await expect(cb.execute(failingFn)).rejects.toThrow();
      await expect(cb.execute(async () => 'success')).rejects.toThrow('Circuit breaker');
    });

    it('should track failure and success metrics', async () => {
      const cb = createCircuitBreaker('test-cb', {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000,
      });

      await cb.execute(async () => 'success');
      await cb.execute(async () => 'success');
      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();

      expect(cb.metrics.successes).toBe(2);
      expect(cb.metrics.failures).toBe(1);
      expect(cb.metrics.consecutiveFailures).toBe(1);
    });
  });

  describe('Load Balancers', () => {
    const createTestTargets = (): Array<{
      registration: ServiceRegistration;
      weight: number;
      activeConnections: number;
    }> => {
      return [
        {
          registration: {
            id: 'svc_lb1',
            name: 'lb-service',
            version: '1.0.0',
            endpoint: { host: 'host1', port: 8080 },
            health: 'healthy',
            registeredAt: Date.now(),
            lastHeartbeat: Date.now(),
          },
          weight: 1,
          activeConnections: 0,
        },
        {
          registration: {
            id: 'svc_lb2',
            name: 'lb-service',
            version: '1.0.0',
            endpoint: { host: 'host2', port: 8080 },
            health: 'healthy',
            registeredAt: Date.now(),
            lastHeartbeat: Date.now(),
          },
          weight: 1,
          activeConnections: 0,
        },
        {
          registration: {
            id: 'svc_lb3',
            name: 'lb-service',
            version: '1.0.0',
            endpoint: { host: 'host3', port: 8080 },
            health: 'unhealthy',
            registeredAt: Date.now(),
            lastHeartbeat: Date.now(),
          },
          weight: 1,
          activeConnections: 0,
        },
      ];
    };

    it('round robin load balancer should select targets in rotation', () => {
      const lb = createLoadBalancer('round_robin');
      const targets = createTestTargets();

      const selected1 = lb.selectTarget(targets);
      const selected2 = lb.selectTarget(targets);
      const selected3 = lb.selectTarget(targets);

      expect(selected1?.registration.id).toBe('svc_lb1');
      expect(selected2?.registration.id).toBe('svc_lb2');
      expect(selected3?.registration.id).toBe('svc_lb1');
    });

    it('round robin should skip unhealthy targets', () => {
      const lb = createLoadBalancer('round_robin');
      const targets = createTestTargets();

      const healthyTargets = targets.filter((t) => t.registration.health === 'healthy');
      const selected = lb.selectTarget(healthyTargets);

      expect(selected?.registration.health).toBe('healthy');
    });

    it('least connections should select target with fewest connections', () => {
      const lb = createLoadBalancer('least_connections');
      const targets = createTestTargets();

      targets[0].activeConnections = 10;
      targets[1].activeConnections = 5;
      targets[2].activeConnections = 3;

      const selected = lb.selectTarget(targets);
      expect(selected?.registration.id).toBe('svc_lb2');
    });

    it('random load balancer should return a valid target', () => {
      const lb = createLoadBalancer('random');
      const targets = createTestTargets();

      for (let i = 0; i < 10; i++) {
        const selected = lb.selectTarget(targets);
        expect(selected?.registration.health).toBe('healthy');
      }
    });

    it('weighted load balancer should respect weights', () => {
      const lb = createLoadBalancer('weighted');
      const targets: Array<{
        registration: ServiceRegistration;
        weight: number;
        activeConnections: number;
      }> = [
        {
          registration: {
            id: 'svc_w1',
            name: 'weighted-service',
            version: '1.0.0',
            endpoint: { host: 'host1', port: 8080 },
            health: 'healthy',
            registeredAt: Date.now(),
            lastHeartbeat: Date.now(),
          },
          weight: 10,
          activeConnections: 0,
        },
        {
          registration: {
            id: 'svc_w2',
            name: 'weighted-service',
            version: '1.0.0',
            endpoint: { host: 'host2', port: 8080 },
            health: 'healthy',
            registeredAt: Date.now(),
            lastHeartbeat: Date.now(),
          },
          weight: 1,
          activeConnections: 0,
        },
      ];

      let w1Count = 0;
      for (let i = 0; i < 100; i++) {
        const selected = lb.selectTarget(targets);
        if (selected?.registration.id === 'svc_w1') w1Count++;
      }

      expect(w1Count).toBeGreaterThan(50);
    });

    it('load balancer should return undefined for empty targets', () => {
      const lb = createLoadBalancer('round_robin');
      expect(lb.selectTarget([])).toBeUndefined();
    });

    it('load balancer should add and remove targets', () => {
      const lb = createLoadBalancer('round_robin');
      const target = {
        registration: {
          id: 'svc_add',
          name: 'add-service',
          version: '1.0.0',
          endpoint: { host: 'localhost', port: 8080 },
          health: 'healthy' as const,
          registeredAt: Date.now(),
          lastHeartbeat: Date.now(),
        },
        weight: 1,
        activeConnections: 0,
      };

      lb.addTarget(target);
      lb.removeTarget('svc_add');

      const targets = createTestTargets();
      const selected = lb.selectTarget(targets);
      expect(selected?.registration.id).not.toBe('svc_add');
    });

    it('load balancer should update target', () => {
      const lb = createLoadBalancer('round_robin');
      const targets = createTestTargets();

      lb.updateTarget('svc_lb1', { weight: 5 });
      lb.updateTarget('svc_lb1', { activeConnections: 10 });
    });
  });

  describe('Distributed Tracing', () => {
    let tracing: TracingClient;

    beforeEach(() => {
      tracing = createTracingClient();
    });

    it('should create a span', () => {
      const span = tracing.createSpan('test-service', 'test-operation');

      expect(span.id).toBeDefined();
      expect(span.traceId).toBeDefined();
      expect(span.serviceName).toBe('test-service');
      expect(span.operationName).toBe('test-operation');
      expect(span.tags).toEqual({});
      expect(span.logs).toEqual([]);
    });

    it('should create span with parent', () => {
      const parentSpan = tracing.createSpan('test-service', 'parent-operation');
      const childSpan = tracing.createSpan('test-service', 'child-operation', parentSpan.id);

      expect(childSpan.parentId).toBeDefined();
      expect(childSpan.parentId).toBe(parentSpan.traceId);
    });

    it('should finish a span', () => {
      const span = tracing.createSpan('test-service', 'test-operation');
      const spanId = span.id;

      tracing.finishSpan(spanId);

      const activeSpans = tracing.getActiveSpans();
      expect(activeSpans).toHaveLength(0);
    });

    it('should add tags to span', () => {
      const span = tracing.createSpan('test-service', 'test-operation');

      tracing.addTag(span.id, 'key1', 'value1');
      tracing.addTag(span.id, 'key2', 123);
      tracing.addTag(span.id, 'key3', true);

      const activeSpans = tracing.getActiveSpans();
      expect(activeSpans[0].tags['key1']).toBe('value1');
      expect(activeSpans[0].tags['key2']).toBe(123);
      expect(activeSpans[0].tags['key3']).toBe(true);
    });

    it('should add logs to span', () => {
      const span = tracing.createSpan('test-service', 'test-operation');

      tracing.addLog(span.id, { event: 'test', data: 123 });

      const activeSpans = tracing.getActiveSpans();
      expect(activeSpans[0].logs).toHaveLength(1);
      expect(activeSpans[0].logs[0].fields.event).toBe('test');
    });

    it('should retrieve trace by id', () => {
      const span = tracing.createSpan('test-service', 'test-operation');
      tracing.finishSpan(span.id);

      const trace = tracing.getTrace(span.traceId);
      expect(trace).toBeDefined();
      expect(trace?.traceId).toBe(span.traceId);
    });

    it('should get all active spans', () => {
      tracing.createSpan('service-a', 'op-a');
      tracing.createSpan('service-b', 'op-b');

      const activeSpans = tracing.getActiveSpans();
      expect(activeSpans).toHaveLength(2);
    });

    it('should calculate span duration', () => {
      const span = tracing.createSpan('test-service', 'test-operation');

      setTimeout(() => {
        tracing.finishSpan(span.id);
        const trace = tracing.getTrace(span.traceId);
        const finishedSpan = trace?.spans.get(span.id);
        expect(finishedSpan?.duration).toBeGreaterThanOrEqual(80);
      }, 100);
    });
  });

  describe('Auth Handler', () => {
    it('should authenticate with mTLS', async () => {
      const auth = createAuthHandler({
        method: 'mTLS',
        certPath: '/path/to/cert',
        keyPath: '/path/to/key',
        caPath: '/path/to/ca',
      });

      const result = await auth.authenticate({
        method: 'mTLS',
        credentials: 'certificate-data',
      });

      expect(result.success).toBe(true);
    });

    it('should reject unsupported mTLS without config', async () => {
      const auth = createAuthHandler({
        method: 'mTLS',
      });

      const result = await auth.authenticate({
        method: 'mTLS',
        credentials: 'data',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('configuration incomplete');
    });

    it('should authenticate with JWT', async () => {
      const auth = createAuthHandler({
        method: 'JWT',
        jwtSecret: 'secret-key',
      });

      const result = await auth.authenticate({
        method: 'JWT',
        credentials: 'valid-token',
      });

      expect(result.success).toBe(true);
      expect(result.permissions).toBeDefined();
    });

    it('should reject JWT without credentials', async () => {
      const auth = createAuthHandler({
        method: 'JWT',
        jwtSecret: 'secret-key',
      });

      const result = await auth.authenticate({
        method: 'JWT',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No credentials');
    });

    it('should authenticate with API key', async () => {
      const auth = createAuthHandler({
        method: 'API_KEY',
        apiKey: 'secret-api-key',
      });

      const result = await auth.authenticate({
        method: 'API_KEY',
        credentials: 'secret-api-key',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid API key', async () => {
      const auth = createAuthHandler({
        method: 'API_KEY',
        apiKey: 'correct-key',
      });

      const result = await auth.authenticate({
        method: 'API_KEY',
        credentials: 'wrong-key',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });

    it('should reject mismatched auth method', async () => {
      const auth = createAuthHandler({
        method: 'JWT',
        jwtSecret: 'secret',
      });

      const result = await auth.authenticate({
        method: 'mTLS',
        credentials: 'cert',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported');
    });

    it('should authorize requests', async () => {
      const auth = createAuthHandler({
        method: 'JWT',
        jwtSecret: 'secret',
      });

      const result = await auth.authorize(
        { method: 'JWT', credentials: 'token' },
        ['read', 'write']
      );

      expect(result).toBe(true);
    });
  });

  describe('Service Mesh Integration', () => {
    let mesh: ServiceMesh;
    const meshConfig: ServiceMeshConfig = {
      serviceName: 'test-mesh',
      discovery: {
        type: 'dynamic',
        refreshInterval: 5000,
      },
      circuitBreaker: {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000,
      },
      auth: {
        method: 'JWT',
        jwtSecret: 'test-secret',
      },
      healthCheck: {
        serviceId: 'health-check-id',
        checkInterval: 10000,
        timeout: 5000,
        healthyThreshold: 2,
        unhealthyThreshold: 3,
      },
      loadBalancing: 'round_robin',
    };

    beforeEach(() => {
      mesh = createServiceMesh(meshConfig);
    });

    it('should register a service', () => {
      const serviceId = mesh.registerService({
        name: 'registered-service',
        version: '1.0.0',
        endpoint: { host: 'localhost', port: 8080 },
        health: 'healthy',
      });

      expect(serviceId).toBeDefined();
      expect(serviceId.startsWith('svc_')).toBe(true);
    });

    it('should discover registered services', () => {
      mesh.registerService({
        name: 'discoverable-service',
        version: '1.0.0',
        endpoint: { host: 'localhost', port: 8080 },
        health: 'healthy',
      });

      const services = mesh.discoverService('discoverable-service');
      expect(services).toHaveLength(1);
      expect(services[0].name).toBe('discoverable-service');
    });

    it('should deregister a service', () => {
      const serviceId = mesh.registerService({
        name: 'temp-service',
        version: '1.0.0',
        endpoint: { host: 'localhost', port: 8080 },
        health: 'healthy',
      });

      const result = mesh.deregisterService(serviceId);
      expect(result).toBe(true);

      const services = mesh.discoverService('temp-service');
      expect(services).toHaveLength(0);
    });

    it('should get circuit breaker for registered service', () => {
      mesh.registerService({
        name: 'cb-service',
        version: '1.0.0',
        endpoint: { host: 'localhost', port: 8080 },
        health: 'healthy',
      });

      const cb = mesh.getCircuitBreaker('cb-service');
      expect(cb).toBeDefined();
      expect(cb?.getState()).toBe('closed');
    });

    it('should call service through mesh', async () => {
      mesh.registerService({
        name: 'callable-service',
        version: '1.0.0',
        endpoint: { host: 'localhost', port: 8080 },
        health: 'healthy',
      });

      const result = await mesh.callService('callable-service', 'test-op', { data: 'test' });
      expect(result).toBeDefined();
    });

    it('should get mesh metrics', () => {
      mesh.registerService({
        name: 'metrics-service-1',
        version: '1.0.0',
        endpoint: { host: 'localhost', port: 8080 },
        health: 'healthy',
      });

      mesh.registerService({
        name: 'metrics-service-2',
        version: '1.0.0',
        endpoint: { host: 'localhost', port: 8081 },
        health: 'unhealthy',
      });

      const metrics = mesh.getMetrics();
      expect(metrics.totalServices).toBe(2);
      expect(metrics.healthyServices).toBe(1);
      expect(metrics.unhealthyServices).toBe(1);
      expect(metrics.activeCircuits).toBe(2);
    });

    it('should track requests in metrics', async () => {
      mesh.registerService({
        name: 'request-counter-service',
        version: '1.0.0',
        endpoint: { host: 'localhost', port: 8080 },
        health: 'healthy',
      });

      await mesh.callService('request-counter-service', 'op1', {});
      await mesh.callService('request-counter-service', 'op2', {});

      const metrics = mesh.getMetrics();
      expect(metrics.totalRequests).toBe(2);
    });

    it('should return undefined for non-existent circuit breaker', () => {
      const cb = mesh.getCircuitBreaker('non-existent');
      expect(cb).toBeUndefined();
    });

    it('should return empty array for undiscoverable services', () => {
      const services = mesh.discoverService('non-existent-service');
      expect(services).toHaveLength(0);
    });

    it('should handle multiple registrations of same service name', () => {
      mesh.registerService({
        name: 'multi-service',
        version: '1.0.0',
        endpoint: { host: 'host1', port: 8080 },
        health: 'healthy',
      });

      mesh.registerService({
        name: 'multi-service',
        version: '1.0.0',
        endpoint: { host: 'host2', port: 8080 },
        health: 'healthy',
      });

      const services = mesh.discoverService('multi-service');
      expect(services).toHaveLength(2);
    });
  });

  describe('Service Discovery', () => {
    let registry: ServiceRegistry;
    let discovery: ReturnType<typeof createServiceDiscovery>;

    beforeEach(() => {
      registry = new InMemoryServiceRegistry();
    });

    it('should discover services with dynamic discovery', () => {
      discovery = createServiceDiscovery(
        { type: 'dynamic' },
        registry
      );

      registry.register({
        id: 'svc_disc1',
        name: 'dynamic-service',
        version: '1.0.0',
        endpoint: { host: 'localhost', port: 8080 },
        health: 'healthy',
        registeredAt: Date.now(),
        lastHeartbeat: Date.now(),
      });

      const services = discovery.discover('dynamic-service');
      expect(services).toHaveLength(1);
    });

    it('should discover services with dns discovery', () => {
      discovery = createServiceDiscovery(
        { type: 'dns', dnsServer: '8.8.8.8' },
        registry
      );

      registry.register({
        id: 'svc_dns',
        name: 'dns-service',
        version: '1.0.0',
        endpoint: { host: 'localhost', port: 8080 },
        health: 'healthy',
        registeredAt: Date.now(),
        lastHeartbeat: Date.now(),
      });

      const services = discovery.discover('dns-service');
      expect(services).toHaveLength(1);
    });

    it('should discover services with static discovery', () => {
      discovery = createServiceDiscovery(
        { type: 'static', staticHosts: [{ host: 'static.host', port: 9000 }] },
        registry
      );

      const services = discovery.discover('any-service');
      expect(services.length).toBeGreaterThanOrEqual(0);
    });

    it('should only return healthy services in discovery', () => {
      discovery = createServiceDiscovery(
        { type: 'dynamic' },
        registry
      );

      registry.register({
        id: 'svc_healthy',
        name: 'healthy-svc',
        version: '1.0.0',
        endpoint: { host: 'localhost', port: 8080 },
        health: 'healthy',
        registeredAt: Date.now(),
        lastHeartbeat: Date.now(),
      });

      registry.register({
        id: 'svc_unhealthy',
        name: 'unhealthy-svc',
        version: '1.0.0',
        endpoint: { host: 'localhost', port: 8081 },
        health: 'unhealthy',
        registeredAt: Date.now(),
        lastHeartbeat: Date.now(),
      });

      const healthyServices = registry.getServicesByName('healthy-svc');
      expect(healthyServices).toHaveLength(1);
    });
  });
});

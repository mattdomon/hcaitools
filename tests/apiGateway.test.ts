import {
  ApiGateway,
  BackendImpl,
  CircuitBreakerConfig,
  ExactRouteMatcher,
  GatewayRequest,
  GatewayResponse,
  HealthCheckConfig,
  InMemoryRateLimiter,
  InMemoryServiceDiscovery,
  IpHashLoadBalancer,
  LeastConnectionsLoadBalancer,
  LoadBalancerFactory,
  PrefixRouteMatcher,
  ProxyHandlerImpl,
  RateLimitRule,
  RegexRouteMatcher,
  RouteImpl,
  RoundRobinLoadBalancer,
  ServiceEndpoint,
  SimpleCircuitBreaker,
  SimpleEventEmitter,
  SimpleHealthChecker,
  SimpleRetryPolicy,
  TransformConfig,
  UpstreamImpl,
  WeightedLoadBalancer,
  DEFAULT_HEALTH_CHECK_CONFIG,
  Backend,
  BackendStatus,
  CircuitBreakerState,
  Route,
  GatewayContext,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from '../src/core/apiGateway';

describe('API Gateway Module', () => {
  describe('Load Balancers', () => {
    describe('RoundRobinLoadBalancer', () => {
      it('should select backends in round-robin order', () => {
        const balancer = new RoundRobinLoadBalancer();
        const backends: Backend[] = [
          { id: 'b1', host: 'host1', port: 80, weight: 1, status: 'healthy', activeConnections: 0, maxConnections: 100 },
          { id: 'b2', host: 'host2', port: 80, weight: 1, status: 'healthy', activeConnections: 0, maxConnections: 100 },
          { id: 'b3', host: 'host3', port: 80, weight: 1, status: 'healthy', activeConnections: 0, maxConnections: 100 },
        ];
        const context = createMockContext('/test');

        const selected1 = balancer.select(backends, context);
        const selected2 = balancer.select(backends, context);
        const selected3 = balancer.select(backends, context);

        expect(selected1?.id).toBe('b1');
        expect(selected2?.id).toBe('b2');
        expect(selected3?.id).toBe('b3');
      });

      it('should skip unhealthy backends', () => {
        const balancer = new RoundRobinLoadBalancer();
        const backends: Backend[] = [
          { id: 'b1', host: 'host1', port: 80, weight: 1, status: 'healthy', activeConnections: 0, maxConnections: 100 },
          { id: 'b2', host: 'host2', port: 80, weight: 1, status: 'unhealthy', activeConnections: 0, maxConnections: 100 },
          { id: 'b3', host: 'host3', port: 80, weight: 1, status: 'healthy', activeConnections: 0, maxConnections: 100 },
        ];
        const context = createMockContext('/test');

        const selected1 = balancer.select(backends, context);
        const selected2 = balancer.select(backends, context);

        expect(selected1?.id).toBe('b1');
        expect(selected2?.id).toBe('b3');
      });

      it('should return null for empty backends', () => {
        const balancer = new RoundRobinLoadBalancer();
        const context = createMockContext('/test');
        const selected = balancer.select([], context);
        expect(selected).toBeNull();
      });

      it('should reset and start from beginning', () => {
        const balancer = new RoundRobinLoadBalancer();
        const backends: Backend[] = [
          { id: 'b1', host: 'host1', port: 80, weight: 1, status: 'healthy', activeConnections: 0, maxConnections: 100 },
        ];
        const context = createMockContext('/test');

        balancer.select(backends, context);
        balancer.reset();
        const selected = balancer.select(backends, context);

        expect(selected?.id).toBe('b1');
      });
    });

    describe('LeastConnectionsLoadBalancer', () => {
      it('should select backend with least connections', () => {
        const balancer = new LeastConnectionsLoadBalancer();
        const backends: Backend[] = [
          { id: 'b1', host: 'host1', port: 80, weight: 1, status: 'healthy', activeConnections: 5, maxConnections: 100 },
          { id: 'b2', host: 'host2', port: 80, weight: 1, status: 'healthy', activeConnections: 2, maxConnections: 100 },
          { id: 'b3', host: 'host3', port: 80, weight: 1, status: 'healthy', activeConnections: 8, maxConnections: 100 },
        ];
        const context = createMockContext('/test');

        const selected = balancer.select(backends, context);
        expect(selected?.id).toBe('b2');
      });

      it('should skip unhealthy backends', () => {
        const balancer = new LeastConnectionsLoadBalancer();
        const backends: Backend[] = [
          { id: 'b1', host: 'host1', port: 80, weight: 1, status: 'unhealthy', activeConnections: 0, maxConnections: 100 },
          { id: 'b2', host: 'host2', port: 80, weight: 1, status: 'healthy', activeConnections: 10, maxConnections: 100 },
        ];
        const context = createMockContext('/test');

        const selected = balancer.select(backends, context);
        expect(selected?.id).toBe('b2');
      });
    });

    describe('IpHashLoadBalancer', () => {
      it('should select same backend for same IP', () => {
        const balancer = new IpHashLoadBalancer();
        const backends: Backend[] = [
          { id: 'b1', host: 'host1', port: 80, weight: 1, status: 'healthy', activeConnections: 0, maxConnections: 100 },
          { id: 'b2', host: 'host2', port: 80, weight: 1, status: 'healthy', activeConnections: 0, maxConnections: 100 },
        ];
        const context1 = createMockContext('/test', '192.168.1.1');
        const context2 = createMockContext('/test', '192.168.1.1');

        const selected1 = balancer.select(backends, context1);
        const selected2 = balancer.select(backends, context2);

        expect(selected1?.id).toBe(selected2?.id);
      });

      it('should select different backends for different IPs', () => {
        const balancer = new IpHashLoadBalancer();
        const backends: Backend[] = [
          { id: 'b1', host: 'host1', port: 80, weight: 1, status: 'healthy', activeConnections: 0, maxConnections: 100 },
          { id: 'b2', host: 'host2', port: 80, weight: 1, status: 'healthy', activeConnections: 0, maxConnections: 100 },
          { id: 'b3', host: 'host3', port: 80, weight: 1, status: 'healthy', activeConnections: 0, maxConnections: 100 },
          { id: 'b4', host: 'host4', port: 80, weight: 1, status: 'healthy', activeConnections: 0, maxConnections: 100 },
        ];
        const context1 = createMockContext('/test', '192.168.1.1');
        const context2 = createMockContext('/test', '192.168.1.2');

        const selected1 = balancer.select(backends, context1);
        const selected2 = balancer.select(backends, context2);

        expect(selected1?.id).not.toBe(selected2?.id);
      });
    });

    describe('WeightedLoadBalancer', () => {
      it('should select backends based on weight', () => {
        const balancer = new WeightedLoadBalancer();
        const backends: Backend[] = [
          { id: 'b1', host: 'host1', port: 80, weight: 3, status: 'healthy', activeConnections: 0, maxConnections: 100 },
          { id: 'b2', host: 'host2', port: 80, weight: 1, status: 'healthy', activeConnections: 0, maxConnections: 100 },
        ];
        const context = createMockContext('/test');

        let b1Count = 0;
        let b2Count = 0;

        for (let i = 0; i < 100; i++) {
          const selected = balancer.select(backends, context);
          if (selected?.id === 'b1') b1Count++;
          if (selected?.id === 'b2') b2Count++;
        }

        expect(b1Count).toBeGreaterThan(b2Count);
      });
    });

    describe('LoadBalancerFactory', () => {
      it('should create round_robin balancer', () => {
        const balancer = LoadBalancerFactory.create('round_robin');
        expect(balancer).toBeInstanceOf(RoundRobinLoadBalancer);
      });

      it('should create least_connections balancer', () => {
        const balancer = LoadBalancerFactory.create('least_connections');
        expect(balancer).toBeInstanceOf(LeastConnectionsLoadBalancer);
      });

      it('should create ip_hash balancer', () => {
        const balancer = LoadBalancerFactory.create('ip_hash');
        expect(balancer).toBeInstanceOf(IpHashLoadBalancer);
      });

      it('should create weighted balancer', () => {
        const balancer = LoadBalancerFactory.create('weighted');
        expect(balancer).toBeInstanceOf(WeightedLoadBalancer);
      });

      it('should default to round_robin for unknown algorithm', () => {
        const balancer = LoadBalancerFactory.create('unknown' as any);
        expect(balancer).toBeInstanceOf(RoundRobinLoadBalancer);
      });
    });
  });

  describe('Route Matchers', () => {
    describe('PrefixRouteMatcher', () => {
      it('should match prefix routes', () => {
        const matcher = new PrefixRouteMatcher();
        const route = createRoute('prefix', '/api/users');
        const request = createRequest('GET', '/api/users/123');

        expect(matcher.match(route, request)).toBe(true);
      });

      it('should not match non-prefix routes', () => {
        const matcher = new PrefixRouteMatcher();
        const route = createRoute('prefix', '/api/users');
        const request = createRequest('GET', '/other/path');

        expect(matcher.match(route, request)).toBe(false);
      });
    });

    describe('ExactRouteMatcher', () => {
      it('should match exact routes', () => {
        const matcher = new ExactRouteMatcher();
        const route = createRoute('exact', '/api/users');
        const request = createRequest('GET', '/api/users');

        expect(matcher.match(route, request)).toBe(true);
      });

      it('should not match non-exact routes', () => {
        const matcher = new ExactRouteMatcher();
        const route = createRoute('exact', '/api/users');
        const request = createRequest('GET', '/api/users/123');

        expect(matcher.match(route, request)).toBe(false);
      });
    });

    describe('RegexRouteMatcher', () => {
      it('should match regex routes', () => {
        const matcher = new RegexRouteMatcher();
        const route = createRoute('regex', '/api/users/.*');
        const request = createRequest('GET', '/api/users/123');

        expect(matcher.match(route, request)).toBe(true);
      });

      it('should not match non-matching regex routes', () => {
        const matcher = new RegexRouteMatcher();
        const route = createRoute('regex', '/api/posts/.*');
        const request = createRequest('GET', '/api/users/123');

        expect(matcher.match(route, request)).toBe(false);
      });
    });
  });

  describe('BackendImpl', () => {
    it('should create backend with default values', () => {
      const backend = new BackendImpl('localhost', 8080);

      expect(backend.host).toBe('localhost');
      expect(backend.port).toBe(8080);
      expect(backend.weight).toBe(1);
      expect(backend.status).toBe('healthy');
      expect(backend.activeConnections).toBe(0);
      expect(backend.maxConnections).toBe(100);
    });

    it('should create backend with custom weight', () => {
      const backend = new BackendImpl('localhost', 8080, 5);
      expect(backend.weight).toBe(5);
    });

    it('should increment connections', () => {
      const backend = new BackendImpl('localhost', 8080);
      backend.incrementConnections?.();
      expect(backend.activeConnections).toBe(1);
    });

    it('should decrement connections', () => {
      const backend = new BackendImpl('localhost', 8080);
      backend.activeConnections = 5;
      backend.decrementConnections?.();
      expect(backend.activeConnections).toBe(4);
    });

    it('should not go below zero connections', () => {
      const backend = new BackendImpl('localhost', 8080);
      backend.decrementConnections?.();
      expect(backend.activeConnections).toBe(0);
    });
  });

  describe('RouteImpl', () => {
    it('should create route with required parameters', () => {
      const backend = new BackendImpl('localhost', 8080);
      const route = new RouteImpl('Test Route', 'prefix', '/api', [backend]);

      expect(route.name).toBe('Test Route');
      expect(route.type).toBe('prefix');
      expect(route.path).toBe('/api');
      expect(route.backends).toHaveLength(1);
      expect(route.enabled).toBe(true);
      expect(route.priority).toBe(0);
    });

    it('should create route with options', () => {
      const backend = new BackendImpl('localhost', 8080);
      const route = new RouteImpl('Test Route', 'exact', '/api', [backend], {
        priority: 10,
        enabled: false,
        timeout: 5000,
        methods: ['GET', 'POST'],
      });

      expect(route.priority).toBe(10);
      expect(route.enabled).toBe(false);
      expect(route.timeout).toBe(5000);
      expect(route.methods).toEqual(['GET', 'POST']);
    });
  });

  describe('UpstreamImpl', () => {
    it('should create upstream with default values', () => {
      const upstream = new UpstreamImpl('Test Upstream');

      expect(upstream.name).toBe('Test Upstream');
      expect(upstream.loadBalancing).toBe('round_robin');
      expect(upstream.routes).toHaveLength(0);
    });

    it('should add and remove routes', () => {
      const upstream = new UpstreamImpl('Test Upstream');
      const backend = new BackendImpl('localhost', 8080);
      const route = new RouteImpl('Test', 'prefix', '/api', [backend]);

      upstream.addRoute(route);
      expect(upstream.routes).toHaveLength(1);

      upstream.removeRoute(route.id);
      expect(upstream.routes).toHaveLength(0);
    });

    it('should get all backends', () => {
      const upstream = new UpstreamImpl('Test Upstream');
      const backend1 = new BackendImpl('host1', 8080);
      const backend2 = new BackendImpl('host2', 8080);
      const route1 = new RouteImpl('Test1', 'prefix', '/api1', [backend1]);
      const route2 = new RouteImpl('Test2', 'prefix', '/api2', [backend2]);

      upstream.addRoute(route1);
      upstream.addRoute(route2);

      const backends = upstream.getAllBackends();
      expect(backends).toHaveLength(2);
    });
  });

  describe('InMemoryRateLimiter', () => {
    it('should allow requests within limit', async () => {
      const limiter = new InMemoryRateLimiter();
      const rule: RateLimitRule = { maxRequests: 5, windowSizeMs: 60000 };

      const result1 = await limiter.check('test_key', rule);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(4);
    });

    it('should reject requests over limit', async () => {
      const limiter = new InMemoryRateLimiter();
      const rule: RateLimitRule = { maxRequests: 2, windowSizeMs: 60000 };

      await limiter.check('test_key', rule);
      await limiter.check('test_key', rule);
      const result = await limiter.check('test_key', rule);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset limit after window expires', async () => {
      const limiter = new InMemoryRateLimiter({ maxRequests: 1, windowSizeMs: 100 });

      const result1 = await limiter.check('test_key');
      expect(result1.allowed).toBe(true);

      const result2 = await limiter.check('test_key');
      expect(result2.allowed).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, 150));

      const result3 = await limiter.check('test_key');
      expect(result3.allowed).toBe(true);
    });

    it('should reset specific key', async () => {
      const limiter = new InMemoryRateLimiter({ maxRequests: 1, windowSizeMs: 60000 });

      await limiter.check('key1');
      await limiter.check('key1');
      await limiter.reset('key1');

      const result = await limiter.check('key1');
      expect(result.allowed).toBe(true);
    });
  });

  describe('SimpleCircuitBreaker', () => {
    it('should start in closed state', () => {
      const backend = new BackendImpl('localhost', 8080);
      const cb = new SimpleCircuitBreaker(backend, { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, enabled: true });

      expect(cb.getState().state).toBe('closed');
    });

    it('should open after reaching failure threshold', () => {
      const backend = new BackendImpl('localhost', 8080);
      const cb = new SimpleCircuitBreaker(backend, {
        ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
        enabled: true,
        failureThreshold: 3,
      });

      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState().state).toBe('closed');

      cb.recordFailure();
      expect(cb.getState().state).toBe('open');
    });

    it('should allow execution in closed state', () => {
      const backend = new BackendImpl('localhost', 8080);
      const cb = new SimpleCircuitBreaker(backend, DEFAULT_CIRCUIT_BREAKER_CONFIG);

      expect(cb.canExecute()).toBe(true);
    });

    it('should not allow execution when open', () => {
      const backend = new BackendImpl('localhost', 8080);
      const cb = new SimpleCircuitBreaker(backend, {
        ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
        failureThreshold: 1,
      });

      cb.recordFailure();
      expect(cb.canExecute()).toBe(false);
    });

    it('should transition to half-open after timeout', async () => {
      const backend = new BackendImpl('localhost', 8080);
      const cb = new SimpleCircuitBreaker(backend, {
        ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
        failureThreshold: 1,
        timeoutMs: 100,
      });

      cb.recordFailure();
      expect(cb.getState().state).toBe('open');

      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(cb.canExecute()).toBe(true);
      expect(cb.getState().state).toBe('half_open');
    });

    it('should close after success threshold in half-open', () => {
      const backend = new BackendImpl('localhost', 8080);
      const cb = new SimpleCircuitBreaker(backend, {
        ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
        failureThreshold: 1,
        successThreshold: 2,
        timeoutMs: 10,
      });

      cb.recordFailure();
      cb.getState().state; 

      (cb as any).state = { ...cb.getState(), state: 'half_open', successCount: 0 };

      cb.recordSuccess();
      expect(cb.getState().state).toBe('half_open');

      cb.recordSuccess();
      expect(cb.getState().state).toBe('closed');
    });
  });

  describe('SimpleRetryPolicy', () => {
    it('should allow retry within attempts', () => {
      const policy = new SimpleRetryPolicy(3, 100);
      const context = createMockContextWithAttempts('/test', 1);

      expect(policy.shouldRetry(context, new Error('test'))).toBe(true);
    });

    it('should not allow retry after max attempts', () => {
      const policy = new SimpleRetryPolicy(3, 100);
      const context = createMockContextWithAttempts('/test', 3);

      expect(policy.shouldRetry(context, new Error('test'))).toBe(false);
    });

    it('should calculate exponential backoff delay', () => {
      const policy = new SimpleRetryPolicy(3, 100);

      expect(policy.getDelay(createMockContextWithAttempts('/test', 0), 0)).toBe(100);
      expect(policy.getDelay(createMockContextWithAttempts('/test', 1), 1)).toBe(200);
      expect(policy.getDelay(createMockContextWithAttempts('/test', 2), 2)).toBe(400);
    });
  });

  describe('SimpleEventEmitter', () => {
    it('should emit and receive events', () => {
      const emitter = new SimpleEventEmitter();
      const receivedEvents: any[] = [];

      emitter.on('request_received', (event) => {
        receivedEvents.push(event);
      });

      emitter.emit({ type: 'request_received', timestamp: new Date() });

      expect(receivedEvents).toHaveLength(1);
    });

    it('should remove event handlers', () => {
      const emitter = new SimpleEventEmitter();
      const handler = jest.fn();
      emitter.on('request_received', handler);
      emitter.off('request_received', handler);

      emitter.emit({ type: 'request_received', timestamp: new Date() });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should store events', () => {
      const emitter = new SimpleEventEmitter();
      emitter.emit({ type: 'request_received', timestamp: new Date() });
      emitter.emit({ type: 'response_received', timestamp: new Date() });

      const events = emitter.getEvents();
      expect(events).toHaveLength(2);
    });

    it('should clear events', () => {
      const emitter = new SimpleEventEmitter();
      emitter.emit({ type: 'request_received', timestamp: new Date() });
      emitter.clearEvents();

      expect(emitter.getEvents()).toHaveLength(0);
    });
  });

  describe('InMemoryServiceDiscovery', () => {
    it('should register and retrieve services', async () => {
      const discovery = new InMemoryServiceDiscovery({ enabled: true, provider: 'static' });
      const endpoint: ServiceEndpoint = { id: 'ep1', name: 'test-service', host: 'localhost', port: 8080 };

      await discovery.register(endpoint);
      const services = await discovery.getServices('test-service');

      expect(services).toHaveLength(1);
      expect(services[0].host).toBe('localhost');
    });

    it('should deregister services', async () => {
      const discovery = new InMemoryServiceDiscovery({ enabled: true, provider: 'static' });
      const endpoint: ServiceEndpoint = { id: 'ep1', name: 'test-service', host: 'localhost', port: 8080 };

      await discovery.register(endpoint);
      await discovery.deregister('ep1');
      const services = await discovery.getServices('test-service');

      expect(services).toHaveLength(0);
    });

    it('should get all services', async () => {
      const discovery = new InMemoryServiceDiscovery({ enabled: true, provider: 'static' });

      await discovery.register({ id: 'ep1', name: 'service1', host: 'host1', port: 8080 });
      await discovery.register({ id: 'ep2', name: 'service2', host: 'host2', port: 8080 });

      const all = await discovery.getAllServices();
      expect(all).toHaveLength(2);
    });
  });

  describe('ApiGateway', () => {
    it('should create gateway with default config', () => {
      const gateway = new ApiGateway();
      expect(gateway).toBeDefined();
    });

    it('should register and retrieve upstream', () => {
      const gateway = new ApiGateway();
      const upstream = new UpstreamImpl('Test');

      gateway.registerUpstream(upstream);
      const retrieved = gateway.getUpstream(upstream.id);

      expect(retrieved?.name).toBe('Test');
    });

    it('should get all upstreams', () => {
      const gateway = new ApiGateway();
      const upstream1 = new UpstreamImpl('Test1');
      const upstream2 = new UpstreamImpl('Test2');

      gateway.registerUpstream(upstream1);
      gateway.registerUpstream(upstream2);

      const all = gateway.getAllUpstreams();
      expect(all).toHaveLength(2);
    });

    it('should unregister upstream', () => {
      const gateway = new ApiGateway();
      const upstream = new UpstreamImpl('Test');

      gateway.registerUpstream(upstream);
      gateway.unregisterUpstream(upstream.id);

      const all = gateway.getAllUpstreams();
      expect(all).toHaveLength(0);
    });

    it('should perform health check', async () => {
      const gateway = new ApiGateway();
      const upstream = new UpstreamImpl('Test');
      gateway.registerUpstream(upstream);

      const result = await gateway.healthCheck();
      expect(result.healthy).toBe(true);
      expect(result.details).toHaveProperty('upstreams');
    });
  });

  describe('ProxyHandlerImpl', () => {
    it('should create proxy handler', () => {
      const handler = new ProxyHandlerImpl();
      expect(handler).toBeDefined();
    });
  });
});

function createMockContext(path: string, ip?: string): GatewayContext {
  return {
    request: createRequest('GET', path, ip),
    attempts: 0,
    startTime: new Date(),
    metadata: {},
  };
}

function createMockContextWithAttempts(path: string, attempts: number): GatewayContext {
  return {
    request: createRequest('GET', path),
    attempts,
    startTime: new Date(),
    metadata: {},
  };
}

function createRequest(method: string, path: string, ip?: string): GatewayRequest {
  return {
    id: 'req_123',
    method: method as any,
    path,
    query: {},
    headers: {},
    ip,
    timestamp: new Date(),
  };
}

function createRoute(type: 'prefix' | 'exact' | 'regex', path: string): Route {
  const backend = new BackendImpl('localhost', 8080);
  return new RouteImpl('Test Route', type, path, [backend]);
}

import crypto from 'crypto';
import {
  Backend,
  BackendMetrics,
  BackendStatus,
  CircuitBreakerConfig,
  CircuitBreakerState,
  EventEmitter,
  GatewayConfig,
  GatewayContext,
  GatewayEvent,
  GatewayEventType,
  GatewayMetrics,
  GatewayRequest,
  GatewayResponse,
  HealthCheckConfig,
  HealthCheckResult,
  HealthChecker,
  HttpMethod,
  LoadBalancingAlgorithm,
  LoadBalancer,
  PluginConfig,
  ProxyHandler,
  RateLimitInfo,
  RateLimitRule,
  RetryPolicy,
  Route,
  RouteMatcher,
  RouteType,
  ServiceDiscovery,
  ServiceEndpoint,
  ServiceDiscoveryConfig,
  TransformConfig,
  TransformProcessor,
  Upstream,
  UpstreamMetrics,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  DEFAULT_GATEWAY_CONFIG,
} from './types';

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export class InMemoryServiceDiscovery implements ServiceDiscovery {
  private services: Map<string, ServiceEndpoint[]> = new Map();
  private config: ServiceDiscoveryConfig;
  private intervalId?: NodeJS.Timeout;

  constructor(config: ServiceDiscoveryConfig) {
    this.config = config;
  }

  async register(endpoint: ServiceEndpoint): Promise<void> {
    const existing = this.services.get(endpoint.name) || [];
    const index = existing.findIndex((e) => e.id === endpoint.id);
    if (index >= 0) {
      existing[index] = endpoint;
    } else {
      existing.push(endpoint);
    }
    this.services.set(endpoint.name, existing);
  }

  async deregister(id: string): Promise<void> {
    for (const [name, endpoints] of this.services.entries()) {
      const filtered = endpoints.filter((e) => e.id !== id);
      if (filtered.length !== endpoints.length) {
        this.services.set(name, filtered);
        break;
      }
    }
  }

  async getServices(name: string): Promise<ServiceEndpoint[]> {
    return this.services.get(name) || [];
  }

  async getAllServices(): Promise<ServiceEndpoint[]> {
    const all: ServiceEndpoint[] = [];
    for (const endpoints of this.services.values()) {
      all.push(...endpoints);
    }
    return all;
  }

  start(): void {
    if (this.config.refreshIntervalMs && this.intervalId === undefined) {
      this.intervalId = setInterval(() => {
        this.refresh();
      }, this.config.refreshIntervalMs);
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private refresh(): void {
    if (this.config.endpoints) {
      for (const endpoint of this.config.endpoints) {
        this.register(endpoint).catch(() => {});
      }
    }
  }
}

export class RoundRobinLoadBalancer implements LoadBalancer {
  private currentIndex: number = 0;

  select(upstreams: Backend[], _context: GatewayContext): Backend | null {
    if (upstreams.length === 0) return null;
    const healthy = upstreams.filter((u) => u.status === 'healthy');
    if (healthy.length === 0) return null;
    const selected = healthy[this.currentIndex % healthy.length];
    this.currentIndex++;
    return selected;
  }

  reset(): void {
    this.currentIndex = 0;
  }
}

export class LeastConnectionsLoadBalancer implements LoadBalancer {
  select(upstreams: Backend[], _context: GatewayContext): Backend | null {
    if (upstreams.length === 0) return null;
    const healthy = upstreams.filter((u) => u.status === 'healthy');
    if (healthy.length === 0) return null;
    return healthy.reduce((min, current) =>
      current.activeConnections < min.activeConnections ? current : min
    );
  }
}

export class IpHashLoadBalancer implements LoadBalancer {
  select(upstreams: Backend[], context: GatewayContext): Backend | null {
    if (upstreams.length === 0) return null;
    const healthy = upstreams.filter((u) => u.status === 'healthy');
    if (healthy.length === 0) return null;
    const ip = context.request.ip || '0.0.0.0';
    const hash = this.hashIp(ip);
    return healthy[hash % healthy.length];
  }

  private hashIp(ip: string): number {
    const hash = crypto.createHash('md5').update(ip).digest('hex');
    return parseInt(hash.substring(0, 8), 16);
  }
}

export class WeightedLoadBalancer implements LoadBalancer {
  private currentIndex: number = 0;
  private currentWeightIndex: number = 0;

  select(upstreams: Backend[], _context: GatewayContext): Backend | null {
    if (upstreams.length === 0) return null;
    const healthy = upstreams.filter((u) => u.status === 'healthy');
    if (healthy.length === 0) return null;

    let totalWeight = 0;
    for (const backend of healthy) {
      totalWeight += backend.weight;
    }

    let currentWeight = 0;
    const random = Math.random() * totalWeight;

    for (const backend of healthy) {
      currentWeight += backend.weight;
      if (random <= currentWeight) {
        return backend;
      }
    }

    return healthy[this.currentIndex % healthy.length];
  }

  reset(): void {
    this.currentIndex = 0;
    this.currentWeightIndex = 0;
  }
}

export class PrefixRouteMatcher implements RouteMatcher {
  match(route: Route, request: GatewayRequest): boolean {
    if (!route.path.endsWith('/')) {
      return request.path.startsWith(route.path);
    }
    return request.path.startsWith(route.path);
  }
}

export class ExactRouteMatcher implements RouteMatcher {
  match(route: Route, request: GatewayRequest): boolean {
    return request.path === route.path;
  }
}

export class RegexRouteMatcher implements RouteMatcher {
  match(route: Route, request: GatewayRequest): boolean {
    if (!route.regex) return false;
    return route.regex.test(request.path);
  }
}

export class RouteMatcherImpl implements RouteMatcher {
  private matchers: Map<RouteType, RouteMatcher> = new Map();

  constructor() {
    this.matchers.set('prefix', new PrefixRouteMatcher());
    this.matchers.set('exact', new ExactRouteMatcher());
    this.matchers.set('regex', new RegexRouteMatcher());
  }

  match(route: Route, request: GatewayRequest): boolean {
    const matcher = this.matchers.get(route.type);
    if (!matcher) return false;
    if (!route.enabled) return false;
    if (route.methods && route.methods.length > 0 && !route.methods.includes(request.method)) {
      return false;
    }
    return matcher.match(route, request);
  }
}

export class SimpleHealthChecker implements HealthChecker {
  private upstreams: Map<string, Upstream> = new Map();
  private intervalId?: NodeJS.Timeout;
  private intervalMs: number;
  private eventEmitter?: EventEmitter;

  constructor(intervalMs: number = 30000, eventEmitter?: EventEmitter) {
    this.intervalMs = intervalMs;
    this.eventEmitter = eventEmitter;
  }

  async check(backend: Backend): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`http://${backend.host}:${backend.port}/health`, {
        signal: controller.signal,
        method: 'GET',
      });

      clearTimeout(timeout);

      return {
        healthy: response.ok,
        latencyMs: Date.now() - start,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  start(upstream: Upstream): void {
    this.upstreams.set(upstream.id, upstream);
    if (this.intervalId === undefined) {
      this.intervalId = setInterval(() => {
        this.performHealthChecks();
      }, this.intervalMs);
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private async performHealthChecks(): Promise<void> {
    for (const upstream of this.upstreams.values()) {
      for (const backend of upstream.routes.flatMap((r) => r.backends)) {
        const result = await this.check(backend);
        const previousStatus = backend.status;

        if (result.healthy && previousStatus !== 'healthy') {
          backend.status = 'healthy';
          this.emitEvent('health_check_passed', { backend });
        } else if (!result.healthy && previousStatus === 'healthy') {
          backend.status = 'unhealthy';
          this.emitEvent('health_check_failed', { backend, error: result.error });
        }
      }
    }
  }

  private emitEvent(type: GatewayEventType, data: Record<string, unknown>): void {
    if (this.eventEmitter) {
      this.eventEmitter.emit({
        type,
        timestamp: new Date(),
        metadata: data,
      });
    }
  }
}

export class PassiveHealthChecker implements HealthChecker {
  private failureCounts: Map<string, number> = new Map();
  private threshold: number;

  constructor(threshold: number = 5) {
    this.threshold = threshold;
  }

  async check(backend: Backend): Promise<HealthCheckResult> {
    const failures = this.failureCounts.get(backend.id) || 0;
    return {
      healthy: failures < this.threshold,
      latencyMs: 0,
      timestamp: new Date(),
    };
  }

  recordFailure(backendId: string): void {
    const current = this.failureCounts.get(backendId) || 0;
    this.failureCounts.set(backendId, current + 1);
  }

  recordSuccess(backendId: string): void {
    this.failureCounts.set(backendId, 0);
  }

  reset(backendId: string): void {
    this.failureCounts.delete(backendId);
  }

  start(_upstream: Upstream): void {}
  stop(): void {}
}

export class DefaultTransformProcessor implements TransformProcessor {
  processRequest(request: GatewayRequest, transforms: TransformConfig['request']): GatewayRequest {
    if (!transforms) return request;

    const newRequest = { ...request };

    if (transforms.headers) {
      newRequest.headers = { ...newRequest.headers, ...transforms.headers };
    }

    if (transforms.queryParams) {
      newRequest.query = { ...newRequest.query, ...transforms.queryParams };
    }

    if (transforms.pathRewrite) {
      newRequest.path = newRequest.path.replace(
        new RegExp(transforms.pathRewrite.pattern),
        transforms.pathRewrite.replacement
      );
    }

    return newRequest;
  }

  processResponse(response: GatewayResponse, transforms: TransformConfig['response']): GatewayResponse {
    if (!transforms) return response;

    const newResponse = { ...response };

    if (transforms.headers) {
      newResponse.headers = { ...newResponse.headers, ...transforms.headers };
    }

    return newResponse;
  }
}

export class SimpleEventEmitter implements EventEmitter {
  private handlers: Map<GatewayEventType, Set<(event: GatewayEvent) => void>> = new Map();
  private events: GatewayEvent[] = [];

  emit(event: GatewayEvent): void {
    this.events.push(event);
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch {
        }
      }
    }
  }

  on(eventType: GatewayEventType, handler: (event: GatewayEvent) => void): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  off(eventType: GatewayEventType, handler: (event: GatewayEvent) => void): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  getEvents(): GatewayEvent[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
  }
}

export class SimpleCircuitBreaker {
  private state: CircuitBreakerState;
  private config: CircuitBreakerConfig;
  private backend: Backend;
  private eventEmitter?: EventEmitter;

  constructor(backend: Backend, config: CircuitBreakerConfig, eventEmitter?: EventEmitter) {
    this.backend = backend;
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    this.eventEmitter = eventEmitter;
    this.state = {
      state: 'closed',
      failureCount: 0,
      successCount: 0,
    };
  }

  canExecute(): boolean {
    if (this.state.state === 'closed') return true;

    if (this.state.state === 'open') {
      if (this.state.nextAttempt && new Date() >= this.state.nextAttempt) {
        this.state.state = 'half_open';
        this.emitEvent('circuit_breaker_half_open');
        return true;
      }
      return false;
    }

    return true;
  }

  recordSuccess(): void {
    if (this.state.state === 'half_open') {
      this.state.successCount++;
      if (this.state.successCount >= this.config.successThreshold) {
        this.state.state = 'closed';
        this.state.failureCount = 0;
        this.state.successCount = 0;
        this.emitEvent('circuit_breaker_closed');
      }
    } else {
      this.state.failureCount = 0;
    }
  }

  recordFailure(): void {
    this.state.failureCount++;
    this.state.lastFailure = new Date();

    if (this.state.state === 'half_open') {
      this.state.state = 'open';
      this.state.nextAttempt = new Date(Date.now() + this.config.timeoutMs);
      this.emitEvent('circuit_breaker_open');
    } else if (this.state.failureCount >= this.config.failureThreshold) {
      this.state.state = 'open';
      this.state.nextAttempt = new Date(Date.now() + this.config.timeoutMs);
      this.emitEvent('circuit_breaker_open');
    }
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  private emitEvent(type: GatewayEventType): void {
    if (this.eventEmitter) {
      this.eventEmitter.emit({
        type,
        timestamp: new Date(),
        metadata: { backendId: this.backend.id },
      });
    }
  }
}

export class SimpleRetryPolicy implements RetryPolicy {
  private maxAttempts: number;
  private baseDelayMs: number;

  constructor(maxAttempts: number = 3, baseDelayMs: number = 100) {
    this.maxAttempts = maxAttempts;
    this.baseDelayMs = baseDelayMs;
  }

  shouldRetry(context: GatewayContext, _error: Error): boolean {
    return context.attempts < this.maxAttempts;
  }

  getDelay(_context: GatewayContext, attempt: number): number {
    return this.baseDelayMs * Math.pow(2, attempt);
  }
}

export class InMemoryRateLimiter {
  private limits: Map<string, { count: number; resetAt: Date }> = new Map();
  private defaultRule: RateLimitRule;

  constructor(defaultRule?: RateLimitRule) {
    this.defaultRule = defaultRule || { maxRequests: 100, windowSizeMs: 60000 };
  }

  async check(key: string, rule?: RateLimitRule): Promise<RateLimitInfo> {
    const limitRule = rule || this.defaultRule;
    const entry = this.limits.get(key);

    if (!entry || new Date() >= entry.resetAt) {
      const resetAt = new Date(Date.now() + limitRule.windowSizeMs);
      this.limits.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        remaining: limitRule.maxRequests - 1,
        limit: limitRule.maxRequests,
        resetAt,
      };
    }

    entry.count++;

    if (entry.count > limitRule.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        limit: limitRule.maxRequests,
        resetAt: entry.resetAt,
        retryAfterMs: entry.resetAt.getTime() - Date.now(),
      };
    }

    return {
      allowed: true,
      remaining: limitRule.maxRequests - entry.count,
      limit: limitRule.maxRequests,
      resetAt: entry.resetAt,
    };
  }

  reset(key: string): void {
    this.limits.delete(key);
  }

  clear(): void {
    this.limits.clear();
  }
}

export class ProxyHandlerImpl implements ProxyHandler {
  private transformProcessor: TransformProcessor;

  constructor() {
    this.transformProcessor = new DefaultTransformProcessor();
  }

  async handle(context: GatewayContext): Promise<GatewayResponse> {
    const { selectedBackend, matchedRoute, request } = context;

    if (!selectedBackend) {
      throw new Error('No backend selected');
    }

    let processedRequest = request;
    if (matchedRoute?.transforms?.request) {
      processedRequest = this.transformProcessor.processRequest(
        processedRequest,
        matchedRoute.transforms.request
      );
    }

    const url = `http://${selectedBackend.host}:${selectedBackend.port}${processedRequest.path}`;
    const timeout = matchedRoute?.timeout || 30000;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const fetchResponse = await fetch(url, {
        method: processedRequest.method,
        headers: processedRequest.headers,
        body: processedRequest.body ? JSON.stringify(processedRequest.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let response: GatewayResponse = {
        id: generateId('res'),
        statusCode: fetchResponse.status,
        headers: {},
        body: undefined,
        timestamp: new Date(),
      };

      for (const [key, value] of fetchResponse.headers.entries()) {
        response.headers[key] = value;
      }

      const responseBody = await fetchResponse.text();
      if (responseBody) {
        try {
          response.body = JSON.parse(responseBody);
        } catch {
          response.body = responseBody;
        }
      }

      if (matchedRoute?.transforms?.response) {
        response = this.transformProcessor.processResponse(response, matchedRoute.transforms.response);
      }

      return response;
    } catch (error) {
      throw new Error(`Proxy error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export class LoadBalancerFactory {
  static create(algorithm: LoadBalancingAlgorithm): LoadBalancer {
    switch (algorithm) {
      case 'round_robin':
        return new RoundRobinLoadBalancer();
      case 'least_connections':
        return new LeastConnectionsLoadBalancer();
      case 'ip_hash':
        return new IpHashLoadBalancer();
      case 'weighted':
        return new WeightedLoadBalancer();
      default:
        return new RoundRobinLoadBalancer();
    }
  }
}

export class BackendImpl implements Backend {
  id: string;
  host: string;
  port: number;
  weight: number;
  status: BackendStatus;
  activeConnections: number;
  maxConnections: number;
  metadata?: Record<string, unknown>;

  constructor(host: string, port: number, weight: number = 1, maxConnections: number = 100) {
    this.id = generateId('bk');
    this.host = host;
    this.port = port;
    this.weight = weight;
    this.status = 'healthy';
    this.activeConnections = 0;
    this.maxConnections = maxConnections;
  }

  incrementConnections(): void {
    this.activeConnections++;
  }

  decrementConnections(): void {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
  }
}

export class RouteImpl implements Route {
  id: string;
  name: string;
  type: RouteType;
  path: string;
  regex?: RegExp;
  methods?: HttpMethod[];
  backends: Backend[];
  timeout?: number;
  retryAttempts?: number;
  healthCheck?: HealthCheckConfig;
  rateLimit?: RateLimitRule;
  transforms?: TransformConfig;
  plugins?: PluginConfig[];
  priority: number;
  enabled: boolean;
  metadata?: Record<string, unknown>;

  constructor(
    name: string,
    type: RouteType,
    path: string,
    backends: Backend[],
    options: Partial<Route> = {}
  ) {
    this.id = generateId('route');
    this.name = name;
    this.type = type;
    this.path = path;
    if (type === 'regex' && options.regex === undefined) {
      this.regex = new RegExp(path);
    } else {
      this.regex = options.regex;
    }
    this.methods = options.methods;
    this.backends = backends;
    this.timeout = options.timeout;
    this.retryAttempts = options.retryAttempts;
    this.healthCheck = options.healthCheck;
    this.rateLimit = options.rateLimit;
    this.transforms = options.transforms;
    this.plugins = options.plugins;
    this.priority = options.priority ?? 0;
    this.enabled = options.enabled ?? true;
    this.metadata = options.metadata;
  }
}

export class UpstreamImpl implements Upstream {
  id: string;
  name: string;
  routes: Route[];
  loadBalancing: LoadBalancingAlgorithm;
  healthCheck?: HealthCheckConfig;
  circuitBreaker?: CircuitBreakerConfig;
  timeout?: number;
  retryAttempts?: number;
  rateLimit?: RateLimitRule;

  constructor(name: string, routes: Route[] = [], options: Partial<Upstream> = {}) {
    this.id = generateId('upstream');
    this.name = name;
    this.routes = routes;
    this.loadBalancing = options.loadBalancing || 'round_robin';
    this.healthCheck = options.healthCheck;
    this.circuitBreaker = options.circuitBreaker;
    this.timeout = options.timeout;
    this.retryAttempts = options.retryAttempts;
    this.rateLimit = options.rateLimit;
  }

  addRoute(route: Route): void {
    this.routes.push(route);
  }

  removeRoute(routeId: string): void {
    this.routes = this.routes.filter((r) => r.id !== routeId);
  }

  getAllBackends(): Backend[] {
    return this.routes.flatMap((r) => r.backends);
  }
}

export class MetricsCollector {
  private upstreamMetrics: Map<string, UpstreamMetrics> = new Map();
  private backendMetrics: Map<string, BackendMetrics> = new Map();
  private totalRequests: number = 0;
  private totalResponses: number = 0;
  private totalLatencyMs: number = 0;
  private rateLimitMetrics = { totalChecks: 0, allowed: 0, rejected: 0 };
  private circuitBreakerMetrics = { totalStateChanges: 0, currentlyOpen: 0, currentlyHalfOpen: 0 };

  recordRequest(upstreamId: string, backendId: string): void {
    this.totalRequests++;
    let metrics = this.upstreamMetrics.get(upstreamId);
    if (!metrics) {
      metrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageLatencyMs: 0,
        currentConnections: 0,
        backendMetrics: new Map(),
      };
      this.upstreamMetrics.set(upstreamId, metrics);
    }
    metrics.totalRequests++;

    let backendMetrics = metrics.backendMetrics.get(backendId);
    if (!backendMetrics) {
      backendMetrics = {
        backendId,
        requests: 0,
        successes: 0,
        failures: 0,
        averageLatencyMs: 0,
        currentConnections: 0,
        status: 'healthy',
      };
      metrics.backendMetrics.set(backendId, backendMetrics);
    }
    backendMetrics.requests++;
  }

  recordResponse(upstreamId: string, backendId: string, latencyMs: number, success: boolean): void {
    this.totalResponses++;
    this.totalLatencyMs += latencyMs;

    const metrics = this.upstreamMetrics.get(upstreamId);
    if (metrics) {
      if (success) {
        metrics.successfulRequests++;
      } else {
        metrics.failedRequests++;
      }
      metrics.averageLatencyMs = this.totalLatencyMs / this.totalResponses;

      const backendMetrics = metrics.backendMetrics.get(backendId);
      if (backendMetrics) {
        if (success) {
          backendMetrics.successes++;
        } else {
          backendMetrics.failures++;
        }
      }
    }
  }

  recordRateLimit(allowed: boolean): void {
    this.rateLimitMetrics.totalChecks++;
    if (allowed) {
      this.rateLimitMetrics.allowed++;
    } else {
      this.rateLimitMetrics.rejected++;
    }
  }

  recordCircuitBreakerStateChange(state: 'open' | 'half_open' | 'closed'): void {
    this.circuitBreakerMetrics.totalStateChanges++;
    this.circuitBreakerMetrics.currentlyOpen = state === 'open' ? 1 : 0;
    this.circuitBreakerMetrics.currentlyHalfOpen = state === 'half_open' ? 1 : 0;
  }

  getMetrics(): GatewayMetrics {
    return {
      totalRequests: this.totalRequests,
      totalResponses: this.totalResponses,
      averageLatencyMs: this.totalLatencyMs / Math.max(1, this.totalResponses),
      upstreamMetrics: this.upstreamMetrics,
      rateLimitMetrics: this.rateLimitMetrics,
      circuitBreakerMetrics: this.circuitBreakerMetrics,
    };
  }

  reset(): void {
    this.upstreamMetrics.clear();
    this.backendMetrics.clear();
    this.totalRequests = 0;
    this.totalResponses = 0;
    this.totalLatencyMs = 0;
    this.rateLimitMetrics = { totalChecks: 0, allowed: 0, rejected: 0 };
    this.circuitBreakerMetrics = { totalStateChanges: 0, currentlyOpen: 0, currentlyHalfOpen: 0 };
  }
}

export class ApiGateway {
  private config: GatewayConfig;
  private upstreams: Map<string, Upstream> = new Map();
  private routeMatcher: RouteMatcher;
  private healthChecker?: HealthChecker;
  private serviceDiscovery?: ServiceDiscovery;
  private eventEmitter: EventEmitter;
  private rateLimiter: InMemoryRateLimiter;
  private metricsCollector: MetricsCollector;
  private proxyHandler: ProxyHandler;
  private retryPolicy: RetryPolicy;
  private circuitBreakers: Map<string, SimpleCircuitBreaker> = new Map();

  constructor(config: Partial<GatewayConfig> = {}) {
    this.config = { ...DEFAULT_GATEWAY_CONFIG, ...config };
    this.routeMatcher = new RouteMatcherImpl();
    this.eventEmitter = new SimpleEventEmitter();
    this.rateLimiter = new InMemoryRateLimiter(this.config.defaultRateLimit);
    this.metricsCollector = new MetricsCollector();
    this.proxyHandler = new ProxyHandlerImpl();
    this.retryPolicy = new SimpleRetryPolicy();
  }

  registerUpstream(upstream: Upstream): void {
    this.upstreams.set(upstream.id, upstream);
    if (upstream.healthCheck && this.healthChecker) {
      this.healthChecker.start(upstream);
    }
  }

  unregisterUpstream(upstreamId: string): void {
    this.upstreams.delete(upstreamId);
  }

  getUpstream(upstreamId: string): Upstream | undefined {
    return this.upstreams.get(upstreamId);
  }

  getAllUpstreams(): Upstream[] {
    return Array.from(this.upstreams.values());
  }

  setHealthChecker(healthChecker: HealthChecker): void {
    this.healthChecker = healthChecker;
    for (const upstream of this.upstreams.values()) {
      if (upstream.healthCheck) {
        healthChecker.start(upstream);
      }
    }
  }

  setServiceDiscovery(serviceDiscovery: ServiceDiscovery): void {
    this.serviceDiscovery = serviceDiscovery;
    serviceDiscovery.start();
  }

  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }

  getMetrics(): GatewayMetrics {
    return this.metricsCollector.getMetrics();
  }

  async handleRequest(request: GatewayRequest): Promise<GatewayResponse> {
    const context: GatewayContext = {
      request,
      attempts: 0,
      startTime: new Date(),
      metadata: {},
    };

    this.eventEmitter.emit({
      type: 'request_received',
      timestamp: new Date(),
      context,
    });

    const matched = this.findMatchingRoute(request);

    if (!matched) {
      this.eventEmitter.emit({
        type: 'route_not_found',
        timestamp: new Date(),
        context,
      });
      return this.createErrorResponse(404, 'Route not found');
    }

    context.matchedRoute = matched.route;
    context.upstream = matched.upstream;

    this.eventEmitter.emit({
      type: 'route_matched',
      timestamp: new Date(),
      context,
    });

    if (matched.route.rateLimit) {
      const rateLimitKey = `rate_${matched.route.id}_${request.ip || 'unknown'}`;
      const rateLimitResult = await this.rateLimiter.check(rateLimitKey, matched.route.rateLimit);
      this.metricsCollector.recordRateLimit(rateLimitResult.allowed);

      if (!rateLimitResult.allowed) {
        this.eventEmitter.emit({
          type: 'rate_limited',
          timestamp: new Date(),
          context,
        });
        return this.createRateLimitResponse(rateLimitResult);
      }
    }

    const loadBalancer = LoadBalancerFactory.create(matched.upstream.loadBalancing);
    let backend = loadBalancer.select(matched.route.backends, context);

    if (!backend) {
      this.eventEmitter.emit({
        type: 'error',
        timestamp: new Date(),
        context,
        error: new Error('No healthy backends available'),
      });
      return this.createErrorResponse(503, 'Service unavailable');
    }

    context.selectedBackend = backend;

    const circuitBreakerKey = `${matched.upstream.id}_${backend.id}`;
    let circuitBreaker = this.circuitBreakers.get(circuitBreakerKey);
    if (!circuitBreaker && matched.upstream.circuitBreaker?.enabled) {
      circuitBreaker = new SimpleCircuitBreaker(backend, matched.upstream.circuitBreaker, this.eventEmitter);
      this.circuitBreakers.set(circuitBreakerKey, circuitBreaker);
    }

    if (circuitBreaker && !circuitBreaker.canExecute()) {
      this.eventEmitter.emit({
        type: 'circuit_breaker_open',
        timestamp: new Date(),
        context,
      });
      return this.createErrorResponse(503, 'Circuit breaker open');
    }

    this.eventEmitter.emit({
      type: 'backend_selected',
      timestamp: new Date(),
      context,
    });

    try {
      backend.incrementConnections?.();
      this.metricsCollector.recordRequest(matched.upstream.id, backend.id);

      const response = await this.proxyHandler.handle(context);

      backend.decrementConnections?.();
      circuitBreaker?.recordSuccess();

      this.metricsCollector.recordResponse(
        matched.upstream.id,
        backend.id,
        Date.now() - context.startTime.getTime(),
        true
      );

      this.eventEmitter.emit({
        type: 'response_received',
        timestamp: new Date(),
        context,
      });

      return response;
    } catch (error) {
      backend.decrementConnections?.();
      circuitBreaker?.recordFailure();

      this.metricsCollector.recordResponse(
        matched.upstream.id,
        backend.id,
        Date.now() - context.startTime.getTime(),
        false
      );

      this.eventEmitter.emit({
        type: 'error',
        timestamp: new Date(),
        context,
        error: error instanceof Error ? error : new Error('Unknown error'),
      });

      if (this.retryPolicy.shouldRetry(context, error instanceof Error ? error : new Error('Unknown'))) {
        context.attempts++;
        const delay = this.retryPolicy.getDelay(context, context.attempts);
        await new Promise((resolve) => setTimeout(resolve, delay));

        backend = loadBalancer.select(matched.route.backends, context);
        if (backend) {
          context.selectedBackend = backend;
          return this.proxyHandler.handle(context);
        }
      }

      return this.createErrorResponse(502, 'Bad gateway');
    }
  }

  private findMatchingRoute(request: GatewayRequest): { route: Route; upstream: Upstream } | null {
    const upstreams = Array.from(this.upstreams.values());
    let bestMatch: { route: Route; upstream: Upstream; priority: number } | null = null;

    for (const upstream of upstreams) {
      for (const route of upstream.routes) {
        if (this.routeMatcher.match(route, request)) {
          if (!bestMatch || route.priority > bestMatch.priority) {
            bestMatch = { route, upstream, priority: route.priority };
          }
        }
      }
    }

    return bestMatch ? { route: bestMatch.route, upstream: bestMatch.upstream } : null;
  }

  private createErrorResponse(statusCode: number, message: string): GatewayResponse {
    return {
      id: generateId('res'),
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: { error: message },
      timestamp: new Date(),
    };
  }

  private createRateLimitResponse(rateLimitInfo: RateLimitInfo): GatewayResponse {
    return {
      id: generateId('res'),
      statusCode: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': rateLimitInfo.limit.toString(),
        'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
        'X-RateLimit-Reset': rateLimitInfo.resetAt.getTime().toString(),
        'Retry-After': rateLimitInfo.retryAfterMs ? Math.ceil(rateLimitInfo.retryAfterMs / 1000).toString() : '0',
      },
      body: { error: 'Rate limit exceeded' },
      timestamp: new Date(),
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, unknown> }> {
    const healthy = this.upstreams.size > 0;
    return {
      healthy,
      details: {
        upstreams: this.upstreams.size,
        routes: Array.from(this.upstreams.values()).reduce((sum, u) => sum + u.routes.length, 0),
      },
    };
  }

  start(): void {
    if (this.serviceDiscovery) {
      this.serviceDiscovery.start();
    }
  }

  stop(): void {
    if (this.serviceDiscovery) {
      this.serviceDiscovery.stop();
    }
    if (this.healthChecker) {
      this.healthChecker.stop();
    }
  }
}

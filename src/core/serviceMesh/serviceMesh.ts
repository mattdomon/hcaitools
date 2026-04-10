import crypto from 'crypto';
import {
  ServiceRegistration,
  ServiceRegistry,
  ServiceDiscoveryConfig,
  ServiceHealth,
  CircuitBreaker,
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitBreakerMetrics,
  LoadBalancer,
  LoadBalancerTarget,
  LoadBalancingStrategy,
  TracingClient,
  TraceSpan,
  DistributedTrace,
  AuthHandler,
  AuthContext,
  AuthResult,
  AuthConfig,
  AuthMethod,
  ServiceMeshConfig,
  ServiceMesh,
  ServiceMeshMetrics,
} from './types';

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export class InMemoryServiceRegistry implements ServiceRegistry {
  private services: Map<string, ServiceRegistration> = new Map();

  getService(id: string): ServiceRegistration | undefined {
    return this.services.get(id);
  }

  getServicesByName(name: string): ServiceRegistration[] {
    return Array.from(this.services.values()).filter(
      (s) => s.name === name && s.health === 'healthy'
    );
  }

  getAllServices(): ServiceRegistration[] {
    return Array.from(this.services.values());
  }

  register(registration: ServiceRegistration): void {
    this.services.set(registration.id, registration);
  }

  deregister(id: string): boolean {
    return this.services.delete(id);
  }

  updateHealth(id: string, health: ServiceHealth): void {
    const service = this.services.get(id);
    if (service) {
      service.health = health;
      service.lastHeartbeat = Date.now();
    }
  }
}

class ServiceDiscovery {
  private config: ServiceDiscoveryConfig;
  private registry: ServiceRegistry;

  constructor(config: ServiceDiscoveryConfig, registry: ServiceRegistry) {
    this.config = config;
    this.registry = registry;
  }

  discover(name: string): ServiceRegistration[] {
    switch (this.config.type) {
      case 'static':
        return this.staticDiscovery(name);
      case 'dynamic':
        return this.dynamicDiscovery(name);
      case 'dns':
        return this.dnsDiscovery(name);
      default:
        return [];
    }
  }

  private staticDiscovery(_name: string): ServiceRegistration[] {
    return this.registry.getAllServices().filter((s) => s.health === 'healthy');
  }

  private dynamicDiscovery(name: string): ServiceRegistration[] {
    return this.registry.getServicesByName(name);
  }

  private dnsDiscovery(name: string): ServiceRegistration[] {
    return this.registry.getServicesByName(name);
  }
}

class CircuitBreakerImpl implements CircuitBreaker {
  name: string;
  config: CircuitBreakerConfig;
  metrics: CircuitBreakerMetrics;

  constructor(name: string, config: CircuitBreakerConfig) {
    this.name = name;
    this.config = config;
    this.metrics = {
      failures: 0,
      successes: 0,
      state: 'closed',
      lastStateChange: Date.now(),
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.metrics.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('half_open');
      } else {
        throw new Error(`Circuit breaker ${this.name} is open`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  getState(): CircuitBreakerState {
    return this.metrics.state;
  }

  isAvailable(): boolean {
    if (this.metrics.state === 'closed') {
      return true;
    }
    if (this.metrics.state === 'open') {
      return this.shouldAttemptReset();
    }
    return true;
  }

  private onSuccess(): void {
    this.metrics.successes++;
    this.metrics.consecutiveSuccesses++;
    this.metrics.consecutiveFailures = 0;

    if (this.metrics.state === 'half_open') {
      if (this.metrics.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    } else if (this.metrics.state === 'closed') {
      this.metrics.failures = Math.max(0, this.metrics.failures - 1);
    }
  }

  private onFailure(): void {
    this.metrics.failures++;
    this.metrics.consecutiveFailures++;
    this.metrics.consecutiveSuccesses = 0;

    if (this.metrics.state === 'half_open') {
      this.transitionTo('open');
    } else if (this.metrics.consecutiveFailures >= this.config.failureThreshold) {
      this.transitionTo('open');
    }
  }

  private transitionTo(state: CircuitBreakerState): void {
    this.metrics.state = state;
    this.metrics.lastStateChange = Date.now();
    this.metrics.consecutiveFailures = 0;
    this.metrics.consecutiveSuccesses = 0;
  }

  private shouldAttemptReset(): boolean {
    const elapsed = Date.now() - this.metrics.lastStateChange;
    return elapsed >= this.config.timeout;
  }
}

class RoundRobinLoadBalancer implements LoadBalancer {
  private targets: Map<string, LoadBalancerTarget> = new Map();
  private currentIndex = 0;

  selectTarget(targets: LoadBalancerTarget[]): LoadBalancerTarget | undefined {
    if (targets.length === 0) return undefined;
    this.syncTargets(targets);
    const healthyTargets = targets.filter((t) => t.registration.health === 'healthy');
    if (healthyTargets.length === 0) return undefined;
    const selected = healthyTargets[this.currentIndex % healthyTargets.length];
    this.currentIndex++;
    return selected;
  }

  addTarget(target: LoadBalancerTarget): void {
    this.targets.set(target.registration.id, target);
  }

  removeTarget(serviceId: string): void {
    this.targets.delete(serviceId);
  }

  updateTarget(serviceId: string, updates: Partial<LoadBalancerTarget>): void {
    const target = this.targets.get(serviceId);
    if (target) {
      Object.assign(target, updates);
    }
  }

  private syncTargets(targets: LoadBalancerTarget[]): void {
    const targetIds = new Set(targets.map((t) => t.registration.id));
    for (const id of this.targets.keys()) {
      if (!targetIds.has(id)) {
        this.targets.delete(id);
      }
    }
    for (const target of targets) {
      this.targets.set(target.registration.id, target);
    }
  }
}

class LeastConnectionsLoadBalancer implements LoadBalancer {
  private targets: Map<string, LoadBalancerTarget> = new Map();

  selectTarget(targets: LoadBalancerTarget[]): LoadBalancerTarget | undefined {
    if (targets.length === 0) return undefined;
    this.syncTargets(targets);
    const healthyTargets = targets.filter((t) => t.registration.health === 'healthy');
    if (healthyTargets.length === 0) return undefined;
    return healthyTargets.reduce((min, t) =>
      t.activeConnections < min.activeConnections ? t : min
    );
  }

  addTarget(target: LoadBalancerTarget): void {
    this.targets.set(target.registration.id, target);
  }

  removeTarget(serviceId: string): void {
    this.targets.delete(serviceId);
  }

  updateTarget(serviceId: string, updates: Partial<LoadBalancerTarget>): void {
    const target = this.targets.get(serviceId);
    if (target) {
      Object.assign(target, updates);
    }
  }

  private syncTargets(targets: LoadBalancerTarget[]): void {
    const targetIds = new Set(targets.map((t) => t.registration.id));
    for (const id of this.targets.keys()) {
      if (!targetIds.has(id)) {
        this.targets.delete(id);
      }
    }
    for (const target of targets) {
      this.targets.set(target.registration.id, target);
    }
  }
}

class RandomLoadBalancer implements LoadBalancer {
  private targets: Map<string, LoadBalancerTarget> = new Map();

  selectTarget(targets: LoadBalancerTarget[]): LoadBalancerTarget | undefined {
    if (targets.length === 0) return undefined;
    this.syncTargets(targets);
    const healthyTargets = targets.filter((t) => t.registration.health === 'healthy');
    if (healthyTargets.length === 0) return undefined;
    const index = Math.floor(Math.random() * healthyTargets.length);
    return healthyTargets[index];
  }

  addTarget(target: LoadBalancerTarget): void {
    this.targets.set(target.registration.id, target);
  }

  removeTarget(serviceId: string): void {
    this.targets.delete(serviceId);
  }

  updateTarget(serviceId: string, updates: Partial<LoadBalancerTarget>): void {
    const target = this.targets.get(serviceId);
    if (target) {
      Object.assign(target, updates);
    }
  }

  private syncTargets(targets: LoadBalancerTarget[]): void {
    const targetIds = new Set(targets.map((t) => t.registration.id));
    for (const id of this.targets.keys()) {
      if (!targetIds.has(id)) {
        this.targets.delete(id);
      }
    }
    for (const target of targets) {
      this.targets.set(target.registration.id, target);
    }
  }
}

class WeightedLoadBalancer implements LoadBalancer {
  private targets: Map<string, LoadBalancerTarget> = new Map();

  selectTarget(targets: LoadBalancerTarget[]): LoadBalancerTarget | undefined {
    if (targets.length === 0) return undefined;
    this.syncTargets(targets);
    const healthyTargets = targets.filter((t) => t.registration.health === 'healthy');
    if (healthyTargets.length === 0) return undefined;

    const totalWeight = healthyTargets.reduce((sum, t) => sum + t.weight, 0);
    let random = Math.random() * totalWeight;

    for (const target of healthyTargets) {
      random -= target.weight;
      if (random <= 0) {
        return target;
      }
    }

    return healthyTargets[healthyTargets.length - 1];
  }

  addTarget(target: LoadBalancerTarget): void {
    this.targets.set(target.registration.id, target);
  }

  removeTarget(serviceId: string): void {
    this.targets.delete(serviceId);
  }

  updateTarget(serviceId: string, updates: Partial<LoadBalancerTarget>): void {
    const target = this.targets.get(serviceId);
    if (target) {
      Object.assign(target, updates);
    }
  }

  private syncTargets(targets: LoadBalancerTarget[]): void {
    const targetIds = new Set(targets.map((t) => t.registration.id));
    for (const id of this.targets.keys()) {
      if (!targetIds.has(id)) {
        this.targets.delete(id);
      }
    }
    for (const target of targets) {
      this.targets.set(target.registration.id, target);
    }
  }
}

class DistributedTracingClient implements TracingClient {
  private traces: Map<string, DistributedTrace> = new Map();
  private activeSpans: Map<string, TraceSpan> = new Map();

  createSpan(serviceName: string, operationName: string, parentId?: string): TraceSpan {
    const traceId = generateId('trace');
    const spanId = generateId('span');

    let parentSpanId: string | undefined;
    if (parentId) {
      const parentSpan = this.activeSpans.get(parentId);
      if (parentSpan) {
        parentSpanId = parentSpan.traceId;
      }
    }

    const span: TraceSpan = {
      id: spanId,
      traceId,
      parentId: parentSpanId,
      serviceName,
      operationName,
      startTime: Date.now(),
      tags: {},
      logs: [],
    };

    this.activeSpans.set(spanId, span);

    let trace = this.traces.get(traceId);
    if (!trace) {
      trace = {
        traceId,
        spans: new Map(),
        startTime: span.startTime,
      };
      this.traces.set(traceId, trace);
    }
    trace.spans.set(spanId, span);

    return span;
  }

  finishSpan(spanId: string, endTime?: number): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.endTime = endTime ?? Date.now();
      span.duration = span.endTime - span.startTime;
      this.activeSpans.delete(spanId);

      const trace = this.traces.get(span.traceId);
      if (trace) {
        trace.endTime = span.endTime;
        trace.spans.set(spanId, span);
      }
    }
  }

  addTag(spanId: string, key: string, value: string | number | boolean): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.tags[key] = value;
    }
  }

  addLog(spanId: string, fields: Record<string, string | number | boolean>): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.logs.push({
        timestamp: Date.now(),
        fields,
      });
    }
  }

  getTrace(traceId: string): DistributedTrace | undefined {
    return this.traces.get(traceId);
  }

  getActiveSpans(): TraceSpan[] {
    return Array.from(this.activeSpans.values());
  }
}

class ServiceAuthHandler implements AuthHandler {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  async authenticate(request: AuthContext): Promise<AuthResult> {
    if (!this.validateAuthMethod(request.method)) {
      return {
        success: false,
        error: `Unsupported authentication method: ${request.method}`,
      };
    }

    switch (request.method) {
      case 'mTLS':
        return this.authenticateMtLS(request);
      case 'JWT':
        return this.authenticateJWT(request);
      case 'API_KEY':
        return this.authenticateAPIKey(request);
      default:
        return { success: false, error: 'Authentication method not implemented' };
    }
  }

  async authorize(_request: AuthContext, _requiredPermissions: string[]): Promise<boolean> {
    return true;
  }

  private validateAuthMethod(method: AuthMethod): boolean {
    return method === this.config.method;
  }

  private async authenticateMtLS(_request: AuthContext): Promise<AuthResult> {
    if (!this.config.certPath || !this.config.keyPath || !this.config.caPath) {
      return { success: false, error: 'mTLS configuration incomplete' };
    }
    return { success: true };
  }

  private async authenticateJWT(_request: AuthContext): Promise<AuthResult> {
    if (!this.config.jwtSecret) {
      return { success: false, error: 'JWT secret not configured' };
    }
    const token = _request.credentials;
    if (!token) {
      return { success: false, error: 'No credentials provided' };
    }
    return { success: true, permissions: ['read', 'write'] };
  }

  private async authenticateAPIKey(_request: AuthContext): Promise<AuthResult> {
    if (!this.config.apiKey) {
      return { success: false, error: 'API key not configured' };
    }
    const providedKey = _request.credentials;
    if (providedKey !== this.config.apiKey) {
      return { success: false, error: 'Invalid API key' };
    }
    return { success: true };
  }
}

export function createLoadBalancer(strategy: LoadBalancingStrategy): LoadBalancer {
  switch (strategy) {
    case 'round_robin':
      return new RoundRobinLoadBalancer();
    case 'least_connections':
      return new LeastConnectionsLoadBalancer();
    case 'random':
      return new RandomLoadBalancer();
    case 'weighted':
      return new WeightedLoadBalancer();
    default:
      return new RoundRobinLoadBalancer();
  }
}

export function createCircuitBreaker(name: string, config: CircuitBreakerConfig): CircuitBreaker {
  return new CircuitBreakerImpl(name, config);
}

export function createServiceDiscovery(
  config: ServiceDiscoveryConfig,
  registry: ServiceRegistry
): ServiceDiscovery {
  return new ServiceDiscovery(config, registry);
}

export function createTracingClient(): TracingClient {
  return new DistributedTracingClient();
}

export function createAuthHandler(config: AuthConfig): AuthHandler {
  return new ServiceAuthHandler(config);
}

export class ServiceMeshImpl implements ServiceMesh {
  private registry: ServiceRegistry;
  private discovery: ServiceDiscovery;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private loadBalancer: LoadBalancer;
  private tracing: TracingClient;
  private auth: AuthHandler;
  private config: ServiceMeshConfig;
  private metrics: ServiceMeshMetrics;

  constructor(config: ServiceMeshConfig) {
    this.config = config;
    this.registry = new InMemoryServiceRegistry();
    this.discovery = createServiceDiscovery(config.discovery, this.registry);
    this.loadBalancer = createLoadBalancer(config.loadBalancing);
    this.tracing = createTracingClient();
    this.auth = createAuthHandler(config.auth);
    this.metrics = {
      totalServices: 0,
      healthyServices: 0,
      unhealthyServices: 0,
      activeCircuits: 0,
      openCircuits: 0,
      halfOpenCircuits: 0,
      totalRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
    };
  }

  registerService(
    registration: Omit<ServiceRegistration, 'id' | 'registeredAt' | 'lastHeartbeat'>
  ): string {
    const id = generateId('svc');
    const fullRegistration: ServiceRegistration = {
      ...registration,
      id,
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
    };

    this.registry.register(fullRegistration);

    const cb = createCircuitBreaker(fullRegistration.name, this.config.circuitBreaker);
    this.circuitBreakers.set(fullRegistration.name, cb);

    this.updateMetrics();
    return id;
  }

  deregisterService(id: string): boolean {
    const service = this.registry.getService(id);
    if (service) {
      this.circuitBreakers.delete(service.name);
      const result = this.registry.deregister(id);
      this.updateMetrics();
      return result;
    }
    return false;
  }

  discoverService(name: string): ServiceRegistration[] {
    return this.discovery.discover(name);
  }

  async callService<T>(
    serviceName: string,
    operation: string,
    _request: unknown
  ): Promise<T> {
    const span = this.tracing.createSpan(serviceName, operation);
    this.metrics.totalRequests++;

    try {
      const circuitBreaker = this.circuitBreakers.get(serviceName);
      if (!circuitBreaker) {
        throw new Error(`No circuit breaker found for service: ${serviceName}`);
      }

      const services = this.discoverService(serviceName);
      if (services.length === 0) {
        throw new Error(`No healthy services found for: ${serviceName}`);
      }

      const targets: LoadBalancerTarget[] = services.map((s) => ({
        registration: s,
        weight: 1,
        activeConnections: 0,
      }));

      const target = this.loadBalancer.selectTarget(targets);
      if (!target) {
        throw new Error(`No available target for service: ${serviceName}`);
      }

      this.tracing.addTag(span.id, 'target_service', target.registration.id);
      this.tracing.addTag(span.id, 'target_endpoint', `${target.registration.endpoint.host}:${target.registration.endpoint.port}`);

      const result = await circuitBreaker.execute(async () => {
        return { success: true, data: {} } as T;
      });

      this.tracing.finishSpan(span.id);
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.tracing.addLog(span.id, { error: error instanceof Error ? error.message : 'Unknown error' });
      this.tracing.finishSpan(span.id);
      throw error;
    }
  }

  getCircuitBreaker(serviceName: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(serviceName);
  }

  getTrace(traceId: string): DistributedTrace | undefined {
    return this.tracing.getTrace(traceId);
  }

  getMetrics(): ServiceMeshMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  private updateMetrics(): void {
    const services = this.registry.getAllServices();
    this.metrics.totalServices = services.length;
    this.metrics.healthyServices = services.filter((s) => s.health === 'healthy').length;
    this.metrics.unhealthyServices = services.filter((s) => s.health === 'unhealthy').length;

    let openCircuits = 0;
    let halfOpenCircuits = 0;
    let activeCircuits = 0;

    for (const cb of this.circuitBreakers.values()) {
      activeCircuits++;
      const state = cb.getState();
      if (state === 'open') openCircuits++;
      if (state === 'half_open') halfOpenCircuits++;
    }

    this.metrics.activeCircuits = activeCircuits;
    this.metrics.openCircuits = openCircuits;
    this.metrics.halfOpenCircuits = halfOpenCircuits;
  }
}

export function createServiceMesh(config: ServiceMeshConfig): ServiceMesh {
  return new ServiceMeshImpl(config);
}

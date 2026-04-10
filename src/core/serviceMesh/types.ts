export type ServiceHealth = 'healthy' | 'unhealthy' | 'unknown';

export type DiscoveryType = 'static' | 'dynamic' | 'dns';

export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

export type AuthMethod = 'mTLS' | 'JWT' | 'API_KEY';

export type LoadBalancingStrategy = 'round_robin' | 'least_connections' | 'random' | 'weighted';

export interface ServiceEndpoint {
  host: string;
  port: number;
  protocol?: string;
}

export interface ServiceMetadata {
  [key: string]: string | number | boolean;
}

export interface ServiceRegistration {
  id: string;
  name: string;
  version: string;
  endpoint: ServiceEndpoint;
  health: ServiceHealth;
  metadata?: ServiceMetadata;
  tags?: string[];
  registeredAt: number;
  lastHeartbeat: number;
}

export interface ServiceDiscoveryConfig {
  type: DiscoveryType;
  dnsServer?: string;
  staticHosts?: ServiceEndpoint[];
  refreshInterval?: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  halfOpenRequests?: number;
}

export interface CircuitBreakerMetrics {
  failures: number;
  successes: number;
  state: CircuitBreakerState;
  lastStateChange: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

export interface AuthConfig {
  method: AuthMethod;
  certPath?: string;
  keyPath?: string;
  caPath?: string;
  jwtSecret?: string;
  apiKey?: string;
}

export interface TraceSpan {
  id: string;
  traceId: string;
  parentId?: string;
  serviceName: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, string | number | boolean>;
  logs: TraceSpanLog[];
}

export interface TraceSpanLog {
  timestamp: number;
  fields: Record<string, string | number | boolean>;
}

export interface DistributedTrace {
  traceId: string;
  spans: Map<string, TraceSpan>;
  startTime: number;
  endTime?: number;
}

export interface LoadBalancerTarget {
  registration: ServiceRegistration;
  weight: number;
  activeConnections: number;
}

export interface ServiceHealthCheck {
  serviceId: string;
  checkInterval: number;
  timeout: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
}

export interface ServiceMeshConfig {
  serviceName: string;
  discovery: ServiceDiscoveryConfig;
  circuitBreaker: CircuitBreakerConfig;
  auth: AuthConfig;
  healthCheck: ServiceHealthCheck;
  loadBalancing: LoadBalancingStrategy;
}

export interface ServiceRegistry {
  getService(id: string): ServiceRegistration | undefined;
  getServicesByName(name: string): ServiceRegistration[];
  getAllServices(): ServiceRegistration[];
  register(registration: ServiceRegistration): void;
  deregister(id: string): boolean;
  updateHealth(id: string, health: ServiceHealth): void;
}

export interface CircuitBreaker {
  name: string;
  config: CircuitBreakerConfig;
  metrics: CircuitBreakerMetrics;
  execute<T>(fn: () => Promise<T>): Promise<T>;
  getState(): CircuitBreakerState;
  isAvailable(): boolean;
}

export interface LoadBalancer {
  selectTarget(targets: LoadBalancerTarget[]): LoadBalancerTarget | undefined;
  addTarget(target: LoadBalancerTarget): void;
  removeTarget(serviceId: string): void;
  updateTarget(serviceId: string, updates: Partial<LoadBalancerTarget>): void;
}

export interface TracingClient {
  createSpan(serviceName: string, operationName: string, parentId?: string): TraceSpan;
  finishSpan(spanId: string, endTime?: number): void;
  addTag(spanId: string, key: string, value: string | number | boolean): void;
  addLog(spanId: string, fields: Record<string, string | number | boolean>): void;
  getTrace(traceId: string): DistributedTrace | undefined;
  getActiveSpans(): TraceSpan[];
}

export interface AuthHandler {
  authenticate(request: AuthContext): Promise<AuthResult>;
  authorize(request: AuthContext, requiredPermissions: string[]): Promise<boolean>;
}

export interface AuthContext {
  serviceId?: string;
  method: AuthMethod;
  credentials?: string;
  headers?: Record<string, string>;
  metadata?: ServiceMetadata;
}

export interface AuthResult {
  success: boolean;
  serviceId?: string;
  error?: string;
  permissions?: string[];
}

export interface ServiceMesh {
  registerService(registration: Omit<ServiceRegistration, 'id' | 'registeredAt' | 'lastHeartbeat'>): string;
  deregisterService(id: string): boolean;
  discoverService(name: string): ServiceRegistration[];
  callService<T>(
    serviceName: string,
    operation: string,
    request: unknown
  ): Promise<T>;
  getCircuitBreaker(serviceName: string): CircuitBreaker | undefined;
  getTrace(traceId: string): DistributedTrace | undefined;
  getMetrics(): ServiceMeshMetrics;
}

export interface ServiceMeshMetrics {
  totalServices: number;
  healthyServices: number;
  unhealthyServices: number;
  activeCircuits: number;
  openCircuits: number;
  halfOpenCircuits: number;
  totalRequests: number;
  failedRequests: number;
  averageLatency: number;
}

/**
 * API Gateway & Load Balancing Types
 */

export type LoadBalancingAlgorithm = 'round_robin' | 'least_connections' | 'ip_hash' | 'weighted';

export type RouteType = 'prefix' | 'exact' | 'regex';

export type HealthCheckType = 'passive' | 'active';

export type BackendStatus = 'healthy' | 'unhealthy' | 'draining';

export interface Backend {
  id: string;
  host: string;
  port: number;
  weight: number;
  status: BackendStatus;
  activeConnections: number;
  maxConnections: number;
  metadata?: Record<string, unknown>;
  incrementConnections?(): void;
  decrementConnections?(): void;
}

export interface Route {
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
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface HealthCheckConfig {
  type: HealthCheckType;
  intervalMs: number;
  timeoutMs: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
  path?: string;
}

export interface RateLimitRule {
  maxRequests: number;
  windowSizeMs: number;
  keyPrefix?: string;
}

export interface TransformConfig {
  request?: RequestTransform;
  response?: ResponseTransform;
}

export interface RequestTransform {
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: BodyTransform;
  pathRewrite?: PathRewriteRule;
}

export interface ResponseTransform {
  headers?: Record<string, string>;
  body?: BodyTransform;
}

export interface BodyTransform {
  type: 'json' | 'xml' | 'form';
  mappings?: Record<string, string>;
}

export interface PathRewriteRule {
  pattern: string;
  replacement: string;
}

export interface PluginConfig {
  name: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface Upstream {
  id: string;
  name: string;
  routes: Route[];
  loadBalancing: LoadBalancingAlgorithm;
  healthCheck?: HealthCheckConfig;
  circuitBreaker?: CircuitBreakerConfig;
  timeout?: number;
  retryAttempts?: number;
  rateLimit?: RateLimitRule;
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  halfOpenRequests: number;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  successCount: number;
  lastFailure?: Date;
  nextAttempt?: Date;
}

export interface GatewayConfig {
  port: number;
  host?: string;
  upstreamTimeout?: number;
  defaultRateLimit?: RateLimitRule;
  healthCheckInterval?: number;
  serviceDiscovery?: ServiceDiscoveryConfig;
}

export interface ServiceDiscoveryConfig {
  enabled: boolean;
  provider: 'static' | 'consul' | 'etcd' | 'kubernetes';
  endpoints?: ServiceEndpoint[];
  refreshIntervalMs?: number;
}

export interface ServiceEndpoint {
  id: string;
  name: string;
  host: string;
  port: number;
  metadata?: Record<string, unknown>;
}

export interface GatewayRequest {
  id: string;
  method: HttpMethod;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body?: unknown;
  ip?: string;
  timestamp: Date;
}

export interface GatewayResponse {
  id: string;
  statusCode: number;
  headers: Record<string, string>;
  body?: unknown;
  timestamp: Date;
}

export interface GatewayContext {
  request: GatewayRequest;
  matchedRoute?: Route;
  selectedBackend?: Backend;
  attempts: number;
  startTime: Date;
  metadata: Record<string, unknown>;
  upstream?: Upstream;
}

export interface LoadBalancer {
  select(upstreams: Backend[], context: GatewayContext): Backend | null;
  reset?(): void;
}

export interface RouteMatcher {
  match(route: Route, request: GatewayRequest): boolean;
}

export interface HealthChecker {
  check(backend: Backend): Promise<HealthCheckResult>;
  start(upstream: Upstream): void;
  stop(): void;
}

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  error?: string;
  timestamp: Date;
}

export interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfterMs?: number;
}

export interface ServiceDiscovery {
  register(endpoint: ServiceEndpoint): Promise<void>;
  deregister(id: string): Promise<void>;
  getServices(name: string): Promise<ServiceEndpoint[]>;
  getAllServices(): Promise<ServiceEndpoint[]>;
  start(): void;
  stop(): void;
}

export interface TransformProcessor {
  processRequest(request: GatewayRequest, transforms: RequestTransform): GatewayRequest;
  processResponse(response: GatewayResponse, transforms: ResponseTransform): GatewayResponse;
}

export interface RequestTransformFunction {
  (request: GatewayRequest, config: RequestTransform): GatewayRequest;
}

export interface ResponseTransformFunction {
  (response: GatewayResponse, config: ResponseTransform): GatewayResponse;
}

export interface ProxyHandler {
  handle(context: GatewayContext): Promise<GatewayResponse>;
}

export interface RetryPolicy {
  shouldRetry(context: GatewayContext, error: Error): boolean;
  getDelay(context: GatewayContext, attempt: number): number;
}

export interface UpstreamMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatencyMs: number;
  currentConnections: number;
  backendMetrics: Map<string, BackendMetrics>;
}

export interface BackendMetrics {
  backendId: string;
  requests: number;
  successes: number;
  failures: number;
  averageLatencyMs: number;
  currentConnections: number;
  status: BackendStatus;
}

export interface GatewayMetrics {
  totalRequests: number;
  totalResponses: number;
  averageLatencyMs: number;
  upstreamMetrics: Map<string, UpstreamMetrics>;
  rateLimitMetrics: RateLimitMetricsSummary;
  circuitBreakerMetrics: CircuitBreakerMetricsSummary;
}

export interface RateLimitMetricsSummary {
  totalChecks: number;
  allowed: number;
  rejected: number;
}

export interface CircuitBreakerMetricsSummary {
  totalStateChanges: number;
  currentlyOpen: number;
  currentlyHalfOpen: number;
}

export interface GatewayEvent {
  type: GatewayEventType;
  timestamp: Date;
  context?: GatewayContext;
  error?: Error;
  metadata?: Record<string, unknown>;
}

export type GatewayEventType =
  | 'request_received'
  | 'route_matched'
  | 'route_not_found'
  | 'backend_selected'
  | 'request_forwarded'
  | 'response_received'
  | 'rate_limited'
  | 'circuit_breaker_open'
  | 'circuit_breaker_half_open'
  | 'circuit_breaker_closed'
  | 'health_check_passed'
  | 'health_check_failed'
  | 'error';

export interface EventEmitter {
  emit(event: GatewayEvent): void;
  on(eventType: GatewayEventType, handler: (event: GatewayEvent) => void): void;
  off(eventType: GatewayEventType, handler: (event: GatewayEvent) => void): void;
}

export const LOAD_BALANCER_NAMES: Record<LoadBalancingAlgorithm, string> = {
  round_robin: 'Round Robin',
  least_connections: 'Least Connections',
  ip_hash: 'IP Hash',
  weighted: 'Weighted',
};

export const ROUTE_TYPE_NAMES: Record<RouteType, string> = {
  prefix: 'Prefix Match',
  exact: 'Exact Match',
  regex: 'Regular Expression',
};

export const BACKEND_STATUS_NAMES: Record<BackendStatus, string> = {
  healthy: 'Healthy',
  unhealthy: 'Unhealthy',
  draining: 'Draining',
};

export const DEFAULT_UPSTREAM_CONFIG: Partial<Upstream> = {
  loadBalancing: 'round_robin',
  timeout: 30000,
  retryAttempts: 3,
};

export const DEFAULT_HEALTH_CHECK_CONFIG: HealthCheckConfig = {
  type: 'active',
  intervalMs: 30000,
  timeoutMs: 5000,
  healthyThreshold: 2,
  unhealthyThreshold: 3,
};

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  enabled: true,
  failureThreshold: 5,
  successThreshold: 2,
  timeoutMs: 60000,
  halfOpenRequests: 3,
};

export const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  port: 8080,
  host: '0.0.0.0',
  upstreamTimeout: 30000,
  healthCheckInterval: 30000,
};

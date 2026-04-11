export type VersionFormat = 'v1' | 'v2' | '2024-01-01';

export type VersioningStrategy = 'path' | 'header' | 'query';

export type DeprecationLifecycle = 'active' | 'deprecated' | 'sunset' | 'discontinued';

export type BreakingChangeType = 'breaking' | 'non-breaking';

export interface APIVersion {
  id: string;
  version: string;
  format: VersionFormat;
  major: number;
  minor?: number;
  date?: string;
  isStable: boolean;
  isDeprecated: boolean;
  deprecationLifecycle: DeprecationLifecycle;
  sunsetDate?: Date;
  discontinuationDate?: Date;
  breakingChanges: BreakingChange[];
  supportedPeriod: {
    start: Date;
    end?: Date;
  };
  documentation?: string;
  changelog?: string;
}

export interface BreakingChange {
  id: string;
  type: BreakingChangeType;
  description: string;
  affectedEndpoints?: string[];
  migrationGuide?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface VersionNegotiation {
  requestedVersion: string;
  matchedVersion: APIVersion | null;
  negotiationStrategy: VersioningStrategy;
  fallbackVersion?: APIVersion;
  deprecationNotice?: DeprecationNotice;
  isCompatible: boolean;
}

export interface DeprecationNotice {
  id: string;
  version: string;
  message: string;
  sunsetDate?: Date;
  discontinuationDate?: Date;
  alternatives: string[];
  migrationGuide?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface VersionRoute {
  id: string;
  path: string;
  method: string;
  version: string;
  handler: string;
  middleware?: string[];
  rateLimit?: RateLimitConfig;
}

export interface RateLimitConfig {
  requests: number;
  windowMs: number;
}

export interface VersionConfig {
  defaultVersion: string;
  supportedVersions: string[];
  versioningStrategy: VersioningStrategy;
  enableDeprecationNotices: boolean;
  enableVersionFallback: boolean;
  headerName?: string;
  queryParamName?: string;
}

export interface DeprecationSchedule {
  version: string;
  deprecationDate: Date;
  sunsetDate?: Date;
  discontinuationDate?: Date;
  notice: DeprecationNotice;
}

export interface VersionCompatibility {
  fromVersion: string;
  toVersion: string;
  isCompatible: boolean;
  breakingChanges: BreakingChange[];
  compatibilityLevel: 'full' | 'partial' | 'incompatible';
}

export interface VersionMetadata {
  totalVersions: number;
  activeVersions: number;
  deprecatedVersions: number;
  sunsetVersions: number;
  discontinuedVersions: number;
  latestStableVersion: string | null;
  latestVersion: string | null;
}

export interface VersionChangeLog {
  id: string;
  version: string;
  changes: VersionChange[];
  releaseDate: Date;
  isBreaking: boolean;
}

export interface VersionChange {
  id: string;
  type: 'added' | 'changed' | 'deprecated' | 'removed' | 'fixed' | 'security';
  description: string;
  affectedEndpoints?: string[];
}

export interface VersionHealth {
  version: string;
  requestPercentage: number;
  errorRate: number;
  avgResponseTime: number;
  isHealthy: boolean;
  issues: string[];
}

export interface VersionDeprecationPolicy {
  gracePeriodDays: number;
  sunsetPeriodDays: number;
  notificationIntervals: number[];
  enableAutoMigration: boolean;
}

export interface VersionNegotiationOptions {
  clientVersion?: string;
  acceptHeader?: string;
  queryVersion?: string;
  pathVersion?: string;
  strictMatching: boolean;
  includeDeprecationNotices: boolean;
}

import * as crypto from 'crypto';
import {
  APIVersion,
  BreakingChange,
  VersionNegotiation,
  DeprecationNotice,
  VersionRoute,
  VersionConfig,
  DeprecationSchedule,
  VersionCompatibility,
  VersionMetadata,
  VersionChangeLog,
  VersionHealth,
  VersionDeprecationPolicy,
  VersionNegotiationOptions,
  VersionFormat,
  DeprecationLifecycle,
  VersioningStrategy,
  VersionChange,
} from './types';

const generateId = (prefix: string): string => {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
};

export class APIVersioning {
  private versions: Map<string, APIVersion> = new Map();
  private routes: Map<string, VersionRoute> = new Map();
  private deprecationSchedules: Map<string, DeprecationSchedule> = new Map();
  private config: VersionConfig;
  private deprecationPolicy: VersionDeprecationPolicy;

  constructor(config: Partial<VersionConfig> = {}) {
    this.config = {
      defaultVersion: config.defaultVersion || 'v1',
      supportedVersions: config.supportedVersions || ['v1', 'v2'],
      versioningStrategy: config.versioningStrategy || 'path',
      enableDeprecationNotices: config.enableDeprecationNotices ?? true,
      enableVersionFallback: config.enableVersionFallback ?? true,
      headerName: config.headerName || 'X-API-Version',
      queryParamName: config.queryParamName || 'version',
    };

    this.deprecationPolicy = {
      gracePeriodDays: 90,
      sunsetPeriodDays: 180,
      notificationIntervals: [30, 14, 7, 1],
      enableAutoMigration: false,
    };

    this.initializeDefaultVersions();
  }

  private initializeDefaultVersions(): void {
    this.createVersion({
      version: 'v1',
      format: 'v1',
      major: 1,
      isStable: true,
      isDeprecated: false,
      deprecationLifecycle: 'active',
      breakingChanges: [],
      supportedPeriod: {
        start: new Date('2024-01-01'),
      },
    });

    this.createVersion({
      version: 'v2',
      format: 'v2',
      major: 2,
      isStable: true,
      isDeprecated: false,
      deprecationLifecycle: 'active',
      breakingChanges: [],
      supportedPeriod: {
        start: new Date('2024-06-01'),
      },
    });
  }

  createVersion(data: {
    version: string;
    format: VersionFormat;
    major: number;
    minor?: number;
    date?: string;
    isStable: boolean;
    isDeprecated: boolean;
    deprecationLifecycle: DeprecationLifecycle;
    breakingChanges: Omit<BreakingChange, 'id'>[];
    supportedPeriod: { start: Date; end?: Date };
    documentation?: string;
    changelog?: string;
    sunsetDate?: Date;
    discontinuationDate?: Date;
  }): APIVersion {
    const versionId = generateId('ver');
    const breakingChangesWithIds: BreakingChange[] = data.breakingChanges.map((bc) => ({
      ...bc,
      id: generateId('bc'),
    }));

    const apiVersion: APIVersion = {
      id: versionId,
      version: data.version,
      format: data.format,
      major: data.major,
      minor: data.minor,
      date: data.date,
      isStable: data.isStable,
      isDeprecated: data.isDeprecated,
      deprecationLifecycle: data.deprecationLifecycle,
      sunsetDate: data.sunsetDate,
      discontinuationDate: data.discontinuationDate,
      breakingChanges: breakingChangesWithIds,
      supportedPeriod: data.supportedPeriod,
      documentation: data.documentation,
      changelog: data.changelog,
    };

    this.versions.set(data.version, apiVersion);
    return apiVersion;
  }

  getVersion(version: string): APIVersion | undefined {
    return this.versions.get(version);
  }

  getAllVersions(): APIVersion[] {
    return Array.from(this.versions.values());
  }

  getVersionsByStatus(status: DeprecationLifecycle): APIVersion[] {
    return this.getAllVersions().filter((v) => v.deprecationLifecycle === status);
  }

  updateVersion(version: string, updates: Partial<APIVersion>): APIVersion | null {
    const existing = this.versions.get(version);
    if (!existing) return null;

    const updated: APIVersion = {
      ...existing,
      ...updates,
      id: existing.id,
    };
    this.versions.set(version, updated);
    return updated;
  }

  deprecateVersion(
    version: string,
    deprecationLifecycle: DeprecationLifecycle,
    sunsetDate?: Date,
    discontinuationDate?: Date
  ): APIVersion | null {
    const apiVersion = this.versions.get(version);
    if (!apiVersion) return null;

    const deprecationNotice = this.generateDeprecationNotice(apiVersion, {
      sunsetDate,
      discontinuationDate,
    });

    apiVersion.isDeprecated = true;
    apiVersion.deprecationLifecycle = deprecationLifecycle;
    apiVersion.sunsetDate = sunsetDate || apiVersion.sunsetDate;
    apiVersion.discontinuationDate = discontinuationDate || apiVersion.discontinuationDate;

    this.deprecationSchedules.set(version, {
      version,
      deprecationDate: new Date(),
      sunsetDate,
      discontinuationDate,
      notice: deprecationNotice,
    });

    return apiVersion;
  }

  private generateDeprecationNotice(
    apiVersion: APIVersion,
    _options: { sunsetDate?: Date; discontinuationDate?: Date }
  ): DeprecationNotice {
    const urgency = this.calculateUrgency(apiVersion);
    return {
      id: generateId('depn'),
      version: apiVersion.version,
      message: `API version ${apiVersion.version} is deprecated. Please migrate to a supported version.`,
      sunsetDate: apiVersion.sunsetDate,
      discontinuationDate: apiVersion.discontinuationDate,
      alternatives: this.getAlternativeVersions(apiVersion),
      migrationGuide: this.generateMigrationGuide(apiVersion),
      urgency,
    };
  }

  private calculateUrgency(apiVersion: APIVersion): 'low' | 'medium' | 'high' | 'critical' {
    if (!apiVersion.sunsetDate) return 'low';
    const daysUntilSunset = Math.ceil(
      (apiVersion.sunsetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilSunset <= 7) return 'critical';
    if (daysUntilSunset <= 30) return 'high';
    if (daysUntilSunset <= 90) return 'medium';
    return 'low';
  }

  private getAlternativeVersions(currentVersion: APIVersion): string[] {
    return this.getAllVersions()
      .filter((v) => v.major > currentVersion.major && v.deprecationLifecycle !== 'discontinued')
      .map((v) => v.version);
  }

  private generateMigrationGuide(_apiVersion: APIVersion): string {
    return 'Please refer to the migration guide at /docs/migration for detailed instructions.';
  }

  registerRoute(route: Omit<VersionRoute, 'id'>): VersionRoute {
    const routeId = generateId('route');
    const fullRoute: VersionRoute = {
      ...route,
      id: routeId,
    };
    this.routes.set(`${route.method}:${route.path}:${route.version}`, fullRoute);
    return fullRoute;
  }

  getRoute(path: string, method: string, version: string): VersionRoute | undefined {
    return this.routes.get(`${method}:${path}:${version}`);
  }

  getRoutesForVersion(version: string): VersionRoute[] {
    return Array.from(this.routes.values()).filter((r) => r.version === version);
  }

  negotiateVersion(options: VersionNegotiationOptions): VersionNegotiation {
    const requestedVersion = this.extractVersion(options);
    const matchedVersion = this.findMatchingVersion(requestedVersion);

    let fallbackVersion: APIVersion | undefined;
    let isCompatible = false;

    if (!matchedVersion && this.config.enableVersionFallback) {
      fallbackVersion = this.versions.get(this.config.defaultVersion) || undefined;
      isCompatible = fallbackVersion !== undefined;
    } else if (matchedVersion) {
      isCompatible = true;
    }

    const deprecationNotice = matchedVersion?.isDeprecated
      ? this.generateDeprecationNotice(matchedVersion, {})
      : undefined;

    return {
      requestedVersion: requestedVersion || 'unspecified',
      matchedVersion: matchedVersion || null,
      negotiationStrategy: this.config.versioningStrategy,
      fallbackVersion,
      deprecationNotice,
      isCompatible,
    };
  }

  private extractVersion(options: VersionNegotiationOptions): string | null {
    switch (this.config.versioningStrategy) {
      case 'path':
        if (options.pathVersion) return options.pathVersion;
        break;
      case 'header':
        if (options.acceptHeader) {
          return this.parseAcceptHeader(options.acceptHeader);
        }
        if (options.clientVersion) return options.clientVersion;
        break;
      case 'query':
        if (options.queryVersion) return options.queryVersion;
        break;
    }
    return null;
  }

  private parseAcceptHeader(_acceptHeader: string): string | null {
    const match = _acceptHeader.match(/version=(\d+|v\d+)/);
    return match ? match[1] : null;
  }

  private findMatchingVersion(requestedVersion: string | null): APIVersion | undefined {
    if (!requestedVersion) return undefined;
    return this.versions.get(requestedVersion);
  }

  checkCompatibility(fromVersion: string, toVersion: string): VersionCompatibility {
    const from = this.versions.get(fromVersion);
    const to = this.versions.get(toVersion);

    if (!from || !to) {
      return {
        fromVersion,
        toVersion,
        isCompatible: false,
        breakingChanges: [],
        compatibilityLevel: 'incompatible',
      };
    }

    const breakingChanges = to.breakingChanges.filter(
      (bc) => bc.type === 'breaking' && bc.affectedEndpoints
    );

    let compatibilityLevel: 'full' | 'partial' | 'incompatible';
    if (breakingChanges.length === 0) {
      compatibilityLevel = 'full';
    } else if (breakingChanges.length <= 2) {
      compatibilityLevel = 'partial';
    } else {
      compatibilityLevel = 'incompatible';
    }

    return {
      fromVersion,
      toVersion,
      isCompatible: compatibilityLevel !== 'incompatible',
      breakingChanges,
      compatibilityLevel,
    };
  }

  getMetadata(): VersionMetadata {
    const versions = this.getAllVersions();
    const active = versions.filter((v) => v.deprecationLifecycle === 'active');
    const deprecated = versions.filter((v) => v.deprecationLifecycle === 'deprecated');
    const sunset = versions.filter((v) => v.deprecationLifecycle === 'sunset');
    const discontinued = versions.filter((v) => v.deprecationLifecycle === 'discontinued');

    const stableVersions = versions.filter((v) => v.isStable);
    const latestStable = stableVersions.sort((a, b) => b.major - a.major)[0];
    const latest = versions.sort((a, b) => b.major - a.major)[0];

    return {
      totalVersions: versions.length,
      activeVersions: active.length,
      deprecatedVersions: deprecated.length,
      sunsetVersions: sunset.length,
      discontinuedVersions: discontinued.length,
      latestStableVersion: latestStable?.version || null,
      latestVersion: latest?.version || null,
    };
  }

  addBreakingChange(version: string, breakingChange: Omit<BreakingChange, 'id'>): BreakingChange | null {
    const apiVersion = this.versions.get(version);
    if (!apiVersion) return null;

    const newBreakingChange: BreakingChange = {
      ...breakingChange,
      id: generateId('bc'),
    };

    apiVersion.breakingChanges.push(newBreakingChange);
    return newBreakingChange;
  }

  getBreakingChanges(version: string): BreakingChange[] {
    const apiVersion = this.versions.get(version);
    return apiVersion?.breakingChanges || [];
  }

  getDeprecationSchedule(version: string): DeprecationSchedule | undefined {
    return this.deprecationSchedules.get(version);
  }

  getActiveDeprecations(): DeprecationSchedule[] {
    return Array.from(this.deprecationSchedules.values()).filter(
      (schedule) => schedule.version !== 'discontinued'
    );
  }

  createChangeLog(version: string, changes: Omit<VersionChange, 'id'>[]): VersionChangeLog | null {
    const apiVersion = this.versions.get(version);
    if (!apiVersion) return null;

    const versionChanges: VersionChange[] = changes.map((c) => ({
      ...c,
      id: generateId('chg'),
    }));

    return {
      id: generateId('clog'),
      version,
      changes: versionChanges,
      releaseDate: apiVersion.supportedPeriod.start,
      isBreaking: apiVersion.breakingChanges.length > 0,
    };
  }

  setDeprecationPolicy(policy: Partial<VersionDeprecationPolicy>): void {
    this.deprecationPolicy = {
      ...this.deprecationPolicy,
      ...policy,
    };
  }

  getDeprecationPolicy(): VersionDeprecationPolicy {
    return { ...this.deprecationPolicy };
  }

  getVersionHealth(version: string): VersionHealth | null {
    const apiVersion = this.versions.get(version);
    if (!apiVersion) return null;

    const isHealthy = apiVersion.deprecationLifecycle === 'active' ||
                      apiVersion.deprecationLifecycle === 'deprecated';

    const issues: string[] = [];
    if (apiVersion.isDeprecated) {
      issues.push(`Version ${version} is deprecated`);
    }
    if (apiVersion.sunsetDate && apiVersion.sunsetDate < new Date()) {
      issues.push(`Version ${version} has passed its sunset date`);
    }
    if (apiVersion.discontinuationDate && apiVersion.discontinuationDate < new Date()) {
      issues.push(`Version ${version} has been discontinued`);
    }

    return {
      version,
      requestPercentage: this.calculateRequestPercentage(version),
      errorRate: 0.01,
      avgResponseTime: 150,
      isHealthy,
      issues,
    };
  }

  private calculateRequestPercentage(_version: string): number {
    return 0;
  }

  removeVersion(version: string): boolean {
    return this.versions.delete(version);
  }

  getConfig(): VersionConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<VersionConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

export const createAPIVersioning = (config?: Partial<VersionConfig>): APIVersioning => {
  return new APIVersioning(config);
};

export const parseVersionString = (versionString: string): {
  major: number;
  minor?: number;
  date?: string;
  format: VersionFormat;
} | null => {
  const vMatch = versionString.match(/^v(\d+)(?:\.(\d+))?$/);
  if (vMatch) {
    return {
      major: parseInt(vMatch[1], 10),
      minor: vMatch[2] ? parseInt(vMatch[2], 10) : undefined,
      format: `v${vMatch[1]}` as VersionFormat,
    };
  }

  const dateMatch = versionString.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateMatch) {
    return {
      major: 0,
      date: dateMatch[1],
      format: '2024-01-01',
    };
  }

  return null;
};

export const compareVersions = (v1: string, v2: string): number => {
  const parsed1 = parseVersionString(v1);
  const parsed2 = parseVersionString(v2);

  if (!parsed1 || !parsed2) return 0;

  if (parsed1.major !== parsed2.major) {
    return parsed1.major - parsed2.major;
  }

  if (parsed1.minor !== undefined && parsed2.minor !== undefined) {
    return parsed1.minor - parsed2.minor;
  }

  return 0;
};

export const isVersionCompatible = (
  requestedVersion: string,
  supportedVersions: string[],
  strategy: VersioningStrategy
): boolean => {
  if (strategy === 'path') {
    return supportedVersions.some((sv) => requestedVersion.includes(sv));
  }
  if (strategy === 'header' || strategy === 'query') {
    return supportedVersions.includes(requestedVersion);
  }
  return false;
};

export const extractVersionFromPath = (path: string): string | null => {
  const match = path.match(/\/v(\d+)\//);
  return match ? `v${match[1]}` : null;
};

export const extractVersionFromQuery = (
  query: Record<string, unknown>,
  paramName: string
): string | null => {
  const version = query[paramName];
  return typeof version === 'string' ? version : null;
};

export const extractVersionFromHeader = (
  headers: Record<string, string>,
  headerName: string
): string | null => {
  const value = headers[headerName.toLowerCase()];
  return typeof value === 'string' ? value : null;
};

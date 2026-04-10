import {
  APIVersioning,
  createAPIVersioning,
  parseVersionString,
  compareVersions,
  isVersionCompatible,
  extractVersionFromPath,
  extractVersionFromQuery,
  extractVersionFromHeader,
  APIVersion,
  BreakingChange,
  VersionNegotiation,
  DeprecationNotice,
  VersionRoute,
  VersionConfig,
  VersionMetadata,
  VersionCompatibility,
  VersionChangeLog,
  VersionHealth,
} from '../src/core/apiVersioning';

describe('API Versioning Module', () => {
  let apiVersioning: APIVersioning;

  beforeEach(() => {
    apiVersioning = new APIVersioning({
      defaultVersion: 'v1',
      supportedVersions: ['v1', 'v2'],
      versioningStrategy: 'path',
      enableDeprecationNotices: true,
      enableVersionFallback: true,
    });
  });

  describe('APIVersioning class', () => {
    describe('createVersion', () => {
      it('should create a new API version with all required fields', () => {
        const version = apiVersioning.createVersion({
          version: 'v3',
          format: 'v1',
          major: 3,
          isStable: false,
          isDeprecated: false,
          deprecationLifecycle: 'active',
          breakingChanges: [],
          supportedPeriod: { start: new Date('2024-12-01') },
        });

        expect(version).toBeDefined();
        expect(version.version).toBe('v3');
        expect(version.major).toBe(3);
        expect(version.isStable).toBe(false);
        expect(version.deprecationLifecycle).toBe('active');
        expect(version.id).toMatch(/^ver_/);
      });

      it('should create version with breaking changes', () => {
        const version = apiVersioning.createVersion({
          version: 'v4',
          format: 'v1',
          major: 4,
          isStable: true,
          isDeprecated: false,
          deprecationLifecycle: 'active',
          breakingChanges: [
            {
              type: 'breaking',
              description: 'Removed legacy endpoint',
              severity: 'high',
            },
          ],
          supportedPeriod: { start: new Date('2025-01-01') },
        });

        expect(version.breakingChanges).toHaveLength(1);
        expect(version.breakingChanges[0].type).toBe('breaking');
        expect(version.breakingChanges[0].severity).toBe('high');
      });

      it('should create version with date format', () => {
        const version = apiVersioning.createVersion({
          version: '2025-01-01',
          format: '2024-01-01',
          major: 0,
          date: '2025-01-01',
          isStable: true,
          isDeprecated: false,
          deprecationLifecycle: 'active',
          breakingChanges: [],
          supportedPeriod: { start: new Date('2025-01-01') },
        });

        expect(version.format).toBe('2024-01-01');
        expect(version.date).toBe('2025-01-01');
      });

      it('should create version with documentation and changelog', () => {
        const version = apiVersioning.createVersion({
          version: 'v5',
          format: 'v1',
          major: 5,
          isStable: true,
          isDeprecated: false,
          deprecationLifecycle: 'active',
          breakingChanges: [],
          supportedPeriod: { start: new Date('2025-06-01') },
          documentation: '/docs/v5',
          changelog: 'Added new features',
        });

        expect(version.documentation).toBe('/docs/v5');
        expect(version.changelog).toBe('Added new features');
      });
    });

    describe('getVersion', () => {
      it('should retrieve an existing version', () => {
        const created = apiVersioning.createVersion({
          version: 'v10',
          format: 'v1',
          major: 10,
          isStable: true,
          isDeprecated: false,
          deprecationLifecycle: 'active',
          breakingChanges: [],
          supportedPeriod: { start: new Date() },
        });

        const retrieved = apiVersioning.getVersion('v10');
        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(created.id);
      });

      it('should return undefined for non-existent version', () => {
        const result = apiVersioning.getVersion('non-existent');
        expect(result).toBeUndefined();
      });
    });

    describe('getAllVersions', () => {
      it('should return all registered versions', () => {
        apiVersioning.createVersion({
          version: 'v20',
          format: 'v1',
          major: 20,
          isStable: true,
          isDeprecated: false,
          deprecationLifecycle: 'active',
          breakingChanges: [],
          supportedPeriod: { start: new Date() },
        });

        const versions = apiVersioning.getAllVersions();
        expect(versions.length).toBeGreaterThanOrEqual(3);
      });

      it('should include default versions', () => {
        const versions = apiVersioning.getAllVersions();
        const versionStrings = versions.map((v) => v.version);
        expect(versionStrings).toContain('v1');
        expect(versionStrings).toContain('v2');
      });
    });

    describe('getVersionsByStatus', () => {
      it('should filter versions by deprecation lifecycle', () => {
        apiVersioning.createVersion({
          version: 'v30',
          format: 'v1',
          major: 30,
          isStable: true,
          isDeprecated: false,
          deprecationLifecycle: 'active',
          breakingChanges: [],
          supportedPeriod: { start: new Date() },
        });

        const deprecated = apiVersioning.deprecateVersion('v30', 'deprecated', new Date('2025-12-01'));
        const result = apiVersioning.getVersionsByStatus('deprecated');

        expect(result).toHaveLength(1);
        expect(result[0].version).toBe('v30');
      });

      it('should return empty array for non-existent status', () => {
        const result = apiVersioning.getVersionsByStatus('discontinued');
        expect(result).toHaveLength(0);
      });
    });

    describe('updateVersion', () => {
      it('should update version properties', () => {
        const updated = apiVersioning.updateVersion('v1', {
          isStable: false,
        });

        expect(updated).toBeDefined();
        expect(updated?.isStable).toBe(false);
        expect(updated?.version).toBe('v1');
      });

      it('should return null for non-existent version', () => {
        const result = apiVersioning.updateVersion('non-existent', { isStable: false });
        expect(result).toBeNull();
      });
    });

    describe('deprecateVersion', () => {
      it('should mark version as deprecated with sunset date', () => {
        const sunsetDate = new Date('2025-12-01');
        const deprecated = apiVersioning.deprecateVersion('v2', 'deprecated', sunsetDate);

        expect(deprecated).toBeDefined();
        expect(deprecated?.isDeprecated).toBe(true);
        expect(deprecated?.deprecationLifecycle).toBe('deprecated');
        expect(deprecated?.sunsetDate).toEqual(sunsetDate);
      });

      it('should create deprecation schedule', () => {
        const sunsetDate = new Date('2025-12-01');
        apiVersioning.deprecateVersion('v1', 'deprecated', sunsetDate);

        const schedule = apiVersioning.getDeprecationSchedule('v1');
        expect(schedule).toBeDefined();
        expect(schedule?.version).toBe('v1');
        expect(schedule?.sunsetDate).toEqual(sunsetDate);
      });

      it('should set discontinuation date when provided', () => {
        const discontinuationDate = new Date('2026-06-01');
        const deprecated = apiVersioning.deprecateVersion('v2', 'sunset', undefined, discontinuationDate);

        expect(deprecated?.discontinuationDate).toEqual(discontinuationDate);
      });
    });

    describe('registerRoute', () => {
      it('should register a new route', () => {
        const route = apiVersioning.registerRoute({
          path: '/api/users',
          method: 'GET',
          version: 'v1',
          handler: 'UserController.getAll',
        });

        expect(route).toBeDefined();
        expect(route.id).toMatch(/^route_/);
        expect(route.path).toBe('/api/users');
        expect(route.method).toBe('GET');
      });

      it('should register route with middleware', () => {
        const route = apiVersioning.registerRoute({
          path: '/api/orders',
          method: 'POST',
          version: 'v2',
          handler: 'OrderController.create',
          middleware: ['auth', 'validation'],
        });

        expect(route.middleware).toEqual(['auth', 'validation']);
      });

      it('should register route with rate limit', () => {
        const route = apiVersioning.registerRoute({
          path: '/api/products',
          method: 'GET',
          version: 'v1',
          handler: 'ProductController.getAll',
          rateLimit: { requests: 100, windowMs: 60000 },
        });

        expect(route.rateLimit).toEqual({ requests: 100, windowMs: 60000 });
      });
    });

    describe('getRoute', () => {
      it('should retrieve a registered route', () => {
        apiVersioning.registerRoute({
          path: '/api/users',
          method: 'GET',
          version: 'v1',
          handler: 'UserController.getAll',
        });

        const route = apiVersioning.getRoute('/api/users', 'GET', 'v1');
        expect(route).toBeDefined();
        expect(route?.handler).toBe('UserController.getAll');
      });

      it('should return undefined for non-existent route', () => {
        const route = apiVersioning.getRoute('/non-existent', 'GET', 'v1');
        expect(route).toBeUndefined();
      });
    });

    describe('getRoutesForVersion', () => {
      it('should return all routes for a specific version', () => {
        apiVersioning.registerRoute({
          path: '/api/users',
          method: 'GET',
          version: 'v1',
          handler: 'UserController.getAll',
        });
        apiVersioning.registerRoute({
          path: '/api/users/:id',
          method: 'GET',
          version: 'v1',
          handler: 'UserController.getById',
        });
        apiVersioning.registerRoute({
          path: '/api/users',
          method: 'POST',
          version: 'v2',
          handler: 'UserController.create',
        });

        const routes = apiVersioning.getRoutesForVersion('v1');
        expect(routes).toHaveLength(2);
      });
    });

    describe('negotiateVersion', () => {
      it('should negotiate version using path strategy', () => {
        const negotiation = apiVersioning.negotiateVersion({
          pathVersion: 'v1',
          strictMatching: true,
          includeDeprecationNotices: true,
        });

        expect(negotiation.matchedVersion).toBeDefined();
        expect(negotiation.matchedVersion?.version).toBe('v1');
        expect(negotiation.isCompatible).toBe(true);
      });

      it('should negotiate version using query strategy', () => {
        const versioning = new APIVersioning({ versioningStrategy: 'query' });
        const negotiation = versioning.negotiateVersion({
          queryVersion: 'v2',
          strictMatching: false,
          includeDeprecationNotices: false,
        });

        expect(negotiation.matchedVersion?.version).toBe('v2');
      });

      it('should negotiate version using header strategy', () => {
        const versioning = new APIVersioning({ versioningStrategy: 'header' });
        const negotiation = versioning.negotiateVersion({
          clientVersion: 'v1',
          strictMatching: false,
          includeDeprecationNotices: false,
        });

        expect(negotiation.matchedVersion?.version).toBe('v1');
      });

      it('should fallback to default version when not found', () => {
        const negotiation = apiVersioning.negotiateVersion({
          pathVersion: 'non-existent',
          strictMatching: false,
          includeDeprecationNotices: false,
        });

        expect(negotiation.isCompatible).toBe(true);
        expect(negotiation.fallbackVersion?.version).toBe('v1');
      });

      it('should include deprecation notice for deprecated version', () => {
        apiVersioning.deprecateVersion('v2', 'deprecated', new Date('2025-12-01'));
        const negotiation = apiVersioning.negotiateVersion({
          pathVersion: 'v2',
          strictMatching: false,
          includeDeprecationNotices: true,
        });

        expect(negotiation.deprecationNotice).toBeDefined();
        expect(negotiation.deprecationNotice?.version).toBe('v2');
      });
    });

    describe('checkCompatibility', () => {
      it('should return full compatibility when no breaking changes', () => {
        const compatibility = apiVersioning.checkCompatibility('v1', 'v2');

        expect(compatibility.isCompatible).toBe(true);
        expect(compatibility.compatibilityLevel).toBe('full');
      });

      it('should return partial compatibility with breaking changes', () => {
        apiVersioning.createVersion({
          version: 'v100',
          format: 'v1',
          major: 100,
          isStable: true,
          isDeprecated: false,
          deprecationLifecycle: 'active',
          breakingChanges: [
            { type: 'breaking', description: 'test', severity: 'low', affectedEndpoints: ['/api/test'] },
            { type: 'breaking', description: 'test2', severity: 'medium', affectedEndpoints: ['/api/test2'] },
          ],
          supportedPeriod: { start: new Date() },
        });

        const compatibility = apiVersioning.checkCompatibility('v1', 'v100');
        expect(compatibility.isCompatible).toBe(true);
        expect(compatibility.compatibilityLevel).toBe('partial');
      });

      it('should return incompatible for non-existent versions', () => {
        const compatibility = apiVersioning.checkCompatibility('non-existent', 'v1');
        expect(compatibility.isCompatible).toBe(false);
        expect(compatibility.compatibilityLevel).toBe('incompatible');
      });
    });

    describe('getMetadata', () => {
      it('should return correct version metadata', () => {
        const metadata = apiVersioning.getMetadata();

        expect(metadata.totalVersions).toBeGreaterThanOrEqual(2);
        expect(metadata.activeVersions).toBeGreaterThanOrEqual(2);
        expect(metadata.latestStableVersion).toBe('v2');
        expect(metadata.latestVersion).toBe('v2');
      });

      it('should count deprecated versions correctly', () => {
        apiVersioning.deprecateVersion('v2', 'deprecated', new Date('2025-12-01'));
        const metadata = apiVersioning.getMetadata();

        expect(metadata.deprecatedVersions).toBe(1);
      });
    });

    describe('addBreakingChange', () => {
      it('should add breaking change to version', () => {
        const breakingChange = apiVersioning.addBreakingChange('v1', {
          type: 'breaking',
          description: 'Removed legacy endpoint',
          severity: 'critical',
          affectedEndpoints: ['/api/legacy'],
        });

        expect(breakingChange).toBeDefined();
        expect(breakingChange?.id).toMatch(/^bc_/);
        expect(breakingChange?.severity).toBe('critical');
      });

      it('should return null for non-existent version', () => {
        const result = apiVersioning.addBreakingChange('non-existent', {
          type: 'breaking',
          description: 'test',
          severity: 'low',
        });
        expect(result).toBeNull();
      });
    });

    describe('getBreakingChanges', () => {
      it('should return breaking changes for version', () => {
        apiVersioning.addBreakingChange('v1', {
          type: 'breaking',
          description: 'test',
          severity: 'high',
        });

        const changes = apiVersioning.getBreakingChanges('v1');
        expect(changes.length).toBeGreaterThan(0);
      });
    });

    describe('createChangeLog', () => {
      it('should create a changelog entry', () => {
        const changelog = apiVersioning.createChangeLog('v1', [
          { type: 'added', description: 'New endpoint added' },
          { type: 'changed', description: 'Updated response format' },
        ]);

        expect(changelog).toBeDefined();
        expect(changelog?.id).toMatch(/^clog_/);
        expect(changelog?.changes).toHaveLength(2);
        expect(changelog?.isBreaking).toBe(false);
      });

      it('should mark changelog as breaking when breaking changes exist', () => {
        apiVersioning.addBreakingChange('v2', {
          type: 'breaking',
          description: 'test',
          severity: 'high',
        });

        const changelog = apiVersioning.createChangeLog('v2', [
          { type: 'removed', description: 'Removed endpoint' },
        ]);

        expect(changelog?.isBreaking).toBe(true);
      });

      it('should return null for non-existent version', () => {
        const result = apiVersioning.createChangeLog('non-existent', []);
        expect(result).toBeNull();
      });
    });

    describe('getVersionHealth', () => {
      it('should return health status for active version', () => {
        const health = apiVersioning.getVersionHealth('v1');

        expect(health).toBeDefined();
        expect(health?.isHealthy).toBe(true);
        expect(health?.version).toBe('v1');
      });

      it('should return issues for deprecated version', () => {
        apiVersioning.deprecateVersion('v2', 'deprecated', new Date('2025-12-01'));
        const health = apiVersioning.getVersionHealth('v2');

        expect(health?.issues.length).toBeGreaterThan(0);
        expect(health?.issues[0]).toContain('deprecated');
      });

      it('should return null for non-existent version', () => {
        const health = apiVersioning.getVersionHealth('non-existent');
        expect(health).toBeNull();
      });
    });

    describe('getActiveDeprecations', () => {
      it('should return all active deprecations', () => {
        apiVersioning.deprecateVersion('v1', 'deprecated', new Date('2025-12-01'));
        const deprecations = apiVersioning.getActiveDeprecations();

        expect(deprecations.length).toBe(1);
      });
    });

    describe('removeVersion', () => {
      it('should remove an existing version', () => {
        const result = apiVersioning.removeVersion('v1');
        expect(result).toBe(true);
        expect(apiVersioning.getVersion('v1')).toBeUndefined();
      });

      it('should return false for non-existent version', () => {
        const result = apiVersioning.removeVersion('non-existent');
        expect(result).toBe(false);
      });
    });

    describe('getConfig and setConfig', () => {
      it('should return current configuration', () => {
        const config = apiVersioning.getConfig();

        expect(config.defaultVersion).toBe('v1');
        expect(config.versioningStrategy).toBe('path');
        expect(config.enableDeprecationNotices).toBe(true);
      });

      it('should update configuration', () => {
        apiVersioning.setConfig({ defaultVersion: 'v2', versioningStrategy: 'header' });
        const config = apiVersioning.getConfig();

        expect(config.defaultVersion).toBe('v2');
        expect(config.versioningStrategy).toBe('header');
      });
    });
  });

  describe('Utility functions', () => {
    describe('parseVersionString', () => {
      it('should parse v1 format', () => {
        const result = parseVersionString('v1');
        expect(result).toEqual({ major: 1, format: 'v1' });
      });

      it('should parse v2.5 format', () => {
        const result = parseVersionString('v2.5');
        expect(result).toEqual({ major: 2, minor: 5, format: 'v2' });
      });

      it('should parse date format', () => {
        const result = parseVersionString('2024-06-15');
        expect(result).toEqual({ major: 0, date: '2024-06-15', format: '2024-01-01' });
      });

      it('should return null for invalid format', () => {
        const result = parseVersionString('invalid');
        expect(result).toBeNull();
      });
    });

    describe('compareVersions', () => {
      it('should compare major versions correctly', () => {
        expect(compareVersions('v1', 'v2')).toBeLessThan(0);
        expect(compareVersions('v2', 'v1')).toBeGreaterThan(0);
        expect(compareVersions('v1', 'v1')).toBe(0);
      });

      it('should compare minor versions correctly', () => {
        expect(compareVersions('v1.0', 'v1.1')).toBeLessThan(0);
        expect(compareVersions('v1.5', 'v1.3')).toBeGreaterThan(0);
      });
    });

    describe('isVersionCompatible', () => {
      it('should check path strategy compatibility', () => {
        expect(isVersionCompatible('v1', ['v1', 'v2'], 'path')).toBe(true);
        expect(isVersionCompatible('v3', ['v1', 'v2'], 'path')).toBe(false);
      });

      it('should check header strategy compatibility', () => {
        expect(isVersionCompatible('v1', ['v1', 'v2'], 'header')).toBe(true);
        expect(isVersionCompatible('v3', ['v1', 'v2'], 'header')).toBe(false);
      });

      it('should check query strategy compatibility', () => {
        expect(isVersionCompatible('v2', ['v1', 'v2'], 'query')).toBe(true);
        expect(isVersionCompatible('v3', ['v1', 'v2'], 'query')).toBe(false);
      });
    });

    describe('extractVersionFromPath', () => {
      it('should extract version from path', () => {
        expect(extractVersionFromPath('/api/v1/users')).toBe('v1');
        expect(extractVersionFromPath('/api/v2/products')).toBe('v2');
      });

      it('should return null when no version in path', () => {
        expect(extractVersionFromPath('/api/users')).toBeNull();
      });
    });

    describe('extractVersionFromQuery', () => {
      it('should extract version from query params', () => {
        expect(extractVersionFromQuery({ version: 'v1' }, 'version')).toBe('v1');
        expect(extractVersionFromQuery({ v: 'v2' }, 'v')).toBe('v2');
      });

      it('should return null when version not in query', () => {
        expect(extractVersionFromQuery({ other: 'value' }, 'version')).toBeNull();
      });
    });

    describe('extractVersionFromHeader', () => {
      it('should extract version from headers', () => {
        expect(extractVersionFromHeader({ 'x-api-version': 'v1' }, 'X-API-Version')).toBe('v1');
      });

      it('should return null when header not present', () => {
        expect(extractVersionFromHeader({}, 'X-API-Version')).toBeNull();
      });
    });
  });

  describe('createAPIVersioning factory', () => {
    it('should create APIVersioning instance with custom config', () => {
      const instance = createAPIVersioning({
        defaultVersion: 'v3',
        supportedVersions: ['v3', 'v4'],
        versioningStrategy: 'header',
      });

      const config = instance.getConfig();
      expect(config.defaultVersion).toBe('v3');
      expect(config.versioningStrategy).toBe('header');
    });

    it('should create APIVersioning instance with default config', () => {
      const instance = createAPIVersioning();
      const config = instance.getConfig();

      expect(config.defaultVersion).toBe('v1');
      expect(config.supportedVersions).toEqual(['v1', 'v2']);
    });
  });
});

import {
  EnvironmentType,
  ConfigScope,
  SettingDefinition,
  AppSetting,
  TenantConfig,
  UserConfig,
  JsonValue,
  ValidationError,
  ValidationRule,
  SettingChangeEvent,
  SettingChangeListener,
  ConfigExportOptions,
  ConfigImportResult,
  createSettingId,
  isValidEnvironment,
  validatePattern,
  validateRange,
  validateMin,
  validateMax,
  validateEnum,
} from './types';

export class AppSettingsEngine {
  private definitions: Map<string, SettingDefinition> = new Map();
  private globalSettings: Map<string, AppSetting> = new Map();
  private tenantConfigs: Map<string, TenantConfig> = new Map();
  private userConfigs: Map<string, UserConfig> = new Map();
  private listeners: Set<SettingChangeListener> = new Set();
  private currentEnvironment: EnvironmentType = 'development';

  constructor(definitions?: SettingDefinition[]) {
    if (definitions) {
      for (const def of definitions) {
        this.registerSettingDefinition(def);
      }
    }
  }

  registerSettingDefinition(definition: SettingDefinition): SettingDefinition {
    if (this.definitions.has(definition.key)) {
      throw new Error(`Setting definition with key "${definition.key}" already exists`);
    }
    this.definitions.set(definition.key, definition);
    return definition;
  }

  updateSettingDefinition(key: string, updates: Partial<Omit<SettingDefinition, 'key'>>): SettingDefinition | null {
    const existing = this.definitions.get(key);
    if (!existing) return null;

    const updated: SettingDefinition = { ...existing, ...updates };
    this.definitions.set(key, updated);
    return updated;
  }

  removeSettingDefinition(key: string): boolean {
    return this.definitions.delete(key);
  }

  getSettingDefinition(key: string): SettingDefinition | undefined {
    return this.definitions.get(key);
  }

  getAllSettingDefinitions(): SettingDefinition[] {
    return Array.from(this.definitions.values());
  }

  getSettingDefinitionsByCategory(category: string): SettingDefinition[] {
    return Array.from(this.definitions.values()).filter((d) => d.category === category);
  }

  createSetting(
    key: string,
    value: string | number | boolean | JsonValue,
    scope: ConfigScope,
    options?: {
      scopeId?: string;
      environment?: EnvironmentType;
      validate?: boolean;
    }
  ): AppSetting | ValidationError[] {
    const definition = this.definitions.get(key);
    const environment = options?.environment ?? this.currentEnvironment;

    if (options?.validate !== false && definition) {
      const errors = this.validateValue(key, value, definition.validationRules);
      if (errors.length > 0) {
        return errors;
      }
    }

    const id = createSettingId();
    const now = new Date();

    const setting: AppSetting = {
      id,
      key,
      value,
      scope,
      scopeId: options?.scopeId,
      environment,
      isOverridden: scope !== 'global',
      createdAt: now,
      updatedAt: now,
    };

    this.storeSetting(setting);
    return setting;
  }

  private storeSetting(setting: AppSetting): void {
    switch (setting.scope) {
      case 'global':
        this.globalSettings.set(setting.key, setting);
        break;
      case 'tenant':
        if (!setting.scopeId) {
          throw new Error('Tenant scope requires scopeId');
        }
        let tenantConfig = this.tenantConfigs.get(setting.scopeId);
        if (!tenantConfig) {
          tenantConfig = {
            tenantId: setting.scopeId,
            settings: new Map(),
            parentEnvironment: setting.environment,
          };
          this.tenantConfigs.set(setting.scopeId, tenantConfig);
        }
        tenantConfig.settings.set(setting.key, setting);
        break;
      case 'user':
        if (!setting.scopeId) {
          throw new Error('User scope requires scopeId');
        }
        let userConfig = this.userConfigs.get(setting.scopeId);
        if (!userConfig) {
          userConfig = {
            userId: setting.scopeId,
            settings: new Map(),
            parentTenantId: undefined,
          };
          this.userConfigs.set(setting.scopeId, userConfig);
        }
        userConfig.settings.set(setting.key, setting);
        break;
    }
  }

  updateSetting(
    key: string,
    value: string | number | boolean | JsonValue,
    scope: ConfigScope,
    options?: {
      scopeId?: string;
      environment?: EnvironmentType;
      validate?: boolean;
      triggerEvent?: boolean;
      triggeredBy?: string;
    }
  ): AppSetting | ValidationError[] | null {
    const definition = this.definitions.get(key);
    const environment = options?.environment ?? this.currentEnvironment;

    if (options?.validate !== false && definition) {
      const errors = this.validateValue(key, value, definition.validationRules);
      if (errors.length > 0) {
        return errors;
      }
    }

    const existing = this.getSetting(key, scope, options?.scopeId);
    if (!existing) return null;

    const oldValue = existing.value;
    const updatedSetting: AppSetting = {
      ...existing,
      value,
      updatedAt: new Date(),
    };

    this.storeSetting(updatedSetting);

    if (options?.triggerEvent !== false) {
      this.emitChangeEvent({
        settingId: updatedSetting.id,
        settingKey: key,
        oldValue,
        newValue: value,
        environment,
        scope,
        scopeId: options?.scopeId,
        timestamp: new Date(),
        triggeredBy: options?.triggeredBy,
      });
    }

    return updatedSetting;
  }

  deleteSetting(key: string, scope: ConfigScope, scopeId?: string): boolean {
    let deleted = false;

    switch (scope) {
      case 'global':
        deleted = this.globalSettings.delete(key);
        break;
      case 'tenant':
        if (scopeId) {
          const tenantConfig = this.tenantConfigs.get(scopeId);
          if (tenantConfig) {
            deleted = tenantConfig.settings.delete(key);
          }
        }
        break;
      case 'user':
        if (scopeId) {
          const userConfig = this.userConfigs.get(scopeId);
          if (userConfig) {
            deleted = userConfig.settings.delete(key);
          }
        }
        break;
    }

    return deleted;
  }

  getSetting(key: string, scope: ConfigScope, scopeId?: string): AppSetting | undefined {
    switch (scope) {
      case 'global':
        return this.globalSettings.get(key);
      case 'tenant':
        if (scopeId) {
          const tenantConfig = this.tenantConfigs.get(scopeId);
          if (tenantConfig) {
            return tenantConfig.settings.get(key);
          }
        }
        return undefined;
      case 'user':
        if (scopeId) {
          const userConfig = this.userConfigs.get(scopeId);
          if (userConfig) {
            return userConfig.settings.get(key);
          }
        }
        return undefined;
    }
  }

  getSettingValue(
    key: string,
    scope: ConfigScope,
    options?: {
      scopeId?: string;
      environment?: EnvironmentType;
      useDefault?: boolean;
    }
  ): unknown {
    const environment = options?.environment ?? this.currentEnvironment;
    const definition = this.definitions.get(key);

    if (scope === 'user' && options?.scopeId) {
      const userConfig = this.userConfigs.get(options.scopeId);
      if (userConfig) {
        const userSetting = userConfig.settings.get(key);
        if (userSetting && userSetting.environment === environment) {
          return userSetting.value;
        }
      }
    }

    if (scope === 'tenant' && options?.scopeId) {
      const tenantConfig = this.tenantConfigs.get(options.scopeId);
      if (tenantConfig) {
        const tenantSetting = tenantConfig.settings.get(key);
        if (tenantSetting && tenantSetting.environment === environment) {
          return tenantSetting.value;
        }
      }
    }

    const globalSetting = this.globalSettings.get(key);
    if (globalSetting && globalSetting.environment === environment) {
      return globalSetting.value;
    }

    if (options?.useDefault !== false && definition) {
      return definition.defaultValue;
    }

    return undefined;
  }

  getAllSettings(
    scope: ConfigScope,
    options?: {
      scopeId?: string;
      environment?: EnvironmentType;
      includeDefaults?: boolean;
    }
  ): AppSetting[] {
    const environment = options?.environment ?? this.currentEnvironment;
    const settings: AppSetting[] = [];

    const addSettingsFromMap = (map: Map<string, AppSetting>) => {
      for (const setting of map.values()) {
        if (setting.environment === environment) {
          settings.push(setting);
        }
      }
    };

    switch (scope) {
      case 'global':
        addSettingsFromMap(this.globalSettings);
        break;
      case 'tenant':
        if (options?.scopeId) {
          const tenantConfig = this.tenantConfigs.get(options.scopeId);
          if (tenantConfig) {
            addSettingsFromMap(tenantConfig.settings);
          }
        }
        break;
      case 'user':
        if (options?.scopeId) {
          const userConfig = this.userConfigs.get(options.scopeId);
          if (userConfig) {
            addSettingsFromMap(userConfig.settings);
          }
        }
        break;
    }

    if (options?.includeDefaults) {
      for (const definition of this.definitions.values()) {
        if (definition.scope === scope || (scope === 'global' && definition.scope === 'global')) {
          const hasSetting = settings.some((s) => s.key === definition.key);
          if (!hasSetting) {
            settings.push({
              id: `default_${definition.key}`,
              key: definition.key,
              value: definition.defaultValue,
              scope: scope,
              scopeId: options.scopeId,
              environment,
              isOverridden: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }
      }
    }

    return settings;
  }

  setOverride(
    key: string,
    value: string | number | boolean | JsonValue,
    scope: ConfigScope,
    options?: {
      scopeId?: string;
      environment?: EnvironmentType;
      validate?: boolean;
    }
  ): AppSetting | ValidationError[] | null {
    const definition = this.definitions.get(key);
    const environment = options?.environment ?? this.currentEnvironment;

    if (!definition) {
      return null;
    }

    if (definition.scope !== scope && !(scope === 'global' && definition.scope === 'global')) {
      throw new Error(`Setting "${key}" cannot be set at scope "${scope}"`);
    }

    if (options?.validate !== false) {
      const errors = this.validateValue(key, value, definition.validationRules);
      if (errors.length > 0) {
        return errors;
      }
    }

    return this.createSetting(key, value, scope, {
      scopeId: options?.scopeId,
      environment,
      validate: false,
    });
  }

  removeOverride(key: string, scope: ConfigScope, scopeId?: string): boolean {
    return this.deleteSetting(key, scope, scopeId);
  }

  getEffectiveValue(
    key: string,
    options?: {
      userId?: string;
      tenantId?: string;
      environment?: EnvironmentType;
    }
  ): unknown {
    const environment = options?.environment ?? this.currentEnvironment;
    const definition = this.definitions.get(key);

    if (options?.userId) {
      const userConfig = this.userConfigs.get(options.userId);
      if (userConfig) {
        const userSetting = userConfig.settings.get(key);
        if (userSetting && userSetting.environment === environment) {
          return userSetting.value;
        }
      }
    }

    if (options?.tenantId) {
      const tenantConfig = this.tenantConfigs.get(options.tenantId);
      if (tenantConfig) {
        const tenantSetting = tenantConfig.settings.get(key);
        if (tenantSetting && tenantSetting.environment === environment) {
          return tenantSetting.value;
        }
      }
    }

    const globalSetting = this.globalSettings.get(key);
    if (globalSetting && globalSetting.environment === environment) {
      return globalSetting.value;
    }

    return definition?.defaultValue;
  }

  validateValue(key: string, value: unknown, rules: ValidationRule[]): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const rule of rules) {
      switch (rule.type) {
        case 'required':
          if (value === undefined || value === null || value === '') {
            errors.push({
              settingKey: key,
              message: rule.message ?? `Setting "${key}" is required`,
              value,
              rule,
            });
          }
          break;

        case 'pattern':
          if (typeof value === 'string' && typeof rule.value === 'string') {
            if (!validatePattern(value, rule.value)) {
              errors.push({
                settingKey: key,
                message: rule.message ?? `Setting "${key}" does not match pattern ${rule.value}`,
                value,
                rule,
              });
            }
          }
          break;

        case 'range':
          if (typeof rule.value === 'object' && 'min' in rule.value && 'max' in rule.value) {
            if (typeof value === 'number') {
              if (!validateRange(value, rule.value.min, rule.value.max)) {
                errors.push({
                  settingKey: key,
                  message: rule.message ?? `Setting "${key}" must be between ${rule.value.min} and ${rule.value.max}`,
                  value,
                  rule,
                });
              }
            }
          }
          break;

        case 'min':
          if (typeof value === 'number' && typeof rule.value === 'number') {
            if (!validateMin(value, rule.value)) {
              errors.push({
                settingKey: key,
                message: rule.message ?? `Setting "${key}" must be at least ${rule.value}`,
                value,
                rule,
              });
            }
          }
          break;

        case 'max':
          if (typeof value === 'number' && typeof rule.value === 'number') {
            if (!validateMax(value, rule.value)) {
              errors.push({
                settingKey: key,
                message: rule.message ?? `Setting "${key}" must be at most ${rule.value}`,
                value,
                rule,
              });
            }
          }
          break;

        case 'enum':
          if (Array.isArray(rule.value)) {
            if (!validateEnum(value as string | number, rule.value as (string | number)[])) {
              errors.push({
                settingKey: key,
                message: rule.message ?? `Setting "${key}" must be one of: ${rule.value.join(', ')}`,
                value,
                rule,
              });
            }
          }
          break;
      }
    }

    return errors;
  }

  validateAllSettings(
    scope: ConfigScope,
    options?: {
      scopeId?: string;
      environment?: EnvironmentType;
    }
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const settings = this.getAllSettings(scope, options);

    for (const setting of settings) {
      const definition = this.definitions.get(setting.key);
      if (definition) {
        const settingErrors = this.validateValue(setting.key, setting.value, definition.validationRules);
        errors.push(...settingErrors);
      }
    }

    return errors;
  }

  exportConfig(options: ConfigExportOptions): Record<string, unknown> {
    const config: Record<string, unknown> = {
      environment: options.environment ?? this.currentEnvironment,
      settings: {} as Record<string, unknown>,
    };

    const processSettings = (settings: AppSetting[]) => {
      for (const setting of settings) {
        if (setting.environment === (options.environment ?? this.currentEnvironment)) {
          const definition = this.definitions.get(setting.key);
          if (definition?.isSecret && !options.includeSecrets) {
            continue;
          }
          if (options.scope && setting.scope !== options.scope) {
            continue;
          }
          if (options.scopeId && setting.scopeId !== options.scopeId) {
            continue;
          }

          (config.settings as Record<string, unknown>)[setting.key] = {
            value: setting.value,
            scope: setting.scope,
            scopeId: setting.scopeId,
            isOverridden: setting.isOverridden,
          };
        }
      }
    };

    processSettings(Array.from(this.globalSettings.values()));

    for (const tenantConfig of this.tenantConfigs.values()) {
      processSettings(Array.from(tenantConfig.settings.values()));
    }

    for (const userConfig of this.userConfigs.values()) {
      processSettings(Array.from(userConfig.settings.values()));
    }

    return config;
  }

  importConfig(
    config: Record<string, unknown>,
    options?: {
      overwrite?: boolean;
      scope?: ConfigScope;
      scopeId?: string;
      environment?: EnvironmentType;
    }
  ): ConfigImportResult {
    const result: ConfigImportResult = {
      imported: 0,
      skipped: 0,
      errors: [],
    };

    const settings = config.settings as Record<string, unknown> | undefined;
    if (!settings) {
      return result;
    }

    const targetEnvironment = (options?.environment ?? config.environment ?? this.currentEnvironment) as EnvironmentType;
    const targetScope = options?.scope;
    const targetScopeId = options?.scopeId;

    for (const [key, settingData] of Object.entries(settings)) {
      if (typeof settingData !== 'object' || settingData === null) {
        result.errors.push({
          settingKey: key,
          message: 'Invalid setting data format',
        });
        continue;
      }

      const data = settingData as Record<string, unknown>;
      const value = data.value;
      const scope = (data.scope as ConfigScope) ?? 'global';
      const scopeId = data.scopeId as string | undefined;

      if (targetScope && scope !== targetScope) {
        result.skipped++;
        continue;
      }

      if (targetScopeId && scopeId !== targetScopeId) {
        result.skipped++;
        continue;
      }

      const existing = this.getSetting(key, scope, scopeId);
      if (existing && !options?.overwrite) {
        result.skipped++;
        continue;
      }

      const errors = this.validateValue(key, value, this.definitions.get(key)?.validationRules ?? []);
      if (errors.length > 0) {
        result.errors.push(...errors);
        continue;
      }

      if (existing) {
        const updated = this.updateSetting(key, value as string | number | boolean | JsonValue, scope, {
          scopeId,
          environment: targetEnvironment,
          validate: false,
          triggerEvent: false,
        });
        if (updated && !Array.isArray(updated)) {
          result.imported++;
        } else {
          result.errors.push({
            settingKey: key,
            message: 'Failed to update setting',
          });
        }
      } else {
        const created = this.createSetting(key, value as string | number | boolean | JsonValue, scope, {
          scopeId,
          environment: targetEnvironment,
          validate: false,
        });
        if (!Array.isArray(created)) {
          result.imported++;
        } else {
          result.errors.push(...created);
        }
      }
    }

    return result;
  }

  resetToDefaults(
    scope: ConfigScope,
    options?: {
      scopeId?: string;
      environment?: EnvironmentType;
      keys?: string[];
    }
  ): number {
    let resetCount = 0;
    const environment = options?.environment ?? this.currentEnvironment;

    if (options?.keys) {
      for (const key of options.keys) {
        const deleted = this.deleteSetting(key, scope, options.scopeId);
        if (deleted) resetCount++;
      }
    } else {
      const settings = this.getAllSettings(scope, { scopeId: options?.scopeId, environment });
      for (const setting of settings) {
        const deleted = this.deleteSetting(setting.key, scope, options?.scopeId);
        if (deleted) resetCount++;
      }
    }

    return resetCount;
  }

  setEnvironment(environment: EnvironmentType): void {
    if (!isValidEnvironment(environment)) {
      throw new Error(`Invalid environment: ${environment}`);
    }
    this.currentEnvironment = environment;
  }

  getEnvironment(): EnvironmentType {
    return this.currentEnvironment;
  }

  subscribe(listener: SettingChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitChangeEvent(event: SettingChangeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (_error) {
        // Silently ignore listener errors
      }
    }
  }

  clear(): void {
    this.definitions.clear();
    this.globalSettings.clear();
    this.tenantConfigs.clear();
    this.userConfigs.clear();
    this.listeners.clear();
  }

  clearScope(scope: ConfigScope, scopeId?: string): number {
    let clearedCount = 0;

    switch (scope) {
      case 'global':
        clearedCount = this.globalSettings.size;
        this.globalSettings.clear();
        break;
      case 'tenant':
        if (scopeId) {
          const tenantConfig = this.tenantConfigs.get(scopeId);
          if (tenantConfig) {
            clearedCount = tenantConfig.settings.size;
            this.tenantConfigs.delete(scopeId);
          }
        }
        break;
      case 'user':
        if (scopeId) {
          const userConfig = this.userConfigs.get(scopeId);
          if (userConfig) {
            clearedCount = userConfig.settings.size;
            this.userConfigs.delete(scopeId);
          }
        }
        break;
    }

    return clearedCount;
  }
}

export const createAppSettingsEngine = (definitions?: SettingDefinition[]): AppSettingsEngine => {
  return new AppSettingsEngine(definitions);
};

export default AppSettingsEngine;

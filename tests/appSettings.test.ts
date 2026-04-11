import {
  AppSettingsEngine,
  createAppSettingsEngine,
  EnvironmentType,
  ConfigScope,
  SettingType,
  SettingDefinition,
  JsonValue,
  ValidationError,
} from '../src/core/appSettings';

describe('AppSettingsEngine', () => {
  let engine: AppSettingsEngine;

  const createTestDefinition = (key: string, overrides?: Partial<SettingDefinition>): SettingDefinition => ({
    key,
    name: `${key} Setting`,
    description: `Test setting for ${key}`,
    settingType: 'string' as SettingType,
    defaultValue: 'default',
    validationRules: [],
    scope: 'global' as ConfigScope,
    isSecret: false,
    category: 'test',
    ...overrides,
  });

  beforeEach(() => {
    engine = createAppSettingsEngine();
  });

  afterEach(() => {
    engine.clear();
  });

  describe('registerSettingDefinition', () => {
    it('should register a new setting definition', () => {
      const definition = createTestDefinition('test_setting');
      const registered = engine.registerSettingDefinition(definition);
      expect(registered).toBeDefined();
      expect(registered.key).toBe('test_setting');
    });

    it('should throw error for duplicate key', () => {
      const definition = createTestDefinition('duplicate_key');
      engine.registerSettingDefinition(definition);
      expect(() => engine.registerSettingDefinition(definition)).toThrow();
    });

    it('should register definition with all property types', () => {
      const definition = createTestDefinition('full_setting', {
        settingType: 'number',
        defaultValue: 42,
        validationRules: [{ type: 'required' }],
        scope: 'tenant',
        isSecret: true,
        category: 'advanced',
      });
      const registered = engine.registerSettingDefinition(definition);
      expect(registered.settingType).toBe('number');
      expect(registered.defaultValue).toBe(42);
      expect(registered.scope).toBe('tenant');
      expect(registered.isSecret).toBe(true);
    });
  });

  describe('updateSettingDefinition', () => {
    it('should update an existing definition', () => {
      const definition = createTestDefinition('update_test', { category: 'original' });
      engine.registerSettingDefinition(definition);
      const updated = engine.updateSettingDefinition('update_test', { category: 'updated' });
      expect(updated?.category).toBe('updated');
    });

    it('should return null for non-existent key', () => {
      const result = engine.updateSettingDefinition('non_existent', { category: 'test' });
      expect(result).toBeNull();
    });
  });

  describe('removeSettingDefinition', () => {
    it('should remove an existing definition', () => {
      const definition = createTestDefinition('to_remove');
      engine.registerSettingDefinition(definition);
      const removed = engine.removeSettingDefinition('to_remove');
      expect(removed).toBe(true);
      expect(engine.getSettingDefinition('to_remove')).toBeUndefined();
    });

    it('should return false for non-existent key', () => {
      const result = engine.removeSettingDefinition('non_existent');
      expect(result).toBe(false);
    });
  });

  describe('getSettingDefinition', () => {
    it('should retrieve an existing definition', () => {
      const definition = createTestDefinition('get_test');
      engine.registerSettingDefinition(definition);
      const retrieved = engine.getSettingDefinition('get_test');
      expect(retrieved).toBeDefined();
      expect(retrieved?.key).toBe('get_test');
    });
  });

  describe('getAllSettingDefinitions', () => {
    it('should return all registered definitions', () => {
      engine.registerSettingDefinition(createTestDefinition('def1'));
      engine.registerSettingDefinition(createTestDefinition('def2'));
      const definitions = engine.getAllSettingDefinitions();
      expect(definitions.length).toBe(2);
    });
  });

  describe('createSetting', () => {
    it('should create a global setting', () => {
      engine.registerSettingDefinition(createTestDefinition('create_test'));
      const setting = engine.createSetting('create_test', 'test_value', 'global') as { key: string; value: unknown; scope: string };
      expect(setting).toBeDefined();
      expect(setting.key).toBe('create_test');
      expect(setting.value).toBe('test_value');
      expect(setting.scope).toBe('global');
    });

    it('should create setting with tenant scope', () => {
      engine.registerSettingDefinition(createTestDefinition('tenant_setting', { scope: 'tenant' }));
      const setting = engine.createSetting('tenant_setting', 'value', 'tenant', { scopeId: 'tenant_123' }) as { scope: string; scopeId: string };
      expect(setting).toBeDefined();
      expect(setting.scope).toBe('tenant');
      expect(setting.scopeId).toBe('tenant_123');
    });

    it('should create setting with user scope', () => {
      engine.registerSettingDefinition(createTestDefinition('user_setting', { scope: 'user' }));
      const setting = engine.createSetting('user_setting', 'value', 'user', { scopeId: 'user_456' }) as { scope: string; scopeId: string };
      expect(setting).toBeDefined();
      expect(setting.scope).toBe('user');
      expect(setting.scopeId).toBe('user_456');
    });

    it('should return validation errors when validate is true', () => {
      engine.registerSettingDefinition(createTestDefinition('required_setting', {
        validationRules: [{ type: 'required' }],
      }));
      const result = engine.createSetting('required_setting', '', 'global', { validate: true });
      expect(Array.isArray(result)).toBe(true);
      expect((result as ValidationError[]).length).toBeGreaterThan(0);
    });

    it('should create setting with different types', () => {
      engine.registerSettingDefinition(createTestDefinition('string_setting', { settingType: 'string', defaultValue: 'default' }));
      engine.registerSettingDefinition(createTestDefinition('number_setting', { settingType: 'number', defaultValue: 0 }));
      engine.registerSettingDefinition(createTestDefinition('boolean_setting', { settingType: 'boolean', defaultValue: false }));
      engine.registerSettingDefinition(createTestDefinition('json_setting', { settingType: 'json', defaultValue: {} }));

      const stringSetting = engine.createSetting('string_setting', 'test', 'global') as { key: string; value: unknown };
      const numberSetting = engine.createSetting('number_setting', 42, 'global') as { key: string; value: unknown };
      const booleanSetting = engine.createSetting('boolean_setting', true, 'global') as { key: string; value: unknown };
      const jsonSetting = engine.createSetting('json_setting', { key: 'value' }, 'global') as { key: string; value: unknown };

      expect(stringSetting).toBeDefined();
      expect(numberSetting).toBeDefined();
      expect(booleanSetting).toBeDefined();
      expect(jsonSetting).toBeDefined();
    });
  });

  describe('updateSetting', () => {
    it('should update an existing setting', () => {
      engine.registerSettingDefinition(createTestDefinition('update_setting'));
      engine.createSetting('update_setting', 'original', 'global');
      const updated = engine.updateSetting('update_setting', 'updated', 'global');
      expect(updated).toBeDefined();
      expect((updated as { value: string })?.value).toBe('updated');
    });

    it('should return null for non-existent setting', () => {
      const result = engine.updateSetting('non_existent', 'value', 'global');
      expect(result).toBeNull();
    });

    it('should return validation errors for invalid update', () => {
      engine.registerSettingDefinition(createTestDefinition('min_setting', {
        settingType: 'number',
        defaultValue: 0,
        validationRules: [{ type: 'min', value: 10 }],
      }));
      engine.createSetting('min_setting', 50, 'global');
      const result = engine.updateSetting('min_setting', 5, 'global', { validate: true });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('deleteSetting', () => {
    it('should delete an existing setting', () => {
      engine.registerSettingDefinition(createTestDefinition('delete_test'));
      engine.createSetting('delete_test', 'value', 'global');
      const deleted = engine.deleteSetting('delete_test', 'global');
      expect(deleted).toBe(true);
      expect(engine.getSetting('delete_test', 'global')).toBeUndefined();
    });

    it('should return false for non-existent setting', () => {
      const result = engine.deleteSetting('non_existent', 'global');
      expect(result).toBe(false);
    });
  });

  describe('getSetting', () => {
    it('should retrieve an existing setting', () => {
      engine.registerSettingDefinition(createTestDefinition('get_test'));
      engine.createSetting('get_test', 'value', 'global');
      const setting = engine.getSetting('get_test', 'global');
      expect(setting).toBeDefined();
      expect(setting?.value).toBe('value');
    });
  });

  describe('getSettingValue', () => {
    it('should return the setting value', () => {
      engine.registerSettingDefinition(createTestDefinition('value_test'));
      engine.createSetting('value_test', 'test_value', 'global');
      const value = engine.getSettingValue('value_test', 'global');
      expect(value).toBe('test_value');
    });

    it('should return default value when setting does not exist', () => {
      engine.registerSettingDefinition(createTestDefinition('default_test', { defaultValue: 'default' }));
      const value = engine.getSettingValue('default_test', 'global', { useDefault: true });
      expect(value).toBe('default');
    });

    it('should return undefined when no default and setting does not exist', () => {
      engine.registerSettingDefinition(createTestDefinition('no_default_test', { defaultValue: 'default' }));
      const value = engine.getSettingValue('non_existent', 'global', { useDefault: false });
      expect(value).toBeUndefined();
    });
  });

  describe('getAllSettings', () => {
    it('should return all settings for a scope', () => {
      engine.registerSettingDefinition(createTestDefinition('all_test1'));
      engine.registerSettingDefinition(createTestDefinition('all_test2'));
      engine.createSetting('all_test1', 'value1', 'global');
      engine.createSetting('all_test2', 'value2', 'global');
      const settings = engine.getAllSettings('global');
      expect(settings.length).toBe(2);
    });

    it('should include defaults when requested', () => {
      engine.registerSettingDefinition(createTestDefinition('include_defaults'));
      const settings = engine.getAllSettings('global', { includeDefaults: true });
      expect(settings.length).toBe(1);
      expect(settings[0].isOverridden).toBe(false);
    });
  });

  describe('setOverride', () => {
    it('should set an override for a setting', () => {
      engine.registerSettingDefinition(createTestDefinition('override_test'));
      engine.createSetting('override_test', 'original', 'global');
      const override = engine.setOverride('override_test', 'overridden', 'global');
      expect(override).toBeDefined();
      expect((override as { value: string })?.value).toBe('overridden');
    });

    it('should throw error when scope does not match', () => {
      engine.registerSettingDefinition(createTestDefinition('scope_mismatch', { scope: 'tenant' }));
      expect(() => engine.setOverride('scope_mismatch', 'value', 'user', { scopeId: 'user_123' })).toThrow();
    });
  });

  describe('getEffectiveValue', () => {
    it('should return user-level value when userId is provided', () => {
      engine.registerSettingDefinition(createTestDefinition('effective_test'));
      engine.createSetting('effective_test', 'global_value', 'global');
      const userSetting = engine.createSetting('effective_test', 'user_value', 'user', { scopeId: 'user_123' });
      const value = engine.getEffectiveValue('effective_test', { userId: 'user_123' });
      expect(value).toBe('user_value');
    });

    it('should return tenant-level value when tenantId is provided', () => {
      engine.registerSettingDefinition(createTestDefinition('tenant_effective_test'));
      engine.createSetting('tenant_effective_test', 'global_value', 'global');
      engine.createSetting('tenant_effective_test', 'tenant_value', 'tenant', { scopeId: 'tenant_123' });
      const value = engine.getEffectiveValue('tenant_effective_test', { tenantId: 'tenant_123' });
      expect(value).toBe('tenant_value');
    });

    it('should fall back to global when user/tenant setting does not exist', () => {
      engine.registerSettingDefinition(createTestDefinition('fallback_test', { defaultValue: 'default' }));
      engine.createSetting('fallback_test', 'global_value', 'global');
      const value = engine.getEffectiveValue('fallback_test', { userId: 'user_123' });
      expect(value).toBe('global_value');
    });
  });

  describe('validateValue', () => {
    it('should validate required rule - fail', () => {
      const errors = engine.validateValue('required_test', '', [{ type: 'required' }]);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('required');
    });

    it('should validate required rule - pass', () => {
      const errors = engine.validateValue('required_test', 'value', [{ type: 'required' }]);
      expect(errors.length).toBe(0);
    });

    it('should validate pattern rule - valid', () => {
      const errors = engine.validateValue('pattern_test', 'abc123', [{ type: 'pattern', value: '^[a-z0-9]+$' }]);
      expect(errors.length).toBe(0);
    });

    it('should validate pattern rule - invalid', () => {
      const errors = engine.validateValue('pattern_test', 'ABC!', [{ type: 'pattern', value: '^[a-z0-9]+$' }]);
      expect(errors.length).toBe(1);
    });

    it('should validate range rule - within range', () => {
      const errors = engine.validateValue('range_test', 50, [{ type: 'range', value: { min: 0, max: 100 } }]);
      expect(errors.length).toBe(0);
    });

    it('should validate range rule - out of range', () => {
      const errors = engine.validateValue('range_test', 150, [{ type: 'range', value: { min: 0, max: 100 } }]);
      expect(errors.length).toBe(1);
    });

    it('should validate min rule - above min', () => {
      const errors = engine.validateValue('min_test', 15, [{ type: 'min', value: 10 }]);
      expect(errors.length).toBe(0);
    });

    it('should validate min rule - below min', () => {
      const errors = engine.validateValue('min_test', 5, [{ type: 'min', value: 10 }]);
      expect(errors.length).toBe(1);
    });

    it('should validate max rule - below max', () => {
      const errors = engine.validateValue('max_test', 5, [{ type: 'max', value: 10 }]);
      expect(errors.length).toBe(0);
    });

    it('should validate max rule - above max', () => {
      const errors = engine.validateValue('max_test', 15, [{ type: 'max', value: 10 }]);
      expect(errors.length).toBe(1);
    });

    it('should validate enum rule - valid value', () => {
      const errors = engine.validateValue('enum_test', 'red', [{ type: 'enum', value: ['red', 'green', 'blue'] }]);
      expect(errors.length).toBe(0);
    });

    it('should validate enum rule - invalid value', () => {
      const errors = engine.validateValue('enum_test', 'yellow', [{ type: 'enum', value: ['red', 'green', 'blue'] }]);
      expect(errors.length).toBe(1);
    });
  });

  describe('validateAllSettings', () => {
    it('should validate all settings and return no errors for valid settings', () => {
      engine.registerSettingDefinition(createTestDefinition('validate_all', {
        validationRules: [{ type: 'required' }],
      }));
      engine.createSetting('validate_all', 'valid_value', 'global');
      const errors = engine.validateAllSettings('global');
      expect(errors.length).toBe(0);
    });

    it('should return errors when settings have invalid values', () => {
      engine.registerSettingDefinition(createTestDefinition('min_validate', {
        settingType: 'number',
        defaultValue: 50,
        validationRules: [{ type: 'min', value: 10 }],
      }));
      engine.createSetting('min_validate', 100, 'global');
      const errors = engine.validateAllSettings('global');
      expect(errors.length).toBe(0);
    });
  });

  describe('exportConfig', () => {
    it('should export all non-secret settings', () => {
      engine.registerSettingDefinition(createTestDefinition('export_test', { isSecret: false }));
      engine.createSetting('export_test', 'value', 'global');
      const config = engine.exportConfig({ includeSecrets: false });
      expect(config.settings).toBeDefined();
      expect((config.settings as Record<string, unknown>).export_test).toBeDefined();
    });

    it('should exclude secret settings when includeSecrets is false', () => {
      engine.registerSettingDefinition(createTestDefinition('secret_export', { isSecret: true }));
      engine.createSetting('secret_export', 'secret_value', 'global');
      const config = engine.exportConfig({ includeSecrets: false });
      expect((config.settings as Record<string, unknown>).secret_export).toBeUndefined();
    });

    it('should include secret settings when includeSecrets is true', () => {
      engine.registerSettingDefinition(createTestDefinition('secret_include', { isSecret: true }));
      engine.createSetting('secret_include', 'secret_value', 'global');
      const config = engine.exportConfig({ includeSecrets: true });
      expect((config.settings as Record<string, unknown>).secret_include).toBeDefined();
    });
  });

  describe('importConfig', () => {
    it('should import valid configuration', () => {
      engine.registerSettingDefinition(createTestDefinition('import_test'));
      const config = {
        environment: 'development',
        settings: {
          import_test: { value: 'imported_value', scope: 'global' },
        },
      };
      const result = engine.importConfig(config);
      expect(result.imported).toBe(1);
      expect(result.errors.length).toBe(0);
    });

    it('should skip existing settings when overwrite is false', () => {
      engine.registerSettingDefinition(createTestDefinition('skip_test'));
      engine.createSetting('skip_test', 'original', 'global');
      const config = {
        settings: {
          skip_test: { value: 'new_value', scope: 'global' },
        },
      };
      const result = engine.importConfig(config, { overwrite: false });
      expect(result.skipped).toBe(1);
    });

    it('should overwrite existing settings when overwrite is true', () => {
      engine.registerSettingDefinition(createTestDefinition('overwrite_test'));
      engine.createSetting('overwrite_test', 'original', 'global');
      const config = {
        settings: {
          overwrite_test: { value: 'new_value', scope: 'global' },
        },
      };
      const result = engine.importConfig(config, { overwrite: true });
      expect(result.imported).toBe(1);
      expect(engine.getSettingValue('overwrite_test', 'global')).toBe('new_value');
    });
  });

  describe('resetToDefaults', () => {
    it('should reset all settings to defaults', () => {
      engine.registerSettingDefinition(createTestDefinition('reset_test', { defaultValue: 'default' }));
      engine.createSetting('reset_test', 'custom', 'global');
      const count = engine.resetToDefaults('global');
      expect(count).toBe(1);
      expect(engine.getSettingValue('reset_test', 'global')).toBe('default');
    });

    it('should reset specific keys when provided', () => {
      engine.registerSettingDefinition(createTestDefinition('reset_one'));
      engine.registerSettingDefinition(createTestDefinition('reset_two'));
      engine.createSetting('reset_one', 'value1', 'global');
      engine.createSetting('reset_two', 'value2', 'global');
      const count = engine.resetToDefaults('global', { keys: ['reset_one'] });
      expect(count).toBe(1);
    });
  });

  describe('setEnvironment', () => {
    it('should set the current environment', () => {
      engine.setEnvironment('production');
      expect(engine.getEnvironment()).toBe('production');
    });

    it('should throw error for invalid environment', () => {
      expect(() => engine.setEnvironment('invalid' as EnvironmentType)).toThrow();
    });
  });

  describe('Event System', () => {
    it('should emit change event when setting is updated', () => {
      engine.registerSettingDefinition(createTestDefinition('event_test'));
      engine.createSetting('event_test', 'original', 'global');
      let eventReceived = false;
      engine.subscribe((event) => {
        if (event.settingKey === 'event_test' && event.oldValue === 'original') {
          eventReceived = true;
        }
      });
      engine.updateSetting('event_test', 'updated', 'global', { triggerEvent: true });
      expect(eventReceived).toBe(true);
    });

    it('should allow unsubscribing', () => {
      let callCount = 0;
      const unsubscribe = engine.subscribe(() => {
        callCount++;
      });
      engine.registerSettingDefinition(createTestDefinition('unsub_test'));
      engine.createSetting('unsub_test', 'value', 'global');
      unsubscribe();
      engine.updateSetting('unsub_test', 'updated', 'global');
      expect(callCount).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all settings and definitions', () => {
      engine.registerSettingDefinition(createTestDefinition('clear_test'));
      engine.createSetting('clear_test', 'value', 'global');
      engine.clear();
      expect(engine.getAllSettingDefinitions().length).toBe(0);
      expect(engine.getAllSettings('global').length).toBe(0);
    });
  });

  describe('clearScope', () => {
    it('should clear all settings for global scope', () => {
      engine.registerSettingDefinition(createTestDefinition('clear_global1'));
      engine.registerSettingDefinition(createTestDefinition('clear_global2'));
      engine.createSetting('clear_global1', 'value1', 'global');
      engine.createSetting('clear_global2', 'value2', 'global');
      const count = engine.clearScope('global');
      expect(count).toBe(2);
      expect(engine.getAllSettings('global').length).toBe(0);
    });

    it('should clear settings for specific tenant', () => {
      engine.registerSettingDefinition(createTestDefinition('clear_tenant', { scope: 'tenant' }));
      engine.createSetting('clear_tenant', 'value', 'tenant', { scopeId: 'tenant_123' });
      const count = engine.clearScope('tenant', 'tenant_123');
      expect(count).toBe(1);
    });
  });
});

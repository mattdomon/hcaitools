import crypto from 'crypto';

export type EnvironmentType = 'development' | 'staging' | 'production';

export type ConfigScope = 'global' | 'tenant' | 'user';

export type SettingType = 'string' | 'number' | 'boolean' | 'json';

export type ValidationRuleType = 'required' | 'pattern' | 'range' | 'min' | 'max' | 'enum';

export type ValidationRuleValue = string | number | boolean | string[] | number[] | { min: number; max: number };

export interface ValidationRule {
  type: ValidationRuleType;
  value?: ValidationRuleValue;
  message?: string;
}

export interface PatternValidation extends ValidationRule {
  type: 'pattern';
  value: string;
}

export interface RangeValidation extends ValidationRule {
  type: 'range';
  value: { min: number; max: number };
}

export interface MinValidation extends ValidationRule {
  type: 'min';
  value: number;
}

export interface MaxValidation extends ValidationRule {
  type: 'max';
  value: number;
}

export interface EnumValidation extends ValidationRule {
  type: 'enum';
  value: string[] | number[];
}

export interface RequiredValidation extends ValidationRule {
  type: 'required';
  value?: boolean;
}

export interface SettingDefinition {
  key: string;
  name: string;
  description: string;
  settingType: SettingType;
  defaultValue: string | number | boolean | JsonValue;
  validationRules: ValidationRule[];
  scope: ConfigScope;
  isSecret: boolean;
  category: string;
  allowedEnvironments?: EnvironmentType[];
}

export interface AppSetting {
  id: string;
  key: string;
  value: string | number | boolean | JsonValue;
  scope: ConfigScope;
  scopeId?: string;
  environment: EnvironmentType;
  isOverridden: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettingOverride {
  settingKey: string;
  scope: ConfigScope;
  scopeId?: string;
  environment: EnvironmentType;
  value: string | number | boolean | JsonValue;
}

export interface EnvironmentConfig {
  environment: EnvironmentType;
  settings: Map<string, AppSetting>;
  configPath?: string;
}

export interface TenantConfig {
  tenantId: string;
  settings: Map<string, AppSetting>;
  parentEnvironment: EnvironmentType;
}

export interface UserConfig {
  userId: string;
  settings: Map<string, AppSetting>;
  parentTenantId?: string;
}

export interface JsonValue {
  [key: string]: unknown;
}

export interface ValidationError {
  settingKey: string;
  message: string;
  value?: unknown;
  rule?: ValidationRule;
}

export interface SettingChangeEvent {
  settingId: string;
  settingKey: string;
  oldValue: unknown;
  newValue: unknown;
  environment: EnvironmentType;
  scope: ConfigScope;
  scopeId?: string;
  timestamp: Date;
  triggeredBy?: string;
}

export type SettingChangeListener = (event: SettingChangeEvent) => void;

export interface ConfigExportOptions {
  includeSecrets: boolean;
  environment?: EnvironmentType;
  scope?: ConfigScope;
  scopeId?: string;
}

export interface ConfigImportResult {
  imported: number;
  skipped: number;
  errors: ValidationError[];
}

export function createSettingId(): string {
  return `setting_${crypto.randomBytes(8).toString('hex')}`;
}

export function createOverrideId(): string {
  return `override_${crypto.randomBytes(8).toString('hex')}`;
}

export function isJsonValue(value: unknown): value is JsonValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isValidSettingValue(value: unknown, settingType: SettingType): boolean {
  switch (settingType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'json':
      return isJsonValue(value);
    default:
      return false;
  }
}

export function isValidEnvironment(env: string): env is EnvironmentType {
  return env === 'development' || env === 'staging' || env === 'production';
}

export function isValidScope(scope: string): scope is ConfigScope {
  return scope === 'global' || scope === 'tenant' || scope === 'user';
}

export function validatePattern(value: string, pattern: string): boolean {
  try {
    const regex = new RegExp(pattern);
    return regex.test(value);
  } catch {
    return false;
  }
}

export function validateRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

export function validateMin(value: number, min: number): boolean {
  return value >= min;
}

export function validateMax(value: number, max: number): boolean {
  return value <= max;
}

export function validateEnum<T extends string | number>(value: T, allowedValues: T[]): boolean {
  return allowedValues.includes(value);
}

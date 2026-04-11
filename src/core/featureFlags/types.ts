import crypto from 'crypto';

export type FlagType = 'boolean' | 'string' | 'number' | 'json';

export type FlagStatus = 'active' | 'inactive' | 'archived';

export type VariationType = 'control' | 'treatment' | 'holdout';

export interface Variation {
  id: string;
  name: string;
  type: VariationType;
  value: boolean | string | number | JsonValue;
}

export type JsonValue = Record<string, unknown>;

export type TargetAttribute =
  | { type: 'user_id'; values: string[] }
  | { type: 'percentage'; percentage: number }
  | { type: 'attribute'; key: string; operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin'; value: string | number | string[] | number[] };

export interface TargetingRule {
  id: string;
  name: string;
  conditions: {
    operator: 'and' | 'or';
    conditions: TargetingCondition[];
  };
  variationId: string;
  percentage?: number;
}

export interface TargetingCondition {
  attribute: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'exists' | 'not_exists';
  value: string | number | boolean | string[] | number[];
}

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  flagType: FlagType;
  status: FlagStatus;
  defaultValue: boolean | string | number | JsonValue;
  variations: Variation[];
  targetingRules: TargetingRule[];
  defaultVariationId?: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
}

export interface FlagEvaluationContext {
  userId?: string;
  attributes?: Record<string, string | number | boolean | string[] | number[]>;
  timestamp?: Date;
}

export interface FlagEvaluationResult {
  flagId: string;
  flagKey: string;
  matchedVariation: Variation;
  matchedRule?: TargetingRule;
  evaluatedAt: Date;
  context: FlagEvaluationContext;
}

export interface FlagUpdateEvent {
  flagId: string;
  flagKey: string;
  type: 'flag_created' | 'flag_updated' | 'flag_deleted' | 'flag_archived' | 'flag_restored';
  timestamp: Date;
  data?: Partial<FeatureFlag>;
}

export type FlagUpdateListener = (event: FlagUpdateEvent) => void;

export interface PercentageRollout {
  percentage: number;
  bucket?: string;
  seed?: string;
}

export interface UserSegment {
  id: string;
  name: string;
  description: string;
  criteria: {
    operator: 'and' | 'or';
    conditions: SegmentCondition[];
  };
}

export interface SegmentCondition {
  attribute: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'exists' | 'not_exists';
  value: string | number | boolean | string[] | number[];
}

export function createVariationId(): string {
  return `var_${crypto.randomBytes(8).toString('hex')}`;
}

export function createTargetingRuleId(): string {
  return `rule_${crypto.randomBytes(8).toString('hex')}`;
}

export function createFlagId(): string {
  return `flag_${crypto.randomBytes(8).toString('hex')}`;
}

export function createSegmentId(): string {
  return `seg_${crypto.randomBytes(8).toString('hex')}`;
}

export function isJsonValue(value: unknown): value is JsonValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isValidFlagValue(value: unknown, flagType: FlagType): boolean {
  switch (flagType) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && isFinite(value);
    case 'json':
      return isJsonValue(value);
    default:
      return false;
  }
}
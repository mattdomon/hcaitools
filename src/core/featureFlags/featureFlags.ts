import crypto from 'crypto';
import {
  FeatureFlag,
  FlagType,
  FlagStatus,
  Variation,
  TargetingRule,
  TargetingCondition,
  FlagEvaluationContext,
  FlagEvaluationResult,
  FlagUpdateEvent,
  FlagUpdateListener,
  JsonValue,
  UserSegment,
  SegmentCondition,
  createVariationId,
  createTargetingRuleId,
  createFlagId,
  createSegmentId,
  isJsonValue,
  isValidFlagValue,
} from './types';

export class FeatureFlagsEngine {
  private flags: Map<string, FeatureFlag> = new Map();
  private segments: Map<string, UserSegment> = new Map();
  private listeners: Set<FlagUpdateListener> = new Set();
  private evaluationCounters: Map<string, number> = new Map();

  createFlag(
    key: string,
    name: string,
    flagType: FlagType,
    defaultValue: boolean | string | number | JsonValue,
    description: string = '',
    options?: {
      variations?: Omit<Variation, 'id'>[];
      defaultVariationId?: string;
      targetingRules?: Omit<TargetingRule, 'id'>[];
    }
  ): FeatureFlag {
    if (!isValidFlagValue(defaultValue, flagType)) {
      throw new Error(`Invalid default value for flag type: ${flagType}`);
    }

    if (this.flags.has(key)) {
      throw new Error(`Flag with key "${key}" already exists`);
    }

    const id = createFlagId();
    const now = new Date();

    const variations: Variation[] = options?.variations?.map((v) => ({
      ...v,
      id: createVariationId(),
    })) ?? [];

    if (variations.length === 0 && flagType === 'boolean') {
      variations.push(
        { id: createVariationId(), name: 'Enabled', type: 'treatment', value: true },
        { id: createVariationId(), name: 'Disabled', type: 'control', value: false }
      );
    }

    const targetingRules: TargetingRule[] = (options?.targetingRules ?? []).map((r) => ({
      ...r,
      id: createTargetingRuleId(),
    }));

    const flag: FeatureFlag = {
      id,
      key,
      name,
      description,
      flagType,
      status: 'active',
      defaultValue,
      variations,
      targetingRules,
      defaultVariationId: options?.defaultVariationId ?? variations[0]?.id,
      createdAt: now,
      updatedAt: now,
    };

    this.flags.set(key, flag);
    this.emitEvent({ flagId: id, flagKey: key, type: 'flag_created', timestamp: now });
    return flag;
  }

  updateFlag(
    key: string,
    updates: Partial<Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>>
  ): FeatureFlag | null {
    const flag = this.flags.get(key);
    if (!flag) return null;

    if (updates.flagType !== undefined && updates.defaultValue !== undefined) {
      if (!isValidFlagValue(updates.defaultValue, updates.flagType)) {
        throw new Error(`Invalid default value for flag type: ${updates.flagType}`);
      }
    } else if (updates.flagType !== undefined && updates.defaultValue === undefined) {
      if (!isValidFlagValue(flag.defaultValue, updates.flagType)) {
        throw new Error(`Existing default value invalid for new flag type: ${updates.flagType}`);
      }
    } else if (updates.defaultValue !== undefined && updates.flagType === undefined) {
      if (!isValidFlagValue(updates.defaultValue, flag.flagType)) {
        throw new Error(`Invalid default value for flag type: ${flag.flagType}`);
      }
    }

    const updatedFlag: FeatureFlag = {
      ...flag,
      ...updates,
      updatedAt: new Date(),
    };

    this.flags.set(key, updatedFlag);
    this.emitEvent({
      flagId: flag.id,
      flagKey: key,
      type: 'flag_updated',
      timestamp: new Date(),
      data: updates,
    });

    return updatedFlag;
  }

  deleteFlag(key: string): boolean {
    const flag = this.flags.get(key);
    if (!flag) return false;

    this.flags.delete(key);
    this.emitEvent({ flagId: flag.id, flagKey: key, type: 'flag_deleted', timestamp: new Date() });
    return true;
  }

  archiveFlag(key: string): FeatureFlag | null {
    const flag = this.flags.get(key);
    if (!flag) return null;

    const archivedFlag: FeatureFlag = {
      ...flag,
      status: 'archived',
      archivedAt: new Date(),
      updatedAt: new Date(),
    };

    this.flags.set(key, archivedFlag);
    this.emitEvent({ flagId: flag.id, flagKey: key, type: 'flag_archived', timestamp: new Date() });
    return archivedFlag;
  }

  restoreFlag(key: string): FeatureFlag | null {
    const flag = this.flags.get(key);
    if (!flag || flag.status !== 'archived') return null;

    const restoredFlag: FeatureFlag = {
      ...flag,
      status: 'inactive',
      archivedAt: undefined,
      updatedAt: new Date(),
    };

    this.flags.set(key, restoredFlag);
    this.emitEvent({ flagId: flag.id, flagKey: key, type: 'flag_restored', timestamp: new Date() });
    return restoredFlag;
  }

  getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  getAllFlags(options?: { status?: FlagStatus; includeArchived?: boolean }): FeatureFlag[] {
    let flags = Array.from(this.flags.values());

    if (options?.status) {
      flags = flags.filter((f) => f.status === options.status);
    }

    if (!options?.includeArchived) {
      flags = flags.filter((f) => f.status !== 'archived');
    }

    return flags;
  }

  addVariation(flagKey: string, variation: Omit<Variation, 'id'>): Variation | null {
    const flag = this.flags.get(flagKey);
    if (!flag) return null;

    if (!isValidFlagValue(variation.value, flag.flagType)) {
      throw new Error(`Invalid variation value for flag type: ${flag.flagType}`);
    }

    const newVariation: Variation = { ...variation, id: createVariationId() };
    const updatedFlag: FeatureFlag = {
      ...flag,
      variations: [...flag.variations, newVariation],
      updatedAt: new Date(),
    };

    this.flags.set(flagKey, updatedFlag);
    this.emitEvent({ flagId: flag.id, flagKey, type: 'flag_updated', timestamp: new Date() });
    return newVariation;
  }

  removeVariation(flagKey: string, variationId: string): boolean {
    const flag = this.flags.get(flagKey);
    if (!flag) return false;

    const variation = flag.variations.find((v) => v.id === variationId);
    if (!variation) return false;

    const firstOtherVariation = flag.variations.find((v) => v.id !== variationId);

    const updatedFlag: FeatureFlag = {
      ...flag,
      variations: flag.variations.filter((v) => v.id !== variationId),
      defaultVariationId: flag.defaultVariationId === variationId ? firstOtherVariation?.id : flag.defaultVariationId,
      targetingRules: flag.targetingRules.map((rule) =>
        rule.variationId === variationId ? { ...rule, variationId: firstOtherVariation?.id ?? rule.variationId } : rule
      ),
      updatedAt: new Date(),
    };

    this.flags.set(flagKey, updatedFlag);
    this.emitEvent({ flagId: flag.id, flagKey, type: 'flag_updated', timestamp: new Date() });
    return true;
  }

  addTargetingRule(flagKey: string, rule: Omit<TargetingRule, 'id'>): TargetingRule | null {
    const flag = this.flags.get(flagKey);
    if (!flag) return null;

    const variation = flag.variations.find((v) => v.id === rule.variationId);
    if (!variation) {
      throw new Error(`Variation with id "${rule.variationId}" not found in flag`);
    }

    const newRule: TargetingRule = { ...rule, id: createTargetingRuleId() };
    const updatedFlag: FeatureFlag = {
      ...flag,
      targetingRules: [...flag.targetingRules, newRule],
      updatedAt: new Date(),
    };

    this.flags.set(flagKey, updatedFlag);
    this.emitEvent({ flagId: flag.id, flagKey, type: 'flag_updated', timestamp: new Date() });
    return newRule;
  }

  updateTargetingRule(
    flagKey: string,
    ruleId: string,
    updates: Partial<Omit<TargetingRule, 'id'>>
  ): TargetingRule | null {
    const flag = this.flags.get(flagKey);
    if (!flag) return null;

    const ruleIndex = flag.targetingRules.findIndex((r) => r.id === ruleId);
    if (ruleIndex === -1) return null;

    if (updates.variationId) {
      const variation = flag.variations.find((v) => v.id === updates.variationId);
      if (!variation) {
        throw new Error(`Variation with id "${updates.variationId}" not found in flag`);
      }
    }

    const updatedRule: TargetingRule = { ...flag.targetingRules[ruleIndex], ...updates };
    const updatedRules = [...flag.targetingRules];
    updatedRules[ruleIndex] = updatedRule;

    const updatedFlag: FeatureFlag = { ...flag, targetingRules: updatedRules, updatedAt: new Date() };
    this.flags.set(flagKey, updatedFlag);
    this.emitEvent({ flagId: flag.id, flagKey, type: 'flag_updated', timestamp: new Date() });
    return updatedRule;
  }

  removeTargetingRule(flagKey: string, ruleId: string): boolean {
    const flag = this.flags.get(flagKey);
    if (!flag) return false;

    const rule = flag.targetingRules.find((r) => r.id === ruleId);
    if (!rule) return false;

    const updatedFlag: FeatureFlag = {
      ...flag,
      targetingRules: flag.targetingRules.filter((r) => r.id !== ruleId),
      updatedAt: new Date(),
    };

    this.flags.set(flagKey, updatedFlag);
    this.emitEvent({ flagId: flag.id, flagKey, type: 'flag_updated', timestamp: new Date() });
    return true;
  }

  evaluateFlag(flagKey: string, context: FlagEvaluationContext): FlagEvaluationResult | null {
    const flag = this.flags.get(flagKey);
    if (!flag) return null;

    if (flag.status !== 'active') {
      return this.buildResult(flag, flag.defaultValue, context);
    }

    for (const rule of flag.targetingRules) {
      if (this.evaluateConditions(rule.conditions, context)) {
        const variation = flag.variations.find((v) => v.id === rule.variationId);
        if (variation) {
          if (rule.percentage !== undefined && rule.percentage < 100) {
            const bucketValue = this.calculateBucket(context, flagKey, rule.id);
            if (bucketValue >= rule.percentage) {
              continue;
            }
          }
          return this.buildResult(flag, variation.value, context, rule);
        }
      }
    }

    return this.buildResult(flag, flag.defaultValue, context);
  }

  evaluateAllFlags(context: FlagEvaluationContext): Map<string, FlagEvaluationResult> {
    const results = new Map<string, FlagEvaluationResult>();
    for (const flag of this.flags.values()) {
      if (flag.status === 'active') {
        const result = this.evaluateFlag(flag.key, context);
        if (result) {
          results.set(flag.key, result);
        }
      }
    }
    return results;
  }

  private buildResult(
    flag: FeatureFlag,
    value: boolean | string | number | JsonValue,
    context: FlagEvaluationContext,
    rule?: TargetingRule
  ): FlagEvaluationResult {
    const defaultVariation: Variation = {
      id: 'default',
      name: 'Default',
      type: 'control',
      value,
    };

    const matchedVar = flag.variations.find((v) => {
      if (typeof v.value === typeof value) {
        if (typeof value === 'object' && isJsonValue(value) && isJsonValue(v.value)) {
          return JSON.stringify(v.value) === JSON.stringify(value);
        }
        return v.value === value;
      }
      return false;
    });

    return {
      flagId: flag.id,
      flagKey: flag.key,
      matchedVariation: matchedVar ?? defaultVariation,
      matchedRule: rule,
      evaluatedAt: new Date(),
      context,
    };
  }

  private evaluateConditions(
    conditions: { operator: 'and' | 'or'; conditions: TargetingCondition[] },
    context: FlagEvaluationContext
  ): boolean {
    if (conditions.conditions.length === 0) return true;

    const results = conditions.conditions.map((c) => this.evaluateCondition(c, context));

    if (conditions.operator === 'and') {
      return results.every((r) => r);
    } else {
      return results.some((r) => r);
    }
  }

  private evaluateCondition(condition: TargetingCondition, context: FlagEvaluationContext): boolean {
    let attributeValue: unknown;

    if (condition.attribute === 'user_id') {
      attributeValue = context.userId;
    } else if (condition.attribute === 'timestamp') {
      attributeValue = context.timestamp ?? new Date();
    } else {
      attributeValue = context.attributes?.[condition.attribute];
    }

    return this.compareValues(attributeValue, condition.operator, condition.value);
  }

  private compareValues(
    actual: unknown,
    operator: string,
    expected: unknown
  ): boolean {
    switch (operator) {
      case 'eq':
        return actual === expected;
      case 'neq':
        return actual !== expected;
      case 'gt':
        return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
      case 'gte':
        return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
      case 'lt':
        return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
      case 'lte':
        return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
      case 'in':
        if (Array.isArray(expected)) {
          return expected.includes(actual);
        }
        return false;
      case 'nin':
        if (Array.isArray(expected)) {
          return !expected.includes(actual);
        }
        return true;
      case 'exists':
        return actual !== undefined && actual !== null;
      case 'not_exists':
        return actual === undefined || actual === null;
      default:
        return false;
    }
  }

  private calculateBucket(context: FlagEvaluationContext, flagKey: string, ruleId: string): number {
    const seed = context.userId ?? flagKey + ruleId + (context.timestamp?.toISOString() ?? '');
    const hash = crypto.createHash('sha256').update(seed).digest('hex');
    const hashInt = parseInt(hash.substring(0, 8), 16);
    return hashInt % 100;
  }

  createSegment(
    name: string,
    description: string,
    criteria: { operator: 'and' | 'or'; conditions: SegmentCondition[] }
  ): UserSegment {
    const id = createSegmentId();
    const segment: UserSegment = { id, name, description, criteria };
    this.segments.set(id, segment);
    return segment;
  }

  getSegment(id: string): UserSegment | undefined {
    return this.segments.get(id);
  }

  getAllSegments(): UserSegment[] {
    return Array.from(this.segments.values());
  }

  updateSegment(id: string, updates: Partial<Omit<UserSegment, 'id'>>): UserSegment | null {
    const segment = this.segments.get(id);
    if (!segment) return null;

    const updated: UserSegment = { ...segment, ...updates };
    this.segments.set(id, updated);
    return updated;
  }

  deleteSegment(id: string): boolean {
    return this.segments.delete(id);
  }

  evaluateSegment(segmentId: string, context: FlagEvaluationContext): boolean {
    const segment = this.segments.get(segmentId);
    if (!segment) return false;

    return this.evaluateConditions(segment.criteria, context);
  }

  getFlagVariationById(flagKey: string, variationId: string): Variation | undefined {
    const flag = this.flags.get(flagKey);
    return flag?.variations.find((v) => v.id === variationId);
  }

  setDefaultVariation(flagKey: string, variationId: string): boolean {
    const flag = this.flags.get(flagKey);
    if (!flag) return false;

    const variation = flag.variations.find((v) => v.id === variationId);
    if (!variation) return false;

    const updatedFlag: FeatureFlag = { ...flag, defaultVariationId: variationId, updatedAt: new Date() };
    this.flags.set(flagKey, updatedFlag);
    return true;
  }

  getEvaluationCounter(_flagKey: string): number {
    return this.evaluationCounters.get(_flagKey) ?? 0;
  }

  subscribe(listener: FlagUpdateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitEvent(event: FlagUpdateEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (_error) {
        // Silently ignore listener errors
      }
    }
  }

  clear(): void {
    this.flags.clear();
    this.segments.clear();
    this.listeners.clear();
    this.evaluationCounters.clear();
  }
}

export const createFeatureFlagsEngine = (): FeatureFlagsEngine => {
  return new FeatureFlagsEngine();
};

export default FeatureFlagsEngine;
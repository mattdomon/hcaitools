import { FeatureFlagsEngine, createFeatureFlagsEngine } from '../src/core/featureFlags';
import {
  FlagType,
  VariationType,
  Variation,
  JsonValue,
} from '../src/core/featureFlags/types';

describe('FeatureFlagsEngine', () => {
  let engine: FeatureFlagsEngine;

  beforeEach(() => {
    engine = createFeatureFlagsEngine();
  });

  afterEach(() => {
    engine.clear();
  });

  describe('createFlag', () => {
    it('should create a boolean flag with default variations', () => {
      const flag = engine.createFlag('test_flag', 'Test Flag', 'boolean', false);
      expect(flag).toBeDefined();
      expect(flag.key).toBe('test_flag');
      expect(flag.name).toBe('Test Flag');
      expect(flag.flagType).toBe('boolean');
      expect(flag.status).toBe('active');
      expect(flag.defaultValue).toBe(false);
      expect(flag.variations.length).toBe(2);
    });

    it('should create a string flag', () => {
      const flag = engine.createFlag('greeting', 'Greeting', 'string', 'hello');
      expect(flag.flagType).toBe('string');
      expect(flag.defaultValue).toBe('hello');
      expect(flag.variations.length).toBe(0);
    });

    it('should create a number flag', () => {
      const flag = engine.createFlag('max_retries', 'Max Retries', 'number', 3);
      expect(flag.flagType).toBe('number');
      expect(flag.defaultValue).toBe(3);
    });

    it('should create a json flag', () => {
      const jsonValue: JsonValue = { theme: 'dark', size: 'large' };
      const flag = engine.createFlag('theme_config', 'Theme Config', 'json', jsonValue);
      expect(flag.flagType).toBe('json');
      expect(flag.defaultValue).toEqual(jsonValue);
    });

    it('should create flag with custom variations', () => {
      const variations: Omit<Variation, 'id'>[] = [
        { name: 'Control', type: 'control', value: 'A' },
        { name: 'Treatment A', type: 'treatment', value: 'B' },
        { name: 'Treatment B', type: 'treatment', value: 'C' },
      ];
      const flag = engine.createFlag('ab_test', 'AB Test', 'string', 'A', '', { variations });
      expect(flag.variations.length).toBe(3);
      expect(flag.variations[0].name).toBe('Control');
      expect(flag.variations[0].value).toBe('A');
    });

    it('should throw error for invalid default value', () => {
      expect(() => engine.createFlag('bad_flag', 'Bad', 'boolean', 'not a boolean' as unknown as boolean))
        .toThrow();
    });

    it('should throw error if flag key already exists', () => {
      engine.createFlag('duplicate', 'Duplicate', 'boolean', false);
      expect(() => engine.createFlag('duplicate', 'Duplicate 2', 'boolean', true))
        .toThrow();
    });

    it('should create flag with targeting rules', () => {
      const rule = {
        name: 'Premium Users',
        conditions: { operator: 'and' as const, conditions: [{ attribute: 'plan', operator: 'eq' as const, value: 'premium' }] },
        variationId: 'var_123',
        percentage: 50,
      };
      const flag = engine.createFlag('premium_feature', 'Premium Feature', 'boolean', false, '', {
        targetingRules: [rule],
        variations: [{ name: 'Enabled', type: 'treatment', value: true }],
      });
      expect(flag.targetingRules.length).toBe(1);
    });
  });

  describe('updateFlag', () => {
    it('should update flag name and description', () => {
      const flag = engine.createFlag('update_test', 'Update Test', 'boolean', false);
      const updated = engine.updateFlag('update_test', { name: 'Updated Name', description: 'New desc' });
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.description).toBe('New desc');
    });

    it('should return null for non-existent flag', () => {
      const result = engine.updateFlag('non_existent', { name: 'Test' });
      expect(result).toBeNull();
    });

    it('should throw error when updating flagType with invalid defaultValue', () => {
      const flag = engine.createFlag('type_test', 'Type Test', 'boolean', false);
      expect(() => engine.updateFlag('type_test', { flagType: 'string' }))
        .toThrow();
    });

    it('should successfully update flagType when defaultValue is valid', () => {
      const flag = engine.createFlag('type_test2', 'Type Test 2', 'boolean', false, '', {
        variations: [{ name: 'True', type: 'treatment', value: true }],
      });
      const updated = engine.updateFlag('type_test2', { flagType: 'boolean', defaultValue: true });
      expect(updated?.flagType).toBe('boolean');
      expect(updated?.defaultValue).toBe(true);
    });
  });

  describe('deleteFlag', () => {
    it('should delete an existing flag', () => {
      engine.createFlag('to_delete', 'To Delete', 'boolean', false);
      const result = engine.deleteFlag('to_delete');
      expect(result).toBe(true);
      expect(engine.getFlag('to_delete')).toBeUndefined();
    });

    it('should return false for non-existent flag', () => {
      const result = engine.deleteFlag('non_existent');
      expect(result).toBe(false);
    });
  });

  describe('archiveFlag', () => {
    it('should archive an active flag', () => {
      const flag = engine.createFlag('to_archive', 'To Archive', 'boolean', false);
      const archived = engine.archiveFlag('to_archive');
      expect(archived?.status).toBe('archived');
      expect(archived?.archivedAt).toBeDefined();
    });

    it('should return null for non-existent flag', () => {
      const result = engine.archiveFlag('non_existent');
      expect(result).toBeNull();
    });
  });

  describe('restoreFlag', () => {
    it('should restore an archived flag', () => {
      const flag = engine.createFlag('to_restore', 'To Restore', 'boolean', false);
      engine.archiveFlag('to_restore');
      const restored = engine.restoreFlag('to_restore');
      expect(restored?.status).toBe('inactive');
      expect(restored?.archivedAt).toBeUndefined();
    });

    it('should return null for non-archived flag', () => {
      const flag = engine.createFlag('active_flag', 'Active', 'boolean', false);
      const result = engine.restoreFlag('active_flag');
      expect(result).toBeNull();
    });
  });

  describe('getFlag', () => {
    it('should retrieve an existing flag', () => {
      const created = engine.createFlag('get_test', 'Get Test', 'boolean', true);
      const retrieved = engine.getFlag('get_test');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return undefined for non-existent flag', () => {
      const result = engine.getFlag('non_existent');
      expect(result).toBeUndefined();
    });
  });

  describe('getAllFlags', () => {
    it('should return all non-archived flags by default', () => {
      engine.createFlag('flag1', 'Flag 1', 'boolean', false);
      engine.createFlag('flag2', 'Flag 2', 'boolean', false);
      engine.createFlag('archived_flag', 'Archived', 'boolean', false);
      engine.archiveFlag('archived_flag');

      const flags = engine.getAllFlags();
      expect(flags.length).toBe(2);
    });

    it('should filter by status', () => {
      engine.createFlag('active1', 'Active 1', 'boolean', false);
      const inactiveFlag = engine.createFlag('inactive1', 'Inactive 1', 'boolean', false);
      engine.updateFlag('inactive1', { status: 'inactive' });

      const activeFlags = engine.getAllFlags({ status: 'active' });
      const inactiveFlags = engine.getAllFlags({ status: 'inactive' });

      expect(activeFlags.length).toBe(1);
      expect(inactiveFlags.length).toBe(1);
    });

    it('should include archived flags when requested', () => {
      engine.createFlag('normal_flag', 'Normal', 'boolean', false);
      engine.createFlag('archived_flag', 'Archived', 'boolean', false);
      engine.archiveFlag('archived_flag');

      const flags = engine.getAllFlags({ includeArchived: true });
      expect(flags.length).toBe(2);
    });
  });

  describe('addVariation', () => {
    it('should add a variation to a flag', () => {
      const flag = engine.createFlag('variation_test', 'Variation Test', 'string', 'default');
      const variation = engine.addVariation('variation_test', { name: 'New Variation', type: 'treatment', value: 'new' });
      expect(variation).toBeDefined();
      expect(variation?.name).toBe('New Variation');
      expect(engine.getFlag('variation_test')?.variations.length).toBe(1);
    });

    it('should throw error for invalid variation value', () => {
      const flag = engine.createFlag('type_check', 'Type Check', 'boolean', false);
      expect(() => engine.addVariation('type_check', { name: 'Invalid', type: 'treatment', value: 'not boolean' }))
        .toThrow();
    });

    it('should return null for non-existent flag', () => {
      const result = engine.addVariation('non_existent', { name: 'Test', type: 'treatment', value: true });
      expect(result).toBeNull();
    });
  });

  describe('removeVariation', () => {
    it('should remove a variation from a flag', () => {
      const flag = engine.createFlag('remove_var_test', 'Remove Var Test', 'boolean', false, '', {
        variations: [
          { name: 'Var1', type: 'control', value: false },
          { name: 'Var2', type: 'treatment', value: true },
        ],
      });
      const variationId = flag.variations[1].id;
      const result = engine.removeVariation('remove_var_test', variationId);
      expect(result).toBe(true);
      expect(engine.getFlag('remove_var_test')?.variations.length).toBe(1);
    });

    it('should return false for non-existent flag', () => {
      const result = engine.removeVariation('non_existent', 'some_id');
      expect(result).toBe(false);
    });
  });

  describe('addTargetingRule', () => {
    it('should add a targeting rule to a flag', () => {
      const flag = engine.createFlag('rule_test', 'Rule Test', 'boolean', false, '', {
        variations: [{ name: 'Enabled', type: 'treatment', value: true }],
      });
      const rule = engine.addTargetingRule('rule_test', {
        name: 'Test Rule',
        conditions: { operator: 'and', conditions: [{ attribute: 'country', operator: 'eq', value: 'US' }] },
        variationId: flag.variations[0].id,
        percentage: 100,
      });
      expect(rule).toBeDefined();
      expect(rule?.name).toBe('Test Rule');
    });

    it('should throw error for non-existent variation', () => {
      const flag = engine.createFlag('bad_rule', 'Bad Rule', 'boolean', false);
      expect(() => engine.addTargetingRule('bad_rule', {
        name: 'Bad',
        conditions: { operator: 'and', conditions: [] },
        variationId: 'non_existent_id',
      })).toThrow();
    });
  });

  describe('updateTargetingRule', () => {
    it('should update an existing targeting rule', () => {
      const flag = engine.createFlag('update_rule_test', 'Update Rule Test', 'boolean', false, '', {
        variations: [{ name: 'Enabled', type: 'treatment', value: true }],
      });
      const rule = engine.addTargetingRule('update_rule_test', {
        name: 'Original Name',
        conditions: { operator: 'and', conditions: [] },
        variationId: flag.variations[0].id,
      });
      const updated = engine.updateTargetingRule('update_rule_test', rule!.id, { name: 'Updated Name' });
      expect(updated?.name).toBe('Updated Name');
    });
  });

  describe('removeTargetingRule', () => {
    it('should remove a targeting rule', () => {
      const flag = engine.createFlag('remove_rule_test', 'Remove Rule Test', 'boolean', false, '', {
        variations: [{ name: 'Enabled', type: 'treatment', value: true }],
      });
      const rule = engine.addTargetingRule('remove_rule_test', {
        name: 'To Remove',
        conditions: { operator: 'and', conditions: [] },
        variationId: flag.variations[0].id,
      });
      const result = engine.removeTargetingRule('remove_rule_test', rule!.id);
      expect(result).toBe(true);
      expect(engine.getFlag('remove_rule_test')?.targetingRules.length).toBe(0);
    });
  });

  describe('evaluateFlag', () => {
    it('should return default value for inactive flag', () => {
      const flag = engine.createFlag('inactive_eval', 'Inactive Eval', 'boolean', true);
      engine.updateFlag('inactive_eval', { status: 'inactive' });
      const result = engine.evaluateFlag('inactive_eval', { userId: 'user123' });
      expect(result?.matchedVariation.value).toBe(true);
    });

    it('should evaluate user_id condition correctly', () => {
      const flag = engine.createFlag('user_eval', 'User Eval', 'string', 'default', '', {
        variations: [{ name: 'Premium', type: 'treatment', value: 'premium' }],
      });
      const rule = engine.addTargetingRule('user_eval', {
        name: 'Premium Users',
        conditions: { operator: 'and', conditions: [{ attribute: 'user_id', operator: 'in', value: ['user123', 'user456'] }] },
        variationId: flag.variations[0].id,
      });
      const result = engine.evaluateFlag('user_eval', { userId: 'user123' });
      expect(result?.matchedVariation.value).toBe('premium');
    });

    it('should return default when no rules match', () => {
      const flag = engine.createFlag('no_match', 'No Match', 'boolean', false, '', {
        variations: [{ name: 'Enabled', type: 'treatment', value: true }],
      });
      engine.addTargetingRule('no_match', {
        name: 'Premium',
        conditions: { operator: 'and', conditions: [{ attribute: 'plan', operator: 'eq', value: 'premium' }] },
        variationId: flag.variations[0].id,
      });
      const result = engine.evaluateFlag('no_match', { userId: 'user123', attributes: { plan: 'free' } });
      expect(result?.matchedVariation.value).toBe(false);
    });

    it('should handle percentage-based rollouts', () => {
      const flag = engine.createFlag('percentage_test', 'Percentage Test', 'boolean', false, '', {
        variations: [{ name: 'Enabled', type: 'treatment', value: true }],
      });
      engine.addTargetingRule('percentage_test', {
        name: '50% Rollout',
        conditions: { operator: 'and', conditions: [] },
        variationId: flag.variations[0].id,
        percentage: 50,
      });
      
      let trueCount = 0;
      let falseCount = 0;
      for (let i = 0; i < 100; i++) {
        const result = engine.evaluateFlag('percentage_test', { userId: `user_${i}` });
        if (result?.matchedVariation.value === true) {
          trueCount++;
        } else {
          falseCount++;
        }
      }
      expect(trueCount + falseCount).toBe(100);
    });

    it('should return null for non-existent flag', () => {
      const result = engine.evaluateFlag('non_existent', { userId: 'user123' });
      expect(result).toBeNull();
    });

    it('should evaluate numeric comparisons correctly', () => {
      const flag = engine.createFlag('numeric_test', 'Numeric Test', 'boolean', false, '', {
        variations: [{ name: 'High Value', type: 'treatment', value: true }],
      });
      engine.addTargetingRule('numeric_test', {
        name: 'Age > 18',
        conditions: { operator: 'and', conditions: [{ attribute: 'age', operator: 'gt', value: 18 }] },
        variationId: flag.variations[0].id,
      });
      
      const result1 = engine.evaluateFlag('numeric_test', { attributes: { age: 25 } });
      expect(result1?.matchedVariation.value).toBe(true);
      
      const result2 = engine.evaluateFlag('numeric_test', { attributes: { age: 15 } });
      expect(result2?.matchedVariation.value).toBe(false);
    });
  });

  describe('evaluateAllFlags', () => {
    it('should evaluate all active flags', () => {
      engine.createFlag('flag_a', 'Flag A', 'boolean', false);
      engine.createFlag('flag_b', 'Flag B', 'boolean', false);
      
      const results = engine.evaluateAllFlags({ userId: 'user123' });
      expect(results.size).toBe(2);
    });

    it('should exclude inactive flags', () => {
      engine.createFlag('active_flag', 'Active', 'boolean', true);
      const inactiveFlag = engine.createFlag('inactive_flag', 'Inactive', 'boolean', false);
      engine.updateFlag('inactive_flag', { status: 'inactive' });
      
      const results = engine.evaluateAllFlags({ userId: 'user123' });
      expect(results.size).toBe(1);
      expect(results.has('active_flag')).toBe(true);
    });
  });

  describe('Segments', () => {
    it('should create a segment', () => {
      const segment = engine.createSegment('Premium Users', 'Description for premium users', {
        operator: 'and',
        conditions: [{ attribute: 'plan', operator: 'eq', value: 'premium' }],
      });
      expect(segment).toBeDefined();
      expect(segment.name).toBe('Premium Users');
      expect(segment.id).toContain('seg_');
    });

    it('should get a segment by id', () => {
      const created = engine.createSegment('test_segment', 'Test Segment', { operator: 'and', conditions: [] });
      const retrieved = engine.getSegment(created.id);
      expect(retrieved?.id).toBe(created.id);
    });

    it('should get all segments', () => {
      engine.createSegment('seg1', 'Segment 1', { operator: 'and', conditions: [] });
      engine.createSegment('seg2', 'Segment 2', { operator: 'and', conditions: [] });
      const segments = engine.getAllSegments();
      expect(segments.length).toBe(2);
    });

    it('should update a segment', () => {
      const segment = engine.createSegment('to_update', 'To Update', { operator: 'and', conditions: [] });
      const updated = engine.updateSegment(segment.id, { name: 'Updated Name' });
      expect(updated?.name).toBe('Updated Name');
    });

    it('should delete a segment', () => {
      const segment = engine.createSegment('to_delete', 'To Delete', { operator: 'and', conditions: [] });
      const result = engine.deleteSegment(segment.id);
      expect(result).toBe(true);
      expect(engine.getSegment(segment.id)).toBeUndefined();
    });

    it('should evaluate segment membership', () => {
      const segment = engine.createSegment('eval_segment', 'Eval Segment', {
        operator: 'and',
        conditions: [{ attribute: 'country', operator: 'eq', value: 'US' }],
      });
      const result = engine.evaluateSegment(segment.id, { attributes: { country: 'US' } });
      expect(result).toBe(true);
    });
  });

  describe('Event System', () => {
    it('should emit flag_created event', () => {
      let eventReceived = false;
      engine.subscribe((event) => {
        if (event.type === 'flag_created') {
          eventReceived = true;
        }
      });
      engine.createFlag('event_test', 'Event Test', 'boolean', false);
      expect(eventReceived).toBe(true);
    });

    it('should emit flag_updated event', () => {
      let eventReceived = false;
      engine.subscribe((event) => {
        if (event.type === 'flag_updated') {
          eventReceived = true;
        }
      });
      const flag = engine.createFlag('update_event_test', 'Update Event Test', 'boolean', false);
      engine.updateFlag('update_event_test', { name: 'Updated' });
      expect(eventReceived).toBe(true);
    });

    it('should emit flag_deleted event', () => {
      let eventReceived = false;
      engine.subscribe((event) => {
        if (event.type === 'flag_deleted') {
          eventReceived = true;
        }
      });
      engine.createFlag('delete_event_test', 'Delete Event Test', 'boolean', false);
      engine.deleteFlag('delete_event_test');
      expect(eventReceived).toBe(true);
    });

    it('should allow unsubscribing', () => {
      let callCount = 0;
      const unsubscribe = engine.subscribe(() => {
        callCount++;
      });
      engine.createFlag('unsub_test1', 'Unsub Test 1', 'boolean', false);
      unsubscribe();
      engine.createFlag('unsub_test2', 'Unsub Test 2', 'boolean', false);
      expect(callCount).toBe(1);
    });
  });

  describe('setDefaultVariation', () => {
    it('should set the default variation for a flag', () => {
      const flag = engine.createFlag('default_var_test', 'Default Var Test', 'string', 'A', '', {
        variations: [
          { name: 'A', type: 'control', value: 'A' },
          { name: 'B', type: 'treatment', value: 'B' },
        ],
      });
      const result = engine.setDefaultVariation('default_var_test', flag.variations[1].id);
      expect(result).toBe(true);
      expect(engine.getFlag('default_var_test')?.defaultVariationId).toBe(flag.variations[1].id);
    });

    it('should return false for non-existent flag', () => {
      const result = engine.setDefaultVariation('non_existent', 'some_id');
      expect(result).toBe(false);
    });
  });

  describe('getFlagVariationById', () => {
    it('should retrieve a variation by id', () => {
      const flag = engine.createFlag('get_var_test', 'Get Var Test', 'boolean', false, '', {
        variations: [{ name: 'Enabled', type: 'treatment', value: true }],
      });
      const variation = engine.getFlagVariationById('get_var_test', flag.variations[0].id);
      expect(variation).toBeDefined();
      expect(variation?.name).toBe('Enabled');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty targeting conditions', () => {
      const flag = engine.createFlag('empty_conditions', 'Empty Conditions', 'boolean', false, '', {
        variations: [{ name: 'Enabled', type: 'treatment', value: true }],
      });
      engine.addTargetingRule('empty_conditions', {
        name: 'Empty Rule',
        conditions: { operator: 'and', conditions: [] },
        variationId: flag.variations[0].id,
      });
      const result = engine.evaluateFlag('empty_conditions', { userId: 'user123' });
      expect(result?.matchedVariation.value).toBe(true);
    });

    it('should handle OR conditions', () => {
      const flag = engine.createFlag('or_conditions', 'Or Conditions', 'boolean', false, '', {
        variations: [{ name: 'Match', type: 'treatment', value: true }],
      });
      engine.addTargetingRule('or_conditions', {
        name: 'OR Rule',
        conditions: {
          operator: 'or',
          conditions: [
            { attribute: 'country', operator: 'eq', value: 'US' },
            { attribute: 'country', operator: 'eq', value: 'UK' },
          ],
        },
        variationId: flag.variations[0].id,
      });
      
      const result1 = engine.evaluateFlag('or_conditions', { attributes: { country: 'US' } });
      expect(result1?.matchedVariation.value).toBe(true);
      
      const result2 = engine.evaluateFlag('or_conditions', { attributes: { country: 'UK' } });
      expect(result2?.matchedVariation.value).toBe(true);
      
      const result3 = engine.evaluateFlag('or_conditions', { attributes: { country: 'CA' } });
      expect(result3?.matchedVariation.value).toBe(false);
    });

    it('should handle exists/not_exists operators', () => {
      const flag = engine.createFlag('exists_test', 'Exists Test', 'boolean', false, '', {
        variations: [{ name: 'Has Email', type: 'treatment', value: true }],
      });
      engine.addTargetingRule('exists_test', {
        name: 'Has Email',
        conditions: { operator: 'and', conditions: [{ attribute: 'email', operator: 'exists', value: true }] },
        variationId: flag.variations[0].id,
      });
      
      const result1 = engine.evaluateFlag('exists_test', { attributes: { email: 'test@example.com' } });
      expect(result1?.matchedVariation.value).toBe(true);
      
      const result2 = engine.evaluateFlag('exists_test', { attributes: {} });
      expect(result2?.matchedVariation.value).toBe(false);
    });

    it('should handle array values with in/nin operators', () => {
      const flag = engine.createFlag('array_test', 'Array Test', 'boolean', false, '', {
        variations: [{ name: 'Match', type: 'treatment', value: true }],
      });
      engine.addTargetingRule('array_test', {
        name: 'In Array',
        conditions: { operator: 'and', conditions: [{ attribute: 'role', operator: 'in', value: ['admin', 'superadmin'] }] },
        variationId: flag.variations[0].id,
      });
      
      const result1 = engine.evaluateFlag('array_test', { attributes: { role: 'admin' } });
      expect(result1?.matchedVariation.value).toBe(true);
      
      const result2 = engine.evaluateFlag('array_test', { attributes: { role: 'user' } });
      expect(result2?.matchedVariation.value).toBe(false);
    });
  });
});
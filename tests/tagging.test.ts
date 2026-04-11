/**
 * Tagging Service Tests
 */

import {
  TaggingServiceImpl,
  CategoryServiceImpl,
  AutoTaggingServiceImpl,
  TagAnalyticsServiceImpl,
  TagRecommendationServiceImpl,
  createTaggingService,
} from '../src/core/tagging/tagging';
import {
  TaggingManus,
  createTagging,
} from '../src/core/tagging';

describe('TaggingServiceImpl', () => {
  let service: TaggingServiceImpl;

  beforeEach(() => {
    service = createTaggingService();
  });

  describe('Tag Creation', () => {
    test('should create a simple tag', async () => {
      const tag = await service.createTag('JavaScript', 'simple', 'Programming language');

      expect(tag.tagId).toBeDefined();
      expect(tag.name).toBe('JavaScript');
      expect(tag.slug).toBe('javascript');
      expect(tag.type).toBe('simple');
      expect(tag.description).toBe('Programming language');
      expect(tag.usageCount).toBe(0);
      expect(tag.isActive).toBe(true);
    });

    test('should create a hierarchical tag', async () => {
      const tag = await service.createTag('Frontend', 'hierarchical', 'UI related');

      expect(tag.tagId).toBeDefined();
      expect(tag.name).toBe('Frontend');
      expect(tag.type).toBe('hierarchical');
    });

    test('should create tag with color', async () => {
      const tag = await service.createTag('Urgent', 'simple', undefined, '#FF0000');

      expect(tag.color).toBe('#FF0000');
    });

    test('should generate unique tag IDs', async () => {
      const tag1 = await service.createTag('Tag1', 'simple');
      const tag2 = await service.createTag('Tag2', 'simple');

      expect(tag1.tagId).not.toBe(tag2.tagId);
    });

    test('should generate slug from name', async () => {
      const tag = await service.createTag('Machine Learning', 'simple');

      expect(tag.slug).toBe('machine-learning');
    });
  });

  describe('Tag Retrieval', () => {
    test('should get tag by ID', async () => {
      const created = await service.createTag('TestTag', 'simple');
      const retrieved = await service.getTag(created.tagId);

      expect(retrieved?.tagId).toBe(created.tagId);
      expect(retrieved?.name).toBe('TestTag');
    });

    test('should return null for non-existent tag', async () => {
      const result = await service.getTag('non_existent_id');

      expect(result).toBeNull();
    });

    test('should list all tags', async () => {
      await service.createTag('Tag1', 'simple');
      await service.createTag('Tag2', 'simple');
      await service.createTag('Tag3', 'simple');

      const tags = await service.listTags();

      expect(tags.length).toBe(3);
    });

    test('should search tags by query', async () => {
      await service.createTag('JavaScript', 'simple');
      await service.createTag('TypeScript', 'simple');
      await service.createTag('Python', 'simple');

      const results = await service.searchTags('script');

      expect(results.length).toBe(2);
    });
  });

  describe('Tag Update', () => {
    test('should update tag name', async () => {
      const tag = await service.createTag('OldName', 'simple');
      const updated = await service.updateTag(tag.tagId, { name: 'NewName' });

      expect(updated.name).toBe('NewName');
      expect(updated.slug).toBe('newname');
    });

    test('should update tag description', async () => {
      const tag = await service.createTag('Test', 'simple');
      const updated = await service.updateTag(tag.tagId, { description: 'New description' });

      expect(updated.description).toBe('New description');
    });

    test('should update tag color', async () => {
      const tag = await service.createTag('Test', 'simple');
      const updated = await service.updateTag(tag.tagId, { color: '#00FF00' });

      expect(updated.color).toBe('#00FF00');
    });

    test('should throw error when updating non-existent tag', async () => {
      await expect(service.updateTag('non_existent', { name: 'Test' })).rejects.toThrow('Tag non_existent not found');
    });
  });

  describe('Tag Deletion', () => {
    test('should delete tag', async () => {
      const tag = await service.createTag('ToDelete', 'simple');
      await service.deleteTag(tag.tagId);

      const result = await service.getTag(tag.tagId);
      expect(result).toBeNull();
    });

    test('should handle deleting non-existent tag gracefully', async () => {
      await expect(service.deleteTag('non_existent')).resolves.not.toThrow();
    });
  });

  describe('Tag Assignment', () => {
    test('should assign tag to entity', async () => {
      const tag = await service.createTag('TestTag', 'simple');
      const assignment = await service.assignTag(tag.tagId, 'entity123', 'document');

      expect(assignment.assignmentId).toBeDefined();
      expect(assignment.tagId).toBe(tag.tagId);
      expect(assignment.entityId).toBe('entity123');
      expect(assignment.entityType).toBe('document');
      expect(assignment.source).toBe('auto');
    });

    test('should assign tag with assignedBy', async () => {
      const tag = await service.createTag('TestTag', 'simple');
      const assignment = await service.assignTag(tag.tagId, 'entity123', 'document', 'user456');

      expect(assignment.assignedBy).toBe('user456');
      expect(assignment.source).toBe('manual');
    });

    test('should get tags by entity', async () => {
      const tag1 = await service.createTag('Tag1', 'simple');
      const tag2 = await service.createTag('Tag2', 'simple');

      await service.assignTag(tag1.tagId, 'entity123', 'document');
      await service.assignTag(tag2.tagId, 'entity123', 'document');

      const tags = await service.getTagsByEntity('entity123', 'document');

      expect(tags.length).toBe(2);
    });

    test('should remove tag from entity', async () => {
      const tag = await service.createTag('TestTag', 'simple');
      await service.assignTag(tag.tagId, 'entity123', 'document');
      await service.removeTag(tag.tagId, 'entity123', 'document');

      const tags = await service.getTagsByEntity('entity123', 'document');
      expect(tags.length).toBe(0);
    });

    test('should increment usage count on assignment', async () => {
      const tag = await service.createTag('TestTag', 'simple');
      expect(tag.usageCount).toBe(0);

      await service.assignTag(tag.tagId, 'entity1', 'document');
      await service.assignTag(tag.tagId, 'entity2', 'document');

      const updated = await service.getTag(tag.tagId);
      expect(updated?.usageCount).toBe(2);
    });
  });

  describe('Get or Create Tag', () => {
    test('should return existing tag if found', async () => {
      const existing = await service.createTag('Existing', 'simple');

      const result = await service.getOrCreateTag('Existing', 'simple');

      expect(result.tagId).toBe(existing.tagId);
    });

    test('should create new tag if not found', async () => {
      const result = await service.getOrCreateTag('NewTag', 'simple');

      expect(result.name).toBe('NewTag');
      expect(result.tagId).toBeDefined();
    });
  });

  describe('Tag Filtering', () => {
    test('should filter tags by type', async () => {
      await service.createTag('Simple1', 'simple');
      await service.createTag('Hierarchical1', 'hierarchical');
      await service.createTag('Simple2', 'simple');

      const simpleTags = await service.listTags({ type: 'simple' });
      const hierarchicalTags = await service.listTags({ type: 'hierarchical' });

      expect(simpleTags.length).toBe(2);
      expect(hierarchicalTags.length).toBe(1);
    });

    test('should filter tags by active status', async () => {
      const tag1 = await service.createTag('Active', 'simple');
      const tag2 = await service.createTag('Inactive', 'simple');
      await service.updateTag(tag2.tagId, { isActive: false });

      const activeTags = await service.listTags({ isActive: true });

      expect(activeTags.length).toBe(1);
      expect(activeTags[0].name).toBe('Active');
    });
  });

  describe('Tag Sorting', () => {
    test('should sort tags by name', async () => {
      await service.createTag('Zebra', 'simple');
      await service.createTag('Apple', 'simple');
      await service.createTag('Mango', 'simple');

      const tags = await service.listTags({ sortBy: 'name', sortOrder: 'asc' });

      expect(tags[0].name).toBe('Apple');
      expect(tags[1].name).toBe('Mango');
      expect(tags[2].name).toBe('Zebra');
    });

    test('should sort tags by usage count', async () => {
      const tag1 = await service.createTag('Low', 'simple');
      const tag2 = await service.createTag('High', 'simple');
      const tag3 = await service.createTag('Med', 'simple');

      await service.assignTag(tag2.tagId, 'e1', 'doc');
      await service.assignTag(tag2.tagId, 'e2', 'doc');
      await service.assignTag(tag2.tagId, 'e3', 'doc');
      await service.assignTag(tag3.tagId, 'e4', 'doc');

      const tags = await service.listTags({ sortBy: 'usageCount', sortOrder: 'desc' });

      expect(tags[0].name).toBe('High');
      expect(tags[1].name).toBe('Med');
      expect(tags[2].name).toBe('Low');
    });
  });
});

describe('CategoryServiceImpl', () => {
  let taggingService: TaggingServiceImpl;
  let categoryService: CategoryServiceImpl;

  beforeEach(() => {
    taggingService = createTaggingService();
    categoryService = taggingService.getCategoryService() as CategoryServiceImpl;
  });

  describe('Category Creation', () => {
    test('should create a primary category', async () => {
      const category = await categoryService.createCategory('Technology', 'primary', undefined, 'Tech related');

      expect(category.categoryId).toBeDefined();
      expect(category.name).toBe('Technology');
      expect(category.level).toBe('primary');
      expect(category.parentId).toBeUndefined();
    });

    test('should create a secondary category with parent', async () => {
      const parent = await categoryService.createCategory('Technology', 'primary');
      const child = await categoryService.createCategory('Programming', 'secondary', parent.categoryId);

      expect(child.parentId).toBe(parent.categoryId);
      expect(child.level).toBe('secondary');
    });

    test('should throw error for non-existent parent', async () => {
      await expect(categoryService.createCategory('Test', 'secondary', 'non_existent')).rejects.toThrow('Parent category non_existent not found');
    });
  });

  describe('Category Retrieval', () => {
    test('should get category by ID', async () => {
      const created = await categoryService.createCategory('Test', 'primary');
      const retrieved = await categoryService.getCategory(created.categoryId);

      expect(retrieved?.categoryId).toBe(created.categoryId);
      expect(retrieved?.name).toBe('Test');
    });

    test('should return null for non-existent category', async () => {
      const result = await categoryService.getCategory('non_existent');

      expect(result).toBeNull();
    });

    test('should list categories by level', async () => {
      await categoryService.createCategory('Primary1', 'primary');
      await categoryService.createCategory('Primary2', 'primary');
      await categoryService.createCategory('Secondary1', 'secondary');

      const primaryCategories = await categoryService.listCategories({ level: 'primary' });

      expect(primaryCategories.length).toBe(2);
    });
  });

  describe('Category Tree', () => {
    test('should build category tree', async () => {
      const parent = await categoryService.createCategory('Parent', 'primary');
      const child1 = await categoryService.createCategory('Child1', 'secondary', parent.categoryId);
      const child2 = await categoryService.createCategory('Child2', 'secondary', parent.categoryId);

      const tree = await categoryService.getCategoryTree();

      expect(tree.length).toBe(1);
      expect(tree[0].children.length).toBe(2);
    });

    test('should get category path', async () => {
      const root = await categoryService.createCategory('Root', 'primary');
      const child = await categoryService.createCategory('Child', 'secondary', root.categoryId);
      const grandchild = await categoryService.createCategory('Grandchild', 'secondary', child.categoryId);

      const path = await categoryService.getCategoryPath(grandchild.categoryId);

      expect(path.length).toBe(3);
      expect(path[0].name).toBe('Root');
      expect(path[2].name).toBe('Grandchild');
    });
  });

  describe('Category Update', () => {
    test('should update category', async () => {
      const category = await categoryService.createCategory('OldName', 'primary');
      const updated = await categoryService.updateCategory(category.categoryId, { name: 'NewName' });

      expect(updated.name).toBe('NewName');
    });

    test('should move category to new parent', async () => {
      const parent1 = await categoryService.createCategory('Parent1', 'primary');
      const parent2 = await categoryService.createCategory('Parent2', 'primary');
      const child = await categoryService.createCategory('Child', 'secondary', parent1.categoryId);

      const moved = await categoryService.moveCategory(child.categoryId, parent2.categoryId);

      expect(moved.parentId).toBe(parent2.categoryId);
    });

    test('should prevent moving category to itself', async () => {
      const category = await categoryService.createCategory('Test', 'primary');

      await expect(categoryService.moveCategory(category.categoryId, category.categoryId)).rejects.toThrow('Cannot move category to itself');
    });

    test('should prevent moving category to its descendant', async () => {
      const parent = await categoryService.createCategory('Parent', 'primary');
      const child = await categoryService.createCategory('Child', 'secondary', parent.categoryId);

      await expect(categoryService.moveCategory(parent.categoryId, child.categoryId)).rejects.toThrow('Cannot move category to its own descendant');
    });
  });

  describe('Category Tags', () => {
    test('should add tag to category', async () => {
      const category = await categoryService.createCategory('Tech', 'primary');
      const tag = await taggingService.createTag('JavaScript', 'simple');

      await categoryService.addTagToCategory(category.categoryId, tag.tagId);

      const categories = await categoryService.getCategoriesByTag(tag.tagId);
      expect(categories.length).toBe(1);
      expect(categories[0].categoryId).toBe(category.categoryId);
    });

    test('should remove tag from category', async () => {
      const category = await categoryService.createCategory('Tech', 'primary');
      const tag = await taggingService.createTag('JavaScript', 'simple');

      await categoryService.addTagToCategory(category.categoryId, tag.tagId);
      await categoryService.removeTagFromCategory(category.categoryId, tag.tagId);

      const categories = await categoryService.getCategoriesByTag(tag.tagId);
      expect(categories.length).toBe(0);
    });
  });

  describe('Category Stats', () => {
    test('should get category stats', async () => {
      const category = await categoryService.createCategory('Tech', 'primary');

      const stats = await categoryService.getCategoryStats(category.categoryId);

      expect(stats.categoryId).toBe(category.categoryId);
      expect(stats.categoryName).toBe('Tech');
      expect(stats.totalItems).toBe(0);
    });
  });
});

describe('AutoTaggingServiceImpl', () => {
  let service: TaggingServiceImpl;
  let autoTagService: AutoTaggingServiceImpl;

  beforeEach(() => {
    service = createTaggingService();
    autoTagService = service.getAutoTaggingService() as AutoTaggingServiceImpl;
  });

  describe('Tag Suggestion', () => {
    test('should suggest tags based on content with entity id', async () => {
      const results = await autoTagService.suggestTags('JavaScript JavaScript JavaScript programming language', 'document', { entityId: 'entity1' });

      expect(results.length).toBeGreaterThan(0);
    });

    test('should respect max tags option', async () => {
      const results = await autoTagService.suggestTags('one two three four five six', 'document', { maxTags: 3, entityId: 'entity1' });

      expect(results.length).toBeLessThanOrEqual(3);
    });

    test('should respect confidence threshold', async () => {
      const results = await autoTagService.suggestTags('test content content content', 'document', { confidenceThreshold: 0.5, entityId: 'entity1' });

      for (const result of results) {
        expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      }
    });
  });

  describe('Auto Tag Rules', () => {
    test('should register auto tag rule', () => {
      autoTagService.registerAutoTagRule({
        ruleId: 'rule1',
        name: 'Test Rule',
        entityType: 'document',
        conditions: [{ field: 'content', operator: 'contains', value: 'urgent' }],
        tagId: 'tag1',
        priority: 1,
        isActive: true,
      });

      const rules = autoTagService.getAutoTagRules('document');
      expect(rules.length).toBe(1);
    });

    test('should get rules by entity type', () => {
      autoTagService.registerAutoTagRule({
        ruleId: 'rule1',
        name: 'Doc Rule',
        entityType: 'document',
        conditions: [],
        tagId: 'tag1',
        priority: 1,
        isActive: true,
      });

      autoTagService.registerAutoTagRule({
        ruleId: 'rule2',
        name: 'Image Rule',
        entityType: 'image',
        conditions: [],
        tagId: 'tag2',
        priority: 1,
        isActive: true,
      });

      const docRules = autoTagService.getAutoTagRules('document');
      expect(docRules.length).toBe(1);
    });
  });

  describe('Queue Management', () => {
    test('should get queue status', async () => {
      const status = await autoTagService.getQueueStatus();

      expect(status).toHaveProperty('pending');
      expect(status).toHaveProperty('processing');
      expect(status).toHaveProperty('completed');
      expect(status).toHaveProperty('failed');
    });
  });
});

describe('TagAnalyticsServiceImpl', () => {
  let service: TaggingServiceImpl;
  let analyticsService: TagAnalyticsServiceImpl;

  beforeEach(() => {
    service = createTaggingService();
    analyticsService = service.getAnalyticsService() as TagAnalyticsServiceImpl;
  });

  describe('Tag Usage Tracking', () => {
    test('should track tag usage', async () => {
      const tag = await service.createTag('Test', 'simple');
      await service.assignTag(tag.tagId, 'entity1', 'document');
      await service.assignTag(tag.tagId, 'entity2', 'document');

      const stats = await analyticsService.getTagStats(tag.tagId);

      expect(stats.totalUsage).toBe(2);
      expect(stats.uniqueEntities).toBe(2);
    });

    test('should get tag stats by period', async () => {
      const tag = await service.createTag('Test', 'simple');
      await service.assignTag(tag.tagId, 'entity1', 'document');

      const stats = await analyticsService.getTagStats(tag.tagId, 'month');

      expect(stats.tagId).toBe(tag.tagId);
      expect(stats.usageByPeriod).toHaveProperty('day');
      expect(stats.usageByPeriod).toHaveProperty('week');
      expect(stats.usageByPeriod).toHaveProperty('month');
      expect(stats.usageByPeriod).toHaveProperty('year');
    });
  });

  describe('Top Tags', () => {
    test('should get top tags', async () => {
      const tag1 = await service.createTag('Popular', 'simple');
      const tag2 = await service.createTag('LessPopular', 'simple');

      for (let i = 0; i < 5; i++) {
        await service.assignTag(tag1.tagId, `entity${i}`, 'document');
      }

      for (let i = 0; i < 2; i++) {
        await service.assignTag(tag2.tagId, `entity${i}`, 'document');
      }

      const topTags = await analyticsService.getTopTags(2);

      expect(topTags.length).toBeLessThanOrEqual(2);
      expect(topTags[0].tagId).toBe(tag1.tagId);
    });
  });

  describe('Unused Tags', () => {
    test('should get unused tags', async () => {
      const tag1 = await service.createTag('Used', 'simple');
      const tag2 = await service.createTag('Unused', 'simple');

      await service.assignTag(tag1.tagId, 'entity1', 'document');

      const unusedTags = await analyticsService.getUnusedTags();

      expect(unusedTags.length).toBe(1);
      expect(unusedTags[0].name).toBe('Unused');
    });
  });
});

describe('TagRecommendationServiceImpl', () => {
  let service: TaggingServiceImpl;
  let recommendationService: TagRecommendationServiceImpl;

  beforeEach(() => {
    service = createTaggingService();
    recommendationService = service.getRecommendationService() as TagRecommendationServiceImpl;
  });

  describe('Recommendations', () => {
    test('should generate recommendations', async () => {
      const tag1 = await service.createTag('JavaScript', 'simple');
      const tag2 = await service.createTag('TypeScript', 'simple');
      const tag3 = await service.createTag('Python', 'simple');

      await service.assignTag(tag1.tagId, 'entity1', 'document');
      await service.assignTag(tag2.tagId, 'entity1', 'document');
      await service.assignTag(tag1.tagId, 'entity2', 'document');
      await service.assignTag(tag2.tagId, 'entity2', 'document');
      await service.assignTag(tag3.tagId, 'entity3', 'document');

      const recommendation = await recommendationService.generateRecommendations('entity3', 'document', 5);

      expect(recommendation.entityId).toBe('entity3');
      expect(recommendation.suggestedTags).toBeDefined();
    });
  });

  describe('Co-occurring Tags', () => {
    test('should get co-occurring tags', async () => {
      const tag1 = await service.createTag('Tag1', 'simple');
      const tag2 = await service.createTag('Tag2', 'simple');

      await recommendationService.trainModel({
        entityId: 'entity1',
        entityType: 'document',
        content: 'content',
        tags: [tag1.tagId, tag2.tagId],
      });

      await recommendationService.trainModel({
        entityId: 'entity2',
        entityType: 'document',
        content: 'content',
        tags: [tag1.tagId, tag2.tagId],
      });

      const coOccurring = await recommendationService.getCoOccurringTags(tag1.tagId, 5);

      expect(coOccurring.length).toBeGreaterThan(0);
    });
  });

  describe('Similar Entities', () => {
    test('should get similar entities', async () => {
      const tag1 = await service.createTag('Tag1', 'simple');
      const tag2 = await service.createTag('Tag2', 'simple');

      await service.assignTag(tag1.tagId, 'entity1', 'document');
      await service.assignTag(tag2.tagId, 'entity1', 'document');
      await service.assignTag(tag1.tagId, 'entity2', 'document');
      await service.assignTag(tag2.tagId, 'entity2', 'document');
      await service.assignTag(tag1.tagId, 'entity3', 'document');

      const similar = await recommendationService.getSimilarEntities([tag1.tagId], 'document', 5);

      expect(similar).toBeDefined();
    });
  });
});

describe('TaggingManus', () => {
  let tagging: TaggingManus;

  beforeEach(() => {
    tagging = createTagging();
  });

  describe('Tag Operations', () => {
    test('should create tag via facade', async () => {
      const tag = await tagging.createTag('TestTag', 'simple', 'Description');

      expect(tag.tagId).toBeDefined();
      expect(tag.name).toBe('TestTag');
    });

    test('should list tags via facade', async () => {
      await tagging.createTag('Tag1', 'simple');
      await tagging.createTag('Tag2', 'simple');

      const tags = await tagging.listTags();

      expect(tags.length).toBe(2);
    });

    test('should assign tag via facade', async () => {
      const tag = await tagging.createTag('TestTag', 'simple');
      const assignment = await tagging.assignTag(tag.tagId, 'entity1', 'document');

      expect(assignment.assignmentId).toBeDefined();
    });

    test('should get recommended tags via facade', async () => {
      const recommendation = await tagging.getRecommendedTags('entity1', 'document');

      expect(recommendation.entityId).toBe('entity1');
      expect(recommendation.entityType).toBe('document');
    });
  });

  describe('Category Operations', () => {
    test('should create category via facade', async () => {
      const category = await tagging.createCategory('TestCategory', 'primary', undefined, 'Description');

      expect(category.categoryId).toBeDefined();
      expect(category.name).toBe('TestCategory');
    });

    test('should get category tree via facade', async () => {
      const parent = await tagging.createCategory('Parent', 'primary');
      await tagging.createCategory('Child', 'secondary', parent.categoryId);

      const tree = await tagging.getCategoryTree();

      expect(tree.length).toBe(1);
      expect(tree[0].children.length).toBe(1);
    });
  });

  describe('Service Accessors', () => {
    test('should access category service', () => {
      expect(tagging.category).toBeDefined();
    });

    test('should access auto tag service', () => {
      expect(tagging.autoTag).toBeDefined();
    });

    test('should access analytics service', () => {
      expect(tagging.analytics).toBeDefined();
    });

    test('should access recommendation service', () => {
      expect(tagging.recommendation).toBeDefined();
    });
  });
});

describe('Tag Merge and Split', () => {
  let service: TaggingServiceImpl;

  beforeEach(() => {
    service = createTaggingService();
  });

  describe('Tag Merge', () => {
    test('should merge multiple tags into one', async () => {
      const tag1 = await service.createTag('Tag1', 'simple');
      const tag2 = await service.createTag('Tag2', 'simple');

      await service.assignTag(tag1.tagId, 'entity1', 'document');
      await service.assignTag(tag1.tagId, 'entity2', 'document');
      await service.assignTag(tag2.tagId, 'entity3', 'document');

      const merge = await service.mergeTags([tag1.tagId, tag2.tagId], 'MergedTag');

      expect(merge.mergeId).toBeDefined();
      expect(merge.sourceTagIds.length).toBe(2);
      expect(merge.targetTagId).toBeDefined();
      expect(merge.affectedAssignments).toBe(3);
    });
  });

  describe('Tag Split', () => {
    test('should split tag into multiple tags', async () => {
      const tag = await service.createTag('OldTag', 'simple');

      await service.assignTag(tag.tagId, 'entity1', 'document');
      await service.assignTag(tag.tagId, 'entity2', 'document');
      await service.assignTag(tag.tagId, 'entity3', 'document');
      await service.assignTag(tag.tagId, 'entity4', 'document');

      const split = await service.splitTag(tag.tagId, ['NewTag1', 'NewTag2']);

      expect(split.splitId).toBeDefined();
      expect(split.newTagNames.length).toBe(2);
      expect(split.affectedAssignments).toBe(4);
    });
  });
});

describe('Edge Cases', () => {
  let service: TaggingServiceImpl;

  beforeEach(() => {
    service = createTaggingService();
  });

  test('should handle special characters in tag names', async () => {
    const tag = await service.createTag('Tag with spaces & symbols!', 'simple');

    expect(tag.slug).toBe('tag-with-spaces-symbols');
  });

  test('should handle duplicate tag name with different type', async () => {
    await service.createTag('Test', 'simple');
    const hierarchical = await service.createTag('Test', 'hierarchical');

    expect(hierarchical.type).toBe('hierarchical');
    expect(hierarchical.tagId).not.toBe(await (await service.createTag('Test', 'simple')).tagId);
  });

  test('should handle empty search query', async () => {
    await service.createTag('Tag1', 'simple');
    await service.createTag('Tag2', 'simple');

    const tags = await service.searchTags('');

    expect(tags.length).toBe(2);
  });

  test('should handle list with limit and offset', async () => {
    for (let i = 0; i < 10; i++) {
      await service.createTag(`Tag${i}`, 'simple');
    }

    const page1 = await service.listTags({ limit: 3, offset: 0 });
    const page2 = await service.listTags({ limit: 3, offset: 3 });

    expect(page1.length).toBe(3);
    expect(page2.length).toBe(3);
    expect(page1[0].name).not.toBe(page2[0].name);
  });
});

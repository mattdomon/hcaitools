/**
 * Tagging Service Implementation
 * Tag management system for Manus AI Platform
 */

import crypto from 'crypto';
import {
  Tag,
  Category,
  CategoryTreeNode,
  TagAssignment,
  AutoTagResult,
  TagUsageStats,
  CategoryStats,
  TagRecommendation,
  TagMerge,
  TagSplit,
  TagSearchOptions,
  CategorySearchOptions,
  TaggingService,
  CategoryService,
  AutoTaggingService,
  AutoTagOptions,
  AutoTagRule,
  AutoTagCondition,
  TagAnalyticsService,
  TagRecommendationService,
  TrainingData,
  TagAnalyticsPeriod,
  TagType,
  CategoryLevel,
} from './types';

export class TaggingServiceImpl implements TaggingService {
  private tags: Map<string, Tag> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private entityTags: Map<string, Map<string, Set<string>>> = new Map();
  private tagEntities: Map<string, Set<string>> = new Map();
  private categoryService: CategoryServiceImpl;
  private autoTaggingService: AutoTaggingServiceImpl;
  private analyticsService: TagAnalyticsServiceImpl;
  private recommendationService: TagRecommendationServiceImpl;

  constructor() {
    this.categoryService = new CategoryServiceImpl(this);
    this.autoTaggingService = new AutoTaggingServiceImpl(this);
    this.analyticsService = new TagAnalyticsServiceImpl(this);
    this.recommendationService = new TagRecommendationServiceImpl(this);
  }

  async createTag(name: string, type: TagType, description?: string, color?: string): Promise<Tag> {
    const tagId = this.generateId('tag');
    const slug = this.generateSlug(name);

    const tag: Tag = {
      tagId,
      name,
      slug,
      type,
      description,
      color,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    };

    this.tags.set(tagId, tag);
    this.indexTag(tag);

    return tag;
  }

  async getTag(tagId: string): Promise<Tag | null> {
    return this.tags.get(tagId) || null;
  }

  async updateTag(tagId: string, updates: Partial<Omit<Tag, 'tagId' | 'createdAt'>>): Promise<Tag> {
    const tag = this.tags.get(tagId);
    if (!tag) {
      throw new Error(`Tag ${tagId} not found`);
    }

    const updated: Tag = {
      ...tag,
      ...updates,
      tagId,
      updatedAt: new Date(),
    };

    if (updates.name) {
      updated.slug = this.generateSlug(updates.name);
    }

    this.tags.set(tagId, updated);
    this.reindexTag(updated);

    return updated;
  }

  async deleteTag(tagId: string): Promise<void> {
    const tag = this.tags.get(tagId);
    if (!tag) return;

    this.removeTagIndex(tag);
    this.tags.delete(tagId);

    const entityIds = this.tagEntities.get(tagId);
    if (entityIds) {
      for (const entityKey of entityIds) {
        const [entityId, entityType] = entityKey.split(':');
        this.removeTagFromEntity(tagId, entityId, entityType);
      }
    }
  }

  async listTags(options?: TagSearchOptions): Promise<Tag[]> {
    let tags = Array.from(this.tags.values());

    if (options?.query) {
      const query = options.query.toLowerCase();
      tags = tags.filter((t) => t.name.toLowerCase().includes(query) || t.slug.includes(query));
    }

    if (options?.type) {
      tags = tags.filter((t) => t.type === options.type);
    }

    if (options?.isActive !== undefined) {
      tags = tags.filter((t) => t.isActive === options.isActive);
    }

    tags = this.sortTags(tags, options?.sortBy, options?.sortOrder);

    if (options?.offset) {
      tags = tags.slice(options.offset);
    }

    if (options?.limit) {
      tags = tags.slice(0, options.limit);
    }

    return tags;
  }

  async searchTags(query: string, options?: TagSearchOptions): Promise<Tag[]> {
    return this.listTags({ ...options, query });
  }

  async getTagsByEntity(entityId: string, entityType: string): Promise<Tag[]> {
    const entityKey = `${entityId}:${entityType}`;
    const tagIdMap = this.entityTags.get(entityKey);

    if (!tagIdMap) return [];

    return Array.from(tagIdMap.keys())
      .map((tagId) => this.tags.get(tagId))
      .filter((t): t is Tag => t !== undefined && t.isActive);
  }

  async assignTag(tagId: string, entityId: string, entityType: string, assignedBy?: string): Promise<TagAssignment> {
    const tag = this.tags.get(tagId);
    if (!tag) {
      throw new Error(`Tag ${tagId} not found`);
    }

    const entityKey = `${entityId}:${entityType}`;

    if (!this.entityTags.has(entityKey)) {
      this.entityTags.set(entityKey, new Map());
    }

    const entityTagMap = this.entityTags.get(entityKey)!;
    if (!entityTagMap.has(tagId)) {
      entityTagMap.set(tagId, new Set());
    }

    const assignment: TagAssignment = {
      assignmentId: this.generateId('assign'),
      tagId,
      entityId,
      entityType,
      assignedAt: new Date(),
      assignedBy,
      source: assignedBy ? 'manual' : 'auto',
    };

    entityTagMap.get(tagId)!.add(assignment.assignmentId);

    if (!this.tagEntities.has(tagId)) {
      this.tagEntities.set(tagId, new Set());
    }
    this.tagEntities.get(tagId)!.add(entityKey);

    tag.usageCount++;
    tag.updatedAt = new Date();
    this.tags.set(tagId, tag);

    await this.analyticsService.trackTagUsage(tagId, entityId, entityType);

    return assignment;
  }

  async removeTag(tagId: string, entityId: string, entityType: string): Promise<void> {
    const tag = this.tags.get(tagId);
    if (tag) {
      this.removeTagFromEntity(tagId, entityId, entityType);
    }
  }

  async getOrCreateTag(name: string, type: TagType = 'simple'): Promise<Tag> {
    const slug = this.generateSlug(name);
    const existingTags = await this.searchTags(name);

    for (const tag of existingTags) {
      if (tag.slug === slug && tag.type === type) {
        return tag;
      }
    }

    return this.createTag(name, type);
  }

  async mergeTags(sourceTagIds: string[], targetTagName: string, mergedBy?: string): Promise<TagMerge> {
    const mergeId = this.generateId('merge');

    const targetTag = await this.getOrCreateTag(targetTagName, 'simple');

    let affectedAssignments = 0;

    for (const sourceTagId of sourceTagIds) {
      const entityIds = this.tagEntities.get(sourceTagId);
      if (entityIds) {
        for (const entityKey of entityIds) {
          const [entityId, entityType] = entityKey.split(':');
          await this.removeTag(sourceTagId, entityId, entityType);
          await this.assignTag(targetTag.tagId, entityId, entityType, mergedBy);
          affectedAssignments++;
        }
      }
      await this.deleteTag(sourceTagId);
    }

    return {
      mergeId,
      sourceTagIds,
      targetTagId: targetTag.tagId,
      mergedAt: new Date(),
      mergedBy,
      affectedAssignments,
    };
  }

  async splitTag(tagId: string, newTagNames: string[], splitBy?: string): Promise<TagSplit> {
    const tag = this.tags.get(tagId);
    if (!tag) {
      throw new Error(`Tag ${tagId} not found`);
    }

    const splitId = this.generateId('split');
    const entityIds = this.tagEntities.get(tagId);

    const newTags: Tag[] = [];
    for (const name of newTagNames) {
      const newTag = await this.getOrCreateTag(name, tag.type);
      newTags.push(newTag);
    }

    let affectedAssignments = 0;

    if (entityIds) {
      const entityList = Array.from(entityIds);
      const splitSize = Math.ceil(entityList.length / newTags.length);

      for (let i = 0; i < newTags.length; i++) {
        const start = i * splitSize;
        const end = Math.min(start + splitSize, entityList.length);

        for (let j = start; j < end; j++) {
          const entityKey = entityList[j];
          const [entityId, entityType] = entityKey.split(':');
          await this.removeTag(tagId, entityId, entityType);
          await this.assignTag(newTags[i].tagId, entityId, entityType, splitBy);
          affectedAssignments++;
        }
      }
    }

    await this.deleteTag(tagId);

    return {
      splitId,
      sourceTagId: tagId,
      newTagNames,
      splitAt: new Date(),
      splitBy,
      affectedAssignments,
    };
  }

  async getTagAnalytics(tagId: string, period: TagAnalyticsPeriod): Promise<TagUsageStats> {
    const tag = this.tags.get(tagId);
    if (!tag) {
      throw new Error(`Tag ${tagId} not found`);
    }

    return this.analyticsService.getTagStats(tagId, period);
  }

  async getPopularTags(limit: number, period?: TagAnalyticsPeriod): Promise<Tag[]> {
    const stats = await this.analyticsService.getTopTags(limit, period);
    const tagIds = stats.map((s) => s.tagId);

    return tagIds
      .map((id) => this.tags.get(id))
      .filter((t): t is Tag => t !== undefined);
  }

  async getRecommendedTags(entityId: string, entityType: string, limit: number = 5): Promise<TagRecommendation> {
    return this.recommendationService.generateRecommendations(entityId, entityType, limit);
  }

  getCategoryService(): CategoryService {
    return this.categoryService;
  }

  getAutoTaggingService(): AutoTaggingService {
    return this.autoTaggingService;
  }

  getAnalyticsService(): TagAnalyticsService {
    return this.analyticsService;
  }

  getRecommendationService(): TagRecommendationService {
    return this.recommendationService;
  }

  getAllTags(): Tag[] {
    return Array.from(this.tags.values());
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private indexTag(tag: Tag): void {
    const nameKey = `name:${tag.name.toLowerCase()}`;
    const slugKey = `slug:${tag.slug}`;

    if (!this.tagIndex.has(nameKey)) {
      this.tagIndex.set(nameKey, new Set());
    }
    this.tagIndex.get(nameKey)!.add(tag.tagId);

    if (!this.tagIndex.has(slugKey)) {
      this.tagIndex.set(slugKey, new Set());
    }
    this.tagIndex.get(slugKey)!.add(tag.tagId);
  }

  private removeTagIndex(tag: Tag): void {
    const nameKey = `name:${tag.name.toLowerCase()}`;
    const slugKey = `slug:${tag.slug}`;

    this.tagIndex.get(nameKey)?.delete(tag.tagId);
    this.tagIndex.get(slugKey)?.delete(tag.tagId);
  }

  private reindexTag(tag: Tag): void {
    this.removeTagIndex(tag);
    this.indexTag(tag);
  }

  private removeTagFromEntity(tagId: string, entityId: string, entityType: string): void {
    const entityKey = `${entityId}:${entityType}`;

    this.entityTags.get(entityKey)?.delete(tagId);

    const tagKey = `${entityId}:${entityType}`;
    this.tagEntities.get(tagId)?.delete(tagKey);

    const tag = this.tags.get(tagId);
    if (tag && tag.usageCount > 0) {
      tag.usageCount--;
      tag.updatedAt = new Date();
      this.tags.set(tagId, tag);
    }
  }

  private sortTags(tags: Tag[], sortBy?: string, sortOrder?: 'asc' | 'desc'): Tag[] {
    const order = sortOrder === 'desc' ? -1 : 1;

    switch (sortBy) {
      case 'name':
        return tags.sort((a, b) => order * a.name.localeCompare(b.name));
      case 'usageCount':
        return tags.sort((a, b) => order * (a.usageCount - b.usageCount));
      case 'createdAt':
        return tags.sort((a, b) => order * (a.createdAt.getTime() - b.createdAt.getTime()));
      case 'updatedAt':
        return tags.sort((a, b) => order * (a.updatedAt.getTime() - b.updatedAt.getTime()));
      default:
        return tags;
    }
  }
}

export class CategoryServiceImpl implements CategoryService {
  private categories: Map<string, Category> = new Map();
  private categoryChildren: Map<string, Set<string>> = new Map();
  private categoryTags: Map<string, Set<string>> = new Map();
  private taggingService: TaggingServiceImpl;

  constructor(taggingService: TaggingServiceImpl) {
    this.taggingService = taggingService;
  }

  async createCategory(name: string, level: CategoryLevel, parentId?: string, description?: string): Promise<Category> {
    const categoryId = this.generateId('cat');
    const slug = this.generateSlug(name);

    if (parentId) {
      const parent = await this.getCategory(parentId);
      if (!parent) {
        throw new Error(`Parent category ${parentId} not found`);
      }
    }

    const category: Category = {
      categoryId,
      name,
      slug,
      description,
      level,
      parentId,
      itemCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    };

    this.categories.set(categoryId, category);

    if (parentId) {
      if (!this.categoryChildren.has(parentId)) {
        this.categoryChildren.set(parentId, new Set());
      }
      this.categoryChildren.get(parentId)!.add(categoryId);
    }

    return category;
  }

  async getCategory(categoryId: string): Promise<Category | null> {
    return this.categories.get(categoryId) || null;
  }

  async updateCategory(categoryId: string, updates: Partial<Omit<Category, 'categoryId' | 'createdAt'>>): Promise<Category> {
    const category = this.categories.get(categoryId);
    if (!category) {
      throw new Error(`Category ${categoryId} not found`);
    }

    const updated: Category = {
      ...category,
      ...updates,
      categoryId,
      updatedAt: new Date(),
    };

    if (updates.name) {
      updated.slug = this.generateSlug(updates.name);
    }

    this.categories.set(categoryId, updated);
    return updated;
  }

  async deleteCategory(categoryId: string): Promise<void> {
    const category = this.categories.get(categoryId);
    if (!category) return;

    const children = this.categoryChildren.get(categoryId);
    if (children) {
      for (const childId of children) {
        await this.deleteCategory(childId);
      }
    }

    this.categoryChildren.delete(categoryId);
    this.categoryTags.delete(categoryId);
    this.categories.delete(categoryId);
  }

  async listCategories(options?: CategorySearchOptions): Promise<Category[]> {
    let categories = Array.from(this.categories.values());

    if (options?.query) {
      const query = options.query.toLowerCase();
      categories = categories.filter((c) => c.name.toLowerCase().includes(query) || c.slug.includes(query));
    }

    if (options?.level) {
      categories = categories.filter((c) => c.level === options.level);
    }

    if (options && Object.prototype.hasOwnProperty.call(options, 'parentId')) {
      categories = categories.filter((c) => c.parentId === options.parentId);
    }

    if (options?.isActive !== undefined) {
      categories = categories.filter((c) => c.isActive === options.isActive);
    }

    categories = this.sortCategories(categories, options?.sortBy, options?.sortOrder);

    if (options?.offset) {
      categories = categories.slice(options.offset);
    }

    if (options?.limit) {
      categories = categories.slice(0, options.limit);
    }

    return categories;
  }

  async getCategoryTree(): Promise<CategoryTreeNode[]> {
    const rootCategories = await this.listCategories({ parentId: undefined });
    const result: CategoryTreeNode[] = [];

    for (const category of rootCategories) {
      result.push(await this.buildCategoryTreeNode(category));
    }

    return result;
  }

  async getCategoryPath(categoryId: string): Promise<Category[]> {
    const path: Category[] = [];
    let currentId: string | undefined = categoryId;

    while (currentId) {
      const category = this.categories.get(currentId);
      if (!category) break;
      path.unshift(category);
      currentId = category.parentId;
    }

    return path;
  }

  async addTagToCategory(categoryId: string, tagId: string): Promise<void> {
    const category = this.categories.get(categoryId);
    if (!category) {
      throw new Error(`Category ${categoryId} not found`);
    }

    if (!this.categoryTags.has(categoryId)) {
      this.categoryTags.set(categoryId, new Set());
    }

    this.categoryTags.get(categoryId)!.add(tagId);
  }

  async removeTagFromCategory(categoryId: string, tagId: string): Promise<void> {
    this.categoryTags.get(categoryId)?.delete(tagId);
  }

  async getCategoriesByTag(tagId: string): Promise<Category[]> {
    const result: Category[] = [];

    for (const [categoryId, tagIds] of this.categoryTags.entries()) {
      if (tagIds.has(tagId)) {
        const category = this.categories.get(categoryId);
        if (category) {
          result.push(category);
        }
      }
    }

    return result;
  }

  async getCategoryStats(categoryId: string): Promise<CategoryStats> {
    const category = this.categories.get(categoryId);
    if (!category) {
      throw new Error(`Category ${categoryId} not found`);
    }

    const tagIds = this.categoryTags.get(categoryId);
    const topTags: Array<{ tagId: string; tagName: string; count: number }> = [];

    if (tagIds) {
      for (const tagId of tagIds) {
        const tag = this.taggingService.getAllTags().find((t) => t.tagId === tagId);
        if (tag) {
          topTags.push({ tagId, tagName: tag.name, count: tag.usageCount });
        }
      }
    }

    topTags.sort((a, b) => b.count - a.count);

    const descendantCount = await this.getDescendantCount(categoryId);

    return {
      categoryId,
      categoryName: category.name,
      totalItems: category.itemCount + descendantCount,
      directItems: category.itemCount,
      descendantItems: descendantCount,
      topTags: topTags.slice(0, 10),
      lastUpdated: category.updatedAt,
    };
  }

  async moveCategory(categoryId: string, newParentId?: string): Promise<Category> {
    const category = this.categories.get(categoryId);
    if (!category) {
      throw new Error(`Category ${categoryId} not found`);
    }

    if (newParentId === categoryId) {
      throw new Error('Cannot move category to itself');
    }

    if (newParentId) {
      let ancestorId: string | undefined = newParentId;
      while (ancestorId) {
        if (ancestorId === categoryId) {
          throw new Error('Cannot move category to its own descendant');
        }
        const ancestor = this.categories.get(ancestorId);
        ancestorId = ancestor?.parentId;
      }
    }

    if (category.parentId) {
      this.categoryChildren.get(category.parentId)?.delete(categoryId);
    }

    if (newParentId) {
      if (!this.categoryChildren.has(newParentId)) {
        this.categoryChildren.set(newParentId, new Set());
      }
      this.categoryChildren.get(newParentId)!.add(categoryId);
    }

    return this.updateCategory(categoryId, { parentId: newParentId });
  }

  private async buildCategoryTreeNode(category: Category): Promise<CategoryTreeNode> {
    const childIds = this.categoryChildren.get(category.categoryId);
    const children: CategoryTreeNode[] = [];

    if (childIds) {
      for (const childId of childIds) {
        const childCategory = this.categories.get(childId);
        if (childCategory) {
          children.push(await this.buildCategoryTreeNode(childCategory));
        }
      }
    }

    const tagIds = this.categoryTags.get(category.categoryId);
    const tags: Tag[] = [];

    if (tagIds) {
      for (const tagId of tagIds) {
        const tag = this.taggingService.getAllTags().find((t) => t.tagId === tagId);
        if (tag) {
          tags.push(tag);
        }
      }
    }

    return {
      categoryId: category.categoryId,
      name: category.name,
      slug: category.slug,
      description: category.description,
      level: category.level,
      parentId: category.parentId,
      metadata: category.metadata,
      itemCount: category.itemCount,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      isActive: category.isActive,
      children,
      tags,
    };
  }

  private async getDescendantCount(categoryId: string): Promise<number> {
    let count = 0;
    const childIds = this.categoryChildren.get(categoryId);

    if (childIds) {
      for (const childId of childIds) {
        const child = this.categories.get(childId);
        if (child) {
          count += child.itemCount;
          count += await this.getDescendantCount(childId);
        }
      }
    }

    return count;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private sortCategories(categories: Category[], sortBy?: string, sortOrder?: 'asc' | 'desc'): Category[] {
    const order = sortOrder === 'desc' ? -1 : 1;

    switch (sortBy) {
      case 'name':
        return categories.sort((a, b) => order * a.name.localeCompare(b.name));
      case 'itemCount':
        return categories.sort((a, b) => order * (a.itemCount - b.itemCount));
      case 'createdAt':
        return categories.sort((a, b) => order * (a.createdAt.getTime() - b.createdAt.getTime()));
      default:
        return categories;
    }
  }
}

export class AutoTaggingServiceImpl implements AutoTaggingService {
  private taggingService: TaggingServiceImpl;
  private rules: Map<string, AutoTagRule> = new Map();
  private queue: Map<string, AutoTagResult> = new Map();

  constructor(taggingService: TaggingServiceImpl) {
    this.taggingService = taggingService;
  }

  async suggestTags(content: string, entityType: string, options?: AutoTagOptions): Promise<AutoTagResult[]> {
    const results: AutoTagResult[] = [];
    const applicableRules = this.getAutoTagRules(entityType);

    const contentLower = content.toLowerCase();

    for (const rule of applicableRules) {
      if (!rule.isActive) continue;

      let matched = false;
      for (const condition of rule.conditions) {
        if (this.evaluateCondition(contentLower, condition)) {
          matched = true;
          break;
        }
      }

      if (matched) {
        const result: AutoTagResult = {
          resultId: this.generateId('autor'),
          tagId: rule.tagId,
          entityId: options?.entityId || '',
          entityType,
          confidence: 0.9,
          suggestedAt: new Date(),
          status: 'completed',
          processedAt: new Date(),
        };

        if (options?.entityId) {
          await this.taggingService.assignTag(rule.tagId, options.entityId, entityType, 'ai');
        }

        results.push(result);
      }
    }

    const words = contentLower.split(/\s+/).filter((w) => w.length > 3);
    const wordCounts = new Map<string, number>();

    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }

    const sortedWords = Array.from(wordCounts.entries()).sort((a, b) => b[1] - a[1]);

    const maxTags = options?.maxTags || 5;
    const confidenceThreshold = options?.confidenceThreshold || 0.5;

    for (let i = 0; i < Math.min(maxTags, sortedWords.length); i++) {
      const [word] = sortedWords[i];
      const confidence = Math.min(0.9, 0.3 + sortedWords[i][1] * 0.1);

      if (confidence < confidenceThreshold) continue;

      const tag = await this.taggingService.getOrCreateTag(word, 'simple');

      const result: AutoTagResult = {
        resultId: this.generateId('autor'),
        tagId: tag.tagId,
        entityId: options?.entityId || '',
        entityType,
        confidence,
        suggestedAt: new Date(),
        status: 'completed',
        processedAt: new Date(),
      };

      if (options?.entityId) {
        await this.taggingService.assignTag(tag.tagId, options.entityId, entityType, 'ai');
      }

      results.push(result);
    }

    return results;
  }

  async processQueue(): Promise<number> {
    let processed = 0;

    for (const [jobId, job] of this.queue.entries()) {
      if (job.status === 'pending') {
        job.status = 'processing';
        this.queue.set(jobId, job);

        try {
          job.status = 'completed';
          job.processedAt = new Date();
          processed++;
        } catch (error) {
          job.status = 'failed';
          job.error = error instanceof Error ? error.message : 'Unknown error';
        }

        this.queue.set(jobId, job);
      }
    }

    return processed;
  }

  async getQueueStatus(): Promise<{ pending: number; processing: number; completed: number; failed: number }> {
    let pending = 0;
    let processing = 0;
    let completed = 0;
    let failed = 0;

    for (const job of this.queue.values()) {
      switch (job.status) {
        case 'pending':
          pending++;
          break;
        case 'processing':
          processing++;
          break;
        case 'completed':
          completed++;
          break;
        case 'failed':
          failed++;
          break;
      }
    }

    return { pending, processing, completed, failed };
  }

  async retryFailed(jobId: string): Promise<void> {
    const job = this.queue.get(jobId);
    if (job && job.status === 'failed') {
      job.status = 'pending';
      job.error = undefined;
      this.queue.set(jobId, job);
    }
  }

  async cancelJob(jobId: string): Promise<void> {
    const job = this.queue.get(jobId);
    if (job && (job.status === 'pending' || job.status === 'processing')) {
      job.status = 'failed';
      job.error = 'Cancelled by user';
      this.queue.set(jobId, job);
    }
  }

  registerAutoTagRule(rule: AutoTagRule): void {
    this.rules.set(rule.ruleId, rule);
  }

  getAutoTagRules(entityType?: string): AutoTagRule[] {
    const allRules = Array.from(this.rules.values());

    if (entityType) {
      return allRules.filter((r) => r.entityType === entityType);
    }

    return allRules;
  }

  private evaluateCondition(content: string, condition: AutoTagCondition): boolean {
    const fieldValue = content;

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'contains':
        return fieldValue.includes(String(condition.value));
      case 'startsWith':
        return fieldValue.startsWith(String(condition.value));
      case 'endsWith':
        return fieldValue.endsWith(String(condition.value));
      case 'regex':
        try {
          return new RegExp(String(condition.value)).test(fieldValue);
        } catch {
          return false;
        }
      case 'in':
        if (Array.isArray(condition.value)) {
          return condition.value.some((v) => fieldValue.includes(String(v)));
        }
        return false;
      default:
        return false;
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export class TagAnalyticsServiceImpl implements TagAnalyticsService {
  private usageHistory: Map<string, Array<{ date: Date; entityId: string; entityType: string }>> = new Map();
  private taggingService: TaggingServiceImpl;

  constructor(taggingService: TaggingServiceImpl) {
    this.taggingService = taggingService;
  }

  async trackTagUsage(tagId: string, entityId: string, entityType: string): Promise<void> {
    if (!this.usageHistory.has(tagId)) {
      this.usageHistory.set(tagId, []);
    }

    this.usageHistory.get(tagId)!.push({
      date: new Date(),
      entityId,
      entityType,
    });
  }

  async getTagStats(tagId: string, period?: TagAnalyticsPeriod): Promise<TagUsageStats> {
    const tag = this.taggingService.getAllTags().find((t) => t.tagId === tagId);
    if (!tag) {
      throw new Error(`Tag ${tagId} not found`);
    }

    const history = this.usageHistory.get(tagId) || [];
    const now = new Date();
    const periodStart = this.getPeriodStart(now, period);

    const filteredHistory = history.filter((h) => h.date >= periodStart);
    const uniqueEntities = new Set(filteredHistory.map((h) => `${h.entityId}:${h.entityType}`));

    const usageByPeriod = this.calculateUsageByPeriod(history, period);

    const topEntitiesMap = new Map<string, { entityId: string; entityType: string; count: number }>();

    for (const h of filteredHistory) {
      const key = `${h.entityId}:${h.entityType}`;
      const existing = topEntitiesMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        const [, eId, eType] = key.match(/^([^:]+):(.+)$/) || [];
        topEntitiesMap.set(key, { entityId: eId, entityType: eType, count: 1 });
      }
    }

    const topEntities = Array.from(topEntitiesMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const lastUsed = history.length > 0 ? history[history.length - 1].date : undefined;

    return {
      tagId,
      tagName: tag.name,
      totalUsage: filteredHistory.length,
      uniqueEntities: uniqueEntities.size,
      usageByPeriod,
      topEntities,
      lastUsed,
    };
  }

  async getTopTags(limit: number, period?: TagAnalyticsPeriod): Promise<TagUsageStats[]> {
    const allTags = this.taggingService.getAllTags();
    const stats: TagUsageStats[] = [];

    for (const tag of allTags) {
      try {
        const tagStats = await this.getTagStats(tag.tagId, period);
        stats.push(tagStats);
      } catch {
        stats.push({
          tagId: tag.tagId,
          tagName: tag.name,
          totalUsage: 0,
          uniqueEntities: 0,
          usageByPeriod: { day: 0, week: 0, month: 0, year: 0 },
          topEntities: [],
        });
      }
    }

    return stats.sort((a, b) => b.totalUsage - a.totalUsage).slice(0, limit);
  }

  async getTagsByUsageRange(minUsage: number, maxUsage: number): Promise<Tag[]> {
    const allTags = this.taggingService.getAllTags();

    return allTags.filter((tag) => tag.usageCount >= minUsage && tag.usageCount <= maxUsage);
  }

  async getUnusedTags(): Promise<Tag[]> {
    return this.taggingService.getAllTags().filter((tag) => tag.usageCount === 0);
  }

  async getTagTrends(tagIds: string[], period: TagAnalyticsPeriod): Promise<Array<{ tagId: string; date: Date; count: number }>> {
    const trends: Array<{ tagId: string; date: Date; count: number }> = [];
    const now = new Date();
    const periodStart = this.getPeriodStart(now, period);

    for (const tagId of tagIds) {
      const history = this.usageHistory.get(tagId) || [];
      const filteredHistory = history.filter((h) => h.date >= periodStart);

      const groupedByDate = new Map<string, number>();

      for (const h of filteredHistory) {
        const dateKey = this.getDateKey(h.date, period);
        groupedByDate.set(dateKey, (groupedByDate.get(dateKey) || 0) + 1);
      }

      for (const [dateKey, count] of groupedByDate.entries()) {
        trends.push({
          tagId,
          date: new Date(dateKey),
          count,
        });
      }
    }

    return trends.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  async getCategoryTagDistribution(): Promise<Record<string, Record<string, number>>> {
    const distribution: Record<string, Record<string, number>> = {};
    const categoryService = this.taggingService.getCategoryService() as CategoryServiceImpl;

    const categories = await categoryService.listCategories();

    for (const category of categories) {
      distribution[category.categoryId] = {};
    }

    return distribution;
  }

  private getPeriodStart(date: Date, period?: TagAnalyticsPeriod): Date {
    const d = new Date(date);

    switch (period) {
      case 'day':
        d.setHours(0, 0, 0, 0);
        break;
      case 'week':
        d.setDate(d.getDate() - d.getDay());
        d.setHours(0, 0, 0, 0);
        break;
      case 'month':
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        break;
      case 'year':
        d.setMonth(0, 1);
        d.setHours(0, 0, 0, 0);
        break;
      default:
        d.setMonth(0, 1);
        d.setHours(0, 0, 0, 0);
    }

    return d;
  }

  private calculateUsageByPeriod(history: Array<{ date: Date; entityId: string; entityType: string }>, _period?: TagAnalyticsPeriod): Record<TagAnalyticsPeriod, number> {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    const yearStart = new Date(now.getFullYear(), 0, 1);
    yearStart.setHours(0, 0, 0, 0);

    let day = 0;
    let week = 0;
    let month = 0;
    let year = 0;

    for (const h of history) {
      if (h.date >= dayStart) day++;
      if (h.date >= weekStart) week++;
      if (h.date >= monthStart) month++;
      if (h.date >= yearStart) year++;
    }

    return { day, week, month, year };
  }

  private getDateKey(date: Date, period: TagAnalyticsPeriod): string {
    const d = new Date(date);

    switch (period) {
      case 'day':
        return d.toISOString().split('T')[0];
      case 'week':
        const weekNum = Math.ceil((d.getDate() - d.getDay() + 1) / 7);
        return `${d.getFullYear()}-W${weekNum}`;
      case 'month':
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      case 'year':
        return String(d.getFullYear());
      default:
        return d.toISOString().split('T')[0];
    }
  }
}

export class TagRecommendationServiceImpl implements TagRecommendationService {
  private trainingData: TrainingData[] = [];
  private tagCoOccurrence: Map<string, Map<string, number>> = new Map();
  private taggingService: TaggingServiceImpl;

  constructor(taggingService: TaggingServiceImpl) {
    this.taggingService = taggingService;
  }

  async generateRecommendations(entityId: string, entityType: string, limit: number = 5): Promise<TagRecommendation> {
    const currentTags = await this.taggingService.getTagsByEntity(entityId, entityType);
    const allTags = this.taggingService.getAllTags();

    const currentTagIds = new Set(currentTags.map((t) => t.tagId));
    const availableTags = allTags.filter((t) => !currentTagIds.has(t.tagId) && t.isActive);

    const recommendations: Array<{ tagId: string; tagName: string; confidence: number; reason?: string }> = [];

    for (const tag of availableTags) {
      let confidence = 0;
      let reason: string | undefined;

      const coOccurringTags = await this.getCoOccurringTags(tag.tagId, limit * 2);

      for (const currentTag of currentTags) {
        const coTag = coOccurringTags.find((c) => c.tagId === currentTag.tagId);
        if (coTag) {
          confidence += coTag.coOccurrence;
          reason = `Often used with ${currentTag.name}`;
          break;
        }
      }

      if (currentTags.length === 0) {
        confidence = Math.min(0.5, tag.usageCount / 100);
      }

      if (confidence > 0) {
        recommendations.push({
          tagId: tag.tagId,
          tagName: tag.name,
          confidence: Math.min(0.95, confidence),
          reason,
        });
      }
    }

    recommendations.sort((a, b) => b.confidence - a.confidence);

    return {
      recommendationId: this.generateId('rec'),
      entityId,
      entityType,
      suggestedTags: recommendations.slice(0, limit),
      generatedAt: new Date(),
    };
  }

  async getSimilarEntities(tagIds: string[], entityType: string, limit: number = 10): Promise<Array<{ entityId: string; similarity: number }>> {
    const entityScores: Map<string, number> = new Map();

    const tagIdSet = new Set(tagIds);

    for (const tagId of tagIdSet) {
      const coOccurrence = this.tagCoOccurrence.get(tagId);
      if (coOccurrence) {
        for (const [otherTagId, score] of coOccurrence.entries()) {
          if (tagIdSet.has(otherTagId)) continue;

          const tag = this.taggingService.getAllTags().find((t) => t.tagId === otherTagId);
          if (!tag) continue;

          const taggedEntities = await this.taggingService.getTagsByEntity(otherTagId, entityType);
          for (const entity of taggedEntities) {
            const existing = entityScores.get(entity.tagId) || 0;
            entityScores.set(entity.tagId, existing + score);
          }
        }
      }
    }

    const results: Array<{ entityId: string; similarity: number }> = [];

    for (const [entityId, score] of entityScores.entries()) {
      results.push({ entityId, similarity: score });
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  async getCoOccurringTags(tagId: string, limit: number = 10): Promise<Array<{ tagId: string; tagName: string; coOccurrence: number }>> {
    const coOccurrence = this.tagCoOccurrence.get(tagId);
    const allTags = this.taggingService.getAllTags();

    if (!coOccurrence) {
      return [];
    }

    const results: Array<{ tagId: string; tagName: string; coOccurrence: number }> = [];

    for (const [otherTagId, count] of coOccurrence.entries()) {
      const tag = allTags.find((t) => t.tagId === otherTagId);
      if (tag) {
        results.push({
          tagId: otherTagId,
          tagName: tag.name,
          coOccurrence: count,
        });
      }
    }

    return results.sort((a, b) => b.coOccurrence - a.coOccurrence).slice(0, limit);
  }

  async trainModel(trainingData: TrainingData): Promise<void> {
    this.trainingData.push(trainingData);

    const tagIds = trainingData.tags;
    for (let i = 0; i < tagIds.length; i++) {
      for (let j = i + 1; j < tagIds.length; j++) {
        this.incrementCoOccurrence(tagIds[i], tagIds[j]);
        this.incrementCoOccurrence(tagIds[j], tagIds[i]);
      }
    }
  }

  private incrementCoOccurrence(tagId1: string, tagId2: string): void {
    if (!this.tagCoOccurrence.has(tagId1)) {
      this.tagCoOccurrence.set(tagId1, new Map());
    }

    const existing = this.tagCoOccurrence.get(tagId1)!.get(tagId2) || 0;
    this.tagCoOccurrence.get(tagId1)!.set(tagId2, existing + 1);
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export function createTaggingService(): TaggingServiceImpl {
  return new TaggingServiceImpl();
}

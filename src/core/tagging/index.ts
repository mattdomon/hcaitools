/**
 * Tagging & Categorization Module
 * Tag management system for Manus AI Platform
 */

export {
  TagType,
  CategoryLevel,
  TagAnalyticsPeriod,
  AutoTagStatus,
  Tag,
  HierarchicalTag,
  SimpleTag,
  Category,
  CategoryTreeNode,
  TagAssignment,
  AutoTagResult,
  TagUsageStats,
  CategoryStats,
  TagRecommendation,
  TagMerge,
  TagSplit,
  TagBulkOperation,
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
} from './types';

export {
  TaggingServiceImpl,
  CategoryServiceImpl,
  AutoTaggingServiceImpl,
  TagAnalyticsServiceImpl,
  TagRecommendationServiceImpl,
  createTaggingService,
} from './tagging';

import {
  TaggingServiceImpl,
  createTaggingService,
} from './tagging';

import {
  Tag,
  Category,
  CategoryTreeNode,
  TagSearchOptions,
  CategorySearchOptions,
  TagType,
  CategoryLevel,
  TagAnalyticsPeriod,
  TagRecommendation,
  CategoryStats,
  TagUsageStats,
  CategoryService,
  AutoTaggingService,
  TagAnalyticsService,
  TagRecommendationService,
} from './types';

export class TaggingManus {
  private service: TaggingServiceImpl;

  constructor() {
    this.service = createTaggingService();
  }

  async createTag(name: string, type: TagType = 'simple', description?: string, color?: string): Promise<Tag> {
    return this.service.createTag(name, type, description, color);
  }

  async getTag(tagId: string): Promise<Tag | null> {
    return this.service.getTag(tagId);
  }

  async updateTag(tagId: string, updates: Partial<Omit<Tag, 'tagId' | 'createdAt'>>): Promise<Tag> {
    return this.service.updateTag(tagId, updates);
  }

  async deleteTag(tagId: string): Promise<void> {
    return this.service.deleteTag(tagId);
  }

  async listTags(options?: TagSearchOptions): Promise<Tag[]> {
    return this.service.listTags(options);
  }

  async searchTags(query: string, options?: TagSearchOptions): Promise<Tag[]> {
    return this.service.searchTags(query, options);
  }

  async getTagsByEntity(entityId: string, entityType: string): Promise<Tag[]> {
    return this.service.getTagsByEntity(entityId, entityType);
  }

  async assignTag(tagId: string, entityId: string, entityType: string, assignedBy?: string) {
    return this.service.assignTag(tagId, entityId, entityType, assignedBy);
  }

  async removeTag(tagId: string, entityId: string, entityType: string): Promise<void> {
    return this.service.removeTag(tagId, entityId, entityType);
  }

  async getOrCreateTag(name: string, type?: TagType): Promise<Tag> {
    return this.service.getOrCreateTag(name, type);
  }

  async mergeTags(sourceTagIds: string[], targetTagName: string, mergedBy?: string) {
    return this.service.mergeTags(sourceTagIds, targetTagName, mergedBy);
  }

  async splitTag(tagId: string, newTagNames: string[], splitBy?: string) {
    return this.service.splitTag(tagId, newTagNames, splitBy);
  }

  async getTagAnalytics(tagId: string, period?: TagAnalyticsPeriod): Promise<TagUsageStats> {
    return this.service.getTagAnalytics(tagId, period || 'month');
  }

  async getPopularTags(limit: number, period?: TagAnalyticsPeriod): Promise<Tag[]> {
    return this.service.getPopularTags(limit, period);
  }

  async getRecommendedTags(entityId: string, entityType: string, limit?: number): Promise<TagRecommendation> {
    return this.service.getRecommendedTags(entityId, entityType, limit);
  }

  async createCategory(name: string, level: CategoryLevel, parentId?: string, description?: string): Promise<Category> {
    return this.category.createCategory(name, level, parentId, description);
  }

  async getCategory(categoryId: string): Promise<Category | null> {
    return this.category.getCategory(categoryId);
  }

  async updateCategory(categoryId: string, updates: Partial<Omit<Category, 'categoryId' | 'createdAt'>>): Promise<Category> {
    return this.category.updateCategory(categoryId, updates);
  }

  async deleteCategory(categoryId: string): Promise<void> {
    return this.category.deleteCategory(categoryId);
  }

  async listCategories(options?: CategorySearchOptions): Promise<Category[]> {
    return this.category.listCategories(options);
  }

  async getCategoryTree(): Promise<CategoryTreeNode[]> {
    return this.category.getCategoryTree();
  }

  async getCategoryPath(categoryId: string): Promise<Category[]> {
    return this.category.getCategoryPath(categoryId);
  }

  async addTagToCategory(categoryId: string, tagId: string): Promise<void> {
    return this.category.addTagToCategory(categoryId, tagId);
  }

  async removeTagFromCategory(categoryId: string, tagId: string): Promise<void> {
    return this.category.removeTagFromCategory(categoryId, tagId);
  }

  async getCategoriesByTag(tagId: string): Promise<Category[]> {
    return this.category.getCategoriesByTag(tagId);
  }

  async getCategoryStats(categoryId: string): Promise<CategoryStats> {
    return this.category.getCategoryStats(categoryId);
  }

  async moveCategory(categoryId: string, newParentId?: string): Promise<Category> {
    return this.category.moveCategory(categoryId, newParentId);
  }

  get category(): CategoryService {
    return this.service.getCategoryService();
  }

  get autoTag(): AutoTaggingService {
    return this.service.getAutoTaggingService();
  }

  get analytics(): TagAnalyticsService {
    return this.service.getAnalyticsService();
  }

  get recommendation(): TagRecommendationService {
    return this.service.getRecommendationService();
  }
}

export function createTagging(): TaggingManus {
  return new TaggingManus();
}

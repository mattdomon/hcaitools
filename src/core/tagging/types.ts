/**
 * Tagging & Categorization Types
 * Tag management system for Manus AI Platform
 */

export type TagType = 'simple' | 'hierarchical';
export type CategoryLevel = 'primary' | 'secondary';
export type TagAnalyticsPeriod = 'day' | 'week' | 'month' | 'year';
export type AutoTagStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Tag {
  tagId: string;
  name: string;
  slug: string;
  type: TagType;
  description?: string;
  color?: string;
  metadata?: Record<string, unknown>;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface HierarchicalTag extends Tag {
  type: 'hierarchical';
  parentId?: string;
  children?: string[];
  path?: string[];
  depth?: number;
}

export interface SimpleTag extends Tag {
  type: 'simple';
}

export interface Category {
  categoryId: string;
  name: string;
  slug: string;
  description?: string;
  level: CategoryLevel;
  parentId?: string;
  childIds?: string[];
  tagIds?: string[];
  metadata?: Record<string, unknown>;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface CategoryTreeNode {
  categoryId: string;
  name: string;
  slug: string;
  description?: string;
  level: CategoryLevel;
  parentId?: string;
  metadata?: Record<string, unknown>;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  children: CategoryTreeNode[];
  tags: Tag[];
}

export interface TagAssignment {
  assignmentId: string;
  tagId: string;
  entityId: string;
  entityType: string;
  assignedAt: Date;
  assignedBy?: string;
  confidence?: number;
  source?: 'manual' | 'auto' | 'ai';
}

export interface AutoTagResult {
  resultId: string;
  tagId: string;
  entityId: string;
  entityType: string;
  confidence: number;
  suggestedAt: Date;
  status: AutoTagStatus;
  processedAt?: Date;
  error?: string;
}

export interface TagUsageStats {
  tagId: string;
  tagName: string;
  totalUsage: number;
  uniqueEntities: number;
  usageByPeriod: Record<TagAnalyticsPeriod, number>;
  topEntities: Array<{ entityId: string; entityType: string; count: number }>;
  lastUsed?: Date;
}

export interface CategoryStats {
  categoryId: string;
  categoryName: string;
  totalItems: number;
  directItems: number;
  descendantItems: number;
  topTags: Array<{ tagId: string; tagName: string; count: number }>;
  lastUpdated?: Date;
}

export interface TagRecommendation {
  recommendationId: string;
  entityId: string;
  entityType: string;
  suggestedTags: Array<{
    tagId: string;
    tagName: string;
    confidence: number;
    reason?: string;
  }>;
  generatedAt: Date;
  model?: string;
}

export interface TagMerge {
  mergeId: string;
  sourceTagIds: string[];
  targetTagId: string;
  mergedAt: Date;
  mergedBy?: string;
  affectedAssignments: number;
}

export interface TagSplit {
  splitId: string;
  sourceTagId: string;
  newTagNames: string[];
  splitCriteria?: Record<string, unknown>;
  splitAt: Date;
  splitBy?: string;
  affectedAssignments: number;
}

export interface TagBulkOperation {
  operationId: string;
  type: 'assign' | 'remove' | 'merge' | 'split' | 'update';
  tagIds: string[];
  entityIds?: string[];
  entityType?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processedCount: number;
  totalCount: number;
  errors?: string[];
  startedAt: Date;
  completedAt?: Date;
}

export interface TagSearchOptions {
  query?: string;
  type?: TagType;
  entityType?: string;
  entityId?: string;
  categoryId?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'usageCount' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface CategorySearchOptions {
  query?: string;
  level?: CategoryLevel;
  parentId?: string;
  isActive?: boolean;
  includeStats?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'itemCount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface TaggingService {
  createTag(name: string, type: TagType, description?: string, color?: string): Promise<Tag>;
  getTag(tagId: string): Promise<Tag | null>;
  updateTag(tagId: string, updates: Partial<Omit<Tag, 'tagId' | 'createdAt'>>): Promise<Tag>;
  deleteTag(tagId: string): Promise<void>;
  listTags(options?: TagSearchOptions): Promise<Tag[]>;
  searchTags(query: string, options?: TagSearchOptions): Promise<Tag[]>;
  getTagsByEntity(entityId: string, entityType: string): Promise<Tag[]>;
  assignTag(tagId: string, entityId: string, entityType: string, assignedBy?: string): Promise<TagAssignment>;
  removeTag(tagId: string, entityId: string, entityType: string): Promise<void>;
  getOrCreateTag(name: string, type?: TagType): Promise<Tag>;
  mergeTags(sourceTagIds: string[], targetTagName: string, mergedBy?: string): Promise<TagMerge>;
  splitTag(tagId: string, newTagNames: string[], splitBy?: string): Promise<TagSplit>;
  getTagAnalytics(tagId: string, period: TagAnalyticsPeriod): Promise<TagUsageStats>;
  getPopularTags(limit: number, period?: TagAnalyticsPeriod): Promise<Tag[]>;
  getRecommendedTags(entityId: string, entityType: string, limit?: number): Promise<TagRecommendation>;
}

export interface CategoryService {
  createCategory(name: string, level: CategoryLevel, parentId?: string, description?: string): Promise<Category>;
  getCategory(categoryId: string): Promise<Category | null>;
  updateCategory(categoryId: string, updates: Partial<Omit<Category, 'categoryId' | 'createdAt'>>): Promise<Category>;
  deleteCategory(categoryId: string): Promise<void>;
  listCategories(options?: CategorySearchOptions): Promise<Category[]>;
  getCategoryTree(): Promise<CategoryTreeNode[]>;
  getCategoryPath(categoryId: string): Promise<Category[]>;
  addTagToCategory(categoryId: string, tagId: string): Promise<void>;
  removeTagFromCategory(categoryId: string, tagId: string): Promise<void>;
  getCategoriesByTag(tagId: string): Promise<Category[]>;
  getCategoryStats(categoryId: string): Promise<CategoryStats>;
  moveCategory(categoryId: string, newParentId?: string): Promise<Category>;
}

export interface AutoTaggingService {
  suggestTags(content: string, entityType: string, options?: AutoTagOptions): Promise<AutoTagResult[]>;
  processQueue(): Promise<number>;
  getQueueStatus(): Promise<{ pending: number; processing: number; completed: number; failed: number }>;
  retryFailed(jobId: string): Promise<void>;
  cancelJob(jobId: string): Promise<void>;
  registerAutoTagRule(rule: AutoTagRule): void;
  getAutoTagRules(entityType?: string): AutoTagRule[];
}

export interface AutoTagOptions {
  confidenceThreshold?: number;
  maxTags?: number;
  entityId?: string;
}

export interface AutoTagRule {
  ruleId: string;
  name: string;
  entityType: string;
  conditions: AutoTagCondition[];
  tagId: string;
  priority: number;
  isActive: boolean;
}

export interface AutoTagCondition {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'in';
  value: string | string[];
}

export interface TagAnalyticsService {
  trackTagUsage(tagId: string, entityId: string, entityType: string): Promise<void>;
  getTagStats(tagId: string, period?: TagAnalyticsPeriod): Promise<TagUsageStats>;
  getTopTags(limit: number, period?: TagAnalyticsPeriod): Promise<TagUsageStats[]>;
  getTagsByUsageRange(minUsage: number, maxUsage: number): Promise<Tag[]>;
  getUnusedTags(): Promise<Tag[]>;
  getTagTrends(tagIds: string[], period: TagAnalyticsPeriod): Promise<Array<{ tagId: string; date: Date; count: number }>>;
  getCategoryTagDistribution(): Promise<Record<string, Record<string, number>>>;
}

export interface TagRecommendationService {
  generateRecommendations(entityId: string, entityType: string, limit?: number): Promise<TagRecommendation>;
  getSimilarEntities(tagIds: string[], entityType: string, limit?: number): Promise<Array<{ entityId: string; similarity: number }>>;
  getCoOccurringTags(tagId: string, limit?: number): Promise<Array<{ tagId: string; tagName: string; coOccurrence: number }>>;
  trainModel(trainingData: TrainingData): Promise<void>;
}

export interface TrainingData {
  entityId: string;
  entityType: string;
  content: string;
  tags: string[];
}

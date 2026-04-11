/**
 * Search Engine Integration Types
 * Comprehensive search system supporting elasticsearch, solr, and meilisearch
 */

export type SearchEngineType = 'elasticsearch' | 'solr' | 'meilisearch';
export type IndexType = 'text' | 'geo' | 'numeric' | 'boolean';
export type IndexStatus = 'active' | 'inactive' | 'building' | 'failed';
export type QueryOperator = 'AND' | 'OR' | 'NOT';
export type AggregationType = 'terms' | 'range' | 'histogram' | 'stats' | 'facets';
export type SortOrder = 'asc' | 'desc';
export type SuggestionType = 'prefix' | 'autocomplete' | 'spellcheck';

export interface SearchDocument {
  id: string;
  index: string;
  fields: Record<string, unknown>;
  score?: number;
  highlights?: Record<string, string[]>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IndexField {
  name: string;
  type: IndexType;
  indexed?: boolean;
  stored?: boolean;
  analyzer?: string;
  boost?: number;
  geoField?: GeoField;
}

export interface GeoField {
  lat: number;
  lon: number;
}

export interface SearchIndex {
  indexId: string;
  name: string;
  engine: SearchEngineType;
  fields: IndexField[];
  status: IndexStatus;
  documentCount: number;
  sizeInBytes?: number;
  settings?: IndexSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface IndexSettings {
  numberOfShards?: number;
  numberOfReplicas?: number;
  refreshInterval?: number;
  maxResultWindow?: number;
  analyzers?: Record<string, AnalyzerDefinition>;
}

export interface AnalyzerDefinition {
  type: 'standard' | 'simple' | 'whitespace' | 'language' | 'custom';
  tokenizer?: string;
  filter?: string[];
  language?: string;
}

export interface SearchQuery {
  queryId: string;
  index: string;
  query: QueryClause;
  filters?: QueryFilter[];
  facets?: FacetDefinition[];
  sort?: SortClause[];
  pagination: PaginationParams;
  highlighting?: HighlightingOptions;
  includes?: string[];
  excludes?: string[];
  explain?: boolean;
}

export interface QueryClause {
  type: 'match' | 'matchPhrase' | 'term' | 'terms' | 'range' | 'bool' | 'wildcard' | 'fuzzy' | 'matchAll';
  field?: string;
  value?: string | number | boolean | Record<string, unknown>;
  operator?: QueryOperator;
  boost?: number;
  minimumShouldMatch?: number;
  clauses?: QueryClause[];
  should?: QueryClause[];
  mustNot?: QueryClause[];
}

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'notIn' | 'exists' | 'range';
  value: unknown;
  boost?: number;
}

export interface FacetDefinition {
  name: string;
  type: AggregationType;
  field: string;
  ranges?: FacetRange[];
  size?: number;
}

export interface FacetRange {
  from?: number;
  to?: number;
  label?: string;
}

export interface SortClause {
  field: string;
  order: SortOrder;
  mode?: 'min' | 'max' | 'sum' | 'avg';
  nestedPath?: string;
}

export interface PaginationParams {
  offset: number;
  limit: number;
}

export interface HighlightingOptions {
  fields: Record<string, { preTag?: string; postTag?: string; fragmentSize?: number; numberOfFragments?: number }>;
  preTags?: string[];
  postTags?: string[];
}

export interface SearchResult {
  queryId: string;
  hits: SearchDocument[];
  totalHits: number;
  totalHitsRelation: 'eq' | 'gte';
  maxScore: number;
  took: number;
  facets?: Record<string, FacetResult>;
  suggestions?: SearchSuggestion[];
}

export interface FacetResult {
  name: string;
  type: AggregationType;
  buckets?: FacetBucket[];
  stats?: NumericStats;
}

export interface FacetBucket {
  key: string | number;
  label?: string;
  count: number;
  from?: number;
  to?: number;
}

export interface NumericStats {
  count: number;
  min: number;
  max: number;
  avg: number;
  sum: number;
  stdDeviation?: number;
}

export interface SearchSuggestion {
  text: string;
  type: SuggestionType;
  score: number;
  highlighted?: string;
  options?: SuggestionOption[];
}

export interface SuggestionOption {
  text: string;
  score: number;
  frequency: number;
}

export interface SearchAnalytics {
  searchId: string;
  query: string;
  index: string;
  userId?: string;
  sessionId?: string;
  totalResults: number;
  clickedResults: string[];
  viewedResults: string[];
  took: number;
  filters: Record<string, unknown>;
  facets: Record<string, unknown>;
  timestamp: Date;
}

export interface QueryBuilder {
  index(indexName: string): QueryBuilder;
  match(field: string, value: string, boost?: number): QueryBuilder;
  matchPhrase(field: string, value: string, boost?: number): QueryBuilder;
  term(field: string, value: string | number | boolean, boost?: number): QueryBuilder;
  terms(field: string, values: (string | number | boolean)[], boost?: number): QueryBuilder;
  range(field: string, options: { gt?: number; gte?: number; lt?: number; lte?: number }, boost?: number): QueryBuilder;
  bool(options: { must?: QueryClause[]; should?: QueryClause[]; mustNot?: QueryClause[]; minimumShouldMatch?: number }): QueryBuilder;
  filter(field: string, operator: QueryFilter['operator'], value: unknown): QueryBuilder;
  sort(field: string, order: SortOrder, mode?: SortClause['mode']): QueryBuilder;
  page(offset: number, limit: number): QueryBuilder;
  highlight(fields: string[], options?: HighlightingOptions): QueryBuilder;
  facet(name: string, type: AggregationType, field: string, options?: { ranges?: FacetRange[]; size?: number }): QueryBuilder;
  build(): SearchQuery;
}

export interface IndexManager {
  createIndex(name: string, fields: IndexField[], settings?: IndexSettings): Promise<SearchIndex>;
  getIndex(indexId: string): Promise<SearchIndex | null>;
  updateIndex(indexId: string, updates: Partial<SearchIndex>): Promise<SearchIndex>;
  deleteIndex(indexId: string): Promise<void>;
  listIndexes(): Promise<SearchIndex[]>;
  addField(indexId: string, field: IndexField): Promise<void>;
  removeField(indexId: string, fieldName: string): Promise<void>;
  rebuildIndex(indexId: string): Promise<void>;
}

export interface DocumentManager {
  indexDocument(index: string, doc: Omit<SearchDocument, 'id' | 'index' | 'score' | 'highlights'>): Promise<SearchDocument>;
  indexBulk(index: string, docs: Omit<SearchDocument, 'id' | 'index' | 'score' | 'highlights'>[]): Promise<SearchDocument[]>;
  getDocument(index: string, docId: string): Promise<SearchDocument | null>;
  updateDocument(index: string, docId: string, updates: Partial<SearchDocument>): Promise<SearchDocument>;
  deleteDocument(index: string, docId: string): Promise<void>;
  deleteBulk(index: string, docIds: string[]): Promise<void>;
}

export interface SearchService {
  search(query: SearchQuery): Promise<SearchResult>;
  searchRaw(index: string, query: unknown): Promise<SearchResult>;
  suggest(index: string, prefix: string, options?: SuggestOptions): Promise<SearchSuggestion[]>;
  explain(query: SearchQuery): Promise<QueryExplanation>;
  count(index: string, filters?: QueryFilter[]): Promise<number>;
}

export interface SuggestOptions {
  field: string;
  type?: SuggestionType;
  size?: number;
  fuzzy?: boolean;
  minWordLength?: number;
}

export interface QueryExplanation {
  queryId: string;
  index: string;
  query: unknown;
  parsedQuery: Record<string, unknown>;
  score: number;
  matches: MatchExplanation[];
}

export interface MatchExplanation {
  documentId: string;
  score: number;
  matchedClauses: string[];
  fieldScores: Record<string, number>;
}

export interface SearchEngineService {
  getIndexManager(): IndexManager;
  getDocumentManager(): DocumentManager;
  getSearchService(): SearchService;
  getQueryBuilder(indexName: string): QueryBuilder;
  executeQuery(query: SearchQuery): Promise<SearchResult>;
  getAnalytics(): SearchAnalyticsService;
}

export interface SearchAnalyticsService {
  recordSearch(search: Omit<SearchAnalytics, 'searchId' | 'timestamp'>): Promise<SearchAnalytics>;
  getSearchAnalytics(index: string, period: { start: Date; end: Date }): Promise<SearchAnalyticsSummary>;
  getPopularQueries(index: string, limit: number): Promise<PopularQuery[]>;
  getNoResultQueries(index: string, limit: number): Promise<NoResultQuery[]>;
  getClickThroughRate(index: string): Promise<number>;
}

export interface SearchAnalyticsSummary {
  totalSearches: number;
  uniqueQueries: number;
  uniqueUsers: number;
  averageResults: number;
  averageResponseTime: number;
  topQueries: PopularQuery[];
  noResultQueries: NoResultQuery[];
  clickThroughRate: number;
}

export interface PopularQuery {
  query: string;
  count: number;
  avgResults: number;
  lastSeen: Date;
}

export interface NoResultQuery {
  query: string;
  count: number;
  lastSeen: Date;
  suggestedQuery?: string;
}

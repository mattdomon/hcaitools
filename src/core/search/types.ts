/**
 * Advanced Search & Filtering Types
 * Comprehensive search engine with full-text, faceted, and geo-search capabilities
 */

export type QueryOperator = 'AND' | 'OR' | 'NOT';
export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'startsWith' | 'endsWith';
export type SortOrder = 'asc' | 'desc';
export type TokenizerType = 'simple' | 'standard' | 'whitespace' | 'regex';
export type StemmerLanguage = 'english' | 'spanish' | 'french' | 'german' | 'porter';

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface GeoDistance {
  location: GeoLocation;
  maxDistance: number;
  unit: 'km' | 'mi' | 'm';
}

export interface GeoBoundingBox {
  topLeft: GeoLocation;
  bottomRight: GeoLocation;
}

export interface SearchDocument {
  id: string;
  type: string;
  title: string;
  content: string;
  fields: Record<string, unknown>;
  tags?: string[];
  categories?: string[];
  location?: GeoLocation;
  createdAt: Date;
  updatedAt: Date;
  popularity?: number;
  metadata?: Record<string, unknown>;
}

export interface IndexedDocument extends SearchDocument {
  tokens: Map<string, number[]>;
  stemmedTokens: Map<string, number[]>;
  fieldIndex: Map<string, Map<string, Set<string>>>;
  positionIndex: Map<string, number[]>;
}

export interface SearchQuery {
  query: string;
  fields?: string[];
  operator?: QueryOperator;
  filters?: SearchFilter[];
  geoFilter?: GeoFilter;
  boostFactors?: BoostFactors;
  page?: number;
  pageSize?: number;
  sort?: SortOption[];
  includeFacets?: boolean;
  facetFields?: string[];
  highlight?: HighlightOptions;
}

export interface SearchFilter {
  field: string;
  operator: FilterOperator;
  value: unknown;
  conjunction?: QueryOperator;
}

export interface GeoFilter {
  distance?: GeoDistance;
  boundingBox?: GeoBoundingBox;
}

export interface BoostFactors {
  recency?: number;
  popularity?: number;
  relevance?: number;
}

export interface SortOption {
  field: string;
  order: SortOrder;
}

export interface HighlightOptions {
  fields: string[];
  preTag?: string;
  postTag?: string;
  fragmentSize?: number;
  numberOfFragments?: number;
}

export interface SearchResult {
  document: SearchDocument;
  score: number;
  highlights?: Record<string, string[]>;
  distance?: number;
  rank: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets?: FacetResult[];
  suggestions?: AutocompleteSuggestion[];
  executionTime: number;
}

export interface FacetResult {
  field: string;
  values: FacetValue[];
}

export interface FacetValue {
  value: string;
  count: number;
  selected?: boolean;
}

export interface AutocompleteSuggestion {
  text: string;
  score: number;
  frequency: number;
  type: 'prefix' | 'completion' | 'correction';
}

export interface QueryBuilder {
  setQuery(queryString: string): QueryBuilder;
  addFilter(field: string, operator: FilterOperator, value: unknown): QueryBuilder;
  addGeoFilter(geo: GeoFilter): QueryBuilder;
  addBoost(boost: BoostFactors): QueryBuilder;
  addSort(field: string, order: SortOrder): QueryBuilder;
  setPage(page: number): QueryBuilder;
  setPageSize(pageSize: number): QueryBuilder;
  setOperator(operator: QueryOperator): QueryBuilder;
  build(): SearchQuery;
}

export interface IndexStats {
  totalDocuments: number;
  totalTokens: number;
  indexSize: number;
  lastIndexed: Date;
  fields: string[];
  fieldCounts: Record<string, number>;
}

export interface SearchIndex {
  indexId: string;
  name: string;
  documents: Map<string, IndexedDocument>;
  invertedIndex: Map<string, Map<string, Set<string>>>;
  fieldIndexes: Map<string, Map<string, Set<string>>>;
  geoIndex: Map<string, GeoLocation>;
  stats: IndexStats;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenizerConfig {
  type: TokenizerType;
  pattern?: string;
  lowercase?: boolean;
  stopWords?: string[];
}

export interface StemmerConfig {
  language: StemmerLanguage;
  customRules?: Map<string, string>;
}

export interface IndexingOptions {
  tokenizer?: TokenizerConfig;
  stemmer?: StemmerConfig;
  indexingFields?: string[];
  searchableFields?: string[];
  filterableFields?: string[];
  sortableFields?: string[];
  geoFields?: string[];
}

export interface SearchService {
  index(document: Omit<SearchDocument, 'id'>): Promise<SearchDocument>;
  indexBulk(documents: Omit<SearchDocument, 'id'>[]): Promise<SearchDocument[]>;
  update(documentId: string, updates: Partial<SearchDocument>): Promise<SearchDocument>;
  delete(documentId: string): Promise<void>;
  search(query: SearchQuery): Promise<SearchResponse>;
  suggest(prefix: string, options?: SuggestOptions): Promise<AutocompleteSuggestion[]>;
  reindex(indexId?: string): Promise<void>;
  getStats(): IndexStats;
}

export interface SuggestOptions {
  field?: string;
  size?: number;
  fuzzy?: boolean;
  fuzzyDistance?: number;
  types?: Array<'prefix' | 'completion' | 'correction'>;
}

export interface SearchBuilder {
  query(queryString: string): SearchBuilder;
  filter(field: string, operator: FilterOperator, value: unknown): SearchBuilder;
  geo(geoFilter: GeoFilter): SearchBuilder;
  boost(boostFactors: BoostFactors): SearchBuilder;
  sort(field: string, order: SortOrder): SearchBuilder;
  page(page: number): SearchBuilder;
  pageSize(size: number): SearchBuilder;
  operator(operator: QueryOperator): SearchBuilder;
  facets(fields: string[]): SearchBuilder;
  highlight(fields: string[], options?: Partial<HighlightOptions>): SearchBuilder;
  build(): SearchQuery;
}

export interface RankingFactors {
  tf: number;
  idf: number;
  fieldLength: number;
  position: number;
  boost: number;
  recency: number;
  popularity: number;
}

export interface ScoredToken {
  token: string;
  score: number;
  positions: number[];
}

export interface IndexingPipeline {
  tokenize(text: string, config: TokenizerConfig): string[];
  normalize(tokens: string[], config: TokenizerConfig): string[];
  stem(tokens: string[], config: StemmerConfig): string[];
  indexDocument(document: SearchDocument, options: IndexingOptions): IndexedDocument;
}

export interface SearchPipeline {
  parseQuery(query: SearchQuery): ScoredToken[];
  applyFilters(results: SearchResult[], filters: SearchFilter[]): SearchResult[];
  calculateScores(results: SearchResult[], query: SearchQuery): SearchResult[];
  rank(results: SearchResult[], sort: SortOption[]): SearchResult[];
  highlightResults(results: SearchResult[], options: HighlightOptions): SearchResult[];
}

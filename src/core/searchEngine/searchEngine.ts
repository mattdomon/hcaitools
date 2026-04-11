/**
 * Search Engine Implementation
 * Comprehensive search system supporting elasticsearch, solr, and meilisearch
 */

import crypto from 'crypto';
import {
  SearchDocument,
  IndexField,
  SearchIndex,
  IndexSettings,
  SearchQuery,
  QueryClause,
  QueryFilter,
  FacetDefinition,
  SortClause,
  HighlightingOptions,
  SearchResult,
  FacetResult,
  NumericStats,
  SearchSuggestion,
  SearchAnalytics,
  QueryBuilder,
  IndexManager,
  DocumentManager,
  SearchService,
  SuggestOptions,
  QueryExplanation,
  SearchAnalyticsService,
  SearchAnalyticsSummary,
  PopularQuery,
  NoResultQuery,
  AggregationType,
  SortOrder,
  SearchEngineService,
} from './types';

export class QueryBuilderImpl implements QueryBuilder {
  private query: SearchQuery;
  private idPrefix = 'query';

  constructor(indexName: string) {
    this.query = {
      queryId: this.generateId(this.idPrefix),
      index: indexName,
      query: { type: 'matchAll' } as QueryClause,
      pagination: { offset: 0, limit: 10 },
    };
  }

  index(indexName: string): QueryBuilder {
    this.query.index = indexName;
    return this;
  }

  match(field: string, value: string, boost?: number): QueryBuilder {
    this.query.query = {
      type: 'match',
      field,
      value,
      boost,
    };
    return this;
  }

  matchPhrase(field: string, value: string, boost?: number): QueryBuilder {
    this.query.query = {
      type: 'matchPhrase',
      field,
      value,
      boost,
    };
    return this;
  }

  term(field: string, value: string | number | boolean, boost?: number): QueryBuilder {
    this.query.query = {
      type: 'term',
      field,
      value,
      boost,
    };
    return this;
  }

  terms(field: string, values: (string | number | boolean)[], boost?: number): QueryBuilder {
    this.query.query = {
      type: 'terms',
      field,
      value: values as unknown as string,
      boost,
    };
    return this;
  }

  range(field: string, options: { gt?: number; gte?: number; lt?: number; lte?: number }, boost?: number): QueryBuilder {
    this.query.query = {
      type: 'range',
      field,
      value: options as unknown as string,
      boost,
    };
    return this;
  }

  bool(options: { must?: QueryClause[]; should?: QueryClause[]; mustNot?: QueryClause[]; minimumShouldMatch?: number }): QueryBuilder {
    this.query.query = {
      type: 'bool',
      clauses: [],
      should: options.should,
      mustNot: options.mustNot,
      minimumShouldMatch: options.minimumShouldMatch,
    };
    if (options.must) {
      (this.query.query as QueryClause & { clauses: QueryClause[] }).clauses = options.must;
    }
    return this;
  }

  filter(field: string, operator: QueryFilter['operator'], value: unknown): QueryBuilder {
    if (!this.query.filters) {
      this.query.filters = [];
    }
    this.query.filters.push({ field, operator, value });
    return this;
  }

  sort(field: string, order: SortOrder, mode?: SortClause['mode']): QueryBuilder {
    if (!this.query.sort) {
      this.query.sort = [];
    }
    this.query.sort.push({ field, order, mode });
    return this;
  }

  page(offset: number, limit: number): QueryBuilder {
    this.query.pagination = { offset, limit };
    return this;
  }

  highlight(fields: string[], options?: HighlightingOptions): QueryBuilder {
    this.query.highlighting = options || {
      fields: fields.reduce((acc, f) => ({ ...acc, [f]: {} }), {}),
    };
    return this;
  }

  facet(name: string, type: AggregationType, field: string, options?: { ranges?: FacetDefinition['ranges']; size?: number }): QueryBuilder {
    if (!this.query.facets) {
      this.query.facets = [];
    }
    this.query.facets.push({ name, type, field, size: options?.size, ranges: options?.ranges });
    return this;
  }

  build(): SearchQuery {
    return { ...this.query, queryId: this.generateId(this.idPrefix) };
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export class IndexManagerImpl implements IndexManager {
  private indexes: Map<string, SearchIndex> = new Map();

  async createIndex(name: string, fields: IndexField[], settings?: IndexSettings): Promise<SearchIndex> {
    const indexId = this.generateId('idx');
    const index: SearchIndex = {
      indexId,
      name,
      engine: 'elasticsearch',
      fields,
      status: 'active',
      documentCount: 0,
      settings,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.indexes.set(indexId, index);
    return index;
  }

  async getIndex(indexId: string): Promise<SearchIndex | null> {
    return this.indexes.get(indexId) || null;
  }

  async updateIndex(indexId: string, updates: Partial<SearchIndex>): Promise<SearchIndex> {
    const index = this.indexes.get(indexId);
    if (!index) {
      throw new Error(`Index ${indexId} not found`);
    }
    const updated: SearchIndex = { ...index, ...updates, indexId, updatedAt: new Date() };
    this.indexes.set(indexId, updated);
    return updated;
  }

  async deleteIndex(indexId: string): Promise<void> {
    this.indexes.delete(indexId);
  }

  async listIndexes(): Promise<SearchIndex[]> {
    return Array.from(this.indexes.values());
  }

  async addField(indexId: string, field: IndexField): Promise<void> {
    const index = this.indexes.get(indexId);
    if (!index) {
      throw new Error(`Index ${indexId} not found`);
    }
    index.fields.push(field);
    index.updatedAt = new Date();
  }

  async removeField(indexId: string, fieldName: string): Promise<void> {
    const index = this.indexes.get(indexId);
    if (!index) {
      throw new Error(`Index ${indexId} not found`);
    }
    index.fields = index.fields.filter(f => f.name !== fieldName);
    index.updatedAt = new Date();
  }

  async rebuildIndex(indexId: string): Promise<void> {
    const index = this.indexes.get(indexId);
    if (!index) {
      throw new Error(`Index ${indexId} not found`);
    }
    index.status = 'building';
    index.updatedAt = new Date();
    setTimeout(() => {
      if (this.indexes.has(indexId)) {
        const idx = this.indexes.get(indexId)!;
        idx.status = 'active';
        this.indexes.set(indexId, idx);
      }
    }, 100);
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export class DocumentManagerImpl implements DocumentManager {
  private documents: Map<string, Map<string, SearchDocument>> = new Map();
  private idPrefix = 'doc';

  async indexDocument(index: string, doc: Omit<SearchDocument, 'id' | 'index' | 'score' | 'highlights'>): Promise<SearchDocument> {
    if (!this.documents.has(index)) {
      this.documents.set(index, new Map());
    }
    const document: SearchDocument = {
      ...doc,
      id: this.generateId(this.idPrefix),
      index,
      fields: doc.fields,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.documents.get(index)!.set(document.id, document);
    return document;
  }

  async indexBulk(index: string, docs: Omit<SearchDocument, 'id' | 'index' | 'score' | 'highlights'>[]): Promise<SearchDocument[]> {
    const results: SearchDocument[] = [];
    for (const doc of docs) {
      const indexed = await this.indexDocument(index, doc);
      results.push(indexed);
    }
    return results;
  }

  async getDocument(index: string, docId: string): Promise<SearchDocument | null> {
    return this.documents.get(index)?.get(docId) || null;
  }

  async updateDocument(index: string, docId: string, updates: Partial<SearchDocument>): Promise<SearchDocument> {
    const doc = this.documents.get(index)?.get(docId);
    if (!doc) {
      throw new Error(`Document ${docId} not found in index ${index}`);
    }
    const updated: SearchDocument = { ...doc, ...updates, id: docId, index, updatedAt: new Date() };
    this.documents.get(index)!.set(docId, updated);
    return updated;
  }

  async deleteDocument(index: string, docId: string): Promise<void> {
    this.documents.get(index)?.delete(docId);
  }

  async deleteBulk(index: string, docIds: string[]): Promise<void> {
    const docs = this.documents.get(index);
    if (docs) {
      for (const id of docIds) {
        docs.delete(id);
      }
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export class SearchServiceImpl implements SearchService {
  private documents: Map<string, Map<string, SearchDocument>> = new Map();
  private idPrefix = 'search';

  setDocumentStore(store: Map<string, Map<string, SearchDocument>>): void {
    this.documents = store;
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now();
    const docs = this.documents.get(query.index);
    
    let hits: SearchDocument[] = docs ? Array.from(docs.values()) : [];
    
    hits = this.applyQuery(hits, query.query);
    
    if (query.filters) {
      hits = this.applyFilters(hits, query.filters);
    }
    
    const totalHits = hits.length;
    const maxScore = 1.0;
    
    const facets: Record<string, FacetResult> = {};
    if (query.facets) {
      for (const facet of query.facets) {
        facets[facet.name] = this.computeFacet(hits, facet);
      }
    }
    
    const suggestions = await this.suggest(query.index, '', { field: '_all', size: 0 });
    
    hits = hits.slice(query.pagination.offset, query.pagination.offset + query.pagination.limit);
    
    return {
      queryId: query.queryId,
      hits,
      totalHits,
      totalHitsRelation: totalHits >= 10000 ? 'gte' : 'eq',
      maxScore,
      took: Date.now() - startTime,
      facets: Object.keys(facets).length > 0 ? facets : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  async searchRaw(_index: string, _query: unknown): Promise<SearchResult> {
    return {
      queryId: this.generateId('search'),
      hits: [],
      totalHits: 0,
      totalHitsRelation: 'eq',
      maxScore: 0,
      took: 0,
    };
  }

  async suggest(index: string, prefix: string, options?: SuggestOptions): Promise<SearchSuggestion[]> {
    const docs = this.documents.get(index);
    if (!docs) return [];
    
    const suggestions: SearchSuggestion[] = [];
    const seen = new Set<string>();
    
    for (const doc of docs.values()) {
      for (const [field, value] of Object.entries(doc.fields)) {
        if (options?.field && field !== options.field && options.field !== '_all') continue;
        
        const strValue = String(value).toLowerCase();
        const prefixLower = prefix.toLowerCase();
        
        if (prefix && !strValue.startsWith(prefixLower)) continue;
        
        if (!seen.has(strValue)) {
          seen.add(strValue);
          suggestions.push({
            text: String(value),
            type: 'prefix',
            score: 1.0,
            highlighted: strValue,
          });
        }
      }
      
      if (suggestions.length >= (options?.size || 5)) break;
    }
    
    return suggestions.slice(0, options?.size || 5);
  }

  async explain(query: SearchQuery): Promise<QueryExplanation> {
    return {
      queryId: query.queryId,
      index: query.index,
      query: query.query,
      parsedQuery: this.parseQueryToExplanation(query.query),
      score: 1.0,
      matches: [],
    };
  }

  async count(index: string, filters?: QueryFilter[]): Promise<number> {
    const docs = this.documents.get(index);
    if (!docs) return 0;
    
    let hits = Array.from(docs.values());
    
    if (filters) {
      hits = this.applyFilters(hits, filters);
    }
    
    return hits.length;
  }

  private applyQuery(docs: SearchDocument[], query: QueryClause): SearchDocument[] {
    switch (query.type) {
      case 'match':
        if (query.field && query.value) {
          return docs.filter(doc => {
            const fieldValue = doc.fields[query.field!];
            return fieldValue && String(fieldValue).toLowerCase().includes(String(query.value).toLowerCase());
          });
        }
        return docs;
      case 'matchPhrase':
        if (query.field && query.value) {
          const phrase = String(query.value).toLowerCase();
          return docs.filter(doc => {
            const fieldValue = doc.fields[query.field!];
            return fieldValue && String(fieldValue).toLowerCase().includes(phrase);
          });
        }
        return docs;
      case 'term':
        if (query.field && query.value !== undefined) {
          return docs.filter(doc => doc.fields[query.field!] === query.value);
        }
        return docs;
      case 'terms':
        if (query.field && query.value) {
          const values: unknown[] = Array.isArray(query.value) ? query.value : [query.value];
          return docs.filter(doc => values.some(v => v === doc.fields[query.field!]));
        }
        return docs;
      case 'range':
        if (query.field && query.value) {
          const range = query.value as { gt?: number; gte?: number; lt?: number; lte?: number };
          return docs.filter(doc => {
            const fieldValue = doc.fields[query.field!] as number;
            if (fieldValue === undefined) return false;
            if (range.gt !== undefined && fieldValue <= range.gt) return false;
            if (range.gte !== undefined && fieldValue < range.gte) return false;
            if (range.lt !== undefined && fieldValue >= range.lt) return false;
            if (range.lte !== undefined && fieldValue > range.lte) return false;
            return true;
          });
        }
        return docs;
      case 'bool':
        return this.applyBoolQuery(docs, query);
      default:
        return docs;
    }
  }

  private applyBoolQuery(docs: SearchDocument[], query: QueryClause): SearchDocument[] {
    let result = docs;
    
    if (query.clauses) {
      for (const clause of query.clauses) {
        result = this.applyQuery(result, clause);
      }
    }
    
    if (query.should) {
      const shouldDocs = new Set<SearchDocument>();
      for (const clause of query.should) {
        const matches = this.applyQuery(docs, clause);
        matches.forEach(d => shouldDocs.add(d));
      }
      result = Array.from(shouldDocs);
    }
    
    if (query.mustNot) {
      for (const clause of query.mustNot) {
        const toExclude = this.applyQuery(docs, clause);
        const excludeIds = new Set(toExclude.map(d => d.id));
        result = result.filter(d => !excludeIds.has(d.id));
      }
    }
    
    return result;
  }

  private applyFilters(docs: SearchDocument[], filters: QueryFilter[]): SearchDocument[] {
    return docs.filter(doc => {
      for (const filter of filters) {
        const fieldValue = doc.fields[filter.field];
        
        switch (filter.operator) {
          case 'eq':
            if (fieldValue !== filter.value) return false;
            break;
          case 'neq':
            if (fieldValue === filter.value) return false;
            break;
          case 'gt':
            if (typeof fieldValue !== 'number' || typeof filter.value !== 'number') return false;
            if (fieldValue <= filter.value) return false;
            break;
          case 'gte':
            if (typeof fieldValue !== 'number' || typeof filter.value !== 'number') return false;
            if (fieldValue < filter.value) return false;
            break;
          case 'lt':
            if (typeof fieldValue !== 'number' || typeof filter.value !== 'number') return false;
            if (fieldValue >= filter.value) return false;
            break;
          case 'lte':
            if (typeof fieldValue !== 'number' || typeof filter.value !== 'number') return false;
            if (fieldValue > filter.value) return false;
            break;
          case 'in':
            if (!Array.isArray(filter.value) || !filter.value.includes(fieldValue)) return false;
            break;
          case 'notIn':
            if (Array.isArray(filter.value) && filter.value.includes(fieldValue)) return false;
            break;
          case 'exists':
            if (fieldValue === undefined) return false;
            break;
          case 'range':
            if (typeof fieldValue !== 'number' || typeof filter.value !== 'object') return false;
            break;
        }
      }
      return true;
    });
  }

  private computeFacet(docs: SearchDocument[], facet: FacetDefinition): FacetResult {
    const result: FacetResult = {
      name: facet.name,
      type: facet.type,
    };
    
    switch (facet.type) {
      case 'terms':
        const counts = new Map<string | number, number>();
        for (const doc of docs) {
          const value = doc.fields[facet.field];
          if (value !== undefined) {
            const key = String(value);
            counts.set(key, (counts.get(key) || 0) + 1);
          }
        }
        result.buckets = Array.from(counts.entries())
          .map(([key, count]) => ({ key, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, facet.size || 10);
        break;
      case 'range':
        if (facet.ranges) {
          result.buckets = facet.ranges.map(range => {
            let count = 0;
            for (const doc of docs) {
              const value = doc.fields[facet.field] as number;
              if (value !== undefined) {
                const fromOk = range.from === undefined || value >= range.from;
                const toOk = range.to === undefined || value < range.to;
                if (fromOk && toOk) count++;
              }
            }
            return { key: range.label || `${range.from}-${range.to}`, count, from: range.from, to: range.to };
          });
        }
        break;
      case 'histogram':
        result.buckets = [];
        break;
      case 'stats':
        const values: number[] = [];
        for (const doc of docs) {
          const value = doc.fields[facet.field];
          if (typeof value === 'number') {
            values.push(value);
          }
        }
        if (values.length > 0) {
          result.stats = this.computeStats(values);
        }
        break;
    }
    
    return result;
  }

  private computeStats(values: number[]): NumericStats {
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    let variance = 0;
    for (const v of values) {
      variance += Math.pow(v - avg, 2);
    }
    variance /= count;
    const stdDeviation = Math.sqrt(variance);
    
    return { count, min, max, avg, sum, stdDeviation };
  }

  private parseQueryToExplanation(query: QueryClause): Record<string, unknown> {
    return {
      type: query.type,
      field: query.field,
      value: query.value,
      boost: query.boost,
    };
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export class SearchAnalyticsServiceImpl implements SearchAnalyticsService {
  private analytics: Map<string, SearchAnalytics> = new Map();
  private queryFrequency: Map<string, Map<string, number>> = new Map();
  private noResultQueries: Map<string, Map<string, number>> = new Map();
  private idPrefix = 'sanalytics';

  async recordSearch(search: Omit<SearchAnalytics, 'searchId' | 'timestamp'>): Promise<SearchAnalytics> {
    const fullSearch: SearchAnalytics = {
      ...search,
      searchId: this.generateId(this.idPrefix),
      timestamp: new Date(),
    };
    this.analytics.set(fullSearch.searchId, fullSearch);
    
    if (!this.queryFrequency.has(search.index)) {
      this.queryFrequency.set(search.index, new Map());
    }
    const indexQueries = this.queryFrequency.get(search.index)!;
    const queryKey = this.normalizeQuery(search.query);
    indexQueries.set(queryKey, (indexQueries.get(queryKey) || 0) + 1);
    
    if (search.totalResults === 0) {
      if (!this.noResultQueries.has(search.index)) {
        this.noResultQueries.set(search.index, new Map());
      }
      const indexNoResults = this.noResultQueries.get(search.index)!;
      indexNoResults.set(queryKey, (indexNoResults.get(queryKey) || 0) + 1);
    }
    
    return fullSearch;
  }

  async getSearchAnalytics(index: string, period: { start: Date; end: Date }): Promise<SearchAnalyticsSummary> {
    const searches = Array.from(this.analytics.values()).filter(
      a => a.index === index && a.timestamp >= period.start && a.timestamp <= period.end
    );
    
    const uniqueQueries = new Set(searches.map(s => this.normalizeQuery(s.query)));
    const uniqueUsers = new Set(searches.map(s => s.userId).filter((u): u is string => u !== undefined));
    
    const totalResults = searches.reduce((sum, s) => sum + s.totalResults, 0);
    const totalTime = searches.reduce((sum, s) => sum + s.took, 0);
    
    const popularQueries = await this.getPopularQueries(index, 10);
    const noResult = await this.getNoResultQueries(index, 10);
    const ctr = await this.getClickThroughRate(index);
    
    return {
      totalSearches: searches.length,
      uniqueQueries: uniqueQueries.size,
      uniqueUsers: uniqueUsers.size,
      averageResults: searches.length > 0 ? totalResults / searches.length : 0,
      averageResponseTime: searches.length > 0 ? totalTime / searches.length : 0,
      topQueries: popularQueries,
      noResultQueries: noResult,
      clickThroughRate: ctr,
    };
  }

  async getPopularQueries(index: string, limit: number): Promise<PopularQuery[]> {
    const indexQueries = this.queryFrequency.get(index);
    if (!indexQueries) return [];
    
    return Array.from(indexQueries.entries())
      .map(([query, count]) => ({
        query,
        count,
        avgResults: 0,
        lastSeen: new Date(),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async getNoResultQueries(index: string, limit: number): Promise<NoResultQuery[]> {
    const indexNoResults = this.noResultQueries.get(index);
    if (!indexNoResults) return [];
    
    return Array.from(indexNoResults.entries())
      .map(([query, count]) => ({
        query,
        count,
        lastSeen: new Date(),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async getClickThroughRate(index: string): Promise<number> {
    const searches = Array.from(this.analytics.values()).filter(a => a.index === index);
    if (searches.length === 0) return 0;
    
    const withClicks = searches.filter(s => s.clickedResults.length > 0).length;
    return withClicks / searches.length;
  }

  private normalizeQuery(query: string): string {
    return query.toLowerCase().trim();
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export class SearchEngineServiceImpl implements SearchEngineService {
  private indexManager: IndexManagerImpl;
  private documentManager: DocumentManagerImpl;
  private searchService: SearchServiceImpl;
  private analyticsService: SearchAnalyticsServiceImpl;
  private documents: Map<string, Map<string, SearchDocument>> = new Map();

  constructor() {
    this.indexManager = new IndexManagerImpl();
    this.documentManager = new DocumentManagerImpl();
    this.searchService = new SearchServiceImpl();
    this.analyticsService = new SearchAnalyticsServiceImpl();
    this.searchService.setDocumentStore(this.documents);
  }

  getIndexManager(): IndexManager {
    return this.indexManager;
  }

  getDocumentManager(): DocumentManager {
    return this.documentManager;
  }

  getSearchService(): SearchService {
    return this.searchService;
  }

  getQueryBuilder(indexName: string): QueryBuilder {
    return new QueryBuilderImpl(indexName);
  }

  async executeQuery(query: SearchQuery): Promise<SearchResult> {
    return this.searchService.search(query);
  }

  getAnalytics(): SearchAnalyticsService {
    return this.analyticsService;
  }

  addDocumentToStore(index: string, doc: SearchDocument): void {
    if (!this.documents.has(index)) {
      this.documents.set(index, new Map());
    }
    this.documents.get(index)!.set(doc.id, doc);
    this.searchService.setDocumentStore(this.documents);
  }

  getDocuments(): Map<string, Map<string, SearchDocument>> {
    return this.documents;
  }
}

export function createSearchEngine(): SearchEngineServiceImpl {
  return new SearchEngineServiceImpl();
}

/**
 * Search Engine Module
 * Comprehensive search system for Manus AI Platform
 */

export {
  SearchEngineType,
  IndexType,
  IndexStatus,
  QueryOperator,
  AggregationType,
  SortOrder,
  SuggestionType,
  SearchDocument,
  IndexField,
  GeoField,
  SearchIndex,
  IndexSettings,
  AnalyzerDefinition,
  SearchQuery,
  QueryClause,
  QueryFilter,
  FacetDefinition,
  FacetRange,
  SortClause,
  PaginationParams,
  HighlightingOptions,
  SearchResult,
  FacetResult,
  FacetBucket,
  NumericStats,
  SearchSuggestion,
  SuggestionOption,
  SearchAnalytics,
  QueryBuilder,
  IndexManager,
  DocumentManager,
  SearchService,
  SuggestOptions,
  QueryExplanation,
  MatchExplanation,
  SearchEngineService,
  SearchAnalyticsService,
  SearchAnalyticsSummary,
  PopularQuery,
  NoResultQuery,
} from './types';

export {
  QueryBuilderImpl,
  IndexManagerImpl,
  DocumentManagerImpl,
  SearchServiceImpl,
  SearchAnalyticsServiceImpl,
  SearchEngineServiceImpl,
  createSearchEngine,
} from './searchEngine';

import {
  SearchEngineServiceImpl,
  createSearchEngine,
} from './searchEngine';

import {
  IndexManager,
  DocumentManager,
  SearchService,
  QueryBuilder,
  SearchAnalyticsService,
} from './types';

export class SearchManus {
  private service: SearchEngineServiceImpl;

  constructor() {
    this.service = createSearchEngine();
  }

  get indexes(): IndexManager {
    return this.service.getIndexManager();
  }

  get documents(): DocumentManager {
    return this.service.getDocumentManager();
  }

  get search(): SearchService {
    return this.service.getSearchService();
  }

  get analytics(): SearchAnalyticsService {
    return this.service.getAnalytics();
  }

  createQuery(indexName: string): QueryBuilder {
    return this.service.getQueryBuilder(indexName);
  }

  async executeQuery(query: Parameters<SearchService['search']>[0]) {
    return this.service.executeQuery(query);
  }
}

export function createSearch(): SearchManus {
  return new SearchManus();
}

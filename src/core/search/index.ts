/**
 * Advanced Search & Filtering Module
 * Comprehensive search engine with full-text, faceted, and geo-search capabilities
 */

export {
  QueryOperator,
  FilterOperator,
  SortOrder,
  TokenizerType,
  StemmerLanguage,
  GeoLocation,
  GeoDistance,
  GeoBoundingBox,
  SearchDocument,
  IndexedDocument,
  SearchQuery,
  SearchFilter,
  GeoFilter,
  BoostFactors,
  SortOption,
  HighlightOptions,
  SearchResult,
  SearchResponse,
  FacetResult,
  FacetValue,
  AutocompleteSuggestion,
  QueryBuilder,
  IndexStats,
  SearchIndex,
  TokenizerConfig,
  StemmerConfig,
  IndexingOptions,
  SearchService,
  SuggestOptions,
  SearchBuilder,
  RankingFactors,
  ScoredToken,
  IndexingPipeline,
  SearchPipeline,
} from './types';

export {
  Tokenizer,
  SearchEngine,
  QueryBuilderImpl,
  createSearchEngine,
  createQueryBuilder,
  createTokenizer,
  SearchManus,
  createSearch,
} from './search';

import { SearchManus, createSearch } from './search';

export function createSearchModule(): SearchManus {
  return createSearch();
}

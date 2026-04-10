/**
 * Advanced Search & Filtering Implementation
 * Comprehensive search engine with full-text, faceted, and geo-search capabilities
 */

import crypto from 'crypto';
import {
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
  TokenizerConfig,
  StemmerConfig,
  IndexingOptions,
  SuggestOptions,
  GeoLocation,
  GeoBoundingBox,
  FilterOperator,
  QueryOperator,
  SortOrder,
} from './types';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'were', 'will', 'with'
]);

export class Tokenizer {
  private config: TokenizerConfig;
  private stemmerConfig: StemmerConfig;

  constructor(tokenizerConfig?: Partial<TokenizerConfig>, stemmerConfigConfig?: Partial<StemmerConfig>) {
    this.config = {
      type: tokenizerConfig?.type || 'standard',
      pattern: tokenizerConfig?.pattern || '\\W+',
      lowercase: tokenizerConfig?.lowercase ?? true,
      stopWords: tokenizerConfig?.stopWords || Array.from(STOP_WORDS),
    };
    this.stemmerConfig = {
      language: stemmerConfigConfig?.language || 'english',
      customRules: stemmerConfigConfig?.customRules || new Map(),
    };
  }

  tokenize(text: string): string[] {
    if (!text || typeof text !== 'string') return [];
    
    let tokens: string[];
    const pattern = new RegExp(this.config.pattern || '\\W+');
    
    tokens = text.split(pattern).filter(t => t.length > 0);
    
    if (this.config.lowercase) {
      tokens = tokens.map(t => t.toLowerCase());
    }
    
    if (this.config.stopWords && this.config.stopWords.length > 0) {
      const stopWordsSet = new Set(this.config.stopWords);
      tokens = tokens.filter(t => !stopWordsSet.has(t));
    }
    
    return tokens;
  }

  normalize(tokens: string[]): string[] {
    return tokens.map(t => t.toLowerCase().trim());
  }

  stem(tokens: string[]): string[] {
    return tokens.map(token => this.stemWord(token, this.stemmerConfig.language));
  }

  private stemWord(word: string, language: string): string {
    const lower = word.toLowerCase();
    
    if (this.stemmerConfig.customRules?.has(lower)) {
      return this.stemmerConfig.customRules.get(lower)!;
    }
    
    switch (language) {
      case 'porter':
        return this.porterStem(lower);
      case 'english':
        return this.englishStem(lower);
      case 'spanish':
        return this.spanishStem(lower);
      case 'french':
        return this.frenchStem(lower);
      case 'german':
        return this.germanStem(lower);
      default:
        return lower;
    }
  }

  private porterStem(word: string): string {
    if (word.length <= 2) return word;
    
    word = this.step1a(word);
    word = this.step1b(word);
    word = this.step1c(word);
    word = this.step2(word);
    word = this.step3(word);
    word = this.step4(word);
    word = this.step5a(word);
    word = this.step5b(word);
    
    return word;
  }

  private englishStem(word: string): string {
    return this.porterStem(word);
  }

  private spanishStem(word: string): string {
    const suffixes = ['amiento', 'amiento', 'imiento', 'adora', 'ación', 'antes', 'encia', 'ería', 'ación'];
    for (const suffix of suffixes) {
      if (word.endsWith(suffix) && word.length > suffix.length + 2) {
        return word.slice(0, -suffix.length);
      }
    }
    return word;
  }

  private frenchStem(word: string): string {
    const suffixes = ['issement', 'issements', 'issement', 'issements'];
    for (const suffix of suffixes) {
      if (word.endsWith(suffix) && word.length > suffix.length + 2) {
        return word.slice(0, -suffix.length);
      }
    }
    return word;
  }

  private germanStem(word: string): string {
    const suffixes = ['ungen', 'ung', 'heiten', 'heit', 'schaften', 'schaft'];
    for (const suffix of suffixes) {
      if (word.endsWith(suffix) && word.length > suffix.length + 2) {
        return word.slice(0, -suffix.length);
      }
    }
    return word;
  }

  private step1a(word: string): string {
    if (word.endsWith('sses')) return word.slice(0, -2);
    if (word.endsWith('ies')) return word.slice(0, -2);
    if (word.endsWith('ss')) return word;
    if (word.endsWith('s')) return word.slice(0, -1);
    return word;
  }

  private step1b(word: string): string {
    if (word.endsWith('eed')) {
      const stem = word.slice(0, -3);
      if (this.measure(stem) > 0) return stem;
      return word;
    }
    
    let didRemove = false;
    let result = word;
    
    if ((word.endsWith('ed') || word.endsWith('ing')) && this.hasVowel(word.slice(0, -2))) {
      result = word.slice(0, -2);
      didRemove = true;
    }
    
    if (didRemove && result.endsWith('at') && this.hasVowel(result.slice(0, -2))) {
      result += 'e';
    }
    
    return result;
  }

  private step1c(word: string): string {
    if (word.endsWith('y') && this.hasVowel(word.slice(0, -1))) {
      return word.slice(0, -1) + 'i';
    }
    return word;
  }

  private step2(word: string): string {
    const suffixes: [string, string][] = [
      ['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'],
      ['izer', 'ize'], ['iser', 'ise'], ['abli', 'able'], ['alli', 'al'],
      ['entli', 'ent'], ['eli', 'e'], ['ousli', 'ous'], ['ization', 'ize'],
      ['isation', 'ise'], ['ation', 'ate'], ['ator', 'ate'], ['alism', 'al'],
      ['ation', 'ate'], ['alism', 'al'], ['iveness', 'ive'], ['iveness', 'ive'],
      ['fulness', 'ful'], ['ousness', 'ous'], ['aliti', 'al'], ['iviti', 'ive'],
      ['biliti', 'ble'], ['ality', 'al'], ['ivity', 'ive']
    ];

    for (const [suffix, replacement] of suffixes) {
      if (word.endsWith(suffix)) {
        const stem = word.slice(0, -suffix.length);
        if (this.measure(stem) > 0) {
          return stem + replacement;
        }
      }
    }
    return word;
  }

  private step3(word: string): string {
    const suffixes: [string, string][] = [
      ['icate', 'ic'], ['ative', ''], ['alize', 'al'], ['alise', 'al'],
      ['iciti', 'ic'], ['ical', 'ic'], ['ful', ''], ['ness', '']
    ];

    for (const [suffix, replacement] of suffixes) {
      if (word.endsWith(suffix)) {
        const stem = word.slice(0, -suffix.length);
        if (this.measure(stem) > 0) {
          return stem + replacement;
        }
      }
    }
    return word;
  }

  private step4(word: string): string {
    const suffixes = ['al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant', 'ement',
      'ment', 'ent', 'ion', 'ou', 'ism', 'ate', 'iti', 'ous', 'ive', 'ize', 'ise'];

    for (const suffix of suffixes) {
      if (word.endsWith(suffix)) {
        const stem = word.slice(0, -suffix.length);
        if (this.measure(stem) > 1) {
          return stem;
        }
      }
    }
    return word;
  }

  private step5a(word: string): string {
    if (word.endsWith('e') && this.measure(word.slice(0, -1)) > 1) {
      return word.slice(0, -1);
    }
    if (word.endsWith('e') && this.measure(word.slice(0, -1)) === 1 && !this.isShort(word.slice(0, -1))) {
      return word.slice(0, -1);
    }
    return word;
  }

  private step5b(word: string): string {
    if (this.measure(word) > 1 && word.endsWith('ll')) {
      return word.slice(0, -1);
    }
    return word;
  }

  private measure(word: string): number {
    const cvSequence = this.getCVSequence(word);
    return Math.floor(cvSequence.replace(/c/g, '').length / 2);
  }

  private hasVowel(word: string): boolean {
    return /[aeiou]/.test(word);
  }

  private isShort(word: string): boolean {
    return this.hasVowel(word) && word.length === 3;
  }

  private getCVSequence(word: string): string {
    let sequence = '';
    for (const char of word) {
      if (/[aeiou]/.test(char)) {
        sequence += 'v';
      } else if (/[a-z]/.test(char)) {
        sequence += 'c';
      }
    }
    return sequence;
  }

  indexDocument(document: SearchDocument, options?: IndexingOptions): IndexedDocument {
    const searchFields = options?.searchableFields || ['title', 'content'];
    const tokenConfig: TokenizerConfig = {
      type: options?.tokenizer?.type || 'standard',
      pattern: options?.tokenizer?.pattern || '\\W+',
      lowercase: options?.tokenizer?.lowercase ?? true,
      stopWords: options?.tokenizer?.stopWords || Array.from(STOP_WORDS),
    };
    const stemConfig: StemmerConfig = {
      language: options?.stemmer?.language || 'english',
      customRules: options?.stemmer?.customRules,
    };

    const docTokenizer = new Tokenizer(tokenConfig, stemConfig);
    const tokens = new Map<string, number[]>();
    const stemmedTokens = new Map<string, number[]>();
    const fieldIndex = new Map<string, Map<string, Set<string>>>();
    const positionIndex = new Map<string, number[]>();

    let position = 0;

    for (const field of searchFields) {
      const value = document.fields[field] || (document as unknown as Record<string, unknown>)[field];
      if (typeof value === 'string') {
        const fieldTokens = docTokenizer.tokenize(value);
        const stemmedFieldTokens = docTokenizer.stem(fieldTokens);

        for (let i = 0; i < fieldTokens.length; i++) {
          const token = fieldTokens[i];
          const stemmedToken = stemmedFieldTokens[i];

          if (!tokens.has(token)) {
            tokens.set(token, []);
          }
          tokens.get(token)!.push(position);

          if (!stemmedTokens.has(stemmedToken)) {
            stemmedTokens.set(stemmedToken, []);
          }
          stemmedTokens.get(stemmedToken)!.push(position);

          if (!fieldIndex.has(field)) {
            fieldIndex.set(field, new Map());
          }
          if (!fieldIndex.get(field)!.has(token)) {
            fieldIndex.get(field)!.set(token, new Set());
          }
          fieldIndex.get(field)!.get(token)!.add(String(position));

          positionIndex.set(`${field}_${position}`, [position]);
          position++;
        }
      }
    }

    return {
      ...document,
      tokens,
      stemmedTokens,
      fieldIndex,
      positionIndex,
    };
  }
}

interface SearchIndexData {
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

export class SearchEngine {
  private index: SearchIndexData;
  private tokenizer: Tokenizer;
  private indexingOpts?: IndexingOptions;

  constructor(name: string = 'default', options?: IndexingOptions) {
    const indexId = this.generateId('idx');
    this.index = {
      indexId,
      name,
      documents: new Map(),
      invertedIndex: new Map(),
      fieldIndexes: new Map(),
      geoIndex: new Map(),
      stats: {
        totalDocuments: 0,
        totalTokens: 0,
        indexSize: 0,
        lastIndexed: new Date(),
        fields: [],
        fieldCounts: {},
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tokenizer = new Tokenizer(options?.tokenizer, options?.stemmer);
    this.indexingOpts = options;
  }

  async indexDocument(document: Omit<SearchDocument, 'id'>): Promise<SearchDocument> {
    const docId = this.generateId('doc');
    const fullDocument: SearchDocument = {
      ...document,
      id: docId,
      createdAt: document.createdAt || new Date(),
      updatedAt: document.updatedAt || new Date(),
    };

    const indexedDoc = this.tokenizer.indexDocument(fullDocument, this.indexingOpts);
    this.index.documents.set(docId, indexedDoc);
    
    this.updateInvertedIndex(docId, indexedDoc);
    this.updateFieldIndexes(docId, indexedDoc);
    
    if (fullDocument.location) {
      this.index.geoIndex.set(docId, fullDocument.location);
    }

    this.recomputeStats();

    return fullDocument;
  }

  async indexBulk(documents: Omit<SearchDocument, 'id'>[]): Promise<SearchDocument[]> {
    const results: SearchDocument[] = [];
    for (const doc of documents) {
      const indexed = await this.indexDocument(doc);
      results.push(indexed);
    }
    return results;
  }

  async update(documentId: string, updates: Partial<SearchDocument>): Promise<SearchDocument> {
    const existing = this.index.documents.get(documentId);
    if (!existing) {
      throw new Error(`Document ${documentId} not found`);
    }

    const updated: SearchDocument = {
      ...existing,
      ...updates,
      id: documentId,
      updatedAt: new Date(),
    };

    this.index.documents.delete(documentId);
    const indexedDoc = this.tokenizer.indexDocument(updated, this.indexingOpts);
    this.index.documents.set(documentId, indexedDoc);

    this.updateInvertedIndex(documentId, indexedDoc);
    this.updateFieldIndexes(documentId, indexedDoc);

    if (updated.location) {
      this.index.geoIndex.set(documentId, updated.location);
    } else {
      this.index.geoIndex.delete(documentId);
    }

    this.recomputeStats();

    return updated;
  }

  async delete(documentId: string): Promise<void> {
    const doc = this.index.documents.get(documentId);
    if (!doc) return;

    for (const [, positions] of doc.tokens) {
      for (const pos of positions) {
        const tokenKey = Array.from(doc.tokens.entries()).find(([, p]) => p.includes(pos))?.[0];
        if (tokenKey) {
          const invertedEntry = this.index.invertedIndex.get(tokenKey);
          if (invertedEntry) {
            invertedEntry.delete(documentId);
          }
        }
      }
    }

    for (const [field, fieldMap] of doc.fieldIndex) {
      const indexFieldMap = this.index.fieldIndexes.get(field);
      if (indexFieldMap) {
        for (const [, docIds] of fieldMap) {
          for (const _id of docIds) {
            indexFieldMap.delete(_id);
          }
        }
      }
    }

    this.index.geoIndex.delete(documentId);
    this.index.documents.delete(documentId);

    this.recomputeStats();
  }

  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();

    const page = query.page || 1;
    const pageSize = query.pageSize || 10;

    let results = await this.executeQuery(query);

    if (query.filters && query.filters.length > 0) {
      results = this.applyFilters(results, query.filters);
    }

    if (query.geoFilter) {
      results = this.applyGeoFilter(results, query.geoFilter);
    }

    results = this.calculateScores(results, query);
    
    if (query.sort && query.sort.length > 0) {
      results = this.rankResults(results, query.sort);
    }

    if (query.highlight) {
      results = this.highlightResults(results, query.highlight);
    }

    const total = results.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedResults = results.slice(startIndex, startIndex + pageSize);

    let facets: FacetResult[] | undefined;
    if (query.includeFacets && query.facetFields) {
      facets = this.computeFacets(results, query.facetFields);
    }

    const executionTime = Date.now() - startTime;

    return {
      results: paginatedResults,
      total,
      page,
      pageSize,
      totalPages,
      facets,
      executionTime,
    };
  }

  async suggest(prefix: string, options?: SuggestOptions): Promise<AutocompleteSuggestion[]> {
    const size = options?.size || 5;
    const field = options?.field || 'title';
    const suggestions: AutocompleteSuggestion[] = [];
    const prefixLower = prefix.toLowerCase();

    const seen = new Set<string>();

    for (const [docId, doc] of this.index.documents) {
      if (seen.has(docId)) continue;

      const fieldValue = doc.fields[field] || (doc as unknown as Record<string, unknown>)[field];
      if (typeof fieldValue !== 'string') continue;

      const tokens = this.tokenizer.tokenize(fieldValue);
      
      for (const token of tokens) {
        if (token.toLowerCase().startsWith(prefixLower)) {
          const suggestion: AutocompleteSuggestion = {
            text: token,
            score: this.calculateSuggestionScore(token, prefixLower),
            frequency: 1,
            type: 'prefix',
          };
          
          if (!seen.has(token)) {
            suggestions.push(suggestion);
            seen.add(token);
          }
        }
      }

      if (fieldValue.toLowerCase().startsWith(prefixLower)) {
        const suggestion: AutocompleteSuggestion = {
          text: fieldValue,
          score: this.calculateSuggestionScore(fieldValue, prefixLower) * 1.5,
          frequency: 1,
          type: 'completion',
        };
        
        if (!seen.has(fieldValue)) {
          suggestions.push(suggestion);
          seen.add(fieldValue);
        }
      }
    }

    if (options?.fuzzy) {
      const fuzzyDistance = options?.fuzzyDistance || 2;
      const fuzzyMatches = this.findFuzzyMatches(prefix, suggestions, fuzzyDistance);
      suggestions.push(...fuzzyMatches);
    }

    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, size);
  }

  private findFuzzyMatches(prefix: string, existing: AutocompleteSuggestion[], distance: number): AutocompleteSuggestion[] {
    const matches: AutocompleteSuggestion[] = [];
    
    for (const doc of this.index.documents.values()) {
      const title = String(doc.title);
      const titleTokens = this.tokenizer.tokenize(title);
      
      for (const token of titleTokens) {
        if (this.levenshteinDistance(prefix.toLowerCase(), token.toLowerCase()) <= distance) {
          const exists = existing.some(s => s.text.toLowerCase() === token.toLowerCase());
          if (!exists) {
            matches.push({
              text: token,
              score: 0.5,
              frequency: 1,
              type: 'correction',
            });
          }
        }
      }
    }
    
    return matches;
  }

  private levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  private calculateSuggestionScore(token: string, prefix: string): number {
    const tokenLower = token.toLowerCase();
    let score = 1.0;
    
    if (tokenLower.startsWith(prefix)) {
      score *= 1.5;
    }
    
    score *= (1 - (tokenLower.length - prefix.length) * 0.05);
    
    return Math.max(0.1, score);
  }

  async reindex(_indexId?: string): Promise<void> {
    const documents = Array.from(this.index.documents.values());
    
    this.index.invertedIndex.clear();
    this.index.fieldIndexes.clear();
    this.index.geoIndex.clear();
    this.index.documents.clear();

    for (const doc of documents) {
      const indexedDoc = this.tokenizer.indexDocument(doc, this.indexingOpts);
      this.index.documents.set(doc.id, indexedDoc);
      this.updateInvertedIndex(doc.id, indexedDoc);
      this.updateFieldIndexes(doc.id, indexedDoc);
      if (doc.location) {
        this.index.geoIndex.set(doc.id, doc.location);
      }
    }

    this.recomputeStats();
  }

  getStats(): IndexStats {
    return { ...this.index.stats };
  }

  private executeQuery(query: SearchQuery): SearchResult[] {
    const queryTokens = this.tokenizer.tokenize(query.query);
    const stemmedTokens = this.tokenizer.stem(queryTokens);
    const searchFields = query.fields || ['title', 'content'];
    const results: SearchResult[] = [];

    if (stemmedTokens.length === 0) {
      for (const doc of this.index.documents.values()) {
        results.push({
          document: doc,
          score: 0,
          rank: 0,
        });
      }
      return results;
    }

    for (const doc of this.index.documents.values()) {
      let matches = 0;

      for (const token of stemmedTokens) {
        const docTokens = doc.stemmedTokens.get(token) || [];
        if (docTokens.length > 0) {
          matches++;
        }
      }

      if (matches > 0) {
        const score = this.calculateTFIDF(matches, stemmedTokens.length, doc, searchFields);
        
        results.push({
          document: doc,
          score,
          rank: 0,
        });
      }
    }

    return results;
  }

  applyFilters(results: SearchResult[], filters: SearchFilter[]): SearchResult[] {
    return results.filter(result => {
      for (const filter of filters) {
        if (!this.evaluateFilter(result.document, filter)) {
          return false;
        }
      }
      return true;
    });
  }

  private evaluateFilter(doc: SearchDocument, filter: SearchFilter): boolean {
    const fieldValue = doc.fields[filter.field] ?? (doc as unknown as Record<string, unknown>)[filter.field];

    switch (filter.operator) {
      case 'eq':
        return fieldValue === filter.value;
      case 'neq':
        return fieldValue !== filter.value;
      case 'gt':
        return typeof fieldValue === 'number' && typeof filter.value === 'number' && fieldValue > filter.value;
      case 'gte':
        return typeof fieldValue === 'number' && typeof filter.value === 'number' && fieldValue >= filter.value;
      case 'lt':
        return typeof fieldValue === 'number' && typeof filter.value === 'number' && fieldValue < filter.value;
      case 'lte':
        return typeof fieldValue === 'number' && typeof filter.value === 'number' && fieldValue <= filter.value;
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(fieldValue);
      case 'contains':
        if (typeof fieldValue === 'string' && typeof filter.value === 'string') {
          return fieldValue.toLowerCase().includes(filter.value.toLowerCase());
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.some(v => String(v).toLowerCase().includes(String(filter.value).toLowerCase()));
        }
        return false;
      case 'startsWith':
        return typeof fieldValue === 'string' && typeof filter.value === 'string' && 
          fieldValue.toLowerCase().startsWith(filter.value.toLowerCase());
      case 'endsWith':
        return typeof fieldValue === 'string' && typeof filter.value === 'string' && 
          fieldValue.toLowerCase().endsWith(filter.value.toLowerCase());
      default:
        return false;
    }
  }

  applyGeoFilter(results: SearchResult[], geoFilter: GeoFilter): SearchResult[] {
    if (!geoFilter.distance && !geoFilter.boundingBox) {
      return results;
    }

    return results.filter(result => {
      if (!result.document.location) return false;

      if (geoFilter.distance) {
        const distance = this.calculateDistance(result.document.location, geoFilter.distance.location);
        result.distance = distance;
        return distance <= geoFilter.distance.maxDistance;
      }

      if (geoFilter.boundingBox) {
        return this.isInBoundingBox(result.document.location, geoFilter.boundingBox);
      }

      return false;
    });
  }

  private calculateDistance(point1: GeoLocation, point2: GeoLocation): number {
    const R = 6371;
    const dLat = this.toRad(point2.latitude - point1.latitude);
    const dLon = this.toRad(point2.longitude - point1.longitude);
    const lat1 = this.toRad(point1.latitude);
    const lat2 = this.toRad(point2.latitude);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private isInBoundingBox(location: GeoLocation, bbox: GeoBoundingBox): boolean {
    const { topLeft, bottomRight } = bbox;
    return (
      location.latitude <= topLeft.latitude &&
      location.latitude >= bottomRight.latitude &&
      location.longitude >= topLeft.longitude &&
      location.longitude <= bottomRight.longitude
    );
  }

  calculateScores(results: SearchResult[], query: SearchQuery): SearchResult[] {
    const boost = query.boostFactors || {};

    for (const result of results) {
      let score = result.score;

      if (boost.recency && boost.recency > 0) {
        const ageInDays = (Date.now() - result.document.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
        const recencyScore = Math.exp(-ageInDays / 30);
        score += boost.recency * recencyScore;
      }

      if (boost.popularity && result.document.popularity) {
        score += boost.popularity * Math.log(result.document.popularity + 1);
      }

      result.score = score;
    }

    return results.sort((a, b) => b.score - a.score);
  }

  rankResults(results: SearchResult[], sortOptions: SortOption[]): SearchResult[] {
    return [...results].sort((a, b) => {
      for (const sort of sortOptions) {
        const aValue = a.document.fields[sort.field] ?? (a.document as unknown as Record<string, unknown>)[sort.field];
        const bValue = b.document.fields[sort.field] ?? (b.document as unknown as Record<string, unknown>)[sort.field];

        let comparison = 0;
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else if (aValue instanceof Date && bValue instanceof Date) {
          comparison = aValue.getTime() - bValue.getTime();
        }

        if (comparison !== 0) {
          return sort.order === 'desc' ? -comparison : comparison;
        }
      }
      return b.score - a.score;
    });
  }

  highlightResults(results: SearchResult[], options: HighlightOptions): SearchResult[] {
    const preTag = options.preTag || '<em>';
    const postTag = options.postTag || '</em>';

    for (const result of results) {
      const highlights: Record<string, string[]> = {};
      
      for (const field of options.fields) {
        const fieldValue = result.document.fields[field] || (result.document as unknown as Record<string, unknown>)[field];
        if (typeof fieldValue !== 'string') continue;

        const fragments: string[] = [];
        
        let fragment = fieldValue;
        const tokens = this.tokenizer.tokenize(result.document.title || '');
        for (const token of tokens) {
          const regex = new RegExp(`(${token})`, 'gi');
          fragment = fragment.replace(regex, `${preTag}$1${postTag}`);
        }

        if (options.fragmentSize && options.numberOfFragments) {
          const words = fragment.split(' ');
          const fragmentSize = options.fragmentSize;
          for (let i = 0; i < options.numberOfFragments && i * fragmentSize < words.length; i++) {
            const start = i * fragmentSize;
            const end = Math.min(start + fragmentSize, words.length);
            fragments.push(words.slice(start, end).join(' '));
          }
        } else {
          fragments.push(fragment);
        }

        highlights[field] = fragments;
      }

      result.highlights = highlights;
    }

    return results;
  }

  private calculateTFIDF(matchCount: number, queryLength: number, doc: IndexedDocument, searchFields: string[]): number {
    let totalFieldLength = 0;
    let docFreq = 0;

    for (const field of searchFields) {
      const fieldValue = doc.fields[field] || (doc as unknown as Record<string, unknown>)[field];
      if (typeof fieldValue === 'string') {
        totalFieldLength += fieldValue.length;
      }
    }

    if (totalFieldLength === 0) {
      return 0;
    }

    const tf = matchCount / Math.max(1, totalFieldLength);
    const avgFieldLength = totalFieldLength / Math.max(1, searchFields.length);
    const fieldLengthNorm = 1 / Math.sqrt(Math.max(0.1, avgFieldLength));

    doc.stemmedTokens.forEach(() => {
      for (const [, docIds] of this.index.invertedIndex) {
        if (docIds.has(doc.id)) {
          docFreq++;
        }
      }
    });

    const idf = Math.log(Math.max(1, this.index.documents.size) / Math.max(1, docFreq));

    const score = tf * idf * fieldLengthNorm * queryLength;
    return Math.max(0.001, score);
  }

  private updateInvertedIndex(docId: string, doc: IndexedDocument): void {
    for (const [token, positions] of doc.stemmedTokens) {
      if (!this.index.invertedIndex.has(token)) {
        this.index.invertedIndex.set(token, new Map());
      }
      this.index.invertedIndex.get(token)!.set(docId, new Set(positions.map(p => String(p))));
    }
  }

  private updateFieldIndexes(docId: string, doc: IndexedDocument): void {
    for (const [field, fieldMap] of doc.fieldIndex) {
      if (!this.index.fieldIndexes.has(field)) {
        this.index.fieldIndexes.set(field, new Map());
      }
      this.index.fieldIndexes.get(field)!.set(docId, new Set());
      for (const [, positions] of fieldMap) {
        for (const pos of positions) {
          this.index.fieldIndexes.get(field)!.get(docId)!.add(pos);
        }
      }
    }
  }

  private recomputeStats(): void {
    const fields = new Set<string>();
    const fieldCounts: Record<string, number> = {};
    let totalTokens = 0;

    for (const doc of this.index.documents.values()) {
      for (const field of Object.keys(doc.fields)) {
        fields.add(field);
        fieldCounts[field] = (fieldCounts[field] || 0) + 1;
      }
      for (const [, positions] of doc.tokens) {
        totalTokens += positions.length;
      }
    }

    this.index.stats = {
      totalDocuments: this.index.documents.size,
      totalTokens,
      indexSize: totalTokens * 8,
      lastIndexed: new Date(),
      fields: Array.from(fields),
      fieldCounts,
    };
    this.index.updatedAt = new Date();
  }

  private computeFacets(results: SearchResult[], facetFields: string[]): FacetResult[] {
    const facets: FacetResult[] = [];

    for (const field of facetFields) {
      const valueCounts = new Map<string, number>();

      for (const result of results) {
        const value = result.document.fields[field];
        if (value !== undefined) {
          const key = String(value);
          valueCounts.set(key, (valueCounts.get(key) || 0) + 1);
        }
      }

      const values: FacetValue[] = [];
      for (const [value, count] of valueCounts) {
        values.push({ value, count });
      }

      values.sort((a, b) => b.count - a.count);

      facets.push({ field, values });
    }

    return facets;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export class QueryBuilderImpl implements QueryBuilder {
  private queryString: string = '';
  private filters: SearchFilter[] = [];
  private geoFilter?: GeoFilter;
  private boostFactors: BoostFactors = {};
  private sort: SortOption[] = [];
  private page: number = 1;
  private pageSize: number = 10;
  private operator: QueryOperator = 'AND';

  setQuery(q: string): QueryBuilder {
    this.queryString = q;
    return this;
  }

  addFilter(field: string, operator: FilterOperator, value: unknown): QueryBuilder {
    this.filters.push({ field, operator, value });
    return this;
  }

  addGeoFilter(geo: GeoFilter): QueryBuilder {
    this.geoFilter = geo;
    return this;
  }

  addBoost(boost: BoostFactors): QueryBuilder {
    this.boostFactors = boost;
    return this;
  }

  addSort(field: string, order: SortOrder): QueryBuilder {
    this.sort.push({ field, order });
    return this;
  }

  setPage(p: number): QueryBuilder {
    this.page = p;
    return this;
  }

  setPageSize(size: number): QueryBuilder {
    this.pageSize = size;
    return this;
  }

  setOperator(op: QueryOperator): QueryBuilder {
    this.operator = op;
    return this;
  }

  build(): SearchQuery {
    return {
      query: this.queryString,
      filters: this.filters,
      geoFilter: this.geoFilter,
      boostFactors: this.boostFactors,
      sort: this.sort,
      page: this.page,
      pageSize: this.pageSize,
      operator: this.operator,
    };
  }
}

export function createSearchEngine(name?: string, options?: IndexingOptions): SearchEngine {
  return new SearchEngine(name, options);
}

export function createQueryBuilder(): QueryBuilder {
  return new QueryBuilderImpl();
}

export function createTokenizer(config?: Partial<TokenizerConfig>, stemmerConfig?: Partial<StemmerConfig>): Tokenizer {
  return new Tokenizer(config, stemmerConfig);
}

export class SearchManus {
  private engine: SearchEngine;
  private builder: QueryBuilderImpl;

  constructor(name?: string, options?: IndexingOptions) {
    this.engine = createSearchEngine(name, options);
    this.builder = new QueryBuilderImpl();
  }

  async indexDocument(doc: Omit<SearchDocument, 'id'>): Promise<SearchDocument> {
    return this.engine.indexDocument(doc);
  }

  async indexDocuments(docs: Omit<SearchDocument, 'id'>[]): Promise<SearchDocument[]> {
    return this.engine.indexBulk(docs);
  }

  async updateDocument(docId: string, updates: Partial<SearchDocument>): Promise<SearchDocument> {
    return this.engine.update(docId, updates);
  }

  async deleteDocument(docId: string): Promise<void> {
    return this.engine.delete(docId);
  }

  async search(queryOrString: SearchQuery | string): Promise<SearchResponse> {
    let query: SearchQuery;
    if (typeof queryOrString === 'string') {
      query = this.builder.setQuery(queryOrString).build();
    } else {
      query = queryOrString;
    }
    return this.engine.search(query);
  }

  async suggest(prefix: string, options?: SuggestOptions): Promise<AutocompleteSuggestion[]> {
    return this.engine.suggest(prefix, options);
  }

  async reindex(): Promise<void> {
    return this.engine.reindex();
  }

  getStats(): IndexStats {
    return this.engine.getStats();
  }

  newQuery(): QueryBuilder {
    this.builder = new QueryBuilderImpl();
    return this.builder;
  }

  setQuery(queryString: string): SearchManus {
    this.builder = new QueryBuilderImpl();
    this.builder.setQuery(queryString);
    return this;
  }

  addFilter(field: string, operator: FilterOperator, value: unknown): SearchManus {
    this.builder.addFilter(field, operator, value);
    return this;
  }

  addGeoFilter(geo: GeoFilter): SearchManus {
    this.builder.addGeoFilter(geo);
    return this;
  }

  setBoost(boost: BoostFactors): SearchManus {
    this.builder.addBoost(boost);
    return this;
  }

  addSort(field: string, order: SortOrder): SearchManus {
    this.builder.addSort(field, order);
    return this;
  }

  setPage(p: number): SearchManus {
    this.builder.setPage(p);
    return this;
  }

  setPageSize(size: number): SearchManus {
    this.builder.setPageSize(size);
    return this;
  }

  setOperator(op: QueryOperator): SearchManus {
    this.builder.setOperator(op);
    return this;
  }

  async executeSearch(): Promise<SearchResponse> {
    return this.engine.search(this.builder.build());
  }
}

export function createSearch(): SearchManus {
  return new SearchManus();
}

/**
 * Advanced Search & Filtering Tests
 * Comprehensive tests for the search engine
 */

import {
  SearchEngine,
  Tokenizer,
  QueryBuilderImpl,
  SearchManus,
  createSearchEngine,
  createQueryBuilder,
  createTokenizer,
  createSearch,
} from '../src/core/search/search';

import {
  SearchDocument,
  SearchQuery,
  SearchFilter,
  GeoLocation,
  GeoDistance,
  GeoBoundingBox,
  FilterOperator,
  QueryOperator,
  SortOrder,
  IndexingOptions,
  SuggestOptions,
  BoostFactors,
  HighlightOptions,
} from '../src/core/search/types';

describe('Advanced Search & Filtering', () => {
  describe('Tokenizer', () => {
    let tokenizer: Tokenizer;

    beforeEach(() => {
      tokenizer = createTokenizer();
    });

    test('should tokenize simple text', () => {
      const tokens = tokenizer.tokenize('Hello World');
      expect(tokens).toContain('hello');
      expect(tokens).toContain('world');
    });

    test('should tokenize text with special characters', () => {
      const tokens = tokenizer.tokenize('hello@world.com');
      expect(tokens).toContain('hello');
      expect(tokens).toContain('world');
      expect(tokens).toContain('com');
    });

    test('should remove stop words', () => {
      const tokens = tokenizer.tokenize('the quick brown fox');
      expect(tokens).not.toContain('the');
      expect(tokens).toContain('quick');
      expect(tokens).toContain('brown');
      expect(tokens).toContain('fox');
    });

    test('should normalize tokens to lowercase', () => {
      const tokens = tokenizer.tokenize('HELLO World');
      expect(tokens).toContain('hello');
      expect(tokens).toContain('world');
    });

    test('should stem English words', () => {
      const tokens = tokenizer.tokenize('running quickly');
      const stemmed = tokenizer.stem(tokens);
      expect(stemmed.some(t => t.startsWith('run'))).toBe(true);
      expect(stemmed.some(t => t.startsWith('quick'))).toBe(true);
    });

    test('should tokenize empty string', () => {
      const tokens = tokenizer.tokenize('');
      expect(tokens).toEqual([]);
    });

    test('should tokenize string with only stop words', () => {
      const tokens = tokenizer.tokenize('the a an and');
      expect(tokens).toEqual([]);
    });

    test('should handle whitespace tokenizer', () => {
      const whitespaceTokenizer = createTokenizer({ type: 'whitespace' });
      const tokens = whitespaceTokenizer.tokenize('hello world test');
      expect(tokens).toEqual(['hello', 'world', 'test']);
    });
  });

  describe('SearchEngine - Indexing', () => {
    let engine: SearchEngine;

    beforeEach(async () => {
      engine = createSearchEngine('test-index');
    });

    test('should index a document', async () => {
      const doc: Omit<SearchDocument, 'id'> = {
        type: 'article',
        title: 'Test Article',
        content: 'This is a test article content',
        fields: { author: 'John', category: 'tech' },
        tags: ['test', 'article'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const indexed = await engine.indexDocument(doc);
      expect(indexed.id).toBeDefined();
      expect(indexed.title).toBe('Test Article');
    });

    test('should index multiple documents', async () => {
      const docs: Omit<SearchDocument, 'id'>[] = [
        {
          type: 'article',
          title: 'First Article',
          content: 'First article content',
          fields: { author: 'John' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          type: 'article',
          title: 'Second Article',
          content: 'Second article content',
          fields: { author: 'Jane' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const results = await engine.indexBulk(docs);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBeDefined();
      expect(results[1].id).toBeDefined();
    });

    test('should update a document', async () => {
      const doc: Omit<SearchDocument, 'id'> = {
        type: 'article',
        title: 'Original Title',
        content: 'Original content',
        fields: { author: 'John' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const indexed = await engine.indexDocument(doc);
      const updated = await engine.update(indexed.id, { title: 'Updated Title' });
      expect(updated.title).toBe('Updated Title');
    });

    test('should delete a document', async () => {
      const doc: Omit<SearchDocument, 'id'> = {
        type: 'article',
        title: 'To Delete',
        content: 'Content to delete',
        fields: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const indexed = await engine.indexDocument(doc);
      await engine.delete(indexed.id);
      const stats = engine.getStats();
      expect(stats.totalDocuments).toBe(0);
    });

    test('should track index statistics', async () => {
      const docs: Omit<SearchDocument, 'id'>[] = [
        {
          type: 'article',
          title: 'Article One',
          content: 'Content one',
          fields: { author: 'John', category: 'tech' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          type: 'article',
          title: 'Article Two',
          content: 'Content two',
          fields: { author: 'Jane', category: 'science' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await engine.indexBulk(docs);
      const stats = engine.getStats();
      expect(stats.totalDocuments).toBe(2);
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.fields).toContain('author');
      expect(stats.fields).toContain('category');
    });
  });

  describe('SearchEngine - Basic Search', () => {
    let engine: SearchEngine;

    beforeEach(async () => {
      engine = createSearchEngine('test-search');
      await engine.indexBulk([
        {
          type: 'article',
          title: 'JavaScript Tutorial',
          content: 'Learn JavaScript programming',
          fields: { author: 'John', category: 'programming', views: 100 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          type: 'article',
          title: 'TypeScript Guide',
          content: 'Master TypeScript development',
          fields: { author: 'Jane', category: 'programming', views: 200 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          type: 'article',
          title: 'Python Basics',
          content: 'Python programming for beginners',
          fields: { author: 'Bob', category: 'programming', views: 150 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    });

    test('should search documents by query', async () => {
      const response = await engine.search({ query: 'JavaScript' });
      expect(response.results).toHaveLength(1);
      expect(response.results[0].document.title).toBe('JavaScript Tutorial');
    });

    test('should return search results with scores', async () => {
      const response = await engine.search({ query: 'programming' });
      expect(response.results.length).toBeGreaterThan(0);
      expect(response.results[0].score).toBeGreaterThan(0);
    });

    test('should return total count of results', async () => {
      const response = await engine.search({ query: 'programming' });
      expect(response.total).toBe(2);
    });

    test('should handle empty query', async () => {
      const response = await engine.search({ query: '' });
      expect(response.results.length).toBeGreaterThan(0);
    });

    test('should search across multiple fields', async () => {
      const response = await engine.search({ 
        query: 'TypeScript',
        fields: ['title', 'content']
      });
      expect(response.results.length).toBeGreaterThan(0);
    });
  });

  describe('SearchEngine - Filtered Search', () => {
    let engine: SearchEngine;

    beforeEach(async () => {
      engine = createSearchEngine('test-filters');
      await engine.indexBulk([
        {
          type: 'article',
          title: 'Article A',
          content: 'Content A',
          fields: { author: 'John', category: 'tech', views: 100, published: true },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          type: 'article',
          title: 'Article B',
          content: 'Content B',
          fields: { author: 'Jane', category: 'science', views: 200, published: true },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          type: 'article',
          title: 'Article C',
          content: 'Content C',
          fields: { author: 'Bob', category: 'tech', views: 50, published: false },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    });

    test('should filter by equality', async () => {
      const response = await engine.search({
        query: 'article',
        filters: [{ field: 'category', operator: 'eq', value: 'tech' }]
      });
      expect(response.results).toHaveLength(2);
    });

    test('should filter by not equal', async () => {
      const response = await engine.search({
        query: 'article',
        filters: [{ field: 'category', operator: 'neq', value: 'tech' }]
      });
      expect(response.results).toHaveLength(1);
    });

    test('should filter by greater than', async () => {
      const response = await engine.search({
        query: 'article',
        filters: [{ field: 'views', operator: 'gt', value: 100 }]
      });
      expect(response.results).toHaveLength(1);
      expect(response.results[0].document.fields['views']).toBe(200);
    });

    test('should filter by greater than or equal', async () => {
      const response = await engine.search({
        query: 'article',
        filters: [{ field: 'views', operator: 'gte', value: 100 }]
      });
      expect(response.results).toHaveLength(2);
    });

    test('should filter by less than', async () => {
      const response = await engine.search({
        query: 'article',
        filters: [{ field: 'views', operator: 'lt', value: 150 }]
      });
      expect(response.results).toHaveLength(2);
    });

    test('should filter by contains', async () => {
      const response = await engine.search({
        query: 'article',
        filters: [{ field: 'author', operator: 'contains', value: 'an' }]
      });
      expect(response.results).toHaveLength(1);
      expect(response.results[0].document.fields['author']).toBe('Jane');
    });

    test('should filter by startsWith', async () => {
      const response = await engine.search({
        query: 'article',
        filters: [{ field: 'author', operator: 'startsWith', value: 'Jo' }]
      });
      expect(response.results).toHaveLength(1);
      expect(response.results[0].document.fields['author']).toBe('John');
    });

    test('should filter by in array', async () => {
      const response = await engine.search({
        query: 'article',
        filters: [{ field: 'category', operator: 'in', value: ['tech', 'science'] }]
      });
      expect(response.results).toHaveLength(3);
    });
  });

  describe('SearchEngine - Geo Search', () => {
    let engine: SearchEngine;

    beforeEach(async () => {
      engine = createSearchEngine('test-geo');
      await engine.indexBulk([
        {
          type: 'restaurant',
          title: 'Pizza Place',
          content: 'Best pizza in town',
          fields: { name: 'Pizza Place' },
          location: { latitude: 40.7128, longitude: -74.0060 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          type: 'restaurant',
          title: 'Sushi Bar',
          content: 'Fresh sushi daily',
          fields: { name: 'Sushi Bar' },
          location: { latitude: 40.7580, longitude: -73.9855 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          type: 'restaurant',
          title: 'Burger Joint',
          content: 'Juicy burgers',
          fields: { name: 'Burger Joint' },
          location: { latitude: 34.0522, longitude: -118.2437 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    });

    test('should filter by distance', async () => {
      const response = await engine.search({
        query: 'place',
        geoFilter: {
          distance: {
            location: { latitude: 40.7128, longitude: -74.0060 },
            maxDistance: 10,
            unit: 'km'
          }
        }
      });
      expect(response.results.length).toBeGreaterThan(0);
      expect(response.results[0].distance).toBeDefined();
    });

    test('should filter by bounding box', async () => {
      const response = await engine.search({
        query: 'place',
        geoFilter: {
          boundingBox: {
            topLeft: { latitude: 41.0, longitude: -75.0 },
            bottomRight: { latitude: 39.0, longitude: -73.0 }
          }
        }
      });
      expect(response.results).toHaveLength(1);
      expect(response.results[0].document.title).toBe('Pizza Place');
    });
  });

  describe('SearchEngine - Sorting', () => {
    let engine: SearchEngine;

    beforeEach(async () => {
      engine = createSearchEngine('test-sort');
      await engine.indexBulk([
        {
          type: 'article',
          title: 'Article A',
          content: 'Content A',
          fields: { views: 100, date: new Date('2024-01-01') },
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          type: 'article',
          title: 'Article B',
          content: 'Content B',
          fields: { views: 300, date: new Date('2024-02-01') },
          createdAt: new Date('2024-02-01'),
          updatedAt: new Date('2024-02-01'),
        },
        {
          type: 'article',
          title: 'Article C',
          content: 'Content C',
          fields: { views: 200, date: new Date('2024-03-01') },
          createdAt: new Date('2024-03-01'),
          updatedAt: new Date('2024-03-01'),
        },
      ]);
    });

    test('should sort by field ascending', async () => {
      const response = await engine.search({
        query: 'article',
        sort: [{ field: 'views', order: 'asc' }]
      });
      expect(response.results[0].document.fields['views']).toBe(100);
    });

    test('should sort by field descending', async () => {
      const response = await engine.search({
        query: 'article',
        sort: [{ field: 'views', order: 'desc' }]
      });
      expect(response.results[0].document.fields['views']).toBe(300);
    });
  });

  describe('SearchEngine - Pagination', () => {
    let engine: SearchEngine;

    beforeEach(async () => {
      engine = createSearchEngine('test-pagination');
      const docs: Omit<SearchDocument, 'id'>[] = [];
      for (let i = 1; i <= 25; i++) {
        docs.push({
          type: 'article',
          title: `Article ${i}`,
          content: `Content ${i}`,
          fields: { index: i },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      await engine.indexBulk(docs);
    });

    test('should return paginated results', async () => {
      const response = await engine.search({
        query: 'article',
        page: 1,
        pageSize: 10
      });
      expect(response.results).toHaveLength(10);
      expect(response.total).toBe(25);
      expect(response.totalPages).toBe(3);
    });

    test('should return correct page', async () => {
      const response = await engine.search({
        query: 'article',
        page: 2,
        pageSize: 10
      });
      expect(response.results).toHaveLength(10);
      expect(response.page).toBe(2);
    });

    test('should return last page with remaining items', async () => {
      const response = await engine.search({
        query: 'article',
        page: 3,
        pageSize: 10
      });
      expect(response.results).toHaveLength(5);
      expect(response.page).toBe(3);
    });
  });

  describe('SearchEngine - Boost Factors', () => {
    let engine: SearchEngine;

    beforeEach(async () => {
      engine = createSearchEngine('test-boost');
      await engine.indexBulk([
        {
          type: 'article',
          title: 'Old Popular Article',
          content: 'Content about JavaScript',
          fields: { popularity: 1000 },
          createdAt: new Date('2020-01-01'),
          updatedAt: new Date('2020-01-01'),
          popularity: 1000,
        },
        {
          type: 'article',
          title: 'New Unpopular Article',
          content: 'Content about JavaScript',
          fields: { popularity: 10 },
          createdAt: new Date(),
          updatedAt: new Date(),
          popularity: 10,
        },
      ]);
    });

    test('should boost by recency', async () => {
      const response = await engine.search({
        query: 'JavaScript',
        boostFactors: { recency: 2.0 }
      });
      expect(response.results[0].document.title).toBe('New Unpopular Article');
    });

    test('should boost by popularity', async () => {
      const response = await engine.search({
        query: 'JavaScript',
        boostFactors: { popularity: 1.0 }
      });
      expect(response.results[0].document.title).toBe('Old Popular Article');
    });
  });

  describe('SearchEngine - Faceted Search', () => {
    let engine: SearchEngine;

    beforeEach(async () => {
      engine = createSearchEngine('test-facets');
      await engine.indexBulk([
        {
          type: 'product',
          title: 'Product A',
          content: 'Description A',
          fields: { category: 'electronics', brand: 'Apple', price: 100 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          type: 'product',
          title: 'Product B',
          content: 'Description B',
          fields: { category: 'electronics', brand: 'Samsung', price: 200 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          type: 'product',
          title: 'Product C',
          content: 'Description C',
          fields: { category: 'clothing', brand: 'Nike', price: 150 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    });

    test('should return facets', async () => {
      const response = await engine.search({
        query: 'product',
        includeFacets: true,
        facetFields: ['category', 'brand']
      });
      expect(response.facets).toBeDefined();
      expect(response.facets).toHaveLength(2);
    });

    test('should include facet counts', async () => {
      const response = await engine.search({
        query: 'product',
        includeFacets: true,
        facetFields: ['category']
      });
      const categoryFacet = response.facets?.find(f => f.field === 'category');
      expect(categoryFacet?.values).toContainEqual({ value: 'electronics', count: 2 });
      expect(categoryFacet?.values).toContainEqual({ value: 'clothing', count: 1 });
    });
  });

  describe('SearchEngine - Autocomplete', () => {
    let engine: SearchEngine;

    beforeEach(async () => {
      engine = createSearchEngine('test-suggest');
      await engine.indexBulk([
        {
          type: 'article',
          title: 'JavaScript Fundamentals',
          content: 'Learn JS basics',
          fields: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          type: 'article',
          title: 'JavaScript Advanced',
          content: 'Master JS',
          fields: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          type: 'article',
          title: 'TypeScript Guide',
          content: 'Learn TypeScript',
          fields: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    });

    test('should return suggestions for prefix', async () => {
      const suggestions = await engine.suggest('Java');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].text.toLowerCase()).toContain('java');
    });

    test('should return completion suggestions', async () => {
      const suggestions = await engine.suggest('JavaScript');
      expect(suggestions.some(s => s.type === 'completion')).toBe(true);
    });

    test('should limit suggestions by size', async () => {
      const suggestions = await engine.suggest('a', { size: 2 });
      expect(suggestions.length).toBeLessThanOrEqual(2);
    });

    test('should include fuzzy matches', async () => {
      const suggestions = await engine.suggest('Javscript', { fuzzy: true, fuzzyDistance: 2 });
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('QueryBuilder', () => {
    test('should build a basic query', () => {
      const builder = createQueryBuilder();
      const query = builder.setQuery('test').build();
      expect(query.query).toBe('test');
    });

    test('should add filters', () => {
      const builder = createQueryBuilder();
      const query = builder
        .setQuery('test')
        .addFilter('category', 'eq', 'tech')
        .build();
      expect(query.filters).toHaveLength(1);
      expect(query.filters![0].field).toBe('category');
    });

    test('should add geo filter', () => {
      const builder = createQueryBuilder();
      const geoFilter = {
        distance: {
          location: { latitude: 40.7128, longitude: -74.0060 },
          maxDistance: 10,
          unit: 'km' as const
        }
      };
      const query = builder.setQuery('test').addGeoFilter(geoFilter).build();
      expect(query.geoFilter).toBeDefined();
    });

    test('should add sorting', () => {
      const builder = createQueryBuilder();
      const query = builder
        .setQuery('test')
        .addSort('views', 'desc')
        .build();
      expect(query.sort).toHaveLength(1);
      expect(query.sort![0].field).toBe('views');
    });

    test('should set pagination', () => {
      const builder = createQueryBuilder();
      const query = builder
        .setQuery('test')
        .setPage(2)
        .setPageSize(20)
        .build();
      expect(query.page).toBe(2);
      expect(query.pageSize).toBe(20);
    });
  });

  describe('SearchManus Integration', () => {
    let search: SearchManus;

    beforeEach(async () => {
      search = createSearch();
      await search.indexDocuments([
        {
          type: 'post',
          title: 'First Post',
          content: 'Content of first post',
          fields: { author: 'John', tags: ['tech', 'news'] },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          type: 'post',
          title: 'Second Post',
          content: 'Content of second post',
          fields: { author: 'Jane', tags: ['science', 'news'] },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    });

    test('should search using fluent interface', async () => {
      const response = await search
        .setQuery('first')
        .executeSearch();
      expect(response.results).toHaveLength(1);
      expect(response.results[0].document.title).toBe('First Post');
    });

    test('should add multiple filters', async () => {
      const response = await search
        .setQuery('post')
        .addFilter('author', 'eq', 'John')
        .executeSearch();
      expect(response.results).toHaveLength(1);
    });

    test('should chain query methods', async () => {
      const response = await search
        .setQuery('post')
        .addFilter('author', 'eq', 'John')
        .setPage(1)
        .setPageSize(10)
        .addSort('title', 'asc')
        .executeSearch();
      expect(response.results).toHaveLength(1);
      expect(response.page).toBe(1);
    });

    test('should get search stats', async () => {
      const stats = search.getStats();
      expect(stats.totalDocuments).toBe(2);
    });

    test('should reindex all documents', async () => {
      await search.reindex();
      const stats = search.getStats();
      expect(stats.totalDocuments).toBe(2);
    });
  });

  describe('SearchEngine - Reindex', () => {
    test('should reindex all documents', async () => {
      const engine = createSearchEngine('test-reindex');
      await engine.indexBulk([
        {
          type: 'article',
          title: 'Test Article',
          content: 'Test content',
          fields: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      await engine.reindex();
      const stats = engine.getStats();
      expect(stats.totalDocuments).toBe(1);
    });
  });

  describe('SearchEngine - Highlight Options', () => {
    let engine: SearchEngine;

    beforeEach(async () => {
      engine = createSearchEngine('test-highlight');
      await engine.indexDocument({
        type: 'article',
        title: 'JavaScript Tutorial',
        content: 'Learn JavaScript programming with examples',
        fields: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    test('should return results with highlights', async () => {
      const response = await engine.search({
        query: 'JavaScript',
        highlight: {
          fields: ['title', 'content'],
          preTag: '<em>',
          postTag: '</em>'
        }
      });
      expect(response.results[0].highlights).toBeDefined();
    });
  });
});

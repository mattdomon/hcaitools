/**
 * Search Engine Integration Tests
 */

import {
  QueryBuilderImpl,
  IndexManagerImpl,
  DocumentManagerImpl,
  SearchServiceImpl,
  SearchAnalyticsServiceImpl,
  SearchEngineServiceImpl,
  createSearchEngine,
} from '../src/core/searchEngine/searchEngine';
import {
  SearchManus,
  createSearch,
} from '../src/core/searchEngine';
import {
  IndexField,
  IndexSettings,
  SearchQuery,
  QueryClause,
  QueryFilter,
  FacetDefinition,
  SortClause,
  AggregationType,
  SearchDocument,
} from '../src/core/searchEngine/types';

describe('QueryBuilderImpl', () => {
  let builder: QueryBuilderImpl;

  beforeEach(() => {
    builder = new QueryBuilderImpl('test_index');
  });

  describe('Basic Query Building', () => {
    test('should create query with index', () => {
      const query = builder.index('products').build();
      expect(query.index).toBe('products');
    });

    test('should create match query', () => {
      const query = builder.match('title', 'laptop', 2.0).build();
      expect(query.query.type).toBe('match');
      expect(query.query.field).toBe('title');
      expect(query.query.value).toBe('laptop');
      expect(query.query.boost).toBe(2.0);
    });

    test('should create matchPhrase query', () => {
      const query = builder.matchPhrase('description', 'fast processor').build();
      expect(query.query.type).toBe('matchPhrase');
      expect(query.query.field).toBe('description');
      expect(query.query.value).toBe('fast processor');
    });

    test('should create term query with string value', () => {
      const query = builder.term('status', 'active').build();
      expect(query.query.type).toBe('term');
      expect(query.query.field).toBe('status');
      expect(query.query.value).toBe('active');
    });

    test('should create term query with numeric value', () => {
      const query = builder.term('price', 100).build();
      expect(query.query.type).toBe('term');
      expect(query.query.value).toBe(100);
    });

    test('should create term query with boolean value', () => {
      const query = builder.term('inStock', true).build();
      expect(query.query.type).toBe('term');
      expect(query.query.value).toBe(true);
    });

    test('should create terms query', () => {
      const query = builder.terms('category', ['electronics', 'books']).build();
      expect(query.query.type).toBe('terms');
      expect(query.query.field).toBe('category');
    });

    test('should create range query', () => {
      const query = builder.range('price', { gt: 100, lte: 500 }).build();
      expect(query.query.type).toBe('range');
      expect(query.query.field).toBe('price');
    });
  });

  describe('Boolean Query Building', () => {
    test('should create bool query with must clause', () => {
      const query = builder
        .bool({
          must: [
            { type: 'match', field: 'title', value: 'laptop' },
            { type: 'term', field: 'status', value: 'active' },
          ],
        })
        .build();
      expect(query.query.type).toBe('bool');
      expect((query.query as QueryClause & { clauses: QueryClause[] }).clauses).toHaveLength(2);
    });

    test('should create bool query with should clause', () => {
      const query = builder
        .bool({
          should: [
            { type: 'match', field: 'title', value: 'laptop' },
            { type: 'match', field: 'description', value: 'computer' },
          ],
          minimumShouldMatch: 1,
        })
        .build();
      expect(query.query.type).toBe('bool');
      expect(query.query.should).toHaveLength(2);
      expect(query.query.minimumShouldMatch).toBe(1);
    });

    test('should create bool query with mustNot clause', () => {
      const query = builder
        .bool({
          mustNot: [{ type: 'term', field: 'status', value: 'deleted' }],
        })
        .build();
      expect(query.query.type).toBe('bool');
      expect(query.query.mustNot).toHaveLength(1);
    });
  });

  describe('Filter Building', () => {
    test('should add equality filter', () => {
      const query = builder.filter('category', 'eq', 'electronics').build();
      expect(query.filters).toHaveLength(1);
      expect(query.filters![0].field).toBe('category');
      expect(query.filters![0].operator).toBe('eq');
      expect(query.filters![0].value).toBe('electronics');
    });

    test('should add multiple filters', () => {
      const query = builder
        .filter('status', 'eq', 'active')
        .filter('price', 'gte', 100)
        .filter('price', 'lte', 500)
        .build();
      expect(query.filters).toHaveLength(3);
    });

    test('should add range filters', () => {
      const query = builder
        .filter('price', 'gt', 50)
        .filter('price', 'lt', 100)
        .filter('created', 'gte', '2024-01-01')
        .build();
      expect(query.filters).toHaveLength(3);
    });

    test('should add in filter', () => {
      const query = builder.filter('category', 'in', ['a', 'b', 'c']).build();
      expect(query.filters![0].operator).toBe('in');
      expect(query.filters![0].value).toEqual(['a', 'b', 'c']);
    });

    test('should add exists filter', () => {
      const query = builder.filter('description', 'exists', true).build();
      expect(query.filters![0].operator).toBe('exists');
    });
  });

  describe('Sorting', () => {
    test('should add single sort clause', () => {
      const query = builder.sort('price', 'asc').build();
      expect(query.sort).toHaveLength(1);
      expect(query.sort![0].field).toBe('price');
      expect(query.sort![0].order).toBe('asc');
    });

    test('should add multiple sort clauses', () => {
      const query = builder
        .sort('price', 'asc')
        .sort('createdAt', 'desc')
        .build();
      expect(query.sort).toHaveLength(2);
    });

    test('should add sort with mode', () => {
      const query = builder.sort('price', 'asc', 'min').build();
      expect(query.sort![0].mode).toBe('min');
    });
  });

  describe('Pagination', () => {
    test('should set pagination parameters', () => {
      const query = builder.page(20, 10).build();
      expect(query.pagination.offset).toBe(20);
      expect(query.pagination.limit).toBe(10);
    });

    test('should default pagination values', () => {
      const query = builder.build();
      expect(query.pagination.offset).toBe(0);
      expect(query.pagination.limit).toBe(10);
    });
  });

  describe('Highlighting', () => {
    test('should add highlighting for single field', () => {
      const query = builder.highlight(['title']).build();
      expect(query.highlighting).toBeDefined();
      expect(query.highlighting!.fields['title']).toBeDefined();
    });

    test('should add highlighting for multiple fields', () => {
      const query = builder.highlight(['title', 'description']).build();
      expect(Object.keys(query.highlighting!.fields)).toHaveLength(2);
    });
  });

  describe('Facets', () => {
    test('should add terms facet', () => {
      const query = builder.facet('category', 'terms', 'category').build();
      expect(query.facets).toHaveLength(1);
      expect(query.facets![0].type).toBe('terms');
      expect(query.facets![0].field).toBe('category');
    });

    test('should add range facet with ranges', () => {
      const ranges = [{ from: 0, to: 100 }, { from: 100, to: 500 }];
      const query = builder.facet('price_ranges', 'range', 'price', { ranges }).build();
      expect(query.facets![0].type).toBe('range');
      expect(query.facets![0].ranges).toHaveLength(2);
    });

    test('should add stats facet', () => {
      const query = builder.facet('price_stats', 'stats', 'price').build();
      expect(query.facets![0].type).toBe('stats');
    });

    test('should add facet with size limit', () => {
      const query = builder.facet('top_brands', 'terms', 'brand', { size: 5 }).build();
      expect(query.facets![0].size).toBe(5);
    });
  });

  describe('Chained Building', () => {
    test('should chain multiple operations', () => {
      const query = builder
        .index('products')
        .match('title', 'laptop')
        .filter('status', 'eq', 'active')
        .sort('price', 'asc')
        .page(0, 20)
        .facet('category', 'terms', 'category')
        .build();

      expect(query.index).toBe('products');
      expect(query.query.type).toBe('match');
      expect(query.filters).toHaveLength(1);
      expect(query.sort).toHaveLength(1);
      expect(query.pagination.limit).toBe(20);
      expect(query.facets).toHaveLength(1);
    });
  });

  describe('Query ID Generation', () => {
    test('should generate unique query IDs', () => {
      const query1 = builder.build();
      const query2 = builder.build();
      expect(query1.queryId).not.toBe(query2.queryId);
      expect(query1.queryId).toMatch(/^query_[a-f0-9]{16}$/);
    });
  });
});

describe('IndexManagerImpl', () => {
  let manager: IndexManagerImpl;

  beforeEach(() => {
    manager = new IndexManagerImpl();
  });

  describe('Index Creation', () => {
    test('should create index with basic fields', async () => {
      const fields: IndexField[] = [
        { name: 'title', type: 'text', indexed: true, stored: true },
        { name: 'price', type: 'numeric', indexed: true },
      ];
      const index = await manager.createIndex('products', fields);

      expect(index.indexId).toMatch(/^idx_[a-f0-9]{16}$/);
      expect(index.name).toBe('products');
      expect(index.engine).toBe('elasticsearch');
      expect(index.fields).toHaveLength(2);
      expect(index.status).toBe('active');
      expect(index.documentCount).toBe(0);
    });

    test('should create index with settings', async () => {
      const settings: IndexSettings = {
        numberOfShards: 3,
        numberOfReplicas: 1,
        refreshInterval: 1000,
      };
      const index = await manager.createIndex('products', [], settings);
      expect(index.settings).toEqual(settings);
    });

    test('should create index with geo field', async () => {
      const fields: IndexField[] = [
        { name: 'location', type: 'geo', geoField: { lat: 40.7128, lon: -74.0060 } },
      ];
      const index = await manager.createIndex('locations', fields);
      expect(index.fields[0].type).toBe('geo');
      expect(index.fields[0].geoField).toEqual({ lat: 40.7128, lon: -74.0060 });
    });
  });

  describe('Index Retrieval', () => {
    test('should get created index by ID', async () => {
      const created = await manager.createIndex('products', []);
      const retrieved = await manager.getIndex(created.indexId);
      expect(retrieved?.indexId).toBe(created.indexId);
      expect(retrieved?.name).toBe('products');
    });

    test('should return null for non-existent index', async () => {
      const result = await manager.getIndex('non_existent');
      expect(result).toBeNull();
    });

    test('should list all indexes', async () => {
      await manager.createIndex('products', []);
      await manager.createIndex('orders', []);
      const indexes = await manager.listIndexes();
      expect(indexes).toHaveLength(2);
    });
  });

  describe('Index Update', () => {
    test('should update index name', async () => {
      const created = await manager.createIndex('products', []);
      const updated = await manager.updateIndex(created.indexId, { name: 'new_products' });
      expect(updated.name).toBe('new_products');
    });

    test('should update index status', async () => {
      const created = await manager.createIndex('products', []);
      const updated = await manager.updateIndex(created.indexId, { status: 'inactive' });
      expect(updated.status).toBe('inactive');
    });

    test('should throw error for non-existent index update', async () => {
      await expect(manager.updateIndex('non_existent', { name: 'test' })).rejects.toThrow();
    });
  });

  describe('Index Deletion', () => {
    test('should delete existing index', async () => {
      const created = await manager.createIndex('products', []);
      await manager.deleteIndex(created.indexId);
      const result = await manager.getIndex(created.indexId);
      expect(result).toBeNull();
    });

    test('should list indexes after deletion', async () => {
      const idx1 = await manager.createIndex('products', []);
      await manager.createIndex('orders', []);
      await manager.deleteIndex(idx1.indexId);
      const indexes = await manager.listIndexes();
      expect(indexes).toHaveLength(1);
    });
  });

  describe('Field Management', () => {
    test('should add field to index', async () => {
      const created = await manager.createIndex('products', []);
      await manager.addField(created.indexId, { name: 'title', type: 'text' });
      const retrieved = await manager.getIndex(created.indexId);
      expect(retrieved?.fields).toHaveLength(1);
      expect(retrieved?.fields[0].name).toBe('title');
    });

    test('should remove field from index', async () => {
      const created = await manager.createIndex('products', [
        { name: 'title', type: 'text' },
        { name: 'price', type: 'numeric' },
      ]);
      await manager.removeField(created.indexId, 'price');
      const retrieved = await manager.getIndex(created.indexId);
      expect(retrieved?.fields).toHaveLength(1);
      expect(retrieved?.fields[0].name).toBe('title');
    });
  });

  describe('Index Rebuild', () => {
    test('should rebuild index', async () => {
      const created = await manager.createIndex('products', []);
      const rebuildPromise = manager.rebuildIndex(created.indexId);
      const duringRebuild = await manager.getIndex(created.indexId);
      expect(duringRebuild?.status).toBe('building');
      await rebuildPromise;
      await new Promise(resolve => setTimeout(resolve, 150));
      const afterRebuild = await manager.getIndex(created.indexId);
      expect(afterRebuild?.status).toBe('active');
    });
  });
});

describe('DocumentManagerImpl', () => {
  let manager: DocumentManagerImpl;

  beforeEach(() => {
    manager = new DocumentManagerImpl();
  });

  describe('Document Indexing', () => {
    test('should index single document', async () => {
      const doc = await manager.indexDocument('products', {
        fields: { title: 'Laptop', price: 999 },
      });
      expect(doc.id).toMatch(/^doc_[a-f0-9]{16}$/);
      expect(doc.index).toBe('products');
      expect(doc.fields.title).toBe('Laptop');
      expect(doc.fields.price).toBe(999);
      expect(doc.createdAt).toBeInstanceOf(Date);
    });

    test('should index bulk documents', async () => {
      const docs = await manager.indexBulk('products', [
        { fields: { title: 'Laptop', price: 999 } },
        { fields: { title: 'Mouse', price: 29 } },
        { fields: { title: 'Keyboard', price: 79 } },
      ]);
      expect(docs).toHaveLength(3);
      docs.forEach(doc => {
        expect(doc.index).toBe('products');
        expect(doc.id).toMatch(/^doc_[a-f0-9]{16}$/);
      });
    });
  });

  describe('Document Retrieval', () => {
    test('should get document by ID', async () => {
      const indexed = await manager.indexDocument('products', { fields: { title: 'Test' } });
      const retrieved = await manager.getDocument('products', indexed.id);
      expect(retrieved?.id).toBe(indexed.id);
      expect(retrieved?.fields.title).toBe('Test');
    });

    test('should return null for non-existent document', async () => {
      const result = await manager.getDocument('products', 'non_existent');
      expect(result).toBeNull();
    });

    test('should return null for document in wrong index', async () => {
      const indexed = await manager.indexDocument('products', { fields: { title: 'Test' } });
      const result = await manager.getDocument('orders', indexed.id);
      expect(result).toBeNull();
    });
  });

  describe('Document Update', () => {
    test('should update document fields', async () => {
      const indexed = await manager.indexDocument('products', { fields: { title: 'Original' } });
      const updated = await manager.updateDocument('products', indexed.id, {
        fields: { title: 'Updated' },
      });
      expect(updated.fields.title).toBe('Updated');
    });

    test('should throw error for non-existent document', async () => {
      await expect(
        manager.updateDocument('products', 'non_existent', { fields: { title: 'Test' } })
      ).rejects.toThrow();
    });
  });

  describe('Document Deletion', () => {
    test('should delete single document', async () => {
      const indexed = await manager.indexDocument('products', { fields: { title: 'Test' } });
      await manager.deleteDocument('products', indexed.id);
      const result = await manager.getDocument('products', indexed.id);
      expect(result).toBeNull();
    });

    test('should bulk delete documents', async () => {
      const docs = await manager.indexBulk('products', [
        { fields: { title: 'Doc1' } },
        { fields: { title: 'Doc2' } },
        { fields: { title: 'Doc3' } },
      ]);
      await manager.deleteBulk('products', [docs[0].id, docs[1].id]);
      const remaining = await manager.getDocument('products', docs[0].id);
      expect(remaining).toBeNull();
      const stillExists = await manager.getDocument('products', docs[2].id);
      expect(stillExists).not.toBeNull();
    });
  });
});

describe('SearchServiceImpl', () => {
  let searchService: SearchServiceImpl;
  let documentManager: DocumentManagerImpl;
  let engine: SearchEngineServiceImpl;

  beforeEach(async () => {
    engine = createSearchEngine();
    searchService = engine.getSearchService() as SearchServiceImpl;
    documentManager = engine.getDocumentManager() as DocumentManagerImpl;

    const docs = await documentManager.indexBulk('products', [
      { fields: { title: 'Laptop', price: 999, category: 'electronics', inStock: true } },
      { fields: { title: 'Mouse', price: 29, category: 'electronics', inStock: true } },
      { fields: { title: 'Keyboard', price: 79, category: 'electronics', inStock: false } },
      { fields: { title: 'Book', price: 15, category: 'books', inStock: true } },
      { fields: { title: 'Table', price: 250, category: 'furniture', inStock: true } },
    ]);
    docs.forEach(doc => engine.addDocumentToStore('products', doc));
  });

  describe('Basic Search', () => {
    test('should search with match query', async () => {
      const query: SearchQuery = {
        queryId: 'test_query',
        index: 'products',
        query: { type: 'match', field: 'title', value: 'laptop' },
        pagination: { offset: 0, limit: 10 },
      };
      const result = await searchService.search(query);
      expect(result.hits.length).toBeGreaterThan(0);
      expect(result.hits.some(h => h.fields.title === 'Laptop')).toBe(true);
    });

    test('should search with term query', async () => {
      const query: SearchQuery = {
        queryId: 'test_query',
        index: 'products',
        query: { type: 'term', field: 'category', value: 'electronics' },
        pagination: { offset: 0, limit: 10 },
      };
      const result = await searchService.search(query);
      expect(result.hits.length).toBe(3);
    });

    test('should return empty results for non-matching query', async () => {
      const query: SearchQuery = {
        queryId: 'test_query',
        index: 'products',
        query: { type: 'match', field: 'title', value: 'nonexistent' },
        pagination: { offset: 0, limit: 10 },
      };
      const result = await searchService.search(query);
      expect(result.hits.length).toBe(0);
    });
  });

  describe('Filter Application', () => {
    test('should filter by equality', async () => {
      const query: SearchQuery = {
        queryId: 'test_query',
        index: 'products',
        query: { type: 'matchAll' } as QueryClause,
        filters: [{ field: 'category', operator: 'eq', value: 'electronics' }],
        pagination: { offset: 0, limit: 10 },
      };
      const result = await searchService.search(query);
      expect(result.hits.length).toBe(3);
    });

    test('should filter by range', async () => {
      const query: SearchQuery = {
        queryId: 'test_query',
        index: 'products',
        query: { type: 'matchAll' } as QueryClause,
        filters: [{ field: 'price', operator: 'gte', value: 100 }],
        pagination: { offset: 0, limit: 10 },
      };
      const result = await searchService.search(query);
      expect(result.hits.length).toBe(2);
      expect(result.hits.every(h => (h.fields.price as number) >= 100)).toBe(true);
    });

    test('should filter by multiple conditions', async () => {
      const query: SearchQuery = {
        queryId: 'test_query',
        index: 'products',
        query: { type: 'matchAll' } as QueryClause,
        filters: [
          { field: 'category', operator: 'eq', value: 'electronics' },
          { field: 'price', operator: 'lt', value: 100 },
        ],
        pagination: { offset: 0, limit: 10 },
      };
      const result = await searchService.search(query);
      expect(result.hits.length).toBe(2);
    });

    test('should filter with in operator', async () => {
      const query: SearchQuery = {
        queryId: 'test_query',
        index: 'products',
        query: { type: 'matchAll' } as QueryClause,
        filters: [{ field: 'category', operator: 'in', value: ['electronics', 'books'] }],
        pagination: { offset: 0, limit: 10 },
      };
      const result = await searchService.search(query);
      expect(result.hits.length).toBe(4);
    });
  });

  describe('Pagination', () => {
    test('should paginate results', async () => {
      const query: SearchQuery = {
        queryId: 'test_query',
        index: 'products',
        query: { type: 'matchAll' } as QueryClause,
        pagination: { offset: 0, limit: 2 },
      };
      const result = await searchService.search(query);
      expect(result.hits.length).toBe(2);
      expect(result.totalHits).toBe(5);
    });

    test('should skip offset', async () => {
      const query: SearchQuery = {
        queryId: 'test_query',
        index: 'products',
        query: { type: 'matchAll' } as QueryClause,
        pagination: { offset: 2, limit: 2 },
      };
      const result = await searchService.search(query);
      expect(result.hits.length).toBe(2);
    });
  });

  describe('Faceted Search', () => {
    test('should compute terms facet', async () => {
      const query: SearchQuery = {
        queryId: 'test_query',
        index: 'products',
        query: { type: 'matchAll' } as QueryClause,
        facets: [{ name: 'categories', type: 'terms', field: 'category' as keyof QueryFilter, size: 10 }],
        pagination: { offset: 0, limit: 10 },
      };
      const result = await searchService.search(query);
      expect(result.facets).toBeDefined();
      expect(result.facets!['categories']).toBeDefined();
    });

    test('should compute stats facet', async () => {
      const query: SearchQuery = {
        queryId: 'test_query',
        index: 'products',
        query: { type: 'matchAll' } as QueryClause,
        facets: [{ name: 'price_stats', type: 'stats', field: 'price' as keyof QueryFilter }],
        pagination: { offset: 0, limit: 10 },
      };
      const result = await searchService.search(query);
      expect(result.facets!['price_stats'].stats).toBeDefined();
      expect(result.facets!['price_stats'].stats!.count).toBe(5);
      expect(result.facets!['price_stats'].stats!.min).toBe(15);
      expect(result.facets!['price_stats'].stats!.max).toBe(999);
    });
  });

  describe('Count', () => {
    test('should count all documents', async () => {
      const count = await searchService.count('products');
      expect(count).toBe(5);
    });

    test('should count with filters', async () => {
      const filters: QueryFilter[] = [{ field: 'category', operator: 'eq', value: 'electronics' }];
      const count = await searchService.count('products', filters);
      expect(count).toBe(3);
    });
  });

  describe('Suggestions', () => {
    test('should return suggestions for prefix', async () => {
      const suggestions = await searchService.suggest('products', 'lap', { field: '_all', size: 5 });
      expect(suggestions.length).toBeGreaterThan(0);
    });

    test('should return empty for no matches', async () => {
      const suggestions = await searchService.suggest('products', 'xyz', { field: '_all', size: 5 });
      expect(suggestions.length).toBe(0);
    });
  });
});

describe('SearchAnalyticsServiceImpl', () => {
  let analytics: SearchAnalyticsServiceImpl;

  beforeEach(() => {
    analytics = new SearchAnalyticsServiceImpl();
  });

  describe('Search Recording', () => {
    test('should record search event', async () => {
      const search = await analytics.recordSearch({
        query: 'laptop',
        index: 'products',
        totalResults: 10,
        clickedResults: [],
        viewedResults: [],
        took: 50,
        filters: {},
        facets: {},
      });
      expect(search.searchId).toMatch(/^sanalytics_[a-f0-9]{16}$/);
      expect(search.query).toBe('laptop');
      expect(search.totalResults).toBe(10);
      expect(search.timestamp).toBeInstanceOf(Date);
    });

    test('should track search with user ID', async () => {
      const search = await analytics.recordSearch({
        query: 'mouse',
        index: 'products',
        userId: 'user123',
        sessionId: 'session456',
        totalResults: 5,
        clickedResults: ['doc1'],
        viewedResults: ['doc1', 'doc2'],
        took: 30,
        filters: {},
        facets: {},
      });
      expect(search.userId).toBe('user123');
      expect(search.sessionId).toBe('session456');
    });
  });

  describe('Popular Queries', () => {
    test('should track query frequency', async () => {
      await analytics.recordSearch({
        query: 'laptop',
        index: 'products',
        totalResults: 10,
        clickedResults: [],
        viewedResults: [],
        took: 50,
        filters: {},
        facets: {},
      });
      await analytics.recordSearch({
        query: 'laptop',
        index: 'products',
        totalResults: 8,
        clickedResults: [],
        viewedResults: [],
        took: 40,
        filters: {},
        facets: {},
      });
      await analytics.recordSearch({
        query: 'mouse',
        index: 'products',
        totalResults: 5,
        clickedResults: [],
        viewedResults: [],
        took: 30,
        filters: {},
        facets: {},
      });

      const popular = await analytics.getPopularQueries('products', 10);
      expect(popular.length).toBe(2);
      expect(popular[0].query).toBe('laptop');
      expect(popular[0].count).toBe(2);
      expect(popular[1].query).toBe('mouse');
      expect(popular[1].count).toBe(1);
    });

    test('should limit popular queries', async () => {
      await analytics.recordSearch({
        query: 'laptop',
        index: 'products',
        totalResults: 10,
        clickedResults: [],
        viewedResults: [],
        took: 50,
        filters: {},
        facets: {},
      });
      await analytics.recordSearch({
        query: 'mouse',
        index: 'products',
        totalResults: 5,
        clickedResults: [],
        viewedResults: [],
        took: 30,
        filters: {},
        facets: {},
      });

      const popular = await analytics.getPopularQueries('products', 1);
      expect(popular.length).toBe(1);
    });
  });

  describe('No Result Queries', () => {
    test('should track queries with no results', async () => {
      await analytics.recordSearch({
        query: 'nonexistent',
        index: 'products',
        totalResults: 0,
        clickedResults: [],
        viewedResults: [],
        took: 10,
        filters: {},
        facets: {},
      });

      const noResults = await analytics.getNoResultQueries('products', 10);
      expect(noResults.length).toBe(1);
      expect(noResults[0].query).toBe('nonexistent');
      expect(noResults[0].count).toBe(1);
    });
  });

  describe('Click Through Rate', () => {
    test('should calculate click through rate', async () => {
      await analytics.recordSearch({
        query: 'laptop',
        index: 'products',
        totalResults: 10,
        clickedResults: ['doc1'],
        viewedResults: [],
        took: 50,
        filters: {},
        facets: {},
      });
      await analytics.recordSearch({
        query: 'mouse',
        index: 'products',
        totalResults: 5,
        clickedResults: [],
        viewedResults: [],
        took: 30,
        filters: {},
        facets: {},
      });

      const ctr = await analytics.getClickThroughRate('products');
      expect(ctr).toBe(0.5);
    });

    test('should return 0 for no searches', async () => {
      const ctr = await analytics.getClickThroughRate('products');
      expect(ctr).toBe(0);
    });
  });

  describe('Analytics Summary', () => {
    test('should generate analytics summary', async () => {
      const now = new Date();
      const start = new Date(now.getTime() - 86400000);
      const end = new Date(now.getTime() + 86400000);

      await analytics.recordSearch({
        query: 'laptop',
        index: 'products',
        userId: 'user1',
        totalResults: 10,
        clickedResults: ['doc1'],
        viewedResults: [],
        took: 50,
        filters: {},
        facets: {},
      });

      const summary = await analytics.getSearchAnalytics('products', { start, end });
      expect(summary.totalSearches).toBe(1);
      expect(summary.uniqueQueries).toBe(1);
      expect(summary.uniqueUsers).toBe(1);
    });
  });
});

describe('SearchEngineServiceImpl', () => {
  let engine: SearchEngineServiceImpl;

  beforeEach(() => {
    engine = createSearchEngine();
  });

  describe('Service Access', () => {
    test('should provide index manager', () => {
      expect(engine.getIndexManager()).toBeInstanceOf(IndexManagerImpl);
    });

    test('should provide document manager', () => {
      expect(engine.getDocumentManager()).toBeInstanceOf(DocumentManagerImpl);
    });

    test('should provide search service', () => {
      expect(engine.getSearchService()).toBeInstanceOf(SearchServiceImpl);
    });

    test('should provide query builder', () => {
      expect(engine.getQueryBuilder('products')).toBeInstanceOf(QueryBuilderImpl);
    });

    test('should provide analytics service', () => {
      expect(engine.getAnalytics()).toBeInstanceOf(SearchAnalyticsServiceImpl);
    });
  });

  describe('Query Execution', () => {
    test('should execute built query', async () => {
      const docs = await engine.getDocumentManager().indexBulk('products', [
        { fields: { title: 'Laptop', price: 999 } },
      ]);
      docs.forEach(doc => engine.addDocumentToStore('products', doc));

      const query = engine.getQueryBuilder('products').match('title', 'laptop').build();
      const result = await engine.executeQuery(query);
      expect(result.hits.length).toBeGreaterThan(0);
    });
  });
});

describe('SearchManus', () => {
  let search: SearchManus;

  beforeEach(() => {
    search = createSearch();
  });

  test('should provide indexes manager', () => {
    expect(search.indexes).toBeInstanceOf(IndexManagerImpl);
  });

  test('should provide documents manager', () => {
    expect(search.documents).toBeInstanceOf(DocumentManagerImpl);
  });

  test('should provide search service', () => {
    expect(search.search).toBeInstanceOf(SearchServiceImpl);
  });

  test('should provide analytics service', () => {
    expect(search.analytics).toBeInstanceOf(SearchAnalyticsServiceImpl);
  });

  test('should create query builder', () => {
    const query = search.createQuery('products').match('title', 'test').build();
    expect(query.index).toBe('products');
    expect(query.query.type).toBe('match');
  });
});

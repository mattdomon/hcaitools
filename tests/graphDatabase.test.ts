import {
  generateId,
  NodeManager,
  EdgeManager,
  GraphTraversal,
  PathFinder,
  GraphVisualizer,
  GraphStatistics,
  GraphBackupManager,
  GraphDatabase,
  GraphDatabaseManager,
  Graph,
  GraphNode,
  GraphEdge,
  GraphType,
  NodeType,
  EdgeType,
  TraversalOptions,
  TraversalResult,
  PathFindingOptions,
  PathResult,
  VisualizationData,
  VisualizationLayout,
  GraphStats,
  GraphOptions,
  NodeFilter,
  EdgeFilter,
  DegreeInfo,
  CentralityResult,
  GraphMetrics,
} from '../src/core/graphDatabase';

describe('GraphDatabase Module', () => {
  describe('generateId', () => {
    it('should generate unique IDs with prefix', () => {
      const id1 = generateId('node');
      const id2 = generateId('node');
      expect(id1).toMatch(/^node_[a-f0-9]{16}$/);
      expect(id2).toMatch(/^node_[a-f0-9]{16}$/);
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with different prefixes', () => {
      const id1 = generateId('graph');
      const id2 = generateId('edge');
      expect(id1.startsWith('graph_')).toBe(true);
      expect(id2.startsWith('edge_')).toBe(true);
    });
  });

  describe('NodeManager', () => {
    let manager: NodeManager;

    beforeEach(() => {
      manager = new NodeManager();
    });

    it('should create a node', () => {
      const node = manager.createNode('User 1', 'entity', { name: 'John' });
      expect(node.id).toMatch(/^node_[a-f0-9]{16}$/);
      expect(node.label).toBe('User 1');
      expect(node.type).toBe('entity');
      expect(node.properties).toEqual({ name: 'John' });
    });

    it('should get node by id', () => {
      const created = manager.createNode('Test', 'hub');
      const retrieved = manager.getNode(created.id);
      expect(retrieved?.label).toBe('Test');
    });

    it('should get node by label', () => {
      manager.createNode('Node A', 'entity');
      manager.createNode('Node B', 'hub');
      const found = manager.getNodeByLabel('Node A');
      expect(found?.type).toBe('entity');
    });

    it('should return undefined for non-existent node', () => {
      const result = manager.getNode('non-existent');
      expect(result).toBeUndefined();
    });

    it('should get all nodes', () => {
      manager.createNode('Node 1', 'entity');
      manager.createNode('Node 2', 'hub');
      const all = manager.getAllNodes();
      expect(all).toHaveLength(2);
    });

    it('should get nodes by type', () => {
      manager.createNode('Entity 1', 'entity');
      manager.createNode('Hub 1', 'hub');
      manager.createNode('Entity 2', 'entity');
      const entities = manager.getNodesByType('entity');
      expect(entities).toHaveLength(2);
    });

    it('should update node', () => {
      const created = manager.createNode('Original', 'entity');
      const updated = manager.updateNode(created.id, { label: 'Updated', type: 'hub' });
      expect(updated?.label).toBe('Updated');
      expect(updated?.type).toBe('hub');
    });

    it('should delete node', () => {
      const created = manager.createNode('ToDelete', 'entity');
      const result = manager.deleteNode(created.id);
      expect(result).toBe(true);
      expect(manager.getNode(created.id)).toBeUndefined();
    });

    it('should add property to node', () => {
      const node = manager.createNode('Test', 'entity');
      const updated = manager.addProperty(node.id, 'email', 'test@example.com');
      expect(updated?.properties.email).toBe('test@example.com');
    });

    it('should remove property from node', () => {
      const node = manager.createNode('Test', 'entity', { name: 'John', age: 30 });
      const updated = manager.removeProperty(node.id, 'age');
      expect(updated?.properties).not.toHaveProperty('age');
      expect(updated?.properties).toHaveProperty('name');
    });

    it('should filter nodes', () => {
      manager.createNode('Entity 1', 'entity', { active: true });
      manager.createNode('Hub 1', 'hub', { active: true });
      manager.createNode('Entity 2', 'entity', { active: false });

      const filter: NodeFilter = { types: ['entity'], properties: { active: true } };
      const filtered = manager.filterNodes(filter);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].label).toBe('Entity 1');
    });

    it('should clear all nodes', () => {
      manager.createNode('Node 1', 'entity');
      manager.createNode('Node 2', 'hub');
      manager.clear();
      expect(manager.size()).toBe(0);
    });

    it('should return correct size', () => {
      manager.createNode('Node 1', 'entity');
      manager.createNode('Node 2', 'hub');
      expect(manager.size()).toBe(2);
    });
  });

  describe('EdgeManager', () => {
    let manager: EdgeManager;

    beforeEach(() => {
      manager = new EdgeManager();
    });

    it('should create an edge', () => {
      const edge = manager.createEdge('source1', 'target1', 'relationship', { type: 'knows' }, 1.0);
      expect(edge.id).toMatch(/^edge_[a-f0-9]{16}$/);
      expect(edge.sourceId).toBe('source1');
      expect(edge.targetId).toBe('target1');
      expect(edge.type).toBe('relationship');
      expect(edge.weight).toBe(1.0);
    });

    it('should get edge by id', () => {
      const created = manager.createEdge('src', 'tgt', 'dependency');
      const retrieved = manager.getEdge(created.id);
      expect(retrieved?.sourceId).toBe('src');
    });

    it('should get edges by node', () => {
      manager.createEdge('node1', 'node2', 'relationship');
      manager.createEdge('node2', 'node3', 'dependency');
      manager.createEdge('node3', 'node1', 'reference');

      const edges = manager.getEdgesByNode('node2');
      expect(edges).toHaveLength(2);
    });

    it('should get edges by source', () => {
      manager.createEdge('node1', 'node2', 'relationship');
      manager.createEdge('node1', 'node3', 'dependency');
      const edges = manager.getEdgesBySource('node1');
      expect(edges).toHaveLength(2);
    });

    it('should get edges by target', () => {
      manager.createEdge('node1', 'node2', 'relationship');
      manager.createEdge('node3', 'node2', 'dependency');
      const edges = manager.getEdgesByTarget('node2');
      expect(edges).toHaveLength(2);
    });

    it('should get edges by type', () => {
      manager.createEdge('n1', 'n2', 'relationship');
      manager.createEdge('n3', 'n4', 'dependency');
      manager.createEdge('n5', 'n6', 'relationship');
      const edges = manager.getEdgesByType('relationship');
      expect(edges).toHaveLength(2);
    });

    it('should update edge', () => {
      const created = manager.createEdge('s', 't', 'relationship');
      const updated = manager.updateEdge(created.id, { weight: 5.0, type: 'dependency' });
      expect(updated?.weight).toBe(5.0);
      expect(updated?.type).toBe('dependency');
    });

    it('should delete edge', () => {
      const created = manager.createEdge('s', 't', 'relationship');
      const result = manager.deleteEdge(created.id);
      expect(result).toBe(true);
      expect(manager.getEdge(created.id)).toBeUndefined();
    });

    it('should delete edges by node', () => {
      manager.createEdge('n1', 'n2', 'relationship');
      manager.createEdge('n2', 'n3', 'dependency');
      manager.createEdge('n3', 'n1', 'reference');
      const count = manager.deleteEdgesByNode('n2');
      expect(count).toBe(2);
      expect(manager.getEdgesByNode('n2')).toHaveLength(0);
    });

    it('should filter edges', () => {
      manager.createEdge('n1', 'n2', 'relationship', {}, 1.0);
      manager.createEdge('n3', 'n4', 'dependency', {}, 5.0);
      manager.createEdge('n5', 'n6', 'relationship', {}, 10.0);

      const filter: EdgeFilter = { types: ['relationship'], weightRange: { min: 1, max: 5 } };
      const filtered = manager.filterEdges(filter);
      expect(filtered).toHaveLength(1);
    });

    it('should clear all edges', () => {
      manager.createEdge('n1', 'n2', 'relationship');
      manager.createEdge('n3', 'n4', 'dependency');
      manager.clear();
      expect(manager.size()).toBe(0);
    });
  });

  describe('GraphTraversal', () => {
    let traversal: GraphTraversal;
    let graph: Graph;

    beforeEach(() => {
      traversal = new GraphTraversal();
      graph = {
        id: 'test-graph',
        name: 'Test Graph',
        type: 'directed',
        nodes: [],
        edges: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    it('should traverse breadth-first', () => {
      graph.nodes = [
        { id: 'n1', label: '1', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'n2', label: '2', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'n3', label: '3', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
      ];
      graph.edges = [
        { id: 'e1', sourceId: 'n1', targetId: 'n2', type: 'relationship', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'e2', sourceId: 'n1', targetId: 'n3', type: 'relationship', properties: {}, createdAt: new Date(), updatedAt: new Date() },
      ];

      const options: TraversalOptions = { mode: 'breadth-first', maxDepth: 10 };
      const results = traversal.traverse(graph, 'n1', options);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should traverse depth-first', () => {
      graph.nodes = [
        { id: 'n1', label: '1', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'n2', label: '2', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
      ];
      graph.edges = [
        { id: 'e1', sourceId: 'n1', targetId: 'n2', type: 'relationship', properties: {}, createdAt: new Date(), updatedAt: new Date() },
      ];

      const options: TraversalOptions = { mode: 'depth-first' };
      const results = traversal.traverse(graph, 'n1', options);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should respect max depth', () => {
      graph.nodes = [
        { id: 'n1', label: '1', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'n2', label: '2', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'n3', label: '3', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
      ];
      graph.edges = [
        { id: 'e1', sourceId: 'n1', targetId: 'n2', type: 'relationship', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'e2', sourceId: 'n2', targetId: 'n3', type: 'relationship', properties: {}, createdAt: new Date(), updatedAt: new Date() },
      ];

      const options: TraversalOptions = { mode: 'breadth-first', maxDepth: 1 };
      const results = traversal.traverse(graph, 'n1', options);
      expect(results.every(r => r.depth <= 1)).toBe(true);
    });

    it('should find shortest path', () => {
      graph.nodes = [
        { id: 'n1', label: '1', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'n2', label: '2', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'n3', label: '3', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
      ];
      graph.edges = [
        { id: 'e1', sourceId: 'n1', targetId: 'n2', type: 'relationship', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'e2', sourceId: 'n2', targetId: 'n3', type: 'relationship', properties: {}, createdAt: new Date(), updatedAt: new Date() },
      ];

      const path = traversal.findShortestPath(graph, 'n1', 'n3');
      expect(path.length).toBe(3);
      expect(path[0].id).toBe('n1');
      expect(path[2].id).toBe('n3');
    });
  });

  describe('PathFinder', () => {
    let pathFinder: PathFinder;
    let graph: Graph;

    beforeEach(() => {
      pathFinder = new PathFinder();
      graph = {
        id: 'path-graph',
        name: 'Path Graph',
        type: 'directed',
        nodes: [],
        edges: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    it('should find path using dijkstra', () => {
      graph.nodes = [
        { id: 'a', label: 'A', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'b', label: 'B', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'c', label: 'C', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
      ];
      graph.edges = [
        { id: 'e1', sourceId: 'a', targetId: 'b', type: 'relationship', weight: 1, properties: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'e2', sourceId: 'b', targetId: 'c', type: 'relationship', weight: 2, properties: {}, createdAt: new Date(), updatedAt: new Date() },
      ];

      const result = pathFinder.findPath(graph, { algorithm: 'dijkstra', sourceId: 'a', targetId: 'c', weighted: true });
      expect(result.found).toBe(true);
      expect(result.path.length).toBe(3);
    });

    it('should find path using astar', () => {
      graph.nodes = [
        { id: 'a', label: 'A', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'b', label: 'B', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
      ];
      graph.edges = [
        { id: 'e1', sourceId: 'a', targetId: 'b', type: 'relationship', properties: {}, createdAt: new Date(), updatedAt: new Date() },
      ];

      const result = pathFinder.findPath(graph, { algorithm: 'astar', sourceId: 'a', targetId: 'b' });
      expect(result.found).toBe(true);
    });

    it('should return not found for non-existent path', () => {
      graph.nodes = [
        { id: 'a', label: 'A', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'b', label: 'B', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
      ];

      const result = pathFinder.findPath(graph, { algorithm: 'dijkstra', sourceId: 'a', targetId: 'b' });
      expect(result.found).toBe(false);
    });

    it('should find all paths', () => {
      graph.nodes = [
        { id: 'a', label: 'A', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'b', label: 'B', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'c', label: 'C', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
      ];
      graph.edges = [
        { id: 'e1', sourceId: 'a', targetId: 'b', type: 'relationship', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'e2', sourceId: 'a', targetId: 'c', type: 'relationship', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'e3', sourceId: 'b', targetId: 'c', type: 'relationship', properties: {}, createdAt: new Date(), updatedAt: new Date() },
      ];

      const paths = pathFinder.findAllPaths(graph, 'a', 'c', 10);
      expect(paths.length).toBeGreaterThan(0);
    });

    it('should use bellman-ford algorithm', () => {
      graph.nodes = [
        { id: 'a', label: 'A', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'b', label: 'B', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
      ];
      graph.edges = [
        { id: 'e1', sourceId: 'a', targetId: 'b', type: 'relationship', weight: 3, properties: {}, createdAt: new Date(), updatedAt: new Date() },
      ];

      const result = pathFinder.findPath(graph, { algorithm: 'bellman-ford', sourceId: 'a', targetId: 'b', weighted: true });
      expect(result.found).toBe(true);
      expect(result.cost).toBe(3);
    });

    it('should use floyd-warshall algorithm', () => {
      graph.nodes = [
        { id: 'a', label: 'A', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: 'b', label: 'B', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
      ];
      graph.edges = [
        { id: 'e1', sourceId: 'a', targetId: 'b', type: 'relationship', weight: 4, properties: {}, createdAt: new Date(), updatedAt: new Date() },
      ];

      const result = pathFinder.findPath(graph, { algorithm: 'floyd-warshall', sourceId: 'a', targetId: 'b' });
      expect(result.found).toBe(true);
    });
  });

  describe('GraphVisualizer', () => {
    let visualizer: GraphVisualizer;
    let graph: Graph;

    beforeEach(() => {
      visualizer = new GraphVisualizer();
      graph = {
        id: 'viz-graph',
        name: 'Viz Graph',
        type: 'directed',
        nodes: [
          { id: 'n1', label: 'Node 1', type: 'entity', properties: { key: 'value' }, createdAt: new Date(), updatedAt: new Date() },
          { id: 'n2', label: 'Node 2', type: 'hub', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        ],
        edges: [
          { id: 'e1', sourceId: 'n1', targetId: 'n2', type: 'relationship', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    it('should generate visualization data with circular layout', () => {
      const data = visualizer.generateVisualizationData(graph, 'circular');
      expect(data.graphId).toBe('viz-graph');
      expect(data.layout).toBe('circular');
      expect(data.nodes).toHaveLength(2);
      expect(data.edges).toHaveLength(1);
      expect(data.nodes[0].x).toBeDefined();
      expect(data.nodes[0].y).toBeDefined();
    });

    it('should generate visualization data with grid layout', () => {
      const data = visualizer.generateVisualizationData(graph, 'grid');
      expect(data.layout).toBe('grid');
      expect(data.nodes[0].x).toBeDefined();
    });

    it('should generate visualization data with hierarchical layout', () => {
      const data = visualizer.generateVisualizationData(graph, 'hierarchical');
      expect(data.layout).toBe('hierarchical');
    });

    it('should generate visualization data with force-directed layout', () => {
      const data = visualizer.generateVisualizationData(graph, 'force-directed');
      expect(data.layout).toBe('force-directed');
    });

    it('should assign correct colors based on node type', () => {
      const data = visualizer.generateVisualizationData(graph, 'circular');
      const entityNode = data.nodes.find(n => n.type === 'entity');
      const hubNode = data.nodes.find(n => n.type === 'hub');
      expect(entityNode?.color).toBe('#95E1D3');
      expect(hubNode?.color).toBe('#FF6B6B');
    });

    it('should calculate node size based on properties', () => {
      const data = visualizer.generateVisualizationData(graph, 'circular');
      const nodeWithProps = data.nodes.find(n => n.id === 'n1');
      expect(nodeWithProps?.size).toBeGreaterThan(20);
    });
  });

  describe('GraphStatistics', () => {
    let statistics: GraphStatistics;
    let graph: Graph;

    beforeEach(() => {
      statistics = new GraphStatistics();
      graph = {
        id: 'stats-graph',
        name: 'Stats Graph',
        type: 'directed',
        nodes: [
          { id: 'n1', label: '1', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
          { id: 'n2', label: '2', type: 'hub', properties: {}, createdAt: new Date(), updatedAt: new Date() },
          { id: 'n3', label: '3', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        ],
        edges: [
          { id: 'e1', sourceId: 'n1', targetId: 'n2', type: 'relationship', properties: {}, createdAt: new Date(), updatedAt: new Date() },
          { id: 'e2', sourceId: 'n2', targetId: 'n3', type: 'dependency', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    it('should calculate graph stats', () => {
      const stats = statistics.calculateStats(graph);
      expect(stats.totalNodes).toBe(3);
      expect(stats.totalEdges).toBe(2);
      expect(stats.nodeTypes.entity).toBe(2);
      expect(stats.nodeTypes.hub).toBe(1);
      expect(stats.edgeTypes.relationship).toBe(1);
      expect(stats.edgeTypes.dependency).toBe(1);
    });

    it('should calculate average degree', () => {
      const stats = statistics.calculateStats(graph);
      expect(stats.avgDegree).toBeCloseTo(1.33, 1);
    });

    it('should calculate density', () => {
      const stats = statistics.calculateStats(graph);
      expect(stats.density).toBeGreaterThan(0);
    });

    it('should calculate degree info', () => {
      const degrees = statistics.calculateDegrees(graph);
      expect(degrees).toHaveLength(3);
      const n1Degree = degrees.find(d => d.nodeId === 'n1');
      expect(n1Degree?.outDegree).toBe(1);
      expect(n1Degree?.inDegree).toBe(0);
    });

    it('should calculate centrality', () => {
      const centrality = statistics.calculateCentrality(graph);
      expect(centrality).toHaveLength(3);
      centrality.forEach(c => {
        expect(typeof c.centrality).toBe('number');
      });
    });

    it('should calculate graph metrics', () => {
      const metrics = statistics.calculateMetrics(graph);
      expect(typeof metrics.clusteringCoefficient).toBe('number');
      expect(typeof metrics.avgPathLength).toBe('number');
      expect(typeof metrics.diameter).toBe('number');
      expect(typeof metrics.radius).toBe('number');
    });
  });

  describe('GraphBackupManager', () => {
    let backupManager: GraphBackupManager;
    let graph: Graph;

    beforeEach(() => {
      backupManager = new GraphBackupManager(5);
      graph = {
        id: 'backup-graph',
        name: 'Backup Graph',
        type: 'directed',
        nodes: [
          { id: 'n1', label: '1', type: 'entity', properties: {}, createdAt: new Date(), updatedAt: new Date() },
        ],
        edges: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    it('should create backup', () => {
      const backup = backupManager.createBackup(graph);
      expect(backup.id).toMatch(/^backup_[a-f0-9]{16}$/);
      expect(backup.graphId).toBe('backup-graph');
    });

    it('should get backup by id', () => {
      const created = backupManager.createBackup(graph);
      const retrieved = backupManager.getBackup(created.id);
      expect(retrieved?.graphId).toBe('backup-graph');
    });

    it('should get backups by graph', () => {
      backupManager.createBackup(graph);
      backupManager.createBackup(graph);
      const backups = backupManager.getBackupsByGraph('backup-graph');
      expect(backups).toHaveLength(2);
    });

    it('should limit backups per graph', () => {
      for (let i = 0; i < 10; i++) {
        backupManager.createBackup(graph);
      }
      const backups = backupManager.getBackupsByGraph('backup-graph');
      expect(backups.length).toBeLessThanOrEqual(5);
    });

    it('should delete backup', () => {
      const created = backupManager.createBackup(graph);
      const result = backupManager.deleteBackup(created.id);
      expect(result).toBe(true);
      expect(backupManager.getBackup(created.id)).toBeUndefined();
    });

    it('should restore backup', () => {
      backupManager.createBackup(graph);
      const restored = backupManager.restoreBackup(graph.id);
      expect(restored).toBeUndefined();
    });
  });

  describe('GraphDatabase', () => {
    let db: GraphDatabase;

    beforeEach(() => {
      const options: GraphOptions = {
        name: 'Test Graph',
        description: 'A test graph',
        type: 'directed',
        autoSave: false,
      };
      db = new GraphDatabase(options);
    });

    it('should create graph database', () => {
      expect(db.getGraphId()).toMatch(/^graph_[a-f0-9]{16}$/);
    });

    it('should add node', () => {
      const node = db.addNode('User', 'entity', { name: 'John' });
      expect(node.label).toBe('User');
      expect(node.type).toBe('entity');
      expect(db.getAllNodes()).toHaveLength(1);
    });

    it('should add edge', () => {
      const n1 = db.addNode('Node 1', 'entity');
      const n2 = db.addNode('Node 2', 'hub');
      const edge = db.addEdge(n1.id, n2.id, 'relationship', {}, 1.0);
      expect(edge).toBeDefined();
      expect(edge?.sourceId).toBe(n1.id);
      expect(db.getAllEdges()).toHaveLength(1);
    });

    it('should return undefined for invalid edge', () => {
      const edge = db.addEdge('non-existent', 'also-non-existent', 'relationship');
      expect(edge).toBeUndefined();
    });

    it('should remove node', () => {
      const node = db.addNode('ToRemove', 'entity');
      const result = db.removeNode(node.id);
      expect(result).toBe(true);
      expect(db.getAllNodes()).toHaveLength(0);
    });

    it('should remove edge', () => {
      const n1 = db.addNode('Node 1', 'entity');
      const n2 = db.addNode('Node 2', 'hub');
      const edge = db.addEdge(n1.id, n2.id, 'relationship');
      const result = db.removeEdge(edge!.id);
      expect(result).toBe(true);
      expect(db.getAllEdges()).toHaveLength(0);
    });

    it('should update node', () => {
      const node = db.addNode('Original', 'entity');
      const updated = db.updateNode(node.id, { label: 'Updated' });
      expect(updated?.label).toBe('Updated');
    });

    it('should update edge', () => {
      const n1 = db.addNode('Node 1', 'entity');
      const n2 = db.addNode('Node 2', 'hub');
      const edge = db.addEdge(n1.id, n2.id, 'relationship');
      const updated = db.updateEdge(edge!.id, { weight: 5.0 });
      expect(updated?.weight).toBe(5.0);
    });

    it('should traverse graph', () => {
      const n1 = db.addNode('1', 'entity');
      const n2 = db.addNode('2', 'hub');
      db.addEdge(n1.id, n2.id, 'relationship');
      const results = db.traverse(n1.id, { mode: 'breadth-first' });
      expect(results.length).toBeGreaterThan(0);
    });

    it('should find path', () => {
      const n1 = db.addNode('1', 'entity');
      const n2 = db.addNode('2', 'hub');
      const n3 = db.addNode('3', 'entity');
      db.addEdge(n1.id, n2.id, 'relationship');
      db.addEdge(n2.id, n3.id, 'relationship');
      const result = db.findPath({ algorithm: 'dijkstra', sourceId: n1.id, targetId: n3.id });
      expect(result.found).toBe(true);
    });

    it('should find all paths', () => {
      const n1 = db.addNode('1', 'entity');
      const n2 = db.addNode('2', 'hub');
      const n3 = db.addNode('3', 'entity');
      db.addEdge(n1.id, n2.id, 'relationship');
      db.addEdge(n1.id, n3.id, 'relationship');
      db.addEdge(n2.id, n3.id, 'relationship');
      const paths = db.findAllPaths(n1.id, n3.id);
      expect(paths.length).toBeGreaterThan(0);
    });

    it('should visualize graph', () => {
      db.addNode('Node 1', 'entity');
      db.addNode('Node 2', 'hub');
      const viz = db.visualize('circular');
      expect(viz.nodes).toHaveLength(2);
      expect(viz.layout).toBe('circular');
    });

    it('should get stats', () => {
      db.addNode('Node 1', 'entity');
      db.addNode('Node 2', 'hub');
      const stats = db.getStats();
      expect(stats.totalNodes).toBe(2);
    });

    it('should get degrees', () => {
      const n1 = db.addNode('1', 'entity');
      const n2 = db.addNode('2', 'hub');
      db.addEdge(n1.id, n2.id, 'relationship');
      const degrees = db.getDegrees();
      expect(degrees).toHaveLength(2);
    });

    it('should get centrality', () => {
      db.addNode('Node 1', 'entity');
      db.addNode('Node 2', 'hub');
      const centrality = db.getCentrality();
      expect(centrality).toHaveLength(2);
    });

    it('should get metrics', () => {
      db.addNode('Node 1', 'entity');
      db.addNode('Node 2', 'hub');
      const metrics = db.getMetrics();
      expect(typeof metrics.clusteringCoefficient).toBe('number');
    });

    it('should create backup', () => {
      db.addNode('Node 1', 'entity');
      const backup = db.createBackup();
      expect(backup.id).toMatch(/^backup_[a-f0-9]{16}$/);
    });

    it('should get backups', () => {
      db.addNode('Node 1', 'entity');
      db.createBackup();
      db.createBackup();
      const backups = db.getBackups();
      expect(backups).toHaveLength(2);
    });

    it('should filter nodes', () => {
      db.addNode('Entity 1', 'entity');
      db.addNode('Hub 1', 'hub');
      const filtered = db.filterNodes({ types: ['entity'] });
      expect(filtered).toHaveLength(1);
    });

    it('should filter edges', () => {
      const n1 = db.addNode('1', 'entity');
      const n2 = db.addNode('2', 'hub');
      db.addEdge(n1.id, n2.id, 'relationship', {}, 1.0);
      const filtered = db.filterEdges({ types: ['relationship'] });
      expect(filtered).toHaveLength(1);
    });
  });

  describe('GraphDatabaseManager', () => {
    let manager: GraphDatabaseManager;

    beforeEach(() => {
      manager = new GraphDatabaseManager();
    });

    it('should create graph', () => {
      const options: GraphOptions = { name: 'My Graph', type: 'directed' };
      const db = manager.createGraph(options);
      expect(db.getGraphId()).toMatch(/^graph_[a-f0-9]{16}$/);
    });

    it('should get graph by id', () => {
      const db = manager.createGraph({ name: 'Test', type: 'undirected' });
      const retrieved = manager.getGraph(db.getGraphId());
      expect(retrieved).toBeDefined();
    });

    it('should return undefined for non-existent graph', () => {
      const result = manager.getGraph('non-existent');
      expect(result).toBeUndefined();
    });

    it('should get all graphs', () => {
      manager.createGraph({ name: 'Graph 1', type: 'directed' });
      manager.createGraph({ name: 'Graph 2', type: 'undirected' });
      expect(manager.getAllGraphs()).toHaveLength(2);
    });

    it('should delete graph', () => {
      const db = manager.createGraph({ name: 'ToDelete', type: 'directed' });
      const id = db.getGraphId();
      const result = manager.deleteGraph(id);
      expect(result).toBe(true);
      expect(manager.getGraph(id)).toBeUndefined();
    });

    it('should get graphs by type', () => {
      manager.createGraph({ name: 'Directed', type: 'directed' });
      manager.createGraph({ name: 'Undirected', type: 'undirected' });
      manager.createGraph({ name: 'Weighted', type: 'weighted' });
      const directed = manager.getGraphsByType('directed');
      expect(directed).toHaveLength(1);
    });
  });
});

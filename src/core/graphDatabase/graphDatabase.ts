import * as crypto from 'crypto';
import {
  Graph,
  GraphType,
  GraphNode,
  GraphEdge,
  NodeType,
  EdgeType,
  TraversalOptions,
  TraversalResult,
  PathFindingOptions,
  PathResult,
  VisualizationData,
  VisualizationLayout,
  GraphStats,
  Graph备份,
  SerializedGraph,
  SerializedNode,
  SerializedEdge,
  GraphOptions,
  NodeFilter,
  EdgeFilter,
  DegreeInfo,
  CentralityResult,
  GraphMetrics,
} from './types';

export const generateId = (prefix: string): string => {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
};

export class NodeManager {
  private nodes: Map<string, GraphNode>;

  constructor() {
    this.nodes = new Map();
  }

  createNode(
    label: string,
    type: NodeType,
    properties: Record<string, unknown> = {},
    metadata?: Record<string, unknown>
  ): GraphNode {
    const now = new Date();
    const node: GraphNode = {
      id: generateId('node'),
      label,
      type,
      properties,
      metadata,
      createdAt: now,
      updatedAt: now,
    };
    this.nodes.set(node.id, node);
    return node;
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  getNodeByLabel(label: string): GraphNode | undefined {
    return Array.from(this.nodes.values()).find(n => n.label === label);
  }

  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  getNodesByType(type: NodeType): GraphNode[] {
    return Array.from(this.nodes.values()).filter(n => n.type === type);
  }

  updateNode(id: string, updates: Partial<Omit<GraphNode, 'id' | 'createdAt'>>): GraphNode | undefined {
    const existing = this.nodes.get(id);
    if (!existing) return undefined;

    const updated: GraphNode = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    this.nodes.set(id, updated);
    return updated;
  }

  deleteNode(id: string): boolean {
    return this.nodes.delete(id);
  }

  addProperty(nodeId: string, key: string, value: unknown): GraphNode | undefined {
    const node = this.nodes.get(nodeId);
    if (!node) return undefined;

    node.properties[key] = value;
    node.updatedAt = new Date();
    return node;
  }

  removeProperty(nodeId: string, key: string): GraphNode | undefined {
    const node = this.nodes.get(nodeId);
    if (!node) return undefined;

    delete node.properties[key];
    node.updatedAt = new Date();
    return node;
  }

  filterNodes(filter: NodeFilter): GraphNode[] {
    return Array.from(this.nodes.values()).filter(node => {
      if (filter.types && !filter.types.includes(node.type)) {
        return false;
      }
      if (filter.label && node.label !== filter.label) {
        return false;
      }
      if (filter.properties) {
        for (const [key, value] of Object.entries(filter.properties)) {
          if (node.properties[key] !== value) {
            return false;
          }
        }
      }
      return true;
    });
  }

  clear(): void {
    this.nodes.clear();
  }

  size(): number {
    return this.nodes.size;
  }
}

export class EdgeManager {
  private edges: Map<string, GraphEdge>;

  constructor() {
    this.edges = new Map();
  }

  createEdge(
    sourceId: string,
    targetId: string,
    type: EdgeType,
    properties: Record<string, unknown> = {},
    weight?: number,
    metadata?: Record<string, unknown>
  ): GraphEdge {
    const now = new Date();
    const edge: GraphEdge = {
      id: generateId('edge'),
      sourceId,
      targetId,
      type,
      weight,
      properties,
      metadata,
      createdAt: now,
      updatedAt: now,
    };
    this.edges.set(edge.id, edge);
    return edge;
  }

  getEdge(id: string): GraphEdge | undefined {
    return this.edges.get(id);
  }

  getEdgesByNode(nodeId: string): GraphEdge[] {
    return Array.from(this.edges.values()).filter(
      e => e.sourceId === nodeId || e.targetId === nodeId
    );
  }

  getEdgesBySource(sourceId: string): GraphEdge[] {
    return Array.from(this.edges.values()).filter(e => e.sourceId === sourceId);
  }

  getEdgesByTarget(targetId: string): GraphEdge[] {
    return Array.from(this.edges.values()).filter(e => e.targetId === targetId);
  }

  getEdgesByType(type: EdgeType): GraphEdge[] {
    return Array.from(this.edges.values()).filter(e => e.type === type);
  }

  getAllEdges(): GraphEdge[] {
    return Array.from(this.edges.values());
  }

  updateEdge(id: string, updates: Partial<Omit<GraphEdge, 'id' | 'createdAt'>>): GraphEdge | undefined {
    const existing = this.edges.get(id);
    if (!existing) return undefined;

    const updated: GraphEdge = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    this.edges.set(id, updated);
    return updated;
  }

  deleteEdge(id: string): boolean {
    return this.edges.delete(id);
  }

  deleteEdgesByNode(nodeId: string): number {
    const toDelete = Array.from(this.edges.values()).filter(
      e => e.sourceId === nodeId || e.targetId === nodeId
    );
    toDelete.forEach(e => this.edges.delete(e.id));
    return toDelete.length;
  }

  filterEdges(filter: EdgeFilter): GraphEdge[] {
    return Array.from(this.edges.values()).filter(edge => {
      if (filter.types && !filter.types.includes(edge.type)) {
        return false;
      }
      if (filter.weightRange) {
        if (filter.weightRange.min !== undefined && (edge.weight === undefined || edge.weight < filter.weightRange.min)) {
          return false;
        }
        if (filter.weightRange.max !== undefined && (edge.weight === undefined || edge.weight > filter.weightRange.max)) {
          return false;
        }
      }
      return true;
    });
  }

  clear(): void {
    this.edges.clear();
  }

  size(): number {
    return this.edges.size;
  }
}

export class GraphTraversal {
  traverse(
    graph: Graph,
    startNodeId: string,
    options: TraversalOptions
  ): TraversalResult[] {
    const results: TraversalResult[] = [];
    const visited = new Set<string>();
    const startNode = graph.nodes.find(n => n.id === startNodeId);
    if (!startNode) return results;

    if (options.mode === 'depth-first') {
      this.depthFirstSearch(graph, startNode, visited, 0, options, results);
    } else {
      this.breadthFirstSearch(graph, startNode, visited, 0, options, results);
    }

    return results;
  }

  private depthFirstSearch(
    graph: Graph,
    node: GraphNode,
    visited: Set<string>,
    depth: number,
    options: TraversalOptions,
    results: TraversalResult[]
  ): void {
    if (visited.has(node.id)) return;
    if (options.maxDepth !== undefined && depth > options.maxDepth) return;
    if (options.filter && !options.filter(node)) return;

    visited.add(node.id);
    const path: GraphNode[] = [node];
    const edges: GraphEdge[] = [];
    const nodeEdges = graph.edges.filter(e => e.sourceId === node.id);

    for (const edge of nodeEdges) {
      const targetNode = graph.nodes.find(n => n.id === edge.targetId);
      if (targetNode && !visited.has(targetNode.id)) {
        edges.push(edge);
        path.push(targetNode);
        this.depthFirstSearch(graph, targetNode, visited, depth + 1, options, results);
        path.pop();
      }
    }

    results.push({
      path: options.includeProperties ? [...path] : path,
      edges: [...edges],
      depth,
    });
  }

  private breadthFirstSearch(
    graph: Graph,
    startNode: GraphNode,
    visited: Set<string>,
    depth: number,
    options: TraversalOptions,
    results: TraversalResult[]
  ): void {
    const queue: Array<{ node: GraphNode; path: GraphNode[]; edges: GraphEdge[]; currentDepth: number }> = [
      { node: startNode, path: [startNode], edges: [], currentDepth: 0 }
    ];

    while (queue.length > 0) {
      const { node, path, edges, currentDepth } = queue.shift()!;

      if (visited.has(node.id)) continue;
      if (options.maxDepth !== undefined && currentDepth > options.maxDepth) continue;
      if (options.filter && !options.filter(node)) continue;

      visited.add(node.id);

      results.push({
        path: options.includeProperties ? [...path] : path,
        edges: [...edges],
        depth: currentDepth,
      });

      const nodeEdges = graph.edges.filter(e => e.sourceId === node.id);
      for (const edge of nodeEdges) {
        const targetNode = graph.nodes.find(n => n.id === edge.targetId);
        if (targetNode && !visited.has(targetNode.id)) {
          queue.push({
            node: targetNode,
            path: [...path, targetNode],
            edges: [...edges, edge],
            currentDepth: currentDepth + 1,
          });
        }
      }
    }
  }

  findShortestPath(graph: Graph, sourceId: string, targetId: string): GraphNode[] {
    const visited = new Set<string>();
    const queue: Array<{ node: GraphNode; path: GraphNode[] }> = [];

    const startNode = graph.nodes.find(n => n.id === sourceId);
    if (!startNode) return [];

    queue.push({ node: startNode, path: [startNode] });

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;

      if (node.id === targetId) {
        return path;
      }

      if (visited.has(node.id)) continue;
      visited.add(node.id);

      const neighbors = graph.edges
        .filter(e => e.sourceId === node.id)
        .map(e => graph.nodes.find(n => n.id === e.targetId))
        .filter((n): n is GraphNode => n !== undefined && !visited.has(n.id));

      for (const neighbor of neighbors) {
        queue.push({ node: neighbor, path: [...path, neighbor] });
      }
    }

    return [];
  }
}

export class PathFinder {
  findPath(graph: Graph, options: PathFindingOptions): PathResult {
    const { algorithm, sourceId, targetId, weighted = false } = options;

    switch (algorithm) {
      case 'dijkstra':
        return this.dijkstra(graph, sourceId, targetId, weighted);
      case 'astar':
        return this.astar(graph, sourceId, targetId);
      case 'bellman-ford':
        return this.bellmanFord(graph, sourceId, targetId, weighted);
      case 'floyd-warshall':
        return this.floydWarshall(graph, sourceId, targetId);
      default:
        return this.dijkstra(graph, sourceId, targetId, weighted);
    }
  }

  private dijkstra(graph: Graph, sourceId: string, targetId: string, weighted: boolean): PathResult {
    const distances = new Map<string, number>();
    const previous = new Map<string, { nodeId: string; edgeId: string } | null>();
    const unvisited = new Set<string>();

    for (const node of graph.nodes) {
      distances.set(node.id, node.id === sourceId ? 0 : Infinity);
      previous.set(node.id, null);
      unvisited.add(node.id);
    }

    let visitedNodes = 0;

    while (unvisited.size > 0) {
      let minNode: string | null = null;
      let minDist = Infinity;

      for (const nodeId of unvisited) {
        const dist = distances.get(nodeId)!;
        if (dist < minDist) {
          minDist = dist;
          minNode = nodeId;
        }
      }

      if (minNode === null || minDist === Infinity) break;
      if (minNode === targetId) break;

      unvisited.delete(minNode);
      visitedNodes++;

      const outgoingEdges = graph.edges.filter(e => e.sourceId === minNode);
      for (const edge of outgoingEdges) {
        const alt = distances.get(minNode)! + (weighted && edge.weight !== undefined ? edge.weight : 1);
        if (alt < distances.get(edge.targetId)!) {
          distances.set(edge.targetId, alt);
          previous.set(edge.targetId, { nodeId: minNode, edgeId: edge.id });
        }
      }
    }

    return this.reconstructPath(graph, sourceId, targetId, previous, distances.get(targetId)!, visitedNodes);
  }

  private astar(graph: Graph, sourceId: string, targetId: string): PathResult {
    const openSet = new Set<string>([sourceId]);
    const cameFrom = new Map<string, { nodeId: string; edgeId: string } | null>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();

    for (const node of graph.nodes) {
      gScore.set(node.id, node.id === sourceId ? 0 : Infinity);
      fScore.set(node.id, node.id === sourceId ? this.heuristic(graph, sourceId, targetId) : Infinity);
      cameFrom.set(node.id, null);
    }

    let visitedNodes = 0;

    while (openSet.size > 0) {
      let current = '';
      let minF = Infinity;
      for (const nodeId of openSet) {
        const f = fScore.get(nodeId)!;
        if (f < minF) {
          minF = f;
          current = nodeId;
        }
      }

      if (current === targetId) {
        return this.reconstructPathAStar(graph, sourceId, targetId, cameFrom, gScore.get(targetId)!, visitedNodes);
      }

      openSet.delete(current);
      visitedNodes++;

      const outgoingEdges = graph.edges.filter(e => e.sourceId === current);
      for (const edge of outgoingEdges) {
        const tentativeG = gScore.get(current)! + (edge.weight !== undefined ? edge.weight : 1);
        if (tentativeG < gScore.get(edge.targetId)!) {
          cameFrom.set(edge.targetId, { nodeId: current, edgeId: edge.id });
          gScore.set(edge.targetId, tentativeG);
          fScore.set(edge.targetId, tentativeG + this.heuristic(graph, edge.targetId, targetId));
          openSet.add(edge.targetId);
        }
      }
    }

    return {
      found: false,
      path: [],
      edges: [],
      visitedNodes,
    };
  }

  private heuristic(graph: Graph, fromId: string, toId: string): number {
    const fromNode = graph.nodes.find(n => n.id === fromId);
    const toNode = graph.nodes.find(n => n.id === toId);
    if (!fromNode || !toNode) return Infinity;
    return 1;
  }

  private bellmanFord(graph: Graph, sourceId: string, targetId: string, weighted: boolean): PathResult {
    const distances = new Map<string, number>();
    const previous = new Map<string, { nodeId: string; edgeId: string } | null>();

    for (const node of graph.nodes) {
      distances.set(node.id, node.id === sourceId ? 0 : Infinity);
      previous.set(node.id, null);
    }

    let visitedNodes = 0;

    for (let i = 0; i < graph.nodes.length - 1; i++) {
      let updated = false;
      for (const edge of graph.edges) {
        const sourceDist = distances.get(edge.sourceId)!;
        const targetDist = distances.get(edge.targetId)!;
        const weight = weighted && edge.weight !== undefined ? edge.weight : 1;

        if (sourceDist !== Infinity && sourceDist + weight < targetDist) {
          distances.set(edge.targetId, sourceDist + weight);
          previous.set(edge.targetId, { nodeId: edge.sourceId, edgeId: edge.id });
          updated = true;
        }
      }
      if (!updated) break;
      visitedNodes++;
    }

    return this.reconstructPath(graph, sourceId, targetId, previous, distances.get(targetId)!, visitedNodes);
  }

  private floydWarshall(graph: Graph, sourceId: string, targetId: string): PathResult {
    const dist = new Map<string, Map<string, number>>();
    const next = new Map<string, Map<string, { nodeId: string; edgeId: string } | null>>();

    for (const node of graph.nodes) {
      dist.set(node.id, new Map());
      next.set(node.id, new Map());
      for (const other of graph.nodes) {
        if (node.id === other.id) {
          dist.get(node.id)!.set(other.id, 0);
        } else {
          dist.get(node.id)!.set(other.id, Infinity);
        }
        next.get(node.id)!.set(other.id, null);
      }
    }

    for (const edge of graph.edges) {
      const weight = edge.weight !== undefined ? edge.weight : 1;
      const currentDist = dist.get(edge.sourceId)!.get(edge.targetId)!;
      if (weight < currentDist) {
        dist.get(edge.sourceId)!.set(edge.targetId, weight);
        next.get(edge.sourceId)!.set(edge.targetId, { nodeId: edge.sourceId, edgeId: edge.id });
      }
    }

    for (const k of graph.nodes) {
      for (const i of graph.nodes) {
        for (const j of graph.nodes) {
          const throughK = dist.get(i.id)!.get(k.id)! + dist.get(k.id)!.get(j.id)!;
          if (throughK < dist.get(i.id)!.get(j.id)!) {
            dist.get(i.id)!.set(j.id, throughK);
          }
        }
      }
    }

    const path: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    let current = sourceId;
    const visited = new Set<string>();

    while (current !== targetId && !visited.has(current)) {
      visited.add(current);
      const node = graph.nodes.find(n => n.id === current);
      if (!node) break;
      path.push(node);

      const nextNode = next.get(current)!.get(targetId);
      if (!nextNode) break;
      current = nextNode.nodeId;
    }

    const targetNode = graph.nodes.find(n => n.id === targetId);
    if (targetNode) path.push(targetNode);

    return {
      found: path.length > 0,
      path,
      edges,
      totalWeight: dist.get(sourceId)!.get(targetId),
      cost: dist.get(sourceId)!.get(targetId),
      visitedNodes: visited.size,
    };
  }

  private reconstructPath(
    graph: Graph,
    sourceId: string,
    targetId: string,
    previous: Map<string, { nodeId: string; edgeId: string } | null>,
    cost: number,
    visitedNodes: number
  ): PathResult {
    const path: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    let current: string | null = targetId;

    while (current !== null) {
      const node = graph.nodes.find(n => n.id === current);
      if (node) path.unshift(node);
      const prev = previous.get(current!);
      if (prev === null || prev === undefined) break;

      const edge = graph.edges.find(e => e.id === prev.edgeId);
      if (edge) edges.unshift(edge);
      current = prev.nodeId;
    }

    return {
      found: path.length > 0 && path[0].id === sourceId,
      path,
      edges,
      totalWeight: cost === Infinity ? undefined : cost,
      cost: cost === Infinity ? undefined : cost,
      visitedNodes,
    };
  }

  private reconstructPathAStar(
    graph: Graph,
    sourceId: string,
    targetId: string,
    cameFrom: Map<string, { nodeId: string; edgeId: string } | null>,
    cost: number,
    visitedNodes: number
  ): PathResult {
    const path: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    let current: string | null = targetId;

    while (current !== null) {
      const node = graph.nodes.find(n => n.id === current);
      if (node) path.unshift(node);
      const prev = cameFrom.get(current!);
      if (prev === null || prev === undefined) break;

      const edge = graph.edges.find(e => e.id === prev.edgeId);
      if (edge) edges.unshift(edge);
      current = prev.nodeId;
    }

    return {
      found: path.length > 0 && path[0].id === sourceId,
      path,
      edges,
      totalWeight: cost === Infinity ? undefined : cost,
      cost: cost === Infinity ? undefined : cost,
      visitedNodes,
    };
  }

  findAllPaths(graph: Graph, sourceId: string, targetId: string, maxDepth: number = 10): PathResult[] {
    const results: PathResult[] = [];
    const visited = new Set<string>();

    const startNode = graph.nodes.find(n => n.id === sourceId);
    const endNode = graph.nodes.find(n => n.id === targetId);
    if (!startNode || !endNode) return results;

    this.depthFirstPathFind(graph, sourceId, targetId, [], [], visited, 0, maxDepth, results);
    return results;
  }

  private depthFirstPathFind(
    graph: Graph,
    currentId: string,
    targetId: string,
    path: GraphNode[],
    edges: GraphEdge[],
    visited: Set<string>,
    depth: number,
    maxDepth: number,
    results: PathResult[]
  ): void {
    if (depth > maxDepth) return;

    const currentNode = graph.nodes.find(n => n.id === currentId);
    if (!currentNode) return;

    visited.add(currentId);
    path.push(currentNode);

    if (currentId === targetId) {
      results.push({
        found: true,
        path: [...path],
        edges: [...edges],
        visitedNodes: visited.size,
      });
    } else {
      const outgoing = graph.edges.filter(e => e.sourceId === currentId);
      for (const edge of outgoing) {
        if (!visited.has(edge.targetId)) {
          edges.push(edge);
          this.depthFirstPathFind(graph, edge.targetId, targetId, path, edges, new Set(visited), depth + 1, maxDepth, results);
          edges.pop();
        }
      }
    }

    path.pop();
  }
}

export class GraphVisualizer {
  generateVisualizationData(
    graph: Graph,
    layout: VisualizationLayout = 'force-directed'
  ): VisualizationData {
    const nodes = graph.nodes.map((node, index) => {
      const pos = this.calculatePosition(graph, node, index, layout);
      return {
        id: node.id,
        label: node.label,
        type: node.type,
        x: pos.x,
        y: pos.y,
        size: this.calculateNodeSize(node),
        color: this.getNodeColor(node.type),
      };
    });

    const edges = graph.edges.map(edge => ({
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      weight: edge.weight,
      label: edge.type,
    }));

    return {
      graphId: graph.id,
      layout,
      nodes,
      edges,
      metadata: {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  private calculatePosition(
    graph: Graph,
    node: GraphNode,
    index: number,
    layout: VisualizationLayout
  ): { x: number; y: number } {
    const width = 1000;
    const height = 1000;
    const centerX = width / 2;
    const centerY = height / 2;

    switch (layout) {
      case 'circular':
        const angle = (2 * Math.PI * index) / graph.nodes.length;
        return {
          x: centerX + (width / 3) * Math.cos(angle),
          y: centerY + (height / 3) * Math.sin(angle),
        };

      case 'grid': {
        const cols = Math.ceil(Math.sqrt(graph.nodes.length));
        const row = Math.floor(index / cols);
        const col = index % cols;
        return {
          x: (width / (cols + 1)) * (col + 1),
          y: (height / (Math.ceil(graph.nodes.length / cols) + 1)) * (row + 1),
        };
      }

      case 'hierarchical': {
        const level = this.calculateNodeLevel(graph, node);
        return {
          x: centerX + (level - 2) * 150,
          y: centerY + (index % 10) * 80 - 400,
        };
      }

      case 'force-directed':
      default:
        return {
          x: centerX + (Math.random() - 0.5) * width * 0.5,
          y: centerY + (Math.random() - 0.5) * height * 0.5,
        };
    }
  }

  private calculateNodeLevel(graph: Graph, node: GraphNode): number {
    const inEdges = graph.edges.filter(e => e.targetId === node.id);
    if (inEdges.length === 0) return 0;
    return 1;
  }

  private calculateNodeSize(node: GraphNode): number {
    const baseSize = 20;
    const propertySize = Object.keys(node.properties).length * 2;
    return baseSize + propertySize;
  }

  private getNodeColor(type: NodeType): string {
    switch (type) {
      case 'hub':
        return '#FF6B6B';
      case 'bridge':
        return '#4ECDC4';
      case 'entity':
      default:
        return '#95E1D3';
    }
  }
}

export class GraphStatistics {
  calculateStats(graph: Graph): GraphStats {
    const nodeTypes = this.countNodeTypes(graph);
    const edgeTypes = this.countEdgeTypes(graph);
    const avgDegree = this.calculateAverageDegree(graph);
    const density = this.calculateDensity(graph);
    const connectedComponents = this.countConnectedComponents(graph);

    return {
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
      nodeTypes,
      edgeTypes,
      avgDegree,
      density,
      connectedComponents,
    };
  }

  private countNodeTypes(graph: Graph): Record<NodeType, number> {
    const counts: Record<NodeType, number> = { entity: 0, hub: 0, bridge: 0 };
    for (const node of graph.nodes) {
      counts[node.type]++;
    }
    return counts;
  }

  private countEdgeTypes(graph: Graph): Record<EdgeType, number> {
    const counts: Record<EdgeType, number> = { relationship: 0, dependency: 0, reference: 0 };
    for (const edge of graph.edges) {
      counts[edge.type]++;
    }
    return counts;
  }

  private calculateAverageDegree(graph: Graph): number {
    if (graph.nodes.length === 0) return 0;
    return (2 * graph.edges.length) / graph.nodes.length;
  }

  private calculateDensity(graph: Graph): number {
    const n = graph.nodes.length;
    if (n <= 1) return 0;

    const maxEdges = graph.type === 'directed' ? n * (n - 1) : (n * (n - 1)) / 2;
    return graph.edges.length / maxEdges;
  }

  private countConnectedComponents(graph: Graph): number {
    if (graph.nodes.length === 0) return 0;

    const visited = new Set<string>();
    let components = 0;

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        this.bfsComponent(graph, node.id, visited);
        components++;
      }
    }

    return components;
  }

  private bfsComponent(graph: Graph, startId: string, visited: Set<string>): void {
    const queue = [startId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const neighbors = graph.edges
        .filter(e => e.sourceId === current || e.targetId === current)
        .map(e => (e.sourceId === current ? e.targetId : e.sourceId));

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }
  }

  calculateDegrees(graph: Graph): DegreeInfo[] {
    return graph.nodes.map(node => {
      const inDegree = graph.edges.filter(e => e.targetId === node.id).length;
      const outDegree = graph.edges.filter(e => e.sourceId === node.id).length;
      return {
        nodeId: node.id,
        inDegree,
        outDegree,
        totalDegree: inDegree + outDegree,
      };
    });
  }

  calculateCentrality(graph: Graph): CentralityResult[] {
    const centrality = new Map<string, number>();

    for (const node of graph.nodes) {
      let sum = 0;
      for (const other of graph.nodes) {
        if (node.id !== other.id) {
          const pathResult = new PathFinder().findPath(graph, {
            algorithm: 'dijkstra',
            sourceId: node.id,
            targetId: other.id,
          });
          if (pathResult.found && pathResult.cost !== undefined) {
            sum += 1 / pathResult.cost;
          }
        }
      }
      centrality.set(node.id, sum);
    }

    return Array.from(centrality.entries()).map(([nodeId, centr]) => ({
      nodeId,
      centrality: centr,
    }));
  }

  calculateMetrics(graph: Graph): GraphMetrics {
    const clusteringCoefficient = this.calculateClusteringCoefficient(graph);
    const avgPathLength = this.calculateAveragePathLength(graph);
    const diameter = this.calculateDiameter(graph);
    const radius = this.calculateRadius(graph);

    return {
      clusteringCoefficient,
      avgPathLength,
      diameter,
      radius,
    };
  }

  private calculateClusteringCoefficient(graph: Graph): number {
    let totalCoeff = 0;
    let nodesWithNeighbors = 0;

    for (const node of graph.nodes) {
      const neighbors = graph.edges
        .filter(e => e.sourceId === node.id)
        .map(e => e.targetId);

      const neighborSet = new Set(neighbors);
      if (neighborSet.size >= 2) {
        let triangles = 0;
        const possibleTriangles = (neighborSet.size * (neighborSet.size - 1)) / 2;

        for (const neighbor1 of neighborSet) {
          for (const neighbor2 of neighborSet) {
            if (neighbor1 !== neighbor2) {
              const edge1 = graph.edges.find(
                e => (e.sourceId === neighbor1 && e.targetId === neighbor2) ||
                     (e.sourceId === neighbor2 && e.targetId === neighbor1)
              );
              if (edge1) triangles++;
            }
          }
        }

        totalCoeff += triangles / possibleTriangles;
        nodesWithNeighbors++;
      }
    }

    return nodesWithNeighbors > 0 ? totalCoeff / nodesWithNeighbors : 0;
  }

  private calculateAveragePathLength(graph: Graph): number {
    const pathFinder = new PathFinder();
    let totalLength = 0;
    let pathCount = 0;

    for (const source of graph.nodes) {
      for (const target of graph.nodes) {
        if (source.id !== target.id) {
          const result = pathFinder.findPath(graph, {
            algorithm: 'dijkstra',
            sourceId: source.id,
            targetId: target.id,
          });
          if (result.found && result.cost !== undefined) {
            totalLength += result.cost;
            pathCount++;
          }
        }
      }
    }

    return pathCount > 0 ? totalLength / pathCount : 0;
  }

  private calculateDiameter(graph: Graph): number {
    let maxDistance = 0;
    const pathFinder = new PathFinder();

    for (const source of graph.nodes) {
      for (const target of graph.nodes) {
        if (source.id !== target.id) {
          const result = pathFinder.findPath(graph, {
            algorithm: 'dijkstra',
            sourceId: source.id,
            targetId: target.id,
          });
          if (result.found && result.cost !== undefined && result.cost > maxDistance) {
            maxDistance = result.cost;
          }
        }
      }
    }

    return maxDistance;
  }

  private calculateRadius(graph: Graph): number {
    let minMaxDistance = Infinity;
    const pathFinder = new PathFinder();

    for (const center of graph.nodes) {
      let maxDistance = 0;

      for (const other of graph.nodes) {
        if (center.id !== other.id) {
          const result = pathFinder.findPath(graph, {
            algorithm: 'dijkstra',
            sourceId: center.id,
            targetId: other.id,
          });
          if (result.found && result.cost !== undefined && result.cost > maxDistance) {
            maxDistance = result.cost;
          }
        }
      }

      if (maxDistance < minMaxDistance) {
        minMaxDistance = maxDistance;
      }
    }

    return minMaxDistance === Infinity ? 0 : minMaxDistance;
  }
}

export class GraphBackupManager {
  private backups: Map<string, Graph备份[]>;
  private maxBackupsPerGraph: number;

  constructor(maxBackupsPerGraph: number = 10) {
    this.backups = new Map();
    this.maxBackupsPerGraph = maxBackupsPerGraph;
  }

  createBackup(graph: Graph): Graph备份 {
    const backup: Graph备份 = {
      id: generateId('backup'),
      graphId: graph.id,
      data: JSON.stringify(this.serializeGraph(graph)),
      createdAt: new Date(),
    };

    const graphBackups = this.backups.get(graph.id) || [];
    graphBackups.push(backup);

    if (graphBackups.length > this.maxBackupsPerGraph) {
      graphBackups.shift();
    }

    this.backups.set(graph.id, graphBackups);
    return backup;
  }

  getBackup(backupId: string): Graph备份 | undefined {
    for (const backups of this.backups.values()) {
      const found = backups.find(b => b.id === backupId);
      if (found) return found;
    }
    return undefined;
  }

  getBackupsByGraph(graphId: string): Graph备份[] {
    return this.backups.get(graphId) || [];
  }

  deleteBackup(backupId: string): boolean {
    for (const [graphId, backups] of this.backups.entries()) {
      const index = backups.findIndex(b => b.id === backupId);
      if (index !== -1) {
        backups.splice(index, 1);
        this.backups.set(graphId, backups);
        return true;
      }
    }
    return false;
  }

  restoreBackup(backupId: string): Graph | undefined {
    const backup = this.getBackup(backupId);
    if (!backup) return undefined;

    try {
      const data = JSON.parse(backup.data) as SerializedGraph;
      return this.deserializeGraph(data);
    } catch {
      return undefined;
    }
  }

  private serializeGraph(graph: Graph): SerializedGraph {
    return {
      id: graph.id,
      name: graph.name,
      description: graph.description,
      type: graph.type,
      nodes: graph.nodes.map(n => this.serializeNode(n)),
      edges: graph.edges.map(e => this.serializeEdge(e)),
      metadata: graph.metadata,
      createdAt: graph.createdAt.toISOString(),
      updatedAt: graph.updatedAt.toISOString(),
    };
  }

  private serializeNode(node: GraphNode): SerializedNode {
    return {
      id: node.id,
      label: node.label,
      type: node.type,
      properties: node.properties,
      metadata: node.metadata,
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString(),
    };
  }

  private serializeEdge(edge: GraphEdge): SerializedEdge {
    return {
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      type: edge.type,
      weight: edge.weight,
      properties: edge.properties,
      metadata: edge.metadata,
      createdAt: edge.createdAt.toISOString(),
      updatedAt: edge.updatedAt.toISOString(),
    };
  }

  private deserializeGraph(data: SerializedGraph): Graph {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      type: data.type,
      nodes: data.nodes.map(n => this.deserializeNode(n)),
      edges: data.edges.map(e => this.deserializeEdge(e)),
      metadata: data.metadata,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
  }

  private deserializeNode(data: SerializedNode): GraphNode {
    return {
      id: data.id,
      label: data.label,
      type: data.type,
      properties: data.properties,
      metadata: data.metadata,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
  }

  private deserializeEdge(data: SerializedEdge): GraphEdge {
    return {
      id: data.id,
      sourceId: data.sourceId,
      targetId: data.targetId,
      type: data.type,
      weight: data.weight,
      properties: data.properties,
      metadata: data.metadata,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
  }
}

export class GraphDatabase {
  private nodeManager: NodeManager;
  private edgeManager: EdgeManager;
  private traversal: GraphTraversal;
  private pathFinder: PathFinder;
  private visualizer: GraphVisualizer;
  private statistics: GraphStatistics;
  private backupManager: GraphBackupManager;
  private graph: Graph;
  private autoSave: boolean;

  constructor(options: GraphOptions) {
    this.nodeManager = new NodeManager();
    this.edgeManager = new EdgeManager();
    this.traversal = new GraphTraversal();
    this.pathFinder = new PathFinder();
    this.visualizer = new GraphVisualizer();
    this.statistics = new GraphStatistics();
    this.backupManager = new GraphBackupManager();
    this.autoSave = options.autoSave ?? false;

    const now = new Date();
    this.graph = {
      id: generateId('graph'),
      name: options.name,
      description: options.description,
      type: options.type,
      nodes: [],
      edges: [],
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };
  }

  getGraphId(): string {
    return this.graph.id;
  }

  getGraph(): Graph {
    return this.graph;
  }

  getNodeManager(): NodeManager {
    return this.nodeManager;
  }

  getEdgeManager(): EdgeManager {
    return this.edgeManager;
  }

  getTraversal(): GraphTraversal {
    return this.traversal;
  }

  getPathFinder(): PathFinder {
    return this.pathFinder;
  }

  getVisualizer(): GraphVisualizer {
    return this.visualizer;
  }

  getStatistics(): GraphStatistics {
    return this.statistics;
  }

  getBackupManager(): GraphBackupManager {
    return this.backupManager;
  }

  addNode(label: string, type: NodeType, properties?: Record<string, unknown>, metadata?: Record<string, unknown>): GraphNode {
    const node = this.nodeManager.createNode(label, type, properties || {}, metadata);
    this.graph.nodes.push(node);
    this.graph.updatedAt = new Date();
    if (this.autoSave) {
      this.backupManager.createBackup(this.graph);
    }
    return node;
  }

  addEdge(sourceId: string, targetId: string, type: EdgeType, properties?: Record<string, unknown>, weight?: number, metadata?: Record<string, unknown>): GraphEdge | undefined {
    const sourceNode = this.nodeManager.getNode(sourceId);
    const targetNode = this.nodeManager.getNode(targetId);
    if (!sourceNode || !targetNode) return undefined;

    const edge = this.edgeManager.createEdge(sourceId, targetId, type, properties || {}, weight, metadata);
    this.graph.edges.push(edge);
    this.graph.updatedAt = new Date();
    if (this.autoSave) {
      this.backupManager.createBackup(this.graph);
    }
    return edge;
  }

  removeNode(nodeId: string): boolean {
    this.edgeManager.deleteEdgesByNode(nodeId);
    const result = this.nodeManager.deleteNode(nodeId);
    if (result) {
      this.graph.nodes = this.graph.nodes.filter(n => n.id !== nodeId);
      this.graph.edges = this.graph.edges.filter(e => e.sourceId !== nodeId && e.targetId !== nodeId);
      this.graph.updatedAt = new Date();
    }
    return result;
  }

  removeEdge(edgeId: string): boolean {
    const result = this.edgeManager.deleteEdge(edgeId);
    if (result) {
      this.graph.edges = this.graph.edges.filter(e => e.id !== edgeId);
      this.graph.updatedAt = new Date();
    }
    return result;
  }

  getNode(nodeId: string): GraphNode | undefined {
    return this.nodeManager.getNode(nodeId);
  }

  getEdge(edgeId: string): GraphEdge | undefined {
    return this.edgeManager.getEdge(edgeId);
  }

  getAllNodes(): GraphNode[] {
    return this.nodeManager.getAllNodes();
  }

  getAllEdges(): GraphEdge[] {
    return this.edgeManager.getAllEdges();
  }

  traverse(startNodeId: string, options: TraversalOptions): TraversalResult[] {
    return this.traversal.traverse(this.graph, startNodeId, options);
  }

  findPath(options: PathFindingOptions): PathResult {
    return this.pathFinder.findPath(this.graph, options);
  }

  findAllPaths(sourceId: string, targetId: string, maxDepth?: number): PathResult[] {
    return this.pathFinder.findAllPaths(this.graph, sourceId, targetId, maxDepth);
  }

  visualize(layout?: VisualizationLayout): VisualizationData {
    return this.visualizer.generateVisualizationData(this.graph, layout);
  }

  getStats(): GraphStats {
    return this.statistics.calculateStats(this.graph);
  }

  getDegrees(): DegreeInfo[] {
    return this.statistics.calculateDegrees(this.graph);
  }

  getCentrality(): CentralityResult[] {
    return this.statistics.calculateCentrality(this.graph);
  }

  getMetrics(): GraphMetrics {
    return this.statistics.calculateMetrics(this.graph);
  }

  createBackup(): Graph备份 {
    return this.backupManager.createBackup(this.graph);
  }

  restoreBackup(backupId: string): Graph | undefined {
    const restored = this.backupManager.restoreBackup(backupId);
    if (restored) {
      this.graph = restored;
      this.nodeManager.clear();
      this.edgeManager.clear();
      for (const node of restored.nodes) {
        this.nodeManager.getAllNodes().push(node);
      }
      for (const edge of restored.edges) {
        this.edgeManager.getAllEdges().push(edge);
      }
    }
    return restored;
  }

  getBackups(): Graph备份[] {
    return this.backupManager.getBackupsByGraph(this.graph.id);
  }

  filterNodes(filter: NodeFilter): GraphNode[] {
    return this.nodeManager.filterNodes(filter);
  }

  filterEdges(filter: EdgeFilter): GraphEdge[] {
    return this.edgeManager.filterEdges(filter);
  }

  updateNode(nodeId: string, updates: Partial<Omit<GraphNode, 'id' | 'createdAt'>>): GraphNode | undefined {
    const updated = this.nodeManager.updateNode(nodeId, updates);
    if (updated) {
      const index = this.graph.nodes.findIndex(n => n.id === nodeId);
      if (index !== -1) {
        this.graph.nodes[index] = updated;
        this.graph.updatedAt = new Date();
      }
    }
    return updated;
  }

  updateEdge(edgeId: string, updates: Partial<Omit<GraphEdge, 'id' | 'createdAt'>>): GraphEdge | undefined {
    const updated = this.edgeManager.updateEdge(edgeId, updates);
    if (updated) {
      const index = this.graph.edges.findIndex(e => e.id === edgeId);
      if (index !== -1) {
        this.graph.edges[index] = updated;
        this.graph.updatedAt = new Date();
      }
    }
    return updated;
  }
}

export class GraphDatabaseManager {
  private databases: Map<string, GraphDatabase>;

  constructor() {
    this.databases = new Map();
  }

  createGraph(options: GraphOptions): GraphDatabase {
    const db = new GraphDatabase(options);
    this.databases.set(db.getGraphId(), db);
    return db;
  }

  getGraph(id: string): GraphDatabase | undefined {
    return this.databases.get(id);
  }

  getAllGraphs(): GraphDatabase[] {
    return Array.from(this.databases.values());
  }

  deleteGraph(id: string): boolean {
    return this.databases.delete(id);
  }

  getGraphsByType(type: GraphType): GraphDatabase[] {
    return Array.from(this.databases.values()).filter(db => db.getGraph().type === type);
  }
}

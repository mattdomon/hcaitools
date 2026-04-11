export type GraphType = 'directed' | 'undirected' | 'weighted';
export type NodeType = 'entity' | 'hub' | 'bridge';
export type EdgeType = 'relationship' | 'dependency' | 'reference';
export type TraversalMode = 'breadth-first' | 'depth-first';
export type PathAlgorithm = 'dijkstra' | 'astar' | 'bellman-ford' | 'floyd-warshall';
export type VisualizationLayout = 'force-directed' | 'hierarchical' | 'circular' | 'grid';

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  properties: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: EdgeType;
  weight?: number;
  properties: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Graph {
  id: string;
  name: string;
  description?: string;
  type: GraphType;
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TraversalOptions {
  mode: TraversalMode;
  maxDepth?: number;
  includeProperties?: boolean;
  filter?: (node: GraphNode) => boolean;
}

export interface TraversalResult {
  path: GraphNode[];
  edges: GraphEdge[];
  depth: number;
  totalWeight?: number;
}

export interface PathFindingOptions {
  algorithm: PathAlgorithm;
  sourceId: string;
  targetId: string;
  weighted?: boolean;
  maxCost?: number;
}

export interface PathResult {
  found: boolean;
  path: GraphNode[];
  edges: GraphEdge[];
  totalWeight?: number;
  cost?: number;
  visitedNodes: number;
}

export interface VisualizationData {
  graphId: string;
  layout: VisualizationLayout;
  nodes: Array<{
    id: string;
    label: string;
    type: NodeType;
    x?: number;
    y?: number;
    size?: number;
    color?: string;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    weight?: number;
    label?: string;
  }>;
  metadata?: Record<string, unknown>;
}

export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  nodeTypes: Record<NodeType, number>;
  edgeTypes: Record<EdgeType, number>;
  avgDegree: number;
  density: number;
  connectedComponents: number;
}

export interface SubgraphOptions {
  nodeIds?: string[];
  edgeIds?: string[];
  depth?: number;
  centerNodeId?: string;
  includeEdges?: boolean;
}

export interface Graph备份 {
  id: string;
  graphId: string;
  data: string;
  createdAt: Date;
}

export interface SerializedGraph {
  id: string;
  name: string;
  description?: string;
  type: GraphType;
  nodes: Array<{
    id: string;
    label: string;
    type: NodeType;
    properties: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }>;
  edges: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    type: EdgeType;
    weight?: number;
    properties: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedNode {
  id: string;
  label: string;
  type: NodeType;
  properties: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: EdgeType;
  weight?: number;
  properties: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GraphConnection {
  id: string;
  graphId: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  sslEnabled: boolean;
  timeout: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GraphOptions {
  name: string;
  description?: string;
  type: GraphType;
  connection?: Omit<GraphConnection, 'id' | 'createdAt' | 'updatedAt'>;
  autoSave?: boolean;
}

export interface NodeFilter {
  types?: NodeType[];
  label?: string;
  properties?: Record<string, unknown>;
  minDegree?: number;
  maxDegree?: number;
}

export interface EdgeFilter {
  types?: EdgeType[];
  weightRange?: { min?: number; max?: number };
  sourceTypes?: NodeType[];
  targetTypes?: NodeType[];
}

export interface DegreeInfo {
  nodeId: string;
  inDegree: number;
  outDegree: number;
  totalDegree: number;
}

export interface CentralityResult {
  nodeId: string;
  centrality: number;
}

export interface GraphMetrics {
  clusteringCoefficient: number;
  avgPathLength: number;
  diameter: number;
  radius: number;
}

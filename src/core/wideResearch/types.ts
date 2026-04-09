/**
 * Wide Research Types
 * Parallel multi-agent research system for context window limitation bypass
 */

export type AggregationStrategy = 'consensus' | 'majority_voting' | 'averaging' | 'weighted_consensus';

export interface ResearchTask {
  taskId: string;
  query: string;
  objectives: ResearchObjective[];
  numAgents: number;
  timeout: number;
  maxContextPerAgent: number;
  aggregationStrategy: AggregationStrategy;
  createdAt: Date;
}

export interface ResearchObjective {
  objectiveId: string;
  description: string;
  focusArea: string;
  expectedOutcomes: string[];
}

export interface AgentInstance {
  agentId: string;
  taskId: string;
  virtualMachineId: string;
  context: string;
  model: string;
  status: AgentStatus;
  createdAt: Date;
  completedAt?: Date;
  result?: ResearchResult;
  error?: string;
}

export type AgentStatus = 
  | 'initializing'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timed_out';

export interface ResearchResult {
  agentId: string;
  findings: Finding[];
  citations: Citation[];
  confidence: number;
  completedAt: Date;
}

export interface Finding {
  findingId: string;
  title: string;
  description: string;
  evidence: string[];
  confidence: number;
  source?: string;
}

export interface Citation {
  citationId: string;
  title: string;
  authors: string[];
  year?: number;
  url?: string;
  relevance: number;
}

export interface AggregatedResearch {
  taskId: string;
  query: string;
  totalAgents: number;
  completedAgents: number;
  failedAgents: number;
  aggregatedFindings: AggregatedFinding[];
  aggregatedCitations: Citation[];
  conflictingOpinions: ConflictingOpinion[];
  consensusScore: number;
  executionTimeMs: number;
  createdAt: Date;
}

export interface AggregatedFinding {
  findingId: string;
  title: string;
  description: string;
  supportingAgents: string[];
  conflictingAgents: string[];
  confidenceScore: number;
  synthesizedEvidence: string[];
}

export interface ConflictingOpinion {
  topic: string;
  opinions: Opinion[];
  agents: string[];
}

export interface Opinion {
  content: string;
  agentId: string;
  confidence: number;
}

export interface VirtualMachine {
  vmId: string;
  agentId: string;
  status: VMStatus;
  memoryMb: number;
  cpuCores: number;
  createdAt: Date;
  terminatedAt?: Date;
}

export type VMStatus = 'initializing' | 'running' | 'terminating' | 'terminated';

export interface BarrierSynchronization {
  barrierId: string;
  taskId: string;
  expectedAgents: number;
  arrivedAgents: number;
  isActive: boolean;
  createdAt: Date;
  completedAt?: Date;
}

export interface ContextManager {
  getContext(agentId: string): Promise<string>;
  setContext(agentId: string, context: string): Promise<void>;
  clearContext(agentId: string): Promise<void>;
  listContexts(taskId: string): Promise<Map<string, string>>;
}

export interface VirtualMachineManager {
  createVM(agentId: string): Promise<VirtualMachine>;
  terminateVM(vmId: string): Promise<void>;
  listVMs(taskId: string): Promise<VirtualMachine[]>;
  getVMStatus(vmId: string): Promise<VMStatus>;
}

export interface ResearchOrchestrator {
  createTask(query: string, objectives: ResearchObjective[], numAgents: number): Promise<ResearchTask>;
  executeParallelResearch(task: ResearchTask): Promise<AggregatedResearch>;
  monitorProgress(taskId: string): Promise<TaskProgress>;
  cancelTask(taskId: string): Promise<void>;
}

export interface TaskProgress {
  taskId: string;
  totalAgents: number;
  completedAgents: number;
  failedAgents: number;
  runningAgents: number;
  progressPercent: number;
  estimatedTimeRemainingMs: number;
}

export interface ResearchAnalyzer {
  analyzeFindings(results: ResearchResult[]): Promise<AnalysisResult>;
  detectConflicts(findings: Finding[]): Promise<ConflictingOpinion[]>;
  synthesizeEvidence(findings: Finding[]): Promise<string[]>;
  calculateConsensus(results: ResearchResult[]): Promise<number>;
}

export interface AnalysisResult {
  mainFindings: AggregatedFinding[];
  conflicts: ConflictingOpinion[];
  consensusLevel: number;
  keyInsights: string[];
  limitations: string[];
}

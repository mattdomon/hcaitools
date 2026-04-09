/**
 * Research Orchestrator
 * Orchestrates parallel agent research with barrier synchronization
 */

import crypto from 'crypto';
import {
  ResearchTask,
  ResearchObjective,
  AggregatedResearch,
  TaskProgress,
  ResearchOrchestrator,
  AgentInstance,
  AgentStatus,
  ResearchResult,
  BarrierSynchronization,
  Finding,
  Citation,
} from './types';
import { VMManager } from './vmManager';

export class ResearchOrchestrator implements ResearchOrchestrator {
  private tasks: Map<string, ResearchTask> = new Map();
  private agents: Map<string, AgentInstance> = new Map();
  private barriers: Map<string, BarrierSynchronization> = new Map();
  private vmManager: VMManager;

  constructor() {
    this.vmManager = new VMManager();
  }

  async createTask(
    query: string,
    objectives: ResearchObjective[],
    numAgents: number
  ): Promise<ResearchTask> {
    const taskId = this.generateTaskId();
    const now = new Date();

    const task: ResearchTask = {
      taskId,
      query,
      objectives,
      numAgents,
      timeout: 300000, // 5 minutes
      maxContextPerAgent: 4096000, // ~4M tokens
      aggregationStrategy: 'consensus',
      createdAt: now,
    };

    this.tasks.set(taskId, task);

    // Create barrier for synchronization
    const barrier: BarrierSynchronization = {
      barrierId: this.generateBarrierId(),
      taskId,
      expectedAgents: numAgents,
      arrivedAgents: 0,
      isActive: true,
      createdAt: now,
    };

    this.barriers.set(barrier.barrierId, barrier);

    return task;
  }

  async executeParallelResearch(task: ResearchTask): Promise<AggregatedResearch> {
    const startTime = Date.now();
    const agents: AgentInstance[] = [];
    const results: ResearchResult[] = [];

    try {
      // Create and initialize agents
      for (let i = 0; i < task.numAgents; i++) {
        const agent = await this.createAgent(task.taskId, i);
        agents.push(agent);
      }

      // Execute agents in parallel
      const executionPromises = agents.map((agent) =>
        this.executeAgent(agent, task)
      );

      const executionResults = await Promise.allSettled(executionPromises);

      // Collect results
      for (let i = 0; i < executionResults.length; i++) {
        const result = executionResults[i];

        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        } else {
          const agent = agents[i];
          agent.status = 'failed';
          agent.error = result.status === 'rejected' ? String(result.reason) : 'Unknown error';
        }
      }

      // Aggregate results
      const aggregated = await this.aggregateResults(task, results);
      aggregated.executionTimeMs = Date.now() - startTime;

      return aggregated;
    } catch (error) {
      throw new Error(`Research task ${task.taskId} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async monitorProgress(taskId: string): Promise<TaskProgress> {
    const task = this.tasks.get(taskId);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    let completedAgents = 0;
    let failedAgents = 0;
    let runningAgents = 0;

    for (const [, agent] of this.agents) {
      if (agent.taskId === taskId) {
        switch (agent.status) {
          case 'completed':
            completedAgents++;
            break;
          case 'failed':
            failedAgents++;
            break;
          case 'running':
            runningAgents++;
            break;
        }
      }
    }

    const totalProcessed = completedAgents + failedAgents;
    const progressPercent = (totalProcessed / task.numAgents) * 100;

    return {
      taskId,
      totalAgents: task.numAgents,
      completedAgents,
      failedAgents,
      runningAgents,
      progressPercent,
      estimatedTimeRemainingMs: Math.max(0, task.timeout - (Date.now() - task.createdAt.getTime())),
    };
  }

  async cancelTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Mark all agents as cancelled
    for (const [, agent] of this.agents) {
      if (agent.taskId === taskId && agent.status !== 'completed' && agent.status !== 'failed') {
        agent.status = 'failed';
        agent.error = 'Task cancelled';
      }
    }
  }

  private async createAgent(taskId: string, index: number): Promise<AgentInstance> {
    const agentId = `agent_${taskId}_${index}`;
    const vm = await this.vmManager.createVM(agentId);

    const agent: AgentInstance = {
      agentId,
      taskId,
      virtualMachineId: vm.vmId,
      context: '',
      model: 'claude-3-opus',
      status: 'initializing',
      createdAt: new Date(),
    };

    this.agents.set(agentId, agent);

    return agent;
  }

  private async executeAgent(agent: AgentInstance, task: ResearchTask): Promise<ResearchResult> {
    agent.status = 'running';

    // Simulate agent execution
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));

    // Generate mock findings
    const findings: Finding[] = task.objectives.map((obj, idx) => ({
      findingId: `finding_${agent.agentId}_${idx}`,
      title: `Finding on ${obj.focusArea}`,
      description: `Agent ${agent.agentId} researched ${obj.focusArea}`,
      evidence: [
        'Evidence from source A',
        'Evidence from source B',
        'Evidence from source C',
      ],
      confidence: 0.7 + Math.random() * 0.3,
      source: `Agent ${agent.agentId}`,
    }));

    // Generate mock citations
    const citations: Citation[] = [
      {
        citationId: `cite_${agent.agentId}_1`,
        title: 'Research Paper on AI',
        authors: ['Smith, J.', 'Johnson, A.'],
        year: 2024,
        url: 'https://example.com/paper1',
        relevance: 0.9,
      },
      {
        citationId: `cite_${agent.agentId}_2`,
        title: 'Study on Multi-Agent Systems',
        authors: ['Brown, M.'],
        year: 2023,
        url: 'https://example.com/paper2',
        relevance: 0.85,
      },
    ];

    const result: ResearchResult = {
      agentId: agent.agentId,
      findings,
      citations,
      confidence: 0.75 + Math.random() * 0.25,
      completedAt: new Date(),
    };

    agent.result = result;
    agent.status = 'completed';
    agent.completedAt = new Date();

    // Signal barrier
    await this.signalBarrier(task.taskId, agent.agentId);

    return result;
  }

  private async aggregateResults(
    task: ResearchTask,
    results: ResearchResult[]
  ): Promise<AggregatedResearch> {
    const allFindings = results.flatMap((r) => r.findings);
    const allCitations = results.flatMap((r) => r.citations);

    // Deduplicate and merge citations
    const citationMap = new Map<string, Citation>();
    for (const citation of allCitations) {
      const key = `${citation.title}_${citation.year || 'unknown'}`;
      if (!citationMap.has(key)) {
        citationMap.set(key, citation);
      }
    }

    // Aggregate findings by title
    const findingMap = new Map<string, Finding[]>();
    for (const finding of allFindings) {
      const key = finding.title;
      if (!findingMap.has(key)) {
        findingMap.set(key, []);
      }
      findingMap.get(key)!.push(finding);
    }

    const aggregatedFindings = Array.from(findingMap.entries()).map(([title, findingGroup]) => {
      const avgConfidence = findingGroup.reduce((sum, f) => sum + f.confidence, 0) / findingGroup.length;
      const evidence = Array.from(new Set(findingGroup.flatMap((f) => f.evidence)));

      return {
        findingId: `agg_${task.taskId}_${title}`,
        title,
        description: `Aggregated finding from ${findingGroup.length} agents`,
        supportingAgents: findingGroup.map((f) => f.source || ''),
        conflictingAgents: [],
        confidenceScore: avgConfidence,
        synthesizedEvidence: evidence,
      };
    });

    // Calculate consensus
    const consensusScore = results.length > 0
      ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length
      : 0;

    return {
      taskId: task.taskId,
      query: task.query,
      totalAgents: task.numAgents,
      completedAgents: results.length,
      failedAgents: task.numAgents - results.length,
      aggregatedFindings,
      aggregatedCitations: Array.from(citationMap.values()),
      conflictingOpinions: [],
      consensusScore,
      executionTimeMs: 0,
      createdAt: new Date(),
    };
  }

  private async signalBarrier(taskId: string, agentId: string): Promise<void> {
    const barrier = Array.from(this.barriers.values()).find((b) => b.taskId === taskId);

    if (barrier) {
      barrier.arrivedAgents++;

      if (barrier.arrivedAgents >= barrier.expectedAgents) {
        barrier.isActive = false;
        barrier.completedAt = new Date();
      }
    }
  }

  private generateTaskId(): string {
    return `task_${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateBarrierId(): string {
    return `barrier_${crypto.randomBytes(8).toString('hex')}`;
  }
}

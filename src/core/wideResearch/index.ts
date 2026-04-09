/**
 * Wide Research
 * Parallel multi-agent research system for unlimited context processing
 */

export {
  ResearchTask,
  ResearchObjective,
  AgentInstance,
  AgentStatus,
  ResearchResult,
  Finding,
  Citation,
  AggregatedResearch,
  AggregatedFinding,
  ConflictingOpinion,
  Opinion,
  VirtualMachine,
  VMStatus,
  BarrierSynchronization,
  TaskProgress,
  ResearchOrchestrator,
  ContextManager,
  VirtualMachineManager,
  ResearchAnalyzer,
  AnalysisResult,
} from './types';

export { VMManager } from './vmManager';
export { ResearchOrchestrator } from './orchestrator';

import { ResearchOrchestrator } from './orchestrator';
import { ResearchObjective } from './types';

/**
 * WideResearch
 * Main class for conducting parallel multi-agent research
 */
export class WideResearch {
  private orchestrator: ResearchOrchestrator;

  constructor() {
    this.orchestrator = new ResearchOrchestrator();
  }

  /**
   * Create and execute a research task with parallel agents
   */
  async conductResearch(
    query: string,
    objectives: ResearchObjective[],
    numAgents: number = 50
  ) {
    const task = await this.orchestrator.createTask(query, objectives, numAgents);
    return this.orchestrator.executeParallelResearch(task);
  }

  /**
   * Monitor research task progress
   */
  async getProgress(taskId: string) {
    return this.orchestrator.monitorProgress(taskId);
  }

  /**
   * Cancel a research task
   */
  async cancelResearch(taskId: string) {
    return this.orchestrator.cancelTask(taskId);
  }

  /**
   * Example: Analyze 50+ competitors
   */
  async analyzeCompetitors(competitorList: string[]) {
    const objectives = competitorList.map((competitor, idx) => ({
      objectiveId: `comp_${idx}`,
      description: `Analyze ${competitor}`,
      focusArea: competitor,
      expectedOutcomes: [
        'Pricing strategy',
        'Market position',
        'Key features',
      ],
    }));

    return this.conductResearch(
      'Competitive analysis of AI platforms',
      objectives,
      Math.min(competitorList.length, 50)
    );
  }

  /**
   * Example: Research 250+ AI papers
   */
  async researchAIPublications(papers: string[]) {
    const objectives = papers.slice(0, 50).map((paper, idx) => ({
      objectiveId: `paper_${idx}`,
      description: `Review ${paper}`,
      focusArea: paper,
      expectedOutcomes: [
        'Key findings',
        'Methodology',
        'Impact',
      ],
    }));

    return this.conductResearch(
      'Comprehensive AI research review',
      objectives,
      50
    );
  }

  /**
   * Example: Generate 20+ image concepts
   */
  async generateImageConcepts(basePrompt: string, numVariations: number = 20) {
    const objectives = Array.from({ length: Math.min(numVariations, 50) }).map((_, idx) => ({
      objectiveId: `img_${idx}`,
      description: `Generate image variation ${idx + 1}`,
      focusArea: `Variation ${idx + 1}`,
      expectedOutcomes: [
        'Unique visual interpretation',
        'Consistent theme',
        'High quality',
      ],
    }));

    return this.conductResearch(
      `Generate image concepts for: ${basePrompt}`,
      objectives,
      objectives.length
    );
  }
}

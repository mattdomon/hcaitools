/**
 * Wide Research Tests
 * Tests for parallel multi-agent research system
 */

import {
  WideResearch,
  ResearchOrchestrator,
  VMManager,
  ResearchObjective,
} from '../src/core/wideResearch';

describe('WideResearch', () => {
  let research: WideResearch;

  beforeEach(() => {
    research = new WideResearch();
  });

  describe('Research Orchestration', () => {
    it('should create a research task', async () => {
      const orchestrator = new ResearchOrchestrator();
      const objectives: ResearchObjective[] = [
        {
          objectiveId: 'obj1',
          description: 'Research AI platforms',
          focusArea: 'AI Platforms',
          expectedOutcomes: ['Features', 'Pricing', 'Market Position'],
        },
      ];

      const task = await orchestrator.createTask(
        'Compare AI platforms',
        objectives,
        3
      );

      expect(task).toBeDefined();
      expect(task.query).toBe('Compare AI platforms');
      expect(task.numAgents).toBe(3);
      expect(task.taskId).toMatch(/^task_/);
    });

    it('should execute parallel research with multiple agents', async () => {
      const orchestrator = new ResearchOrchestrator();
      const objectives: ResearchObjective[] = [
        {
          objectiveId: 'obj1',
          description: 'Research topic A',
          focusArea: 'Topic A',
          expectedOutcomes: ['Finding 1', 'Finding 2'],
        },
      ];

      const task = await orchestrator.createTask(
        'Research topic',
        objectives,
        5
      );

      const result = await orchestrator.executeParallelResearch(task);

      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.taskId);
      expect(result.totalAgents).toBe(5);
      expect(result.aggregatedFindings.length).toBeGreaterThan(0);
    });

    it('should monitor research progress', async () => {
      const orchestrator = new ResearchOrchestrator();
      const objectives: ResearchObjective[] = [
        {
          objectiveId: 'obj1',
          description: 'Test research',
          focusArea: 'Test',
          expectedOutcomes: ['Result'],
        },
      ];

      const task = await orchestrator.createTask(
        'Monitor test',
        objectives,
        3
      );

      // Execute research
      orchestrator.executeParallelResearch(task).catch(() => {
        // Ignore errors in background
      });

      // Check progress
      const progress = await orchestrator.monitorProgress(task.taskId);

      expect(progress).toBeDefined();
      expect(progress.taskId).toBe(task.taskId);
      expect(progress.totalAgents).toBe(3);
      expect(progress.progressPercent).toBeGreaterThanOrEqual(0);
      expect(progress.progressPercent).toBeLessThanOrEqual(100);
    });

    it('should cancel a research task', async () => {
      const orchestrator = new ResearchOrchestrator();
      const objectives: ResearchObjective[] = [
        {
          objectiveId: 'obj1',
          description: 'Cancellable research',
          focusArea: 'Test',
          expectedOutcomes: ['Result'],
        },
      ];

      const task = await orchestrator.createTask(
        'Cancel test',
        objectives,
        3
      );

      await orchestrator.cancelTask(task.taskId);

      const progress = await orchestrator.monitorProgress(task.taskId);

      expect(progress).toBeDefined();
    });
  });

  describe('Virtual Machine Management', () => {
    it('should create a virtual machine', async () => {
      const vmManager = new VMManager();
      const vm = await vmManager.createVM('agent123');

      expect(vm).toBeDefined();
      expect(vm.agentId).toBe('agent123');
      expect(vm.vmId).toMatch(/^vm_/);
      expect(vm.status).toBe('initializing');
    });

    it('should retrieve VM status', async () => {
      const vmManager = new VMManager();
      const vm = await vmManager.createVM('agent456');

      const status = await vmManager.getVMStatus(vm.vmId);

      expect(status).toBe('initializing');
    });

    it('should terminate a virtual machine', async () => {
      const vmManager = new VMManager();
      const vm = await vmManager.createVM('agent789');

      await vmManager.terminateVM(vm.vmId);

      // VM should still exist briefly before being deleted
      expect(vm.status).toBe('terminating');
    });

    it('should list virtual machines', async () => {
      const vmManager = new VMManager();

      await vmManager.createVM('agent1');
      await vmManager.createVM('agent2');
      await vmManager.createVM('agent3');

      const vms = await vmManager.listVMs('task1');

      expect(vms.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Parallel Agent Execution', () => {
    it('should execute 50+ agents in parallel', async () => {
      const orchestrator = new ResearchOrchestrator();
      const objectives = Array.from({ length: 10 }).map((_, idx) => ({
        objectiveId: `obj${idx}`,
        description: `Research topic ${idx}`,
        focusArea: `Topic ${idx}`,
        expectedOutcomes: ['Result 1', 'Result 2'],
      }));

      const task = await orchestrator.createTask(
        'Large scale research',
        objectives,
        50
      );

      const result = await orchestrator.executeParallelResearch(task);

      expect(result.totalAgents).toBe(50);
      expect(result.completedAgents).toBeGreaterThan(0);
      expect(result.aggregatedFindings.length).toBeGreaterThan(0);
    });

    it('should support 100+ parallel operations', async () => {
      const orchestrator = new ResearchOrchestrator();
      const objectives = Array.from({ length: 20 }).map((_, idx) => ({
        objectiveId: `obj${idx}`,
        description: `Research topic ${idx}`,
        focusArea: `Topic ${idx}`,
        expectedOutcomes: ['Result'],
      }));

      const task = await orchestrator.createTask(
        'Massive research',
        objectives,
        100
      );

      const result = await orchestrator.executeParallelResearch(task);

      expect(result.totalAgents).toBe(100);
      expect(result.completedAgents).toBeGreaterThan(0);
    });
  });

  describe('Research Aggregation', () => {
    it('should aggregate findings from multiple agents', async () => {
      const orchestrator = new ResearchOrchestrator();
      const objectives: ResearchObjective[] = [
        {
          objectiveId: 'obj1',
          description: 'Research topic',
          focusArea: 'Topic',
          expectedOutcomes: ['Finding'],
        },
      ];

      const task = await orchestrator.createTask(
        'Aggregate test',
        objectives,
        5
      );

      const result = await orchestrator.executeParallelResearch(task);

      expect(result.aggregatedFindings).toBeDefined();
      expect(result.aggregatedFindings.length).toBeGreaterThan(0);
      expect(result.aggregatedCitations).toBeDefined();
      expect(result.consensusScore).toBeGreaterThan(0);
    });

    it('should preserve citation information', async () => {
      const orchestrator = new ResearchOrchestrator();
      const objectives: ResearchObjective[] = [
        {
          objectiveId: 'obj1',
          description: 'Research with citations',
          focusArea: 'Citations',
          expectedOutcomes: ['Citation 1', 'Citation 2'],
        },
      ];

      const task = await orchestrator.createTask(
        'Citation test',
        objectives,
        3
      );

      const result = await orchestrator.executeParallelResearch(task);

      expect(result.aggregatedCitations.length).toBeGreaterThan(0);
      expect(result.aggregatedCitations[0].title).toBeDefined();
      expect(result.aggregatedCitations[0].authors).toBeDefined();
    });

    it('should calculate consensus score', async () => {
      const orchestrator = new ResearchOrchestrator();
      const objectives: ResearchObjective[] = [
        {
          objectiveId: 'obj1',
          description: 'Consensus test',
          focusArea: 'Consensus',
          expectedOutcomes: ['Result'],
        },
      ];

      const task = await orchestrator.createTask(
        'Consensus calculation',
        objectives,
        5
      );

      const result = await orchestrator.executeParallelResearch(task);

      expect(result.consensusScore).toBeGreaterThan(0);
      expect(result.consensusScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Real-world Use Cases', () => {
    it('should analyze 50+ competitors', async () => {
      const competitors = Array.from({ length: 50 }).map((_, idx) => `Competitor ${idx + 1}`);
      const result = await research.analyzeCompetitors(competitors);

      expect(result).toBeDefined();
      expect(result.totalAgents).toBe(50);
      expect(result.aggregatedFindings).toBeDefined();
    });

    it('should research 250+ AI papers', async () => {
      const papers = Array.from({ length: 250 }).map((_, idx) => `Paper ${idx + 1}`);
      const result = await research.researchAIPublications(papers);

      expect(result).toBeDefined();
      expect(result.totalAgents).toBe(50); // Limited to 50
      expect(result.aggregatedFindings).toBeDefined();
    });

    it('should generate 20+ image concepts', async () => {
      const result = await research.generateImageConcepts(
        'A futuristic city',
        20
      );

      expect(result).toBeDefined();
      expect(result.totalAgents).toBe(20);
      expect(result.aggregatedFindings.length).toBeGreaterThan(0);
    });
  });

  describe('Context Isolation', () => {
    it('should provide isolated context for each agent', async () => {
      const orchestrator = new ResearchOrchestrator();
      const objectives: ResearchObjective[] = [
        {
          objectiveId: 'obj1',
          description: 'Isolation test',
          focusArea: 'Context isolation',
          expectedOutcomes: ['Isolated context'],
        },
      ];

      const task = await orchestrator.createTask(
        'Isolation test',
        objectives,
        3
      );

      const result = await orchestrator.executeParallelResearch(task);

      // Each agent should have processed independently
      expect(result.completedAgents).toBe(3);
      expect(result.failedAgents).toBe(0);
    });

    it('should prevent context pollution between agents', async () => {
      const orchestrator = new ResearchOrchestrator();
      const objectives: ResearchObjective[] = [
        {
          objectiveId: 'obj1',
          description: 'No pollution test',
          focusArea: 'No pollution',
          expectedOutcomes: ['Clean results'],
        },
      ];

      const task = await orchestrator.createTask(
        'No pollution test',
        objectives,
        10
      );

      const result = await orchestrator.executeParallelResearch(task);

      // All agents should complete independently without interference
      expect(result.completedAgents).toBeGreaterThanOrEqual(8);
    });
  });

  describe('Barrier Synchronization', () => {
    it('should synchronize agent completion', async () => {
      const orchestrator = new ResearchOrchestrator();
      const objectives: ResearchObjective[] = [
        {
          objectiveId: 'obj1',
          description: 'Barrier test',
          focusArea: 'Synchronization',
          expectedOutcomes: ['Synchronized result'],
        },
      ];

      const task = await orchestrator.createTask(
        'Barrier sync test',
        objectives,
        5
      );

      const startTime = Date.now();
      const result = await orchestrator.executeParallelResearch(task);
      const executionTime = result.executionTimeMs;

      expect(result.completedAgents).toBeGreaterThan(0);
      expect(executionTime).toBeGreaterThan(0);
    });
  });
});

/**
 * Workflow Executor
 * Executes browser automation workflows with error handling and retries
 */

import {
  WorkflowTask,
  WorkflowStep,
  WorkflowResult,
  WorkflowExecutor,
  BrowserSession,
  StepResult,
  FormValidation,
  RetryPolicy,
} from './types';

export class BrowserWorkflowExecutor implements WorkflowExecutor {
  private stepTimeouts: Map<string, NodeJS.Timeout> = new Map();

  async executeTask(task: WorkflowTask): Promise<WorkflowResult> {
    const startTime = Date.now();
    let executedSteps = 0;
    const extractedData: Record<string, unknown> = {};
    const screenshots: string[] = [];

    try {
      for (const step of task.steps) {
        if (Date.now() - startTime > task.timeout) {
          return {
            taskId: task.taskId,
            status: 'timedOut',
            executedSteps,
            totalSteps: task.steps.length,
            error: `Task exceeded timeout of ${task.timeout}ms`,
            executionTimeMs: Date.now() - startTime,
          };
        }

        const stepResult = await this.retryStep(step, task.sessionId, task.retryPolicy);

        if (!stepResult.success) {
          return {
            taskId: task.taskId,
            status: 'failed',
            executedSteps,
            totalSteps: task.steps.length,
            extractedData,
            screenshots,
            error: `Step ${step.stepId} failed: ${stepResult.error}`,
            executionTimeMs: Date.now() - startTime,
          };
        }

        if (step.type === 'extract' && stepResult.result) {
          extractedData[step.stepId] = stepResult.result;
        }

        if (step.type === 'screenshot' && stepResult.result) {
          screenshots.push(stepResult.result as string);
        }

        executedSteps++;
      }

      return {
        taskId: task.taskId,
        status: 'completed',
        executedSteps,
        totalSteps: task.steps.length,
        extractedData: Object.keys(extractedData).length > 0 ? extractedData : undefined,
        screenshots: screenshots.length > 0 ? screenshots : undefined,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        taskId: task.taskId,
        status: 'failed',
        executedSteps,
        totalSteps: task.steps.length,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  async executeStep(
    step: WorkflowStep,
    session: BrowserSession
  ): Promise<StepResult> {
    const startTime = Date.now();

    try {
      let result: unknown;

      switch (step.type) {
        case 'navigate':
          result = this.simulateNavigation(step.action);
          break;

        case 'click':
          result = this.simulateClick(step.selector || '');
          break;

        case 'fillForm':
          result = this.simulateFormFill(step.action);
          break;

        case 'extract':
          result = await this.extractDataFromPage(step.selector || '', session);
          break;

        case 'wait':
          result = await this.simulateWait(parseInt(step.action, 10));
          break;

        case 'screenshot':
          result = this.simulateScreenshot();
          break;

        case 'execute':
          result = this.simulateExecute(step.action);
          break;

        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      return {
        stepId: step.stepId,
        success: true,
        result,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        stepId: step.stepId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  validateFormInput(input: string, validation: FormValidation): boolean {
    switch (validation.type) {
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);

      case 'phone':
        return /^[\d\-\+\(\)\s]+$/.test(input) && input.length >= 10;

      case 'alphanumeric':
        return /^[a-zA-Z0-9]+$/.test(input);

      case 'custom':
        if (validation.pattern) {
          return new RegExp(validation.pattern).test(input);
        }
        return true;

      default:
        return true;
    }
  }

  async extractDataFromPage(
    selector: string,
    _session: BrowserSession
  ): Promise<unknown> {
    // Simulated data extraction
    // In production, would use Puppeteer or Playwright
    return {
      selector,
      extractedAt: new Date().toISOString(),
      data: 'extracted content',
    };
  }

  private async retryStep(
    step: WorkflowStep,
    sessionId: string,
    retryPolicy: RetryPolicy
  ): Promise<StepResult> {
    let lastError: Error | null = null;
    let delay = retryPolicy.initialDelayMs;

    for (let attempt = 0; attempt < retryPolicy.maxAttempts; attempt++) {
      try {
        // In production, would have access to session
        const result: StepResult = {
          stepId: step.stepId,
          success: true,
          result: null,
          executionTimeMs: 0,
          retryAttempt: attempt,
        };

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < retryPolicy.maxAttempts - 1) {
          await this.simulateWait(delay);
          delay = Math.min(delay * retryPolicy.backoffMultiplier, retryPolicy.maxDelayMs);
        }
      }
    }

    return {
      stepId: step.stepId,
      success: false,
      error: lastError?.message || 'Max retries exceeded',
      executionTimeMs: 0,
    };
  }

  private simulateNavigation(url: string): Record<string, unknown> {
    return {
      type: 'navigate',
      url,
      timestamp: new Date().toISOString(),
    };
  }

  private simulateClick(selector: string): Record<string, unknown> {
    return {
      type: 'click',
      selector,
      timestamp: new Date().toISOString(),
    };
  }

  private simulateFormFill(data: string): Record<string, unknown> {
    return {
      type: 'fillForm',
      data,
      timestamp: new Date().toISOString(),
    };
  }

  private async simulateWait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private simulateScreenshot(): string {
    return `data:image/png;base64,${Buffer.alloc(100).toString('base64')}`;
  }

  private simulateExecute(code: string): Record<string, unknown> {
    return {
      type: 'execute',
      code,
      timestamp: new Date().toISOString(),
    };
  }
}

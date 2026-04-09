/**
 * Concurrency Control
 * Manages concurrent browser operations with queue
 */

import { ConcurrencyControl } from './types';

export class BrowserConcurrencyControl implements ConcurrencyControl {
  maxConcurrentOperations: number;
  currentOperations: number = 0;
  queuedOperations: number = 0;
  private queue: Array<() => Promise<void>> = [];
  private processPromise: Promise<void> | null = null;

  constructor(maxConcurrent: number = 50) {
    this.maxConcurrentOperations = maxConcurrent;
  }

  async addOperation(): Promise<void> {
    this.currentOperations++;

    if (this.currentOperations > this.maxConcurrentOperations) {
      this.queuedOperations++;
      await this.waitForSlot();
    }
  }

  removeOperation(): void {
    this.currentOperations--;

    if (this.queuedOperations > 0 && this.currentOperations < this.maxConcurrentOperations) {
      this.queuedOperations--;
      this.processQueue();
    }
  }

  async waitForSlot(): Promise<void> {
    while (this.currentOperations >= this.maxConcurrentOperations) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processPromise) {
      return this.processPromise;
    }

    this.processPromise = (async () => {
      while (this.queue.length > 0) {
        const operation = this.queue.shift();

        if (operation) {
          await operation();
        }
      }

      this.processPromise = null;
    })();

    return this.processPromise;
  }

  getStatus(): {
    currentOperations: number;
    queuedOperations: number;
    maxConcurrent: number;
    utilizationPercent: number;
  } {
    return {
      currentOperations: this.currentOperations,
      queuedOperations: this.queuedOperations,
      maxConcurrent: this.maxConcurrentOperations,
      utilizationPercent: (this.currentOperations / this.maxConcurrentOperations) * 100,
    };
  }
}

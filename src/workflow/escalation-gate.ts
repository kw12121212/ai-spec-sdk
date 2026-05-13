import { LoopController } from "./loop-controller.js";

export class AgentEscalationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentEscalationError";
  }
}

export interface EscalationGateOptions {
  maxRetries?: number;
}

export class EscalationGate {
  private controller: LoopController;
  private maxRetries: number;
  private retryCounts: Map<string, number> = new Map();
  
  constructor(controller: LoopController, options: EscalationGateOptions = {}) {
    this.controller = controller;
    this.maxRetries = options.maxRetries ?? 3;
  }

  public reportTaskError(taskId: string, error: Error): void {
    if (error instanceof AgentEscalationError) {
      this.escalate(`Task ${taskId} encountered unrecoverable error: ${error.message}`);
      return;
    }

    const currentCount = this.retryCounts.get(taskId) || 0;
    const nextCount = currentCount + 1;
    this.retryCounts.set(taskId, nextCount);

    if (nextCount > this.maxRetries) {
      this.escalate(`Task ${taskId} exceeded max retries (${this.maxRetries})`);
    }
  }

  public resetTaskRetries(taskId: string): void {
    this.retryCounts.delete(taskId);
  }

  public getRetryCount(taskId: string): number {
    return this.retryCounts.get(taskId) || 0;
  }

  private escalate(reason: string): never {
    // Pause the loop when escalation is triggered
    if (this.controller.getState() === "active") {
      this.controller.pause();
    }
    throw new Error(`Escalation triggered: ${reason}`);
  }
}

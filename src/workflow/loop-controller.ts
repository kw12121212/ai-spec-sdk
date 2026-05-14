import type { IAnswerAgent } from "./answer-agent-client.js";
import type { StorageBackend } from "../storage/types.js";

export type LoopState = "inactive" | "active" | "paused";

export interface ITokenTracker {
  getUsage(): number;
}

export interface ISessionRestarter {
  restartSession(state: any): Promise<void>;
}

export interface PersistedLoopState {
  currentMilestone?: string;
  plannedChangeId?: string;
  currentTask?: string;
  tokens?: number;
  retryCounts?: Record<string, number>;
  openQuestionIds?: string[];
  lastError?: string;
  loopState: LoopState;
}

export interface LoopControllerConfig {
  answerAgent?: IAnswerAgent;
  tokenTracker?: ITokenTracker;
  sessionRestarter?: ISessionRestarter;
  tokenWarningThreshold?: number;
  storage?: StorageBackend<PersistedLoopState>;
}

export class LoopController {
  private state: LoopState = "inactive";
  private answerAgent?: IAnswerAgent;
  private tokenTracker?: ITokenTracker;
  private sessionRestarter?: ISessionRestarter;
  private tokenWarningThreshold?: number;
  private storage?: StorageBackend<PersistedLoopState>;
  private STATE_KEY = "loop_controller_state";
  
  public currentMilestone?: string;
  public plannedChangeId?: string;
  public currentTask?: string;
  public retryCounts: Record<string, number> = {};
  public openQuestionIds: string[] = [];
  public lastError?: string;

  constructor(config: LoopControllerConfig = {}) {
    this.answerAgent = config.answerAgent;
    this.tokenTracker = config.tokenTracker;
    this.sessionRestarter = config.sessionRestarter;
    this.tokenWarningThreshold = config.tokenWarningThreshold;
    this.storage = config.storage;
  }

  public async restore(): Promise<void> {
    if (!this.storage) return;
    const persisted = await this.storage.get(this.STATE_KEY);
    if (persisted) {
      this.state = persisted.loopState;
      this.currentMilestone = persisted.currentMilestone;
      this.plannedChangeId = persisted.plannedChangeId;
      this.currentTask = persisted.currentTask;
      this.retryCounts = persisted.retryCounts || {};
      this.openQuestionIds = persisted.openQuestionIds || [];
      this.lastError = persisted.lastError;
    }
  }

  public async persistProgress(): Promise<void> {
    if (!this.storage) return;
    await this.storage.set(this.STATE_KEY, {
      loopState: this.state,
      currentMilestone: this.currentMilestone,
      plannedChangeId: this.plannedChangeId,
      currentTask: this.currentTask,
      tokens: this.tokenTracker?.getUsage(),
      retryCounts: this.retryCounts,
      openQuestionIds: this.openQuestionIds,
      lastError: this.lastError
    });
  }

  public getState(): LoopState {
    return this.state;
  }

  public async start(): Promise<void> {
    if (this.state !== "inactive") {
      throw new Error(`Cannot start loop from state: ${this.state}`);
    }
    this.state = "active";
    await this.persistProgress();
  }

  public async pause(): Promise<void> {
    if (this.state !== "active") {
      throw new Error(`Cannot pause loop from state: ${this.state}`);
    }
    this.state = "paused";
    await this.persistProgress();
  }

  public async resume(): Promise<void> {
    if (this.state !== "paused") {
      throw new Error(`Cannot resume loop from state: ${this.state}`);
    }
    this.state = "active";
    await this.persistProgress();
  }

  public async stop(): Promise<void> {
    if (this.state === "inactive") {
      throw new Error(`Cannot stop loop from state: ${this.state}`);
    }
    this.state = "inactive";
    await this.persistProgress();
  }

  public async beginIteration(currentState?: any): Promise<void> {
    if (this.state !== "active") {
      throw new Error(`Cannot begin iteration in state: ${this.state}`);
    }

    if (
      this.tokenTracker &&
      this.tokenWarningThreshold !== undefined &&
      this.tokenTracker.getUsage() >= this.tokenWarningThreshold
    ) {
      await this.pause();
      if (this.sessionRestarter) {
        await this.sessionRestarter.restartSession(currentState);
      }
      throw new Error("Session restart initiated due to token limit.");
    }
    await this.persistProgress();
  }

  public async handleQuestion(question: string, context?: string): Promise<string> {
    if (this.state !== "active") {
      throw new Error(`Cannot handle questions in state: ${this.state}`);
    }

    if (this.answerAgent) {
      const answer = await this.answerAgent.answer(question, context);
      if (answer !== null) {
        return answer;
      }
    }

    // Escalate to human
    await this.pause();
    throw new Error("Question escalated to human.");
  }
}

export const loopController = new LoopController();

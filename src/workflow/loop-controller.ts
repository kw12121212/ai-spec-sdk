import type { IAnswerAgent } from "./answer-agent-client.js";

export type LoopState = "inactive" | "active" | "paused";

export interface ITokenTracker {
  getUsage(): number;
}

export interface ISessionRestarter {
  restartSession(state: any): Promise<void>;
}

export interface LoopControllerConfig {
  answerAgent?: IAnswerAgent;
  tokenTracker?: ITokenTracker;
  sessionRestarter?: ISessionRestarter;
  tokenWarningThreshold?: number;
}

export class LoopController {
  private state: LoopState = "inactive";
  private answerAgent?: IAnswerAgent;
  private tokenTracker?: ITokenTracker;
  private sessionRestarter?: ISessionRestarter;
  private tokenWarningThreshold?: number;

  constructor(config: LoopControllerConfig = {}) {
    this.answerAgent = config.answerAgent;
    this.tokenTracker = config.tokenTracker;
    this.sessionRestarter = config.sessionRestarter;
    this.tokenWarningThreshold = config.tokenWarningThreshold;
  }

  public getState(): LoopState {
    return this.state;
  }

  public start(): void {
    if (this.state !== "inactive") {
      throw new Error(`Cannot start loop from state: ${this.state}`);
    }
    this.state = "active";
  }

  public pause(): void {
    if (this.state !== "active") {
      throw new Error(`Cannot pause loop from state: ${this.state}`);
    }
    this.state = "paused";
  }

  public resume(): void {
    if (this.state !== "paused") {
      throw new Error(`Cannot resume loop from state: ${this.state}`);
    }
    this.state = "active";
  }

  public stop(): void {
    if (this.state === "inactive") {
      throw new Error(`Cannot stop loop from state: ${this.state}`);
    }
    this.state = "inactive";
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
      this.pause();
      if (this.sessionRestarter) {
        await this.sessionRestarter.restartSession(currentState);
      }
      throw new Error("Session restart initiated due to token limit.");
    }
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
    this.pause();
    throw new Error("Question escalated to human.");
  }
}

export const loopController = new LoopController();

import type { IAnswerAgent } from "./answer-agent-client.js";

export type LoopState = "inactive" | "active" | "paused";

export class LoopController {
  private state: LoopState = "inactive";
  private answerAgent?: IAnswerAgent;

  constructor(answerAgent?: IAnswerAgent) {
    this.answerAgent = answerAgent;
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

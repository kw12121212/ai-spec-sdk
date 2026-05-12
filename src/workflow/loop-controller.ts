export type LoopState = "inactive" | "active" | "paused";

export class LoopController {
  private state: LoopState = "inactive";

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
}

export const loopController = new LoopController();

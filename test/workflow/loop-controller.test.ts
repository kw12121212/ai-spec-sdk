import { test, expect, describe, beforeEach } from "bun:test";
import { LoopController } from "../../src/workflow/loop-controller.js";
import type { ITokenTracker, ISessionRestarter, PersistedLoopState } from "../../src/workflow/loop-controller.js";
import type { IAnswerAgent } from "../../src/workflow/answer-agent-client.js";
import type { StorageBackend } from "../../src/storage/types.js";

class MockAnswerAgent implements IAnswerAgent {
  public answerQueue: (string | null)[] = [];
  public receivedQuestions: { question: string; context?: string }[] = [];

  public async answer(question: string, context?: string): Promise<string | null> {
    this.receivedQuestions.push({ question, context });
    return this.answerQueue.shift() ?? null;
  }
}

class MockTokenTracker implements ITokenTracker {
  public usage = 0;
  public getUsage(): number {
    return this.usage;
  }
}

class MockSessionRestarter implements ISessionRestarter {
  public restartedState: any = null;
  public called = false;
  public async restartSession(state: any): Promise<void> {
    this.called = true;
    this.restartedState = state;
  }
}

class MockStorageBackend implements StorageBackend<PersistedLoopState> {
  public store = new Map<string, PersistedLoopState>();

  public async get(key: string): Promise<PersistedLoopState | null> {
    return this.store.get(key) || null;
  }
  public async set(key: string, value: PersistedLoopState): Promise<void> {
    this.store.set(key, value);
  }
  public async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }
  public async list(): Promise<string[]> {
    return Array.from(this.store.keys());
  }
}

describe("LoopController", () => {
  let controller: LoopController;
  let mockAgent: MockAnswerAgent;
  let mockStorage: MockStorageBackend;

  beforeEach(() => {
    mockAgent = new MockAnswerAgent();
    mockStorage = new MockStorageBackend();
    controller = new LoopController({ answerAgent: mockAgent, storage: mockStorage });
  });

  test("initial state is inactive", () => {
    expect(controller.getState()).toBe("inactive");
  });

  test("start transitions to active and persists", async () => {
    await controller.start();
    expect(controller.getState()).toBe("active");
    const saved = await mockStorage.get("loop_controller_state");
    expect(saved?.loopState).toBe("active");
  });

  test("cannot start from active", async () => {
    await controller.start();
    await expect(controller.start()).rejects.toThrow("Cannot start loop from state: active");
  });

  test("cannot pause from inactive", async () => {
    await expect(controller.pause()).rejects.toThrow("Cannot pause loop from state: inactive");
  });

  test("pause transitions to paused and persists", async () => {
    await controller.start();
    await controller.pause();
    expect(controller.getState()).toBe("paused");
    const saved = await mockStorage.get("loop_controller_state");
    expect(saved?.loopState).toBe("paused");
  });

  test("resume transitions to active and persists", async () => {
    await controller.start();
    await controller.pause();
    await controller.resume();
    expect(controller.getState()).toBe("active");
    const saved = await mockStorage.get("loop_controller_state");
    expect(saved?.loopState).toBe("active");
  });

  test("cannot resume from inactive", async () => {
    await expect(controller.resume()).rejects.toThrow("Cannot resume loop from state: inactive");
  });

  test("cannot resume from active", async () => {
    await controller.start();
    await expect(controller.resume()).rejects.toThrow("Cannot resume loop from state: active");
  });

  test("stop transitions to inactive and persists", async () => {
    await controller.start();
    await controller.stop();
    expect(controller.getState()).toBe("inactive");
    const saved = await mockStorage.get("loop_controller_state");
    expect(saved?.loopState).toBe("inactive");
  });

  test("cannot stop from inactive", async () => {
    await expect(controller.stop()).rejects.toThrow("Cannot stop loop from state: inactive");
  });

  describe("beginIteration", () => {
    test("cannot begin iteration if not active", async () => {
      await expect(controller.beginIteration()).rejects.toThrow("Cannot begin iteration in state: inactive");
    });

    test("does nothing if token usage is below threshold", async () => {
      const tracker = new MockTokenTracker();
      tracker.usage = 50;
      const restarter = new MockSessionRestarter();
      const c = new LoopController({ tokenTracker: tracker, sessionRestarter: restarter, tokenWarningThreshold: 100 });
      await c.start();
      await c.beginIteration();
      expect(c.getState()).toBe("active");
      expect(restarter.called).toBe(false);
    });

    test("pauses and restarts session if token usage exceeds threshold", async () => {
      const tracker = new MockTokenTracker();
      tracker.usage = 105;
      const restarter = new MockSessionRestarter();
      const c = new LoopController({ tokenTracker: tracker, sessionRestarter: restarter, tokenWarningThreshold: 100 });
      await c.start();
      
      const executionState = { step: 5 };
      await expect(c.beginIteration(executionState)).rejects.toThrow("Session restart initiated due to token limit.");
      
      expect(c.getState()).toBe("paused");
      expect(restarter.called).toBe(true);
      expect(restarter.restartedState).toEqual({ step: 5 });
    });
  });

  describe("handleQuestion", () => {
    test("cannot handle question if not active", async () => {
      await expect(controller.handleQuestion("What to do?")).rejects.toThrow("Cannot handle questions in state: inactive");
    });

    test("answers question using AnswerAgent and remains active", async () => {
      mockAgent.answerQueue.push("Proceed with X");
      await controller.start();

      const result = await controller.handleQuestion("What to do?");
      expect(result).toBe("Proceed with X");
      expect(mockAgent.receivedQuestions).toHaveLength(1);
      expect(mockAgent.receivedQuestions[0].question).toBe("What to do?");
      expect(controller.getState()).toBe("active");
    });

    test("escalates to human and pauses if AnswerAgent cannot answer", async () => {
      mockAgent.answerQueue.push(null);
      await controller.start();

      await expect(controller.handleQuestion("What to do?")).rejects.toThrow("Question escalated to human.");
      expect(mockAgent.receivedQuestions).toHaveLength(1);
      expect(controller.getState()).toBe("paused");
    });

    test("escalates to human and pauses if no AnswerAgent is configured", async () => {
      const controllerWithoutAgent = new LoopController();
      await controllerWithoutAgent.start();

      await expect(controllerWithoutAgent.handleQuestion("What to do?")).rejects.toThrow("Question escalated to human.");
      expect(controllerWithoutAgent.getState()).toBe("paused");
    });
  });

  describe("restore", () => {
    test("restores state from storage", async () => {
      await mockStorage.set("loop_controller_state", {
        loopState: "paused",
        currentMilestone: "m1",
        plannedChangeId: "pc1",
        currentTask: "t1",
        tokens: 42,
        retryCounts: { t1: 2 },
        openQuestionIds: ["q1"],
        lastError: "err"
      });

      await controller.restore();

      expect(controller.getState()).toBe("paused");
      expect(controller.currentMilestone).toBe("m1");
      expect(controller.plannedChangeId).toBe("pc1");
      expect(controller.currentTask).toBe("t1");
      expect(controller.retryCounts).toEqual({ t1: 2 });
      expect(controller.openQuestionIds).toEqual(["q1"]);
      expect(controller.lastError).toBe("err");
    });
  });
});

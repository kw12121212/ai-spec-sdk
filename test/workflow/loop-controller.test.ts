import { test, expect, describe, beforeEach } from "bun:test";
import { LoopController } from "../../src/workflow/loop-controller.js";
import type { IAnswerAgent } from "../../src/workflow/answer-agent-client.js";

class MockAnswerAgent implements IAnswerAgent {
  public answerQueue: (string | null)[] = [];
  public receivedQuestions: { question: string; context?: string }[] = [];

  public async answer(question: string, context?: string): Promise<string | null> {
    this.receivedQuestions.push({ question, context });
    return this.answerQueue.shift() ?? null;
  }
}

describe("LoopController", () => {
  let controller: LoopController;
  let mockAgent: MockAnswerAgent;

  beforeEach(() => {
    mockAgent = new MockAnswerAgent();
    controller = new LoopController(mockAgent);
  });

  test("initial state is inactive", () => {
    expect(controller.getState()).toBe("inactive");
  });

  test("start transitions to active", () => {
    controller.start();
    expect(controller.getState()).toBe("active");
  });

  test("cannot start from active", () => {
    controller.start();
    expect(() => controller.start()).toThrow("Cannot start loop from state: active");
  });

  test("cannot pause from inactive", () => {
    expect(() => controller.pause()).toThrow("Cannot pause loop from state: inactive");
  });

  test("pause transitions to paused", () => {
    controller.start();
    controller.pause();
    expect(controller.getState()).toBe("paused");
  });

  test("resume transitions to active", () => {
    controller.start();
    controller.pause();
    controller.resume();
    expect(controller.getState()).toBe("active");
  });

  test("cannot resume from inactive", () => {
    expect(() => controller.resume()).toThrow("Cannot resume loop from state: inactive");
  });

  test("cannot resume from active", () => {
    controller.start();
    expect(() => controller.resume()).toThrow("Cannot resume loop from state: active");
  });

  test("stop transitions to inactive", () => {
    controller.start();
    controller.stop();
    expect(controller.getState()).toBe("inactive");
  });

  test("cannot stop from inactive", () => {
    expect(() => controller.stop()).toThrow("Cannot stop loop from state: inactive");
  });

  describe("handleQuestion", () => {
    test("cannot handle question if not active", async () => {
      await expect(controller.handleQuestion("What to do?")).rejects.toThrow("Cannot handle questions in state: inactive");
    });

    test("answers question using AnswerAgent and remains active", async () => {
      mockAgent.answerQueue.push("Proceed with X");
      controller.start();

      const result = await controller.handleQuestion("What to do?");
      expect(result).toBe("Proceed with X");
      expect(mockAgent.receivedQuestions).toHaveLength(1);
      expect(mockAgent.receivedQuestions[0].question).toBe("What to do?");
      expect(controller.getState()).toBe("active");
    });

    test("escalates to human and pauses if AnswerAgent cannot answer", async () => {
      mockAgent.answerQueue.push(null);
      controller.start();

      await expect(controller.handleQuestion("What to do?")).rejects.toThrow("Question escalated to human.");
      expect(mockAgent.receivedQuestions).toHaveLength(1);
      expect(controller.getState()).toBe("paused");
    });

    test("escalates to human and pauses if no AnswerAgent is configured", async () => {
      const controllerWithoutAgent = new LoopController();
      controllerWithoutAgent.start();

      await expect(controllerWithoutAgent.handleQuestion("What to do?")).rejects.toThrow("Question escalated to human.");
      expect(controllerWithoutAgent.getState()).toBe("paused");
    });
  });
});

import { describe, test, expect, beforeEach } from "bun:test";
import { LoopController } from "../../src/workflow/loop-controller.js";
import { EscalationGate, AgentEscalationError } from "../../src/workflow/escalation-gate.js";

describe("EscalationGate", () => {
  let controller: LoopController;
  let gate: EscalationGate;

  beforeEach(() => {
    controller = new LoopController();
    controller.start();
    gate = new EscalationGate(controller, { maxRetries: 2 });
  });

  test("does not escalate below retry threshold", () => {
    gate.reportTaskError("task-1", new Error("first failure"));
    expect(controller.getState()).toBe("active");
    expect(gate.getRetryCount("task-1")).toBe(1);

    gate.reportTaskError("task-1", new Error("second failure"));
    expect(controller.getState()).toBe("active");
    expect(gate.getRetryCount("task-1")).toBe(2);
  });

  test("escalates and pauses loop when retry threshold exceeded", () => {
    gate.reportTaskError("task-2", new Error("failure 1"));
    gate.reportTaskError("task-2", new Error("failure 2"));
    
    expect(() => {
      gate.reportTaskError("task-2", new Error("failure 3"));
    }).toThrow(/Escalation triggered: Task task-2 exceeded max retries \(2\)/);

    expect(controller.getState()).toBe("paused");
  });

  test("escalates immediately on AgentEscalationError", () => {
    expect(() => {
      gate.reportTaskError("task-3", new AgentEscalationError("explicit block"));
    }).toThrow(/Escalation triggered: Task task-3 encountered unrecoverable error: explicit block/);

    expect(controller.getState()).toBe("paused");
    expect(gate.getRetryCount("task-3")).toBe(0); // retries not incremented for explicit errors
  });

  test("can reset task retries", () => {
    gate.reportTaskError("task-4", new Error("fail"));
    expect(gate.getRetryCount("task-4")).toBe(1);
    
    gate.resetTaskRetries("task-4");
    expect(gate.getRetryCount("task-4")).toBe(0);
  });
});

import { test, expect } from "bun:test";
import { LoopController } from "./src/workflow/loop-controller.js";
import { EscalationGate } from "./src/workflow/escalation-gate.js";

test("EscalationGate integration validation", () => {
  const controller = new LoopController();
  controller.start();
  const gate = new EscalationGate(controller, { maxRetries: 1 });
  
  gate.reportTaskError("validation-task", new Error("first error"));
  expect(controller.getState()).toBe("active");
  
  expect(() => gate.reportTaskError("validation-task", new Error("second error")))
    .toThrow(/Escalation triggered/);
    
  expect(controller.getState()).toBe("paused");
});

import { expect, test, beforeEach, afterEach, mock } from "bun:test";
import { BridgeServer } from "../src/bridge.js";
import { SessionStore } from "../src/session-store.js";
import crypto from "crypto";

import fs from "fs";

const workspaceDir = "/tmp/ai-spec-sdk-test-session-resumption";

beforeEach(() => {
  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });
  }
  globalThis.__AI_SPEC_SDK_QUERY__ = async function* (params: { prompt: string; options: Record<string, unknown> }) {
    yield { type: "system", subtype: "init", session_id: "mock-sdk-session" };
    
    if (params.options["resume"]) {
      yield { type: "message", result: { answer: "Resumed!" } };
      return;
    }

    if (params.prompt === "Ask a question") {
      const askQuestion = (params.options["tools"] as any[]).find((t: any) => t.name === "ask_question");
      const result = await askQuestion.call({ question: "Is this correct?", impact: "High", recommendation: "Yes" });
      yield { type: "message", result: { answer: `Human answered: ${result}` } };
    } else {
      yield { type: "message", result: { answer: "OK" } };
    }
  };
});

afterEach(() => {
  delete globalThis.__AI_SPEC_SDK_QUERY__;
});

test("session resumption in memory fulfills promise", async () => {
  const bridge = new BridgeServer();
  const startPromise = bridge["dispatch"](
    "session.start",
    { workspace: workspaceDir, prompt: "Ask a question" },
    1
  );

  const sessionStore: SessionStore = (bridge as any).sessionStore;
  await new Promise((r) => setTimeout(r, 50));
  const sessionId = sessionStore.list({})[0].id;
  const session = sessionStore.get(sessionId)!;

  // Let the async ask_question tool execute and transition state
  await new Promise((r) => setTimeout(r, 50));
  
  expect(session.executionState).toBe("waiting_for_input");
  const pendingId = session.pendingToolCallId;
  expect(pendingId).toBeDefined();

  // Resume in memory
  const resumeResult = await bridge["dispatch"](
    "session.resume",
    { sessionId, prompt: "Yes, it is correct" },
    2
  );

  expect((resumeResult as any).status).toBe("resumed");
  
  // Let the promise fulfillment trigger the queryFn generator completion
  await new Promise((r) => setTimeout(r, 50));

  expect(session.executionState).toBe("completed");
  expect(session.status).toBe("completed");
});

test("session resumption rehydrated appends to history and re-invokes", async () => {
  const bridge = new BridgeServer();
  const startPromise = bridge["dispatch"](
    "session.start",
    { workspace: workspaceDir, prompt: "Ask a question" },
    1
  );

  const sessionStore: SessionStore = (bridge as any).sessionStore;
  await new Promise((r) => setTimeout(r, 50));
  const sessionId = sessionStore.list({})[0].id;
  const session = sessionStore.get(sessionId)!;

  await new Promise((r) => setTimeout(r, 50));
  expect(session.executionState).toBe("waiting_for_input");
  
  // Simulate restart/rehydration by clearing pendingQuestions
  (bridge as any).pendingQuestions.clear();

  const resumeResult = await bridge["dispatch"](
    "session.resume",
    { sessionId, prompt: "Rehydrated answer" },
    2
  );

  await new Promise((r) => setTimeout(r, 50));
  
  expect(session.executionState).toBe("completed");
  expect(session.status).toBe("completed");
  const history = session.history;
  const toolResult = history.find((e) => e.type === "tool_result");
  expect(toolResult).toBeDefined();
  expect(toolResult?.message).toBe("Rehydrated answer");
});

test("invalid resume throws error", async () => {
  const bridge = new BridgeServer();
  const startResult = await bridge["dispatch"](
    "session.start",
    { workspace: workspaceDir, prompt: "Normal prompt" },
    1
  );

  const sessionId = (startResult as Record<string, unknown>).sessionId as string;
  const session = (bridge as any).sessionStore.get(sessionId)!;

  // It's in 'completed' state now because 'Normal prompt' just finishes instantly in mock.
  expect(session.status).toBe("completed");

  // Since it's completed, calling resume without prompt should throw
  expect(bridge["dispatch"](
    "session.resume",
    { sessionId },
    2
  )).rejects.toThrow("'prompt' must be provided");
});
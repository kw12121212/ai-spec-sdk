import { test, expect } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { BridgeServer } from "../src/bridge.js";

test("session.answerQuestion allows a pending askQuestionTool call and session completes", async () => {
  delete globalThis.__AI_SPEC_SDK_QUERY__;

  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-question-"));

  // Mock the agent returning a tool_use for ask_question
  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ prompt, options }: { prompt: string; options: Record<string, unknown> }) {
    yield { type: "system", subtype: "init", session_id: "s1" };
    
    const tools = options["tools"] as { name: string; call: (input: any) => Promise<unknown> }[] | undefined;
    const askTool = tools?.find(t => t.name === "ask_question");
    
    if (askTool) {
      await askTool.call({
        question: "What is your name?",
        impact: "Need it for greeting",
        recommendation: "Alice"
      });
    }
    yield { result: `done:${prompt}` };
  };

  try {
    let questionPromiseResolve: (params: Record<string, unknown>) => void;
    const questionPromise = new Promise<Record<string, unknown>>((resolve) => {
      questionPromiseResolve = resolve;
    });

    const server = new BridgeServer({
      notify: (message) => {
        const msg = message as Record<string, unknown>;
        if (msg["method"] === "session.question") {
          questionPromiseResolve(msg["params"] as Record<string, unknown>);
        }
      },
    });

    // Kick off the session — do NOT await yet (it will block on ask_question)
    const startPromise = server.handleMessage({
      jsonrpc: "2.0", id: 1,
      method: "session.start",
      params: { workspace: ws, prompt: "hello" },
    });

    // Wait for the question notification
    const questionParams = await questionPromise;
    const sessionId = questionParams["sessionId"] as string;
    const requestId = questionParams["requestId"] as string;
    expect(typeof sessionId).toBe("string");
    expect(questionParams["question"]).toBe("What is your name?");

    // Answer the question — this resolves the pending tool call Promise
    const answerResp = await server.handleMessage({
      jsonrpc: "2.0", id: 2,
      method: "session.answerQuestion",
      params: { sessionId, requestId, answer: "Bob" },
    });
    expect(!answerResp.error).toBeTruthy();
    expect((answerResp.result as Record<string, unknown>)["success"]).toBeTruthy();

    // Now the session should complete
    const startResult = await startPromise;
    expect(!startResult.error).toBeTruthy();
    expect((startResult.result as Record<string, unknown>)["status"]).toBe("completed");
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("session.answerQuestion returns error for invalid state", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-question-invalid-"));

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "s2" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer({});

    const start = await server.handleMessage({
      jsonrpc: "2.0", id: 1,
      method: "session.start",
      params: { workspace: ws, prompt: "hello" },
    });
    const sessionId = (start.result as Record<string, unknown>)["sessionId"] as string;

    // Session is completed now. Attempt to answer question.
    const answerResp = await server.handleMessage({
      jsonrpc: "2.0", id: 2,
      method: "session.answerQuestion",
      params: { sessionId, requestId: "fake-id", answer: "Bob" },
    });
    expect(answerResp.error).toBeTruthy();
    expect(answerResp.error!.code).toBe(-32602);
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { BridgeServer } from "../src/bridge.js";

test("session start and resume produce events and complete", async () => {
  const fixtureWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-session-"));
  const notifications: unknown[] = [];

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* queryStub({ prompt, options }: {
    prompt: string;
    options: Record<string, unknown>;
  }) {
    yield { type: "system", subtype: "init", session_id: options?.["resume"] ?? "new" };
    yield { result: `done:${prompt}` };
  };

  const server = new BridgeServer({
    notify: (message) => notifications.push(message),
  });

  const start = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "session.start",
    params: {
      workspace: fixtureWorkspace,
      prompt: "hello",
      options: { allowedTools: ["Read"] },
    },
  });

  const startResult = start.result as Record<string, unknown>;
  assert.equal(startResult["status"], "completed");
  assert.equal(startResult["result"], "done:hello");
  const sessionId = startResult["sessionId"] as string;
  assert.ok(sessionId);

  const resume = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "session.resume",
    params: {
      sessionId,
      prompt: "continue",
      options: { allowedTools: ["Read"] },
    },
  });

  const resumeResult = resume.result as Record<string, unknown>;
  assert.equal(resumeResult["status"], "completed");
  assert.equal(resumeResult["result"], "done:continue");

  const status = await server.handleMessage({
    jsonrpc: "2.0",
    id: 3,
    method: "session.status",
    params: { sessionId },
  });

  const statusResult = status.result as Record<string, unknown>;
  assert.equal(statusResult["sessionId"], sessionId);
  assert.ok((statusResult["historyLength"] as number) >= 2);
  assert.ok(
    (notifications as Array<Record<string, unknown>>).some(
      (n) => n["method"] === "bridge/session_event",
    ),
  );

  delete globalThis.__AI_SPEC_SDK_QUERY__;
});

test("session.stop transitions active session to stopped", async () => {
  const fixtureWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-session-stop-"));
  const notifications: unknown[] = [];

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* queryStub() {
    yield { type: "system", subtype: "init" };
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    yield { type: "assistant", content: "still running" };
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    yield { result: "should-not-complete-after-stop" };
  };

  const server = new BridgeServer({
    notify: (message) => notifications.push(message),
  });

  const startPromise = server.handleMessage({
    jsonrpc: "2.0",
    id: 11,
    method: "session.start",
    params: {
      workspace: fixtureWorkspace,
      prompt: "long run",
      options: {},
    },
  });

  const sessionId = await waitForSessionStarted(notifications as Array<Record<string, unknown>>);

  const stop = await server.handleMessage({
    jsonrpc: "2.0",
    id: 13,
    method: "session.stop",
    params: { sessionId },
  });

  assert.equal((stop.result as Record<string, unknown>)["status"], "stopped");

  const final = await startPromise;
  const finalResult = final.result as Record<string, unknown>;
  assert.equal(finalResult["status"], "stopped");
  assert.equal(finalResult["result"], null);

  const statusAfter = await server.handleMessage({
    jsonrpc: "2.0",
    id: 14,
    method: "session.status",
    params: { sessionId },
  });

  assert.equal(
    (statusAfter.result as Record<string, unknown>)["status"],
    "stopped",
  );

  delete globalThis.__AI_SPEC_SDK_QUERY__;
});

async function waitForSessionStarted(
  notifications: Array<Record<string, unknown>>,
): Promise<string> {
  const started = () =>
    notifications.find(
      (item) =>
        item["method"] === "bridge/session_event" &&
        (item["params"] as Record<string, unknown>)?.["type"] === "session_started",
    );

  const timeoutMs = 1000;
  const start = Date.now();
  while (!started()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timed out waiting for session_started event");
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }

  return (started()!["params"] as Record<string, unknown>)["sessionId"] as string;
}

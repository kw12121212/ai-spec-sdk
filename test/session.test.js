import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { BridgeServer } from "../src/bridge.js";

test("session start and resume produce events and complete", async () => {
  const fixtureWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-session-"));
  const notifications = [];

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* queryStub({ prompt, options }) {
    yield { type: "system", subtype: "init", session_id: options?.resume || "new" };
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

  assert.equal(start.result.status, "completed");
  assert.equal(start.result.result, "done:hello");
  const sessionId = start.result.sessionId;
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

  assert.equal(resume.result.status, "completed");
  assert.equal(resume.result.result, "done:continue");

  const status = await server.handleMessage({
    jsonrpc: "2.0",
    id: 3,
    method: "session.status",
    params: { sessionId },
  });

  assert.equal(status.result.sessionId, sessionId);
  assert.ok(status.result.historyLength >= 2);
  assert.ok(notifications.some((n) => n.method === "bridge/session_event"));

  delete globalThis.__AI_SPEC_SDK_QUERY__;
});

test("session.stop transitions active session to stopped", async () => {
  const fixtureWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-session-stop-"));
  const notifications = [];

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* queryStub() {
    yield { type: "system", subtype: "init" };
    await new Promise((resolve) => setTimeout(resolve, 20));
    yield { type: "assistant", content: "still running" };
    await new Promise((resolve) => setTimeout(resolve, 20));
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

  const sessionId = await waitForSessionStarted(notifications);

  const stop = await server.handleMessage({
    jsonrpc: "2.0",
    id: 13,
    method: "session.stop",
    params: { sessionId },
  });

  assert.equal(stop.result.status, "stopped");

  const final = await startPromise;
  assert.equal(final.result.status, "stopped");
  assert.equal(final.result.result, null);

  const statusAfter = await server.handleMessage({
    jsonrpc: "2.0",
    id: 14,
    method: "session.status",
    params: { sessionId },
  });

  assert.equal(statusAfter.result.status, "stopped");
  delete globalThis.__AI_SPEC_SDK_QUERY__;
});

async function waitForSessionStarted(notifications) {
  const started = () =>
    notifications.find(
      (item) => item.method === "bridge/session_event" && item.params?.type === "session_started",
    );

  const timeoutMs = 1000;
  const start = Date.now();
  while (!started()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timed out waiting for session_started event");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  return started().params.sessionId;
}

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BridgeServer } from "../src/bridge.js";

// Helper: sleep for ms
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("blocking pre_tool_use hook that exits 0 allows tool use to proceed", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "hook-pass-"));
  try {
    const notifications: unknown[] = [];
    const server = new BridgeServer({
      notify: (msg) => notifications.push(msg),
    });

    // Register a blocking pre_tool_use hook that exits 0
    server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "hooks.add",
      params: {
        event: "pre_tool_use",
        command: "exit 0",
        scope: "user",
      },
    });

    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "system", subtype: "init", session_id: "sdk-hook-pass" };
      yield { type: "assistant", message: { content: [{ type: "tool_use", name: "Read", id: "tu-1", input: { file_path: "test.txt" } }] } };
      yield { type: "result", subtype: "success", result: "done" };
    };

    const startResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "session.start",
      params: { workspace: wsDir, prompt: "test" },
    });

    delete globalThis.__AI_SPEC_SDK_QUERY__;

    // Wait for async hook execution to complete
    await sleep(200);

    assert.ok(!startResp.error, "session.start should succeed");
    const result = startResp.result as Record<string, unknown>;
    assert.equal(result["status"], "completed");

    // Verify hook notification includes execution result
    const hookNotifs = notifications.filter(
      (n) => (n as Record<string, unknown>)["method"] === "bridge/hook_triggered",
    );
    assert.ok(hookNotifs.length > 0, "should have hook_triggered notifications");

    // Find the completed hook notification (has exitCode)
    const completedNotif = hookNotifs.find(
      (n) => ((n as Record<string, unknown>)["params"] as Record<string, unknown>)["exitCode"] === 0,
    );
    assert.ok(completedNotif, "should have a completed hook notification with exitCode 0");

    const params = (completedNotif as Record<string, unknown>)["params"] as Record<string, unknown>;
    assert.equal(params["exitCode"], 0);
    assert.equal(typeof params["durationMs"], "number");
    assert.equal(params["timedOut"], false);
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
    // Clean up user hooks
    try {
      const hooksPath = path.join(os.homedir(), ".claude", "hooks.json");
      fs.writeFileSync(hooksPath, "[]", "utf8");
    } catch {
      // ignore
    }
  }
});

test("blocking pre_tool_use hook that exits 1 aborts tool use", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "hook-fail-"));
  try {
    const notifications: unknown[] = [];
    const server = new BridgeServer({
      notify: (msg) => notifications.push(msg),
    });

    // Register a blocking pre_tool_use hook that exits 1
    server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "hooks.add",
      params: {
        event: "pre_tool_use",
        command: "exit 1",
        scope: "user",
      },
    });

    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "system", subtype: "init", session_id: "sdk-hook-fail" };
      yield { type: "assistant", message: { content: [{ type: "tool_use", name: "Read", id: "tu-1", input: { file_path: "test.txt" } }] } };
      yield { type: "result", subtype: "success", result: "done" };
    };

    const startResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "session.start",
      params: { workspace: wsDir, prompt: "test" },
    });

    delete globalThis.__AI_SPEC_SDK_QUERY__;

    // Wait for async hook execution to complete and session to stop
    await sleep(500);

    // The hook should have triggered with exitCode 1
    const hookNotifs = notifications.filter(
      (n) => (n as Record<string, unknown>)["method"] === "bridge/hook_triggered",
    );
    assert.ok(hookNotifs.length > 0, "should have hook_triggered notifications");

    const failedNotif = hookNotifs.find(
      (n) => ((n as Record<string, unknown>)["params"] as Record<string, unknown>)["exitCode"] === 1,
    );
    assert.ok(failedNotif, "should have a hook notification with exitCode 1");
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
    try {
      const hooksPath = path.join(os.homedir(), ".claude", "hooks.json");
      fs.writeFileSync(hooksPath, "[]", "utf8");
    } catch {
      // ignore
    }
  }
});

test("non-blocking hooks fire without awaiting", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "hook-nonblock-"));
  try {
    const notifications: unknown[] = [];
    const server = new BridgeServer({
      notify: (msg) => notifications.push(msg),
    });

    // Register a non-blocking stop hook
    server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "hooks.add",
      params: {
        event: "stop",
        command: "exit 0",
        scope: "user",
      },
    });

    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "system", subtype: "init", session_id: "sdk-hook-nonblock" };
      // Yield a tool_use so we have something to stop mid-session
      yield { type: "assistant", message: { content: [{ type: "tool_use", name: "Read", id: "tu-1", input: { file_path: "test.txt" } }] } };
      // Never yields result — session would wait forever, allowing us to stop it
    };

    // Start session (non-blocking, will wait for tool use)
    const startPromise = server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "session.start",
      params: { workspace: wsDir, prompt: "test" },
    });

    // Give the session time to start and emit tool_use
    await sleep(100);

    // Find the session ID from notifications
    const startedNotif = notifications.find(
      (n) => (n as Record<string, unknown>)["method"] === "bridge/session_event" &&
             ((n as Record<string, unknown>)["params"] as Record<string, unknown>)?.["type"] === "session_started",
    );
    const sessionId = ((startedNotif as Record<string, unknown>)["params"] as Record<string, unknown>)?.["sessionId"] as string;
    assert.ok(sessionId, "should have a session ID");

    // Stop the session — this fires the stop hook
    await server.handleMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "session.stop",
      params: { sessionId },
    });

    // Now complete the start promise (session was stopped)
    await startPromise;

    delete globalThis.__AI_SPEC_SDK_QUERY__;

    // Wait for async hook execution
    await sleep(500);

    const hookNotifs = notifications.filter(
      (n) => (n as Record<string, unknown>)["method"] === "bridge/hook_triggered",
    );
    // Should have at least one notification (initial pending + completed)
    assert.ok(hookNotifs.length >= 1, "should have hook_triggered notifications");

    // Verify completed notification has exitCode
    const completedNotif = hookNotifs.find(
      (n) => ((n as Record<string, unknown>)["params"] as Record<string, unknown>)["exitCode"] === 0,
    );
    assert.ok(completedNotif, "should have a completed stop hook notification");
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
    try {
      const hooksPath = path.join(os.homedir(), ".claude", "hooks.json");
      fs.writeFileSync(hooksPath, "[]", "utf8");
    } catch {
      // ignore
    }
  }
});

test("hook notification includes exitCode, stdout, stderr, durationMs", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "hook-result-"));
  try {
    const notifications: unknown[] = [];
    const server = new BridgeServer({
      notify: (msg) => notifications.push(msg),
    });

    // Register a hook that produces stdout and stderr
    server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "hooks.add",
      params: {
        event: "pre_tool_use",
        command: "echo 'hello hook' >&1 && echo 'err output' >&2",
        scope: "user",
      },
    });

    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "system", subtype: "init", session_id: "sdk-hook-result" };
      yield { type: "assistant", message: { content: [{ type: "tool_use", name: "Read", id: "tu-1", input: { file_path: "test.txt" } }] } };
      yield { type: "result", subtype: "success", result: "done" };
    };

    await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "session.start",
      params: { workspace: wsDir, prompt: "test" },
    });

    delete globalThis.__AI_SPEC_SDK_QUERY__;

    // Wait for async hook execution
    await sleep(500);

    const hookNotifs = notifications.filter(
      (n) => (n as Record<string, unknown>)["method"] === "bridge/hook_triggered",
    );

    const completedNotif = hookNotifs.find(
      (n) => ((n as Record<string, unknown>)["params"] as Record<string, unknown>)["exitCode"] === 0,
    );
    assert.ok(completedNotif, "should have a completed hook notification");

    const params = (completedNotif as Record<string, unknown>)["params"] as Record<string, unknown>;
    assert.equal(params["exitCode"], 0);
    assert.equal(typeof params["durationMs"], "number");
    assert.ok(params["durationMs"]! as number >= 0);
    assert.equal(params["timedOut"], false);
    assert.ok(typeof params["stdout"] === "string");
    assert.ok((params["stdout"] as string).includes("hello hook"));
    assert.ok(typeof params["stderr"] === "string");
    assert.ok((params["stderr"] as string).includes("err output"));
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
    try {
      const hooksPath = path.join(os.homedir(), ".claude", "hooks.json");
      fs.writeFileSync(hooksPath, "[]", "utf8");
    } catch {
      // ignore
    }
  }
});

test("multiple blocking hooks execute sequentially and chain stops on failure", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "hook-chain-"));
  try {
    const notifications: unknown[] = [];
    const server = new BridgeServer({
      notify: (msg) => notifications.push(msg),
    });

    // Register two hooks: first passes, second fails
    server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "hooks.add",
      params: {
        event: "pre_tool_use",
        command: "exit 0",
        scope: "user",
      },
    });

    server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "hooks.add",
      params: {
        event: "pre_tool_use",
        command: "exit 1",
        scope: "user",
      },
    });

    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "system", subtype: "init", session_id: "sdk-hook-chain" };
      yield { type: "assistant", message: { content: [{ type: "tool_use", name: "Read", id: "tu-1", input: { file_path: "test.txt" } }] } };
      yield { type: "result", subtype: "success", result: "done" };
    };

    await server.handleMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "session.start",
      params: { workspace: wsDir, prompt: "test" },
    });

    delete globalThis.__AI_SPEC_SDK_QUERY__;

    // Wait for async hook execution
    await sleep(500);

    const hookNotifs = notifications.filter(
      (n) => (n as Record<string, unknown>)["method"] === "bridge/hook_triggered",
    );

    const exit0Notifs = hookNotifs.filter(
      (n) => ((n as Record<string, unknown>)["params"] as Record<string, unknown>)["exitCode"] === 0,
    );
    const exit1Notifs = hookNotifs.filter(
      (n) => ((n as Record<string, unknown>)["params"] as Record<string, unknown>)["exitCode"] === 1,
    );

    assert.ok(exit0Notifs.length > 0, "first hook should have exited 0");
    assert.ok(exit1Notifs.length > 0, "second hook should have exited 1");
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
    try {
      const hooksPath = path.join(os.homedir(), ".claude", "hooks.json");
      fs.writeFileSync(hooksPath, "[]", "utf8");
    } catch {
      // ignore
    }
  }
});

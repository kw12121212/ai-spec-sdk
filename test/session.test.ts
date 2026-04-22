import { test, expect } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { BridgeServer } from "../src/bridge.js";

const fallbackMock: any = async function* queryStub(params: { prompt: string; options?: Record<string, unknown> }) {
  const { prompt, options } = params;
  yield { type: "system", subtype: "init", session_id: "s1" };
  if (prompt === "parent") {
    yield { result: "done:parent" };
  } else if (prompt === "child") {
    yield { result: "done:child" };
  } else {
    yield { result: `done:${prompt}` };
  }
};
// Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;

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

  try {
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
    expect(startResult["status"]).toBe("completed");
    expect(startResult["result"]).toBe("done:hello");
    const sessionId = startResult["sessionId"] as string;
    expect(sessionId).toBeTruthy();

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
    expect(resumeResult["status"]).toBe("completed");
    expect(resumeResult["result"]).toBe("done:continue");

    const status = await server.handleMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "session.status",
      params: { sessionId },
    });

    const statusResult = status.result as Record<string, unknown>;
    expect(statusResult["sessionId"]).toBe(sessionId);
    expect((statusResult["historyLength"] as number) >= 2).toBeTruthy();
    expect(
      (notifications as Array<Record<string, unknown>>).some(
        (n) => n["method"] === "bridge/session_event",
      ),
    ).toBeTruthy();
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
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

  try {
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

    expect((stop.result as Record<string, unknown>)["status"]).toBe("stopped");

    const final = await startPromise;
    const finalResult = final.result as Record<string, unknown>;
    expect(finalResult["status"]).toBe("stopped");
    expect(finalResult["result"]).toBeNull();

    const statusAfter = await server.handleMessage({
      jsonrpc: "2.0",
      id: 14,
      method: "session.status",
      params: { sessionId },
    });

    expect(
      (statusAfter.result as Record<string, unknown>)["status"],
      "stopped",
    ).toBe("stopped");
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.spawn inherits the parent workspace and emits bridge/subagent_event", async () => {
  const fixtureWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-session-spawn-"));
  const notifications: unknown[] = [];
  const invocations: Array<{ prompt: string; options: Record<string, unknown> }> = [];

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ prompt, options }: {
    prompt: string;
    options: Record<string, unknown>;
  }) {
    invocations.push({ prompt, options });
    yield { type: "system", subtype: "init", session_id: `sdk-${prompt}` };
    yield { type: "assistant", message: { content: [{ type: "text", text: `reply:${prompt}` }] } };
    yield { result: `done:${prompt}` };
  };

  try {
    const server = new BridgeServer({
      notify: (message) => notifications.push(message),
    });

    const parentResponse = await server.handleMessage({
      jsonrpc: "2.0",
      id: 21,
      method: "session.start",
      params: {
        workspace: fixtureWorkspace,
        prompt: "parent",
      },
    });
    const parentSessionId = (parentResponse.result as Record<string, unknown>)["sessionId"] as string;

    const spawnResponse = await server.handleMessage({
      jsonrpc: "2.0",
      id: 22,
      method: "session.spawn",
      params: {
        parentSessionId,
        prompt: "child",
        allowedTools: ["Read"],
      },
    });

    const childResult = spawnResponse.result as Record<string, unknown>;
    const childSessionId = childResult["sessionId"] as string;
    expect(childResult["status"]).toBe("completed");
    expect(childResult["result"]).toBe("done:child");
    expect(invocations[1]?.options["cwd"]).toBe(fixtureWorkspace);
    expect(invocations[1]?.options["allowedTools"]).toEqual(["Read"]);

    const statusResponse = await server.handleMessage({
      jsonrpc: "2.0",
      id: 23,
      method: "session.status",
      params: { sessionId: childSessionId },
    });
    expect(
      (statusResponse.result as Record<string, unknown>)["parentSessionId"],
    ).toBe(parentSessionId);

    const subagentEvents = (notifications as Array<Record<string, unknown>>)
      .filter((item) => item["method"] === "bridge/subagent_event")
      .map((item) => item["params"] as Record<string, unknown>);

    expect(
      subagentEvents.some(
        (event) =>
          event["sessionId"] === parentSessionId &&
          event["subagentId"] === childSessionId &&
          event["type"] === "agent_message",
      ),
      "parent session should receive child message events",
    ).toBeTruthy();
    expect(
      subagentEvents.some(
        (event) =>
          event["sessionId"] === parentSessionId &&
          event["subagentId"] === childSessionId &&
          event["type"] === "session_completed" &&
          event["status"] === "completed",
      ),
      "parent session should receive child completion events",
    ).toBeTruthy();
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.stop cascades to active child sessions", async () => {
  const fixtureWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-session-stop-tree-"));
  const notifications: Array<Record<string, unknown>> = [];

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ prompt }: {
    prompt: string;
    options: Record<string, unknown>;
  }) {
    yield { type: "system", subtype: "init", session_id: `sdk-${prompt}` };
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    yield { type: "assistant", message: { content: [{ type: "text", text: `${prompt} working` }] } };
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    yield { result: `done:${prompt}` };
  };

  try {
    const server = new BridgeServer({
      notify: (message) => notifications.push(message as Record<string, unknown>),
    });

    const parentPromise = server.handleMessage({
      jsonrpc: "2.0",
      id: 31,
      method: "session.start",
      params: {
        workspace: fixtureWorkspace,
        prompt: "parent",
      },
    });
    const [parentSessionId] = await waitForSessionStartedCount(notifications, 1);

    const childPromise = server.handleMessage({
      jsonrpc: "2.0",
      id: 32,
      method: "session.spawn",
      params: {
        parentSessionId,
        prompt: "child",
      },
    });

    const startedSessionIds = await waitForSessionStartedCount(notifications, 2);
    const childSessionId = startedSessionIds.find((sessionId) => sessionId !== parentSessionId);
    expect(childSessionId, "child session should start before stop is requested").toBeTruthy();

    const stopResponse = await server.handleMessage({
      jsonrpc: "2.0",
      id: 33,
      method: "session.stop",
      params: { sessionId: parentSessionId },
    });
    expect((stopResponse.result as Record<string, unknown>)["status"]).toBe("stopped");

    const parentFinal = await parentPromise;
    const childFinal = await childPromise;
    expect((parentFinal.result as Record<string, unknown>)["status"]).toBe("stopped");
    expect((childFinal.result as Record<string, unknown>)["status"]).toBe("stopped");

    const childStatus = await server.handleMessage({
      jsonrpc: "2.0",
      id: 34,
      method: "session.status",
      params: { sessionId: childSessionId },
    });
    expect((childStatus.result as Record<string, unknown>)["status"]).toBe("stopped");
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.list filters by parentSessionId", async () => {
  const fixtureWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-session-list-parent-"));

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ prompt }: {
    prompt: string;
    options: Record<string, unknown>;
  }) {
    yield { type: "system", subtype: "init", session_id: `sdk-${prompt}` };
    yield { result: `done:${prompt}` };
  };

  try {
    const server = new BridgeServer();
    const parentResponse = await server.handleMessage({
      jsonrpc: "2.0",
      id: 41,
      method: "session.start",
      params: { workspace: fixtureWorkspace, prompt: "parent" },
    });
    const parentSessionId = (parentResponse.result as Record<string, unknown>)["sessionId"] as string;

    const childResponse = await server.handleMessage({
      jsonrpc: "2.0",
      id: 42,
      method: "session.spawn",
      params: { parentSessionId, prompt: "child" },
    });
    const childSessionId = (childResponse.result as Record<string, unknown>)["sessionId"] as string;

    await server.handleMessage({
      jsonrpc: "2.0",
      id: 43,
      method: "session.start",
      params: { workspace: fixtureWorkspace, prompt: "unrelated" },
    });

    const listResponse = await server.handleMessage({
      jsonrpc: "2.0",
      id: 44,
      method: "session.list",
      params: { parentSessionId },
    });
    const sessions = (listResponse.result as Record<string, unknown>)["sessions"] as Array<Record<string, unknown>>;

    expect(sessions.length).toBe(1);
    expect(sessions[0]?.["sessionId"]).toBe(childSessionId);
    expect(sessions[0]?.["parentSessionId"]).toBe(parentSessionId);
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.start passes cwd equal to fixture workspace", async () => {
  const fixtureWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-cwd-"));
  let capturedCwd: unknown;

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ options }: {
    prompt: string;
    options: Record<string, unknown>;
  }) {
    capturedCwd = options["cwd"];
    yield { type: "system", subtype: "init", session_id: "sdk-cwd-test" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    await server.handleMessage({
      jsonrpc: "2.0",
      id: 20,
      method: "session.start",
      params: { workspace: fixtureWorkspace, prompt: "hi" },
    });

    expect(capturedCwd).toBe(fixtureWorkspace);
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.resume passes SDK session_id as resume, not bridge UUID", async () => {
  const fixtureWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-resume-id-"));
  let capturedResumeId: unknown;

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ options }: {
    prompt: string;
    options: Record<string, unknown>;
  }) {
    if (options["resume"] !== undefined) {
      capturedResumeId = options["resume"];
    }
    yield { type: "system", subtype: "init", session_id: "sdk-session-xyz" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    const start = await server.handleMessage({
      jsonrpc: "2.0",
      id: 30,
      method: "session.start",
      params: { workspace: fixtureWorkspace, prompt: "first" },
    });

    const sessionId = (start.result as Record<string, unknown>)["sessionId"] as string;

    await server.handleMessage({
      jsonrpc: "2.0",
      id: 31,
      method: "session.resume",
      params: { sessionId, prompt: "second" },
    });

    expect(capturedResumeId).toBe("sdk-session-xyz");
    expect(capturedResumeId).not.toBe(sessionId);
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.start with proxy sets HTTP_PROXY HTTPS_PROXY NO_PROXY in env", async () => {
  const fixtureWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-proxy-"));
  let capturedEnv: Record<string, unknown> | undefined;

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ options }: {
    prompt: string;
    options: Record<string, unknown>;
  }) {
    capturedEnv = options["env"] as Record<string, unknown>;
    yield { type: "system", subtype: "init", session_id: "sdk-proxy-test" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    await server.handleMessage({
      jsonrpc: "2.0",
      id: 40,
      method: "session.start",
      params: {
        workspace: fixtureWorkspace,
        prompt: "hi",
        proxy: {
          http: "http://proxy.corp.com:8080",
          https: "http://proxy.corp.com:8080",
          noProxy: "localhost,127.0.0.1",
        },
      },
    });

    expect(capturedEnv, "env should be set").toBeTruthy();
    expect(capturedEnv!["HTTP_PROXY"]).toBe("http://proxy.corp.com:8080");
    expect(capturedEnv!["HTTPS_PROXY"]).toBe("http://proxy.corp.com:8080");
    expect(capturedEnv!["NO_PROXY"]).toBe("localhost,127.0.0.1");
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.start with options.cwd returns -32602 error", async () => {
  const fixtureWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-cwderr-"));

  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 50,
    method: "session.start",
    params: {
      workspace: fixtureWorkspace,
      prompt: "hi",
      options: { cwd: "/some/path" },
    },
  });

  expect(response.error, "should return an error").toBeTruthy();
  expect(response.error?.code).toBe(-32602);
  expect(!response.result).toBeTruthy();
});

test("session.resume when sdkSessionId is null returns -32012 error", async () => {
  const fixtureWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-noid-"));

  // Stub that never emits system/init, so sdkSessionId stays null
  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { result: "done-no-init" };
  };

  try {
    const server = new BridgeServer();
    const start = await server.handleMessage({
      jsonrpc: "2.0",
      id: 60,
      method: "session.start",
      params: { workspace: fixtureWorkspace, prompt: "first" },
    });

    const sessionId = (start.result as Record<string, unknown>)["sessionId"] as string;

    const resume = await server.handleMessage({
      jsonrpc: "2.0",
      id: 61,
      method: "session.resume",
      params: { sessionId, prompt: "second" },
    });

    expect(resume.error, "should return an error").toBeTruthy();
    expect(resume.error?.code).toBe(-32012);
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.start with partial proxy (only http) sets only HTTP_PROXY", async () => {
  const fixtureWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-partial-proxy-"));
  let capturedEnv: Record<string, unknown> | undefined;

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ options }: {
    prompt: string;
    options: Record<string, unknown>;
  }) {
    capturedEnv = options["env"] as Record<string, unknown>;
    yield { type: "system", subtype: "init", session_id: "sdk-partial-proxy-test" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    await server.handleMessage({
      jsonrpc: "2.0",
      id: 70,
      method: "session.start",
      params: {
        workspace: fixtureWorkspace,
        prompt: "hi",
        proxy: { http: "http://proxy.corp.com:8080" },
      },
    });

    expect(capturedEnv, "env should be set").toBeTruthy();
    expect(capturedEnv!["HTTP_PROXY"]).toBe("http://proxy.corp.com:8080");
    expect(capturedEnv!["HTTPS_PROXY"]).toBeUndefined();
    expect(capturedEnv!["NO_PROXY"]).toBeUndefined();
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.start with unknown proxy field returns -32602 error", async () => {
  const fixtureWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-proxy-unknown-"));

  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 75,
    method: "session.start",
    params: {
      workspace: fixtureWorkspace,
      prompt: "hi",
      proxy: { http: "http://proxy.corp.com:8080", httpp: "typo" },
    },
  });

  expect(response.error, "should return an error").toBeTruthy();
  expect(response.error?.code).toBe(-32602);
});

test("session.start proxy entries overwrite matching keys in options.env, preserving others", async () => {
  const fixtureWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-proxy-merge-"));
  let capturedEnv: Record<string, unknown> | undefined;

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ options }: {
    prompt: string;
    options: Record<string, unknown>;
  }) {
    capturedEnv = options["env"] as Record<string, unknown>;
    yield { type: "system", subtype: "init", session_id: "sdk-merge-test" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    await server.handleMessage({
      jsonrpc: "2.0",
      id: 80,
      method: "session.start",
      params: {
        workspace: fixtureWorkspace,
        prompt: "hi",
        options: { env: { MY_VAR: "kept", HTTP_PROXY: "old-value" } },
        proxy: { http: "http://proxy.corp.com:8080" },
      },
    });

    expect(capturedEnv, "env should be set").toBeTruthy();
    expect(capturedEnv!["MY_VAR"]).toBe("kept");
    expect(capturedEnv!["HTTP_PROXY"]).toBe("http://proxy.corp.com:8080");
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

// ── messageType classification ────────────────────────────────────────────────

test("agent_message notifications carry correct messageType for each defined shape", async () => {
  const fixtureWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-msgtype-"));
  const notifications: unknown[] = [];

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "mt-test" };
    yield { type: "assistant", message: { content: [{ type: "text", text: "hello" }] } };
    yield { type: "assistant", message: { content: [{ type: "tool_use", name: "Read", input: {} }] } };
    yield { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "x", content: "ok" }] } };
    yield { type: "result", subtype: "success", result: "done" };
  };

  try {
    const server = new BridgeServer({ notify: (m) => notifications.push(m) });
    await server.handleMessage({
      jsonrpc: "2.0",
      id: 90,
      method: "session.start",
      params: { workspace: fixtureWorkspace, prompt: "go" },
    });

    const agentEvents = (notifications as Array<Record<string, unknown>>)
      .filter((n) => n["method"] === "bridge/session_event")
      .map((n) => n["params"] as Record<string, unknown>)
      .filter((p) => p["type"] === "agent_message");

    const messageTypes = agentEvents.map((p) => p["messageType"]);

    expect(messageTypes.includes("system_init"), "expected system_init").toBeTruthy();
    expect(messageTypes.includes("assistant_text"), "expected assistant_text").toBeTruthy();
    expect(messageTypes.includes("tool_use"), "expected tool_use").toBeTruthy();
    expect(messageTypes.includes("tool_result"), "expected tool_result").toBeTruthy();
    expect(messageTypes.includes("result"), "expected result").toBeTruthy();
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("tool_use takes precedence over text in mixed assistant content", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-mixed-"));
  const notifications: unknown[] = [];

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "mixed-test" };
    // message with both tool_use and text blocks
    yield {
      type: "assistant",
      message: {
        content: [
          { type: "text", text: "I will read the file" },
          { type: "tool_use", name: "Read", input: { file_path: "/foo" } },
        ],
      },
    };
    yield { type: "result", subtype: "success", result: "done" };
  };

  try {
    const server = new BridgeServer({ notify: (m) => notifications.push(m) });
    await server.handleMessage({
      jsonrpc: "2.0", id: 92,
      method: "session.start",
      params: { workspace: ws, prompt: "go" },
    });

    const mixed = (notifications as Array<Record<string, unknown>>)
      .filter((n) => n["method"] === "bridge/session_event")
      .map((n) => n["params"] as Record<string, unknown>)
      .find((p) => p["type"] === "agent_message" && p["messageType"] === "tool_use");

    expect(mixed, "expected tool_use messageType for mixed content").toBeTruthy();
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("agent_message with unrecognized shape gets messageType other", async () => {
  const fixtureWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-msgother-"));
  const notifications: unknown[] = [];

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "other-test" };
    yield { type: "unknown_type", data: "something" };
    yield { type: "result", subtype: "success", result: "done" };
  };

  try {
    const server = new BridgeServer({ notify: (m) => notifications.push(m) });
    await server.handleMessage({
      jsonrpc: "2.0",
      id: 91,
      method: "session.start",
      params: { workspace: fixtureWorkspace, prompt: "go" },
    });

    const agentEvents = (notifications as Array<Record<string, unknown>>)
      .filter((n) => n["method"] === "bridge/session_event")
      .map((n) => n["params"] as Record<string, unknown>)
      .filter((p) => p["type"] === "agent_message");

    expect(
      agentEvents.some((p) => p["messageType"] === "other"),
      "expected at least one other messageType",
    ).toBeTruthy();
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

// ── session.list ──────────────────────────────────────────────────────────────

test("session.list with no filter returns all sessions", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-list-"));

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "list-sdk" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    await server.handleMessage({ jsonrpc: "2.0", id: 100, method: "session.start", params: { workspace: ws, prompt: "a" } });
    await server.handleMessage({ jsonrpc: "2.0", id: 101, method: "session.start", params: { workspace: ws, prompt: "b" } });

    const response = await server.handleMessage({ jsonrpc: "2.0", id: 102, method: "session.list" });
    const sessions = (response.result as Record<string, unknown>)["sessions"] as unknown[];

    expect(sessions.length >= 2).toBeTruthy();
    const entry = sessions[0] as Record<string, unknown>;
    expect(entry["sessionId"]).toBeTruthy();
    expect(entry["status"]).toBeTruthy();
    expect(entry["workspace"]).toBeTruthy();
    expect(entry["createdAt"]).toBeTruthy();
    expect(entry["updatedAt"]).toBeTruthy();
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.list with status active returns only active sessions", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-list-active-"));

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "list-active-sdk" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    const start = await server.handleMessage({
      jsonrpc: "2.0", id: 110,
      method: "session.start",
      params: { workspace: ws, prompt: "first" },
    });
    const sessionId = (start.result as Record<string, unknown>)["sessionId"] as string;

    // Stop the session so it is no longer active
    await server.handleMessage({ jsonrpc: "2.0", id: 111, method: "session.stop", params: { sessionId } });

    // Verify the stopped session exists in the unfiltered list before testing the filter
    const allResponse = await server.handleMessage({ jsonrpc: "2.0", id: 112, method: "session.list" });
    const allSessions = (allResponse.result as Record<string, unknown>)["sessions"] as Array<Record<string, unknown>>;
    expect(allSessions.some((s) => s["sessionId"] === sessionId), "stopped session must appear in unfiltered list").toBeTruthy();

    const response = await server.handleMessage({
      jsonrpc: "2.0", id: 113,
      method: "session.list",
      params: { status: "active" },
    });
    const sessions = (response.result as Record<string, unknown>)["sessions"] as Array<Record<string, unknown>>;

    expect(!sessions.some((s) => s["sessionId"] === sessionId), "stopped session must not appear in active list").toBeTruthy();
    expect(sessions.every((s) => s["status"] === "active"), "only active sessions expected").toBeTruthy();
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.list with status all returns all sessions", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-list-all-"));

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "list-all-sdk" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    await server.handleMessage({ jsonrpc: "2.0", id: 120, method: "session.start", params: { workspace: ws, prompt: "x" } });
    await server.handleMessage({ jsonrpc: "2.0", id: 121, method: "session.start", params: { workspace: ws, prompt: "y" } });

    const response = await server.handleMessage({
      jsonrpc: "2.0", id: 122,
      method: "session.list",
      params: { status: "all" },
    });
    const sessions = (response.result as Record<string, unknown>)["sessions"] as unknown[];
    expect(sessions.length >= 2).toBeTruthy();
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.list with unknown status value returns -32602", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0", id: 130,
    method: "session.list",
    params: { status: "pending" },
  });
  expect(response.error, "should return an error").toBeTruthy();
  expect(response.error?.code).toBe(-32602);
});

test("session.list caps response at 100 entries when more exist", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-list-cap-"));

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "cap-sdk" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    await Promise.all(
      Array.from({ length: 101 }, (_, i) =>
        server.handleMessage({
          jsonrpc: "2.0", id: `cap-${i}`,
          method: "session.start",
          params: { workspace: ws, prompt: `session-${i}` },
        }),
      ),
    );

    const response = await server.handleMessage({ jsonrpc: "2.0", id: "cap-list", method: "session.list" });
    const sessions = (response.result as Record<string, unknown>)["sessions"] as unknown[];
    expect(sessions.length).toBe(100);
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.list returns sessions ordered by createdAt descending", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-list-order-"));

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "order-sdk" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    const ids: string[] = [];

    for (const prompt of ["first", "second", "third"]) {
      const r = await server.handleMessage({
        jsonrpc: "2.0", id: `order-${prompt}`,
        method: "session.start",
        params: { workspace: ws, prompt },
      });
      ids.push((r.result as Record<string, unknown>)["sessionId"] as string);
      // small delay to ensure distinct createdAt timestamps
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
    }

    const response = await server.handleMessage({ jsonrpc: "2.0", id: "order-list", method: "session.list" });
    const sessions = (response.result as Record<string, unknown>)["sessions"] as Array<Record<string, unknown>>;

    // most recently created session must appear first
    const returnedIds = sessions.map((s) => s["sessionId"]);
    const firstIdx = returnedIds.indexOf(ids[0]);
    const secondIdx = returnedIds.indexOf(ids[1]);
    const thirdIdx = returnedIds.indexOf(ids[2]);

    expect(thirdIdx < secondIdx, "third session should appear before second").toBeTruthy();
    expect(secondIdx < firstIdx, "second session should appear before first").toBeTruthy();
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

// ── session.history ───────────────────────────────────────────────────────────

test("session.history returns total and entries for a completed session", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-history-"));

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "hist-sdk" };
    yield { type: "assistant", message: { content: [{ type: "text", text: "thinking" }] } };
    yield { type: "result", subtype: "success", result: "done" };
  };

  try {
    const server = new BridgeServer();
    const start = await server.handleMessage({
      jsonrpc: "2.0", id: 200,
      method: "session.start",
      params: { workspace: ws, prompt: "history test" },
    });
    const sessionId = (start.result as Record<string, unknown>)["sessionId"] as string;

    const response = await server.handleMessage({
      jsonrpc: "2.0", id: 201,
      method: "session.history",
      params: { sessionId },
    });

    const result = response.result as Record<string, unknown>;
    expect(result["sessionId"]).toBe(sessionId);
    expect(typeof result["total"] === "number" && result["total"] > 0).toBeTruthy();
    const entries = result["entries"] as unknown[];
    expect(Array.isArray(entries)).toBeTruthy();
    expect(entries.length > 0).toBeTruthy();
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.history with offset and limit returns correct window", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-history-page-"));

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "page-sdk" };
    for (let i = 0; i < 5; i++) {
      yield { type: "assistant", message: { content: [{ type: "text", text: `msg-${i}` }] } };
    }
    yield { type: "result", subtype: "success", result: "done" };
  };

  try {
    const server = new BridgeServer();
    const start = await server.handleMessage({
      jsonrpc: "2.0", id: 210,
      method: "session.start",
      params: { workspace: ws, prompt: "paging test" },
    });
    const sessionId = (start.result as Record<string, unknown>)["sessionId"] as string;

    // Get total first
    const allResponse = await server.handleMessage({
      jsonrpc: "2.0", id: 211,
      method: "session.history",
      params: { sessionId },
    });
    const total = (allResponse.result as Record<string, unknown>)["total"] as number;

    // Paginate: offset=1, limit=2
    const pageResponse = await server.handleMessage({
      jsonrpc: "2.0", id: 212,
      method: "session.history",
      params: { sessionId, offset: 1, limit: 2 },
    });
    const pageResult = pageResponse.result as Record<string, unknown>;
    expect(pageResult["total"]).toBe(total);
    const entries = pageResult["entries"] as unknown[];
    expect(entries.length).toBe(2);
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.history with limit > 200 is capped at 200", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-history-cap-"));

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "cap-sdk-h" };
    yield { type: "result", subtype: "success", result: "done" };
  };

  try {
    const server = new BridgeServer();
    const start = await server.handleMessage({
      jsonrpc: "2.0", id: 220,
      method: "session.start",
      params: { workspace: ws, prompt: "cap test" },
    });
    const sessionId = (start.result as Record<string, unknown>)["sessionId"] as string;

    const response = await server.handleMessage({
      jsonrpc: "2.0", id: 221,
      method: "session.history",
      params: { sessionId, limit: 9999 },
    });

    const entries = (response.result as Record<string, unknown>)["entries"] as unknown[];
    expect(entries.length <= 200, "entries must not exceed 200").toBeTruthy();
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.history with unknown sessionId returns -32011", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0", id: 230,
    method: "session.history",
    params: { sessionId: "does-not-exist" },
  });

  expect(response.error, "should return an error").toBeTruthy();
  expect(response.error?.code).toBe(-32011);
});

test("session.list entries include prompt field with initial prompt", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-list-prompt-"));

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "prompt-sdk" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    await server.handleMessage({
      jsonrpc: "2.0", id: 240,
      method: "session.start",
      params: { workspace: ws, prompt: "my initial prompt" },
    });

    const response = await server.handleMessage({
      jsonrpc: "2.0", id: 241,
      method: "session.list",
    });
    const sessions = (response.result as Record<string, unknown>)["sessions"] as Array<Record<string, unknown>>;

    expect(sessions.length > 0).toBeTruthy();
    const entry = sessions.find((s) => s["prompt"] === "my initial prompt");
    expect(entry, "session entry should include the initial prompt").toBeTruthy();
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.list prompt is null when session has no user_prompt history entry", async () => {
  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-null-prompt-"));

  try {
    // Write a session file with an empty history (no user_prompt entry)
    const sessionId = "null-prompt-test-session";
    const session = {
      id: sessionId,
      workspace: "/tmp/some-ws",
      sdkSessionId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "completed",
      stopRequested: false,
      history: [],
      result: "done",
    };
    fs.writeFileSync(path.join(sessionsDir, `${sessionId}.json`), JSON.stringify(session));

    const server = new BridgeServer({ sessionsDir });
    const response = await server.handleMessage({
      jsonrpc: "2.0", id: 260,
      method: "session.list",
    });
    const sessions = (response.result as Record<string, unknown>)["sessions"] as Array<Record<string, unknown>>;
    const entry = sessions.find((s) => s["sessionId"] === sessionId);

    expect(entry, "session loaded from disk should appear in list").toBeTruthy();
    expect(entry!["prompt"], "prompt should be null when no user_prompt entry exists").toBeNull();
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

test("session.list prompt is truncated to 200 chars for long prompts", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-list-prompt-trunc-"));
  const longPrompt = "x".repeat(300);

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "trunc-sdk" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    const start = await server.handleMessage({
      jsonrpc: "2.0", id: 250,
      method: "session.start",
      params: { workspace: ws, prompt: longPrompt },
    });
    const sessionId = (start.result as Record<string, unknown>)["sessionId"] as string;

    const response = await server.handleMessage({
      jsonrpc: "2.0", id: 251,
      method: "session.list",
    });
    const sessions = (response.result as Record<string, unknown>)["sessions"] as Array<Record<string, unknown>>;
    const entry = sessions.find((s) => s["sessionId"] === sessionId);

    expect(entry, "session entry should be present").toBeTruthy();
    expect((entry!["prompt"] as string).length, "prompt should be truncated to 200 chars").toBe(200);
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

// ── agent control parameters ──────────────────────────────────────────────────

test("session.start with model passes it to the agent query", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-model-"));
  let capturedOptions: Record<string, unknown> = {};

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ options }: { prompt: string; options: Record<string, unknown> }) {
    capturedOptions = options;
    yield { type: "system", subtype: "init", session_id: "model-test" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    await server.handleMessage({
      jsonrpc: "2.0", id: 140,
      method: "session.start",
      params: { workspace: ws, prompt: "hi", model: "claude-opus-4-6" },
    });
    expect(capturedOptions["model"]).toBe("claude-opus-4-6");
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.start with allowedTools passes it to the agent query", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-allowed-"));
  let capturedOptions: Record<string, unknown> = {};

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ options }: { prompt: string; options: Record<string, unknown> }) {
    capturedOptions = options;
    yield { type: "system", subtype: "init", session_id: "allowed-test" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    await server.handleMessage({
      jsonrpc: "2.0", id: 141,
      method: "session.start",
      params: { workspace: ws, prompt: "hi", allowedTools: ["Read", "Glob"] },
    });
    expect(capturedOptions["allowedTools"]).toEqual(["Read", "Glob"]);
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.start with disallowedTools passes it to the agent query", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-disallowed-"));
  let capturedOptions: Record<string, unknown> = {};

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ options }: { prompt: string; options: Record<string, unknown> }) {
    capturedOptions = options;
    yield { type: "system", subtype: "init", session_id: "disallowed-test" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    await server.handleMessage({
      jsonrpc: "2.0", id: 142,
      method: "session.start",
      params: { workspace: ws, prompt: "hi", disallowedTools: ["Bash"] },
    });
    expect(capturedOptions["disallowedTools"]).toEqual(["Bash"]);
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.start with permissionMode acceptEdits passes it to the agent query", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-perm-"));
  let capturedOptions: Record<string, unknown> = {};

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ options }: { prompt: string; options: Record<string, unknown> }) {
    capturedOptions = options;
    yield { type: "system", subtype: "init", session_id: "perm-test" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    await server.handleMessage({
      jsonrpc: "2.0", id: 143,
      method: "session.start",
      params: { workspace: ws, prompt: "hi", permissionMode: "acceptEdits" },
    });
    expect(capturedOptions["permissionMode"]).toBe("acceptEdits");
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.start without permissionMode defaults to bypassPermissions", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-perm-default-"));
  let capturedOptions: Record<string, unknown> = {};

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ options }: { prompt: string; options: Record<string, unknown> }) {
    capturedOptions = options;
    yield { type: "system", subtype: "init", session_id: "perm-default-test" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    await server.handleMessage({
      jsonrpc: "2.0", id: 144,
      method: "session.start",
      params: { workspace: ws, prompt: "hi" },
    });
    expect(capturedOptions["permissionMode"]).toBe("bypassPermissions");
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.start with maxTurns passes it to the agent query", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-maxturns-"));
  let capturedOptions: Record<string, unknown> = {};

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ options }: { prompt: string; options: Record<string, unknown> }) {
    capturedOptions = options;
    yield { type: "system", subtype: "init", session_id: "maxturns-test" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    await server.handleMessage({
      jsonrpc: "2.0", id: 145,
      method: "session.start",
      params: { workspace: ws, prompt: "hi", maxTurns: 5 },
    });
    expect(capturedOptions["maxTurns"]).toBe(5);
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.start with systemPrompt passes it to the agent query", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-sysprompt-"));
  let capturedOptions: Record<string, unknown> = {};

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ options }: { prompt: string; options: Record<string, unknown> }) {
    capturedOptions = options;
    yield { type: "system", subtype: "init", session_id: "sysprompt-test" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    await server.handleMessage({
      jsonrpc: "2.0", id: 146,
      method: "session.start",
      params: { workspace: ws, prompt: "hi", systemPrompt: "You are strict." },
    });
    expect(capturedOptions["systemPrompt"]).toBe("You are strict.");
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.start with invalid permissionMode returns -32602", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-perm-invalid-"));
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0", id: 150,
    method: "session.start",
    params: { workspace: ws, prompt: "hi", permissionMode: "superuser" },
  });
  expect(response.error, "should return an error").toBeTruthy();
  expect(response.error?.code).toBe(-32602);
});

test("session.start with maxTurns as string returns -32602", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-maxturns-invalid-"));
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0", id: 151,
    method: "session.start",
    params: { workspace: ws, prompt: "hi", maxTurns: "five" },
  });
  expect(response.error, "should return an error").toBeTruthy();
  expect(response.error?.code).toBe(-32602);
});

test("session.start with allowedTools as string (not array) returns -32602", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-allowed-invalid-"));
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0", id: 152,
    method: "session.start",
    params: { workspace: ws, prompt: "hi", allowedTools: "Read" },
  });
  expect(response.error, "should return an error").toBeTruthy();
  expect(response.error?.code).toBe(-32602);
});

test("control parameters apply on session.resume with the same validation", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-resume-ctrl-"));
  let resumeCaptured: Record<string, unknown> = {};

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ options }: { prompt: string; options: Record<string, unknown> }) {
    if (options["resume"] !== undefined) {
      resumeCaptured = options;
    }
    yield { type: "system", subtype: "init", session_id: "resume-ctrl-sdk" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    const start = await server.handleMessage({
      jsonrpc: "2.0", id: 160,
      method: "session.start",
      params: { workspace: ws, prompt: "first" },
    });
    const sessionId = (start.result as Record<string, unknown>)["sessionId"] as string;

    await server.handleMessage({
      jsonrpc: "2.0", id: 161,
      method: "session.resume",
      params: { sessionId, prompt: "second", model: "claude-opus-4-6", permissionMode: "default" },
    });

    expect(resumeCaptured["model"]).toBe("claude-opus-4-6");
    expect(resumeCaptured["permissionMode"]).toBe("default");

    // Validation also applies: invalid permissionMode on resume
    const bad = await server.handleMessage({
      jsonrpc: "2.0", id: 162,
      method: "session.resume",
      params: { sessionId, prompt: "third", permissionMode: "superuser" },
    });
    expect(bad.error, "should return an error").toBeTruthy();
    expect(bad.error?.code).toBe(-32602);
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
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

async function waitForSessionStartedCount(
  notifications: Array<Record<string, unknown>>,
  count: number,
): Promise<string[]> {
  const started = () =>
    notifications
      .filter(
        (item) =>
          item["method"] === "bridge/session_event" &&
          (item["params"] as Record<string, unknown>)?.["type"] === "session_started",
      )
      .map((item) => (item["params"] as Record<string, unknown>)["sessionId"] as string);

  const timeoutMs = 1000;
  const start = Date.now();
  while (started().length < count) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for ${count} session_started events`);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }

  return started();
}

// ─── session.events tests ────────────────────────────────────────────────────

test("session.events returns buffered events after session.start", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-events-"));
  const notifications: unknown[] = [];

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "s1" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer({ notify: (m) => notifications.push(m) });

    const resp = await server.handleMessage({
      jsonrpc: "2.0", id: 1, method: "session.start",
      params: { workspace: ws, prompt: "hi" },
    });
    const sessionId = (resp.result as Record<string, unknown>)["sessionId"] as string;

    const evResp = await server.handleMessage({
      jsonrpc: "2.0", id: 2, method: "session.events",
      params: { sessionId },
    });

    expect(!evResp.error, "session.events should succeed").toBeTruthy();
    const r = evResp.result as Record<string, unknown>;
    expect(r["sessionId"]).toBe(sessionId);
    const events = r["events"] as Array<Record<string, unknown>>;
    expect(events.length >= 2, "should have at least session_started and session_completed events").toBeTruthy();
    expect(events.every((e) => typeof e["seq"] === "number"), "each event must have a seq").toBeTruthy();
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.events since filter returns only events from that seq onward", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-events-since-"));

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "s2" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    const resp = await server.handleMessage({
      jsonrpc: "2.0", id: 1, method: "session.start",
      params: { workspace: ws, prompt: "hi" },
    });
    const sessionId = (resp.result as Record<string, unknown>)["sessionId"] as string;

    const allResp = await server.handleMessage({
      jsonrpc: "2.0", id: 2, method: "session.events",
      params: { sessionId },
    });
    const allEvents = (allResp.result as Record<string, unknown>)["events"] as Array<Record<string, unknown>>;

    if (allEvents.length >= 2) {
      const since = (allEvents[1]!["seq"] as number);
      const sinceResp = await server.handleMessage({
        jsonrpc: "2.0", id: 3, method: "session.events",
        params: { sessionId, since },
      });
      const sinceEvents = (sinceResp.result as Record<string, unknown>)["events"] as Array<Record<string, unknown>>;
      expect(sinceEvents.every((e) => (e["seq"] as number) >= since), "all returned events must have seq >= since").toBeTruthy();
      expect(sinceEvents.length < allEvents.length, "since filter should reduce event count").toBeTruthy();
    }
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.events returns error -32011 for unknown session", async () => {
  const server = new BridgeServer();
  const resp = await server.handleMessage({
    jsonrpc: "2.0", id: 1, method: "session.events",
    params: { sessionId: "no-such-session" },
  });

  expect(resp.error?.code).toBe(-32011);
});

test("session.events respects limit parameter", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-events-limit-"));

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "s3" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    const resp = await server.handleMessage({
      jsonrpc: "2.0", id: 1, method: "session.start",
      params: { workspace: ws, prompt: "hi" },
    });
    const sessionId = (resp.result as Record<string, unknown>)["sessionId"] as string;

    const limitResp = await server.handleMessage({
      jsonrpc: "2.0", id: 2, method: "session.events",
      params: { sessionId, limit: 1 },
    });
    const events = (limitResp.result as Record<string, unknown>)["events"] as unknown[];
    expect(events.length <= 1, "limit:1 must return at most 1 event").toBeTruthy();
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

// ─── token usage tests ───────────────────────────────────────────────────────

test("session.start response includes usage when SDK provides it", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-usage-"));
  const notifications: unknown[] = [];

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "su1" };
    yield { result: "done", usage: { input_tokens: 10, output_tokens: 20 } };
  };

  try {
    const server = new BridgeServer({ notify: (m) => notifications.push(m) });
    const resp = await server.handleMessage({
      jsonrpc: "2.0", id: 1, method: "session.start",
      params: { workspace: ws, prompt: "hi" },
    });

    const r = resp.result as Record<string, unknown>;
    const usage = r["usage"] as Record<string, unknown>;
    expect(usage !== null && typeof usage === "object", "usage must be present").toBeTruthy();
    expect(usage["inputTokens"]).toBe(10);
    expect(usage["outputTokens"]).toBe(20);

    const completedNotif = (notifications as Array<Record<string, unknown>>).find(
      (n) => (n["params"] as Record<string, unknown>)?.["type"] === "session_completed",
    );
    expect(completedNotif, "session_completed notification must be emitted").toBeTruthy();
    const notifUsage = (completedNotif!["params"] as Record<string, unknown>)["usage"] as Record<string, unknown>;
    expect(notifUsage["inputTokens"]).toBe(10);
    expect(notifUsage["outputTokens"]).toBe(20);
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

test("session.start response has usage: null when SDK omits usage", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-usage-null-"));

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "su2" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();
    const resp = await server.handleMessage({
      jsonrpc: "2.0", id: 1, method: "session.start",
      params: { workspace: ws, prompt: "hi" },
    });

    const r = resp.result as Record<string, unknown>;
    expect(r["usage"], "usage must be null when SDK does not provide it").toBeNull();
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
  }
});

// ────────────────────────────────────────────────────────
// Tool approval flow tests
// ────────────────────────────────────────────────────────

/** Wait for a bridge/tool_approval_requested notification, resolving with its params. */
function makeApprovalWaiter(server: BridgeServer): {
  server: BridgeServer;
  waitForApproval: () => Promise<Record<string, unknown>>;
} {
  let resolveApproval!: (params: Record<string, unknown>) => void;
  const approvalPromise = new Promise<Record<string, unknown>>((res) => { resolveApproval = res; });

  const wrapped = new BridgeServer({
    notify: (m) => {
      const msg = m as Record<string, unknown>;
      const params = msg["params"] as Record<string, unknown> | undefined;
      if (msg["method"] === "bridge/tool_approval_requested" && params) {
        resolveApproval(params);
      }
    },
  });

  // Replace the wrapped server's notify by reconstructing — instead, we expose
  // a factory that builds the BridgeServer with the intercepting notify directly.
  void server; // unused — see factory function below
  return { server: wrapped, waitForApproval: () => approvalPromise };
}

function makeApprovalServer(): {
  server: BridgeServer;
  waitForApproval: () => Promise<Record<string, unknown>>;
} {
  let resolveApproval!: (params: Record<string, unknown>) => void;
  const approvalPromise = new Promise<Record<string, unknown>>((res) => { resolveApproval = res; });

  const server = new BridgeServer({
    notify: (m) => {
      const msg = m as Record<string, unknown>;
      const params = msg["params"] as Record<string, unknown> | undefined;
      if (msg["method"] === "bridge/tool_approval_requested" && params) {
        resolveApproval(params);
      }
    },
  });

  return { server, waitForApproval: () => approvalPromise };
}

test("session.approveTool allows a pending canUseTool call and session completes", async () => {
  // Reset any global mock first
  delete globalThis.__AI_SPEC_SDK_QUERY__;

  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-approve-"));
  type CanUseTool = (tool: string, input: Record<string, unknown>, opts: { signal: AbortSignal; toolUseID: string }) => Promise<{ behavior: string }>;

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ prompt, options }: { prompt: string; options: Record<string, unknown> }) {
    yield { type: "system", subtype: "init", session_id: "s1" };
    const canUseTool = options["canUseTool"] as CanUseTool | undefined;
    if (canUseTool) {
      const ac = new AbortController();
      const perm = await canUseTool("Bash", { command: "ls" }, { signal: ac.signal, toolUseID: "tu-1" });
      yield { type: "tool_use_result", behavior: perm.behavior };
    }
    yield { result: `done:${prompt}` };
  };

  try {
    const { server, waitForApproval } = makeApprovalServer();

    // Kick off the session — do NOT await yet (it will block on canUseTool)
    const startPromise = server.handleMessage({
      jsonrpc: "2.0", id: 1,
      method: "session.start",
      params: { workspace: ws, prompt: "hello", permissionMode: "approve" },
    });

    // Wait for the approval notification (emitted synchronously inside canUseTool)
    const approvalParams = await waitForApproval();
    const sessionId = approvalParams["sessionId"] as string;
    const requestId = approvalParams["requestId"] as string;
    expect(typeof sessionId === "string", "approval notification must carry sessionId").toBeTruthy();
    expect(approvalParams["toolName"]).toBe("Bash");

    // Approve the tool — this resolves the pending canUseTool Promise
    const approveResp = await server.handleMessage({
      jsonrpc: "2.0", id: 2,
      method: "session.approveTool",
      params: { sessionId, requestId },
    });
    expect(!approveResp.error, "session.approveTool must not error").toBeTruthy();
    expect((approveResp.result as Record<string, unknown>)["behavior"]).toBe("allow");

    // Now the session should complete
    const startResult = await startPromise;
    expect(!startResult.error, "session should complete without error").toBeTruthy();
    expect((startResult.result as Record<string, unknown>)["status"]).toBe("completed");
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("session.rejectTool denies a pending canUseTool call", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-reject-"));
  type CanUseTool = (tool: string, input: Record<string, unknown>, opts: { signal: AbortSignal; toolUseID: string }) => Promise<{ behavior: string }>;

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ prompt, options }: { prompt: string; options: Record<string, unknown> }) {
    yield { type: "system", subtype: "init", session_id: "s2" };
    const canUseTool = options["canUseTool"] as CanUseTool | undefined;
    if (canUseTool) {
      const ac = new AbortController();
      const perm = await canUseTool("Bash", { command: "rm -rf /" }, { signal: ac.signal, toolUseID: "tu-2" });
      yield { type: "tool_use_result", behavior: perm.behavior };
    }
    yield { result: `done:${prompt}` };
  };

  try {
    const { server, waitForApproval } = makeApprovalServer();

    const startPromise = server.handleMessage({
      jsonrpc: "2.0", id: 3,
      method: "session.start",
      params: { workspace: ws, prompt: "dangerous", permissionMode: "approve" },
    });

    const approvalParams = await waitForApproval();
    const sessionId = approvalParams["sessionId"] as string;
    const requestId = approvalParams["requestId"] as string;

    const rejectResp = await server.handleMessage({
      jsonrpc: "2.0", id: 4,
      method: "session.rejectTool",
      params: { sessionId, requestId, message: "Not allowed" },
    });
    expect(!rejectResp.error, "session.rejectTool must not error").toBeTruthy();
    expect((rejectResp.result as Record<string, unknown>)["behavior"]).toBe("deny");

    const startResult = await startPromise;
    expect(!startResult.error, "session should complete (with denied tool)").toBeTruthy();
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("session.approveTool returns -32020 for an unknown requestId", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-approve-unk-"));

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "s3" };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer();

    const start = await server.handleMessage({
      jsonrpc: "2.0", id: 5,
      method: "session.start",
      params: { workspace: ws, prompt: "hi", permissionMode: "bypassPermissions" },
    });
    const sessionId = (start.result as Record<string, unknown>)["sessionId"] as string;

    const resp = await server.handleMessage({
      jsonrpc: "2.0", id: 6,
      method: "session.approveTool",
      params: { sessionId, requestId: "nonexistent-request-id" },
    });
    expect(resp.error, "must return an error for unknown requestId").toBeTruthy();
    expect(resp.error!.code).toBe(-32020);
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("session.rejectTool returns -32020 for sessionId mismatch", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-reject-mismatch-"));
  type CanUseTool = (tool: string, input: Record<string, unknown>, opts: { signal: AbortSignal; toolUseID: string }) => Promise<{ behavior: string }>;

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ options }: { options: Record<string, unknown> }) {
    yield { type: "system", subtype: "init", session_id: "s4" };
    const canUseTool = options["canUseTool"] as CanUseTool | undefined;
    if (canUseTool) {
      const ac = new AbortController();
      await canUseTool("Read", { file: "x" }, { signal: ac.signal, toolUseID: "tu-3" });
    }
    yield { result: "done" };
  };

  try {
    const { server, waitForApproval } = makeApprovalServer();

    const startPromise = server.handleMessage({
      jsonrpc: "2.0", id: 7,
      method: "session.start",
      params: { workspace: ws, prompt: "test", permissionMode: "approve" },
    });

    const approvalParams = await waitForApproval();
    const requestId = approvalParams["requestId"] as string;

    // Use the wrong sessionId
    const resp = await server.handleMessage({
      jsonrpc: "2.0", id: 8,
      method: "session.rejectTool",
      params: { sessionId: "wrong-session-id", requestId },
    });
    expect(resp.error, "must return an error for session not found").toBeTruthy();
    // -32011 session not found or -32020 approval not found
    expect(resp.error!.code === -32011 || resp.error!.code === -32020).toBeTruthy();

    // Clean up: approve with correct sessionId so session can finish
    const correctSessionId = approvalParams["sessionId"] as string;
    await server.handleMessage({
      jsonrpc: "2.0", id: 9,
      method: "session.approveTool",
      params: { sessionId: correctSessionId, requestId },
    });
    await startPromise;
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("session.stop auto-denies pending tool approvals", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-stop-approve-"));
  type CanUseTool = (tool: string, input: Record<string, unknown>, opts: { signal: AbortSignal; toolUseID: string }) => Promise<{ behavior: string }>;

  let permissionBehavior: string | undefined;

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ options }: { options: Record<string, unknown> }) {
    yield { type: "system", subtype: "init", session_id: "s5" };
    const canUseTool = options["canUseTool"] as CanUseTool | undefined;
    if (canUseTool) {
      const ac = new AbortController();
      const perm = await canUseTool("Bash", { command: "sleep 999" }, { signal: ac.signal, toolUseID: "tu-4" });
      permissionBehavior = perm.behavior;
    }
    yield { result: "done" };
  };

  try {
    const { server, waitForApproval } = makeApprovalServer();

    const startPromise = server.handleMessage({
      jsonrpc: "2.0", id: 10,
      method: "session.start",
      params: { workspace: ws, prompt: "slow", permissionMode: "approve" },
    });

    const approvalParams = await waitForApproval();
    const sessionId = approvalParams["sessionId"] as string;
    const requestId = approvalParams["requestId"] as string;

    // Stop the session while the tool approval is pending
    const stopResp = await server.handleMessage({
      jsonrpc: "2.0", id: 11,
      method: "session.stop",
      params: { sessionId },
    });
    expect(!stopResp.error, "session.stop must succeed").toBeTruthy();

    // The pending approval should have been auto-denied; session finishes
    await startPromise;
    expect(permissionBehavior, "auto-denied approval must produce deny behavior").toBe("deny");

    // The requestId is no longer in pendingApprovals — a second call should error
    const lateApprove = await server.handleMessage({
      jsonrpc: "2.0", id: 12,
      method: "session.approveTool",
      params: { sessionId, requestId },
    });
    expect(lateApprove.error, "late approval after stop must return an error").toBeTruthy();
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

// ── Streaming tests ──────────────────────────────────────────────────────────

test("session.start with stream: true emits stream_chunk events", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-stream-"));
  const notifications: unknown[] = [];

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* queryStub({ prompt, options }: {
    prompt: string;
    options: Record<string, unknown>;
  }) {
    yield { type: "system", subtype: "init", session_id: "sdk-stream-1" };
    // When includePartialMessages is true, emit streaming events
    if (options["includePartialMessages"]) {
      yield {
        type: "stream_event",
        event: { type: "content_block_delta", delta: { type: "text_delta", text: "Hel" } },
        parent_tool_use_id: null,
        uuid: "u1",
        session_id: "sdk-stream-1",
      };
      yield {
        type: "stream_event",
        event: { type: "content_block_delta", delta: { type: "text_delta", text: "lo!" } },
        parent_tool_use_id: null,
        uuid: "u2",
        session_id: "sdk-stream-1",
      };
    }
    // Then the complete assistant message
    yield {
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text: "Hello!" }] },
    };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer({
      notify: (message) => notifications.push(message),
    });

    const response = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "session.start",
      params: {
        workspace: ws,
        prompt: "stream test",
        stream: true,
      },
    });

    const result = response.result as Record<string, unknown>;
    expect(result["status"]).toBe("completed");

    // Find stream_chunk notifications
    const streamChunks = notifications.filter((n) => {
      const params = (n as Record<string, unknown>)["params"] as Record<string, unknown>;
      return params?.["messageType"] === "stream_chunk";
    });
    expect(streamChunks.length, "should emit 2 stream_chunk events").toBe(2);

    // Verify content and index
    const chunk0 = (streamChunks[0] as Record<string, unknown>)["params"] as Record<string, unknown>;
    expect(chunk0["content"]).toBe("Hel");
    expect(chunk0["index"]).toBe(0);

    const chunk1 = (streamChunks[1] as Record<string, unknown>)["params"] as Record<string, unknown>;
    expect(chunk1["content"]).toBe("lo!");
    expect(chunk1["index"]).toBe(1);

    // Verify the full assistant_text was also emitted
    const assistantTexts = notifications.filter((n) => {
      const params = (n as Record<string, unknown>)["params"] as Record<string, unknown>;
      return params?.["messageType"] === "assistant_text";
    });
    expect(assistantTexts.length, "should emit 1 complete assistant_text").toBe(1);
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("session.start without stream (default) emits no stream_chunk events", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-nostream-"));
  const notifications: unknown[] = [];

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* queryStub() {
    yield { type: "system", subtype: "init", session_id: "sdk-nostream-1" };
    yield {
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text: "Hello!" }] },
    };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer({
      notify: (message) => notifications.push(message),
    });

    await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "session.start",
      params: {
        workspace: ws,
        prompt: "no stream test",
      },
    });

    const streamChunks = notifications.filter((n) => {
      const params = (n as Record<string, unknown>)["params"] as Record<string, unknown>;
      return params?.["messageType"] === "stream_chunk";
    });
    expect(streamChunks.length, "should emit 0 stream_chunk events when stream is not set").toBe(0);
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("stream_chunk index resets per turn", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-stream-reset-"));
  const notifications: unknown[] = [];

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* queryStub({ options }: {
    options: Record<string, unknown>;
  }) {
    yield { type: "system", subtype: "init", session_id: "sdk-reset-1" };
    if (options["includePartialMessages"]) {
      // Turn 1 chunks
      yield {
        type: "stream_event",
        event: { type: "content_block_delta", delta: { type: "text_delta", text: "A" } },
        parent_tool_use_id: null, uuid: "u1", session_id: "sdk-reset-1",
      };
    }
    // Turn 1 complete
    yield {
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text: "A" }] },
    };
    // Turn 2 chunks
    if (options["includePartialMessages"]) {
      yield {
        type: "stream_event",
        event: { type: "content_block_delta", delta: { type: "text_delta", text: "B" } },
        parent_tool_use_id: null, uuid: "u3", session_id: "sdk-reset-1",
      };
    }
    // Turn 2 complete
    yield {
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text: "B" }] },
    };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer({
      notify: (message) => notifications.push(message),
    });

    await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "session.start",
      params: { workspace: ws, prompt: "multi-turn stream", stream: true },
    });

    const streamChunks = notifications.filter((n) => {
      const params = (n as Record<string, unknown>)["params"] as Record<string, unknown>;
      return params?.["messageType"] === "stream_chunk";
    });
    expect(streamChunks.length).toBe(2);

    const chunk0 = (streamChunks[0] as Record<string, unknown>)["params"] as Record<string, unknown>;
    expect(chunk0["index"], "first turn chunk should have index 0").toBe(0);

    // After assistant_text resets the counter, the second turn's first chunk should be index 0
    const chunk1 = (streamChunks[1] as Record<string, unknown>)["params"] as Record<string, unknown>;
    expect(chunk1["index"], "second turn chunk should reset to index 0").toBe(0);
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("bridge.capabilities includes streaming: true", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "bridge.capabilities",
  });
  const result = response.result as Record<string, unknown>;
  expect(result["streaming"]).toBe(true);
});

test("stream_chunk events stored in event buffer and replayable via session.events", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-stream-replay-"));
  const notifications: unknown[] = [];

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* queryStub({ options }: {
    options: Record<string, unknown>;
  }) {
    yield { type: "system", subtype: "init", session_id: "sdk-replay-1" };
    if (options["includePartialMessages"]) {
      yield {
        type: "stream_event",
        event: { type: "content_block_delta", delta: { type: "text_delta", text: "X" } },
        parent_tool_use_id: null, uuid: "u1", session_id: "sdk-replay-1",
      };
    }
    yield {
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text: "X" }] },
    };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer({
      notify: (message) => notifications.push(message),
    });

    const startResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "session.start",
      params: { workspace: ws, prompt: "replay test", stream: true },
    });
    const sessionId = (startResp.result as Record<string, unknown>)["sessionId"] as string;

    // Now get events from the buffer
    const eventsResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "session.events",
      params: { sessionId, limit: 100 },
    });
    const eventsResult = eventsResp.result as Record<string, unknown>;
    const events = eventsResult["events"] as Array<Record<string, unknown>>;

    // Should include the stream_chunk event in the buffer
    const streamChunks = events.filter((e) => {
      const payload = e["payload"] as Record<string, unknown>;
      return payload?.["messageType"] === "stream_chunk";
    });
    expect(streamChunks.length > 0, "event buffer should contain stream_chunk events").toBeTruthy();
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

// --- Template integration tests ---

test("session.start with template applies template parameters", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-template-session-"));

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* queryStub({ options }: {
    options: Record<string, unknown>;
  }) {
    // Verify that template parameters were passed
    expect(options["model"]).toBe("claude-3-opus");
    expect(options["allowedTools"]).toEqual(["Read", "Glob"]);
    expect(options["maxTurns"]).toBe(5);
    yield { type: "system", subtype: "init" };
    yield { result: "success" };
  };

  try {
    const server = new BridgeServer();

    // Create template first
    await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "template.create",
      params: {
        name: "test-session-template",
        model: "claude-3-opus",
        allowedTools: ["Read", "Glob"],
        maxTurns: 5,
      },
    });

    const response = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "session.start",
      params: {
        workspace: ws,
        prompt: "hello with template",
        template: "test-session-template",
      },
    });

    expect(!response.error, "session.start with template should not error").toBeTruthy();
    const result = response.result as Record<string, unknown>;
    expect(result["status"]).toBe("completed");
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("session.start explicit parameters override template", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-template-override-"));

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* queryStub({ options }: {
    options: Record<string, unknown>;
  }) {
    // Verify that explicit parameter overrides template
    expect(options["model"]).toBe("claude-3-sonnet"); // explicit value, not template value
    expect(options["maxTurns"]).toBe(10); // template value (not overridden)
    yield { type: "system", subtype: "init" };
    yield { result: "success" };
  };

  try {
    const server = new BridgeServer();

    // Create template
    await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "template.create",
      params: {
        name: "override-test-template",
        model: "claude-3-opus",
        maxTurns: 10,
      },
    });

    const response = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "session.start",
      params: {
        workspace: ws,
        prompt: "hello with override",
        template: "override-test-template",
        model: "claude-3-sonnet", // explicit override
      },
    });

    expect(!response.error).toBeTruthy();
    const result = response.result as Record<string, unknown>;
    expect(result["status"]).toBe("completed");
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("session.start with non-existent template returns -32021", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-template-missing-"));

  try {
    const server = new BridgeServer();

    const response = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "session.start",
      params: {
        workspace: ws,
        prompt: "hello",
        template: "non-existent-template",
      },
    });

    expect(response.error, "should return error for missing template").toBeTruthy();
    expect(response.error!.code).toBe(-32021);
    expect((response.error!.message as string).includes("Template not found")).toBeTruthy();
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("session.start without template works as before", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-no-template-"));

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* queryStub() {
    yield { type: "system", subtype: "init" };
    yield { result: "success" };
  };

  try {
    const server = new BridgeServer();

    const response = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "session.start",
      params: {
        workspace: ws,
        prompt: "hello without template",
      },
    });

    expect(!response.error).toBeTruthy();
    const result = response.result as Record<string, unknown>;
    expect(result["status"]).toBe("completed");
  } finally {
    // Make sure to clean up the query mock if we used it
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

// ── Stream Control tests ──────────────────────────────────────────────────────

// Requirement: stream-pause-resume
test("stream.pause buffers stream chunks without emitting", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-stream-pause-"));
  const notifications: unknown[] = [];
  
  let resolvePause!: () => void;
  const pausePromise = new Promise<void>(res => { resolvePause = res; });

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* queryStub({ options }: {
    prompt: string;
    options: Record<string, unknown>;
  }) {
    yield { type: "system", subtype: "init", session_id: "sdk-stream-pause" };
    if (options["includePartialMessages"]) {
      yield {
        type: "stream_event",
        event: { type: "content_block_delta", delta: { type: "text_delta", text: "1" } },
        session_id: "sdk-stream-pause",
      };
      await pausePromise;
      yield {
        type: "stream_event",
        event: { type: "content_block_delta", delta: { type: "text_delta", text: "2" } },
        session_id: "sdk-stream-pause",
      };
      yield {
        type: "stream_event",
        event: { type: "content_block_delta", delta: { type: "text_delta", text: "3" } },
        session_id: "sdk-stream-pause",
      };
    }
    yield {
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text: "123" }] },
    };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer({
      notify: (message) => notifications.push(message),
    });

    const startPromise = server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "session.start",
      params: { workspace: ws, prompt: "test", stream: true },
    });

    // wait until the first chunk occurs to get the UUID and ensure it's not paused yet
    const getSessionIdAfterFirstChunk = async () => {
      while (true) {
        const startResponse = notifications.find(n => (n as any)?.method === "bridge/session_event" && (n as any)?.params?.type === "session_started");
        const firstChunk = notifications.find(n => (n as any)?.method === "bridge/session_event" && (n as any)?.params?.messageType === "stream_chunk");
        if (startResponse && firstChunk) return (startResponse as any).params.sessionId;
        await new Promise<void>(resolve => setTimeout(resolve, 5));
      }
    };
    const sessionId = await getSessionIdAfterFirstChunk();

    // Pause the stream
    await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "stream.pause",
      params: { sessionId },
    });

    // Let the mock yield chunk 2 and 3
    resolvePause();
    
    // Wait for the mock to yield them
    await new Promise<void>(resolve => setTimeout(resolve, 20));

    // While paused, only 1 chunk should be emitted (the first one)
    const chunksWhilePaused = notifications.filter(n => (n as any)?.method === "bridge/session_event" && (n as any)?.params?.messageType === "stream_chunk");
    expect(chunksWhilePaused.length).toBe(1);

    // Resume the stream
    await server.handleMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "stream.resume",
      params: { sessionId },
    });

    await startPromise;

    const allChunks = notifications.filter(n => (n as any)?.method === "bridge/session_event" && (n as any)?.params?.messageType === "stream_chunk");
    expect(allChunks.length).toBe(3); // All chunks now emitted
    
  } finally {
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

// Requirement: stream-throttle
test("stream.throttle limits token emission rate", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-stream-throttle-"));
  const notifications: unknown[] = [];
  
  let resolveThrottle!: () => void;
  const throttlePromise = new Promise<void>(res => { resolveThrottle = res; });

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* queryStub({ options }: {
    prompt: string;
    options: Record<string, unknown>;
  }) {
    yield { type: "system", subtype: "init", session_id: "sdk-stream-throttle" };
    if (options["includePartialMessages"]) {
      yield {
        type: "stream_event",
        event: { type: "content_block_delta", delta: { type: "text_delta", text: "A" } },
        session_id: "sdk-stream-throttle",
      };
      await throttlePromise;
      yield {
        type: "stream_event",
        event: { type: "content_block_delta", delta: { type: "text_delta", text: "B" } },
        session_id: "sdk-stream-throttle",
      };
      yield {
        type: "stream_event",
        event: { type: "content_block_delta", delta: { type: "text_delta", text: "C" } },
        session_id: "sdk-stream-throttle",
      };
    }
    yield {
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text: "ABC" }] },
    };
    yield { result: "done" };
  };

  try {
    const server = new BridgeServer({
      notify: (message) => notifications.push(message),
    });

    const startPromise = server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "session.start",
      params: { workspace: ws, prompt: "test", stream: true },
    });

    const getSessionIdAfterFirstChunk = async () => {
      while (true) {
        const startResponse = notifications.find(n => (n as any)?.method === "bridge/session_event" && (n as any)?.params?.type === "session_started");
        const firstChunk = notifications.find(n => (n as any)?.method === "bridge/session_event" && (n as any)?.params?.messageType === "stream_chunk");
        if (startResponse && firstChunk) return (startResponse as any).params.sessionId;
        await new Promise<void>(resolve => setTimeout(resolve, 5));
      }
    };
    const sessionId = await getSessionIdAfterFirstChunk();
    
    // Throttle to 10 tokens/sec
    await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "stream.throttle",
      params: { sessionId, tokensPerSecond: 10 },
    });

    const startTime = Date.now();
    resolveThrottle();
    
    // Wait until all 3 chunks are emitted
    while (true) {
      const allChunks = notifications.filter(n => (n as any)?.method === "bridge/session_event" && (n as any)?.params?.messageType === "stream_chunk");
      if (allChunks.length >= 3) break;
      await new Promise<void>(resolve => setTimeout(resolve, 5));
    }

    const elapsed = Date.now() - startTime;
    // 2 buffered chunks at 100ms interval each -> at least ~100ms elapsed
    expect(elapsed > 80).toBeTruthy();

    await startPromise;
    
  } finally {
    globalThis.__AI_SPEC_SDK_QUERY__ = fallbackMock;
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

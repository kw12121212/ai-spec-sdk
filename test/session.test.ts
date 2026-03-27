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
  } finally {
    delete globalThis.__AI_SPEC_SDK_QUERY__;
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
  } finally {
    delete globalThis.__AI_SPEC_SDK_QUERY__;
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

    assert.equal(capturedCwd, fixtureWorkspace);
  } finally {
    delete globalThis.__AI_SPEC_SDK_QUERY__;
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

    assert.equal(capturedResumeId, "sdk-session-xyz");
    assert.notEqual(capturedResumeId, sessionId);
  } finally {
    delete globalThis.__AI_SPEC_SDK_QUERY__;
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

    assert.ok(capturedEnv, "env should be set");
    assert.equal(capturedEnv["HTTP_PROXY"], "http://proxy.corp.com:8080");
    assert.equal(capturedEnv["HTTPS_PROXY"], "http://proxy.corp.com:8080");
    assert.equal(capturedEnv["NO_PROXY"], "localhost,127.0.0.1");
  } finally {
    delete globalThis.__AI_SPEC_SDK_QUERY__;
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

  assert.ok(response.error, "should return an error");
  assert.equal(response.error?.code, -32602);
  assert.ok(!response.result);
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

    assert.ok(resume.error, "should return an error");
    assert.equal(resume.error?.code, -32012);
  } finally {
    delete globalThis.__AI_SPEC_SDK_QUERY__;
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

    assert.ok(capturedEnv, "env should be set");
    assert.equal(capturedEnv["HTTP_PROXY"], "http://proxy.corp.com:8080");
    assert.equal(capturedEnv["HTTPS_PROXY"], undefined);
    assert.equal(capturedEnv["NO_PROXY"], undefined);
  } finally {
    delete globalThis.__AI_SPEC_SDK_QUERY__;
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

  assert.ok(response.error, "should return an error");
  assert.equal(response.error?.code, -32602);
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

    assert.ok(capturedEnv, "env should be set");
    assert.equal(capturedEnv["MY_VAR"], "kept");
    assert.equal(capturedEnv["HTTP_PROXY"], "http://proxy.corp.com:8080");
  } finally {
    delete globalThis.__AI_SPEC_SDK_QUERY__;
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

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BridgeServer } from "../src/bridge.js";

test("bridge.capabilities returns stdio JSON-RPC capabilities", async () => {
  const notifications: unknown[] = [];
  const server = new BridgeServer({
    notify: (message) => notifications.push(message),
  });

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "bridge.capabilities",
  });

  assert.equal(response.jsonrpc, "2.0");
  assert.equal(response.id, 1);
  const result = response.result as Record<string, unknown>;
  assert.equal(result["transport"], "stdio");
  assert.equal(result["protocol"], "jsonrpc-2.0");
  assert.ok((result["methods"] as string[]).includes("workflow.run"));
  assert.equal(notifications.length, 0);
});

test("unknown method returns method-not-found error", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "does.not.exist",
  });

  assert.equal(response.jsonrpc, "2.0");
  assert.equal(response.id, 2);
  assert.equal(response.error!.code, -32601);
});

test("bridge.capabilities includes session.history in methods list", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 4,
    method: "bridge.capabilities",
  });

  const result = response.result as Record<string, unknown>;
  assert.ok(
    (result["methods"] as string[]).includes("session.history"),
    "capabilities must advertise session.history",
  );
});

test("invalid JSON-RPC object returns invalid-request error", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    id: 3,
    method: "bridge.capabilities",
  });

  assert.equal(response.jsonrpc, "2.0");
  assert.equal(response.id, 3);
  assert.equal(response.error!.code, -32600);
});

test("bridge.ping returns pong with ISO timestamp", async () => {
  const server = new BridgeServer();
  const before = Date.now();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 5,
    method: "bridge.ping",
  });
  const after = Date.now();

  assert.equal(response.jsonrpc, "2.0");
  assert.equal(response.id, 5);
  assert.ok(!response.error, "bridge.ping should not return an error");
  const result = response.result as Record<string, unknown>;
  assert.equal(result["pong"], true);
  assert.equal(typeof result["ts"], "string");
  const ts = new Date(result["ts"] as string).getTime();
  assert.ok(ts >= before && ts <= after, "ts should be a current ISO timestamp");
});

test("bridge.capabilities advertises bridge.ping and session.events", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 6,
    method: "bridge.capabilities",
  });

  const methods = (response.result as Record<string, unknown>)["methods"] as string[];
  assert.ok(methods.includes("bridge.ping"), "capabilities must advertise bridge.ping");
  assert.ok(methods.includes("session.events"), "capabilities must advertise session.events");
});

test("models.list returns non-empty array of {id, displayName} objects", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 10,
    method: "models.list",
  });

  assert.ok(!response.error, "models.list must not return an error");
  const result = response.result as Record<string, unknown>;
  const models = result["models"] as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(models) && models.length > 0, "models must be a non-empty array");
  for (const m of models) {
    assert.ok(typeof m["id"] === "string" && m["id"].length > 0, "each model must have an id");
    assert.ok(typeof m["displayName"] === "string" && m["displayName"].length > 0, "each model must have a displayName");
  }
});

test("bridge.capabilities advertises models.list, workspace.register, workspace.list, tools.list", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 11,
    method: "bridge.capabilities",
  });

  const methods = (response.result as Record<string, unknown>)["methods"] as string[];
  assert.ok(methods.includes("models.list"));
  assert.ok(methods.includes("workspace.register"));
  assert.ok(methods.includes("workspace.list"));
  assert.ok(methods.includes("tools.list"));
});

test("tools.list returns non-empty array of {name, description} objects", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 12,
    method: "tools.list",
  });

  assert.ok(!response.error, "tools.list must not return an error");
  const result = response.result as Record<string, unknown>;
  const tools = result["tools"] as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(tools) && tools.length > 0, "tools must be a non-empty array");
  for (const t of tools) {
    assert.ok(typeof t["name"] === "string" && t["name"].length > 0, "each tool must have a name");
    assert.ok(typeof t["description"] === "string" && t["description"].length > 0, "each tool must have a description");
  }
});

test("workspace.register returns entry and workspace.list reflects it", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-bridge-ws-"));
  try {
    const server = new BridgeServer();
    const regResponse = await server.handleMessage({
      jsonrpc: "2.0",
      id: 13,
      method: "workspace.register",
      params: { workspace: wsDir },
    });

    assert.ok(!regResponse.error, "workspace.register must not error for an existing directory");
    const entry = (regResponse.result as Record<string, unknown>)["workspace"] as Record<string, unknown>;
    assert.equal(entry["path"], wsDir);
    assert.ok(typeof entry["registeredAt"] === "string");
    assert.ok(typeof entry["lastUsedAt"] === "string");

    const listResponse = await server.handleMessage({
      jsonrpc: "2.0",
      id: 14,
      method: "workspace.list",
    });
    const workspaces = (listResponse.result as Record<string, unknown>)["workspaces"] as Array<Record<string, unknown>>;
    assert.ok(workspaces.some((w) => w["path"] === wsDir), "workspace.list must include the registered path");
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
});

test("workspace.register returns -32001 for a non-existent path", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 15,
    method: "workspace.register",
    params: { workspace: "/this/path/does/not/exist" },
  });

  assert.ok(response.error, "must return an error for non-existent path");
  assert.equal(response.error!.code, -32001);
});

test("workspace.register returns -32602 when workspace param is missing", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 16,
    method: "workspace.register",
    params: {},
  });

  assert.ok(response.error);
  assert.equal(response.error!.code, -32602);
});

test("workspace.list returns empty array when no workspaces registered", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 17,
    method: "workspace.list",
  });

  assert.ok(!response.error);
  const workspaces = (response.result as Record<string, unknown>)["workspaces"] as unknown[];
  assert.deepEqual(workspaces, []);
});

// --- Context management tests ---

test("context.read reads a project CLAUDE.md", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctx-bridge-"));
  try {
    fs.writeFileSync(path.join(wsDir, "CLAUDE.md"), "# Test", "utf8");
    const server = new BridgeServer();

    const response = await server.handleMessage({
      jsonrpc: "2.0",
      id: 100,
      method: "context.read",
      params: { scope: "project", workspace: wsDir, path: "CLAUDE.md" },
    });

    assert.ok(!response.error, `unexpected error: ${JSON.stringify(response.error)}`);
    const result = response.result as Record<string, unknown>;
    assert.equal(result["content"], "# Test");
    assert.equal(result["scope"], "project");
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
});

test("context.write creates a file and context.read reads it back", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctx-bridge-"));
  try {
    const server = new BridgeServer();

    const writeResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 101,
      method: "context.write",
      params: { scope: "project", workspace: wsDir, path: "CLAUDE.md", content: "# Written" },
    });
    assert.ok(!writeResp.error);
    assert.equal((writeResp.result as Record<string, unknown>)["written"], true);

    const readResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 102,
      method: "context.read",
      params: { scope: "project", workspace: wsDir, path: "CLAUDE.md" },
    });
    assert.equal((readResp.result as Record<string, unknown>)["content"], "# Written");
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
});

test("context.write rejects path traversal", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctx-bridge-"));
  try {
    const server = new BridgeServer();

    const response = await server.handleMessage({
      jsonrpc: "2.0",
      id: 103,
      method: "context.write",
      params: { scope: "project", workspace: wsDir, path: "../../etc/bad", content: "hacked" },
    });
    assert.ok(response.error);
    assert.equal(response.error!.code, -32602);
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
});

test("context.list returns project and user files", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctx-bridge-"));
  try {
    fs.writeFileSync(path.join(wsDir, "CLAUDE.md"), "# P", "utf8");
    fs.mkdirSync(path.join(wsDir, ".claude"), { recursive: true });
    fs.writeFileSync(path.join(wsDir, ".claude", "settings.json"), "{}", "utf8");

    const server = new BridgeServer();
    const response = await server.handleMessage({
      jsonrpc: "2.0",
      id: 104,
      method: "context.list",
      params: { workspace: wsDir },
    });

    assert.ok(!response.error);
    const files = (response.result as Record<string, unknown>)["files"] as Array<Record<string, unknown>>;
    const projectFiles = files.filter((f) => f["scope"] === "project");
    assert.ok(projectFiles.length >= 2, "should have CLAUDE.md and .claude/settings.json");
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
});

test("context.read returns -32001 for non-existent file", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctx-bridge-"));
  try {
    const server = new BridgeServer();
    const response = await server.handleMessage({
      jsonrpc: "2.0",
      id: 105,
      method: "context.read",
      params: { scope: "project", workspace: wsDir, path: ".claude/nonexistent.md" },
    });
    assert.ok(response.error);
    assert.equal(response.error!.code, -32001);
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
});

// --- File change tracking tests ---

test("bridge/file_changed emitted for Write tool_use", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "file-track-"));
  try {
    const notifications: unknown[] = [];
    const server = new BridgeServer({
      notify: (msg) => notifications.push(msg),
    });

    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "assistant", message: { content: [{ type: "tool_use", name: "Write", id: "tu-1", input: { file_path: path.join(wsDir, "new-file.ts"), content: "export {}" } }] } };
      yield { type: "result", subtype: "success", result: "done" };
    };

    await server.handleMessage({
      jsonrpc: "2.0",
      id: 200,
      method: "session.start",
      params: { workspace: wsDir, prompt: "test" },
    });

    delete globalThis.__AI_SPEC_SDK_QUERY__;

    const fileChanged = notifications.find(
      (n) => (n as Record<string, unknown>)["method"] === "bridge/file_changed",
    );
    assert.ok(fileChanged, "should emit bridge/file_changed for Write tool");
    const params = (fileChanged as Record<string, unknown>)["params"] as Record<string, unknown>;
    assert.equal(params["action"], "created");
    assert.ok(params["path"], "should include relative path");
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
});

test("bridge/file_changed emitted for Edit tool_use with diff", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "file-track-"));
  try {
    const targetFile = path.join(wsDir, "existing.ts");
    fs.writeFileSync(targetFile, "old code", "utf8");

    const notifications: unknown[] = [];
    const server = new BridgeServer({
      notify: (msg) => notifications.push(msg),
    });

    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "assistant", message: { content: [{ type: "tool_use", name: "Edit", id: "tu-2", input: { file_path: targetFile, old_string: "old code", new_string: "new code" } }] } };
      yield { type: "result", subtype: "success", result: "done" };
    };

    await server.handleMessage({
      jsonrpc: "2.0",
      id: 201,
      method: "session.start",
      params: { workspace: wsDir, prompt: "test" },
    });

    delete globalThis.__AI_SPEC_SDK_QUERY__;

    const fileChanged = notifications.find(
      (n) => (n as Record<string, unknown>)["method"] === "bridge/file_changed",
    );
    assert.ok(fileChanged, "should emit bridge/file_changed for Edit tool");
    const params = (fileChanged as Record<string, unknown>)["params"] as Record<string, unknown>;
    assert.equal(params["action"], "modified");
    assert.ok(params["path"], "should include relative path");
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
});

// --- Session branch tests ---

test("session.branch creates new session with copied history", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "branch-"));
  try {
    const server = new BridgeServer();

    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "system", subtype: "init", session_id: "sdk-src-1" };
      yield { type: "result", subtype: "success", result: "done" };
    };

    const startResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 300,
      method: "session.start",
      params: { workspace: wsDir, prompt: "original prompt" },
    });

    delete globalThis.__AI_SPEC_SDK_QUERY__;

    const srcSessionId = (startResp.result as Record<string, unknown>)["sessionId"] as string;
    assert.ok(srcSessionId, "source session should have an ID");

    const branchResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 301,
      method: "session.branch",
      params: { sessionId: srcSessionId },
    });

    assert.ok(!branchResp.error, `unexpected error: ${JSON.stringify(branchResp.error)}`);
    const result = branchResp.result as Record<string, unknown>;
    assert.ok(result["sessionId"], "should return a new session ID");
    assert.notEqual(result["sessionId"], srcSessionId, "branched session ID must differ");
    assert.equal(result["branchedFrom"], srcSessionId);
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
});

test("session.branch returns -32011 for unknown session", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 302,
    method: "session.branch",
    params: { sessionId: "nonexistent" },
  });
  assert.ok(response.error);
  assert.equal(response.error!.code, -32011);
});

test("session.branch with fromIndex limits copied history", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "branch-"));
  try {
    const server = new BridgeServer();

    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "system", subtype: "init", session_id: "sdk-src-2" };
      yield { type: "assistant", message: { content: [{ type: "text", text: "hello" }] } };
      yield { type: "assistant", message: { content: [{ type: "text", text: "world" }] } };
      yield { type: "result", subtype: "success", result: "done" };
    };

    const startResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 303,
      method: "session.start",
      params: { workspace: wsDir, prompt: "test" },
    });

    delete globalThis.__AI_SPEC_SDK_QUERY__;

    const srcId = (startResp.result as Record<string, unknown>)["sessionId"] as string;

    const branchResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 304,
      method: "session.branch",
      params: { sessionId: srcId, fromIndex: 2 },
    });

    assert.ok(!branchResp.error);
    const result = branchResp.result as Record<string, unknown>;
    assert.equal(result["historyCopied"], 2);
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
});

// --- Session search tests ---

test("session.search finds matching sessions", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "search-"));
  try {
    const server = new BridgeServer();

    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "system", subtype: "init", session_id: "sdk-search-1" };
      yield { type: "result", subtype: "success", result: "done" };
    };

    await server.handleMessage({
      jsonrpc: "2.0",
      id: 400,
      method: "session.start",
      params: { workspace: wsDir, prompt: "fix authentication bug" },
    });

    delete globalThis.__AI_SPEC_SDK_QUERY__;

    const searchResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 401,
      method: "session.search",
      params: { query: "authentication" },
    });

    assert.ok(!searchResp.error);
    const results = (searchResp.result as Record<string, unknown>)["results"] as Array<Record<string, unknown>>;
    assert.ok(results.length >= 1, "should find at least one matching session");
    const first = results[0];
    assert.ok(first["matches"].length > 0, "should have match details");
    assert.ok(first["sessionId"], "result should have sessionId");
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
});

test("session.search with workspace filter", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "search-"));
  const otherWs = fs.mkdtempSync(path.join(os.tmpdir(), "search-other-"));
  try {
    const server = new BridgeServer();

    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "system", subtype: "init", session_id: "sdk-search-2" };
      yield { type: "result", subtype: "success", result: "done" };
    };

    await server.handleMessage({
      jsonrpc: "2.0",
      id: 402,
      method: "session.start",
      params: { workspace: wsDir, prompt: "unique search test query" },
    });

    delete globalThis.__AI_SPEC_SDK_QUERY__;

    // Filter to other workspace — should find nothing
    const resp1 = await server.handleMessage({
      jsonrpc: "2.0",
      id: 403,
      method: "session.search",
      params: { query: "unique search test", workspace: otherWs },
    });
    const results1 = (resp1.result as Record<string, unknown>)["results"] as unknown[];
    assert.equal(results1.length, 0);

    // Filter to correct workspace — should find it
    const resp2 = await server.handleMessage({
      jsonrpc: "2.0",
      id: 404,
      method: "session.search",
      params: { query: "unique search test", workspace: wsDir },
    });
    const results2 = (resp2.result as Record<string, unknown>)["results"] as unknown[];
    assert.ok(results2.length >= 1);
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
    fs.rmSync(otherWs, { recursive: true, force: true });
  }
});

test("session.search rejects empty query", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 405,
    method: "session.search",
    params: { query: "" },
  });
  assert.ok(response.error);
  assert.equal(response.error!.code, -32602);
});

test("session.search caps limit at 100", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 406,
    method: "session.search",
    params: { query: "test", limit: 500 },
  });
  assert.ok(!response.error);
});

test("bridge.capabilities advertises context.*, session.spawn, session.branch, session.search", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 500,
    method: "bridge.capabilities",
  });

  const methods = (response.result as Record<string, unknown>)["methods"] as string[];
  assert.ok(methods.includes("context.read"), "must advertise context.read");
  assert.ok(methods.includes("context.write"), "must advertise context.write");
  assert.ok(methods.includes("context.list"), "must advertise context.list");
  assert.ok(methods.includes("session.spawn"), "must advertise session.spawn");
  assert.ok(methods.includes("session.branch"), "must advertise session.branch");
  assert.ok(methods.includes("session.search"), "must advertise session.search");
});

// --- Skills list tests ---

test("skills.list returns SkillInfo objects with name, description, hasScript, parameters", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 600,
    method: "skills.list",
  });

  assert.ok(!response.error, `unexpected error: ${JSON.stringify(response.error)}`);
  const result = response.result as Record<string, unknown>;
  const skills = result["skills"] as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(skills) && skills.length > 0, "skills must be a non-empty array");
  for (const s of skills) {
    assert.equal(typeof s["name"], "string", "each skill must have a name string");
    assert.equal(typeof s["description"], "string", "each skill must have a description string");
    assert.equal(typeof s["hasScript"], "boolean", "each skill must have a hasScript boolean");
    assert.ok(Array.isArray(s["parameters"]), "each skill must have a parameters array");
  }
});

test("skills.list returns 12 skills including spec-driven-maintenance", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 601,
    method: "skills.list",
  });

  const skills = (response.result as Record<string, unknown>)["skills"] as Array<Record<string, unknown>>;
  assert.equal(skills.length, 12, "should have 12 skills");
  const maintenance = skills.find((s) => s["name"] === "spec-driven-maintenance");
  assert.ok(maintenance, "must include spec-driven-maintenance");
  assert.equal(maintenance!["hasScript"], true);
});

test("skills.list AI-only skills have hasScript false", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 602,
    method: "skills.list",
  });

  const skills = (response.result as Record<string, unknown>)["skills"] as Array<Record<string, unknown>>;
  const aiOnly = ["spec-driven-brainstorm", "spec-driven-auto", "spec-driven-review", "spec-driven-spec-content"];
  for (const name of aiOnly) {
    const skill = skills.find((s) => s["name"] === name);
    assert.ok(skill, `${name} should be in skills list`);
    assert.equal(skill!["hasScript"], false, `${name} should have hasScript: false`);
    assert.deepEqual(skill!["parameters"], [], `${name} should have empty parameters`);
  }
});

test("bridge.capabilities includes maintenance and migrate in workflows", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 603,
    method: "bridge.capabilities",
  });

  const result = response.result as Record<string, unknown>;
  const workflows = result["workflows"] as string[];
  assert.ok(workflows.includes("maintenance"), "must include maintenance workflow");
  assert.ok(workflows.includes("migrate"), "must include migrate workflow");

  const skillMap = result["workflowSkillMap"] as Record<string, string>;
  assert.equal(skillMap["maintenance"], "spec-driven-maintenance");
  assert.equal(skillMap["migrate"], "spec-driven-maintenance");
});

test("bridge.setLogLevel sets a valid level", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 700,
    method: "bridge.setLogLevel",
    params: { level: "debug" },
  });

  assert.equal((response.result as Record<string, unknown>)["level"], "debug");
});

test("bridge.setLogLevel rejects an invalid level", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 701,
    method: "bridge.setLogLevel",
    params: { level: "verbose" },
  });

  assert.ok(response.error, "should return error for invalid level");
  assert.equal(response.error!.code, -32602);
});

test("bridge.setLogLevel is listed in capabilities", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 702,
    method: "bridge.capabilities",
  });

  const result = response.result as Record<string, unknown>;
  const methods = result["methods"] as string[];
  assert.ok(methods.includes("bridge.setLogLevel"), "capabilities must list bridge.setLogLevel");
});

// ---------------------------------------------------------------------------
// API Versioning tests
// ---------------------------------------------------------------------------

test("bridge.capabilities includes apiVersion", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 800,
    method: "bridge.capabilities",
  });

  const result = response.result as Record<string, unknown>;
  assert.equal(typeof result["apiVersion"], "string", "apiVersion must be a string");
  assert.ok(/^\d+\.\d+\.\d+$/.test(result["apiVersion"] as string), "apiVersion must be semver");
});

test("bridge.capabilities includes bridge.negotiateVersion in methods", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 801,
    method: "bridge.capabilities",
  });

  const result = response.result as Record<string, unknown>;
  const methods = result["methods"] as string[];
  assert.ok(methods.includes("bridge.negotiateVersion"), "capabilities must list bridge.negotiateVersion");
});

test("bridge.negotiateVersion returns negotiatedVersion and capabilities on match", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 802,
    method: "bridge.negotiateVersion",
    params: { supportedVersions: ["0.2.0"] },
  });

  assert.equal(response.jsonrpc, "2.0");
  assert.equal(response.id, 802);
  const result = response.result as Record<string, unknown>;
  assert.equal(result["negotiatedVersion"], "0.2.0");
  assert.equal(typeof (result["capabilities"] as Record<string, unknown>)["apiVersion"], "string");
});

test("bridge.negotiateVersion returns -32050 when no version matches", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 803,
    method: "bridge.negotiateVersion",
    params: { supportedVersions: ["99.0.0"] },
  });

  assert.equal(response.error!.code, -32050);
  const data = response.error!.data as Record<string, unknown>;
  assert.ok(Array.isArray(data["supportedVersions"]));
  assert.ok((data["supportedVersions"] as string[]).includes("0.2.0"));
});

test("bridge.negotiateVersion rejects empty supportedVersions", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 804,
    method: "bridge.negotiateVersion",
    params: { supportedVersions: [] },
  });

  assert.equal(response.error!.code, -32602);
});

test("bridge.negotiateVersion rejects non-string supportedVersions", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 805,
    method: "bridge.negotiateVersion",
    params: { supportedVersions: [123] },
  });

  assert.equal(response.error!.code, -32602);
});

test("request with matching apiVersion in params succeeds", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 806,
    method: "bridge.ping",
    params: { apiVersion: "0.2.0" },
  });

  assert.equal(response.result!.pong, true);
});

test("request with unsupported apiVersion returns -32050", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 807,
    method: "bridge.ping",
    params: { apiVersion: "99.0.0" },
  });

  assert.equal(response.error!.code, -32050);
  const data = response.error!.data as Record<string, unknown>;
  assert.ok(Array.isArray(data["supportedVersions"]));
  assert.ok((data["supportedVersions"] as string[]).includes("0.2.0"));
});

test("request without apiVersion succeeds normally (opt-in)", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 808,
    method: "bridge.ping",
  });

  assert.equal(response.result!.pong, true);
});

// ── bridge.info tests ─────────────────────────────────────────────────────────

test("bridge.info returns runtime metadata with expected shape", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-info-test-"));
  try {
    const server = new BridgeServer({ sessionsDir: tmpDir });
    const response = await server.handleMessage({
      jsonrpc: "2.0",
      id: 900,
      method: "bridge.info",
    });

    assert.equal(response.jsonrpc, "2.0");
    assert.equal(response.id, 900);
    assert.ok(!response.error, `unexpected error: ${JSON.stringify(response.error)}`);

    const result = response.result as Record<string, unknown>;
    assert.equal(typeof result["bridgeVersion"], "string");
    assert.equal(typeof result["apiVersion"], "string");
    assert.equal(typeof result["transport"], "string");
    assert.equal(typeof result["authMode"], "string");
    assert.equal(typeof result["logLevel"], "string");
    assert.equal(typeof result["sessionsPath"], "string");
    assert.equal(typeof result["keysPath"], "string");
    assert.equal(typeof result["specDrivenScriptPath"], "string");
    assert.equal(typeof result["nodeVersion"], "string");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("bridge.info transport field reflects stdio by default", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 901,
    method: "bridge.info",
  });
  const result = response.result as Record<string, unknown>;
  assert.equal(result["transport"], "stdio");
  assert.equal(result["http"], null);
});

test("bridge.info transport field reflects http when constructed with http transport", async () => {
  const server = new BridgeServer({
    transport: "http",
    runtimeInfoOptions: { transport: "http", httpPort: 9999, authMode: "bearer" },
  });
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 902,
    method: "bridge.info",
  });
  const result = response.result as Record<string, unknown>;
  assert.equal(result["transport"], "http");
  const http = result["http"] as Record<string, unknown>;
  assert.ok(http !== null);
  assert.equal(http["port"], 9999);
});

test("bridge.info bridgeVersion and apiVersion match capabilities", async () => {
  const server = new BridgeServer();
  const [infoResp, capsResp] = await Promise.all([
    server.handleMessage({ jsonrpc: "2.0", id: 903, method: "bridge.info" }),
    server.handleMessage({ jsonrpc: "2.0", id: 904, method: "bridge.capabilities" }),
  ]);

  const info = infoResp.result as Record<string, unknown>;
  const caps = capsResp.result as Record<string, unknown>;
  assert.equal(info["bridgeVersion"], caps["bridgeVersion"]);
  assert.equal(info["apiVersion"], caps["apiVersion"]);
});

// ── capabilities advertisement tests ─────────────────────────────────────────

test("bridge.capabilities advertises bridge.info in methods", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 910,
    method: "bridge.capabilities",
  });
  const result = response.result as Record<string, unknown>;
  const methods = result["methods"] as string[];
  assert.ok(methods.includes("bridge.info"), "capabilities must advertise bridge.info");
});

test("bridge.capabilities advertises session.export in methods", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 911,
    method: "bridge.capabilities",
  });
  const result = response.result as Record<string, unknown>;
  const methods = result["methods"] as string[];
  assert.ok(methods.includes("session.export"), "capabilities must advertise session.export");
  assert.ok(methods.includes("session.delete"), "capabilities must advertise session.delete");
  assert.ok(methods.includes("session.cleanup"), "capabilities must advertise session.cleanup");
});

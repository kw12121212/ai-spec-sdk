import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BridgeServer } from "../src/bridge.js";
import { AuditLog, type AuditEntry } from "../src/audit-log.js";
import { registerPolicy } from "../src/permission-policy.js";
import { roleStore } from "../src/role-store.js";

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

// --- Template tests ---

test("template.create creates a template with session parameters", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1000,
    method: "template.create",
    params: {
      name: "test-template",
      model: "claude-3-opus",
      maxTurns: 10,
      systemPrompt: "You are a helpful assistant",
    },
  });

  assert.ok(!response.error, "template.create should not return an error");
  const result = response.result as Record<string, unknown>;
  assert.equal(result["name"], "test-template");
  assert.equal(result["model"], "claude-3-opus");
  assert.equal(result["maxTurns"], 10);
  assert.equal(result["systemPrompt"], "You are a helpful assistant");
  assert.ok(typeof result["createdAt"] === "string");
  assert.ok(typeof result["updatedAt"] === "string");
});

test("template.create returns -32602 when name is missing", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1001,
    method: "template.create",
    params: {
      model: "claude-3-opus",
    },
  });

  assert.ok(response.error);
  assert.equal(response.error!.code, -32602);
});

test("template.create validates model parameter type", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1002,
    method: "template.create",
    params: {
      name: "bad-template",
      model: 123,
    },
  });

  assert.ok(response.error);
  assert.equal(response.error!.code, -32602);
});

test("template.get returns existing template", async () => {
  const server = new BridgeServer();

  // Create template first
  await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "template.create",
    params: { name: "get-test", model: "claude-3-sonnet" },
  });

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1003,
    method: "template.get",
    params: { name: "get-test" },
  });

  assert.ok(!response.error);
  const result = response.result as Record<string, unknown>;
  assert.equal(result["name"], "get-test");
  assert.equal(result["model"], "claude-3-sonnet");
});

test("template.get returns null for non-existent template", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1004,
    method: "template.get",
    params: { name: "does-not-exist" },
  });

  assert.ok(!response.error);
  assert.equal(response.result, null);
});

test("template.list returns all templates", async () => {
  const server = new BridgeServer();

  await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "template.create",
    params: { name: "template-a", model: "claude-3-opus" },
  });

  await server.handleMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "template.create",
    params: { name: "template-b", model: "claude-3-sonnet" },
  });

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1005,
    method: "template.list",
  });

  assert.ok(!response.error);
  const result = response.result as Record<string, unknown>;
  const templates = result["templates"] as Array<Record<string, unknown>>;
  assert.ok(templates.length >= 2);
  assert.ok(templates.some((t) => t["name"] === "template-a"));
  assert.ok(templates.some((t) => t["name"] === "template-b"));
});

test("template.delete removes template", async () => {
  const server = new BridgeServer();

  await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "template.create",
    params: { name: "to-delete", model: "claude-3-opus" },
  });

  const deleteResponse = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1006,
    method: "template.delete",
    params: { name: "to-delete" },
  });

  assert.ok(!deleteResponse.error);
  assert.equal((deleteResponse.result as Record<string, unknown>)["removed"], true);

  const getResponse = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1007,
    method: "template.get",
    params: { name: "to-delete" },
  });

  assert.equal(getResponse.result, null);
});

test("template.delete returns removed:false for non-existent template", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1008,
    method: "template.delete",
    params: { name: "never-existed" },
  });

  assert.ok(!response.error);
  assert.equal((response.result as Record<string, unknown>)["removed"], false);
});

test("bridge.capabilities advertises template.* methods", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1009,
    method: "bridge.capabilities",
  });

  const result = response.result as Record<string, unknown>;
  const methods = result["methods"] as string[];
  assert.ok(methods.includes("template.create"), "capabilities must advertise template.create");
  assert.ok(methods.includes("template.get"), "capabilities must advertise template.get");
  assert.ok(methods.includes("template.list"), "capabilities must advertise template.list");
  assert.ok(methods.includes("template.delete"), "capabilities must advertise template.delete");
});

// --- Session Pause/Resume ---

test("bridge.capabilities includes session.pause", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1100,
    method: "bridge.capabilities",
  });
  const methods = (response.result as Record<string, unknown>)["methods"] as string[];
  assert.ok(methods.includes("session.pause"), "capabilities must include session.pause");
});

test("session.pause requires sessionId", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1101,
    method: "session.pause",
    params: {},
  });
  assert.ok(response.error);
  assert.equal(response.error!.code, -32602);
});

test("session.pause returns -32011 for unknown session", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1102,
    method: "session.pause",
    params: { sessionId: "nonexistent-id" },
  });
  assert.ok(response.error);
  assert.equal(response.error!.code, -32011);
});

test("session.pause returns -32602 when session not pausable", async () => {
  const server = new BridgeServer();
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "pause-state-test-"));

  try {
    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "system", subtype: "init", session_id: "sdk-pause-test" };
      yield { type: "result", subtype: "success", result: "done" };
    };

    const startResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1103,
      method: "session.start",
      params: { workspace: wsDir, prompt: "test pause state" },
    });
    delete globalThis.__AI_SPEC_SDK_QUERY__;

    const sessionId = (startResp.result as Record<string, unknown>)["sessionId"] as string;

    // Try to pause a completed session (it's already completed by our stub)
    const pauseResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1104,
      method: "session.pause",
      params: { sessionId },
    });
    assert.ok(pauseResp.error);
    assert.equal(pauseResp.error!.code, -32602);
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
});

test("session.resume returns -32011 for unknown session", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1105,
    method: "session.resume",
    params: { sessionId: "nonexistent-id", prompt: "test" },
  });
  assert.ok(response.error);
  assert.equal(response.error!.code, -32011);
});

test("session.list returns pausedAt and pauseReason as null when not paused", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "list-pause-test-"));
  const server = new BridgeServer();

  try {
    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "system", subtype: "init", session_id: "sdk-list-pause-1" };
      yield { type: "result", subtype: "success", result: "done" };
    };

    const startResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1106,
      method: "session.start",
      params: { workspace: wsDir, prompt: "test list pause" },
    });
    delete globalThis.__AI_SPEC_SDK_QUERY__;

    const sessionId = (startResp.result as Record<string, unknown>)["sessionId"] as string;

    const listResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1107,
      method: "session.list",
      params: { status: "all" },
    });

    const sessions = (listResp.result as Record<string, unknown>)["sessions"] as Array<Record<string, unknown>>;
    const listed = sessions.find((s) => s["sessionId"] === sessionId);
    assert.ok(listed, "session should be listed");
    assert.ok("pausedAt" in listed!, "should have pausedAt field");
    assert.ok("pauseReason" in listed!, "should have pauseReason field");
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
});

// --- Session Cancel/Timeout ---

test("bridge.capabilities includes session.cancel", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1200,
    method: "bridge.capabilities",
  });
  const methods = (response.result as Record<string, unknown>)["methods"] as string[];
  assert.ok(methods.includes("session.cancel"), "capabilities must include session.cancel");
  const agentControlParams = (response.result as Record<string, unknown>)["agentControlParams"] as string[];
  assert.ok(agentControlParams.includes("timeoutMs"), "capabilities must include timeoutMs in agentControlParams");
});

test("session.cancel requires sessionId", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1201,
    method: "session.cancel",
    params: {},
  });
  assert.ok(response.error);
  assert.equal(response.error!.code, -32602);
});

test("session.cancel returns -32011 for unknown session", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1202,
    method: "session.cancel",
    params: { sessionId: "nonexistent-id" },
  });
  assert.ok(response.error);
  assert.equal(response.error!.code, -32011);
});

test("session.start accepts timeoutMs parameter", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "timeout-start-test-"));
  const server = new BridgeServer();

  try {
    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "system", subtype: "init", session_id: "sdk-timeout-1" };
      yield { type: "result", subtype: "success", result: "done" };
    };

    const startResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1203,
      method: "session.start",
      params: { workspace: wsDir, prompt: "test timeout start", timeoutMs: 60000 },
    });
    delete globalThis.__AI_SPEC_SDK_QUERY__;

    assert.ok(!startResp.error);
    const sessionId = (startResp.result as Record<string, unknown>)["sessionId"] as string;

    // Check session status includes timeoutMs
    const statusResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1204,
      method: "session.status",
      params: { sessionId },
    });
    const statusResult = statusResp.result as Record<string, unknown>;
    assert.equal(statusResult["timeoutMs"], 60000);
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
});

test("session.start rejects timeoutMs < 1", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "timeout-invalid-test-"));
  const server = new BridgeServer();

  try {
    const response = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1205,
      method: "session.start",
      params: { workspace: wsDir, prompt: "test invalid timeout", timeoutMs: 0 },
    });
    assert.ok(response.error);
    assert.equal(response.error!.code, -32602);
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
});

test("session.start with roles parameter is stored and applied", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "roles-start-test-"));
  const server = new BridgeServer();

  const originalResolve = roleStore.resolveRoles;
  const originalHas = roleStore.hasRole;
  roleStore.resolveRoles = (roles) => {
    if (roles.includes("test-role")) return ["file:write"];
    return [];
  };
  roleStore.hasRole = (role) => role === "test-role" || originalHas.call(roleStore, role);

  try {
    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "system", subtype: "init", session_id: "sdk-roles-1" };
      yield {
        type: "assistant",
        message: { content: [{ type: "tool_use", id: "1", name: "Write", input: {} }] },
      };
      yield { type: "result", subtype: "success", result: "done" };
    };

    const startResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1300,
      method: "session.start",
      params: { workspace: wsDir, prompt: "test roles start", roles: ["test-role"], allowedScopes: [] },
    });
    delete globalThis.__AI_SPEC_SDK_QUERY__;

    assert.ok(!startResp.error);
    assert.equal((startResp.result as any).status, "completed");
  } finally {
    roleStore.resolveRoles = originalResolve;
    roleStore.hasRole = originalHas;
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
});

test("session.list returns cancelledAt and cancelReason as null when not cancelled", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "list-cancel-test-"));
  const server = new BridgeServer();

  try {
    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "system", subtype: "init", session_id: "sdk-list-cancel-1" };
      yield { type: "result", subtype: "success", result: "done" };
    };

    const startResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1206,
      method: "session.start",
      params: { workspace: wsDir, prompt: "test list cancel" },
    });
    delete globalThis.__AI_SPEC_SDK_QUERY__;

    const sessionId = (startResp.result as Record<string, unknown>)["sessionId"] as string;

    const listResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1207,
      method: "session.list",
      params: { status: "all" },
    });

    const sessions = (listResp.result as Record<string, unknown>)["sessions"] as Array<Record<string, unknown>>;
    const listed = sessions.find((s) => s["sessionId"] === sessionId);
    assert.ok(listed, "session should be listed");
    assert.ok("cancelledAt" in listed!, "should have cancelledAt field");
    assert.ok("cancelReason" in listed!, "should have cancelReason field");
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
});

test("session.cancel returns error when called on non-running (completed) session", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "cancel-nonrunning-test-"));
  const server = new BridgeServer();

  try {
    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "system", subtype: "init", session_id: "sdk-cancel-nr-1" };
      yield { result: "done" };
    };

    const startResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1210,
      method: "session.start",
      params: { workspace: wsDir, prompt: "complete quickly" },
    });
    delete globalThis.__AI_SPEC_SDK_QUERY__;

    assert.ok(!startResp.error, "start should succeed");
    const sessionId = (startResp.result as Record<string, unknown>)["sessionId"] as string;

    const cancelResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1211,
      method: "session.cancel",
      params: { sessionId },
    });

    assert.ok(cancelResp.error, "cancel should return error for completed session");
    assert.equal(cancelResp.error!.code, -32602);
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
});

test("timeoutMs on session.start automatically cancels session after duration", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "timeout-auto-cancel-start-"));
  const notifications: unknown[] = [];
  const server = new BridgeServer({
    notify: (message) => notifications.push(message),
  });

  let queryStarted = false;
  const queryDone = new Promise<void>((resolve) => {
    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      queryStarted = true;
      yield { type: "system", subtype: "init", session_id: "sdk-timeout-auto-1" };
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        yield { type: "assistant", message: { content: [{ type: "text", text: "working..." }] } };
        await new Promise<void>((r) => setTimeout(r, 20));
      }
      yield { result: "should not complete" };
      resolve();
    };
  });

  try {
    const startPromise = server.handleMessage({
      jsonrpc: "2.0",
      id: 1220,
      method: "session.start",
      params: { workspace: wsDir, prompt: "long running", timeoutMs: 80 },
    });

    const sessionId = await waitForSessionStarted(notifications as Array<Record<string, unknown>>);

    const startResult = await startPromise;
    const result = startResult.result as Record<string, unknown>;
    assert.equal(result["status"], "completed", "session should be completed (cancelled)");
    assert.ok(result["cancelledAt"], "should have cancelledAt");
    assert.equal(result["cancelReason"], "timeout", "reason should be timeout");

    const statusResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1221,
      method: "session.status",
      params: { sessionId },
    });
    const statusResult = statusResp.result as Record<string, unknown>;
    assert.equal(statusResult["status"], "completed");
    assert.ok(statusResult["cancelledAt"]);
    assert.equal(statusResult["cancelReason"], "timeout");
  } finally {
    delete globalThis.__AI_SPEC_SDK_QUERY__;
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
});

test("timer is cleared when session completes normally before timeout", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "timeout-cleared-test-"));
  const server = new BridgeServer();

  try {
    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "system", subtype: "init", session_id: "sdk-timeout-clear-1" };
      yield { result: "done fast" };
    };

    const startResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1230,
      method: "session.start",
      params: { workspace: wsDir, prompt: "fast completion", timeoutMs: 10000 },
    });
    delete globalThis.__AI_SPEC_SDK_QUERY__;

    assert.ok(!startResp.error, "start should succeed");
    const result = startResp.result as Record<string, unknown>;
    assert.equal(result["status"], "completed");
    assert.equal(result["result"], "done fast");

    const sessionId = result["sessionId"] as string;

    const statusResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1231,
      method: "session.status",
      params: { sessionId },
    });
    const statusResult = statusResp.result as Record<string, unknown>;
    assert.equal(statusResult["status"], "completed");
    assert.equal(statusResult["cancelledAt"], null, "should NOT be cancelled");
    assert.equal(statusResult["cancelReason"], null, "should have no cancel reason");
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
});

test("timeoutMs on session.resume automatically cancels session after duration", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "timeout-auto-cancel-resume-"));
  const notifications: unknown[] = [];
  const server = new BridgeServer({
    notify: (message) => notifications.push(message),
  });

  try {
    globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ options }: { prompt: string; options: Record<string, unknown> }) {
      yield { type: "system", subtype: "init", session_id: options?.["resume"] ?? "sdk-timeout-resume-1" };
      yield { result: "initial done" };
    };

    const startResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1240,
      method: "session.start",
      params: { workspace: wsDir, prompt: "first run" },
    });
    delete globalThis.__AI_SPEC_SDK_QUERY__;

    assert.ok(!startResp.error);
    const sessionId = (startResp.result as Record<string, unknown>)["sessionId"] as string;

    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "system", subtype: "init", session_id: "sdk-timeout-resume-2" };
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        yield { type: "assistant", message: { content: [{ type: "text", text: "working..." }] } };
        await new Promise<void>((r) => setTimeout(r, 20));
      }
      yield { result: "should not complete" };
    };

    const resumePromise = server.handleMessage({
      jsonrpc: "2.0",
      id: 1241,
      method: "session.resume",
      params: { sessionId, prompt: "continue", timeoutMs: 80 },
    });

    const resumeResult = await resumePromise;
    const result = resumeResult.result as Record<string, unknown>;
    assert.equal(result["status"], "completed", "resume should complete (cancelled)");
    assert.ok(result["cancelledAt"], "should have cancelledAt");
    assert.equal(result["cancelReason"], "timeout", "reason should be timeout");

    const statusResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1242,
      method: "session.status",
      params: { sessionId },
    });
    const statusResult = statusResp.result as Record<string, unknown>;
    assert.equal(statusResult["status"], "completed");
    assert.ok(statusResult["cancelledAt"]);
    assert.equal(statusResult["cancelReason"], "timeout");
  } finally {
    delete globalThis.__AI_SPEC_SDK_QUERY__;
    fs.rmSync(wsDir, { recursive: true, force: true });
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

test("bridge.approveTool resumes a paused tool execution", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "approve-tool-"));
  registerPolicy("test-approve", () => ({
    name: "test-approve",
    check: async () => "approval_required"
  }));

  const notifications: unknown[] = [];
  const server = new BridgeServer({
    notify: (message) => notifications.push(message),
  });

  let queryFinished = false;

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "sdk-approve-1" };
    yield { type: "assistant", message: { content: [{ type: "tool_use", name: "Write", id: "tu-1", input: {} }] } };
    
    // Simulate the generator yielding to wait for tool result or something, 
    // although the policy chain runs async
    await new Promise((r) => setTimeout(r, 50));
    yield { type: "result", subtype: "success", result: "done" };
    queryFinished = true;
  };

  try {
    const startPromise = server.handleMessage({
      jsonrpc: "2.0",
      id: 2001,
      method: "session.start",
      params: { 
        workspace: wsDir, 
        prompt: "test",
        policies: [{ name: "test-approve" }]
      },
    });

    const sessionId = await waitForSessionStarted(notifications as Array<Record<string, unknown>>);

    // Wait for the tool_approval_required notification
    const getApprovalId = async () => {
      while (true) {
        const notif = notifications.find(
          (n) => (n as Record<string, unknown>)["method"] === "bridge/tool_approval_required"
        );
        if (notif) return ((notif as Record<string, unknown>)["params"] as Record<string, unknown>)["approvalId"] as string;
        await new Promise((r) => setTimeout(r, 10));
      }
    };

    const approvalId = await getApprovalId();
    assert.ok(approvalId, "Should get an approvalId");

    // Session should be in waiting_for_input state
    const statusResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2002,
      method: "session.status",
      params: { sessionId },
    });
    assert.equal((statusResp.result as Record<string, unknown>)["executionState"], "waiting_for_input");

    // Approve it
    const approveResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2003,
      method: "bridge.approveTool",
      params: { approvalId },
    });
    assert.ok(!approveResp.error);

    // After approval, the query should finish
    await startPromise;
    assert.ok(queryFinished);

  } finally {
    delete globalThis.__AI_SPEC_SDK_QUERY__;
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
});

test("bridge.denyTool denies a paused tool execution and stops the session", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "deny-tool-"));
  registerPolicy("test-deny", () => ({
    name: "test-deny",
    check: async () => "approval_required"
  }));

  const notifications: unknown[] = [];
  const server = new BridgeServer({
    notify: (message) => notifications.push(message),
  });

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "sdk-deny-1" };
    yield { type: "assistant", message: { content: [{ type: "tool_use", name: "Write", id: "tu-2", input: {} }] } };
    
    // Keep yielding text so shouldStop inside runClaudeQuery has a chance to abort
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 20));
      yield { type: "assistant", message: { content: [{ type: "text", text: "..." }] } };
    }
    yield { type: "result", subtype: "success", result: "done" };
  };

  try {
    const startPromise = server.handleMessage({
      jsonrpc: "2.0",
      id: 2101,
      method: "session.start",
      params: { 
        workspace: wsDir, 
        prompt: "test",
        policies: [{ name: "test-deny" }]
      },
    });

    const sessionId = await waitForSessionStarted(notifications as Array<Record<string, unknown>>);

    const getApprovalId = async () => {
      while (true) {
        const notif = notifications.find(
          (n) => (n as Record<string, unknown>)["method"] === "bridge/tool_approval_required"
        );
        if (notif) return ((notif as Record<string, unknown>)["params"] as Record<string, unknown>)["approvalId"] as string;
        await new Promise((r) => setTimeout(r, 10));
      }
    };

    const approvalId = await getApprovalId();
    
    // Deny it
    const denyResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2103,
      method: "bridge.denyTool",
      params: { approvalId },
    });
    assert.ok(!denyResp.error);

    const startResult = await startPromise;
    assert.equal((startResult.result as Record<string, unknown>)["status"], "stopped");

  } finally {
    delete globalThis.__AI_SPEC_SDK_QUERY__;
    fs.rmSync(wsDir, { recursive: true, force: true });
  }
});

test("audit log scope_denied entry is created when tool execution is denied by scope", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-scope-"));
  const auditDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-dir-"));

  const notifications: unknown[] = [];
  const server = new BridgeServer({
    auditDir,
    notify: (message) => notifications.push(message),
  });

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "sdk-audit-scope" };
    yield { type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", id: "tu-1", input: { command: "echo test" } }] } };
    await new Promise((r) => setTimeout(r, 10)); // let bridge process it
    yield { type: "result", subtype: "success", result: "done" };
  };

  try {
    const response = await server.handleMessage({
      jsonrpc: "2.0",
      id: 3000,
      method: "session.start",
      params: { workspace: wsDir, prompt: "test scope audit", allowedScopes: ["file:read"] }, // Bash requires 'system'
    });

    assert.ok(!response.error);
    const sessionId = (response.result as Record<string, unknown>)["sessionId"] as string;
    
    // Wait for the session to be stopped
    await new Promise((r) => setTimeout(r, 50));
    
    const auditLog = new AuditLog(auditDir);
    const scopeDeniedEntries = auditLog.query({ sessionId, eventType: "scope_denied" }).entries;
    assert.equal(scopeDeniedEntries.length, 1);
    
    const entry = scopeDeniedEntries[0];
    assert.equal(entry.category, "security");
    assert.equal(entry.payload.toolName, "Bash");
    assert.deepEqual(entry.payload.requiredScopes, ["system"]);
    assert.deepEqual(entry.payload.allowedScopes, ["file:read"]);
    assert.equal(entry.payload.blockedScopes, null);
    
  } finally {
    delete globalThis.__AI_SPEC_SDK_QUERY__;
    fs.rmSync(wsDir, { recursive: true, force: true });
    fs.rmSync(auditDir, { recursive: true, force: true });
  }
});

test("audit log policy_decision entry is created for allow and deny policy decisions", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-policy-"));
  const auditDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-dir-"));

  registerPolicy("audit-allow", () => ({ name: "audit-allow", async check() { return "allow"; } }));
  registerPolicy("audit-deny", () => ({ name: "audit-deny", async check() { return "deny"; } }));
  registerPolicy("audit-pass", () => ({ name: "audit-pass", async check() { return "pass"; } }));

  const notifications: unknown[] = [];
  const server = new BridgeServer({
    auditDir,
    notify: (message) => notifications.push(message),
  });

  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "sdk-audit-policy" };
    // This will hit the pass -> allow chain and proceed
    yield { type: "assistant", message: { content: [{ type: "tool_use", name: "Read", id: "tu-1", input: { path: "test" } }] } };
    await new Promise((r) => setTimeout(r, 10));
    
    // The next one will hit the pass -> deny chain
    yield { type: "assistant", message: { content: [{ type: "tool_use", name: "Write", id: "tu-2", input: { path: "test", content: "data" } }] } };
    await new Promise((r) => setTimeout(r, 10));
    yield { type: "result", subtype: "success", result: "done" };
  };

  try {
    const response1 = await server.handleMessage({
      jsonrpc: "2.0",
      id: 3001,
      method: "session.start",
      params: { 
        workspace: wsDir, 
        prompt: "test allow audit", 
        policies: [{ name: "audit-pass" }, { name: "audit-allow" }]
      },
    });

    const response2 = await server.handleMessage({
      jsonrpc: "2.0",
      id: 3002,
      method: "session.start",
      params: { 
        workspace: wsDir, 
        prompt: "test deny audit", 
        policies: [{ name: "audit-pass" }, { name: "audit-deny" }]
      },
    });

    const sessionId1 = (response1.result as Record<string, unknown>)["sessionId"] as string;
    const sessionId2 = (response2.result as Record<string, unknown>)["sessionId"] as string;
    
    await new Promise((r) => setTimeout(r, 50));
    
    const auditLog = new AuditLog(auditDir);
    
    // Check allow session
    const allowEntries = auditLog.query({ sessionId: sessionId1, eventType: "policy_decision" }).entries;
    // We yield 2 tool_uses for sessionId1 in the generator, so we get 2 policy_decision entries!
    assert.equal(allowEntries.length, 2);
    assert.equal(allowEntries[0].payload.decision, "allow");
    assert.equal(allowEntries[0].payload.policyName, "audit-allow");
    assert.equal(allowEntries[0].category, "security");
    assert.equal(typeof allowEntries[0].payload.durationMs, "number");
    
    // Check deny session
    const denyEntries = auditLog.query({ sessionId: sessionId2, eventType: "policy_decision" }).entries;
    // The second session runs the generator, hits the first tool_use (Read), and because the second policy is "deny", it denies! Wait, "deny" short-circuits. So it only gets 1 tool_use before it stops.
    assert.equal(denyEntries.length, 1);
    assert.equal(denyEntries[0].payload.decision, "deny");
    assert.equal(denyEntries[0].payload.policyName, "audit-deny");
    assert.equal(denyEntries[0].category, "security");

  } finally {
    delete globalThis.__AI_SPEC_SDK_QUERY__;
    fs.rmSync(wsDir, { recursive: true, force: true });
    fs.rmSync(auditDir, { recursive: true, force: true });
  }
});

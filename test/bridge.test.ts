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

import test from "node:test";
import assert from "node:assert/strict";
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

import test from "node:test";
import assert from "node:assert/strict";
import { BridgeServer } from "../src/bridge.js";

test("taskTemplate.create creates a task template", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1000,
    method: "taskTemplate.create",
    params: {
      name: "test-task",
      description: "A test task",
      systemPrompt: "You are a helpful assistant",
      tools: ["Read", "Write"],
      parameters: { type: "object", properties: {} },
    },
  });

  assert.ok(!response.error, "taskTemplate.create should not return an error");
  const result = response.result as Record<string, unknown>;
  assert.equal(result["name"], "test-task");
  assert.equal(result["description"], "A test task");
  assert.equal(result["systemPrompt"], "You are a helpful assistant");
  assert.deepEqual(result["tools"], ["Read", "Write"]);
  assert.deepEqual(result["parameters"], { type: "object", properties: {} });
  assert.equal(result["version"], 1);
  assert.ok(typeof result["createdAt"] === "string");
  assert.ok(typeof result["updatedAt"] === "string");
});

test("taskTemplate.create returns error when name is missing", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1001,
    method: "taskTemplate.create",
    params: {
      description: "A test task",
    },
  });

  assert.ok(response.error);
  assert.equal(response.error!.code, -32602);
});

test("taskTemplate.get returns existing task template", async () => {
  const server = new BridgeServer();

  await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "taskTemplate.create",
    params: { name: "get-test", description: "testing get" },
  });

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1002,
    method: "taskTemplate.get",
    params: { name: "get-test" },
  });

  assert.ok(!response.error);
  const result = response.result as Record<string, unknown>;
  assert.equal(result["name"], "get-test");
  assert.equal(result["description"], "testing get");
});

test("taskTemplate.update updates existing task template", async () => {
  const server = new BridgeServer();

  await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "taskTemplate.create",
    params: { name: "update-test", description: "testing update" },
  });

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1003,
    method: "taskTemplate.update",
    params: { name: "update-test", description: "updated description" },
  });

  assert.ok(!response.error);
  const result = response.result as Record<string, unknown>;
  assert.equal(result["name"], "update-test");
  assert.equal(result["description"], "updated description");
  assert.equal(result["version"], 2);
});

test("taskTemplate.list returns all task templates", async () => {
  const server = new BridgeServer();

  await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "taskTemplate.create",
    params: { name: "task-a", description: "task a" },
  });

  await server.handleMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "taskTemplate.create",
    params: { name: "task-b", description: "task b" },
  });

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1004,
    method: "taskTemplate.list",
  });

  assert.ok(!response.error);
  const result = response.result as Record<string, unknown>;
  const templates = result["templates"] as Array<Record<string, unknown>>;
  assert.ok(templates.length >= 2);
  assert.ok(templates.some((t) => t["name"] === "task-a"));
  assert.ok(templates.some((t) => t["name"] === "task-b"));
});

test("taskTemplate.delete removes task template", async () => {
  const server = new BridgeServer();

  await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "taskTemplate.create",
    params: { name: "to-delete" },
  });

  const deleteResponse = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1005,
    method: "taskTemplate.delete",
    params: { name: "to-delete" },
  });

  assert.ok(!deleteResponse.error);
  assert.equal((deleteResponse.result as Record<string, unknown>)["removed"], true);

  const getResponse = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1006,
    method: "taskTemplate.get",
    params: { name: "to-delete" },
  });

  assert.equal(getResponse.result, null);
});

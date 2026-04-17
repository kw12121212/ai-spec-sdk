import { test, expect } from "bun:test";
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

  expect(!response.error, "taskTemplate.create should not return an error").toBeTruthy();
  const result = response.result as Record<string, unknown>;
  expect(result["name"]).toBe("test-task");
  expect(result["description"]).toBe("A test task");
  expect(result["systemPrompt"]).toBe("You are a helpful assistant");
  expect(result["tools"]).toEqual(["Read", "Write"]);
  expect(result["parameters"]).toEqual({ type: "object", properties: {} });
  expect(result["version"]).toBe(1);
  expect(typeof result["createdAt"] === "string").toBeTruthy();
  expect(typeof result["updatedAt"] === "string").toBeTruthy();
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

  expect(response.error).toBeTruthy();
  expect(response.error!.code).toBe(-32602);
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

  expect(!response.error).toBeTruthy();
  const result = response.result as Record<string, unknown>;
  expect(result["name"]).toBe("get-test");
  expect(result["description"]).toBe("testing get");
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

  expect(!response.error).toBeTruthy();
  const result = response.result as Record<string, unknown>;
  expect(result["name"]).toBe("update-test");
  expect(result["description"]).toBe("updated description");
  expect(result["version"]).toBe(2);
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

  expect(!response.error).toBeTruthy();
  const result = response.result as Record<string, unknown>;
  const templates = result["templates"] as Array<Record<string, unknown>>;
  expect(templates.length >= 2).toBeTruthy();
  expect(templates.some((t) => t["name"] === "task-a")).toBeTruthy();
  expect(templates.some((t) => t["name"] === "task-b")).toBeTruthy();
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

  expect(!deleteResponse.error).toBeTruthy();
  expect((deleteResponse.result as Record<string, unknown>)["removed"]).toBe(true);

  const getResponse = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1006,
    method: "taskTemplate.get",
    params: { name: "to-delete" },
  });

  expect(getResponse.result).toBeNull();
});

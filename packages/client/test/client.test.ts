import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import type { Transport } from "../src/transport.js";
import type { JsonRpcNotification } from "../src/types.js";
import { BridgeClient } from "../src/client.js";
import { BridgeClientError } from "../src/errors.js";

function createMockTransport(): Transport {
  let handler: ((n: JsonRpcNotification) => void) | null = null;
  let closed = false;

  return {
    request: mock(async (method: string, params?: unknown): Promise<unknown> => {
      if (closed) throw new BridgeClientError(-32603, "Transport is closed");
      return { method, params };
    }),
    onNotification(h: (n: JsonRpcNotification) => void): void {
      handler = h;
    },
    close(): void {
      closed = true;
    },
    get isClosed(): boolean {
      return closed;
    },
    // Test helper: simulate an incoming notification
    _notify(n: JsonRpcNotification): void {
      handler?.(n);
    },
  } as unknown as Transport & { _notify: (n: JsonRpcNotification) => void };
}

describe("BridgeClient", () => {
  let transport: ReturnType<typeof createMockTransport>;
  let client: BridgeClient;

  beforeEach(() => {
    transport = createMockTransport();
    client = new BridgeClient(transport);
  });

  afterEach(() => {
    client.close();
  });

  test("capabilities() sends correct method", async () => {
    const result = await client.capabilities();
    expect((result as { method: string }).method).toBe("bridge.capabilities");
  });

  test("ping() sends correct method", async () => {
    const result = await client.ping();
    expect((result as { method: string }).method).toBe("bridge.ping");
  });

  test("sessionStart() sends correct method and params", async () => {
    const params = { workspace: "/tmp", prompt: "hello" };
    const result = await client.sessionStart(params);
    expect((result as { method: string }).method).toBe("session.start");
    expect((result as { params: unknown }).params).toEqual(params);
  });

  test("sessionSpawn() sends correct method and params", async () => {
    const params = { parentSessionId: "parent-1", prompt: "hello child" };
    const result = await client.sessionSpawn(params);
    expect((result as { method: string }).method).toBe("session.spawn");
    expect((result as { params: unknown }).params).toEqual(params);
  });

  test("sessionList() works without params", async () => {
    const result = await client.sessionList();
    expect((result as { method: string }).method).toBe("session.list");
  });

  test("workflowRun() sends correct method and params", async () => {
    const params = { workspace: "/tmp", workflow: "init" as const };
    const result = await client.workflowRun(params);
    expect((result as { method: string }).method).toBe("workflow.run");
    expect((result as { params: unknown }).params).toEqual(params);
  });

  test("close() closes transport", () => {
    expect(client.isClosed).toBe(false);
    client.close();
    expect(client.isClosed).toBe(true);
  });

  test("on() receives notifications for specific method", () => {
    const received: JsonRpcNotification[] = [];
    client.on("bridge/session_event", (n) => received.push(n));

    (transport as unknown as { _notify: (n: JsonRpcNotification) => void })._notify({
      jsonrpc: "2.0",
      method: "bridge/session_event",
      params: { sessionId: "abc", type: "session_started" },
    });

    expect(received.length).toBe(1);
    expect(received[0]!.method).toBe("bridge/session_event");
  });

  test("on() receives notifications for bridge/subagent_event", () => {
    const received: JsonRpcNotification[] = [];
    client.on("bridge/subagent_event", (n) => received.push(n));

    (transport as unknown as { _notify: (n: JsonRpcNotification) => void })._notify({
      jsonrpc: "2.0",
      method: "bridge/subagent_event",
      params: { sessionId: "parent", subagentId: "child", type: "session_completed" },
    });

    expect(received.length).toBe(1);
    expect(received[0]!.method).toBe("bridge/subagent_event");
  });

  test("on('*') receives all notifications", () => {
    const received: JsonRpcNotification[] = [];
    client.on("*", (n) => received.push(n));

    (transport as unknown as { _notify: (n: JsonRpcNotification) => void })._notify({
      jsonrpc: "2.0",
      method: "bridge/progress",
      params: { phase: "workflow_started" },
    });

    (transport as unknown as { _notify: (n: JsonRpcNotification) => void })._notify({
      jsonrpc: "2.0",
      method: "bridge/session_event",
      params: { sessionId: "abc", type: "session_started" },
    });

    expect(received.length).toBe(2);
  });

  test("off() removes handler", () => {
    const received: JsonRpcNotification[] = [];
    const handler = (n: JsonRpcNotification) => received.push(n);
    client.on("bridge/session_event", handler);
    client.off("bridge/session_event", handler);

    (transport as unknown as { _notify: (n: JsonRpcNotification) => void })._notify({
      jsonrpc: "2.0",
      method: "bridge/session_event",
      params: {},
    });

    expect(received.length).toBe(0);
  });

  test("configGet() sends correct method and params", async () => {
    const params = { key: "test" };
    const result = await client.configGet(params);
    expect((result as { method: string }).method).toBe("config.get");
  });

  test("hooksAdd() sends correct method and params", async () => {
    const params = {
      event: "pre_tool_use" as const,
      command: "echo test",
      scope: "project" as const,
    };
    const result = await client.hooksAdd(params);
    expect((result as { method: string }).method).toBe("hooks.add");
  });
});

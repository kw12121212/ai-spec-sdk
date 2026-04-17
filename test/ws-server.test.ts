import { test, expect } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { startHttpServer } from "../src/http-server.js";

// A minimal Mock for WebSocket if it's not defined globally in node tests?
// Since it's bun test, WebSocket is globally available!
declare const WebSocket: any;

function wsRequest(ws: any, method: string, params?: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const body: any = { jsonrpc: "2.0", id, method };
    if (params) body.params = params;

    const handler = (event: any) => {
      const data = JSON.parse(event.data);
      if (data.id === id) {
        ws.removeEventListener("message", handler);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify(body));
  });
}

function queryStub() {
  return async function* () {
    yield { type: "system", subtype: "init", session_id: "stub" };
    yield { result: "done" };
  };
}

test("WS /ws happy path: bridge.ping returns pong", async () => {
  const { shutdown, port } = await startHttpServer({ port: 0, noAuth: true, transport: "ws" });
  try {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise((resolve) => ws.addEventListener("open", resolve));

    const result = await wsRequest(ws, "bridge.ping");
    expect(result.pong).toBe(true);
    expect(typeof result.ts === "string").toBeTruthy();

    ws.close();
  } finally {
    await shutdown();
  }
});

test("WS /ws: bridge.capabilities includes transport: ws", async () => {
  const { shutdown, port } = await startHttpServer({ port: 0, noAuth: true, transport: "ws" });
  try {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise((resolve) => ws.addEventListener("open", resolve));

    const result = await wsRequest(ws, "bridge.capabilities");
    expect(result.transport).toBe("ws");

    ws.close();
  } finally {
    await shutdown();
  }
});

test("WS /ws: bridge.info reports transport: ws", async () => {
  const { shutdown, port } = await startHttpServer({ port: 0, noAuth: true, transport: "ws" });
  try {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise((resolve) => ws.addEventListener("open", resolve));

    const result = await wsRequest(ws, "bridge.info");
    expect(result.transport).toBe("ws");

    ws.close();
  } finally {
    await shutdown();
  }
});

test("WS event fan-out: two WS subscribers receive the same session-scoped notification", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-ws-"));
  globalThis.__AI_SPEC_SDK_QUERY__ = queryStub();
  const { shutdown, port } = await startHttpServer({ port: 0, noAuth: true, transport: "ws" });
  
  try {
    const ws1 = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise((resolve) => ws1.addEventListener("open", resolve));

    const startRes = await wsRequest(ws1, "session.start", { workspace, prompt: "hello" });
    const sessionId = startRes.sessionId;
    expect(typeof sessionId === "string").toBeTruthy();

    const ws2 = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise((resolve) => ws2.addEventListener("open", resolve));

    // session.status to register ws2 for events
    await wsRequest(ws2, "session.status", { sessionId });

    const events1: any[] = [];
    const events2: any[] = [];
    
    ws1.addEventListener("message", (e: any) => {
      const data = JSON.parse(e.data);
      if (!data.id && data.method === "bridge/session_event") events1.push(data.params);
    });
    ws2.addEventListener("message", (e: any) => {
      const data = JSON.parse(e.data);
      if (!data.id && data.method === "bridge/session_event") events2.push(data.params);
    });

    await wsRequest(ws1, "session.resume", { sessionId, prompt: "continue" });

    // Wait for events
    await new Promise((resolve) => setTimeout(resolve, 50));

    ws1.close();
    ws2.close();

    expect(events1.length > 0, "subscriber 1 received no events").toBeTruthy();
    expect(events2.length > 0, "subscriber 2 received no events").toBeTruthy();
    
    // Check they both received the same agent_message
    const msg1 = events1.find((e) => e.type === "agent_message");
    const msg2 = events2.find((e) => e.type === "agent_message");
    expect(msg1, "no agent_message in events1").toBeTruthy();
    expect(msg2, "no agent_message in events2").toBeTruthy();
    expect(msg1).toEqual(msg2);

  } finally {
    delete globalThis.__AI_SPEC_SDK_QUERY__;
    await shutdown();
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

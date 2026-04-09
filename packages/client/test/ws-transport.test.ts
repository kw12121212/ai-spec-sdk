import test from "node:test";
import assert from "node:assert/strict";
import { WebSocketTransport } from "../src/ws-transport.js";
import { BridgeClientError } from "../src/errors.js";

// Mock WebSocket
class MockWebSocket {
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((err: Error) => void) | null = null;
  readyState = 0;
  sentData: string[] = [];

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = 1;
      if (this.onopen) this.onopen();
    }, 10);
  }

  send(data: string) {
    this.sentData.push(data);
  }

  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose();
  }

  simulateMessage(data: string) {
    if (this.onmessage) this.onmessage({ data });
  }
}

const OriginalWebSocket = globalThis.WebSocket;

test("WebSocketTransport > connects successfully", async () => {
  globalThis.WebSocket = MockWebSocket as any;
  const transport = new WebSocketTransport({ url: "ws://localhost/ws" });
  assert.equal(transport.isClosed, false);
  
  // Request should wait for connection and then send data
  const reqPromise = transport.request("test.method", { arg: 1 });
  
  setTimeout(() => {
    // Check what was sent
    const ws = (transport as any).ws as MockWebSocket;
    assert.equal(ws.sentData.length, 1);
    const sent = JSON.parse(ws.sentData[0]);
    assert.equal(sent.method, "test.method");
    assert.deepEqual(sent.params, { arg: 1 });
    assert.ok(sent.id);
    
    // Simulate response
    ws.simulateMessage(JSON.stringify({ jsonrpc: "2.0", id: sent.id, result: "success" }));
  }, 50);

  const res = await reqPromise;
  assert.equal(res, "success");
  
  transport.close();
  globalThis.WebSocket = OriginalWebSocket;
});

test("WebSocketTransport > handles notifications", async () => {
  globalThis.WebSocket = MockWebSocket as any;
  const transport = new WebSocketTransport({ url: "ws://localhost/ws" });
  
  let receivedNotif: any = null;
  transport.onNotification((n) => {
    receivedNotif = n;
  });

  setTimeout(() => {
    const ws = (transport as any).ws as MockWebSocket;
    ws.simulateMessage(JSON.stringify({ jsonrpc: "2.0", method: "bridge/session_event", params: { ok: true } }));
  }, 20);

  await new Promise((resolve) => setTimeout(resolve, 50));
  
  assert.ok(receivedNotif);
  assert.equal(receivedNotif.method, "bridge/session_event");
  assert.deepEqual(receivedNotif.params, { ok: true });
  
  transport.close();
  globalThis.WebSocket = OriginalWebSocket;
});

test("WebSocketTransport > auto reconnects on close", async () => {
  globalThis.WebSocket = MockWebSocket as any;
  const transport = new WebSocketTransport({ url: "ws://localhost/ws" });
  
  await new Promise((resolve) => setTimeout(resolve, 20));
  
  const ws1 = (transport as any).ws as MockWebSocket;
  ws1.close();
  
  // Wait for reconnect logic to fire
  await new Promise((resolve) => setTimeout(resolve, 1500));
  
  const ws2 = (transport as any).ws as MockWebSocket;
  assert.notEqual(ws1, ws2);
  assert.ok(ws2);
  
  transport.close();
  globalThis.WebSocket = OriginalWebSocket;
});

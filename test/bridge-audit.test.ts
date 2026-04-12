import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BridgeServer } from "../src/bridge.js";
import { AuditLog, type AuditEntry } from "../src/audit-log.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeAuditDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bridge-audit-"));
}

test("audit.query returns entries for a session", async () => {
  const auditDir = makeAuditDir();
  try {
    const server = new BridgeServer({
      auditDir,
      notify: () => {},
    });

    const auditLog = new AuditLog(auditDir);
    auditLog.write(
      auditLog.createEntry("test-sess", "tool_use", "execution", { toolName: "Read" }),
    );

    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "audit.query",
      params: { sessionId: "test-sess" },
    });

    assert.ok(!resp.error);
    const result = resp.result as Record<string, unknown>;
    assert.equal(result["total"], 1);
    const entries = result["entries"] as AuditEntry[];
    assert.equal(entries[0].eventType, "tool_use");
  } finally {
    fs.rmSync(auditDir, { recursive: true, force: true });
  }
});

test("audit.query with invalid sessionId type returns error", async () => {
  const auditDir = makeAuditDir();
  try {
    const server = new BridgeServer({ auditDir, notify: () => {} });

    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "audit.query",
      params: { sessionId: 12345 },
    });

    assert.ok(resp.error);
    assert.equal(resp.error.code, -32602);
  } finally {
    fs.rmSync(auditDir, { recursive: true, force: true });
  }
});

test("audit.query with category filter works", async () => {
  const auditDir = makeAuditDir();
  try {
    const server = new BridgeServer({ auditDir, notify: () => {} });
    const auditLog = new AuditLog(auditDir);

    auditLog.write(auditLog.createEntry("s1", "tool_use", "execution", {}));
    auditLog.write(auditLog.createEntry("s1", "hook_execution", "security", {}));

    const resp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "audit.query",
      params: { category: "security" },
    });

    assert.ok(!resp.error);
    const result = resp.result as Record<string, unknown>;
    assert.equal(result["total"], 1);
  } finally {
    fs.rmSync(auditDir, { recursive: true, force: true });
  }
});

test("session.start emits session_started audit entry", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ws-start-"));
  const auditDir = makeAuditDir();

  try {
    const notifications: unknown[] = [];
    const server = new BridgeServer({ auditDir, notify: (msg) => notifications.push(msg) });

    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "system", subtype: "init", session_id: "sdk-1" };
      yield { type: "assistant", message: { content: [{ type: "text", text: "hi" }] } };
      yield { type: "result", subtype: "success", result: "done" };
    };

    await server.handleMessage({
      jsonrpc: "2.0",
      id: 10,
      method: "session.start",
      params: { workspace: wsDir, prompt: "hello" },
    });
    delete globalThis.__AI_SPEC_SDK_QUERY__;

    const auditLog = new AuditLog(auditDir);
    const startedEntries = auditLog.query({ eventType: "session_started" });
    assert.ok(startedEntries.total >= 1, "should have at least one session_started entry");
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
    fs.rmSync(auditDir, { recursive: true, force: true });
  }
});

test("session.stop emits session_stopped audit entry", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ws-stop-"));
  const auditDir = makeAuditDir();

  try {
    const notifications: unknown[] = [];
    const server = new BridgeServer({ auditDir, notify: (msg) => notifications.push(msg) });

    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "system", subtype: "init", session_id: "sdk-stop" };
      yield { type: "result", subtype: "success", result: "done" };
    };

    const startResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 11,
      method: "session.start",
      params: { workspace: wsDir, prompt: "stop me" },
    });
    delete globalThis.__AI_SPEC_SDK_QUERY__;

    assert.ok(!startResp.error);

    const stopResp = await server.handleMessage({
      jsonrpc: "2.0",
      id: 12,
      method: "session.stop",
      params: { sessionId: (startResp.result as Record<string, unknown>)["sessionId"] },
    });

    assert.ok(!stopResp.error);

    const auditLog = new AuditLog(auditDir);
    const stoppedEntries = auditLog.query({ eventType: "session_stopped" });
    assert.ok(stoppedEntries.total >= 1, "should have session_stopped entry");
  } finally {
    fs.rmSync(wsDir, { recursive: true, force: true });
    fs.rmSync(auditDir, { recursive: true, force: true });
  }
});

test("audit notification is emitted on write", async () => {
  const auditDir = makeAuditDir();
  try {
    const notifications: unknown[] = [];
    const server = new BridgeServer({ auditDir, notify: (msg) => notifications.push(msg) });

    const auditLog = new AuditLog(auditDir, (msg) => notifications.push(msg));
    auditLog.write(auditLog.createEntry("n1", "tool_use", "execution", {}));

    const auditNotifs = notifications.filter(
      (n) => (n as Record<string, unknown>)["method"] === "bridge/audit_event",
    );
    assert.ok(auditNotifs.length > 0, "should have bridge/audit_event notification");

    const params = (auditNotifs[0] as Record<string, unknown>)["params"] as AuditEntry;
    assert.equal(params.eventType, "tool_use");
  } finally {
    fs.rmSync(auditDir, { recursive: true, force: true });
  }
});

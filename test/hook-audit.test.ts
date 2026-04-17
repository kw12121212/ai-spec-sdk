import { test, expect } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BridgeServer } from "../src/bridge.js";
import { AuditLog, type AuditEntry } from "../src/audit-log.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeAuditDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `hook-audit-${Date.now()}-`));
}

test("hook execution writes hook_execution audit entry", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), `hook-ws-${Date.now()}-`));
  const auditDir = makeAuditDir();

  try {
    const notifications: unknown[] = [];
    const server = new BridgeServer({ auditDir, notify: (msg) => notifications.push(msg) });

    server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "hooks.add",
      params: { event: "pre_tool_use", command: "exit 0", scope: "user" },
    });

    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "system", subtype: "init", session_id: "sdk-hook-1" };
      yield {
        type: "assistant",
        message: {
          content: [{ type: "tool_use", name: "Read", id: "tu-1", input: { file_path: "test.txt" } }],
        },
      };
      yield { type: "result", subtype: "success", result: "done" };
    };

    await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "session.start",
      params: { workspace: wsDir, prompt: "trigger hook" },
    });
    delete globalThis.__AI_SPEC_SDK_QUERY__;

    await sleep(500);

    const auditLog = new AuditLog(auditDir);
    const hookEntries = auditLog.query({ eventType: "hook_execution" });
    expect(hookEntries.total >= 1).toBeTruthy(`expected at least 1 hook_execution entry, got ${hookEntries.total}`);

    const entry = hookEntries.entries[0];
    expect(entry.eventType).toBe("hook_execution");
    expect(entry.category).toBe("security");
    expect(typeof entry.payload.exitCode === "number").toBeTruthy();
  } finally {
    // Don't clean up auditDir immediately — let async writes finish
    await sleep(200);
    try { fs.rmSync(wsDir, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(auditDir, { recursive: true, force: true }); } catch {}
  }
});

test("non-blocking hook also writes audit entries", async () => {
  const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), `hook-ws2-${Date.now()}-`));
  const auditDir = makeAuditDir();

  try {
    const server = new BridgeServer({ auditDir, notify: () => {} });

    server.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "hooks.add",
      params: { event: "notification", command: "echo done", scope: "user" },
    });

    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "system", subtype: "init", session_id: "sdk-hook-nb" };
      yield {
        type: "assistant",
        message: { content: [{ type: "text", text: "hello" }] },
      };
      yield { type: "result", subtype: "success", result: "done" };
    };

    await server.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "session.start",
      params: { workspace: wsDir, prompt: "non-blocking hook" },
    });
    delete globalThis.__AI_SPEC_SDK_QUERY__;

    await sleep(500);

    const auditLog = new AuditLog(auditDir);
    const hookEntries = auditLog.query({ eventType: "hook_execution" });
    expect(hookEntries.total >= 1).toBeTruthy(`expected at least 1 hook_execution entry, got ${hookEntries.total}`);
  } finally {
    await sleep(200);
    try { fs.rmSync(wsDir, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(auditDir, { recursive: true, force: true }); } catch {}
  }
});

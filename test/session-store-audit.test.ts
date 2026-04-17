import { test, expect } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SessionStore } from "../src/session-store.js";
import { AuditLog } from "../src/audit-log.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "store-audit-"));
}

test("SessionStore with AuditLog writes session_created on create", () => {
  const sessionsDir = makeTempDir();
  const auditDir = makeTempDir();

  try {
    const auditLog = new AuditLog(auditDir);
    const store = new SessionStore(sessionsDir, auditLog);
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ws-"));

    store.create(ws, "hello audit");

    const result = auditLog.query({ eventType: "session_created" });
    expect(result.total).toBe(1);
    expect(result.entries[0].payload.workspace).toBe(ws);
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
    fs.rmSync(auditDir, { recursive: true, force: true });
  }
});

test("SessionStore with AuditLog writes state_transition on state change", () => {
  const sessionsDir = makeTempDir();
  const auditDir = makeTempDir();

  try {
    const auditLog = new AuditLog(auditDir);
    const store = new SessionStore(sessionsDir, auditLog);
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ws2-"));

    store.create(ws, "test");
    const session = store.list({ status: "all" })[0];
    store.transitionExecutionState(session.id, "running", "query_started");

    const transitions = auditLog.query({ eventType: "state_transition" });
    expect(transitions.total >= 1).toBeTruthy();
    const lastTransition = transitions.entries[0];
    expect(lastTransition.payload.to).toBe("running");
    expect(lastTransition.payload.trigger).toBe("query_started");
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
    fs.rmSync(auditDir, { recursive: true, force: true });
  }
});

test("SessionStore without AuditLog works normally (backward compat)", () => {
  const sessionsDir = makeTempDir();

  try {
    const store = new SessionStore(sessionsDir);
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ws3-"));

    const session = store.create(ws, "no-audit");
    expect(session.id.length > 0).toBeTruthy();

    store.transitionExecutionState(session.id, "running", "query_started");
    const updated = store.get(session.id);
    expect(updated!.executionState).toBe("running");
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

test("SessionStore with AuditLog records parentSessionId in session_created", () => {
  const sessionsDir = makeTempDir();
  const auditDir = makeTempDir();

  try {
    const auditLog = new AuditLog(auditDir);
    const store = new SessionStore(sessionsDir, auditLog);
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ws4-"));

    store.create(ws, "child", false, "parent-123");

    const created = auditLog.query({ eventType: "session_created" });
    expect(created.total).toBe(1);
    expect(
      (created.entries[0].metadata as Record<string, unknown>)["parentSessionId"],
    ).toBe("parent-123");
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
    fs.rmSync(auditDir, { recursive: true, force: true });
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AuditLog, type AuditEntry } from "../src/audit-log.js";

function makeAuditDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "audit-test-"));
}

test("AuditLog constructor creates directory", () => {
  const dir = makeAuditDir();
  try {
    const log = new AuditLog(dir);
    assert.ok(fs.existsSync(dir), "audit dir should be created");
    log;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("write appends JSONL entry to session file", () => {
  const dir = makeAuditDir();
  try {
    const notifications: unknown[] = [];
    const log = new AuditLog(dir, (msg) => notifications.push(msg));
    const entry: AuditEntry = {
      eventId: "evt-1",
      timestamp: new Date().toISOString(),
      sessionId: "sess-1",
      eventType: "tool_use",
      category: "execution",
      payload: { toolName: "Read" },
      metadata: { bridgeVersion: "1.0" },
    };

    log.write(entry);

    const filePath = path.join(dir, "sess-1.auditl");
    assert.ok(fs.existsSync(filePath), "session audit file should exist");
    const content = fs.readFileSync(filePath, "utf8").trim();
    const parsed = JSON.parse(content) as AuditEntry;
    assert.equal(parsed.eventId, "evt-1");
    assert.equal(parsed.eventType, "tool_use");

    assert.equal(notifications.length, 1);
    const notif = notifications[0] as Record<string, unknown>;
    assert.equal(notif["method"], "bridge/audit_event");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("write appends multiple entries", () => {
  const dir = makeAuditDir();
  try {
    const log = new AuditLog(dir);

    for (let i = 0; i < 3; i++) {
      log.write(log.createEntry("sess-2", "tool_use", "execution", { index: i }));
    }

    const filePath = path.join(dir, "sess-2.auditl");
    const lines = fs.readFileSync(filePath, "utf8").trim().split("\n");
    assert.equal(lines.length, 3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("createEntry generates valid entry with required fields", () => {
  const dir = makeAuditDir();
  try {
    const log = new AuditLog(dir);
    const entry = log.createEntry("sess-3", "session_created", "lifecycle", { workspace: "/tmp" }, { workspace: "/tmp" });

    assert.ok(entry.eventId.length > 0, "eventId should be a UUID");
    assert.ok(entry.timestamp.length > 0, "timestamp should be ISO string");
    assert.equal(entry.sessionId, "sess-3");
    assert.equal(entry.eventType, "session_created");
    assert.equal(entry.category, "lifecycle");
    assert.equal(entry.metadata.bridgeVersion, "unknown");
    assert.equal((entry.metadata as Record<string, unknown>)["workspace"], "/tmp");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("query with sessionId filter returns only that session's entries", () => {
  const dir = makeAuditDir();
  try {
    const log = new AuditLog(dir);

    log.write(log.createEntry("sess-a", "tool_use", "execution", { toolName: "Read" }));
    log.write(log.createEntry("sess-b", "tool_use", "execution", { toolName: "Write" }));
    log.write(log.createEntry("sess-a", "tool_result", "execution", { status: "ok" }));

    const result = log.query({ sessionId: "sess-a" });
    assert.equal(result.total, 2);
    assert.equal(result.entries.length, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("query without sessionId returns all entries across sessions", () => {
  const dir = makeAuditDir();
  try {
    const log = new AuditLog(dir);

    log.write(log.createEntry("sess-x", "tool_use", "execution", {}));
    log.write(log.createEntry("sess-y", "hook_execution", "security", {}));

    const result = log.query({});
    assert.equal(result.total, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("query with category filter filters by category", () => {
  const dir = makeAuditDir();
  try {
    const log = new AuditLog(dir);

    log.write(log.createEntry("s1", "tool_use", "execution", {}));
    log.write(log.createEntry("s1", "hook_execution", "security", {}));
    log.write(log.createEntry("s1", "session_created", "lifecycle", {}));

    const result = log.query({ category: "security" });
    assert.equal(result.total, 1);
    assert.equal(result.entries[0].eventType, "hook_execution");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("query with eventType filter filters by eventType", () => {
  const dir = makeAuditDir();
  try {
    const log = new AuditLog(dir);

    log.write(log.createEntry("s1", "tool_use", "execution", {}));
    log.write(log.createEntry("s1", "tool_result", "execution", {}));
    log.write(log.createEntry("s1", "tool_use", "execution", {}));

    const result = log.query({ eventType: "tool_result" });
    assert.equal(result.total, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("query with limit caps results", () => {
  const dir = makeAuditDir();
  try {
    const log = new AuditLog(dir);

    for (let i = 0; i < 10; i++) {
      log.write(log.createEntry("s1", "tool_use", "execution", { index: i }));
    }

    const result = log.query({ limit: 3 });
    assert.equal(result.total, 10);
    assert.equal(result.entries.length, 3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("query sorts by timestamp descending", () => {
  const dir = makeAuditDir();
  try {
    const log = new AuditLog(dir);

    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      const ts = new Date(now + i * 1000).toISOString();
      log.write({
        eventId: `e-${i}`,
        timestamp: ts,
        sessionId: "s1",
        eventType: "tool_use",
        category: "execution",
        payload: { index: i },
        metadata: { bridgeVersion: "1" },
      });
    }

    const result = log.query({ limit: 100 });
    for (let j = 0; j < result.entries.length - 1; j++) {
      assert.ok(
        new Date(result.entries[j].timestamp).getTime() >= new Date(result.entries[j + 1].timestamp).getTime(),
        "entries should be sorted descending by timestamp",
      );
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("cleanup removes old files not in active set", () => {
  const dir = makeAuditDir();
  try {
    const log = new AuditLog(dir);

    log.write(log.createEntry("old-sess", "tool_use", "execution", {}));

    const filePath = path.join(dir, "old-sess.auditl");
    assert.ok(fs.existsSync(filePath));

    const removed = log.cleanup(0, new Set(["active-1"]));
    assert.equal(removed, 1);
    assert.ok(!fs.existsSync(filePath), "old file should be removed");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("cleanup preserves active session files", () => {
  const dir = makeAuditDir();
  try {
    const log = new AuditLog(dir);

    log.write(log.createEntry("active-1", "tool_use", "execution", {}));

    const removed = log.cleanup(0, new Set(["active-1"]));
    assert.equal(removed, 0);
    assert.ok(fs.existsSync(path.join(dir, "active-1.auditl")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

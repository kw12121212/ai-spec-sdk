import { test, expect } from "bun:test";
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
    expect(fs.existsSync(dir)).toBeTruthy();
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
    expect(fs.existsSync(filePath)).toBeTruthy();
    const content = fs.readFileSync(filePath, "utf8").trim();
    const parsed = JSON.parse(content) as AuditEntry;
    expect(parsed.eventId).toBe("evt-1");
    expect(parsed.eventType).toBe("tool_use");

    expect(notifications.length).toBe(1);
    const notif = notifications[0] as Record<string, unknown>;
    expect(notif["method"]).toBe("bridge/audit_event");
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
    expect(lines.length).toBe(3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("createEntry generates valid entry with required fields", () => {
  const dir = makeAuditDir();
  try {
    const log = new AuditLog(dir);
    const entry = log.createEntry("sess-3", "session_created", "lifecycle", { workspace: "/tmp" }, { workspace: "/tmp" });

    expect(entry.eventId.length > 0).toBeTruthy();
    expect(entry.timestamp.length > 0).toBeTruthy();
    expect(entry.sessionId).toBe("sess-3");
    expect(entry.eventType).toBe("session_created");
    expect(entry.category).toBe("lifecycle");
    expect(entry.metadata.bridgeVersion).toBe("unknown");
    expect((entry.metadata as Record<string, unknown>)["workspace"]).toBe("/tmp");
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
    expect(result.total).toBe(2);
    expect(result.entries.length).toBe(2);
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
    expect(result.total).toBe(2);
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
    expect(result.total).toBe(1);
    expect(result.entries[0].eventType).toBe("hook_execution");
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
    expect(result.total).toBe(1);
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
    expect(result.total).toBe(10);
    expect(result.entries.length).toBe(3);
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
      expect(new Date(result.entries[j].timestamp).getTime() >= new Date(result.entries[j + 1].timestamp).getTime()).toBeTruthy();
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
    expect(fs.existsSync(filePath)).toBeTruthy();

    const removed = log.cleanup(0, new Set(["active-1"]));
    expect(removed).toBe(1);
    expect(!fs.existsSync(filePath)).toBeTruthy();
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
    expect(removed).toBe(0);
    expect(fs.existsSync(path.join(dir, "active-1.auditl"))).toBeTruthy();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

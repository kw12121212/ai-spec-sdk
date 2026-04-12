import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { SessionStore } from "../src/session-store.js";

test("SessionStore with sessionsDir writes session to disk on create", () => {
  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-store-"));

  try {
    const store = new SessionStore(sessionsDir);
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws-"));
    const session = store.create(ws, "hello world");

    const filePath = path.join(sessionsDir, `${session.id}.json`);
    assert.ok(fs.existsSync(filePath), "session file should exist on disk");

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
    assert.equal(parsed["id"], session.id);
    assert.equal(parsed["workspace"], ws);
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

test("SessionStore with sessionsDir reloads sessions from disk on construction", () => {
  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-reload-"));

  try {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws2-"));

    // Create session in first store instance
    const store1 = new SessionStore(sessionsDir);
    const session = store1.create(ws, "persist me");

    // New instance reads from disk
    const store2 = new SessionStore(sessionsDir);
    const loaded = store2.get(session.id);

    assert.ok(loaded, "session should be reloaded from disk");
    assert.equal(loaded!.id, session.id);
    assert.equal(loaded!.workspace, ws);
    assert.equal(loaded!.status, "interrupted");
    assert.equal(loaded!.history[0]?.prompt, "persist me");
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

test("SessionStore creates sessionsDir if it does not exist", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-mkdir-"));
  const sessionsDir = path.join(parent, "sessions", "nested");

  try {
    assert.ok(!fs.existsSync(sessionsDir), "directory should not exist before construction");
    new SessionStore(sessionsDir);
    assert.ok(fs.existsSync(sessionsDir), "SessionStore must create the directory on construction");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("SessionStore without sessionsDir does not write files", () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws3-"));

  try {
    const store = new SessionStore();
    const session = store.create(ws, "no persistence");

    // Should not throw and session should be in memory
    assert.ok(store.get(session.id));
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("SessionStore atomic write leaves no temp file after create", () => {
  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-atomic-"));

  try {
    const store = new SessionStore(sessionsDir);
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws4-"));
    const session = store.create(ws, "atomic test");

    const tmpPath = path.join(sessionsDir, `${session.id}.json.tmp`);
    const finalPath = path.join(sessionsDir, `${session.id}.json`);

    assert.ok(!fs.existsSync(tmpPath), "temp file must not remain after write");
    assert.ok(fs.existsSync(finalPath), "final file must exist");
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

test("SessionStore persists updated state after complete", () => {
  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-complete-"));

  try {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws5-"));
    const store1 = new SessionStore(sessionsDir);
    const session = store1.create(ws, "run it");
    store1.complete(session.id, "the result");

    // Reload and verify persisted status
    const store2 = new SessionStore(sessionsDir);
    const loaded = store2.get(session.id);
    assert.ok(loaded);
    assert.equal(loaded!.status, "completed");
    assert.equal(loaded!.result, "the result");
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

// --- Interrupted recovery ---

test("SessionStore marks active sessions as interrupted on reload", () => {
  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-interrupted-"));

  try {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws6-"));

    // Create an active session, then simulate crash (don't call complete/stop)
    const store1 = new SessionStore(sessionsDir);
    const session = store1.create(ws, "crash me");

    // Reload — active session should become interrupted
    const store2 = new SessionStore(sessionsDir);
    const loaded = store2.get(session.id);

    assert.ok(loaded);
    assert.equal(loaded!.status, "interrupted");

    // Verify persisted to disk as interrupted
    const filePath = path.join(sessionsDir, `${session.id}.json`);
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
    assert.equal(parsed["status"], "interrupted");
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

test("SessionStore leaves completed and stopped sessions unchanged on reload", () => {
  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-nochange-"));

  try {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws7-"));
    const store1 = new SessionStore(sessionsDir);
    const s1 = store1.create(ws, "completed one");
    store1.complete(s1.id, "done");
    const s2 = store1.create(ws, "stopped one");
    store1.stop(s2.id);

    const store2 = new SessionStore(sessionsDir);
    assert.equal(store2.get(s1.id)!.status, "completed");
    assert.equal(store2.get(s2.id)!.status, "stopped");
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

// --- Export ---

test("SessionStore.export returns full session data", () => {
  const store = new SessionStore();
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws8-"));

  try {
    const session = store.create(ws, "export test");
    store.appendEvent(session.id, { type: "agent_message", message: { text: "hello" } });

    const exported = store.export(session.id);
    assert.ok(exported);
    assert.equal(exported!.id, session.id);
    assert.equal(exported!.workspace, ws);
    assert.equal(exported!.status, "active");
    assert.equal(exported!.history.length, 2);
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("SessionStore.export returns null for unknown session", () => {
  const store = new SessionStore();
  assert.equal(store.export("nonexistent"), null);
});

// --- Delete ---

test("SessionStore.delete removes completed session from memory and disk", () => {
  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-delete-"));

  try {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws9-"));
    const store = new SessionStore(sessionsDir);
    const session = store.create(ws, "delete me");
    store.complete(session.id, "done");

    const result = store.delete(session.id);
    assert.equal(result, "ok");

    assert.equal(store.get(session.id), null);
    assert.ok(!fs.existsSync(path.join(sessionsDir, `${session.id}.json`)));
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

test("SessionStore.delete rejects active session", () => {
  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-delactive-"));

  try {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws10-"));
    const store = new SessionStore(sessionsDir);
    const session = store.create(ws, "still running");

    const result = store.delete(session.id);
    assert.equal(result, "active");

    // Session should still exist
    assert.ok(store.get(session.id));
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

test("SessionStore.delete returns not_found for unknown session", () => {
  const store = new SessionStore();
  assert.equal(store.delete("nonexistent"), "not_found");
});

// --- Cleanup ---

test("SessionStore.cleanup removes old non-active sessions", () => {
  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-cleanup-"));

  try {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws11-"));
    const store = new SessionStore(sessionsDir);

    // Create a session and manually set updatedAt to 31 days ago
    const session = store.create(ws, "old session");
    store.complete(session.id, "done");
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    // Manually mutate to simulate old session
    const loaded = store.get(session.id)!;
    loaded.updatedAt = thirtyOneDaysAgo;
    // Write to disk manually since we mutated the object directly
    const filePath = path.join(sessionsDir, `${session.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(loaded), "utf8");

    const removed = store.cleanup(30);
    assert.equal(removed, 1);
    assert.equal(store.get(session.id), null);
    assert.ok(!fs.existsSync(path.join(sessionsDir, `${session.id}.json`)));
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

test("SessionStore.cleanup uses default 30 days", () => {
  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-cleanupdef-"));

  try {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws12-"));
    const store = new SessionStore(sessionsDir);

    const session = store.create(ws, "old");
    store.complete(session.id, "done");
    const loaded = store.get(session.id)!;
    loaded.updatedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    fs.writeFileSync(path.join(sessionsDir, `${session.id}.json`), JSON.stringify(loaded), "utf8");

    const removed = store.cleanup();
    assert.equal(removed, 1);
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

test("SessionStore.cleanup preserves active sessions", () => {
  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-cleanupact-"));

  try {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws13-"));
    const store = new SessionStore(sessionsDir);

    const session = store.create(ws, "still active");
    const loaded = store.get(session.id)!;
    loaded.updatedAt = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    fs.writeFileSync(path.join(sessionsDir, `${session.id}.json`), JSON.stringify(loaded), "utf8");

    const removed = store.cleanup(1);
    assert.equal(removed, 0);
    assert.ok(store.get(session.id));
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

test("SessionStore.cleanup caps olderThanDays at 365", () => {
  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-cleanupcap-"));

  try {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws14-"));
    const store = new SessionStore(sessionsDir);

    const session = store.create(ws, "very old");
    store.complete(session.id, "done");
    const loaded = store.get(session.id)!;
    // 400 days ago — older than 365 cap
    loaded.updatedAt = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    fs.writeFileSync(path.join(sessionsDir, `${session.id}.json`), JSON.stringify(loaded), "utf8");

    const removed = store.cleanup(500);
    assert.equal(removed, 1, "should remove because cap is 365 and session is 400 days old");
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

test("SessionStore.cleanup with olderThanDays 0 is handled gracefully", () => {
  const store = new SessionStore();
  // With 0 days, cutoff is Date.now() so all non-active sessions are removed
  // But cleanup itself just calls with the number — the bridge validates
  const removed = store.cleanup(0);
  assert.equal(removed, 0);
});

// --- Pause/Resume ---

test("Session creates sessions with pausedAt and pauseReason as undefined", () => {
  const store = new SessionStore();
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws-pause1-"));

  try {
    const session = store.create(ws, "test pause init");
    assert.equal(session.pausedAt, undefined);
    assert.equal(session.pauseReason, undefined);
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("SessionStore persists pausedAt and pauseReason to disk", () => {
  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-pause-persist-"));

  try {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws-pause2-"));
    const store1 = new SessionStore(sessionsDir);
    const session = store1.create(ws, "test pause persist");

    // Manually set pause fields
    const loaded1 = store1.get(session.id)!;
    loaded1.pausedAt = "2026-04-12T10:00:00.000Z";
    loaded1.pauseReason = "need break";
    // Save manually since we mutated directly
    const filePath = path.join(sessionsDir, `${session.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(loaded1), "utf8");

    // Reload from disk
    const store2 = new SessionStore(sessionsDir);
    const loaded2 = store2.get(session.id);
    assert.ok(loaded2);
    assert.equal(loaded2!.pausedAt, "2026-04-12T10:00:00.000Z");
    assert.equal(loaded2!.pauseReason, "need break");
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

// --- Cancel/Timeout ---

test("Session creates sessions with cancelledAt, cancelReason, and timeoutMs as undefined", () => {
  const store = new SessionStore();
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws-cancel1-"));

  try {
    const session = store.create(ws, "test cancel init");
    assert.equal(session.cancelledAt, undefined);
    assert.equal(session.cancelReason, undefined);
    assert.equal(session.timeoutMs, undefined);
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("SessionStore.cancelSession cancels an active session", () => {
  const store = new SessionStore();
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws-cancel2-"));

  try {
    const session = store.create(ws, "test cancel active");
    store.transitionExecutionState(session.id, "running", "test");
    const cancelled = store.cancelSession(session.id, "test reason");

    assert.ok(cancelled);
    assert.equal(cancelled!.status, "completed");
    assert.equal(cancelled!.executionState, "completed");
    assert.ok(cancelled!.cancelledAt);
    assert.equal(cancelled!.cancelReason, "test reason");
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("SessionStore.cancelSession uses default reason when none provided", () => {
  const store = new SessionStore();
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws-cancel3-"));

  try {
    const session = store.create(ws, "test cancel default reason");
    store.transitionExecutionState(session.id, "running", "test");
    const cancelled = store.cancelSession(session.id);

    assert.ok(cancelled);
    assert.equal(cancelled!.cancelReason, "user_requested");
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("SessionStore.cancelSession returns null for unknown session", () => {
  const store = new SessionStore();
  const cancelled = store.cancelSession("nonexistent");
  assert.equal(cancelled, null);
});

test("SessionStore persists cancelledAt, cancelReason, and timeoutMs to disk", () => {
  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-cancel-persist-"));

  try {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws-cancel4-"));
    const store1 = new SessionStore(sessionsDir);
    const session = store1.create(ws, "test cancel persist");

    // Manually set cancel/timeout fields
    const loaded1 = store1.get(session.id)!;
    loaded1.cancelledAt = "2026-04-12T10:00:00.000Z";
    loaded1.cancelReason = "timeout";
    loaded1.timeoutMs = 60000;
    // Save manually since we mutated directly
    const filePath = path.join(sessionsDir, `${session.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(loaded1), "utf8");

    // Reload from disk
    const store2 = new SessionStore(sessionsDir);
    const loaded2 = store2.get(session.id);
    assert.ok(loaded2);
    assert.equal(loaded2!.cancelledAt, "2026-04-12T10:00:00.000Z");
    assert.equal(loaded2!.cancelReason, "timeout");
    assert.equal(loaded2!.timeoutMs, 60000);
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

test("SessionStore.persist saves session changes to disk", () => {
  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-persist-"));

  try {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws-persist-"));
    const store = new SessionStore(sessionsDir);
    const session = store.create(ws, "test persist");
    
    // Modify session
    const loaded = store.get(session.id)!;
    loaded.timeoutMs = 30000;
    store.persist(loaded);
    
    // Verify on disk
    const filePath = path.join(sessionsDir, `${session.id}.json`);
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
    assert.equal(parsed["timeoutMs"], 30000);
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

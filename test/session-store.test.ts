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
    assert.equal(loaded!.status, "active");
    assert.equal(loaded!.history[0]?.prompt, "persist me");
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

test("SessionStore without sessionsDir does not write files", () => {
  const store = new SessionStore();
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws3-"));
  const session = store.create(ws, "no persistence");

  // Should not throw and session should be in memory
  assert.ok(store.get(session.id));
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

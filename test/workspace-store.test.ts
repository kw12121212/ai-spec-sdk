import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { WorkspaceStore } from "../src/workspace-store.js";

test("WorkspaceStore.register returns entry with path, registeredAt, lastUsedAt", () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-wsr-"));
  try {
    const store = new WorkspaceStore();
    const entry = store.register(ws);
    assert.equal(entry.path, ws);
    assert.ok(typeof entry.registeredAt === "string");
    assert.ok(typeof entry.lastUsedAt === "string");
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("WorkspaceStore.register is idempotent and updates lastUsedAt", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-wsidemp-"));
  try {
    const store = new WorkspaceStore();
    const first = store.register(ws);
    await new Promise((r) => setTimeout(r, 5));
    const second = store.register(ws);

    assert.equal(second.path, ws);
    assert.equal(second.registeredAt, first.registeredAt, "registeredAt must not change");
    assert.ok(second.lastUsedAt > first.lastUsedAt, "lastUsedAt must advance on re-register");
    assert.equal(store.list().length, 1, "must not duplicate the entry");
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("WorkspaceStore.list returns entries sorted by lastUsedAt descending", async () => {
  const dirs = [
    fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws-a-")),
    fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws-b-")),
    fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws-c-")),
  ];
  try {
    const store = new WorkspaceStore();
    for (const d of dirs) {
      store.register(d);
      await new Promise((r) => setTimeout(r, 5));
    }
    const list = store.list();
    assert.equal(list.length, 3);
    // most recently registered should be first
    assert.equal(list[0].path, dirs[2]);
    assert.equal(list[2].path, dirs[0]);
  } finally {
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  }
});

test("WorkspaceStore with workspacesDir persists to workspaces.json and reloads", () => {
  const workspacesDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-wsdir-"));
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-wsp-"));
  try {
    const store1 = new WorkspaceStore(workspacesDir);
    store1.register(ws);

    const jsonPath = path.join(workspacesDir, "workspaces.json");
    assert.ok(fs.existsSync(jsonPath), "workspaces.json must be created");

    const store2 = new WorkspaceStore(workspacesDir);
    const list = store2.list();
    assert.equal(list.length, 1);
    assert.equal(list[0].path, ws);
  } finally {
    fs.rmSync(workspacesDir, { recursive: true, force: true });
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("WorkspaceStore without workspacesDir keeps entries in memory only", () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-wsmem-"));
  try {
    const store = new WorkspaceStore();
    store.register(ws);
    assert.equal(store.list().length, 1);
    // A second instance should have no entries (nothing was persisted)
    const store2 = new WorkspaceStore();
    assert.equal(store2.list().length, 0);
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("WorkspaceStore caps at 50 entries, evicting least recently used", () => {
  const dirs: string[] = [];
  try {
    const store = new WorkspaceStore();
    for (let i = 0; i < 52; i++) {
      const d = fs.mkdtempSync(path.join(os.tmpdir(), `ai-spec-sdk-ws50-${i}-`));
      dirs.push(d);
      store.register(d);
    }
    assert.ok(store.list().length <= 50, "list must be capped at 50");
    // most recently registered entries should survive
    const remaining = new Set(store.list().map((e) => e.path));
    assert.ok(remaining.has(dirs[51]), "last registered entry must be present");
    assert.ok(remaining.has(dirs[50]), "second-last registered entry must be present");
    assert.ok(!remaining.has(dirs[0]), "oldest entry must have been evicted");
  } finally {
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  }
});

test("WorkspaceStore atomic write leaves no .tmp file", () => {
  const workspacesDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-wsatom-"));
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-wsatom-ws-"));
  try {
    const store = new WorkspaceStore(workspacesDir);
    store.register(ws);
    const tmpPath = path.join(workspacesDir, "workspaces.json.tmp");
    assert.ok(!fs.existsSync(tmpPath), "temp file must not remain after write");
  } finally {
    fs.rmSync(workspacesDir, { recursive: true, force: true });
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

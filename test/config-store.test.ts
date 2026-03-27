import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ConfigStore } from "../src/config-store.js";

describe("ConfigStore", () => {
  let tmpDir: string;
  let workspace: string;
  let store: ConfigStore;
  let origUserSettings: string | undefined;

  const userSettingsPath = path.join(os.homedir(), ".claude", "settings.json");

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-test-"));
    workspace = path.join(tmpDir, "project");
    fs.mkdirSync(workspace, { recursive: true });

    // Back up existing user settings if present
    try {
      origUserSettings = fs.readFileSync(userSettingsPath, "utf8");
    } catch {
      origUserSettings = undefined;
    }

    store = new ConfigStore();
  });

  afterEach(() => {
    // Restore user settings
    if (origUserSettings !== undefined) {
      fs.writeFileSync(userSettingsPath, origUserSettings, "utf8");
    } else {
      try {
        fs.unlinkSync(userSettingsPath);
      } catch {
        // already gone
      }
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("set and get at user scope", () => {
    store.set("testKey", "testValue", { scope: "user" });
    const entry = store.get("testKey");
    expect(entry).not.toBeNull();
    expect(entry!.value).toBe("testValue");
    expect(entry!.scope).toBe("user");
  });

  test("set and get at project scope", () => {
    store.set("testKey", "projValue", { scope: "project", workspace });
    const entry = store.get("testKey", workspace);
    expect(entry).not.toBeNull();
    expect(entry!.value).toBe("projValue");
    expect(entry!.scope).toBe("project");
  });

  test("project overrides user", () => {
    store.set("sharedKey", "user-val", { scope: "user" });
    store.set("sharedKey", "proj-val", { scope: "project", workspace });

    const entry = store.get("sharedKey", workspace);
    expect(entry).not.toBeNull();
    expect(entry!.value).toBe("proj-val");
    expect(entry!.scope).toBe("project");
  });

  test("get returns null for unknown key", () => {
    const entry = store.get("nonexistent_key_xyz");
    expect(entry).toBeNull();
  });

  test("list returns all keys", () => {
    store.set("keyA", 1, { scope: "user" });
    store.set("keyB", 2, { scope: "project", workspace });

    const settings = store.list(workspace);
    expect(settings.length).toBeGreaterThanOrEqual(2);

    const keyA = settings.find((s) => s.key === "keyA");
    const keyB = settings.find((s) => s.key === "keyB");
    expect(keyA).toBeDefined();
    expect(keyB).toBeDefined();
  });

  test("known key validation rejects invalid value", () => {
    expect(() =>
      store.set("permissionMode", "invalid_mode", { scope: "user" }),
    ).toThrow(/Invalid value/);
  });

  test("known key validation accepts valid value", () => {
    store.set("permissionMode", "bypassPermissions", { scope: "user" });
    const entry = store.get("permissionMode");
    expect(entry!.value).toBe("bypassPermissions");
  });

  test("unknown keys are allowed as passthrough", () => {
    store.set("customPlugin.mySetting", "enabled", { scope: "user" });
    const entry = store.get("customPlugin.mySetting");
    expect(entry!.value).toBe("enabled");
  });

  test("persistence - set survives store recreation", () => {
    store.set("persistKey", "persistVal", { scope: "user" });

    const newStore = new ConfigStore();
    const entry = newStore.get("persistKey");
    expect(entry!.value).toBe("persistVal");

    // Clean up
    newStore.set("persistKey", undefined as unknown, { scope: "user" });
  });
});

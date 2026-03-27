import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { HooksStore } from "../src/hooks-store.js";

describe("HooksStore", () => {
  let tmpDir: string;
  let workspace: string;
  let store: HooksStore;
  let origUserHooks: string | undefined;

  const userHooksPath = path.join(os.homedir(), ".claude", "hooks.json");

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hooks-test-"));
    workspace = path.join(tmpDir, "project");
    fs.mkdirSync(workspace, { recursive: true });

    try {
      origUserHooks = fs.readFileSync(userHooksPath, "utf8");
    } catch {
      origUserHooks = undefined;
    }

    store = new HooksStore();
  });

  afterEach(() => {
    if (origUserHooks !== undefined) {
      fs.writeFileSync(userHooksPath, origUserHooks, "utf8");
    } else {
      try {
        fs.unlinkSync(userHooksPath);
      } catch {
        // already gone
      }
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("add creates a user-scoped hook", () => {
    const hook = store.add({
      event: "stop",
      command: "cleanup.sh",
      scope: "user",
    });

    expect(hook.hookId).toBeTruthy();
    expect(hook.event).toBe("stop");
    expect(hook.command).toBe("cleanup.sh");
    expect(hook.scope).toBe("user");
  });

  test("add creates a project-scoped hook with matcher", () => {
    const hook = store.add({
      event: "pre_tool_use",
      command: "validate.sh",
      matcher: "Bash",
      scope: "project",
      workspace,
    });

    expect(hook.matcher).toBe("Bash");
    expect(hook.scope).toBe("project");
    expect(hook.workspace).toBe(workspace);
  });

  test("add rejects invalid event", () => {
    expect(() =>
      store.add({
        event: "invalid_event",
        command: "test.sh",
        scope: "user",
      }),
    ).toThrow(/Invalid hook event/);
  });

  test("add rejects project scope without workspace", () => {
    expect(() =>
      store.add({
        event: "stop",
        command: "test.sh",
        scope: "project",
      }),
    ).toThrow(/workspace.*required/);
  });

  test("add rejects empty command", () => {
    expect(() =>
      store.add({
        event: "stop",
        command: "",
        scope: "user",
      }),
    ).toThrow(/non-empty string/);
  });

  test("remove deletes a hook", () => {
    const hook = store.add({
      event: "stop",
      command: "cleanup.sh",
      scope: "user",
    });

    store.remove(hook.hookId);

    const hooks = store.list();
    expect(hooks.find((h) => h.hookId === hook.hookId)).toBeUndefined();
  });

  test("remove throws for unknown hook ID", () => {
    expect(() => store.remove("nonexistent-id")).toThrow(/not found/);
  });

  test("list returns project and user hooks", () => {
    store.add({
      event: "stop",
      command: "user-cleanup.sh",
      scope: "user",
    });
    store.add({
      event: "pre_tool_use",
      command: "proj-validate.sh",
      matcher: "Bash",
      scope: "project",
      workspace,
    });

    const hooks = store.list(workspace);
    expect(hooks).toHaveLength(2);

    const userHooks = hooks.filter((h) => h.scope === "user");
    const projHooks = hooks.filter((h) => h.scope === "project");
    expect(userHooks).toHaveLength(1);
    expect(projHooks).toHaveLength(1);
  });

  test("list without workspace returns only user hooks", () => {
    store.add({
      event: "stop",
      command: "user-cleanup.sh",
      scope: "user",
    });
    store.add({
      event: "pre_tool_use",
      command: "proj-validate.sh",
      scope: "project",
      workspace,
    });

    const hooks = store.list();
    expect(hooks).toHaveLength(1);
    expect(hooks[0].scope).toBe("user");
  });

  test("findMatching returns hooks for event and tool name", () => {
    store.add({
      event: "pre_tool_use",
      command: "validate-bash.sh",
      matcher: "Bash",
      scope: "user",
    });
    store.add({
      event: "pre_tool_use",
      command: "validate-all.sh",
      scope: "user",
    });

    const bashHooks = store.findMatching("pre_tool_use", "Bash");
    expect(bashHooks).toHaveLength(2);

    const readHooks = store.findMatching("pre_tool_use", "Read");
    expect(readHooks).toHaveLength(1);
    expect(readHooks[0].command).toBe("validate-all.sh");
  });

  test("findMatching with wildcard matcher matches all tools", () => {
    store.add({
      event: "pre_tool_use",
      command: "catch-all.sh",
      matcher: "*",
      scope: "user",
    });

    const matches = store.findMatching("pre_tool_use", "AnyTool");
    expect(matches).toHaveLength(1);
  });

  test("isBlocking returns true for pre_tool_use only", () => {
    expect(store.isBlocking("pre_tool_use")).toBe(true);
    expect(store.isBlocking("post_tool_use")).toBe(false);
    expect(store.isBlocking("notification")).toBe(false);
    expect(store.isBlocking("stop")).toBe(false);
    expect(store.isBlocking("subagent_stop")).toBe(false);
  });

  test("persistence - hooks survive store recreation", () => {
    store.add({
      event: "stop",
      command: "persist-test.sh",
      scope: "user",
    });

    const newStore = new HooksStore();
    const hooks = newStore.list();
    const found = hooks.find((h) => h.command === "persist-test.sh");
    expect(found).toBeDefined();

    // Clean up
    if (found) newStore.remove(found.hookId);
  });
});

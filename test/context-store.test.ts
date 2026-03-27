import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ContextStore } from "../src/context-store.js";

describe("ContextStore", () => {
  let tmpDir: string;
  let workspace: string;
  let store: ContextStore;
  let origUserClaudeDir: string | undefined;
  const userClaudeDir = path.join(os.homedir(), ".claude");

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctx-test-"));
    workspace = path.join(tmpDir, "project");
    fs.mkdirSync(workspace, { recursive: true });

    // Back up user .claude dir state
    try {
      origUserClaudeDir = fs.readFileSync(path.join(userClaudeDir, "settings.json"), "utf8");
    } catch {
      origUserClaudeDir = undefined;
    }

    store = new ContextStore();
  });

  afterEach(() => {
    // Restore user .claude dir
    if (origUserClaudeDir !== undefined) {
      fs.writeFileSync(path.join(userClaudeDir, "settings.json"), origUserClaudeDir, "utf8");
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- Read ---

  test("read project CLAUDE.md", () => {
    fs.writeFileSync(path.join(workspace, "CLAUDE.md"), "# Project instructions", "utf8");

    const result = store.read("project", "CLAUDE.md", workspace);
    expect(result.scope).toBe("project");
    expect(result.path).toBe("CLAUDE.md");
    expect(result.content).toBe("# Project instructions");
  });

  test("read file under .claude/", () => {
    const dir = path.join(workspace, ".claude");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "memory.md"), "notes", "utf8");

    const result = store.read("project", ".claude/memory.md", workspace);
    expect(result.content).toBe("notes");
  });

  test("read user-scope file", () => {
    fs.mkdirSync(userClaudeDir, { recursive: true });
    fs.writeFileSync(path.join(userClaudeDir, "settings.json"), '{"test":true}', "utf8");

    const result = store.read("user", "settings.json");
    expect(result.scope).toBe("user");
    expect(result.content).toContain('"test"');
  });

  test("read non-existent file throws", () => {
    expect(() => store.read("project", ".claude/nonexistent.md", workspace)).toThrow(/File not found/);
  });

  // --- Write ---

  test("write creates file and parent dirs", () => {
    const result = store.write("project", ".claude/memory/notes.md", "my notes", workspace);

    expect(result.written).toBe(true);
    expect(result.scope).toBe("project");

    const content = fs.readFileSync(path.join(workspace, ".claude", "memory", "notes.md"), "utf8");
    expect(content).toBe("my notes");
  });

  test("write CLAUDE.md at workspace root", () => {
    store.write("project", "CLAUDE.md", "# Instructions", workspace);

    const content = fs.readFileSync(path.join(workspace, "CLAUDE.md"), "utf8");
    expect(content).toBe("# Instructions");
  });

  test("write user-scope file", () => {
    fs.mkdirSync(userClaudeDir, { recursive: true });
    store.write("user", "test-context.txt", "user data");

    const content = fs.readFileSync(path.join(userClaudeDir, "test-context.txt"), "utf8");
    expect(content).toBe("user data");

    // Clean up
    fs.unlinkSync(path.join(userClaudeDir, "test-context.txt"));
  });

  test("write overwrites existing file atomically", () => {
    fs.writeFileSync(path.join(workspace, "CLAUDE.md"), "old", "utf8");
    store.write("project", "CLAUDE.md", "new", workspace);

    const content = fs.readFileSync(path.join(workspace, "CLAUDE.md"), "utf8");
    expect(content).toBe("new");
    // No leftover .tmp file
    expect(fs.existsSync(path.join(workspace, "CLAUDE.md.tmp"))).toBe(false);
  });

  // --- Path sandboxing ---

  test("write rejects path traversal", () => {
    expect(() =>
      store.write("project", "../../etc/passwd", "hacked", workspace),
    ).toThrow(/outside the allowed/);
  });

  test("write rejects non-allowed path (random file in workspace)", () => {
    expect(() =>
      store.write("project", "random-file.txt", "data", workspace),
    ).toThrow(/not an allowed context path/);
  });

  test("read rejects path traversal", () => {
    expect(() =>
      store.read("project", "../../etc/passwd", workspace),
    ).toThrow(/outside the allowed/);
  });

  test("project scope without workspace throws", () => {
    expect(() =>
      store.read("project", "CLAUDE.md"),
    ).toThrow(/workspace.*required/);
  });

  test("write user scope rejects path traversal", () => {
    expect(() =>
      store.write("user", "../../etc/passwd", "hacked"),
    ).toThrow(/outside the allowed/);
  });

  // --- List ---

  test("list returns project CLAUDE.md and .claude files", () => {
    fs.writeFileSync(path.join(workspace, "CLAUDE.md"), "root", "utf8");
    fs.mkdirSync(path.join(workspace, ".claude"), { recursive: true });
    fs.writeFileSync(path.join(workspace, ".claude", "settings.json"), "{}", "utf8");

    const files = store.list(workspace);
    const paths = files.filter((f) => f.scope === "project").map((f) => f.path);
    expect(paths).toContain("CLAUDE.md");
    expect(paths).toContain(path.join(".claude", "settings.json"));
  });

  test("list returns user-scope files", () => {
    fs.mkdirSync(userClaudeDir, { recursive: true });
    fs.writeFileSync(path.join(userClaudeDir, "test-list.json"), "{}", "utf8");

    const files = store.list();
    const userFiles = files.filter((f) => f.scope === "user");
    expect(userFiles.some((f) => f.path === "test-list.json")).toBe(true);

    // Clean up
    fs.unlinkSync(path.join(userClaudeDir, "test-list.json"));
  });

  test("list without workspace returns only user files", () => {
    fs.writeFileSync(path.join(workspace, "CLAUDE.md"), "root", "utf8");

    const files = store.list();
    expect(files.every((f) => f.scope === "user")).toBe(true);
  });

  test("list includes CLAUDE.md at nested paths", () => {
    const subDir = path.join(workspace, "packages", "lib");
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, "CLAUDE.md"), "sub-instructions", "utf8");

    const files = store.list(workspace);
    const nestedClaude = files.find(
      (f) => f.path === path.join("packages", "lib", "CLAUDE.md"),
    );
    expect(nestedClaude).toBeDefined();
    expect(nestedClaude!.scope).toBe("project");
  });
});

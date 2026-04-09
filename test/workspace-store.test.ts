import { describe, it, expect, beforeEach } from "bun:test";
import { WorkspaceStore, CustomTool } from "../src/workspace-store.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("WorkspaceStore", () => {
  let tempDir: string;
  let store: WorkspaceStore;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-store-test-"));
    store = new WorkspaceStore(tempDir);
  });

  describe("has", () => {
    it("should return false for unregistered workspace", () => {
      expect(store.has("/nonexistent/workspace")).toBe(false);
    });

    it("should return true for registered workspace", () => {
      const workspacePath = path.join(tempDir, "workspace");
      fs.mkdirSync(workspacePath, { recursive: true });
      store.register(workspacePath);
      expect(store.has(workspacePath)).toBe(true);
    });
  });

  describe("registerTool", () => {
    it("should register a custom tool", () => {
      const workspacePath = path.join(tempDir, "workspace");
      fs.mkdirSync(workspacePath, { recursive: true });
      store.register(workspacePath);

      const tool = store.registerTool(workspacePath, {
        name: "custom.build",
        description: "Build the project",
        command: "npm",
        args: ["run", "build"],
      });

      expect(tool.name).toBe("custom.build");
      expect(tool.description).toBe("Build the project");
      expect(tool.command).toBe("npm");
      expect(tool.args).toEqual(["run", "build"]);
      expect(tool.workspace).toBe(workspacePath);
      expect(tool.registeredAt).toBeDefined();
    });

    it("should overwrite existing tool with same name", () => {
      const workspacePath = path.join(tempDir, "workspace");
      fs.mkdirSync(workspacePath, { recursive: true });
      store.register(workspacePath);

      store.registerTool(workspacePath, {
        name: "custom.build",
        description: "Old description",
        command: "old",
        args: [],
      });

      const newTool = store.registerTool(workspacePath, {
        name: "custom.build",
        description: "New description",
        command: "new",
        args: ["arg1"],
      });

      expect(newTool.description).toBe("New description");
      expect(newTool.command).toBe("new");

      const retrieved = store.getTool(workspacePath, "custom.build");
      expect(retrieved?.description).toBe("New description");
    });
  });

  describe("unregisterTool", () => {
    it("should return true when deleting existing tool", () => {
      const workspacePath = path.join(tempDir, "workspace");
      fs.mkdirSync(workspacePath, { recursive: true });
      store.register(workspacePath);

      store.registerTool(workspacePath, {
        name: "custom.build",
        description: "Build the project",
        command: "npm",
        args: ["run", "build"],
      });

      const result = store.unregisterTool(workspacePath, "custom.build");
      expect(result).toBe(true);
      expect(store.getTool(workspacePath, "custom.build")).toBeUndefined();
    });

    it("should return false when deleting non-existent tool", () => {
      const workspacePath = path.join(tempDir, "workspace");
      fs.mkdirSync(workspacePath, { recursive: true });
      store.register(workspacePath);

      const result = store.unregisterTool(workspacePath, "custom.nonexistent");
      expect(result).toBe(false);
    });

    it("should return false for unregistered workspace", () => {
      const result = store.unregisterTool("/nonexistent/workspace", "custom.tool");
      expect(result).toBe(false);
    });
  });

  describe("listTools", () => {
    it("should return empty array for workspace with no custom tools", () => {
      const workspacePath = path.join(tempDir, "workspace");
      fs.mkdirSync(workspacePath, { recursive: true });
      store.register(workspacePath);

      const tools = store.listTools(workspacePath);
      expect(tools).toEqual([]);
    });

    it("should return all custom tools for workspace", () => {
      const workspacePath = path.join(tempDir, "workspace");
      fs.mkdirSync(workspacePath, { recursive: true });
      store.register(workspacePath);

      store.registerTool(workspacePath, {
        name: "custom.build",
        description: "Build",
        command: "npm",
        args: ["run", "build"],
      });

      store.registerTool(workspacePath, {
        name: "custom.test",
        description: "Test",
        command: "npm",
        args: ["test"],
      });

      const tools = store.listTools(workspacePath);
      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.name)).toContain("custom.build");
      expect(tools.map((t) => t.name)).toContain("custom.test");
    });

    it("should return tools sorted by registeredAt", () => {
      const workspacePath = path.join(tempDir, "workspace");
      fs.mkdirSync(workspacePath, { recursive: true });
      store.register(workspacePath);

      store.registerTool(workspacePath, {
        name: "custom.second",
        description: "Second",
        command: "cmd2",
        args: [],
      });

      // Small delay to ensure different timestamps
      Bun.sleepSync(10);

      store.registerTool(workspacePath, {
        name: "custom.first",
        description: "First",
        command: "cmd1",
        args: [],
      });

      const tools = store.listTools(workspacePath);
      expect(tools[0].name).toBe("custom.second");
      expect(tools[1].name).toBe("custom.first");
    });
  });

  describe("getTool", () => {
    it("should return undefined for non-existent tool", () => {
      const workspacePath = path.join(tempDir, "workspace");
      fs.mkdirSync(workspacePath, { recursive: true });
      store.register(workspacePath);

      const tool = store.getTool(workspacePath, "custom.nonexistent");
      expect(tool).toBeUndefined();
    });

    it("should return the tool for existing tool", () => {
      const workspacePath = path.join(tempDir, "workspace");
      fs.mkdirSync(workspacePath, { recursive: true });
      store.register(workspacePath);

      store.registerTool(workspacePath, {
        name: "custom.build",
        description: "Build the project",
        command: "npm",
        args: ["run", "build"],
      });

      const tool = store.getTool(workspacePath, "custom.build");
      expect(tool).toBeDefined();
      expect(tool?.name).toBe("custom.build");
      expect(tool?.description).toBe("Build the project");
    });
  });

  describe("workspace isolation", () => {
    it("should isolate tools between workspaces", () => {
      const workspace1 = path.join(tempDir, "workspace1");
      const workspace2 = path.join(tempDir, "workspace2");
      fs.mkdirSync(workspace1, { recursive: true });
      fs.mkdirSync(workspace2, { recursive: true });
      store.register(workspace1);
      store.register(workspace2);

      store.registerTool(workspace1, {
        name: "custom.tool",
        description: "Workspace 1 tool",
        command: "cmd1",
        args: [],
      });

      store.registerTool(workspace2, {
        name: "custom.tool",
        description: "Workspace 2 tool",
        command: "cmd2",
        args: [],
      });

      const tool1 = store.getTool(workspace1, "custom.tool");
      const tool2 = store.getTool(workspace2, "custom.tool");

      expect(tool1?.description).toBe("Workspace 1 tool");
      expect(tool2?.description).toBe("Workspace 2 tool");
    });
  });
});

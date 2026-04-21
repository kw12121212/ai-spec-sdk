import { expect, test, describe, beforeEach } from "bun:test";
import { UnifiedToolRegistry } from "../src/unified-tool-registry.js";

describe("UnifiedToolRegistry", () => {
  let registry: UnifiedToolRegistry;

  beforeEach(() => {
    registry = new UnifiedToolRegistry();
  });

  test("registers a tool with prefix", () => {
    const tool = registry.register("mcp_my_server", {
      name: "query",
      description: "A query tool",
      inputSchema: {},
      call: async () => "result",
    });

    expect(tool.name).toBe("mcp_my_server_query");
    expect(registry.get("mcp_my_server_query")).toBeDefined();
  });

  test("lists registered tools", () => {
    registry.register("lsp", {
      name: "hover",
      inputSchema: {},
      call: async () => "hover info",
    });

    const tools = registry.list();
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe("lsp_hover");
  });

  test("removes tools by provider ID", () => {
    registry.register("mcp_serverA", { name: "tool1", inputSchema: {}, call: async () => {} });
    registry.register("mcp_serverA", { name: "tool2", inputSchema: {}, call: async () => {} });
    registry.register("lsp", { name: "hover", inputSchema: {}, call: async () => {} });

    registry.removeProvider("mcp_serverA");

    const tools = registry.list();
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe("lsp_hover");
  });

  test("executes a tool correctly", async () => {
    registry.register("custom", {
      name: "echo",
      inputSchema: {},
      call: async (input) => input,
    });

    const result = await registry.execute("custom_echo", "hello world");
    expect(result).toBe("hello world");
  });

  test("throws when executing an unknown tool", async () => {
    try {
      await registry.execute("unknown_tool", {});
      expect(true).toBe(false); // Should not reach here
    } catch (e: any) {
      expect(e.message).toBe("Tool not found: unknown_tool");
    }
  });
});

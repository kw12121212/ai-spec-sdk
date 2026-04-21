import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { McpStore } from "../src/mcp-store.js";

describe("McpStore", () => {
  let tmpDir: string;
  let workspace: string;
  let store: McpStore;
  let notifications: Array<{ method: string; params: Record<string, unknown> }>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-test-"));
    workspace = path.join(tmpDir, "project");
    fs.mkdirSync(workspace, { recursive: true });
    notifications = [];
    store = new McpStore((method, params) => {
      notifications.push({ method, params });
    });
  });

  afterEach(() => {
    store.shutdown();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("add creates config and auto-starts server", () => {
    const entry = store.add(workspace, {
      name: "test-server",
      command: "sleep",
      args: ["60"],
      env: {},
    });

    expect(entry.name).toBe("test-server");
    expect(entry.status).toBe("running");
    expect(entry.pid).not.toBeNull();

    // Config persisted to disk
    const configPath = path.join(workspace, ".claude", "mcp", "test-server.json");
    expect(fs.existsSync(configPath)).toBe(true);

    // Notification emitted
    const started = notifications.find((n) => n.method === "mcp/server_started");
    expect(started).toBeDefined();
    expect(started!.params.name).toBe("test-server");
    expect(started!.params.workspace).toBe(workspace);
  });

  test("add rejects duplicate name", () => {
    store.add(workspace, {
      name: "dup",
      command: "sleep",
      args: ["60"],
      env: {},
    });

    expect(() =>
      store.add(workspace, {
        name: "dup",
        command: "echo",
        args: [],
        env: {},
      }),
    ).toThrow(/already exists/);
  });

  test("remove stops server and deletes config", () => {
    store.add(workspace, {
      name: "to-remove",
      command: "sleep",
      args: ["60"],
      env: {},
    });

    store.remove(workspace, "to-remove");

    // Config file deleted
    const configPath = path.join(workspace, ".claude", "mcp", "to-remove.json");
    expect(fs.existsSync(configPath)).toBe(false);

    // List should be empty
    const servers = store.list(workspace);
    expect(servers).toHaveLength(0);
  });

  test("list returns servers for workspace", () => {
    store.add(workspace, {
      name: "s1",
      command: "sleep",
      args: ["60"],
      env: {},
    });
    store.add(workspace, {
      name: "s2",
      command: "sleep",
      args: ["60"],
      env: {},
    });

    const servers = store.list(workspace);
    expect(servers).toHaveLength(2);
    expect(servers.map((s) => s.name).sort()).toEqual(["s1", "s2"]);
  });

  test("list returns empty for unknown workspace", () => {
    const servers = store.list(path.join(tmpDir, "nonexistent"));
    expect(servers).toHaveLength(0);
  });

  test("stop transitions running to stopped", () => {
    store.add(workspace, {
      name: "stoppable",
      command: "sleep",
      args: ["60"],
      env: {},
    });

    const entry = store.stop(workspace, "stoppable");
    expect(entry.status).toBe("stopped");
    expect(entry.pid).toBeNull();
  });

  test("start transitions stopped to running", () => {
    store.add(workspace, {
      name: "restartable",
      command: "sleep",
      args: ["60"],
      env: {},
    });
    store.stop(workspace, "restartable");

    const entry = store.start(workspace, "restartable");
    expect(entry.status).toBe("running");
    expect(entry.pid).not.toBeNull();
  });

  test("workspace scoping isolates servers", () => {
    const workspace2 = path.join(tmpDir, "project2");
    fs.mkdirSync(workspace2, { recursive: true });

    store.add(workspace, {
      name: "shared-name",
      command: "sleep",
      args: ["60"],
      env: {},
    });
    store.add(workspace2, {
      name: "shared-name",
      command: "echo",
      args: ["hello"],
      env: {},
    });

    const servers1 = store.list(workspace);
    const servers2 = store.list(workspace2);

    expect(servers1).toHaveLength(1);
    expect(servers1[0].command).toBe("sleep");
    expect(servers2).toHaveLength(1);
    expect(servers2[0].command).toBe("echo");
  });

  test("mcp tool discovery maps tools correctly", async () => {
    const mockMcpScript = `
      let buffer = Buffer.alloc(0);
      process.stdin.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        while(true) {
          const headerEnd = buffer.indexOf('\\r\\n\\r\\n');
          if (headerEnd === -1) break;
          const headers = buffer.slice(0, headerEnd).toString();
          const match = headers.match(/Content-Length: (\\d+)/i);
          if (!match) break;
          const contentLength = parseInt(match[1], 10);
          if (buffer.length < headerEnd + 4 + contentLength) break;
          const payload = buffer.slice(headerEnd + 4, headerEnd + 4 + contentLength).toString();
          buffer = buffer.slice(headerEnd + 4 + contentLength);
          const msg = JSON.parse(payload);
          if (msg.method === 'initialize') {
            const resp = { jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'test', version: '1.0' } } };
            const out = JSON.stringify(resp);
            process.stdout.write(\`Content-Length: \${out.length}\\r\\n\\r\\n\${out}\`);
          } else if (msg.method === 'tools/list') {
            const resp = { jsonrpc: '2.0', id: msg.id, result: { tools: [{ name: 'my_tool', description: 'desc', inputSchema: {} }] } };
            const out = JSON.stringify(resp);
            process.stdout.write(\`Content-Length: \${out.length}\\r\\n\\r\\n\${out}\`);
          }
        }
      });
      setInterval(() => {}, 1000);
    `;
    const scriptPath = path.join(tmpDir, 'mock-mcp.js');
    fs.writeFileSync(scriptPath, mockMcpScript);

    store.add(workspace, {
      name: "mock-mcp",
      command: "node",
      args: [scriptPath],
      env: {},
    });

    // Wait for the LSP initialization and tools list
    await new Promise(r => setTimeout(r, 1000));

    const servers = store.list(workspace);
    expect(servers).toHaveLength(1);
    expect(servers[0].tools).toHaveLength(1);
    expect(servers[0].tools![0].name).toBe("mcp_mock-mcp_my_tool");
  });

  test("shutdown kills all processes", async () => {
    store.add(workspace, {
      name: "s1",
      command: "sleep",
      args: ["60"],
      env: {},
    });
    store.add(workspace, {
      name: "s2",
      command: "sleep",
      args: ["60"],
      env: {},
    });

    store.shutdown();

    // Wait for processes to exit
    await new Promise((r) => setTimeout(r, 500));

    const servers = store.list(workspace);
    // Status should be "stopped" or "error", not "running"
    expect(servers.some((s) => s.status === "running")).toBe(false);
  });
});

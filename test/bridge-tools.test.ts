import { describe, it, expect, beforeEach } from "bun:test";
import { BridgeServer } from "../src/bridge.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("BridgeServer - Custom Tools", () => {
  let tempDir: string;
  let bridge: BridgeServer;
  let workspacePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-tools-test-"));
    workspacePath = path.join(tempDir, "workspace");
    fs.mkdirSync(workspacePath, { recursive: true });
    bridge = new BridgeServer({});
  });

  describe("tools.register", () => {
    it("should register a custom tool successfully", async () => {
      await bridge.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "workspace.register",
        params: { workspace: workspacePath },
      });

      const response = await bridge.handleMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools.register",
        params: {
          workspace: workspacePath,
          name: "custom.build",
          description: "Build the project",
          command: "npm",
          args: ["run", "build"],
        },
      });

      expect(response.error).toBeUndefined();
      expect(response.result?.tool?.name).toBe("custom.build");
    });

    it("should reject tool names not starting with 'custom.'", async () => {
      await bridge.handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "workspace.register",
        params: { workspace: workspacePath },
      });

      const response = await bridge.handleMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools.register",
        params: {
          workspace: workspacePath,
          name: "build",
          description: "Build",
          command: "npm",
          args: [],
        },
      });

      expect(response.error?.code).toBe(-32602);
    });
  });
});

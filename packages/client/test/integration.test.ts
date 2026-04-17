import { describe, test, expect, afterAll } from "bun:test";
import { StdioTransport } from "../src/stdio-transport.js";
import { BridgeClient } from "../src/client.js";
import { BridgeClientError } from "../src/errors.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BRIDGE_CMD = "node";
const BRIDGE_ARGS = [path.resolve(import.meta.dir, "../../../dist/src/cli.js")];

const bridgeExists = fs.existsSync(BRIDGE_ARGS[0]!);

const describeOrSkip = bridgeExists ? describe : describe.skip;

describeOrSkip("Integration: real bridge", () => {
    let client: BridgeClient;

    afterAll(() => {
      client?.close();
    });

    test("ping against real bridge", async () => {
      const transport = new StdioTransport({ command: BRIDGE_CMD, args: BRIDGE_ARGS });
      client = new BridgeClient(transport);
      const result = await client.ping();
      expect((result as Record<string, unknown>).pong).toBe(true);
      client.close();
    });

    test("capabilities against real bridge", async () => {
      const transport = new StdioTransport({ command: BRIDGE_CMD, args: BRIDGE_ARGS });
      client = new BridgeClient(transport);
      const result = await client.capabilities();
      expect((result as Record<string, unknown>).protocol).toBe("jsonrpc-2.0");
      expect(Array.isArray((result as Record<string, unknown>).methods)).toBe(true);
      client.close();
    });

    test("session start errors on nonexistent workspace", async () => {
      const transport = new StdioTransport({ command: BRIDGE_CMD, args: BRIDGE_ARGS });
      client = new BridgeClient(transport);
      try {
        await client.sessionStart({
          workspace: "/nonexistent/path/12345",
          prompt: "test",
        });
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(BridgeClientError);
        expect((err as BridgeClientError).code).toBe(-32001);
      }
      client.close();
    });

    test("session list returns sessions array", async () => {
      const transport = new StdioTransport({ command: BRIDGE_CMD, args: BRIDGE_ARGS });
      client = new BridgeClient(transport);
      const result = await client.sessionList();
      expect(Array.isArray((result as Record<string, unknown>).sessions)).toBe(true);
      client.close();
    });

    test("notification received on session start", async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-test-"));
      const transport = new StdioTransport({ command: BRIDGE_CMD, args: BRIDGE_ARGS });
      client = new BridgeClient(transport);

      const received: unknown[] = [];
      client.on("bridge/session_event", (n) => received.push(n));

      try {
        await client.sessionStart({
          workspace: tmpDir,
          prompt: "just say hi",
        });
      } catch {
        // Session may fail, but notification should have been emitted
      }

      expect(received.length).toBeGreaterThan(0);
      client.close();
      fs.rmSync(tmpDir, { recursive: true });
    });
  },
);

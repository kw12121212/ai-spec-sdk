#!/usr/bin/env node
import readline from "node:readline";
import path from "node:path";
import os from "node:os";
import { BridgeServer } from "./bridge.js";
import { BridgeError } from "./errors.js";

function writeMessage(message: unknown): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

const sessionsDir = path.join(os.homedir(), ".ai-spec-sdk", "sessions");

const server = new BridgeServer({
  notify: (message) => writeMessage(message),
  sessionsDir,
});

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on("line", async (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(trimmed) as unknown;
  } catch {
    writeMessage({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: "Parse error",
      },
    });
    return;
  }

  try {
    const response = await server.handleMessage(payload);
    writeMessage(response);
  } catch (error) {
    const bridgeError =
      error instanceof BridgeError
        ? error
        : new BridgeError(-32603, "Internal bridge error", {
            message: error instanceof Error ? error.message : String(error),
          });

    writeMessage({
      jsonrpc: "2.0",
      id:
        payload !== null &&
        typeof payload === "object" &&
        Object.prototype.hasOwnProperty.call(payload, "id")
          ? (payload as Record<string, unknown>)["id"]
          : null,
      error: bridgeError.toJsonRpcError(),
    });
  }
});

#!/usr/bin/env node
import readline from "node:readline";
import { BridgeServer } from "./bridge.js";
import { BridgeError } from "./errors.js";

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

const server = new BridgeServer({
  notify: (message) => writeMessage(message),
});

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }

  let payload;
  try {
    payload = JSON.parse(trimmed);
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
      id: payload && Object.prototype.hasOwnProperty.call(payload, "id") ? payload.id : null,
      error: bridgeError.toJsonRpcError(),
    });
  }
});

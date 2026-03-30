#!/usr/bin/env node
import readline from "node:readline";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { BridgeServer } from "./bridge.js";
import { BridgeError } from "./errors.js";
import { startHttpServer } from "./http-server.js";
import { loadKeys, addKey, revokeKey, DEFAULT_KEYS_FILE, type StoredKey } from "./key-store.js";
import { generateKey } from "./auth.js";

function writeMessage(message: unknown): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

const sessionsDir = path.join(os.homedir(), ".ai-spec-sdk", "sessions");
const keysFile = DEFAULT_KEYS_FILE;

// Parse a named flag value: --flag value
function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

// ── Key management subcommands ────────────────────────────────────────────────

const subcommand = process.argv[2];

if (subcommand === "keygen") {
  const name = getArg("--name") ?? "default";
  const scopesRaw = getArg("--scopes") ?? "session:read,session:write,workflow:run";
  const expiresRaw = getArg("--expires");
  const scopes = scopesRaw.split(",").map((s) => s.trim()).filter(Boolean);

  const { token, hash } = generateKey();
  const key: StoredKey = {
    id: crypto.randomUUID(),
    name,
    hash,
    createdAt: new Date().toISOString(),
    scopes,
    ...(expiresRaw ? { expiresAt: new Date(expiresRaw).toISOString() } : {}),
  };

  addKey(key, keysFile);

  process.stdout.write(`API key generated:\n`);
  process.stdout.write(`  ID:     ${key.id}\n`);
  process.stdout.write(`  Name:   ${name}\n`);
  process.stdout.write(`  Scopes: ${scopes.join(", ")}\n`);
  if (key.expiresAt) process.stdout.write(`  Expires: ${key.expiresAt}\n`);
  process.stdout.write(`  Token:  ${token}\n`);
  process.stdout.write(`\nSave this token — it will not be shown again.\n`);
  process.exit(0);
}

if (subcommand === "keys") {
  const action = process.argv[3];

  if (action === "list") {
    const keys = loadKeys(keysFile);
    if (keys.length === 0) {
      process.stdout.write("No API keys found.\n");
    } else {
      for (const k of keys) {
        const expiry = k.expiresAt ? `  expires: ${k.expiresAt}` : "";
        process.stdout.write(`${k.id}  ${k.name}  [${k.scopes.join(", ")}]  created: ${k.createdAt}${expiry}\n`);
      }
    }
    process.exit(0);
  }

  if (action === "revoke") {
    const id = process.argv[4];
    if (!id) {
      process.stderr.write("Usage: ai-spec-bridge keys revoke <id>\n");
      process.exit(1);
    }
    const removed = revokeKey(id, keysFile);
    if (!removed) {
      process.stderr.write(`Key not found: ${id}\n`);
      process.exit(1);
    }
    process.stdout.write(`Key revoked: ${id}\n`);
    process.exit(0);
  }

  process.stderr.write(`Unknown keys subcommand: ${action ?? "(none)"}\n`);
  process.exit(1);
}

// ── Transport mode ────────────────────────────────────────────────────────────

const transport = getArg("--transport") ?? process.env["AI_SPEC_SDK_TRANSPORT"] ?? "stdio";
const portRaw = getArg("--port") ?? process.env["AI_SPEC_SDK_PORT"];
const port = portRaw !== undefined ? parseInt(portRaw, 10) : 8765;
const noAuth = process.argv.includes("--no-auth");

if (transport === "http") {
  const { shutdown } = await startHttpServer({ port, sessionsDir, noAuth, keysFile });
  process.on("SIGTERM", async () => {
    await shutdown();
    process.exit(0);
  });
} else {
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
}

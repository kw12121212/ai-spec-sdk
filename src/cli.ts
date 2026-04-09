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
import { buildDoctorInfo } from "./runtime-info.js";
import { BRIDGE_VERSION } from "./capabilities.js";

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

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

// ── --help ────────────────────────────────────────────────────────────────────

const subcommand = process.argv[2];

if (subcommand === "--help" || hasFlag("--help") || hasFlag("-h")) {
  process.stdout.write(`ai-spec-bridge v${BRIDGE_VERSION}

JSON-RPC 2.0 bridge for Claude Agent SDK and spec-driven workflows.

Usage:
  ai-spec-bridge [options]            Start in stdio transport mode (default)
  ai-spec-bridge --transport http     Start in HTTP/SSE transport mode
  ai-spec-bridge doctor [--json]      Show runtime diagnostics and exit
  ai-spec-bridge keygen               Generate a new API key
  ai-spec-bridge keys list            List all stored API keys
  ai-spec-bridge keys revoke <id>     Revoke a stored API key
  ai-spec-bridge --help               Show this help message

Transport options:
  --transport <stdio|http>            Transport mode (default: stdio, env: AI_SPEC_SDK_TRANSPORT)
  --port <number>                     HTTP port (default: 8765, env: AI_SPEC_SDK_PORT)
  --no-auth                           Disable API key authentication (HTTP mode only)

Key management:
  keygen --name <n> --scopes <s>      Generate key with comma-separated scopes
  keygen --expires <ISO date>         Set expiry date for the key

Available scopes:
  session:read                        Read session state and history
  session:write                       Start, stop, and manage sessions
  workflow:run                        Execute spec-driven workflows
  config:read                         Read configuration and context
  config:write                        Write configuration and context
  admin                               Full access including bridge.info, MCP, hooks

Environment variables:
  AI_SPEC_SDK_TRANSPORT               Default transport (stdio or http)
  AI_SPEC_SDK_PORT                    HTTP port
  AI_SPEC_SDK_CORS_ORIGINS            Allowed CORS origins (default: *)
  SPEC_DRIVEN_SCRIPT                  Override path to spec-driven.js script

RPC discovery:
  Send {"jsonrpc":"2.0","id":1,"method":"bridge.capabilities"} to list all methods.
  Send {"jsonrpc":"2.0","id":2,"method":"bridge.info"} (requires admin scope) for runtime info.
`);
  process.exit(0);
}

// ── doctor subcommand ─────────────────────────────────────────────────────────

if (subcommand === "doctor") {
  const jsonMode = hasFlag("--json");
  const transport = getArg("--transport") ?? process.env["AI_SPEC_SDK_TRANSPORT"] ?? "stdio";
  const portRaw = getArg("--port") ?? process.env["AI_SPEC_SDK_PORT"];
  const portParsed = portRaw !== undefined ? parseInt(portRaw, 10) : 8765;
  if (isNaN(portParsed)) {
    process.stderr.write(`Error: --port must be a valid integer, got: ${portRaw}\n`);
    process.exit(1);
  }
  const port = portParsed;
  const noAuth = hasFlag("--no-auth");

  const doctorInfo = buildDoctorInfo({
    transport,
    authMode: noAuth ? "none" : (transport === "http" ? "bearer" : "none"),
    sessionsDir,
    keysFile,
    httpPort: transport === "http" ? port : undefined,
  });

  if (jsonMode) {
    process.stdout.write(JSON.stringify(doctorInfo, null, 2) + "\n");
    process.exit(0);
  }

  const { info, checks } = doctorInfo;
  process.stdout.write(`ai-spec-bridge doctor\n`);
  process.stdout.write(`─────────────────────────────────────────\n`);
  process.stdout.write(`Bridge version:       ${info.bridgeVersion}\n`);
  process.stdout.write(`API version:          ${info.apiVersion}\n`);
  process.stdout.write(`Node version:         ${info.nodeVersion}\n`);
  process.stdout.write(`Transport:            ${info.transport}\n`);
  process.stdout.write(`Auth mode:            ${info.authMode}\n`);
  process.stdout.write(`Log level:            ${info.logLevel}\n`);
  process.stdout.write(`Sessions path:        ${info.sessionsPath}\n`);
  process.stdout.write(`Keys path:            ${info.keysPath}\n`);
  process.stdout.write(`Spec-driven script:   ${info.specDrivenScriptPath}\n`);
  if (info.http) {
    process.stdout.write(`HTTP port:            ${info.http.port}\n`);
    process.stdout.write(`CORS origins:         ${info.http.corsOrigins}\n`);
  }
  process.stdout.write(`\nChecks:\n`);
  for (const check of checks) {
    const status = check.ok ? "ok" : "WARN";
    process.stdout.write(`  [${status.padEnd(4)}] ${check.name}: ${check.detail}\n`);
  }
  const allOk = checks.every((c) => c.ok);
  process.stdout.write(`\nStatus: ${allOk ? "healthy" : "warnings detected"}\n`);
  process.exit(allOk ? 0 : 1);
}

// ── Key management subcommands ────────────────────────────────────────────────

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
const portParsed = portRaw !== undefined ? parseInt(portRaw, 10) : 8765;
if (isNaN(portParsed)) {
  process.stderr.write(`Error: --port must be a valid integer, got: ${portRaw}\n`);
  process.exit(1);
}
const port = portParsed;
const noAuth = process.argv.includes("--no-auth");

if (transport === "http" || transport === "ws") {
  const { shutdown } = await startHttpServer({ port, sessionsDir, noAuth, keysFile, transport });
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

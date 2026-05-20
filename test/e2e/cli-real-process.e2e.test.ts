import { test, expect } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import {
  allocatePort,
  type CliE2EContext,
  createCliE2EContext,
  runCliPipe,
  runCliPty,
  startCliPipe,
  supportsPtyHarness,
} from "./cli-harness.js";

declare const WebSocket: any;

function parseJsonLines(stdout: string): Record<string, unknown>[] {
  const parsed: Record<string, unknown>[] = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    try {
      parsed.push(JSON.parse(trimmed) as Record<string, unknown>);
    } catch {
      break;
    }
  }
  return parsed;
}

function keysFilePath(context: CliE2EContext): string {
  return path.join(context.homeDir, ".ai-spec-sdk", "keys.json");
}

function readStoredKeys(context: CliE2EContext): Record<string, unknown>[] {
  return JSON.parse(fs.readFileSync(keysFilePath(context), "utf8")) as Record<string, unknown>[];
}

function extractLabelledValue(output: string, label: string): string {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = output.match(new RegExp(`^\\s*${escapedLabel}:\\s+(.+)$`, "m"));
  if (!match) {
    throw new Error(`Could not find '${label}' in output:\n${output}`);
  }
  return match[1]!.trim();
}

async function waitForHealth(port: number, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the timeout expires.
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`Timed out waiting for compiled CLI HTTP transport on port ${port}`);
}

function openWebSocket(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);

    const handleOpen = () => {
      ws.removeEventListener("error", handleError);
      resolve(ws);
    };
    const handleError = () => {
      ws.removeEventListener("open", handleOpen);
      reject(new Error(`Failed to open WebSocket connection to ${url}`));
    };

    ws.addEventListener("open", handleOpen);
    ws.addEventListener("error", handleError);
  });
}

function wsRequest(ws: any, method: string, params?: unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1_000_000);
    const message: Record<string, unknown> = { jsonrpc: "2.0", id, method };
    if (params !== undefined) {
      message["params"] = params;
    }

    const handleMessage = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as Record<string, unknown>;
      if (payload["id"] !== id) {
        return;
      }

      ws.removeEventListener("message", handleMessage);
      if ("error" in payload) {
        reject(new Error(JSON.stringify(payload["error"])));
        return;
      }

      resolve(payload["result"] as Record<string, unknown>);
    };

    ws.addEventListener("message", handleMessage);
    ws.send(JSON.stringify(message));
  });
}

test("compiled CLI doctor --json reports HOME-scoped paths", async () => {
  const context = createCliE2EContext();
  try {
    const result = await runCliPipe(context, ["doctor", "--json"]);
    expect(result.timedOut).toBe(false);
    expect(result.exitCode === 0 || result.exitCode === 1).toBeTruthy();

    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    const info = parsed["info"] as Record<string, unknown>;

    expect(info["sessionsPath"]).toBe(path.join(context.homeDir, ".ai-spec-sdk", "sessions"));
    expect(info["keysPath"]).toBe(path.join(context.homeDir, ".ai-spec-sdk", "keys.json"));
  } finally {
    context.cleanup();
  }
});

test("compiled CLI help aliases and doctor modes expose deterministic command-matrix output", async () => {
  const context = createCliE2EContext();
  const port = await allocatePort();

  try {
    const shortHelp = await runCliPipe(context, ["-h"]);
    expect(shortHelp.timedOut).toBe(false);
    expect(shortHelp.exitCode).toBe(0);
    expect(shortHelp.stdout).toContain("Usage:");
    expect(shortHelp.stdout).toContain("ai-spec-bridge doctor [--json]");

    const longHelp = supportsPtyHarness()
      ? await runCliPty(context, ["--help"])
      : await runCliPipe(context, ["--help"]);
    expect(longHelp.timedOut).toBe(false);
    expect(longHelp.exitCode).toBe(0);
    expect(longHelp.stdout).toContain("ai-spec-bridge keygen");
    expect(longHelp.stdout).toContain("Transport options:");

    const doctorText = await runCliPipe(context, ["doctor"]);
    expect(doctorText.timedOut).toBe(false);
    expect(doctorText.exitCode === 0 || doctorText.exitCode === 1).toBeTruthy();
    expect(doctorText.stdout).toContain("Bridge version:");
    expect(doctorText.stdout).toContain("Checks:");

    const doctorJson = await runCliPipe(context, [
      "doctor",
      "--json",
      "--transport",
      "http",
      "--port",
      String(port),
      "--no-auth",
    ]);
    expect(doctorJson.timedOut).toBe(false);
    expect(doctorJson.exitCode === 0 || doctorJson.exitCode === 1).toBeTruthy();

    const parsed = JSON.parse(doctorJson.stdout) as Record<string, unknown>;
    const info = parsed["info"] as Record<string, unknown>;
    const http = info["http"] as Record<string, unknown>;

    expect(info["transport"]).toBe("http");
    expect(info["authMode"]).toBe("none");
    expect(http["port"]).toBe(port);

    const invalidPort = await runCliPipe(context, ["doctor", "--port", "not-a-port"]);
    expect(invalidPort.timedOut).toBe(false);
    expect(invalidPort.exitCode).toBe(1);
    expect(invalidPort.stderr).toContain("Error: --port must be a valid integer");
  } finally {
    context.cleanup();
  }
});

test("compiled CLI key management persists and revokes keys inside the temporary HOME", async () => {
  const context = createCliE2EContext();
  const expiresAt = "2030-01-02T03:04:05.000Z";

  try {
    const generated = await runCliPipe(context, [
      "keygen",
      "--name",
      "matrix-test",
      "--scopes",
      "session:read,workflow:run",
      "--role",
      "admin",
      "--role",
      "operator",
      "--expires",
      expiresAt,
    ]);
    expect(generated.timedOut).toBe(false);
    expect(generated.exitCode).toBe(0);
    expect(generated.stdout).toContain("API key generated:");
    expect(generated.stdout).toContain("Save this token");

    const generatedId = extractLabelledValue(generated.stdout, "ID");
    const generatedToken = extractLabelledValue(generated.stdout, "Token");
    expect(generatedToken.length > 10).toBeTruthy();

    const storedKeys = readStoredKeys(context);
    expect(storedKeys.length).toBe(1);
    const storedKey = storedKeys[0]!;
    expect(storedKey["id"]).toBe(generatedId);
    expect(storedKey["name"]).toBe("matrix-test");
    expect(storedKey["scopes"]).toEqual(["session:read", "workflow:run"]);
    expect(storedKey["roles"]).toEqual(["admin", "operator"]);
    expect(storedKey["expiresAt"]).toBe(expiresAt);

    const listed = await runCliPipe(context, ["keys", "list"]);
    expect(listed.timedOut).toBe(false);
    expect(listed.exitCode).toBe(0);
    expect(listed.stdout).toContain(generatedId);
    expect(listed.stdout).toContain("matrix-test");
    expect(listed.stdout).toContain("[session:read, workflow:run]");
    expect(listed.stdout).toContain("roles: [admin, operator]");

    const revoked = await runCliPipe(context, ["keys", "revoke", generatedId]);
    expect(revoked.timedOut).toBe(false);
    expect(revoked.exitCode).toBe(0);
    expect(revoked.stdout).toContain(`Key revoked: ${generatedId}`);
    expect(readStoredKeys(context).length).toBe(0);

    const revokeMissing = await runCliPipe(context, ["keys", "revoke", generatedId]);
    expect(revokeMissing.timedOut).toBe(false);
    expect(revokeMissing.exitCode).toBe(1);
    expect(revokeMissing.stderr).toContain(`Key not found: ${generatedId}`);
  } finally {
    context.cleanup();
  }
});

test("compiled CLI rejects unknown keys subcommands", async () => {
  const context = createCliE2EContext();

  try {
    const result = await runCliPipe(context, ["keys", "rotate"]);
    expect(result.timedOut).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown keys subcommand: rotate");
  } finally {
    context.cleanup();
  }
});

test("compiled CLI stdio bridge returns capabilities and parse errors through pipes", async () => {
  const context = createCliE2EContext();
  const running = startCliPipe(context, []);

  try {
    running.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "bridge.capabilities" })}\n`);
    const firstOutput = await running.waitForStdoutMatch((stdout) => parseJsonLines(stdout).length >= 1);
    const firstLine = parseJsonLines(firstOutput)[0]!;
    const firstResult = firstLine["result"] as Record<string, unknown>;
    expect(firstLine["jsonrpc"]).toBe("2.0");
    expect(firstLine["id"]).toBe(1);
    expect(firstResult["transport"]).toBe("stdio");

    running.write("not-json\n");
    const secondOutput = await running.waitForStdoutMatch((stdout) => parseJsonLines(stdout).length >= 2);
    const secondLine = parseJsonLines(secondOutput)[1]!;
    const secondError = secondLine["error"] as Record<string, unknown>;
    expect(secondError["code"]).toBe(-32700);

    const result = await running.stop();
    expect(result.timedOut).toBe(false);
  } finally {
    context.cleanup();
  }
});

test("compiled CLI HTTP transport starts on an isolated port and exits cleanly on SIGTERM", async () => {
  const context = createCliE2EContext();
  const port = await allocatePort();
  const running = startCliPipe(context, ["--transport", "http", "--port", String(port), "--no-auth"]);

  try {
    await waitForHealth(port);

    const response = await fetch(`http://127.0.0.1:${port}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "bridge.capabilities" }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as Record<string, unknown>;
    const result = payload["result"] as Record<string, unknown>;
    expect(result["transport"]).toBe("http");

    const shutdown = await running.stop();
    expect(shutdown.timedOut).toBe(false);
    expect(shutdown.exitCode).toBe(0);
  } finally {
    context.cleanup();
  }
});

test("compiled CLI WS transport starts on an isolated port and serves bridge.capabilities", async () => {
  const context = createCliE2EContext();
  const port = await allocatePort();
  const running = startCliPipe(context, ["--transport", "ws", "--port", String(port), "--no-auth"]);

  try {
    await waitForHealth(port);

    const ws = await openWebSocket(`ws://127.0.0.1:${port}/ws`);
    const result = await wsRequest(ws, "bridge.capabilities");
    expect(result["transport"]).toBe("ws");
    ws.close();

    const shutdown = await running.stop();
    expect(shutdown.timedOut).toBe(false);
    expect(shutdown.exitCode).toBe(0);
  } finally {
    context.cleanup();
  }
});

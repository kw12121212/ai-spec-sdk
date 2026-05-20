import { test, expect } from "bun:test";
import path from "node:path";
import {
  allocatePort,
  createCliE2EContext,
  runCliPipe,
  runCliPty,
  startCliPipe,
  supportsPtyHarness,
} from "./cli-harness.js";

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

test("compiled CLI help can be captured through a PTY harness when supported", async () => {
  if (!supportsPtyHarness()) {
    return;
  }

  const context = createCliE2EContext();
  try {
    const result = await runCliPty(context, ["--help"]);
    expect(result.timedOut).toBe(false);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("ai-spec-bridge");
    expect(result.stdout).toContain("Usage:");
  } finally {
    context.cleanup();
  }
});

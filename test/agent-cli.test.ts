import { test, expect } from "bun:test";
import { BridgeServer } from "../src/bridge.js";
import { parseAgentArgs, runAgentCli } from "../src/agent-cli.js";

function makeIo(): {
  io: { stdout: { write: (chunk: string) => boolean }; stderr: { write: (chunk: string) => boolean } };
  stdout: () => string;
  stderr: () => string;
} {
  let out = "";
  let err = "";
  return {
    io: {
      stdout: { write: (chunk: string) => { out += chunk; return true; } },
      stderr: { write: (chunk: string) => { err += chunk; return true; } },
    },
    stdout: () => out,
    stderr: () => err,
  };
}

test("parseAgentArgs builds a session.start compatible option set", () => {
  const parsed = parseAgentArgs([
    "--workspace",
    ".",
    "--model",
    "claude-sonnet-4-6",
    "--permission-mode",
    "approve",
    "--allowed-tools",
    "Read,Edit",
    "--disallowed-tools",
    "Bash",
    "--max-turns",
    "3",
    "--anthropic-base-url",
    "https://anthropic-compatible.example/v1",
    "--anthropic-auth-token",
    "token",
    "--env",
    "CLAUDE_CODE_USE_VERTEX=1",
    "--stream",
    "fix",
    "tests",
  ], "/tmp/project");

  expect(parsed.workspace).toBe("/tmp/project");
  expect(parsed.prompt).toBe("fix tests");
  expect(parsed.model).toBe("claude-sonnet-4-6");
  expect(parsed.permissionMode).toBe("approve");
  expect(parsed.allowedTools).toEqual(["Read", "Edit"]);
  expect(parsed.disallowedTools).toEqual(["Bash"]);
  expect(parsed.maxTurns).toBe(3);
  expect(parsed.anthropicBaseUrl).toBe("https://anthropic-compatible.example/v1");
  expect(parsed.anthropicAuthToken).toBe("token");
  expect(parsed.env).toEqual({ CLAUDE_CODE_USE_VERTEX: "1" });
  expect(parsed.stream).toBe(true);
});

test("runAgentCli forwards Anthropic-compatible endpoint flags to SDK env", async () => {
  const previous = globalThis.__AI_SPEC_SDK_QUERY__;
  let capturedOptions: Record<string, unknown> | null = null;
  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ options }: { options: Record<string, unknown> }) {
    capturedOptions = options;
    yield { result: "env-ok" };
  } as typeof globalThis.__AI_SPEC_SDK_QUERY__;

  const { io } = makeIo();
  try {
    const code = await runAgentCli([
      "--workspace",
      process.cwd(),
      "--anthropic-base-url",
      "https://anthropic-compatible.example/v1",
      "--anthropic-api-key",
      "third-party-key",
      "--env",
      "CLAUDE_CODE_USE_BEDROCK=1",
      "use",
      "proxy",
    ], io, {
      createServer: (notify) => new BridgeServer({ notify }),
    });

    expect(code).toBe(0);
    const env = capturedOptions?.["env"] as Record<string, unknown>;
    expect(env["ANTHROPIC_BASE_URL"]).toBe("https://anthropic-compatible.example/v1");
    expect(env["ANTHROPIC_API_KEY"]).toBe("third-party-key");
    expect(env["CLAUDE_CODE_USE_BEDROCK"]).toBe("1");
  } finally {
    if (previous) {
      globalThis.__AI_SPEC_SDK_QUERY__ = previous;
    } else {
      delete globalThis.__AI_SPEC_SDK_QUERY__;
    }
  }
});

test("runAgentCli starts a bridge session and prints the final result", async () => {
  const previous = globalThis.__AI_SPEC_SDK_QUERY__;
  globalThis.__AI_SPEC_SDK_QUERY__ = async function* ({ prompt }: { prompt: string }) {
    yield { type: "system", subtype: "init", session_id: "sdk-cli" };
    yield { result: `done:${prompt}`, usage: { input_tokens: 1, output_tokens: 2 } };
  } as typeof globalThis.__AI_SPEC_SDK_QUERY__;

  const { io, stdout, stderr } = makeIo();
  try {
    const code = await runAgentCli(["--workspace", process.cwd(), "repair", "cli"], io, {
      createServer: (notify) => new BridgeServer({ notify }),
    });

    expect(code).toBe(0);
    expect(stdout()).toContain("done:repair cli");
    expect(stderr()).toContain("Session started:");
    expect(stderr()).toContain("Usage:");
  } finally {
    if (previous) {
      globalThis.__AI_SPEC_SDK_QUERY__ = previous;
    } else {
      delete globalThis.__AI_SPEC_SDK_QUERY__;
    }
  }
});

test("runAgentCli --json emits notifications and final JSON-RPC response", async () => {
  const previous = globalThis.__AI_SPEC_SDK_QUERY__;
  globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
    yield { type: "system", subtype: "init", session_id: "sdk-json" };
    yield { result: "json-ok" };
  } as typeof globalThis.__AI_SPEC_SDK_QUERY__;

  const { io, stdout } = makeIo();
  try {
    const code = await runAgentCli(["--json", "--workspace", process.cwd(), "ship"], io, {
      createServer: (notify) => new BridgeServer({ notify }),
    });

    expect(code).toBe(0);
    const lines = stdout().trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(lines.some((line) => line["method"] === "bridge/session_event")).toBe(true);
    const final = lines.at(-1)!;
    expect((final["result"] as Record<string, unknown>)["result"]).toBe("json-ok");
  } finally {
    if (previous) {
      globalThis.__AI_SPEC_SDK_QUERY__ = previous;
    } else {
      delete globalThis.__AI_SPEC_SDK_QUERY__;
    }
  }
});

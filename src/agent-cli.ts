import path from "node:path";
import os from "node:os";
import { BridgeServer, type JsonRpcResponse } from "./bridge.js";

export interface AgentCliOptions {
  workspace: string;
  prompt: string;
  model?: string;
  permissionMode?: string;
  maxTurns?: number;
  systemPrompt?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  stream: boolean;
  json: boolean;
  template?: string;
  timeoutMs?: number;
  anthropicBaseUrl?: string;
  anthropicApiKey?: string;
  anthropicAuthToken?: string;
  env?: Record<string, string | undefined>;
}

export interface AgentCliIo {
  stdout: Pick<NodeJS.WriteStream, "write">;
  stderr: Pick<NodeJS.WriteStream, "write">;
}

export interface AgentCliRunOptions {
  sessionsDir?: string;
  createServer?: (notify: (message: unknown) => void) => BridgeServer;
}

const VALUE_FLAGS = new Set([
  "--workspace",
  "-C",
  "--model",
  "--permission-mode",
  "--max-turns",
  "--system-prompt",
  "--allowed-tools",
  "--disallowed-tools",
  "--template",
  "--timeout-ms",
  "--anthropic-base-url",
  "--anthropic-api-key",
  "--anthropic-auth-token",
  "--env",
]);

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveInt(raw: string, flag: string): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || String(parsed) !== raw) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return parsed;
}

function parseEnvAssignment(raw: string): [string, string] {
  const equals = raw.indexOf("=");
  if (equals <= 0) {
    throw new Error("--env must be formatted as KEY=VALUE");
  }
  const key = raw.slice(0, equals).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    throw new Error("--env key must be a valid environment variable name");
  }
  return [key, raw.slice(equals + 1)];
}

export function agentCliHelp(): string {
  return `Usage:
  ai-spec-bridge agent [options] <prompt>
  ai-spec-bridge run [options] <prompt>

Options:
  --workspace, -C <path>              Project workspace (default: current directory)
  --model <id>                        Model passed to the agent runtime
  --permission-mode <mode>            default | acceptEdits | bypassPermissions | approve
  --allowed-tools <a,b>               Comma-separated allow-list
  --disallowed-tools <a,b>            Comma-separated deny-list
  --max-turns <n>                     Maximum agent turns
  --system-prompt <text>              Additional system prompt
  --template <name>                   Session template name
  --timeout-ms <n>                    Automatic session timeout
  --anthropic-base-url <url>          Custom Anthropic-compatible API base URL
  --anthropic-api-key <key>           API key for Anthropic-compatible API
  --anthropic-auth-token <token>      Bearer token for Anthropic-compatible API
  --env <KEY=VALUE>                   Extra SDK environment variable (repeatable)
  --stream                            Request streaming output
  --json                              Emit JSON-RPC notifications and final response
  --help                              Show this help
`;
}

export function parseAgentArgs(argv: string[], cwd = process.cwd()): AgentCliOptions {
  const values: Record<string, string[]> = {};
  const promptParts: string[] = [];
  let stream = false;
  let json = false;
  let passthroughPrompt = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;

    if (passthroughPrompt) {
      promptParts.push(arg);
      continue;
    }

    if (arg === "--") {
      passthroughPrompt = true;
      continue;
    }

    if (arg === "--stream") {
      stream = true;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      throw new Error("__HELP__");
    }

    if (VALUE_FLAGS.has(arg)) {
      const value = argv[i + 1];
      if (value === undefined || (value.startsWith("-") && !/^-?\d+$/.test(value))) {
        throw new Error(`${arg} requires a value`);
      }
      values[arg] = [...(values[arg] ?? []), value];
      i++;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown agent option: ${arg}`);
    }

    promptParts.push(arg);
  }

  const prompt = promptParts.join(" ").trim();
  if (!prompt) {
    throw new Error("agent prompt is required");
  }

  const workspace = values["--workspace"]?.at(-1) ?? values["-C"]?.at(-1) ?? cwd;
  const maxTurnsRaw = values["--max-turns"]?.at(-1);
  const timeoutRaw = values["--timeout-ms"]?.at(-1);
  const allowedTools = values["--allowed-tools"]?.flatMap(splitCsv);
  const disallowedTools = values["--disallowed-tools"]?.flatMap(splitCsv);
  const envEntries = values["--env"]?.map(parseEnvAssignment);
  const env = envEntries && envEntries.length > 0 ? Object.fromEntries(envEntries) : undefined;

  return {
    workspace: path.resolve(cwd, workspace),
    prompt,
    stream,
    json,
    ...(values["--model"]?.at(-1) ? { model: values["--model"]!.at(-1)! } : {}),
    ...(values["--permission-mode"]?.at(-1) ? { permissionMode: values["--permission-mode"]!.at(-1)! } : {}),
    ...(maxTurnsRaw !== undefined ? { maxTurns: parsePositiveInt(maxTurnsRaw, "--max-turns") } : {}),
    ...(values["--system-prompt"]?.at(-1) ? { systemPrompt: values["--system-prompt"]!.at(-1)! } : {}),
    ...(allowedTools && allowedTools.length > 0 ? { allowedTools } : {}),
    ...(disallowedTools && disallowedTools.length > 0 ? { disallowedTools } : {}),
    ...(values["--template"]?.at(-1) ? { template: values["--template"]!.at(-1)! } : {}),
    ...(timeoutRaw !== undefined ? { timeoutMs: parsePositiveInt(timeoutRaw, "--timeout-ms") } : {}),
    ...(values["--anthropic-base-url"]?.at(-1) ? { anthropicBaseUrl: values["--anthropic-base-url"]!.at(-1)! } : {}),
    ...(values["--anthropic-api-key"]?.at(-1) ? { anthropicApiKey: values["--anthropic-api-key"]!.at(-1)! } : {}),
    ...(values["--anthropic-auth-token"]?.at(-1)
      ? { anthropicAuthToken: values["--anthropic-auth-token"]!.at(-1)! }
      : {}),
    ...(env ? { env } : {}),
  };
}

function stringifyLine(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

function extractAssistantText(message: unknown): string | null {
  if (message === null || typeof message !== "object") return null;
  const msg = message as Record<string, unknown>;
  const inner = msg["message"];
  const content =
    inner !== null && typeof inner === "object"
      ? (inner as Record<string, unknown>)["content"]
      : msg["content"];

  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;

  const parts: string[] = [];
  for (const block of content) {
    if (block && typeof block === "object") {
      const typed = block as Record<string, unknown>;
      if (typed["type"] === "text" && typeof typed["text"] === "string") {
        parts.push(typed["text"]);
      }
    }
  }
  return parts.length > 0 ? parts.join("") : null;
}

function extractToolName(message: unknown): string | null {
  if (message === null || typeof message !== "object") return null;
  const msg = message as Record<string, unknown>;
  const inner = msg["message"];
  const content =
    inner !== null && typeof inner === "object"
      ? (inner as Record<string, unknown>)["content"]
      : msg["content"];
  if (!Array.isArray(content)) return null;

  for (const block of content) {
    if (block && typeof block === "object") {
      const typed = block as Record<string, unknown>;
      if (typed["type"] === "tool_use" && typeof typed["name"] === "string") {
        return typed["name"];
      }
    }
  }
  return null;
}

export function renderAgentNotification(message: unknown, io: AgentCliIo, state: { streamed: boolean }): void {
  if (message === null || typeof message !== "object") return;
  const msg = message as Record<string, unknown>;
  const method = msg["method"];
  const params = msg["params"];
  if (typeof method !== "string" || params === null || typeof params !== "object") return;

  const p = params as Record<string, unknown>;

  if (method === "bridge/stream_chunk" && typeof p["content"] === "string") {
    io.stdout.write(p["content"]);
    state.streamed = true;
    return;
  }

  if (method !== "bridge/session_event") return;

  switch (p["type"]) {
    case "session_started":
      io.stderr.write(`Session started: ${String(p["sessionId"])}\n`);
      return;
    case "session_resumed":
      io.stderr.write(`Session resumed: ${String(p["sessionId"])}\n`);
      return;
    case "agent_message": {
      const messageType = p["messageType"];
      if (messageType === "assistant_text" && !state.streamed) {
        const text = extractAssistantText(p["message"]);
        if (text) io.stdout.write(`${text}\n`);
      } else if (messageType === "tool_use") {
        const toolName = extractToolName(p["message"]) ?? "tool";
        io.stderr.write(`Tool: ${toolName}\n`);
      }
      return;
    }
    case "session_stopped":
      io.stderr.write("Session stopped\n");
      return;
    default:
      return;
  }
}

function buildSessionParams(options: AgentCliOptions): Record<string, unknown> {
  const env: Record<string, string | undefined> = {
    ...(options.anthropicBaseUrl !== undefined ? { ANTHROPIC_BASE_URL: options.anthropicBaseUrl } : {}),
    ...(options.anthropicApiKey !== undefined ? { ANTHROPIC_API_KEY: options.anthropicApiKey } : {}),
    ...(options.anthropicAuthToken !== undefined ? { ANTHROPIC_AUTH_TOKEN: options.anthropicAuthToken } : {}),
    ...(options.env ?? {}),
  };
  const sdkOptions = Object.keys(env).length > 0 ? { env } : undefined;

  return {
    workspace: options.workspace,
    prompt: options.prompt,
    stream: options.stream,
    ...(options.model !== undefined ? { model: options.model } : {}),
    ...(options.permissionMode !== undefined ? { permissionMode: options.permissionMode } : {}),
    ...(options.maxTurns !== undefined ? { maxTurns: options.maxTurns } : {}),
    ...(options.systemPrompt !== undefined ? { systemPrompt: options.systemPrompt } : {}),
    ...(options.allowedTools !== undefined ? { allowedTools: options.allowedTools } : {}),
    ...(options.disallowedTools !== undefined ? { disallowedTools: options.disallowedTools } : {}),
    ...(options.template !== undefined ? { template: options.template } : {}),
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    ...(sdkOptions !== undefined ? { options: sdkOptions } : {}),
  };
}

export async function runAgentCli(
  argv: string[],
  io: AgentCliIo,
  runOptions: AgentCliRunOptions = {},
): Promise<number> {
  let options: AgentCliOptions;
  try {
    options = parseAgentArgs(argv);
  } catch (error) {
    if (error instanceof Error && error.message === "__HELP__") {
      io.stdout.write(agentCliHelp());
      return 0;
    }
    io.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    io.stderr.write(agentCliHelp());
    return 1;
  }

  const renderState = { streamed: false };
  const notify = (message: unknown): void => {
    if (options.json) {
      io.stdout.write(stringifyLine(message));
      return;
    }
    renderAgentNotification(message, io, renderState);
  };

  const server = runOptions.createServer
    ? runOptions.createServer(notify)
    : new BridgeServer({
        notify,
        sessionsDir: runOptions.sessionsDir ?? path.join(os.homedir(), ".ai-spec-sdk", "sessions"),
      });

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: "agent-cli",
    method: "session.start",
    params: buildSessionParams(options),
  });

  if (options.json) {
    io.stdout.write(stringifyLine(response));
    return response.error ? 1 : 0;
  }

  if (response.error) {
    io.stderr.write(`Error: ${response.error.message}\n`);
    return 1;
  }

  const result = (response as JsonRpcResponse).result as Record<string, unknown> | undefined;
  if (renderState.streamed) {
    io.stdout.write("\n");
  } else if (typeof result?.["result"] === "string") {
    io.stdout.write(`${result["result"]}\n`);
  }

  const usage = result?.["usage"];
  if (usage && typeof usage === "object") {
    io.stderr.write(`Usage: ${JSON.stringify(usage)}\n`);
  }

  return 0;
}

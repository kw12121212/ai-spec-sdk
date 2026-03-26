import { query } from "@anthropic-ai/claude-agent-sdk";

type QueryFunction = typeof query;

// Test hook: inject a stub query function via globalThis.__AI_SPEC_SDK_QUERY__
// to avoid real Anthropic API calls in tests.
declare global {
  // eslint-disable-next-line no-var
  var __AI_SPEC_SDK_QUERY__: QueryFunction | undefined;
}

function getQueryFunction(): QueryFunction {
  return globalThis.__AI_SPEC_SDK_QUERY__ ?? query;
}

export interface RunClaudeQueryOptions {
  prompt: string;
  options: Record<string, unknown>;
  onEvent: (message: unknown) => void;
  shouldStop?: () => boolean;
}

export interface QueryResult {
  status: "completed" | "stopped";
  result: unknown;
}

export async function runClaudeQuery({
  prompt,
  options,
  onEvent,
  shouldStop = () => false,
}: RunClaudeQueryOptions): Promise<QueryResult> {
  const queryFn = getQueryFunction();
  let terminalResult: unknown = null;

  for await (const message of queryFn({ prompt, options } as Parameters<QueryFunction>[0])) {
    if (shouldStop()) {
      return {
        status: "stopped",
        result: null,
      };
    }

    onEvent(message);

    if (
      message !== null &&
      typeof message === "object" &&
      Object.prototype.hasOwnProperty.call(message, "result")
    ) {
      terminalResult = (message as Record<string, unknown>)["result"];
    }
  }

  return {
    status: "completed",
    result: terminalResult,
  };
}

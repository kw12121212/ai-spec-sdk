import { BridgeError } from "./errors.js";

export async function resolveQueryFunction() {
  if (globalThis.__AI_SPEC_SDK_QUERY__) {
    return globalThis.__AI_SPEC_SDK_QUERY__;
  }

  try {
    const mod = await import("@anthropic-ai/claude-agent-sdk");
    if (typeof mod.query !== "function") {
      throw new Error("module does not export query");
    }
    return mod.query;
  } catch {
    throw new BridgeError(
      -32020,
      "Claude Agent SDK query function is unavailable",
      {
        hint: "Install @anthropic-ai/claude-agent-sdk or inject a query function for tests.",
      },
    );
  }
}

export async function runClaudeQuery({ prompt, options, onEvent, shouldStop = () => false }) {
  const query = await resolveQueryFunction();
  let terminalResult = null;

  for await (const message of query({ prompt, options })) {
    if (shouldStop()) {
      return {
        status: "stopped",
        result: null,
      };
    }

    onEvent(message);

    if (message && Object.prototype.hasOwnProperty.call(message, "result")) {
      terminalResult = message.result;
    }
  }

  return {
    status: "completed",
    result: terminalResult,
  };
}

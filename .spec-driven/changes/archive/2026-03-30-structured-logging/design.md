# Design: structured-logging

## Approach

Create a singleton `Logger` in `src/logger.ts` that:
1. Reads the initial level from `AI_SPEC_SDK_LOG_LEVEL` (case-insensitive, defaults to `info`)
2. Formats each entry as a single JSON line: `{ timestamp, level, message, ...context }`
3. Writes to `process.stderr` via `stderr.write()` — synchronous, no buffering
4. Exposes level-specific methods (`logger.trace()`, `logger.debug()`, etc.) that skip formatting when the level is filtered out
5. Supports a `.child(bindings)` method to create scoped loggers that automatically attach context (e.g., `{ sessionId }` for all calls within a session handler)

The `BridgeServer` constructor accepts an optional `logger` option. When omitted, the default singleton is used. This allows tests to inject a silent or capturing logger.

### Integration points

- **bridge.ts dispatch**: log method name, duration (ms), and any error at the end of each `handleMessage` call
- **session-store.ts**: log session create, complete, stop, interrupt events
- **claude-agent-runner.ts**: log SDK query start, stop, error
- **mcp-store.ts**: log MCP server start, stop, error lifecycle
- **workflow.ts**: log workflow execution start, result, error
- **config-store.ts**, **context-store.ts**, **hooks-store.ts**, **workspace-store.ts**: log write operations and errors

### bridge.setLogLevel

New JSON-RPC method with parameter `{ level: string }`. Validates the level against the five known levels; returns `-32602` on invalid input. Responds with `{ level: "<new-level>" }`.

## Key Decisions

- **No external dependency** — hand-rolled logger keeps bundle small and avoids supply-chain risk
- **JSON lines to stderr** — stdout reserved for JSON-RPC; stderr is the standard log channel for CLI tools
- **Synchronous writes** — `stderr.write()` is synchronous in practice for pipe/terminal destinations; avoids event-loop complexity
- **Child loggers** — `.child({ sessionId })` pattern avoids manually threading sessionId through every call site
- **Singleton + injectable** — default singleton for production; injectable for testing

## Alternatives Considered

- **Winston / pino / bunyan** — rejected to avoid external dependencies; the logging needs are simple enough for a hand-rolled solution
- **Log to file** — rejected; use external tooling (`2>bridge.log` or `systemd`) to capture stderr
- **Async/queued writes** — rejected; adds complexity with no benefit for stderr output

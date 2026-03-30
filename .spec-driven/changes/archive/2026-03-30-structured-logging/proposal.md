# Proposal: structured-logging

## What
Introduce a unified, structured logging system that outputs JSON lines to stderr with configurable log levels and session-scoped context. Replace all ad-hoc error handling with consistent log calls across the bridge and its sub-modules.

## Why
- The bridge currently has no observability — errors in dispatch, session lifecycle, MCP server management, and workflow execution are silently swallowed or only surfaced as JSON-RPC error responses.
- Upcoming roadmap features (session persistence, HTTP/SSE transport, auth) depend on structured logging for debugging and audit trails.
- JSON lines to stderr keeps stdout clean for JSON-RPC while giving operators machine-readable logs for `tee`, `systemd`, or log aggregation.

## Scope
- New `src/logger.ts` module with five levels: `trace`, `debug`, `info`, `warn`, `error`
- Each log entry: `timestamp`, `level`, `message`, optional `sessionId`, `method`, `durationMs`, `error`
- JSON lines output to stderr
- Configurable via `AI_SPEC_SDK_LOG_LEVEL` env var (default: `info`)
- Integration into: `bridge.ts`, `session-store.ts`, `claude-agent-runner.ts`, `mcp-store.ts`, `workflow.ts`, `config-store.ts`, `context-store.ts`, `hooks-store.ts`, `workspace-store.ts`
- New JSON-RPC method `bridge.setLogLevel` for runtime level adjustment

## Unchanged Behavior
- JSON-RPC request/response on stdout is unaffected
- All existing methods, error codes, and notification schemas remain identical
- No external dependencies added
- No changes to session persistence format or bridge capabilities (except the new `bridge.setLogLevel` method)

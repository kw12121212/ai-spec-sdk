# Python Client SDK

## What

Provide an official PyPI package (`ai-spec-sdk`) that wraps the official `claude-agent-sdk` Python package for stdio mode and connects to the ai-spec-sdk bridge via HTTP/SSE for full-featured bridge access. The SDK offers a unified async `BridgeClient` API that works across both transports.

## Why

- Python is the dominant language for AI/ML developers — the largest audience for agent tooling
- The official `claude-agent-sdk` Python package already handles CLI subprocess management, message types, and streaming; wrapping it avoids reinventing that infrastructure
- HTTP mode unlocks the bridge's full feature set (session persistence, search, branching, config, MCP lifecycle) for Python consumers
- A unified API means consumers write the same code regardless of transport, switching only the constructor parameter

## Scope

- PyPI package `ai-spec-sdk`, Python 3.10+
- `BridgeClient` with `transport="stdio"` (wraps `claude-agent-sdk`) and `transport="http"` (connects to bridge)
- Stdio mode: session start/resume/stop, streaming, agent control parameters (model, allowedTools, permissionMode, maxTurns, systemPrompt), custom tools, hooks
- HTTP mode: full bridge JSON-RPC method surface (all 39+ methods), SSE event streaming with reconnection, Bearer token auth
- Typed request/response types for all methods
- Event listener API: `client.on("session_event", handler)`
- Stdio mode raises `UnsupportedInStdioError` for bridge-only methods (session.list, session.search, config.*, etc.)

## Unchanged Behavior

- The ai-spec-sdk bridge (TypeScript) is not modified
- The existing TypeScript Client SDK (`@ai-spec-sdk/client`) is not modified
- The `claude-agent-sdk` Python package is used as-is, not forked or patched

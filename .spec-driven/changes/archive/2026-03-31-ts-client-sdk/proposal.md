# Proposal: ts-client-sdk

## What

Create an official npm package `@ai-spec-sdk/client` providing a type-safe TypeScript client for the ai-spec-sdk bridge. The client supports both stdio (subprocess) and HTTP/SSE transports with typed methods for all 39 bridge methods and an event listener API.

## Why

The bridge exposes 39+ JSON-RPC methods over stdio and HTTP/SSE transports. Currently every consumer (Go CLI, mobile web UI, future Python SDK) must implement its own JSON-RPC framing, transport logic, and type mapping. An official TypeScript client gives Node.js/Bun users a zero-boilerplate, type-safe integration path.

## Scope

- New package at `packages/client/` with own `package.json`, `tsconfig.json`
- Type-safe request/response interfaces for all 39 bridge methods derived from `docs/bridge-contract.yaml`
- Transport abstraction: `StdioTransport` (spawn bridge subprocess) and `HttpTransport` (POST /rpc + GET /events SSE)
- `BridgeClient` class with typed method dispatch and EventEmitter-based notification API
- SSE reconnection with exponential backoff (1s to 30s cap) for HTTP transport
- Unit tests with mock transport layer
- Integration tests against a real bridge subprocess
- Zero external runtime dependencies (uses Node.js built-in `fetch`, `EventSource`, `child_process`)

## Unchanged Behavior

- The existing bridge server code (`src/bridge.ts`, `src/http-server.ts`, `src/cli.ts`) is not modified.
- The bridge contract (`docs/bridge-contract.yaml`) is unchanged.
- All existing tests continue to pass unchanged.
- The client is a pure consumer; no new bridge methods or capabilities are needed.

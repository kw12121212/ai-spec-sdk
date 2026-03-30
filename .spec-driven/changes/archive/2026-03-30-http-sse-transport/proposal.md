# http-sse-transport

## What

Add HTTP + Server-Sent Events as a standalone alternative transport for the Bridge. Clients can reach the bridge over HTTP without spawning a subprocess: `POST /rpc` for JSON-RPC calls and `GET /events?sessionId=...` for streaming notifications via SSE.

## Why

The existing stdio transport requires callers to manage a child process. Web clients, remote dashboards, and polyglot tools benefit from a network-addressable bridge that reuses the same `BridgeServer` core without duplicating business logic.

## Scope

**In scope:**
- `src/http-server.ts` — standalone HTTP server using Node.js built-in `http` module (no external framework)
- `POST /rpc` — accepts a JSON-RPC 2.0 body, delegates to `BridgeServer.handleMessage`, returns the JSON response
- `GET /events?sessionId=<id>` — SSE stream scoped to a session; notifications that carry a matching `sessionId` are pushed to all subscribers of that session; notifications without a `sessionId` are not sent to any SSE connection; multiple clients may subscribe to the same session (fan-out)
- `GET /health` — returns `{ status: "ok", apiVersion }`
- CORS headers configurable via `AI_SPEC_SDK_CORS_ORIGINS` env var (default: `*`)
- Content-Type validation and 10 MB body size limit on `POST /rpc`
- Graceful shutdown: on `SIGTERM`, drain in-flight `POST /rpc` requests, then close all SSE connections
- `src/cli.ts` updated to accept `--transport http`, `--port <n>` flags and `AI_SPEC_SDK_TRANSPORT` / `AI_SPEC_SDK_PORT` env vars
- `bridge.capabilities` response gains a `transport` field (`"stdio"` or `"http"`)

**Out of scope:**
- Dual transport (stdio + HTTP simultaneously in one process)
- WebSocket transport
- HTTPS / TLS termination (handled at reverse proxy)
- Rate limiting (covered in the future Auth phase)

## Unchanged Behavior

- Stdio transport behaviour is entirely unchanged; the default launch mode continues to work as before
- All JSON-RPC methods, error codes, and notification schemas remain identical across transports
- `BridgeServer` internal logic is not modified; HTTP is a transport adapter only

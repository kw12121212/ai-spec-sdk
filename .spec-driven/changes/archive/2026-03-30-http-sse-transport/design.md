# Design: http-sse-transport

## Approach

The HTTP server is implemented as a thin adapter in `src/http-server.ts`. It creates a `BridgeServer` instance with a custom `notify` callback that routes notifications to the SSE manager instead of stdout.

**SSE Manager** (`SseManager` class inside `http-server.ts`):
- Holds `Map<sessionId, Set<ServerResponse>>` — each SSE connection is a `ServerResponse` registered by `sessionId`
- On `notify(message)`: inspect message for a `sessionId` field; if present, look up the matching set and write the SSE event to each subscriber; if absent, drop the notification
- On SSE connection close (client disconnect): remove the `ServerResponse` from the set; remove the map entry when the set becomes empty

**Request handling** (single `http.createServer` handler):
- `POST /rpc`: read body up to 10 MB; reject with 413 on overflow; parse JSON; call `server.handleMessage`; write JSON response; track in-flight count for graceful shutdown
- `GET /events`: validate `sessionId` query param (400 if missing); register SSE connection; send initial comment `: connected\n\n` to flush; keep alive with 30-second heartbeat comments
- `GET /health`: write `{ status: "ok", apiVersion }` immediately
- Anything else: 404

**Graceful shutdown** (`startHttpServer` returns a `shutdown()` function):
- On `SIGTERM`: stop accepting new connections (`server.close()`); wait for in-flight `POST /rpc` counter to reach 0 (poll with `setInterval`, 50 ms); then close all SSE connections; resolve

**CLI integration** (`src/cli.ts`):
- Read `AI_SPEC_SDK_TRANSPORT` env (default `"stdio"`) and `AI_SPEC_SDK_PORT` env (default `"8765"`)
- Parse `--transport` and `--port` CLI flags (simple `process.argv` scan, no new dependencies)
- Branch: if transport is `"http"`, call `startHttpServer({ port, sessionsDir })`; otherwise run existing stdio loop

## Key Decisions

- **No external framework** — Node.js `http` is sufficient; avoids new dependencies and keeps the bundle small
- **Separate launch modes** — stdio and HTTP are not run simultaneously; simpler operational model, no shared state concerns
- **Session-scoped SSE only** — notifications without `sessionId` (e.g., future global events) are silently dropped rather than broadcast; prevents accidental information leakage to wrong subscribers
- **Fan-out in SSE manager** — multiple subscribers per sessionId is supported without changing `BridgeServer`; the adapter layer handles the multiplexing
- **`transport` in capabilities** — lets clients detect which transport is active without out-of-band configuration

## Alternatives Considered

- **Express / Fastify**: adds a dependency for marginal DX benefit; rejected per project rule of minimal dependencies
- **Dual transport mode**: adds complexity (shared `notify` fan-out across both transports, SSE + stdout); use cases don't justify it
- **Broadcast all notifications to all SSE connections**: simpler routing but leaks session data across subscribers; rejected

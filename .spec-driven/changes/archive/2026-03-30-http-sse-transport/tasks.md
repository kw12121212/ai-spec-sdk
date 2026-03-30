# Tasks: http-sse-transport

## Implementation

- [x] Create `src/http-server.ts` with `SseManager` class and `startHttpServer(options)` export
- [x] Implement `POST /rpc` handler: body reading (10 MB limit), Content-Type check, `BridgeServer.handleMessage` delegation, JSON response
- [x] Implement `GET /events` handler: `sessionId` query param validation, SSE connection registration, 30-second heartbeat, disconnect cleanup
- [x] Implement SSE fan-out in `SseManager.notify`: route to matching sessionId subscribers; drop notifications without `sessionId`
- [x] Implement `GET /health` handler: return `{ status: "ok", apiVersion }`
- [x] Add CORS headers using `AI_SPEC_SDK_CORS_ORIGINS` env var (default `*`)
- [x] Implement graceful shutdown: `SIGTERM` handler, in-flight counter, drain + SSE close
- [x] Update `src/cli.ts`: parse `--transport` / `--port` flags and `AI_SPEC_SDK_TRANSPORT` / `AI_SPEC_SDK_PORT` env vars; branch to `startHttpServer` or existing stdio loop
- [x] Add `transport` field to `bridge.capabilities` response in `src/capabilities.ts`

## Testing

- [x] Test `POST /rpc` happy path: valid JSON-RPC request returns correct response
- [x] Test `POST /rpc` error cases: oversized body (413), wrong Content-Type (415), invalid JSON (-32700)
- [x] Test `GET /health` returns `{ status: "ok", apiVersion }`
- [x] Test `GET /events` missing `sessionId` returns 400
- [x] Test SSE fan-out: two subscribers for same sessionId both receive a session-scoped notification
- [x] Test SSE drop: notification without `sessionId` is not written to any SSE connection
- [x] Test graceful shutdown: in-flight `POST /rpc` completes before SSE connections are closed
- [x] Test `bridge.capabilities` includes `transport: "http"` when started in HTTP mode

## Testing (continued)

- [x] Lint passes (`bun run typecheck`)
- [x] All existing tests continue to pass (stdio transport unchanged)

## Verification

- [x] `GET /health` responds correctly when bridge is started with `--transport http`
- [x] `POST /rpc` with `bridge.ping` returns `{ pong: true, ts: ... }` over HTTP
- [x] SSE stream delivers `bridge/session_event` notifications scoped to the correct sessionId
- [x] Notifications without `sessionId` do not appear on any SSE connection
- [x] `SIGTERM` causes graceful drain (no abrupt SSE disconnects while requests are in flight)
- [x] `--transport stdio` (default) behaviour is unchanged
- [x] Update `docs/bridge-contract.yaml` with HTTP transport endpoints and `transport` capability field

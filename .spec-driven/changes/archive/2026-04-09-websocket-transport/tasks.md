# Tasks: websocket-transport

## Implementation
- [x] Implement `WebSocketTransport` handler in `src/http-server.ts` utilizing `Bun.serve({ websocket: ... })` at `/ws`.
- [x] Implement JSON-RPC 2.0 message framing and multiplexing within the WebSocket handler.
- [x] Implement ping/pong keepalive logic.
- [x] Update session management to register WebSocket connections for event subscriptions.
- [x] Ensure `bridge.info` and `GET /` report `ws` transport appropriately.
- [x] Implement `WebSocketTransport` class in `@ai-spec-sdk/client` (TypeScript) with automatic reconnection.
- [x] Implement `WebSocketTransport` class in `ai-spec-sdk` (Python) with automatic reconnection.

## Testing
- [x] Run lint validation via `bun run check.sh`
- [x] Run unit tests via `bun run test.sh`
- [x] Add unit tests for TypeScript `WebSocketTransport` focusing on connection lifecycle and reconnection logic.
- [x] Add unit tests for Python `WebSocketTransport` focusing on connection lifecycle and reconnection logic.
- [x] Add integration tests for the bridge server's `/ws` endpoint, validating JSON-RPC request multiplexing, event fan-out, and ping/pong keepalive.

## Verification
- [x] Verify `bridge.info` reports `transport: "ws"` over a WebSocket connection.
- [x] Verify `GET /` reports `transport: "ws"` when started with `--transport ws`.
- [x] Verify event subscriptions work correctly, fanning out events to multiple connected WebSocket clients.
- [x] Verify graceful shutdown (`SIGTERM`) drains requests and closes connections properly.
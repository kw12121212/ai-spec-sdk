# websocket-transport

## ADDED Requirements

### Requirement: Support ws transport for bidirectional JSON-RPC 2.0 communication over WebSocket framing.
This requirement specifies that the bridge server MUST accept and manage WebSocket connections to facilitate the JSON-RPC 2.0 protocol identically to the HTTP/SSE and STDIO transports.

### Requirement: Accept connections on the `/ws` path, sharing the same port as the HTTP server.
The WebSocket endpoint MUST be mapped to `/ws` so that it uses the same underlying HTTP server port, simplifying deployment and avoiding cross-origin complexities.

### Requirement: Implement ping/pong keepalive messages.
The bridge server MUST periodically send ping frames to connected clients and expect pong frames in return to detect and aggressively prune dead connections.

### Requirement: Support session-scoped event subscriptions over the WebSocket connection.
Events emitted within a specific session MUST be fanned out to all WebSocket clients that have successfully authenticated and bound themselves to that session ID.

### Requirement: Ensure `bridge.info` reports `transport: "ws"` when connected via WebSocket.
When a client issues a `bridge.info` request over a WebSocket connection, the response MUST indicate the transport type as "ws" to accurately reflect the connection medium.

### Requirement: Ensure `GET /` reports `transport: "ws"` when the bridge is started with `--transport ws`.
If the bridge is configured exclusively for WebSocket transport via command-line arguments, the root health check endpoint MUST report "ws" as the primary transport.

### Requirement: Disconnect idle clients gracefully.
The server MUST implement a timeout mechanism to gracefully close WebSocket connections that have not exhibited activity or responded to pings within a configurable threshold.

### Requirement: Handle `SIGTERM` gracefully, draining requests before closing connections.
Upon receiving a termination signal, the server MUST stop accepting new WebSocket connections, allow in-flight JSON-RPC requests to complete, and then initiate a clean close handshake with all connected clients before exiting.

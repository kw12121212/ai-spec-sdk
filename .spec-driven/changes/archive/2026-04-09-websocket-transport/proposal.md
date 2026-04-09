# Proposal: websocket-transport

## What
Implement bidirectional WebSocket transport with JSON-RPC 2.0 framing, ping/pong keepalive, and session-scoped event subscriptions.

## Why
Real-time bidirectional communication is foundational for Advanced Runtime features, such as multi-agent orchestration, and provides a lower latency, unified connection for both RPC requests and event streams compared to HTTP/SSE.

## Scope
-   Add WebSocket transport support to the bridge server using Bun's native `Bun.serve({ websocket: ... })`.
-   Expose the WebSocket endpoint at `/ws`.
-   Implement JSON-RPC 2.0 framing over WebSocket messages.
-   Implement ping/pong keepalive.
-   Support session-scoped event subscriptions over the WebSocket connection.
-   Update `@ai-spec-sdk/client` (TypeScript) with a `WebSocketTransport` supporting automatic reconnection with exponential backoff.
-   Update `ai-spec-sdk` (Python) with a `WebSocketTransport` supporting automatic reconnection with exponential backoff.

## Unchanged Behavior
-   Existing `stdio` and `http` (`/rpc`, `/events`) transports remain unchanged and functional.
-   The core JSON-RPC 2.0 message format and existing method signatures remain unchanged.

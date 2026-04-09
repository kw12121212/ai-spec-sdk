# Design: websocket-transport

## Approach
We will utilize Bun's native WebSocket support in `src/http-server.ts` to handle upgrade requests on the `/ws` path. A new `WebSocketTransport` class will manage the connections, framing JSON-RPC 2.0 messages for requests and notifications. The client SDKs will implement corresponding `WebSocketTransport` classes that manage connection lifecycle, request multiplexing, and automatic reconnection.

## Key Decisions
-   **Native Bun WebSockets:** We will use `Bun.serve({ websocket: ... })` instead of introducing an external dependency like `ws`, as the project is already built on Bun.
-   **Endpoint Path:** The WebSocket server will listen on the `/ws` path, sharing the same port as the HTTP server.
-   **Reconnection Strategy:** Client SDKs will implement automatic reconnection with exponential backoff to handle network interruptions gracefully, mirroring the SSE reconnection behavior.

## Alternatives Considered
-   **External `ws` Library:** Considered using the `ws` npm package for broader Node.js compatibility, but rejected in favor of Bun's native implementation to minimize dependencies and leverage the existing runtime environment.
-   **Separate Port:** Considered running the WebSocket server on a separate port, but rejected to simplify deployment and configuration by multiplexing over the existing HTTP port.

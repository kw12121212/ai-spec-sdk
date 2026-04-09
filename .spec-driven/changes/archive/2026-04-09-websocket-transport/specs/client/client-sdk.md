# Delta Specification: client-sdk.md

## MODIFIED Requirements

### Requirement: Modify `client/client-sdk.md` to include a `WebSocketTransport` class in `@ai-spec-sdk/client`.
This modifies the client SDK specification to define a new transport implementation based on the browser/Node WebSocket API.

### Requirement: The `WebSocketTransport` MUST implement the `Transport` interface.
The new transport MUST adhere strictly to the existing `Transport` contract to ensure seamless substitutability within the `createClient` factory.

### Requirement: The `WebSocketTransport` MUST support automatic reconnection with exponential backoff on disconnect.
The client MUST autonomously attempt to re-establish dropped WebSocket connections, utilizing an exponential backoff strategy to prevent server overload during widespread network interruptions.

### Requirement: The `WebSocketTransport` MUST multiplex JSON-RPC 2.0 requests and notifications over the single connection.
A single WebSocket connection MUST be used for both issuing RPC requests and receiving asynchronous notifications from the server, managing request IDs and event dispatching internally.

### Requirement: Update `createClient` to support instantiating `WebSocketTransport`.
The `createClient` factory function MUST be extended to accept WebSocket URIs (ws:// or wss://) or specific configuration options that trigger the instantiation of the `WebSocketTransport`.

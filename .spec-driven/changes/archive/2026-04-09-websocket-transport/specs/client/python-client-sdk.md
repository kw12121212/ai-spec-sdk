# Delta Specification: python-client-sdk.md

## MODIFIED Requirements

### Requirement: Modify `client/python-client-sdk.md` to include a `WebSocketTransport` class in the `ai-spec-sdk` Python package.
This modifies the Python SDK specification to define a new asynchronous transport implementation utilizing a suitable Python WebSocket client library.

### Requirement: The `WebSocketTransport` MUST implement the `Transport` interface (or Python equivalent).
The new Python transport MUST adhere strictly to the internal Python transport abstraction to ensure seamless substitutability within the `BridgeClient`.

### Requirement: The `WebSocketTransport` MUST support automatic reconnection with exponential backoff on disconnect.
The Python client MUST autonomously attempt to re-establish dropped WebSocket connections, utilizing an exponential backoff strategy to ensure robust long-running sessions.

### Requirement: The `WebSocketTransport` MUST multiplex JSON-RPC 2.0 requests and notifications over the single connection.
The Python transport MUST handle sending requests and routing asynchronous responses and notifications over the same underlying WebSocket stream.

### Requirement: Update `BridgeClient` to support instantiating `WebSocketTransport` using `ws://` URIs.
The Python `BridgeClient` initialization logic MUST be updated to recognize `ws://` and `wss://` URI schemes and instantiate the `WebSocketTransport` accordingly.

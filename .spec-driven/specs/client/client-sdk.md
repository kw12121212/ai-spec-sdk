## ADDED Requirements

### Requirement: Stream Chunk Event Type
The `BridgeClient` event listener MUST support `stream_chunk` as a `messageType` value within `session_event` notifications. Clients using `client.on('session_event', handler)` MUST receive `stream_chunk` events when the connected session has streaming enabled.

#### Scenario: Client receives stream_chunk events
- GIVEN a `BridgeClient` is connected to a bridge with a streaming session
- WHEN the bridge emits a `stream_chunk` event
- THEN the client's `session_event` handler receives the event with `messageType: "stream_chunk"`, `content`, and `index`

### Requirement: Stream Parameter in Session Methods
The `BridgeClient.session.start()` and `BridgeClient.session.resume()` methods MUST accept an optional `stream: boolean` parameter. When set to `true`, the parameter MUST be passed to the bridge in the JSON-RPC request.

#### Scenario: Start session with streaming via client SDK
- GIVEN a client calls `client.session.start({ ..., stream: true })`
- WHEN the request is sent to the bridge
- THEN the JSON-RPC params include `stream: true`
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

### Requirement: TypeScript Client Session Spawn Support
The `@ai-spec-sdk/client` package MUST expose a `sessionSpawn` method that sends the `session.spawn` JSON-RPC request.

The method MUST:
- require `parentSessionId`
- accept the same agent control parameters as `sessionStart`, except for `workspace`
- return the same response shape used by other session creation methods

#### Scenario: Spawn a child session through the TypeScript client
- GIVEN a TypeScript client is connected to the bridge
- WHEN the caller invokes `client.sessionSpawn({ parentSessionId, prompt })`
- THEN the client sends a `session.spawn` request with those params

### Requirement: TypeScript Client Parent Metadata Types
The TypeScript client session metadata types MUST expose `parentSessionId`.

Session list entries and session status/export result types MUST include `parentSessionId: string | null`.

#### Scenario: Read parent linkage from typed session metadata
- GIVEN the bridge returns session metadata for a child session
- WHEN the TypeScript client consumes that response
- THEN the typed result exposes the child session's `parentSessionId`

### Requirement: TypeScript Client Subagent Notification Typing
The TypeScript client event API MUST support `bridge/subagent_event` notifications.

The typed notification payload MUST include:
- `sessionId`
- `subagentId`
- `type`

#### Scenario: Subscribe to child notifications from a parent session
- GIVEN a TypeScript client registers `on("bridge/subagent_event", handler)`
- WHEN the bridge emits a subagent notification
- THEN the handler receives the parsed notification

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

## ADDED Requirements

### Requirement: Streaming Session Parameter
When `session.start` or `session.resume` is called with `stream: true`, the bridge MUST emit `stream_chunk` events for each text delta produced by the agent. When `stream` is omitted or `false`, the bridge MUST NOT emit `stream_chunk` events and behavior MUST be identical to current non-streaming behavior.

The `stream` parameter MUST be optional and default to `false`.

#### Scenario: Session started with streaming enabled
- GIVEN a client calls `session.start` with `{ ..., stream: true }`
- WHEN the agent produces text output
- THEN the bridge emits `stream_chunk` events for each text delta followed by a complete `assistant_text` event

#### Scenario: Session started without streaming (default)
- GIVEN a client calls `session.start` without a `stream` parameter
- WHEN the agent produces text output
- THEN the bridge emits only `assistant_text` events (no `stream_chunk`), identical to pre-streaming behavior

#### Scenario: Session resumed with streaming
- GIVEN a client calls `session.resume` with `{ sessionId, prompt, stream: true }`
- WHEN the agent produces text output
- THEN the bridge emits `stream_chunk` events followed by a complete `assistant_text` event

### Requirement: Stream Chunk Event
When streaming is enabled for a session, the bridge MUST emit a `bridge/session_event` notification with `type: "agent_message"` and `messageType: "stream_chunk"` for each `content_block_delta` event of type `text_delta` produced by the SDK.

Each `stream_chunk` event MUST include:
- `sessionId` (string)
- `type: "agent_message"`
- `messageType: "stream_chunk"`
- `content` (string — the text delta fragment)
- `index` (number — 0-based counter per assistant message turn, reset when a new assistant message begins)

After all `stream_chunk` events for an assistant message turn, the bridge MUST still emit the complete `assistant_text` event with the full text content.

`stream_chunk` events MUST NOT be emitted for `tool_use`, `tool_result`, or `result` message types.

#### Scenario: Text deltas produce stream_chunk events
- GIVEN a streaming session is active and the agent generates "Hello" then " world"
- WHEN the SDK emits two `content_block_delta` events with `type: "text_delta"`
- THEN the bridge emits two `stream_chunk` events with `content: "Hello"` and `content: " world"` respectively, followed by an `assistant_text` event with the full text

#### Scenario: Index increments per chunk within a turn
- GIVEN a streaming session receives three text deltas for one assistant message
- WHEN the bridge emits `stream_chunk` events
- THEN the `index` values are 0, 1, 2

#### Scenario: Index resets on new assistant message
- GIVEN a streaming session has emitted chunks with index 0..N for one assistant message
- WHEN the agent starts a new assistant message turn
- THEN the first `stream_chunk` of the new turn has `index: 0`

#### Scenario: Full assistant_text follows chunks
- GIVEN a streaming session has emitted `stream_chunk` events for an assistant message
- WHEN the complete assistant message arrives from the SDK
- THEN the bridge emits an `assistant_text` event with the complete text content

#### Scenario: Tool use does not produce stream_chunk
- GIVEN a streaming session is active and the agent emits a tool_use message
- WHEN the bridge processes the message
- THEN no `stream_chunk` event is emitted; only a `tool_use` event is emitted as usual

### Requirement: Streaming Capability Advertisement
The `bridge.capabilities` response MUST include a `streaming: true` field indicating that the bridge supports streaming token output.

#### Scenario: Capabilities include streaming field
- GIVEN a client calls `bridge.capabilities`
- WHEN the bridge returns its capability metadata
- THEN the response includes `streaming: true`

## ADDED Requirements

### Requirement: SSE Delivery of Stream Chunks
When a client is subscribed to `GET /events?sessionId=<id>` for a session with streaming enabled, `stream_chunk` events MUST be delivered over the SSE connection using the same `event: session_event` / `data: <json>` format as other session events.

#### Scenario: Stream chunk delivered via SSE
- GIVEN a client is subscribed to SSE for a streaming session
- WHEN the bridge emits a `stream_chunk` event for that session
- THEN the event is written to the SSE stream as `event: session_event` / `data: {"sessionId":"...","type":"agent_message","messageType":"stream_chunk","content":"...","index":0}`

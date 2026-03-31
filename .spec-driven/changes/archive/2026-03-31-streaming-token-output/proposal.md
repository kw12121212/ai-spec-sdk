# streaming-token-output

## What

Add real-time token-by-token streaming for agent text responses. When a session is started with `stream: true`, the bridge emits `stream_chunk` events for each `content_block_delta` from the SDK, allowing clients (web UI, TS Client SDK) to render text incrementally instead of waiting for the full message.

## Why

- **UX impact**: Users staring at a blank chat while the agent generates a long response is a poor experience. Streaming lets them see output as it arrives.
- **All dependencies are done**: HTTP/SSE transport and TS Client SDK are complete — streaming is the missing P0 piece in Phase 6 (v0.7.0).
- **Competitive parity**: Every major chat interface streams responses; non-streaming feels broken to users.

## Scope

- `session.start` / `session.resume` accept optional `stream: boolean` param (default `false`)
- New `messageType: "stream_chunk"` within `bridge/session_event` notifications
- Each `stream_chunk` carries `{ sessionId, type: "agent_message", messageType: "stream_chunk", content, index }`
- Full `assistant_text` still emitted after all chunks (backward compatibility)
- `bridge.capabilities` gains `streaming: true` field
- SSE and stdio transports both deliver `stream_chunk` events
- `claude-agent-runner.ts` reworked to intercept `content_block_delta` events from the SDK when streaming is enabled
- TS Client SDK: new `stream_chunk` event type in the event listener API
- Mobile Web UI: chat view renders `stream_chunk` events as incremental text append

## Unchanged Behavior

- `stream: false` (default) — identical to current behavior, no changes
- `tool_use` / `tool_result` messages — never streamed, always complete
- `session_completed` — always emitted with full result and usage
- Event buffer and `session.events` — `stream_chunk` events are buffered and replayable like any other event

# Tasks: streaming-token-output

## Implementation

- [x] Add `stream` param parsing to `session.start` and `session.resume` in `bridge.ts`
- [x] Store streaming flag per session in `SessionStore`
- [x] Update `runClaudeQuery` in `claude-agent-runner.ts` to accept a `stream` option
- [x] When `stream: true`, intercept `content_block_delta` events from the SDK iterator and emit `stream_chunk` notifications via `onEvent`
- [x] Track per-turn `index` counter in the streaming event emission
- [x] Ensure complete `assistant_text` is still emitted after all chunks for a turn
- [x] Add `streaming: true` to `bridge.capabilities` response in `capabilities.ts`
- [x] Update TS Client SDK (`packages/client/`): add `stream` param to `session.start`/`session.resume` typed methods
- [x] Update TS Client SDK: add `stream_chunk` to the `messageType` union type
- [x] Update Mobile Web UI (`src/ui/index.html`): add `stream_chunk` rendering in chat view SSE handler
- [x] Update Web UI: handle `assistant_text` replacing streaming bubble content

## Testing

- [x] Lint passes
- [x] Unit tests: `session.start` with `stream: true` stores flag correctly
- [x] Unit tests: `stream_chunk` events emitted for `content_block_delta` when streaming enabled
- [x] Unit tests: no `stream_chunk` events emitted when `stream: false` (default)
- [x] Unit tests: `index` counter increments correctly and resets per turn
- [x] Unit tests: full `assistant_text` still emitted after chunks
- [x] Unit tests: `bridge.capabilities` includes `streaming: true`
- [x] Unit tests: TS Client SDK `stream` param forwarded correctly
- [x] Unit tests: `stream_chunk` events stored in event buffer and replayable via `session.events`

## Verification

- [x] Verify `stream: false` behavior is identical to pre-change behavior
- [x] Verify `stream_chunk` events flow through SSE to connected clients
- [x] Verify Web UI renders streaming text incrementally
- [x] Verify `session.events` replay includes `stream_chunk` events

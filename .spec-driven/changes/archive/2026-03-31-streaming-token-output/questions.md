# Questions: streaming-token-output

## Open

<!-- No open questions -->

## Resolved

- [x] Q: What is the exact TypeScript SDK API for enabling partial message delivery?
  Context: Determines how `claude-agent-runner.ts` options are structured.
  A: The SDK option is `includePartialMessages: boolean` in the query options. When `true`, the iterator yields `SDKPartialAssistantMessage` objects with `type: 'stream_event'` and an `event: BetaRawMessageStreamEvent` field. Filter for `event.type === 'content_block_delta'` and `event.delta.type === 'text_delta'` to get text chunks. The delta text is in `event.delta.text`.

- [x] Q: Should `stream_chunk` be a separate notification or a new `messageType` within `bridge/session_event`?
  Context: Affects event model consistency and client-side handling.
  A: New `messageType` within `bridge/session_event` — keeps the event model unified.

- [x] Q: Should Web UI streaming rendering be included in this change or handled separately?
  Context: Affects scope and task count.
  A: Included together in this change.

# Tasks: stream-control

## Implementation
- [x] Add `stream.pause`, `stream.resume`, and `stream.throttle` JSON-RPC methods to the bridge contract.
- [x] Implement stream buffering logic in `AgentStateMachine` or the streaming wrapper.
- [x] Implement token emission rate limiting (throttling).
- [x] Update `SessionStore` to track stream state (active, paused, throttled).

## Testing

- [x] Run `bun run lint` — validate code style and typecheck
- [x] Run `bun test` — execute unit tests to verify pause, resume, and throttle behavior

## Verification
- [x] Verify implementation matches proposal scope by testing an SSE stream pause and resume without data loss.
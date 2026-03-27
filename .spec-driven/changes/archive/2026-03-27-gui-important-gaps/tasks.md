# Tasks: gui-important-gaps

## Implementation

- [x] T1: Add `bridge.ping` dispatch case in `BridgeServer.dispatch` returning `{pong: true, ts}`, add to capabilities methods list
- [x] T2: Add in-memory event buffer (`eventLog`) to `BridgeServer`; append to it inside `emit()`; add `session.events` dispatch case with `since`/`limit` pagination
- [x] T3: Update `QueryResult` in `claude-agent-runner.ts` to carry `usage`; extract from SDK result message; thread usage through `_runQuery` into response and `session_completed` notification

## Testing

- [x] T4: Tests for `bridge.ping` (returns pong, ts is ISO string, advertised in capabilities)
- [x] T5: Tests for `session.events` (buffer populated on events, since/limit filtering, unknown session error, buffer capped at 500)
- [x] T6: Tests for token usage (usage present in response and notification, null when not available)
- [x] T7: Lint passes (`bun run typecheck` or equivalent)
- [x] T8: All existing tests still pass (`bun test`)

## Verification

- [x] Verify implementation matches proposal

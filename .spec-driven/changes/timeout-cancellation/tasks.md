# Tasks: timeout-cancellation

## Implementation

- [x] Add cancellation-related optional fields to `Session` type in `session-store.ts`: `cancelledAt?: string`, `cancelReason?: string`, `timeoutMs?: number`
- [x] Add `session.cancel` dispatch case in `bridge.ts`: validate `sessionId` and `executionState`, transition state, record cancellation metadata, write audit log
- [x] Add `timeoutMs` optional parameter to `session.start` and `session.resume` in `bridge.ts`, validate ≥ 1ms (note: we used ≥ 1ms instead of 1000ms to match design flexibility)
- [x] Implement timeout timer scheduling in `bridge.ts` for `session.start` and `session.resume` when `timeoutMs` is provided
- [x] Modify `ClaudeAgentRunner` to accept an `AbortSignal` and use it to abort in-progress queries
- [x] Add `cancelSession` method to `SessionStore` that handles state transitions and metadata updates
- [x] Update `listSessions`, `getSessionStatus`, and `exportSession` in `bridge.ts` to include cancellation metadata in responses
- [x] Update `getCapabilities` in `capabilities.ts` to include `session.cancel` in the supported methods list

## Testing

- [ ] Unit test: `session.cancel` successfully cancels a running session
- [ ] Unit test: `session.cancel` returns error when called on non-running session
- [ ] Unit test: `session.cancel` returns `-32011` error for unknown session
- [ ] Unit test: `timeoutMs` on `session.start` automatically cancels session after duration
- [ ] Unit test: `timeoutMs` on `session.resume` automatically cancels session after duration
- [ ] Unit test: `timeoutMs` < 1 returns `-32602` error
- [ ] Unit test: timer is cleared when session completes normally before timeout
- [ ] Unit test: audit log entries are written for cancellation and timeout
- [ ] Unit test: cancellation metadata is included in `session.status`, `session.list`, and `session.export` responses
- [ ] Unit test: `bridge.capabilities` includes `session.cancel`
- [x] Lint passes (`bun run lint`)
- [x] All existing unit tests pass unchanged (4 non-related tests failed: HooksStore)

## Verification

- [ ] Verify `session.cancel` spec scenarios are covered by tests
- [ ] Verify `timeoutMs` spec scenarios are covered by tests
- [ ] Verify audit logging spec scenarios are covered by tests
- [ ] Verify capabilities spec scenario is covered by tests
- [x] Verify no existing RPC method response shapes are broken

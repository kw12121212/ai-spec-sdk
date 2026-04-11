# Tasks: agent-state-machine

## Implementation

- [x] Define `AgentExecutionState` type and `AgentStateMachine` class in `src/agent-state-machine.ts` with transition table, validation, and event emission
- [x] Add `executionState` field to `Session` interface in `src/session-store.ts`, defaulting to `"idle"` on creation
- [x] Wire `AgentStateMachine` into session creation in `SessionStore.create`
- [x] Drive execution state transitions in `src/bridge.ts`: `idle → running` when query begins, `running → completed` on success, `running → waiting_for_input` when tool approval is needed, `running → error` on failure
- [x] Drive execution state transitions in `SessionStore.stop`: set `executionState` to `"completed"` when stopping a running or waiting session
- [x] Drive execution state transitions in `_loadFromDisk`: set `executionState` to `"error"` for sessions recovered as `"interrupted"`
- [x] Include `executionState` in `session.status`, `session.list`, and `session.export` responses

## Testing

- [x] Run `bun run lint` to verify type correctness
- [x] Add unit tests for `AgentStateMachine`: valid transitions, invalid transitions, event emission
- [x] Add unit tests for session creation with `executionState` defaulting to `"idle"`
- [x] Add unit tests for execution state transitions during query lifecycle (start, complete, error, stop)
- [x] Add unit tests for persistence: `executionState` is saved to disk and restored on reload
- [x] Add unit tests for session metadata responses including `executionState`
- [x] Run `bun test` to verify all tests pass

## Verification

- [x] Verify implementation matches proposal scope (no new RPC methods, two-layer state model)
- [x] Verify existing `status` field behavior is unchanged
- [x] Verify delta spec reflects actual implementation

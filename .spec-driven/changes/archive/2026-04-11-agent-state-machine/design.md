# Design: agent-state-machine

## Approach

Introduce a two-layer state model:

1. **Execution state** (`executionState`) — fine-grained, managed by a state machine class, representing the agent's current execution phase
2. **Persistence status** (`status`) — coarse-grained, existing field, representing the session's lifecycle from the client's perspective

The `AgentStateMachine` class encapsulates the transition table and validation. It is owned by each session and driven by the bridge during query execution. The existing `SessionStore` methods (`create`, `complete`, `stop`) will drive both layers: they update `executionState` through the state machine and continue updating `status` as before.

Transition table:

| From              | To                | Trigger                                |
|-------------------|-------------------|----------------------------------------|
| idle              | running           | query execution begins                 |
| idle              | error             | query fails to start                   |
| running           | completed         | query returns successfully             |
| running           | waiting_for_input | agent awaits tool approval / user input|
| running           | paused            | pause requested (future)               |
| running           | error             | query throws or agent crashes          |
| waiting_for_input | running           | input / approval received              |
| waiting_for_input | error             | timeout or unrecoverable error         |
| paused            | running           | resume requested (future)              |
| paused            | error             | resume fails                           |
| error             | idle              | session reset for retry                |

Terminal states (`completed`) do not allow further transitions.

## Key Decisions

- **Two-layer state model:** Execution state and persistence status are separate concerns. The persistence status is client-facing and stable; execution state is engine-internal and extensible. This avoids breaking existing consumers while allowing fine-grained lifecycle management internally.
- **No new RPC methods in this change:** `session.pause`, `session.resume`, and other new methods are deferred to the `pause-resume` change. This change only defines the internal state machine and wires it into existing operations.
- **Transition events as internal callbacks:** The state machine emits events (e.g., `onTransition(from, to, trigger)`) that future changes (`execution-hooks`, `audit-logging`) can subscribe to. This change defines the event signature but does not implement hook execution or audit persistence.
- **`session.stop` mapping:** When `session.stop` is called, the execution state transitions to `completed` (if running/waiting) or stays unchanged (if already terminal), and the persistence status is set to `stopped` as before.

## Alternatives Considered

- **Single unified state field:** Replace `status` with a richer state that covers both execution and persistence. Rejected because it would break the existing contract and require changes to all consumers.
- **State machine as a standalone service:** A shared state machine service that multiple sessions use. Rejected because sessions are independent — per-session state machines are simpler and avoid shared mutable state.
- **XState or similar library:** Use a state machine library. Rejected per YAGNI — a simple transition table with validation is sufficient and avoids a dependency.

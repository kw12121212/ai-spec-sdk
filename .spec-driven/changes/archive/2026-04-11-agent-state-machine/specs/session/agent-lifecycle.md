## ADDED Requirements

### Requirement: Agent Execution State Machine

Each session MUST maintain an `executionState` field, distinct from the existing `status` field, that tracks the agent's current execution phase.

The `executionState` type MUST be: `"idle" | "running" | "paused" | "waiting_for_input" | "error" | "completed"`.

#### Scenario: New session starts in idle state
- GIVEN a client starts a new session
- WHEN the session is created
- THEN the session's `executionState` is `"idle"`

#### Scenario: Execution state transitions to running
- GIVEN a session with `executionState` `"idle"`
- WHEN the bridge begins executing the agent query
- THEN the session's `executionState` transitions to `"running"`

#### Scenario: Execution state transitions to completed
- GIVEN a session with `executionState` `"running"`
- WHEN the agent query returns successfully
- THEN the session's `executionState` transitions to `"completed"`

#### Scenario: Execution state transitions to waiting_for_input
- GIVEN a session with `executionState` `"running"`
- WHEN the agent requests tool approval that requires human decision
- THEN the session's `executionState` transitions to `"waiting_for_input"`

#### Scenario: Execution state returns to running from waiting_for_input
- GIVEN a session with `executionState` `"waiting_for_input"`
- WHEN the tool approval is received
- THEN the session's `executionState` transitions back to `"running"`

#### Scenario: Execution state transitions to error on failure
- GIVEN a session with `executionState` `"running"` or `"idle"`
- WHEN the agent query throws an error or fails to start
- THEN the session's `executionState` transitions to `"error"`

### Requirement: Invalid State Transitions Are Rejected

The state machine MUST reject transitions that are not in the valid transition table.

#### Scenario: Transition from completed is rejected
- GIVEN a session with `executionState` `"completed"`
- WHEN any state transition is attempted
- THEN the transition is rejected and the state remains `"completed"`

#### Scenario: Transition from idle to paused is rejected
- GIVEN a session with `executionState` `"idle"`
- WHEN a transition to `"paused"` is attempted
- THEN the transition is rejected

### Requirement: State Transition Events

The state machine MUST emit a transition event whenever the execution state changes.

The transition event MUST include: `sessionId`, `from` (previous state), `to` (new state), `trigger` (reason for the transition), and `timestamp`.

#### Scenario: Transition event is emitted
- GIVEN a session transitions from `"idle"` to `"running"`
- WHEN the transition occurs
- THEN an event is emitted with `{ sessionId, from: "idle", to: "running", trigger: "query_started", timestamp }`

### Requirement: Execution State and Persistence Status Are Independent

The `executionState` field and the `status` field MUST be managed independently with defined mapping rules.

- `session.start` / query begins: `status` → `"active"`, `executionState` → `"running"`
- Query completes successfully: `status` → `"completed"`, `executionState` → `"completed"`
- `session.stop` while running: `status` → `"stopped"`, `executionState` → `"completed"`
- Query error: `status` → `"completed"` (existing behavior: result contains error), `executionState` → `"error"`
- Bridge restart with active session: `status` → `"interrupted"`, `executionState` → `"error"`

#### Scenario: Stop while running sets both fields
- GIVEN a session with `status` `"active"` and `executionState` `"running"`
- WHEN the client calls `session.stop`
- THEN `status` becomes `"stopped"` and `executionState` becomes `"completed"`

#### Scenario: Error during execution sets both fields
- GIVEN a session with `executionState` `"running"`
- WHEN the agent query throws an unrecoverable error
- THEN `executionState` becomes `"error"` and `status` becomes `"completed"` (with error result)

#### Scenario: Interrupted session on restart
- GIVEN a session was `"active"` / `"running"` when the bridge terminated
- WHEN a new bridge process loads the session
- THEN `status` becomes `"interrupted"` and `executionState` becomes `"error"`

### Requirement: Execution State Is Persisted

The `executionState` field MUST be persisted to disk as part of the session JSON file.

#### Scenario: Execution state survives bridge restart
- GIVEN a session has `executionState` `"paused"` when the bridge restarts
- WHEN the session is loaded from disk
- THEN the session retains `executionState` `"paused"`

### Requirement: Execution State in Session Metadata

The `session.status`, `session.list`, and `session.export` responses MUST include the `executionState` field.

#### Scenario: Session status includes execution state
- GIVEN a session with `executionState` `"running"`
- WHEN a client calls `session.status`
- THEN the response includes `executionState: "running"`

#### Scenario: Session list includes execution state
- GIVEN sessions exist with various execution states
- WHEN a client calls `session.list`
- THEN each entry includes its `executionState`

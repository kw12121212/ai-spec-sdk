---
mapping:
  implementation:
    - src/session-store.ts
    - src/claude-agent-runner.ts
    - src/bridge.ts
    - src/capabilities.ts
    - src/audit-log.ts
  tests:
    - test/session.test.ts
    - test/session-store.test.ts
    - test/bridge.test.ts
---
## ADDED Requirements

### Requirement: Cancel Agent Session
The bridge MUST expose a `session.cancel` method that allows clients to cancel an actively executing session.

Parameters: `{ sessionId: string, reason?: string }`.

The bridge MUST:
1. Verify the `sessionId` exists; return `-32011` error if not
2. Check the session's `executionState`; only allow cancel from `"running"` or `"waiting_for_input"`
3. Return `-32602` error with reason if state is invalid
4. Transition `executionState` to `"completed"`
5. Record `cancelledAt` timestamp (ISO 8601)
6. Save the `reason` if provided, defaulting to `"user_requested"`
7. Attempt to abort any in-progress agent query
8. Write an audit log entry for the cancellation
9. Persist the session state to disk
10. Return `{ success: true, sessionId: string, cancelledAt: string }`

#### Scenario: Cancel a running session
- GIVEN a session with `executionState` `"running"`
- WHEN the client calls `session.cancel` with that session ID
- THEN the session's `executionState` becomes `"completed"`
- AND `cancelledAt` timestamp is returned

#### Scenario: Cancel a waiting-for-input session
- GIVEN a session with `executionState` `"waiting_for_input"`
- WHEN the client calls `session.cancel`
- THEN the session is successfully cancelled

#### Scenario: Cancel from invalid state returns error
- GIVEN a session with `executionState` `"idle"`
- WHEN the client calls `session.cancel`
- THEN `-32602` error is returned

#### Scenario: Cancel unknown session returns error
- GIVEN no session exists
- WHEN the client calls `session.cancel` with invalid ID
- THEN `-32011` error is returned

### Requirement: Session Execution Timeout
The bridge MUST accept an optional `timeoutMs` parameter on `session.start` and `session.resume` that automatically cancels the session after the specified duration.

The `timeoutMs` parameter MUST be an integer ≥ 1000 (1 second). If provided and less than 1000, the bridge MUST return a `-32602` error.

When `timeoutMs` is provided:
1. The bridge MUST schedule a timer that cancels the session after `timeoutMs` milliseconds
2. If the session completes normally before the timeout, the timer MUST be cleared
3. When the timeout triggers, the bridge MUST cancel the session with `reason` `"timeout"`
4. The `timeoutMs` value MUST be persisted to disk as part of the session

#### Scenario: Session times out after specified duration
- GIVEN a client starts a session with `timeoutMs: 5000`
- WHEN 5 seconds pass without the session completing
- THEN the session is automatically cancelled with `cancelReason` `"timeout"`

#### Scenario: Timeout cleared when session completes normally
- GIVEN a session is started with `timeoutMs`
- WHEN the session completes before the timeout duration
- THEN the timer is cleared and the session is not cancelled

#### Scenario: timeoutMs < 1000 returns error
- GIVEN a client calls `session.start` with `timeoutMs: 500`
- WHEN the bridge validates the request
- THEN the bridge returns a `-32602` error

#### Scenario: timeoutMs applies on resume
- GIVEN a client resumes a session with `timeoutMs: 10000`
- WHEN the resume operation is processed
- THEN the timeout is scheduled for 10 seconds

### Requirement: Cancellation Metadata in Session Responses
The `session.status`, `session.list`, and `session.export` responses MUST include cancellation-related fields when applicable:
- `cancelledAt?: string` - ISO 8601 timestamp when cancelled
- `cancelReason?: string` - reason for cancellation
- `timeoutMs?: number` - configured timeout duration

#### Scenario: Session status includes cancellation metadata
- GIVEN a cancelled session
- WHEN the client calls `session.status`
- THEN the response includes `cancelledAt` and `cancelReason`

#### Scenario: Session list includes cancellation metadata
- GIVEN multiple sessions, some cancelled
- WHEN the client calls `session.list`
- THEN each cancelled sessions include cancellation metadata

#### Scenario: Session export includes cancellation metadata
- GIVEN a cancelled session
- WHEN the client calls `session.export`
- THEN the response includes all cancellation-related fields

### Requirement: Cancellation Audit Logging
The bridge MUST write audit log entries for cancellation and timeout events:
- `session_cancelled` event (category: "lifecycle"), payload includes `reason` and `cancelledAt`
- `session_timed_out` event (category: "lifecycle"), payload includes `timeoutMs` and `cancelledAt`

#### Scenario: Cancel writes audit log
- GIVEN a client cancels a session
- WHEN the cancel operation completes
- THEN a `session_cancelled` audit entry exists

#### Scenario: Timeout writes audit log
- GIVEN a session times out
- WHEN the timeout cancellation completes
- THEN a `session_timed_out` audit entry exists

### Requirement: Capabilities include session.cancel
The `bridge.capabilities` response MUST include `session.cancel` in the supported methods list.

#### Scenario: Capabilities include session.cancel
- GIVEN a client calls `bridge.capabilities`
- THEN the `methods` array in the response includes `"session.cancel"`

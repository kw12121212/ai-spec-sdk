---
mapping:
  implementation:
    - src/session-store.ts
  tests:
    - test/session-store.test.ts
---

## ADDED Requirements

### Requirement: session-paused-status
The system MUST support a `paused` status for sessions awaiting external input.

#### Scenario: pause
- GIVEN an active session
- WHEN the agent emits a question
- THEN the session status changes to `paused`

## MODIFIED Requirements

### Requirement: session-lifecycle
Previously: The system MUST manage sessions with `active`, `completed`, `stopped`, or `interrupted` status.
The system MUST manage sessions with `active`, `completed`, `stopped`, `interrupted`, or `paused` status.

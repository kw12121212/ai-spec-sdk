---
mapping:
  implementation:
    - src/session-store.ts
    - src/agent-state-machine.ts
  tests:
    - test/session.test.ts
    - test/agent-state-machine.test.ts
    - test/session-question.test.ts
---

## ADDED Requirements

### Requirement: answer-validation
The system MUST validate incoming answers against the session's current execution state and pending request.

#### Scenario: answer rejected for invalid state
- GIVEN a session is in the `running` or `completed` state
- WHEN the client calls `session.answerQuestion`
- THEN the bridge returns a `-32602` error indicating the session is not waiting for input

#### Scenario: answer rejected for expired/invalid request
- GIVEN a session is waiting for input
- WHEN the client calls `session.answerQuestion` with a mismatched `requestId`
- THEN the bridge returns a `-32020` error indicating the request ID does not match

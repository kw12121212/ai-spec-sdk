---
mapping:
  implementation:
    - src/bridge.ts
    - src/lsp-client.ts
  tests:
    - test/bridge.test.ts
    - test/session-question.test.ts
---

## ADDED Requirements

### Requirement: session-answer-question
The system MUST provide a JSON-RPC method `session.answerQuestion` to allow clients to submit an asynchronous response to a pending question.

#### Scenario: answer pending question
- GIVEN a session is in the `waiting_for_input` state with a pending question
- WHEN the client calls `session.answerQuestion` with the `sessionId`, `requestId`, and the `answer`
- THEN the bridge validates the request and stores the answer for the session
- AND returns a success response acknowledging the answer

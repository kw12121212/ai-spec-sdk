---
mapping:
  implementation:
    - src/bridge.ts
    - src/capabilities.ts
  tests:
    - test/bridge.test.ts
---

## ADDED Requirements

### Requirement: question-events
The system MUST emit a JSON-RPC notification when a session asks a question and MUST accept a JSON-RPC method to resolve it.

#### Scenario: ask and resolve
- GIVEN an active session
- WHEN the agent asks a question
- THEN the bridge MUST emit a `session.question` notification with a structured payload containing `question`, `impact`, `recommendation`, and optional `options`
- AND WHEN the client sends `session.resolveQuestion` with the answer
- THEN the session MUST resume execution

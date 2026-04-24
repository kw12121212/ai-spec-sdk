---
mapping:
  implementation:
    - src/token-tracking/store.ts
    - src/token-tracking/types.ts
    - src/claude-agent-runner.ts
  tests:
    - test/token-tracking/store.test.ts
    - test/session.test.ts
---

## ADDED Requirements

### Requirement: token-prediction-tracking
The system MUST track and expose pre-execution token predictions.

#### Scenario: success
- GIVEN a session with a configured LLM provider
- WHEN a message is prepared for execution
- THEN the system MUST provide an estimated input token count and predicted cost before sending the request to the provider.
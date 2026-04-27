---
mapping:
  implementation:
    - src/webhooks.ts
    - src/http-server.ts
    - src/bridge.ts
  tests:
    - test/webhooks.test.ts
---

## MODIFIED Requirements

### Requirement: HMAC-SHA256 Signed Delivery
Previously: When a session lifecycle event occurs (`session_started`, `session_completed`, `session_stopped`, `session_interrupted`), the bridge MUST deliver an HTTP POST to each registered webhook URL.
The bridge MUST deliver an HTTP POST to each registered webhook URL when a session lifecycle event occurs (`session_started`, `session_completed`, `session_stopped`, `session_interrupted`) OR when a session asks a question (`session_question`).

#### Scenario: Delivery payload for question events
- GIVEN a webhook is registered
- WHEN an agent asks a question in a session
- THEN the POST body contains `{ event: "session_question", sessionId: "<session-id>", timestamp: "<ISO 8601>", data: { question: "...", impact: "...", recommendation: "..." } }`

---
mapping:
  implementation:
    - src/session-store.ts
    - src/bridge.ts
    - src/llm-provider/adapters/anthropic.ts
    - src/claude-agent-runner.ts
  tests:
    - test/session.test.ts
    - test/bridge.test.ts
    - test/anthropic-adapter.test.ts
---

## ADDED Requirements

### Requirement: stream-backpressure
The system MUST apply backpressure to the LLM provider stream when the client transport buffer exceeds a high-water mark.

#### Scenario: slow consumer triggers backpressure
- GIVEN an active streaming session
- WHEN the client's network transport buffer (e.g., WebSocket `bufferedAmount`) exceeds the configured high-water mark
- THEN the system MUST delay or pause reading from the LLM provider's stream
- AND the system MUST resume reading from the LLM provider only when the transport buffer drains below a low-water mark

### Requirement: stream-buffer-disconnect
The system MUST forcefully terminate the streaming connection if the transport buffer exceeds a critical maximum threshold to prevent resource exhaustion.

#### Scenario: critical buffer limit exceeded
- GIVEN an active streaming session where backpressure is applied
- WHEN the client's transport buffer continues to grow and exceeds the critical maximum threshold
- THEN the system MUST forcefully close the transport connection
- AND the system MUST terminate the underlying LLM provider stream to release resources

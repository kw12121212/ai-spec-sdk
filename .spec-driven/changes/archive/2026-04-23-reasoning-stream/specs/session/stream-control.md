---
mapping:
  implementation:
    - src/bridge.ts
    - src/session-store.ts
    - src/llm-provider/adapters/anthropic.ts
  tests:
    - test/session.test.ts
    - test/anthropic-adapter.test.ts
---

## ADDED Requirements

### Requirement: reasoning-stream
The system MUST stream reasoning/thinking process output separately from final response output.

#### Scenario: reasoning tokens received
- GIVEN an active streaming session where the LLM provider supports reasoning output
- WHEN the LLM provider emits a reasoning token chunk
- THEN the system MUST emit a distinct JSON-RPC notification (e.g., `agent.reasoning`) to the client
- AND the system MUST NOT include the reasoning text in the standard text token stream
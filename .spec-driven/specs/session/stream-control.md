---
mapping:
  implementation:
    - src/session-store.ts
    - src/bridge.ts
  tests:
    - test/session.test.ts
---

# Stream Control

### Requirement: stream-pause-resume
The system MUST allow active token streams to be paused and resumed without data loss.

#### Scenario: pause active stream
- GIVEN an active streaming session emitting tokens
- WHEN a `stream.pause` JSON-RPC request is received for the session ID
- THEN the system MUST stop emitting tokens to the client
- AND the system MUST buffer incoming tokens from the LLM provider

#### Scenario: resume paused stream
- GIVEN a streaming session that is currently paused and buffering tokens
- WHEN a `stream.resume` JSON-RPC request is received for the session ID
- THEN the system MUST emit all buffered tokens to the client
- AND the system MUST resume continuous emission of new tokens

### Requirement: stream-throttle
The system MUST support throttling the emission rate of streaming tokens.

#### Scenario: apply throttle
- GIVEN an active streaming session
- WHEN a `stream.throttle` JSON-RPC request is received with a `tokensPerSecond` limit
- THEN the system MUST limit the rate of token emission to the client to not exceed the specified limit
---
mapping:
  implementation:
    - src/session-store.ts
    - src/bridge.ts
    - src/llm-provider/adapters/anthropic.ts
    - src/claude-agent-runner.ts
  tests:
    - test/session.test.ts
    - test/anthropic-adapter.test.ts
    - test/bridge.test.ts
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

## ADDED Requirements

### Requirement: reasoning-stream
The system MUST stream reasoning/thinking process output separately from final response output.

#### Scenario: reasoning tokens received
- GIVEN an active streaming session where the LLM provider supports reasoning output
- WHEN the LLM provider emits a reasoning token chunk
- THEN the system MUST emit a distinct JSON-RPC notification (e.g., `agent.reasoning`) to the client
- AND the system MUST NOT include the reasoning text in the standard text token stream

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
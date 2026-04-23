---
mapping:
  implementation:
    - src/token-tracking/types.ts
    - src/token-tracking/store.ts
    - src/claude-agent-runner.ts
    - src/bridge.ts
    - src/capabilities.ts
  tests:
    - test/token-tracking/store.test.ts
    - test/token-tracking/bridge-methods.test.ts
    - test/token-tracking/integration.test.ts
---

## ADDED Requirements

### Requirement: Message-Level Token Attribution
The system MUST attribute token usage to specific message identifiers when available during query execution.

#### Scenario: Query includes messageId in options
- GIVEN a query executed via the runner includes `options.messageId: "msg-123"`
- WHEN the query completes with token usage
- THEN the TokenStore records the token usage with `messageId: "msg-123"`

#### Scenario: Get message usage
- GIVEN the `token.getMessageUsage` bridge method is exposed
- AND a session "session-456" has a record with `messageId: "msg-123"`
- WHEN the client calls `token.getMessageUsage("session-456", "msg-123")`
- THEN the response returns the matching `TokenRecord` object.

#### Scenario: Get message usage for missing message
- GIVEN a session "session-456" does not have a record with `messageId: "msg-missing"`
- WHEN the client calls `token.getMessageUsage("session-456", "msg-missing")`
- THEN the bridge returns error `-32052` with message "Message not found".

## MODIFIED Requirements

### Requirement: Token Store Lifecycle Management
Previously: The SDK MUST manage token data lifecycle aligned with session lifecycle.
The system MUST manage token data lifecycle aligned with session lifecycle and preserve `messageId` granularity on all stored records.

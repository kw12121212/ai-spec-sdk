---
mapping:
  implementation:
    - src/token-tracking/types.ts
    - src/token-tracking/store.ts
    - src/token-tracking/counters/index.ts
    - src/token-tracking/counters/anthropic.ts
    - src/claude-agent-runner.ts
    - src/bridge.ts
    - src/llm-provider/provider-registry.ts
  tests:
    - test/token-tracking/store.test.ts
    - test/token-tracking/counters.test.ts
    - test/token-tracking/integration.test.ts
    - test/token-tracking/bridge-methods.test.ts
---
## ADDED Requirements

### Requirement: Token Usage Recording
The SDK MUST automatically record token usage after every LLM query completion.

#### Scenario: Record tokens from Claude Agent SDK query
- GIVEN a session with ID "session-123" executes a query via runClaudeQuery
- AND the query returns `{ usage: { input_tokens: 100, output_tokens: 200 } }`
- WHEN the query completes
- THEN the TokenStore contains a record with:
  - sessionId: "session-123"
  - providerId: "default-anthropic" (or configured default)
  - providerType: "anthropic"
  - inputTokens: 100
  - outputTokens: 200
  - timestamp: <current time>

#### Scenario: Record tokens from Provider queryStream
- GIVEN a session uses a custom provider with ID "my-openai"
- AND the provider's queryStream returns usage data
- WHEN the stream completes
- THEN the TokenStore records the normalized token usage with providerId: "my-openai"

#### Scenario: Record message-level tokens when messageId provided
- GIVEN a query includes options.messageId: "msg-456"
- WHEN the query completes with token usage
- THEN the TokenRecord includes messageId: "msg-456"

#### Scenario: No record when usage is null
- GIVEN a query completes with usage: null
- WHEN recording logic runs
- THEN NO record is written to TokenStore

### Requirement: Session-Level Token Summary
The SDK MUST provide aggregated token usage per session.

#### Scenario: Get session summary with single query
- GIVEN session "session-123" has executed one query using 100 input + 200 output tokens
- WHEN the client calls `token.getSessionSummary("session-123")`
- THEN the response returns:
  ```json
  {
    "sessionId": "session-123",
    "totalInputTokens": 100,
    "totalOutputTokens": 200,
    "totalTokens": 300,
    "queryCount": 1,
    "providerBreakdown": [{
      "providerId": "default-anthropic",
      "inputTokens": 100,
      "outputTokens": 200
    }]
  }
  ```

#### Scenario: Get session summary with multiple queries across providers
- GIVEN session "session-123" has 3 records:
  - Record 1: provider "anthropic-1", 150 input, 300 output
  - Record 2: provider "anthropic-1", 50 input, 100 output
  - Record 3: provider "openai-1", 200 input, 400 output
- WHEN the client calls `token.getSessionSummary("session-123")`
- THEN the response aggregates correctly:
  - totalInputTokens: 400
  - totalOutputTokens: 800
  - queryCount: 3
  - providerBreakdown has 2 entries with correct subtotals

#### Scenario: Get summary for non-existent session
- GIVEN no records exist for session "non-existent"
- WHEN the client calls `token.getSessionSummary("non-existent")`
- THEN the bridge returns error `-32051` with message "Session not found"

### Requirement: Message-Level Token Details
The SDK MUST support querying token usage for individual messages.

#### Scenario: Get message usage by ID
- GIVEN session "session-123" has a record with messageId: "msg-001", 50 input, 100 output tokens
- WHEN the client calls `token.getMessageUsage("session-123", "msg-001")`
- THEN the response returns the full TokenRecord for that message

#### Scenario: Get message usage for non-existent message
- GIVEN session "session-123" exists but has no record with messageId: "msg-999"
- WHEN the client calls `token.getMessageUsage("session-123", "msg-999")`
- THEN the bridge returns error `-32052` with message "Message not found"

### Requirement: Provider-Level Token Aggregation
The SDK MUST provide token usage statistics grouped by provider.

#### Scenario: Get usage for specific provider
- GIVEN 5 records exist across sessions for provider "anthropic-prod"
- WHEN the client calls `token.getProviderUsage("anthropic-prod")`
- THEN the response returns aggregated stats for that provider only:
  ```json
  [{
    "providerId": "anthropic-prod",
    "providerType": "anthropic",
    "totalInputTokens": <sum>,
    "totalOutputTokens": <sum>,
    "queryCount": 5,
    "sessionCount": <unique sessions>
  }]
  ```

#### Scenario: Get usage for all providers (no filter)
- GIVEN records exist for providers "anthropic-1", "openai-1", "local-model"
- WHEN the client calls `token.getProviderUsage()` with no providerId
- THEN the response returns an array with one entry per provider, each aggregated

#### Scenario: Empty result for unused provider
- GIVEN no records exist for provider "unused-provider"
- WHEN the client calls `token.getProviderUsage("unused-provider")`
- THEN the bridge returns an array with single entry showing all zeros

### Requirement: Token Store Lifecycle Management
The SDK MUST manage token data lifecycle aligned with session lifecycle.

#### Scenario: Clear token data when session is destroyed
- GIVEN session "session-123" has 10 token records
- WHEN the session is destroyed via session.destroy
- THEN all token records for "session-123" are removed from TokenStore

#### Scenario: Clear all token data on demand
- GIVEN the TokenStore contains records from multiple sessions
- WHEN the client calls `token.clearAll` (admin method)
- THEN all records are removed from TokenStore
- AND the bridge returns `{ success: true, clearedCount: <number> }`

### Requirement: Token Data Model Constraints
The SDK MUST enforce data integrity rules on token records.

#### Scenario: Reject negative token counts
- GIVEN a TokenRecord would have negative inputTokens or outputTokens
- WHEN attempting to record such entry
- THEN the entry is rejected with a logged warning
- AND no record is written

#### Scenario: Auto-compute totalTokens
- GIVEN a TokenRecord with inputTokens: 100, outputTokens: 200
- WHEN the record is stored or returned
- THEN totalTokens is always 300 (computed, not stored separately)

#### Scenario: Timestamp auto-generated if missing
- GIVEN a TokenRecord is created without timestamp
- WHEN the record is stored
- THEN timestamp is set to Date.now() automatically
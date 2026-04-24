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
    - src/quota/types.ts
    - src/quota/registry.ts
    - src/quota/enforcer.ts
    - src/session-store.ts
    - src/capabilities.ts
    - src/budget/types.ts
    - src/budget/registry.ts
    - src/budget/enforcer.ts
  tests:
    - test/token-tracking/store.test.ts
    - test/token-tracking/counters.test.ts
    - test/token-tracking/integration.test.ts
    - test/token-tracking/bridge-methods.test.ts
    - test/quota/registry.test.ts
    - test/quota/enforcer.test.ts
    - test/quota/bridge-methods.test.ts
    - test/quota/integration.test.ts
    - test/budget/registry.test.ts
    - test/budget/enforcer.test.ts
    - test/budget/bridge-methods.test.ts
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
The system MUST manage token data lifecycle aligned with session lifecycle and preserve `messageId` granularity on all stored records.

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

### Requirement: Quota Rule Configuration

The SDK MUST allow clients to configure quota rules that define token usage limits with scope, limit value, enforcement action, and optional warn threshold.

A QuotaRule MUST have the following fields:

| Field | Type | Required | Description |
|---|---|---|---|
| `quotaId` | string | yes | Unique identifier for the rule |
| `scope` | `"session" \| "provider" \| "global"` | yes | Granularity of the quota |
| `scopeId` | string | no | Target identifier: sessionId for session-scope, providerId for provider-scope; omitted for global |
| `limit` | number (integer > 0) | yes | Maximum totalTokens allowed |
| `action` | `"warn" \| "block" \| "warn+block"` | yes | Enforcement behavior when limit is exceeded |
| `warnThreshold` | number (0–1) | no | Fraction of limit at which to warn; default 0.8 |

#### Scenario: Set a valid session-scoped quota rule
- GIVEN a client calls `quota.set` with `{ quotaId: "q1", scope: "session", scopeId: "session-123", limit: 10000, action: "warn+block" }`
- WHEN the bridge processes the request
- THEN the bridge stores the rule and returns `{ success: true, quotaId: "q1" }`

#### Scenario: Set a valid provider-scoped quota rule
- GIVEN a client calls `quota.set` with `{ quotaId: "q2", scope: "provider", scopeId: "anthropic-prod", limit: 500000, action: "warn" }`
- WHEN the bridge processes the request
- THEN the bridge stores the rule and returns `{ success: true, quotaId: "q2" }`

#### Scenario: Set a valid global quota rule
- GIVEN a client calls `quota.set` with `{ quotaId: "q3", scope: "global", limit: 1000000, action: "block" }`
- WHEN the bridge processes the request
- THEN the bridge stores the rule and returns `{ success: true, "quotaId": "q3" }`

#### Scenario: Reject duplicate quotaId
- GIVEN a rule with quotaId "q1" already exists
- WHEN the client calls `quota.set` with quotaId "q1"
- THEN the bridge returns error `-32602` with message "Quota rule already exists"

#### Scenario: Reject invalid scope value
- GIVEN a client provides `scope: "team"` (not a valid scope)
- WHEN the client calls `quota.set`
- THEN the bridge returns error `-32602` identifying `scope` as invalid

#### Scenario: Reject missing scopeId for session/provider scope
- GIVEN a client sets `scope: "session"` but omits `scopeId`
- WHEN the client calls `quota.set`
- THEN the bridge returns error `-32602` indicating `scopeId` is required for this scope

#### Scenario: Reject non-positive limit
- GIVEN a client provides `limit: 0` or `limit: -100`
- WHEN the client calls `quota.set`
- THEN the bridge returns error `-32602` indicating `limit` must be a positive integer

#### Scenario: Reject invalid action value
- GIVEN a client provides `action: "delete"`
- WHEN the client calls `quota.set`
- THEN the bridge returns error `-32602` identifying `action` as invalid

### Requirement: Quota Rule Retrieval

The SDK MUST allow clients to retrieve individual quota rules and list all active rules.

#### Scenario: Get an existing quota rule
- GIVEN a rule with quotaId "q1" is set
- WHEN the client calls `quota.get` with `{ quotaId: "q1" }`
- THEN the bridge returns the full rule configuration including computed fields (currentUsage, status)

#### Scenario: Get non-existent quota rule
- GIVEN no rule with quotaId "unknown" exists
- WHEN the client calls `quota.get` with `{ quotaId: "unknown" }`
- THEN the bridge returns error `-32061` with message "Quota rule not found"

#### Scenario: List all active quota rules
- GIVEN multiple rules are set across different scopes
- WHEN the client calls `quota.list`
- THEN the bridge returns an array of all active rules with their current usage and status

#### Scenario: List returns empty array when no rules exist
- GIVEN no quota rules are configured
- WHEN the client calls `quota.list`
- THEN the bridge returns an empty array `[]`

### Requirement: Quota Rule Removal

The SDK MUST allow clients to remove quota rules individually or clear all rules at once.

#### Scenario: Remove an existing quota rule
- GIVEN a rule with quotaId "q1" exists
- WHEN the client calls `quota.remove` with `{ quotaId: "q1" }`
- THEN the bridge removes the rule and returns `{ success: true, quotaId: "q1" }`

#### Scenario: Remove non-existent quota rule
- GIVEN no rule with quotaId "unknown" exists
- WHEN the client calls `quota.remove` with `{ quotaId: "unknown" }`
- THEN the bridge returns error `-32061` with message "Quota rule not found"

#### Scenario: Clear all quota rules
- GIVEN multiple quota rules exist
- WHEN the client calls `quota.clear`
- THEN the bridge removes all rules and returns `{ success: true, clearedCount: <N> }`

### Requirement: Quota Status Query

The SDK MUST provide a method to query current usage vs. limit for active quotas.

#### Scenario: Get status for all scopes
- GIVEN active rules exist for session, provider, and global scopes
- WHEN the client calls `quota.getStatus` with no filter
- THEN the bridge returns an array of `QuotaStatus` objects, each containing:
  - `quotaId`, `scope`, `scopeId`, `limit`, `action`, `warnThreshold`
  - `currentUsage` (number — current totalTokens from TokenStore)
  - `percentage` (number — currentUsage / limit, 0–∞)
  - `status`: `"ok" | "warning" | "exceeded"`

#### Scenario: Filter status by scope
- GIVEN rules exist for multiple scopes
- WHEN the client calls `quota.getStatus` with `{ scope: "session" }`
- THEN only session-scoped rules are included in the response

#### Scenario: Status shows warning when above warnThreshold
- GIVEN a session-scoped rule with limit 10000 and warnThreshold 0.8
- AND the session has used 8500 tokens
- WHEN the client calls `quota.getStatus`
- THEN the rule's status is `"warning"` and percentage is 0.85

#### Scenario: Status shows exceeded when at or above limit
- GIVEN a session-scoped rule with limit 10000
- AND the session has used 10000 or more tokens
- WHEN the client calls `quota.getStatus`
- THEN the rule's status is `"exceeded"`

### Requirement: Quota Violation History

The SDK MUST record and expose quota violation events.

#### Scenario: Query violations for a session
- GIVEN a session has triggered block violations during queries
- WHEN the client calls `quota.getViolations` with `{ sessionId: "session-123" }`
- THEN the bridge returns an array of `QuotaViolation` records for that session

#### Scenario: Query all violations
- GIVEN violations exist across sessions
- WHEN the client calls `quota.getViolations` with no sessionId
- THEN the bridge returns all violations ordered by timestamp descending

#### Scenario: Violation record includes full context
- GIVEN a query was blocked by quota rule "q1"
- WHEN the client inspects the violation record
- THEN it contains: `violationId`, `quotaId`, `sessionId`, `providerId`, `timestamp`, `usageAtViolation`, `limit`, `action`, `blocked` (boolean)

### Requirement: Pre-Query Quota Enforcement

The SDK MUST evaluate all applicable quota rules before each LLM query execution and block the query if any rule with `action` containing `"block"` is exceeded.

#### Scenario: Query proceeds when no quotas are exceeded
- GIVEN a session has a quota rule with limit 10000 and current usage 5000
- WHEN a new query is about to execute
- THEN the query proceeds normally

#### Scenario: Query blocked when session quota exceeded
- GIVEN a session has a quota rule with limit 10000, action "block", and current usage 10000+
- WHEN a new query is about to execute
- THEN the query is NOT executed
- AND the bridge returns error `-32060` with message "Quota exceeded"
- AND the error data includes: `quotaId`, `scope`, `limit`, `currentUsage`
- AND the session remains in its current state (not destroyed)

#### Scenario: Query blocked when global quota exceeded
- GIVEN a global quota rule with limit 1000000, action "block", and aggregate usage >= limit
- WHEN any session attempts a query
- THEN the query is blocked with error `-32060`

#### Scenario: Warning emitted but query proceeds for warn-only action
- GIVEN a session quota with limit 10000, action "warn", and usage at 9000 (above default 80% threshold)
- WHEN a query executes
- THEN the query proceeds normally
- AND a `bridge/quota_warning` notification is emitted

#### Scenario: Both warning and block for warn+block action
- GIVEN a session quota with limit 10000, action "warn+block", warnThreshold 0.7
- AND usage is 7500 (above warn, below limit)
- WHEN a query executes
- THEN the query proceeds AND a `bridge/quota_warning` notification is emitted
- AND when usage later reaches 10000, the next query is blocked with `bridge/quota_blocked` notification

### Requirement: Post-Query Quota Evaluation

The SDK MUST re-evaluate quota warn thresholds after each completed query to detect crossings that occurred during the query.

#### Scenario: Warn notification fires after query crosses threshold
- GIVEN a session quota with limit 10000, warnThreshold 0.9
- AND before-query usage was 8900 (below threshold)
- AND the query adds 200 tokens (usage becomes 9100)
- WHEN post-query evaluation runs
- THEN a `bridge/quota_warning` notification is emitted with updated usage

### Requirement: Quota Warning Notification

The bridge MUST emit `bridge/quota_warning` notifications when a quota's usage crosses its warn threshold.

The notification MUST include:
- `quotaId` (string)
- `scope` (string)
- `scopeId` (string or null)
- `limit` (number)
- `currentUsage` (number)
- `percentage` (number)
- `sessionId` (string — the session that triggered the evaluation)

#### Scenario: Notification carries correct quota context
- GIVEN session "s1" has quota "q1" with limit 10000 and warnThreshold 0.8
- AND usage crosses 8000 tokens
- WHEN the warning fires
- THEN the notification includes quotaId "q1", scope "session", limit 10000, currentUsage >= 8000, percentage >= 0.8, sessionId "s1"

### Requirement: Quota Blocked Notification

The bridge MUST emit `bridge/quota_blocked` notifications when a query is denied due to a quota block rule.

The notification MUST include:
- `quotaId` (string)
- `scope` (string)
- `scopeId` (string or null)
- `limit` (number)
- `currentUsage` (number)
- `sessionId` (string)
- `violationId` (string)

#### Scenario: Blocked notification includes violation details
- GIVEN a query is blocked by quota "q1"
- WHEN the block occurs
- THEN the notification includes all required fields plus a unique violationId

### Requirement: Session-Scoped Quota Cleanup

The SDK MUST automatically remove session-scoped quota rules when their associated session is destroyed.

#### Scenario: Session quota removed on destroy
- GIVEN session "s1" has a session-scoped quota rule with scopeId "s1"
- WHEN the session is destroyed via session.destroy or session cleanup
- THEN the quota rule is automatically removed from the registry

#### Scenario: Provider and global quotas unaffected by session destroy
- GIVEN a provider-scoped quota and a global quota exist
- WHEN any session is destroyed
- THEN those rules remain active

### Requirement: Quota Methods in Capabilities

The bridge capability response MUST advertise all `quota.*` methods so clients can discover them.

#### Scenario: Capabilities include quota methods
- GIVEN a client calls `bridge.capabilities`
- WHEN the bridge returns capabilities
- THEN the `methods` array includes: `quota.set`, `quota.get`, `quota.list`, `quota.remove`, `quota.clear`, `quota.getStatus`, `quota.getViolations`

### Requirement: Budget Pool Creation
The SDK MUST allow clients to create token budget pools with an allocated amount, scope, and configurable alert thresholds.

A BudgetPool MUST have the following fields:

| Field | Type | Required | Description |
|---|---|---|---|
| `budgetId` | string | yes | Unique identifier |
| `scope` | `"session" \| "provider" \| "global"` | yes | Granularity |
| `scopeId` | string | no | Target identifier for session/provider scope |
| `allocated` | number (integer > 0) | yes | Total tokens allocated |
| `thresholds` | number[] (0–1, sorted ascending) | no | Alert thresholds; default `[0.8]` |
| `depletionAction` | `"block" \| "throttle" \| "notify"` | no | Action when exhausted; default `"notify"` |

#### Scenario: Create a session-scoped budget
- GIVEN a client calls `budget.create` with `{ budgetId: "b1", scope: "session", scopeId: "session-123", allocated: 50000, thresholds: [0.5, 0.8, 0.95], depletionAction: "block" }`
- WHEN the bridge processes the request
- THEN the bridge stores the pool and returns `{ success: true, budgetId: "b1", remaining: 50000 }`

#### Scenario: Reject duplicate budgetId
- GIVEN a pool with budgetId "b1" already exists
- WHEN the client calls `budget.create` with budgetId "b1"
- THEN the bridge returns error `-32602` with message "Budget pool already exists"

#### Scenario: Reject missing scopeId for session/provider scope
- GIVEN a client sets `scope: "session"` but omits `scopeId`
- WHEN the client calls `budget.create`
- THEN the bridge returns error `-32602` indicating `scopeId` is required

#### Scenario: Reject non-positive allocated
- GIVEN a client provides `allocated: 0` or `allocated: -100`
- WHEN the client calls `budget.create`
- THEN the bridge returns error `-32602` indicating `allocated` must be positive

### Requirement: Budget Pool Retrieval
The SDK MUST allow clients to retrieve individual budget pools and list all active pools.

#### Scenario: Get an existing budget pool
- GIVEN a pool with budgetId "b1" exists
- WHEN the client calls `budget.get` with `{ budgetId: "b1" }`
- THEN the bridge returns the full pool configuration plus computed `consumed` and `remaining` from TokenStore

#### Scenario: Get non-existent budget pool
- GIVEN no pool with budgetId "unknown" exists
- WHEN the client calls `budget.get` with `{ budgetId: "unknown" }`
- THEN the bridge returns error `-32072` with message "Budget pool not found"

#### Scenario: List all budget pools
- GIVEN multiple pools exist across scopes
- WHEN the client calls `budget.list`
- THEN the bridge returns an array of all pools with computed consumed/remaining

#### Scenario: List returns empty array when no pools exist
- GIVEN no budget pools are configured
- WHEN the client calls `budget.list`
- THEN the bridge returns an empty array `[]`

### Requirement: Budget Pool Adjustment
The SDK MUST allow clients to adjust the allocated amount of an existing budget pool.

#### Scenario: Increase budget allocation
- GIVEN a pool with budgetId "b1" has allocated 50000 and consumed 20000
- WHEN the client calls `budget.adjust` with `{ budgetId: "b1", allocated: 80000 }`
- THEN the pool's allocated is updated to 80000 and remaining becomes 60000

#### Scenario: Decrease budget below consumed
- GIVEN a pool with budgetId "b1" has allocated 50000 and consumed 40000
- WHEN the client calls `budget.adjust` with `{ budgetId: "b1", allocated: 30000 }`
- THEN the pool's allocated is updated to 30000 and remaining is 0 (clamped, not negative)

### Requirement: Budget Pool Removal
The SDK MUST allow clients to remove budget pools individually or clear all pools at once.

#### Scenario: Remove an existing budget pool
- GIVEN a pool with budgetId "b1" exists
- WHEN the client calls `budget.remove` with `{ budgetId: "b1" }`
- THEN the bridge removes the pool and returns `{ success: true, budgetId: "b1" }`

#### Scenario: Remove non-existent budget pool
- GIVEN no pool with budgetId "unknown" exists
- WHEN the client calls `budget.remove` with `{ budgetId: "unknown" }`
- THEN the bridge returns error `-32072` with message "Budget pool not found"

### Requirement: Budget Status Query
The SDK MUST provide a method to query current consumption status for budget pools.

#### Scenario: Get status for all pools
- GIVEN multiple pools exist
- WHEN the client calls `budget.getStatus` with no filter
- THEN the bridge returns an array of `BudgetStatus` objects, each containing: `budgetId`, `scope`, `scopeId`, `allocated`, `consumed`, `remaining`, `percentage`, `triggeredThresholds` (array of already-fired thresholds)

#### Scenario: Filter status by scope
- GIVEN pools exist for multiple scopes
- WHEN the client calls `budget.getStatus` with `{ scope: "session" }`
- THEN only session-scoped pools are included

### Requirement: Pre-Query Budget Enforcement
The SDK MUST evaluate applicable budget pools before each LLM query and block the query if any pool with `depletionAction: "block"` is exhausted.

#### Scenario: Query proceeds when budget has remaining tokens
- GIVEN a session-scoped budget with allocated 50000 and consumed 30000
- WHEN a new query is about to execute
- THEN the query proceeds normally

#### Scenario: Query blocked when budget exhausted with block action
- GIVEN a session-scoped budget with allocated 50000, consumed 50000, and depletionAction "block"
- WHEN a new query is about to execute
- THEN the query is NOT executed
- AND the bridge returns error `-32073` with message "Budget exhausted"
- AND the error data includes: `budgetId`, `scope`, `allocated`, `consumed`

#### Scenario: Query proceeds with notify action when exhausted
- GIVEN a session-scoped budget with allocated 50000, consumed 50000, and depletionAction "notify"
- WHEN a new query is about to execute
- THEN the query proceeds AND a `bridge/budget_alert` notification is emitted

#### Scenario: Throttle action applies stream throttle when exhausted
- GIVEN a session-scoped budget with allocated 50000, consumed 50000, and depletionAction "throttle"
- WHEN a new query is about to execute
- THEN the query proceeds with reduced streaming rate
- AND a `bridge/budget_alert` notification is emitted

### Requirement: Post-Query Budget Threshold Evaluation
The SDK MUST evaluate budget thresholds after each completed query to detect threshold crossings.

#### Scenario: Alert fires when threshold crossed
- GIVEN a session budget with thresholds [0.5, 0.8] and pre-query consumed 40000 of 50000 (80%)
- WHEN a query adds 1000 tokens (consumed becomes 41000, 82%)
- THEN no alert fires (0.8 already crossed in prior query)

#### Scenario: Alert fires for newly crossed threshold
- GIVEN a session budget with thresholds [0.5, 0.8, 0.95] and pre-query consumed 38000 of 50000 (76%)
- WHEN a query adds 2000 tokens (consumed becomes 40000, 80%)
- THEN a `bridge/budget_alert` notification fires for the 0.8 threshold

### Requirement: Budget Alert Notification
The bridge MUST emit `bridge/budget_alert` notifications when a budget threshold is crossed or depletion occurs.

The notification MUST include:
- `budgetId` (string)
- `scope` (string)
- `scopeId` (string or null)
- `allocated` (number)
- `consumed` (number)
- `remaining` (number)
- `percentage` (number)
- `threshold` (number or null — null for depletion alerts)
- `depletionAction` (string or null — set for depletion alerts)
- `sessionId` (string — the session that triggered the evaluation)

#### Scenario: Threshold alert carries correct context
- GIVEN session "s1" has budget "b1" with allocated 10000 and threshold 0.8
- WHEN consumption crosses 8000 tokens during a query
- THEN the notification includes budgetId "b1", threshold 0.8, consumed >= 8000, percentage >= 0.8, sessionId "s1"

### Requirement: Budget Threshold Deduplication
Each budget threshold MUST fire at most once per budget pool lifecycle.

#### Scenario: Threshold does not re-fire
- GIVEN budget "b1" has threshold 0.8 and it has already fired
- WHEN subsequent queries further increase consumption past 0.8
- THEN no additional `bridge/budget_alert` fires for that threshold

#### Scenario: Threshold fires again after budget adjustment
- GIVEN budget "b1" has threshold 0.8 which has already fired (consumed 8000 of 10000)
- WHEN the client adjusts allocated to 20000 (consumed now 40%)
- AND subsequent queries bring consumption back above 80% of 20000
- THEN the 0.8 threshold fires again

### Requirement: Session-Scoped Budget Cleanup
The SDK MUST automatically remove session-scoped budget pools when their associated session is destroyed.

#### Scenario: Session budget removed on destroy
- GIVEN session "s1" has a session-scoped budget with scopeId "s1"
- WHEN the session is destroyed
- THEN the budget pool is automatically removed from the registry

#### Scenario: Provider and global budgets unaffected by session destroy
- GIVEN a provider-scoped budget and a global budget exist
- WHEN any session is destroyed
- THEN those pools remain active

### Requirement: Budget Methods in Capabilities
The bridge capability response MUST advertise all `budget.*` methods.

#### Scenario: Capabilities include budget methods
- GIVEN a client calls `bridge.capabilities`
- WHEN the bridge returns capabilities
- THEN the `methods` array includes: `budget.create`, `budget.get`, `budget.list`, `budget.adjust`, `budget.remove`, `budget.getStatus`

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

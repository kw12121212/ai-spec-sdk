---
mapping:
  implementation:
    - src/quota/types.ts
    - src/quota/registry.ts
    - src/quota/enforcer.ts
    - src/bridge.ts
    - src/claude-agent-runner.ts
    - src/session-store.ts
    - src/capabilities.ts
  tests:
    - test/quota/registry.test.ts
    - test/quota/enforcer.test.ts
    - test/quota/bridge-methods.test.ts
    - test/quota/integration.test.ts
---
## ADDED Requirements

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

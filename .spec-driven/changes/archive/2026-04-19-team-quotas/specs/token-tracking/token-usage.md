---
mapping:
  implementation:
    - src/quota/types.ts
    - src/quota/enforcer.ts
  tests:
    - test/quota/enforcer.test.ts
    - test/quota/integration.test.ts
---

## MODIFIED Requirements

### Requirement: Quota Rule Configuration
Previously: A QuotaRule MUST have the following fields: ... `scope`: `"session" | "provider" | "global"` ...
The SDK MUST allow clients to configure quota rules that define token usage limits with scope, limit value, enforcement action, and optional warn threshold. The `scope` MUST be one of `"session" | "provider" | "global" | "team"`.

#### Scenario: Set a valid team-scoped quota rule
- GIVEN a client calls `quota.set` with `{ quotaId: "q-team", scope: "team", scopeId: "team-123", limit: 50000, action: "block" }`
- THEN the bridge stores the rule and returns `{ success: true, quotaId: "q-team" }`

### Requirement: Pre-Query Quota Enforcement
Previously: The SDK MUST evaluate all applicable quota rules before each LLM query execution and block the query if any rule with `action` containing `"block"` is exceeded.
The SDK MUST evaluate all applicable quota rules before each LLM query execution and block the query if any rule with `action` containing `"block"` is exceeded, including team-scoped rules associated with the session's `teamId`.

#### Scenario: Query blocked when team quota exceeded
- GIVEN a session with `teamId: "team-123"`
- AND a team quota rule exists for "team-123" with limit 10000 and action "block"
- AND aggregate usage for "team-123" is >= 10000
- WHEN the agent attempts a query
- THEN the query is blocked
- AND the bridge returns error `-32060` with message "Quota exceeded"

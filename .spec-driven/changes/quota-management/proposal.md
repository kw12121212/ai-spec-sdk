# quota-management

## What

Implement a quota management system that enforces configurable token usage limits across multiple scopes (session, provider, global) with pluggable enforcement actions (warn, block, or both). The system integrates with the existing `TokenStore` and `TokenRecord` infrastructure to check quotas in real time before and after each LLM query, exposing quota state and violation events through JSON-RPC methods and bridge notifications.

## Why

The existing `token-tracking` change (Milestone 08, complete) provides comprehensive recording and aggregation of token usage per session, per message, and per provider — but there is no mechanism to enforce limits on that usage. Without quota management:

- Unbounded token consumption can lead to unexpected API costs, especially with multiple sessions or long-running agents.
- Multi-tenant or shared deployments have no way to isolate or cap per-session/provider usage.
- Downstream integrators (GUI clients, CI pipelines) lack a programmatic signal when usage approaches or exceeds limits.

Quota management is the natural next step after token tracking: it consumes the same aggregated data and adds policy-based guardrails, directly supporting the Milestone 08 done criterion: *"Quota limits are enforced with configurable actions (warn/block)."*

## Scope

### In Scope

- **Quota configuration model**: define quotas with scope (`session`, `provider`, `global`), limit (max tokens), window period (optional rolling-window support), and enforcement action (`"warn"` | `"block"` | `"warn+block"`)
- **Quota registry**: CRUD operations for quota rules via JSON-RPC (`quota.set`, `quota.get`, `quota.list`, `quota.remove`, `quota.clear`)
- **Real-time quota checking**: hook into the query pipeline (pre-query and post-query) to evaluate current usage against configured quotas
- **Quota state queries**: `quota.getStatus(scopes?)` returns current usage vs. limit for active quotas; `quota.getViolations(sessionId?)` returns historical violations
- **Bridge notifications**: emit `bridge/quota_warning` when a quota crosses the warn threshold and `bridge/quota_blocked` when a query is denied
- **Block semantics**: when action includes `"block"`, deny the incoming query and return a structured JSON-RPC error (`-32060`) with quota details; the session remains usable for non-LLM operations
- **Session-scoped quota lifecycle**: session quotas are automatically removed when the session is destroyed

### Out of Scope

- Distributed quota coordination across multiple bridge processes
- Monetary/cost-based quotas (token-count only)
- Quota persistence across bridge restarts (in-memory only for v1; persistence deferred to Milestone 14)
- Per-team or per-user quotas (deferred to Milestone 10 task-team-registry)
- Dynamic quota adjustment via external policy engines
- Rate-limiting-style time-window throttling (already covered by existing `rate-limiter`)

## Unchanged Behavior

- Existing `token.*` methods (`getSessionSummary`, `getMessageUsage`, `getProviderUsage`, etc.) MUST continue to work without any behavioral change
- Existing `provider.*` methods MUST remain unaffected
- Session lifecycle (start, resume, pause, stop, destroy) MUST NOT change its current behavior or state transitions
- Queries that do not trigger any quota rule MUST execute exactly as they do today
- The `TokenStore.record()` method and `TokenRecord` data model are read-only from the quota system's perspective — no mutation of stored records

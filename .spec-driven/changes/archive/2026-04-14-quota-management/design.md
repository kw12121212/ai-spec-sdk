# Design: quota-management

## Approach

The quota system is implemented as three new source modules under `src/quota/` that integrate with the existing `TokenStore` as a read-only consumer:

1. **`src/quota/types.ts`** — defines `QuotaRule`, `QuotaStatus`, `QuotaViolation`, and the `QuotaScope` union type
2. **`src/quota/registry.ts`** — in-memory store for active quota rules with CRUD operations; scoped cleanup on session destroy
3. **`src/quota/enforcer.ts`** — evaluation engine called at pre-query and post-query points in `claude-agent-runner.ts`; compares current `TokenStore` aggregates against matching rules; emits notifications and returns block decisions

Integration points:

- **`src/bridge.ts`** — register new `quota.*` JSON-RPC method handlers; add quota notification types to the capability response
- **`src/claude-agent-runner.ts`** — call `QuotaEnforcer.preQueryCheck()` before launching each query; if blocked, short-circuit with error `-32060`; call `QuotaEnforcer.postQueryCheck()` after recording tokens to detect warn threshold crossings
- **`src/session-store.ts`** — hook into session destroy to purge session-scoped quotas from the registry
- **`src/capabilities.ts`** — advertise new `quota.*` methods

### Data Flow

```
Client sends session.start/resume
  → bridge routes to claude-agent-runner
    → QuotaEnforcer.preQueryCheck(sessionId, providerId)
      → reads TokenStore.getSessionUsage() / getProviderUsage()
      → matches against QuotaRegistry rules
      → if any block-rule exceeded → return { allowed: false, violation }
      → if any warn-rule exceeded → emit bridge/quota_warning notification
    → if blocked → return error -32060 to client (session stays alive)
    → if allowed → proceed with query execution
    → query completes → TokenStore.record() called
    → QuotaEnforcer.postQueryCheck(sessionId, providerId)
      → re-evaluates warn thresholds (may emit bridge/quota_warning)
      → records violation if block was crossed (should not happen due to pre-check, but defensive)
```

## Key Decisions

1. **In-memory quota registry (no persistence yet)**: Quotas are reset on bridge restart. This keeps the change self-contained and avoids coupling to Milestone 14's persistence layer. The `quota.set` API accepts an optional `persist: boolean` field that is accepted but ignored in this implementation, providing a forward-compatible surface.

2. **Pre-query blocking, not mid-stream**: Quotas are checked *before* a query starts, not during streaming. This avoids the complexity of canceling in-flight streams and provides cleaner error semantics. Post-query checks only handle warn-level notifications.

3. **Quota scope maps to existing TokenStore queries**: Each scope directly corresponds to an existing `TokenStore` method:
   - `session` → `TokenStore.getSessionUsage(sessionId).totalTokens`
   - `provider` → `TokenStore.getProviderUsage(providerId)[0].totalTokens`
   - `global` → sum of all `TokenStore.getProviderUsage()` entries' totalTokens

4. **Warn threshold is a percentage of limit**: A quota rule has `limit` (hard cap) and optional `warnThreshold` (default 80%). When usage >= limit × warnThreshold, a warning fires but the query proceeds.

5. **Block error code -32060**: Allocated in the application-specific error range (≥ -32000) used by other SDK errors (-32001 through -32052 are already taken).

6. **Notifications use existing bridge/notification channel**: `bridge/quota_warning` and `bridge/quota_blocked` follow the same pattern as `bridge/session_event` and `bridge/tool_approval_requested`.

## Alternatives Considered

1. **Middleware/hook-based enforcement via hooks-store**: Could register quota checks as execution hooks in the existing `hooks-store.ts`. Rejected because hooks are designed for extensible user-defined logic, not core infrastructure policy. Quota enforcement needs guaranteed ordering and synchronous pre-query behavior that the hook model does not provide.

2. **TokenStore-embedded quota fields**: Could add quota metadata directly to `TokenRecord` or `SessionTokenSummary`. Rejected because it would couple the read-only tracking layer to policy concerns, violating separation of concerns established by the token-tracking design.

3. **Post-query-only checking**: Only check after queries complete and retroactively log violations. Rejected because it cannot prevent over-consumption — the whole point of a quota system is to block before cost is incurred.

# Design: token-budget

## Approach

Introduce a `BudgetPool` concept alongside the existing quota system. A budget pool has an allocated amount, tracks consumption via TokenStore, and fires alerts at configurable thresholds. The budget system lives in `src/budget/` as a new module parallel to `src/quota/` and `src/token-tracking/`.

Key components:
- `src/budget/types.ts` — BudgetPool, BudgetThreshold, BudgetAlert types and validation
- `src/budget/registry.ts` — BudgetRegistry to create, query, adjust, and remove pools
- `src/budget/enforcer.ts` — Pre/post-query budget evaluation, threshold crossing detection, alert emission
- New JSON-RPC methods in `src/bridge.ts` under the `budget.*` namespace
- Integration with TokenStore for real-time consumption data (reuses existing `getSessionUsage` / `getProviderUsage` accessors)

Budgets are evaluated alongside quotas in the existing pre-query/post-query hooks. Budget alerts and quota warnings are independent notification channels.

## Key Decisions

1. **Separate module from quota** — Budgets track proactive allocation with drawdown; quotas enforce reactive limits. Keeping them separate avoids conceptual confusion and allows independent evolution.
2. **Reuse TokenStore for consumption** — Budget pools read current usage from TokenStore rather than maintaining a parallel counter. Single source of truth for token consumption.
3. **Multi-threshold alerts** — Each budget supports an array of thresholds (e.g., `[0.5, 0.75, 0.9]`) with deduplication so each threshold fires at most once per budget.
4. **Depletion actions** — When budget is exhausted, configurable action determines behavior: `block` (reject query), `throttle` (reduce streaming rate), or `notify` (alert only, allow execution).

## Alternatives Considered

- **Extend quota system** — Could add budgets as quota fields, but the semantics differ enough (allocation vs. limit, multi-threshold vs. single warnThreshold) to warrant separation.
- **Client-side budget tracking** — Clients could track budgets themselves using TokenStore data, but this duplicates logic and doesn't enable pre-query blocking.
- **Single threshold per budget** — Simpler but less useful; production users typically want progressive alerts at 50%, 75%, 90%.

# token-budget

## What

Add a token budget allocation system that allows clients to define upfront token budgets for sessions, providers, or global scope, with multi-threshold alerting and configurable depletion behavior.

## Why

The existing quota system enforces hard limits (`warn`/`block`), but does not support proactive budget allocation where a token pool is reserved and drawn down over time. Budgets differ from quotas in three ways: (1) they track allocated vs. consumed vs. remaining balance, (2) they support multiple configurable alert thresholds (e.g., 50%, 75%, 90%), and (3) they allow configurable depletion actions beyond simple block. This is needed for production scenarios where teams need fine-grained cost control and proactive alerting before limits are hit.

## Scope

- Budget allocation with explicit token pools (allocated, consumed, remaining)
- Multi-threshold alert configuration per budget
- Configurable depletion actions: `throttle`, `block`, `notify`
- Budget lifecycle aligned with session lifecycle
- JSON-RPC methods: `budget.create`, `budget.get`, `budget.list`, `budget.adjust`, `budget.remove`, `budget.getStatus`
- `bridge/budget_alert` notification when thresholds are crossed
- Integration with existing TokenStore for consumption tracking

## Unchanged Behavior

- Existing quota rules and enforcement continue to work independently
- Token recording in TokenStore is not modified
- Stream control behavior is not affected
- Quota violation history and quota JSON-RPC methods remain unchanged

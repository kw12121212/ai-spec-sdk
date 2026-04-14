# load-balancer

## What
Add a load balancer layer to the LLM provider subsystem that distributes requests
across multiple registered provider instances using configurable routing strategies.
Exposes `balancer.create`, `balancer.remove`, `balancer.list`, and `balancer.status`
JSON-RPC methods on the bridge.

## Why
Milestone 08 is 6/7 complete. The load balancer is the only remaining planned change.
Completing it closes the milestone and unblocks Milestone 12 (Streaming and Token
Management), which has an explicit dependency on M08. It also gives SDK consumers a
high-availability routing primitive that complements the already-shipped fallback chain.

## Scope

**In scope:**
- `BalancerConfig` type: `id`, `strategy` (`"round-robin"` required; `"weighted"` optional),
  `providerIds` (ordered list of registered provider IDs), optional per-provider `weights`
- `LoadBalancer` class in `src/llm-provider/load-balancer.ts`:
  - Selects the next healthy provider according to the configured strategy
  - Excludes providers reactively after a live-request failure (re-admits after a
    configurable cool-down, defaulting to 30 s)
  - Delegates to the selected provider's existing fallback chain if that provider
    has `fallbackProviderIds` configured (composable, not duplicated)
- Bridge handler registration for four JSON-RPC methods:
  - `balancer.create` — create a named balancer over a set of provider IDs
  - `balancer.remove` — remove a balancer by ID
  - `balancer.list` — list all configured balancers (IDs, strategies, provider counts)
  - `balancer.status` — return per-provider health and exclusion state for a balancer
- Persistence of balancer configurations to `ConfigStore` under key `llmBalancers`
- Emission of `bridge/balancer_provider_excluded` and
  `bridge/balancer_provider_readmitted` events on state transitions
- Session-level association: `session.create` / `session.setProvider` accept a
  `balancerId` field in addition to `providerId`

**Out of scope:**
- Proactive health-poll background process (reactive exclusion only at v1)
- Least-connections or latency-based strategies
- Cross-process or distributed balancer state

## Unchanged Behavior

Behaviors that must not change as a result of this change:
- Existing `provider.*` JSON-RPC methods are not modified
- The fallback chain behavior implemented in `provider-fallback` is not changed
- Sessions using `providerId` (not `balancerId`) continue to work as before
- Token tracking and quota enforcement operate per the provider actually used

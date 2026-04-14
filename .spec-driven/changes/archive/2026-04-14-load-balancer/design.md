# Design: load-balancer

## Approach

Introduce a `LoadBalancer` class (`src/llm-provider/load-balancer.ts`) that wraps the
existing `ProviderRegistry`. The balancer holds an ordered list of provider IDs and
a mutable exclusion set. On each route call it picks the next eligible provider per the
configured strategy and marks a provider as temporarily excluded if its request throws.
A `setTimeout`-based re-admission timer clears the exclusion after the cool-down period.

Bridge handlers for `balancer.*` methods are wired in `src/bridge.ts` alongside the
existing `provider.*` handlers. A `BalancerRegistry` (similar to the existing
`ProviderRegistry`) manages named `LoadBalancer` instances and persists their configs.

Session association (`balancerId`) is handled at request-dispatch time: if the active
session has a `balancerId`, the bridge calls `BalancerRegistry.route(balancerId)` to
obtain the target provider, then proceeds with the existing provider dispatch logic.

## Key Decisions

1. **Reactive exclusion only** — providers are excluded only after a live-request
   failure, not by polling. This keeps the implementation simple and consistent with
   how `provider-fallback` already handles errors. A proactive poller can be added in
   a future change without breaking the interface.

2. **Round-robin required, weighted optional** — `strategy: "round-robin"` is the
   baseline (uniform distribution, easy to test, no extra config). `strategy: "weighted"`
   is supported if `weights` is provided; defaults to equal weights if omitted, making it
   backward-compatible with round-robin behavior.

3. **Composable with fallback chains** — when the balancer selects provider P and P
   has `fallbackProviderIds`, the existing fallback logic activates independently on P's
   error *after* the balancer has already chosen P. This avoids duplicating fallback
   semantics in the balancer and keeps each layer's responsibility clear.

4. **Config persisted to `ConfigStore` under `llmBalancers`** — consistent with how
   `llmProviders` is persisted; balancers survive bridge restarts.

5. **`BalancerRegistry` as a separate module** — mirrors `ProviderRegistry` structure
   (`src/llm-provider/balancer-registry.ts`) so bridge wiring is straightforward and
   the registry can be tested in isolation.

## Alternatives Considered

- **Extending `ProviderRegistry` instead of a new registry** — rejected because mixing
  balancer lifecycle (create/remove named balancers) into provider lifecycle would make
  `provider-registry.ts` harder to reason about and test.
- **Proactive health-poll at v1** — rejected as over-engineering for the first cut;
  reactive exclusion handles the common failure case with far less complexity.
- **Treating the balancer as just another provider (implementing `LLMProvider`)** —
  rejected because balancers do not own API keys or model configs; wrapping them as
  providers would require dummy implementations of `initialize`, `getCapabilities`, etc.

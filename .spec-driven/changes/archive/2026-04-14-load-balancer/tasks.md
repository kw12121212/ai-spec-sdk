# Tasks: load-balancer

## Implementation

- [x] Add `BalancerConfig` and `BalancerStatus` types to `src/llm-provider/types.ts`
- [x] Implement `LoadBalancer` class in `src/llm-provider/load-balancer.ts` with round-robin and weighted strategies, reactive exclusion, and configurable cool-down (default 30 s)
- [x] Implement `BalancerRegistry` class in `src/llm-provider/balancer-registry.ts` with create, remove, get, list, and route methods; persist configs to `ConfigStore` under `llmBalancers`
- [x] Wire `balancer.create`, `balancer.remove`, `balancer.list`, and `balancer.status` JSON-RPC handlers in `src/bridge.ts`
- [x] Add `balancerId` support to session creation and `session.setProvider` dispatch in `src/bridge.ts`; when a session has a `balancerId` the bridge calls `BalancerRegistry.route()` to select the active provider
- [x] Emit `bridge/balancer_provider_excluded` event when a provider is reactively excluded, and `bridge/balancer_provider_readmitted` when the cool-down expires
- [x] Load persisted balancer configs on bridge startup (alongside existing provider config loading)

## Testing

- [x] Run `bun run typecheck` (or equivalent TSC check) — zero type errors
- [x] Run `bun test` — all existing tests pass, new tests pass
- [x] Write `test/load-balancer.test.ts`: unit tests for `LoadBalancer` — round-robin rotation, weighted selection, reactive exclusion after failure, re-admission after cool-down, all-excluded edge case
- [x] Write `test/balancer-registry.test.ts`: unit tests for `BalancerRegistry` — create/remove/list/route lifecycle, persistence round-trip, unknown balancer ID error
- [x] Write `test/load-balancer-bridge.test.ts`: bridge-level integration tests for `balancer.create`, `balancer.remove`, `balancer.list`, `balancer.status`, and session routing via `balancerId`

## Verification

- [x] Confirm `balancer.create` rejects unknown provider IDs with error `-32001`
- [x] Confirm sessions using `providerId` (not `balancerId`) are unaffected
- [x] Confirm `provider.*` JSON-RPC methods are unchanged and all existing provider tests still pass
- [x] Confirm balancer configs survive a simulated bridge restart (ConfigStore round-trip)
- [x] Confirm `bridge/balancer_provider_excluded` and `bridge/balancer_provider_readmitted` events are emitted at the correct times

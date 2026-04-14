# provider-fallback

## What

Add an ordered fallback chain to provider configuration. When the active provider returns an error during a live request, the SDK automatically retries the request on the next provider in the chain, transparently to the session caller. The chain is configured as `fallbackProviderIds` on the primary provider's `ProviderConfig`. A `provider.fallback.activated` event is emitted whenever the chain advances. A new `provider.getFallbackChain` JSON-RPC method exposes the configured chain for inspection.

## Why

Milestone 08 requires that "fallback to backup provider occurs seamlessly on primary failure." The existing `resolveForSession` method in `ProviderRegistry` performs a silent, hardcoded fallback (session provider → default provider → built-in Claude runner) but it is not configurable, not observable, and cannot extend beyond two levels. This change replaces that implicit fallback with an explicit, user-configured, observable fallback chain, satisfying the milestone's done criterion and giving operators visibility into failover events.

## Scope

**In scope:**
- `fallbackProviderIds?: string[]` field added to `ProviderConfig` in `src/llm-provider/types.ts`
- Validation that `fallbackProviderIds` is an array of strings when present; validate IDs exist at resolve time, not at registration time (permits deferred registration order)
- Reactive fallback in `ProviderRegistry.resolveForSession`: build the candidate list `[sessionActive, ...primaryFallbackChain, default]`, walk it in order, advance on error, stop at first success
- `provider.fallback.activated` event emitted on the bridge event bus when fallback advances, with payload `{ fromProviderId: string, toProviderId: string, reason: string, sessionId: string }`
- `provider.getFallbackChain` JSON-RPC method returning `{ providerId: string, fallbackProviderIds: string[] }` for a given provider
- `provider.register` and `provider.update` bridge handlers pass through `fallbackProviderIds` when present
- Persistence: `fallbackProviderIds` is stored and reloaded with provider config (already covered by the generic spread in `saveToStore`/`loadFromStore` — verify round-trip in tests)

**Out of scope:**
- Proactive health polling, circuit breakers, or background health-check loops
- Cross-session fallback state (each request independently walks the chain)
- Fallback for `provider.switch` (explicit switching is not automatic)
- Load balancing or request distribution across healthy providers

## Unchanged Behavior

- All existing `provider.*` JSON-RPC methods (register, list, get, update, remove, setDefault, getDefault, healthCheck, switch) must behave identically when `fallbackProviderIds` is absent or empty
- Sessions with no fallback configuration continue using the existing resolution order (session active → default → built-in)
- `provider.healthCheck` remains an on-demand check; it does not trigger fallback

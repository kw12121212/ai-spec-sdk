# Tasks: provider-fallback

## Implementation

- [x] Add `fallbackProviderIds?: string[]` to `ProviderConfig` in `src/llm-provider/types.ts`
- [x] Add `fallbackProviderIds` validation in `ProviderRegistry.validateConfig`: must be an array of strings when present; invalid type returns a validation error
- [x] Refactor `ProviderRegistry.resolveForSession` to build an explicit ordered candidate list: `[sessionActive, ...(primaryConfig.fallbackProviderIds ?? []), default]`; walk the list reactively, advance on request error, stop at first success
- [x] Emit `provider.fallback.activated` on the bridge event bus when the chain advances, with payload `{ fromProviderId, toProviderId, reason, sessionId }`
- [x] Add `provider.getFallbackChain` JSON-RPC handler in `src/bridge.ts` returning `{ providerId, fallbackProviderIds: string[] }` for a given provider ID; return `-32001` if provider not found
- [x] Ensure `provider.register` and `provider.update` bridge handlers pass through `fallbackProviderIds` when present in the params
- [x] Verify `fallbackProviderIds` round-trips correctly through `saveToStore`/`loadFromStore` (already covered generically by the spread — add an explicit assertion in tests)

## Testing

- [x] `bun run lint` (runs `tsc --noEmit` — must pass with zero errors)
- [x] `bun test test/provider-registry.test.ts test/provider-fallback.test.ts test/provider-registry-bridge.test.ts`
- [x] Unit test: `provider.register` with `fallbackProviderIds` stores the chain and `provider.getFallbackChain` returns it
- [x] Unit test: `provider.register` with `fallbackProviderIds` as a non-array returns `-32602`
- [x] Unit test: `fallbackProviderIds` survives a `saveToStore` → `loadFromStore` round-trip
- [x] Unit test: fallback activates when the primary provider throws on `resolveForSession` — backup is used and its result is returned
- [x] Unit test: fallback walks the chain in order; stops at first success; skips failed providers
- [x] Unit test: error is returned when all providers in the chain fail
- [x] Unit test: `provider.fallback.activated` event is emitted with correct `fromProviderId`, `toProviderId`, `reason`, and `sessionId` payload
- [x] Unit test: one event is emitted per chain-step advance (two events for primary→b1→b2)
- [x] Unit test: sessions with no fallback config continue using existing resolution order unchanged
- [x] Unit test: `provider.getFallbackChain` returns empty array for a provider without `fallbackProviderIds`
- [x] Unit test: `provider.getFallbackChain` returns `-32001` for an unknown provider ID
- [x] Unit test: `provider.update` with `fallbackProviderIds` updates the stored chain

## Verification

- [x] Verify `ProviderConfig.fallbackProviderIds` is typed as `string[] | undefined`, not `unknown`
- [x] Verify fallback trigger is reactive only (no background health polling introduced)
- [x] Verify `provider.fallback.activated` event payload matches the delta spec fields
- [x] Verify `provider.getFallbackChain` is handled in `src/bridge.ts` and covered by a bridge-level test
- [x] Verify unchanged behavior: all existing `provider.*` methods pass their existing tests without modification

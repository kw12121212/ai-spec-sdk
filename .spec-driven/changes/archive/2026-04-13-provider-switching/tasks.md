# Tasks: provider-switching

## Implementation

- [x] Extend `SessionStore` session record schema with `activeProviderId?: string` field, ensure it is persisted and restored on load
- [x] Add `resolveForSession(sessionId: string): Promise<LLMProvider>` method to `ProviderRegistry` with fallback chain: session override → registry default → built-in Anthropic
- [x] Add `switchSessionProvider(sessionId, targetProviderId)` method to `ProviderRegistry` with validation (exists + health check) and before/after return value
- [x] Add `provider.switch` JSON-RPC handler in `bridge.ts` with full validation chain (session exists, switchable state, provider registered, healthy) and notification emission
- [x] Add `session.setProvider` JSON-RPC handler in `bridge.ts` delegating to the same core switching logic
- [x] Integrate provider resolution into `runClaudeQuery` in `claude-agent-runner.ts` — accept optional `providerId`, route to `LLMProvider.query()`/`queryStream()` when provided
- [x] Wire session's `activeProviderId` into query launch path in bridge so that `session.start` and `session.resume` resolve and pass the effective provider to the runner
- [x] Include `activeProviderId` in `session.status` response and `session.list` entries
- [x] Add `"provider.switch"` and `"session.setProvider"` to `bridge.capabilities` methods array
- [x] Define new error code `-32004` ("Provider unhealthy") in error constants

## Testing

- [x] Run `bun run lint` (tsc --noEmit) and fix any type errors
- [x] Run `bun run test` and ensure all existing tests still pass (no regressions)
- [x] Write unit tests in `test/provider-switching.test.ts` covering:
  - `resolveForSession` fallback chain (session override, registry default, built-in fallback)
  - `resolveForSession` graceful degradation when override provider is removed or unhealthy
  - `switchSessionProvider` success cases (idle, paused, running sessions)
  - `switchSessionProvider` rejection cases (unknown session, non-switchable state, unknown provider, unhealthy provider)
  - Idempotent switch to same provider
- [x] Write integration tests in `test/provider-switching-bridge.test.ts` covering:
  - `provider.switch` JSON-RPC round-trip (valid request, all error codes)
  - `session.setProvider` JSON-RPC round-trip (identical behavior to `provider.switch`)
  - `bridge/provider_switched` notification emission with correct payload
  - `activeProviderId` appears in `session.status` and `session.list`
  - Capabilities include new methods
  - Switch takes effect on next query turn (provider used after switch matches target)

## Verification

- [x] Verify implementation matches proposal scope (no out-of-scope features added)
- [x] Verify all delta spec scenarios have corresponding test coverage
- [x] Verify backward compatibility: sessions without `activeProviderId` work exactly as before

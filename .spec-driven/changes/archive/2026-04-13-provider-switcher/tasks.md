# Tasks: provider-switcher

## Implementation

- [x] Task 1: Write delta spec for provider switching scenarios in `specs/llm-provider/provider-registry.md`
- [x] Task 2: Verify `ProviderRegistry.switchSessionProvider()` implementation matches spec requirements
- [x] Task 3: Verify `ProviderRegistry.resolveForSession()` fallback chain matches spec requirements
- [x] Task 4: Verify bridge `provider.switch` method matches spec (params validation, error codes, state checks, notification)
- [x] Task 5: Verify bridge `session.setProvider` alias matches spec
- [x] Task 6: Verify `session.status` reflects `activeProviderId` per spec
- [x] Task 7: Fix any implementation gaps found during verification

## Testing

- [x] Lint: run `bun run lint` (tsc --noEmit) — passes with zero errors
- [x] Unit tests `test/provider-switching.test.ts`:
  - [x] resolveForSession: session activeProviderId takes priority when healthy
  - [x] resolveForSession: falls back to defaultProviderId when no active provider
  - [x] resolveForSession: falls back to built-in when active provider not registered
  - [x] resolveForSession: unhealthy session provider falls through to default
  - [x] resolveForSession: built-in fallback when no providers configured
  - [x] resolveForSession: handles non-existent session gracefully
  - [x] switchSessionProvider: successful switch returns correct shape
  - [x] switchSessionProvider: tracks previousProviderId on re-switch
  - [x] switchSessionProvider: NOT_FOUND error for unregistered target
  - [x] switchSessionProvider: result shape with all fields verified
  - [x] switchSessionProvider: null previousProviderId when no active provider
  - [x] switchSessionProvider: non-existent session returns null previousProviderId
  - [x] setSessionGetter: dynamic session getter update
- [x] Integration tests `test/provider-switching-bridge.test.ts`:
  - [x] provider.switch: switch on existing session succeeds
  - [x] provider.switch: emits bridge/provider_switched notification
  - [x] provider.switch: missing sessionId returns -32602
  - [x] provider.switch: missing providerId returns -32602
  - [x] provider.switch: non-existent session returns -32011
  - [x] provider.switch: non-existent provider returns -32001
  - [x] provider.switch: non-string sessionId returns -32602
  - [x] provider.switch: non-string providerId returns -32602
  - [x] provider.switch: notification includes timestamp field
  - [x] session.setProvider: alias behaves identically to provider.switch
  - [x] session.status: shows null activeProviderId before switch
  - [x] session.status: shows updated activeProviderId after switch
  - [x] capabilities: lists provider.switch and session.setProvider

## Verification

- [x] Task 11: Verify implementation matches proposal via `/spec-driven-verify`

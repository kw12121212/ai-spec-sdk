# Tasks: quota-management

## Implementation

- [ ] Create `src/quota/types.ts` — define `QuotaScope`, `QuotaRule`, `QuotaStatus`, `QuotaViolation`, and validation functions
- [ ] Create `src/quota/registry.ts` — implement in-memory `QuotaRegistry` class with set/get/list/remove/clear methods; include session-scoped cleanup helper
- [ ] Create `src/quota/enforcer.ts` — implement `QuotaEnforcer` with `preQueryCheck(sessionId, providerId)` and `postQueryCheck(sessionId, providerId)` methods; integrate with TokenStore as read-only consumer
- [ ] Wire quota enforcement into `src/claude-agent-runner.ts` — call enforcer.preQueryCheck before each query; short-circuit on block; call enforcer.postQueryCheck after token recording
- [ ] Register `quota.*` JSON-RPC method handlers in `src/bridge.ts` — quota.set, quota.get, quota.list, quota.remove, quota.clear, quota.getStatus, quota.getViolations
- [ ] Add session-scoped quota cleanup to `src/session-store.ts` — call registry.removeBySession on session destroy
- [ ] Advertise quota methods in `src/capabilities.ts` — add all quota.* methods to capabilities response
- [ ] Export new modules from `src/index.ts` if needed for test access

## Testing

- [ ] Run `bun run lint` (tsc --noEmit) and fix any type errors
- [ ] Create `test/quota/registry.test.ts` — unit tests for QuotaRegistry CRUD: set valid/invalid rules, duplicate rejection, get existing/non-existent, list filtering, remove, clear, session-scoped cleanup
- [ ] Create `test/quota/enforcer.test.ts` — unit tests for QuotaEnforcer: preQueryCheck allow/block/warn scenarios, postQueryCheck warn detection, scope-to-TokenStore mapping correctness, warnThreshold percentage calculation
- [ ] Create `test/quota/bridge-methods.test.ts` — tests for JSON-RPC method routing: parameter validation, error codes (-32060, -32061, -32602), response shapes for all 7 methods
- [ ] Create `test/quota/integration.test.ts` — integration tests using stubbed TokenStore: full flow from quota.set → query trigger → enforcement → notification emission → violation recording → quota.remove on session destroy

## Verification

- [ ] Verify all spec requirements have corresponding test coverage
- [ ] Verify no regression in existing token-tracking or provider-registry behavior
- [ ] Verify bridge.capabilities includes all new quota.* methods
- [ ] Verify error code -32060 does not collide with existing error codes

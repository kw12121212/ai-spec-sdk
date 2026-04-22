# Tasks: token-budget

## Implementation
- [x] Create `src/budget/types.ts` with BudgetPool, BudgetThreshold, BudgetAlert types and `validateBudgetPool` function
- [x] Create `src/budget/registry.ts` with BudgetRegistry class (create, get, list, adjust, remove, getMatchingPools, recordAlert)
- [x] Create `src/budget/enforcer.ts` with pre-query budget check, post-query threshold evaluation, and alert emission
- [x] Register `budget.*` JSON-RPC methods in `src/bridge.ts` (create, get, list, adjust, remove, getStatus)
- [x] Add budget methods to capabilities in `src/capabilities.ts`
- [x] Wire budget cleanup into session destroy flow in `src/session-store.ts`

## Testing

- [x] Run `bun run lint` — lint validation
- [x] Run `bun test` — unit tests for budget registry, enforcer, and bridge methods

## Verification
- [x] Verify implementation matches proposal scope

# Questions: contract-type-generation

## Open

<!-- No open questions -->

## Resolved

- [x] Q: Should we add a CI check that fails if generated types are out of sync with the contract?
  - Context: Ensures the contract and types never drift in future PRs
  - Impact: Would add a CI job that runs `generate:types` and checks for git diff
  - Recommendation: Yes, add as a follow-up task after this change is complete
  - A: No, will not use CI/CD for this project

- [x] Q: How should we handle types that exist in hand-written files but have no corresponding contract definition?
  - Context: Some utility types may be client-specific and not part of the bridge contract
  - Impact: May need to preserve some hand-written types in a separate file
  - Recommendation: Keep client-specific utilities in `types.utils.ts` (TypeScript) or `_utils.py` (Python)
  - A: Accepted recommendation - separate client-specific utilities to `types.utils.ts` (TypeScript) and `_utils.py` (Python)

- [x] Q: Should the generator support incremental updates or always regenerate the entire file?
  - Context: Full regeneration is simpler; incremental is faster for large contracts
  - Impact: Full regeneration is acceptable given the contract size (~1000 lines)
  - Recommendation: Full regeneration only - simpler and contract is not large enough to warrant incremental
  - A: Accepted recommendation - use full regeneration only

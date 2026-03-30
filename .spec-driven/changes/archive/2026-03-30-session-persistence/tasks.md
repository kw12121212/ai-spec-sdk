# Tasks: session-persistence

## Implementation

- [x] Extend `Session.status` type to include `"interrupted"` in `src/session-store.ts`
- [x] Add recovery logic in `SessionStore._loadFromDisk()`: mark active sessions as interrupted and persist
- [x] Add `export(sessionId)` method to `SessionStore`
- [x] Add `delete(sessionId)` method to `SessionStore` (remove from memory + delete file, reject active)
- [x] Add `cleanup(olderThanDays)` method to `SessionStore` (bulk delete non-active old sessions)
- [x] Add `session.export`, `session.delete`, `session.cleanup` cases to bridge dispatch in `src/bridge.ts`
- [x] Add error code `-32070` constant for active-session deletion rejection
- [x] Update `docs/bridge-contract.yaml`: fix "in-memory only" to describe file persistence, add `interrupted` status transition, document three new methods

## Testing

- [x] Lint passes
- [x] Unit tests for interrupted recovery in `SessionStore` (active session on disk becomes interrupted on reload)
- [x] Unit tests for `session.export` (happy path, unknown session error)
- [x] Unit tests for `session.delete` (happy path, active session error, unknown session error, file removed from disk)
- [x] Unit tests for `session.cleanup` (happy path with default, custom days, preserves active, caps at 365, rejects < 1)
- [x] All existing tests continue to pass

## Verification

- [x] Verify implementation matches proposal scope (no debounced writes, no pluggable backend)
- [x] Verify delta spec scenarios are covered by tests
- [x] Verify `bridge-contract.yaml` accurately reflects new behavior

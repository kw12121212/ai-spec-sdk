# Tasks: bridge-session-ux

## Implementation

- [x] Create `src/context-store.ts` with ContextStore class (read, write, list, path sandboxing for workspace + user scopes)
- [x] Add `context.read`, `context.write`, `context.list` dispatch cases to BridgeServer
- [x] Add file change tracking: emit `bridge/file_changed` notification on Write/Edit tool_use messages in `_runQuery`
- [x] Add `session.branch` dispatch case to BridgeServer (copy history, attempt SDK resume)
- [x] Add `session.search` dispatch case to BridgeServer (substring search across sessions)
- [x] Update `src/capabilities.ts` to advertise new methods (context.*, session.branch, session.search)
- [x] Update `src/index.ts` to re-export new types
- [x] Update `example/go-cli/main.go` with context, branch, and search commands

## Testing

- [x] Create `test/context-store.test.ts` with unit tests for read, write, list, path sandboxing, user scope
- [x] Add file change tracking tests to bridge test (Write and Edit tool_use emit file_changed)
- [x] Add session.branch tests (history copy, SDK resume, prompt start)
- [x] Add session.search tests (query match, workspace/status filter, limit cap)
- [x] TypeScript typecheck passes
- [x] All tests pass

## Verification

- [x] Delta specs match implemented behavior
- [x] Go CLI example builds and demonstrates new features
- [x] No regressions in existing tests

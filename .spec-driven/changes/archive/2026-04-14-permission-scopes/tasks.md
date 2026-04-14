# Tasks: permission-scopes

## Implementation

- [x] Create `src/permission-scopes.ts` with ToolScope type, TOOL_SCOPE_MAP, and resolveScopes function
- [x] Add scope fields (allowedScopes, blockedScopes) to session data model in `src/session-store.ts`
- [x] Add scope fields to template data model in `src/template-store.ts`
- [x] Add `allowedScopes` and `blockedScopes` parameter parsing and validation to `session.start` in `src/bridge.ts`
- [x] Add `allowedScopes` and `blockedScopes` parameter parsing and validation to `session.spawn` in `src/bridge.ts`
- [x] Add `allowedScopes` and `blockedScopes` parameter parsing and validation to `session.resume` in `src/bridge.ts`
- [x] Add scope check logic before tool execution in `_runQuery` onEvent handler in `src/bridge.ts`
- [x] Emit `bridge/scope_denied` notification when a tool is blocked by scope
- [x] Write `scope_denied` audit entries via AuditLog
- [x] Add `permissions.scopes` method to dispatch table in `src/bridge.ts`
- [x] Add `permissions.scopes` to capabilities method list in `src/capabilities.ts`
- [x] Add `allowedScopes` and `blockedScopes` support to `template.create` in `src/bridge.ts`
- [x] Wire template scope fields into session creation with explicit-params-override semantics

## Testing

- [x] `bun run lint` (runs `tsc --noEmit` — must pass with zero errors)
- [x] `bun test test/permission-scopes.test.ts` — unit tests for scope resolution and evaluation
- [x] Unit test: resolveScopes returns correct scope for each built-in tool
- [x] Unit test: custom tools resolve to `system` scope
- [x] Unit test: unknown tools resolve to `system` scope as default
- [x] Unit test: session.start with allowedScopes restricts tool execution
- [x] Unit test: blockedScopes takes precedence over allowedScopes
- [x] Unit test: scope check fires before pre_tool_use hooks
- [x] Unit test: scope check fires before allowedTools/disallowedTools filter
- [x] Unit test: `permissions.scopes` returns all scope names and tool mappings
- [x] Unit test: template scope configuration applied and overridable

## Verification

- [x] Verify all new spec scenarios have corresponding test coverage
- [x] Verify backward compatibility: sessions without scope params behave identically to before
- [x] Verify `bun run test` passes with no failures

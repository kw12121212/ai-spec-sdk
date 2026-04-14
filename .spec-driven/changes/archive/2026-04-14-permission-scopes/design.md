# Design: permission-scopes

## Approach

1. **Scope registry module** — Create `src/permission-scopes.ts` containing:
   - A `ToolScope` union type enumerating the scope names
   - An immutable `TOOL_SCOPE_MAP` mapping each built-in tool name to its required scope(s)
   - A `resolveScopes(toolName: string): ToolScope[]` function that returns the scope(s) for a tool
   - Custom tools (`custom.*`) always resolve to `system` scope

2. **Scope evaluation** — Add scope checking to `_runQuery` in `bridge.ts`:
   - Before tool execution proceeds, check if the tool's required scopes are within the session's `allowedScopes` (if set) and not in `blockedScopes` (if set)
   - `blockedScopes` takes precedence over `allowedScopes`
   - If no `allowedScopes` is set, all scopes are implicitly allowed (backward compatible)
   - Scope denial aborts the tool use and emits a `bridge/scope_denied` notification

3. **Session parameter extension** — Extend session creation parameters:
   - Add `allowedScopes?: string[]` and `blockedScopes?: string[]` to `session.start`, `session.spawn`, `session.resume`
   - Store scope configuration on the session object
   - Template store supports `allowedScopes` / `blockedScopes` fields

4. **JSON-RPC method** — Add `permissions.scopes` method:
   - Returns the list of all available scopes and the tool-to-scope mapping
   - No parameters required

5. **Audit integration** — Write `scope_denied` audit entries when a tool is blocked by scope restrictions

## Key Decisions

- **Scope granularity**: Using compound scopes (e.g., `file:read`, `file:write`) rather than flat scopes (e.g., `file`) to allow fine-grained read-only configurations
- **Evaluation order**: Scopes checked before hooks — scope denial is a hard gate, hooks are a soft gate. Rationale: scope violations represent a configuration error, while hook results represent a runtime decision
- **Blocked takes precedence**: If a scope appears in both `allowedScopes` and `blockedScopes`, the tool is blocked. This is the safest default
- **Custom tools default to `system`**: Custom tools are shell commands, which is the highest-risk scope. Explicit opt-in required
- **No scope wildcard**: No `*` scope that grants all. Use the absence of `allowedScopes` to mean "all allowed"

## Alternatives Considered

1. **Flat scopes only (file, network, system)** — Rejected because it doesn't allow read-only file access patterns, which is a common security requirement
2. **Scope evaluation in hooks** — Rejected because hooks are pluggable and runtime-configurable; scope restrictions should be a hard session-level constraint
3. **Regex-based scope patterns** — Rejected as over-engineering; the fixed set of scope types covers all built-in tools and is extensible for future tool additions
4. **Per-tool scope override via config** — Deferred to `policy-interface` change; this change keeps scope mapping static and tool-intrinsic

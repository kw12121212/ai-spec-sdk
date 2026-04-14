# permission-scopes

## What

Define a fine-grained tool execution scope model that categorizes each built-in tool by capability domain (file:read, file:write, network, system, task, notebook). Sessions can be created with scope restrictions (`allowedScopes` / `blockedScopes`) that gate tool execution before the agent invokes the tool, independently of the existing `allowedTools` / `disallowedTools` name-based filtering.

## Why

The current permission model is limited to allowlisting/denylisting individual tool names (`allowedTools`, `disallowedTools`) and a coarse `permissionMode` setting. This forces integrators to enumerate every tool name when they want to restrict broad capability categories (e.g., "no network access" or "read-only file access"). A scope-based abstraction provides a higher-level permission primitive that:

1. Reduces configuration surface — restrict an entire capability domain with one scope name
2. Complements existing tool-name filtering — scopes are checked first, then tool-level filtering applies
3. Serves as the foundation for future policy-interface and RBAC changes in milestone 09
4. Aligns with the existing API key scope model in `authentication.md` (consistent scope patterns)

## Scope

**In scope:**
- Define built-in scope types: `file:read`, `file:write`, `network`, `system`, `task`, `notebook:read`, `notebook:write`
- Map each `BUILTIN_TOOLS` entry to one or more scopes
- Add `allowedScopes` and `blockedScopes` parameters to `session.start`, `session.spawn`, `session.resume`, and session templates
- Scope evaluation logic: blocked scope takes precedence, then allowed scope filtering, then existing tool-name filtering
- New JSON-RPC method `permissions.scopes` to list available scopes and their tool mappings
- Audit log entries for scope-based tool denials

**Out of scope:**
- Pluggable policy interface (future change: `policy-interface`)
- Multi-level approval chains (future change: `approval-chains`)
- Role-based access control (future change: `rbac-system`)
- Parent-child permission inheritance (future change: `permission-inheritance`)
- Custom tool scope mapping (custom tools default to `system` scope unless explicitly categorized)

## Unchanged Behavior

- Existing `allowedTools` / `disallowedTools` parameters continue to work exactly as before
- Existing `permissionMode` values (`default`, `acceptEdits`, `bypassPermissions`, `approve`) are unaffected
- Existing `pre_tool_use` hook execution flow is unaffected — hooks fire after scope checks pass
- Sessions created without `allowedScopes` / `blockedScopes` have no scope restrictions (backward compatible)
- Custom tools (`custom.*`) continue to work; they map to `system` scope by default

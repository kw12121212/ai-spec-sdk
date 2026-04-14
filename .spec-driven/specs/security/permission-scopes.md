---
mapping:
  implementation:
    - src/permission-scopes.ts
    - src/bridge.ts
    - src/capabilities.ts
    - src/session-store.ts
    - src/template-store.ts
  tests:
    - test/permission-scopes.test.ts
    - test/bridge.test.ts
---

## ADDED Requirements

### Requirement: Tool Scope Definitions
The bridge MUST define the following built-in tool execution scopes and map each built-in tool to one or more of these scopes:

| Scope | Built-in Tools |
|-------|---------------|
| `file:read` | Read, Glob, Grep, LS |
| `file:write` | Write, Edit, MultiEdit |
| `network` | WebFetch, WebSearch |
| `system` | Bash |
| `task` | TodoRead, TodoWrite |
| `notebook:read` | NotebookRead |
| `notebook:write` | NotebookEdit |

Custom tools (names starting with `custom.`) MUST resolve to the `system` scope.

#### Scenario: built-in tool scope resolution
- GIVEN a tool name `Bash`
- WHEN scopes are resolved
- THEN the result contains `system` and only `system`

#### Scenario: custom tool scope resolution
- GIVEN a tool name `custom.my_tool`
- WHEN scopes are resolved
- THEN the result contains `system` and only `system`

#### Scenario: unknown tool scope resolution
- GIVEN a tool name `NonExistent`
- WHEN scopes are resolved
- THEN the result contains `system` as the default scope

### Requirement: Scope-Based Tool Execution Gating
When a session is created with `allowedScopes` and/or `blockedScopes`, the bridge MUST check each tool use against the session's scope configuration before allowing execution. `blockedScopes` MUST take precedence over `allowedScopes`.

#### Scenario: tool allowed by scope
- GIVEN a session with `allowedScopes: ["file:read"]`
- WHEN the agent uses the `Read` tool
- THEN the tool execution proceeds normally

#### Scenario: tool blocked by scope
- GIVEN a session with `allowedScopes: ["file:read"]`
- WHEN the agent uses the `Write` tool (requires `file:write`)
- THEN the tool execution is aborted
- AND a `bridge/scope_denied` notification is emitted with `sessionId`, `toolName`, and `requiredScopes`

#### Scenario: blocked scope takes precedence
- GIVEN a session with `allowedScopes: ["file:read", "file:write"]` and `blockedScopes: ["file:write"]`
- WHEN the agent uses the `Write` tool
- THEN the tool execution is aborted despite `file:write` being in `allowedScopes`

#### Scenario: no scope restrictions
- GIVEN a session created without `allowedScopes` or `blockedScopes`
- WHEN the agent uses any built-in tool
- THEN no scope check is applied and execution proceeds normally

#### Scenario: scope denial audit entry
- GIVEN a session with scope restrictions
- WHEN a tool is denied by scope
- THEN a `scope_denied` audit entry is written with `toolName`, `requiredScopes`, and the session's scope configuration

### Requirement: Scope Parameters on Session Creation
The `session.start`, `session.spawn`, and `session.resume` methods MUST accept optional `allowedScopes` (array of scope strings) and `blockedScopes` (array of scope strings) parameters. Invalid scope strings MUST be rejected with a `-32602` error.

#### Scenario: session.start with allowedScopes
- GIVEN a client calls `session.start` with `allowedScopes: ["file:read", "task"]`
- WHEN the session is created
- THEN the session stores the scope configuration
- AND only tools requiring `file:read` or `task` scopes are permitted

#### Scenario: invalid scope string rejected
- GIVEN a client calls `session.start` with `allowedScopes: ["invalid_scope"]`
- WHEN the bridge validates the parameters
- THEN a `-32602` error is returned listing valid scope names

### Requirement: Scope Support in Session Templates
The `template.create` method MUST accept `allowedScopes` and `blockedScopes` fields. When a session is created from a template, the template's scope configuration MUST be applied, with explicit parameters taking precedence.

#### Scenario: template with scope restrictions
- GIVEN a template named `readonly` with `allowedScopes: ["file:read"]`
- WHEN a session is started using that template without explicit scope overrides
- THEN the session applies `allowedScopes: ["file:read"]`

#### Scenario: explicit parameter overrides template scope
- GIVEN a template named `readonly` with `allowedScopes: ["file:read"]`
- WHEN a session is started using that template with `allowedScopes: ["file:read", "network"]`
- THEN the session applies `allowedScopes: ["file:read", "network"]`

### Requirement: permissions.scopes JSON-RPC Method
The bridge MUST expose a `permissions.scopes` method that returns all available scope names and the tool-to-scope mapping.

#### Scenario: list available scopes
- GIVEN a client calls `permissions.scopes`
- WHEN the bridge processes the request
- THEN the response includes `scopes` (array of scope names) and `toolMapping` (object mapping tool names to scope arrays)

### Requirement: Scope Check Integration with Tool Filtering
Scope checks MUST execute before the existing `allowedTools` / `disallowedTools` name-based filtering. Scope checks MUST also execute before `pre_tool_use` hooks. A tool denied by scope MUST NOT trigger `pre_tool_use` hooks.

#### Scenario: scope check before tool name filter
- GIVEN a session with `allowedScopes: ["file:read"]` and `allowedTools: ["Write"]`
- WHEN the agent uses the `Write` tool
- THEN the scope check denies execution (Write requires `file:write`)
- AND the `allowedTools` filter is never evaluated

#### Scenario: scope pass then tool name filter
- GIVEN a session with `allowedScopes: ["file:read", "file:write"]` and `disallowedTools: ["Write"]`
- WHEN the agent uses the `Write` tool
- THEN the scope check passes (Write requires `file:write`, which is allowed)
- AND the tool name filter denies execution (Write is in disallowedTools)

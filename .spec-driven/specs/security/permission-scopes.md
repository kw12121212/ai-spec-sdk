---
mapping:
  implementation:
    - src/permission-scopes.ts
    - src/permission-policy.ts
    - src/bridge.ts
    - src/capabilities.ts
    - src/session-store.ts
    - src/template-store.ts
    - src/role-store.ts
  tests:
    - test/permission-scopes.test.ts
    - test/permission-policy.test.ts
    - test/bridge.test.ts
    - test/role-store.test.ts
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
The `session.start`, `session.spawn`, and `session.resume` methods MUST accept optional `allowedScopes` (array of scope strings), `blockedScopes` (array of scope strings), and `policies` (array of policy descriptors) parameters. Invalid scope strings or unknown policy names MUST be rejected with a `-32602` error.

#### Scenario: session.start with allowedScopes
- GIVEN a client calls `session.start` with `allowedScopes: ["file:read", "task"]`
- WHEN the session is created
- THEN the session stores the scope configuration
- AND only tools requiring `file:read` or `task` scopes are permitted

#### Scenario: invalid scope string rejected
- GIVEN a client calls `session.start` with `allowedScopes: ["invalid_scope"]`
- WHEN the bridge validates the parameters
- THEN a `-32602` error is returned listing valid scope names

### Requirement: Role Definitions
The system MUST define roles in a static configuration file `roles.yaml` located in the workspace or system configuration directory. The file MUST map role names to arrays of scope strings. If `roles.yaml` is missing or malformed, the system MUST default to an empty set of roles.

#### Scenario: Role resolution
- GIVEN `roles.yaml` defines a role `developer` with scopes `["file:read", "file:write"]`
- WHEN the `developer` role is resolved
- THEN the resulting scopes are `["file:read", "file:write"]`

### Requirement: Role Parameters on Session Creation
The system MUST accept an optional `roles` (array of role string identifiers) parameter in addition to `allowedScopes` and `blockedScopes` for `session.start`, `session.spawn`, and `session.resume` methods. The effective allowed scopes for the session MUST be the union of `allowedScopes` and the scopes granted by the specified `roles`. Invalid role strings MUST be rejected with a `-32602` error.

#### Scenario: session.start with roles
- GIVEN a client calls `session.start` with `roles: ["developer"]` where `developer` grants `["file:read", "file:write"]`
- WHEN the session is created
- THEN the session stores the role configuration
- AND tools requiring `file:read` or `file:write` scopes are permitted

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
Scope checks MUST execute after the policy chain and before the existing `allowedTools` / `disallowedTools` name-based filtering. Both policy checks and scope checks MUST execute before `pre_tool_use` hooks. A tool denied by policy or scope MUST NOT trigger `pre_tool_use` hooks.

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

### Requirement: PermissionPolicy Interface
The bridge MUST define a `PermissionPolicy` interface with an async `check(context)` method that returns a `PolicyResult`. `PolicyResult` MUST be one of `allow`, `deny`, or `pass`.

#### Scenario: policy allows tool use
- GIVEN a session with a policy that returns `allow` for `Read`
- WHEN the agent uses the `Read` tool
- THEN the policy chain stops and the tool proceeds to the scope check

#### Scenario: policy denies tool use
- GIVEN a session with a policy that returns `deny` for `Bash`
- WHEN the agent uses the `Bash` tool
- THEN the policy chain stops, the tool execution is aborted
- AND a `bridge/policy_denied` notification is emitted with `sessionId`, `toolName`, and `policyName`
- AND a `policy_denied` audit entry is written

#### Scenario: policy requires approval
- GIVEN a policy that returns `approval_required` for a specific tool and input
- WHEN the policy is evaluated in a chain
- THEN the chain evaluation MUST halt and return the `approval_required` decision along with any context provided by the policy.

#### Scenario: policy passes (no opinion)
- GIVEN a session with a policy that returns `pass` for all tools
- WHEN the agent uses any tool
- THEN the next policy in the chain is evaluated
- AND if all policies return `pass`, the tool proceeds to the scope check

### Requirement: Policy Descriptor Registration
The `session.start`, `session.spawn`, and `session.resume` methods MUST accept an optional `policies` parameter containing an array of policy descriptors. Each descriptor MUST include a `name` (string matching a registered policy) and an optional `config` (object). Unknown policy names MUST be rejected with a `-32602` error.

#### Scenario: session.start with policies
- GIVEN a client calls `session.start` with `policies: [{ name: "time-restriction" }]`
- WHEN the session is created
- THEN the session stores the policy descriptors
- AND the corresponding policy instances are resolved from the policy registry

#### Scenario: unknown policy name rejected
- GIVEN a client calls `session.start` with `policies: [{ name: "nonexistent-policy" }]`
- WHEN the bridge validates the parameters
- THEN a `-32602` error is returned indicating the policy name is not registered

### Requirement: Policy Chain Execution Order
When multiple policies are registered for a session, they MUST execute sequentially in registration order. If any policy returns `deny` or `approval_required`, the chain MUST short-circuit: no further policies execute and the tool is blocked or paused. If a policy returns `allow`, the chain short-circuits in the allow direction and the tool proceeds to the scope check.

#### Scenario: deny short-circuits chain
- GIVEN a session with policies [policyA, policyB] where policyA returns `deny`
- WHEN the agent uses a tool
- THEN only policyA executes
- AND the tool is blocked

#### Scenario: allow short-circuits chain
- GIVEN a session with policies [policyA, policyB] where policyA returns `allow`
- WHEN the agent uses a tool
- THEN only policyA executes
- AND the tool proceeds to the scope check

#### Scenario: all policies pass
- GIVEN a session with policies [policyA, policyB] where both return `pass`
- WHEN the agent uses a tool
- THEN both policies execute
- AND the tool proceeds to the scope check

### Requirement: Policy Execution Before Scope Check
Policy chain execution MUST occur before the existing scope-based gating (`isScopeDenied`). A tool denied by policy MUST NOT trigger scope checks or `pre_tool_use` hooks.

#### Scenario: policy denial skips scope check
- GIVEN a session with a policy that denies `Bash` and `allowedScopes: ["system"]`
- WHEN the agent uses the `Bash` tool
- THEN the policy denies the tool
- AND the scope check is never evaluated
- AND no `pre_tool_use` hooks fire

### Requirement: Policy Decision Audit
Every policy decision (`allow` or `deny`) MUST be logged via the `AuditLog` instance with the policy name, tool name, decision, and execution duration.

#### Scenario: policy allow audit entry
- GIVEN a session with a policy that allows a tool
- WHEN the policy executes and returns `allow`
- THEN a `policy_decision` audit entry is written with `decision: "allow"`, `policyName`, `toolName`, and `durationMs`

#### Scenario: policy deny audit entry
- GIVEN a session with a policy that denies a tool
- WHEN the policy executes and returns `deny`
- THEN a `policy_decision` audit entry is written with `decision: "deny"`, `policyName`, `toolName`, and `durationMs`

#### Scenario: policy pass produces no audit entry
- GIVEN a session with a policy that returns `pass`
- WHEN the policy executes
- THEN no `policy_decision` audit entry is written for this policy

### Requirement: permissions.policies.list JSON-RPC Method
The bridge MUST expose a `permissions.policies.list` method that returns all policies registered for a given session.

#### Scenario: list policies for session
- GIVEN a session with policies [{ name: "time-restriction" }, { name: "domain-check" }]
- WHEN a client calls `permissions.policies.list` with `{ sessionId }`
- THEN the response includes `{ policies: [{ name: "time-restriction", config: null }, { name: "domain-check", config: null }] }`

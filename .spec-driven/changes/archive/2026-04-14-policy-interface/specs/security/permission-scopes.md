---
mapping:
  implementation:
    - src/permission-policy.ts
    - src/bridge.ts
    - src/session-store.ts
  tests:
    - test/permission-policy.test.ts
    - test/bridge.test.ts
---

## ADDED Requirements

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
When multiple policies are registered for a session, they MUST execute sequentially in registration order. If any policy returns `deny`, the chain MUST short-circuit: no further policies execute and the tool is blocked. If a policy returns `allow`, the chain short-circuits in the allow direction and the tool proceeds to the scope check.

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

## MODIFIED Requirements

### Requirement: Scope Check Integration with Tool Filtering
Previously: Scope checks MUST execute before the existing `allowedTools` / `disallowedTools` name-based filtering. Scope checks MUST also execute before `pre_tool_use` hooks. A tool denied by scope MUST NOT trigger `pre_tool_use` hooks.
Scope checks MUST execute after the policy chain and before the existing `allowedTools` / `disallowedTools` name-based filtering. Both policy checks and scope checks MUST execute before `pre_tool_use` hooks. A tool denied by policy or scope MUST NOT trigger `pre_tool_use` hooks.

### Requirement: Scope Parameters on Session Creation
Previously: The `session.start`, `session.spawn`, and `session.resume` methods MUST accept optional `allowedScopes` (array of scope strings) and `blockedScopes` (array of scope strings) parameters. Invalid scope strings MUST be rejected with a `-32602` error.
The `session.start`, `session.spawn`, and `session.resume` methods MUST accept optional `allowedScopes`, `blockedScopes`, and `policies` parameters. Invalid scope strings or unknown policy names MUST be rejected with a `-32602` error.

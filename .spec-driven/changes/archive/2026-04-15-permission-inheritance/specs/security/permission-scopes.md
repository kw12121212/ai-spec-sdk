---
mapping:
  implementation:
    - src/session-store.ts
    - src/bridge.ts
    - src/permission-scopes.ts
  tests:
    - test/permission-scopes.test.ts
    - test/session-store.test.ts
    - test/bridge.test.ts
---

## ADDED Requirements

### Requirement: Child Session Scope Inheritance
When a child session is spawned via `session.spawn`, the child's effective `allowedScopes` MUST be the intersection of the parent's `allowedScopes` and the child's requested `allowedScopes` (including scopes resolved from `roles`). If the parent has no `allowedScopes` restrictions, the child receives its requested scopes. If the child requests no `allowedScopes`, it inherits the parent's `allowedScopes` exactly.

#### Scenario: Child inherits parent allowedScopes
- GIVEN a parent session with `allowedScopes: ["file:read", "file:write"]`
- WHEN a client calls `session.spawn` without specifying `allowedScopes` or `roles`
- THEN the child session is created with `allowedScopes: ["file:read", "file:write"]`

#### Scenario: Child restricts parent allowedScopes
- GIVEN a parent session with `allowedScopes: ["file:read", "file:write", "network"]`
- WHEN a client calls `session.spawn` with `allowedScopes: ["file:read"]`
- THEN the child session is created with `allowedScopes: ["file:read"]`

### Requirement: Child Session Scope Escalation Rejection
When a child session is spawned, if it requests `allowedScopes` (directly or via `roles`) that are not present in the parent's `allowedScopes` (when the parent is restricted), the bridge MUST reject the spawn request with a `-32602` error.

#### Scenario: Child attempts scope escalation
- GIVEN a parent session with `allowedScopes: ["file:read"]`
- WHEN a client calls `session.spawn` with `allowedScopes: ["file:write"]`
- THEN the bridge returns a `-32602` error

### Requirement: Child Session Blocked Scope Inheritance
When a child session is spawned, its effective `blockedScopes` MUST be the union of the parent's `blockedScopes` and any explicitly requested `blockedScopes` in the `session.spawn` request.

#### Scenario: Child inherits and extends blocked scopes
- GIVEN a parent session with `blockedScopes: ["network"]`
- WHEN a client calls `session.spawn` with `blockedScopes: ["system"]`
- THEN the child session is created with `blockedScopes: ["network", "system"]`

### Requirement: Child Session Policy Inheritance
When a child session is spawned, any permission policies active on the parent session MUST be automatically applied to the child session. If the child session requests additional policies, the parent's policies MUST execute before the child's explicitly requested policies in the policy chain.

#### Scenario: Child inherits parent policies
- GIVEN a parent session with a policy `time-restriction`
- WHEN a client calls `session.spawn` requesting policy `domain-check`
- THEN the child session is created with policies `[time-restriction, domain-check]`
- AND the `time-restriction` policy is evaluated before the `domain-check` policy

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

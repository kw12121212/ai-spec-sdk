# policy-interface

## What
Define a pluggable `PermissionPolicy` interface that allows custom permission logic to be registered at session creation time and executed as part of the tool authorization pipeline, before scope checks.

## Why
The completed `permission-scopes` change provides built-in scope-based gating (file:read, network, system, etc.), but the gating logic is hardcoded. Enterprise deployments need to inject custom authorization rules — for example, time-of-day restrictions, per-user quotas, external policy services, or domain-specific compliance checks. Without a pluggable policy interface, every new authorization requirement must modify the bridge core. The policy interface is also a prerequisite for the remaining milestone 09 changes (`approval-chains`, `rbac-system`, `permission-inheritance`, `permission-audit`), which all need a consistent hook point to plug in their respective authorization logic.

## Scope
- Define `PermissionPolicy` interface with async `check()` method
- Define `PolicyResult` type (`allow` | `deny` | `pass`)
- Policy registration via `policies` parameter on `session.start`, `session.spawn`, `session.resume`
- Policy execution as an ordered chain with deny-short-circuit, running before the existing scope check
- `permissions.policies.list` JSON-RPC method to inspect registered policies for a session
- Audit logging for policy decisions

## Unchanged Behavior
- Existing scope-based gating (`allowedScopes`/`blockedScopes`) continues to work identically and executes after the policy chain
- Hook execution (`pre_tool_use`, `post_tool_use`) continues unchanged
- `allowedTools`/`disallowedTools` filtering is unaffected
- Sessions without policies behave exactly as before

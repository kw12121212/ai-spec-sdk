# Proposal: rbac-system

## What
Implement a Role-Based Access Control (RBAC) system for tools and sessions. This system will allow operators to define reusable "Roles" that aggregate existing permission scopes (e.g., `file:read`, `system`). These roles can then be assigned to API keys and sessions to simplify permission management.

## Why
As the platform expands and more tools are integrated, managing raw scopes on individual API keys and sessions becomes error-prone and tedious. RBAC provides a manageable, enterprise-grade permissions grouping mechanism. It is a logical prerequisite for more advanced security features like permission inheritance and auditing.

## Scope
- Define roles in a static configuration file (`roles.yaml`) loaded at startup.
- Update API key structure to support both direct `scopes` and `roles`.
- Compute effective scopes for a key as the union of direct scopes and the scopes granted by its assigned roles.
- Update session creation to accept roles in addition to scopes.

## Unchanged Behavior
- Existing APIs and keys that only use `scopes` will continue to function without modification.
- The underlying scope-based tool execution gating (`isScopeDenied`) will remain unchanged.
- The policy interface will remain unaffected by this change.

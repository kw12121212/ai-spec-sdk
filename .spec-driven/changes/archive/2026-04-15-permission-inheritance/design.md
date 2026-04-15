# Design: permission-inheritance

## Approach
Child sessions will resolve their effective scopes and policies at creation time in `session.spawn`.
1.  **Scope Intersection**: If the parent session has `allowedScopes` defined, any requested `allowedScopes` in `session.spawn` must be a subset. If the child requests broader scopes, the request is rejected with a `-32602` error to prevent privilege escalation. If the child requests no specific `allowedScopes`, it defaults to the parent's `allowedScopes`.
2.  **Scope Union**: The child's `blockedScopes` will be the union of the parent's `blockedScopes` and any explicitly requested `blockedScopes` in `session.spawn`.
3.  **Policy Inheritance**: Any `policies` active on the parent session will be automatically applied to the child session, executing before any policies explicitly requested by the child.

## Key Decisions
-   **Deny on Escalation**: We decided to reject spawn requests that attempt to exceed parent permissions rather than silently dropping the exceeding scopes. This ensures the caller is aware their full requested capability set was not granted.
-   **Intersection over Overrides**: A child can only restrict its sandbox further (via subset `allowedScopes` or additional `blockedScopes`); it cannot override parent restrictions.

## Alternatives Considered
-   **Dynamic Resolution**: We could have child sessions look up their parent's permissions at tool execution time. Resolving them at creation time is simpler and avoids complex locking or lookup during the critical path of tool execution.
-   **Silent Restriction**: We could have silently ignored requested scopes that exceed the parent's scopes. We chose explicit rejection (`-32602`) for better developer experience and predictability.

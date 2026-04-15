# Design: rbac-system

## Approach
1.  **Configuration:** Introduce a `roles.yaml` file that maps role names to arrays of scope strings. This will be loaded into memory on startup by the `ConfigStore` or a new `RoleStore`.
2.  **API Keys:** Update `keys.json` schema and `KeyStore` to support an optional `roles` array alongside the existing `scopes` array.
3.  **Authentication:** Modify the authorization logic (in `auth.ts` or `bridge.ts`) to compute the effective scopes of an authenticated key. Effective scopes = direct scopes ∪ scopes from assigned roles.
4.  **Session Start:** Update `session.start`, `session.spawn`, and `session.resume` to accept an optional `roles` array in addition to `allowedScopes` and `blockedScopes`. The effective allowed scopes for a session will be the union of `allowedScopes` and the scopes from its assigned `roles`.

## Key Decisions
-   **Static Configuration:** Roles will be defined in a static configuration file (`roles.yaml`) loaded at startup. This simplifies implementation and avoids the need for new dynamic role management JSON-RPC APIs immediately.
-   **Additive Roles:** Roles will only *add* scopes. Blocking scopes will still be handled via the existing `blockedScopes` mechanism, keeping the mental model simple.
-   **Hybrid Keys:** API keys will support both direct `scopes` and `roles`. This provides maximum flexibility and backwards compatibility with existing keys.

## Alternatives Considered
-   **Dynamic Role APIs:** We considered adding JSON-RPC methods to create, update, and delete roles dynamically. This was deferred to keep the initial RBAC implementation simple. Static configuration is sufficient for many enterprise use cases.
-   **Role-Only Keys:** We considered forcing API keys to use *only* roles, deprecating direct scopes. This was rejected because it would break existing keys and make simple, one-off key creation more complex.

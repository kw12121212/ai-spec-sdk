# Tasks: rbac-system

## Implementation
- [x] Create `roles.yaml` configuration parser and store in `src/role-store.ts`.
- [x] Update `KeyStore` in `src/key-store.ts` to support the `roles` field on API keys.
- [x] Modify `ai-spec-bridge keygen` CLI to optionally accept `--role` flags.
- [x] Update authorization logic in `src/auth.ts` to compute effective scopes from roles and direct scopes.
- [x] Update `session.start`, `session.spawn`, and `session.resume` in `src/bridge.ts` to accept `roles` parameter.
- [x] Update `SessionStore` to persist the session `roles`.

## Testing
- [x] Unit test `RoleStore` parsing of `roles.yaml`.
- [x] Unit test `KeyStore` handling of `roles` field.
- [x] Unit test authorization logic with a key having both roles and direct scopes.
- [x] Unit test session creation with `roles` parameter.
- [x] Run test suite: `bun run test`
- [x] Run linter/formatter: `bun run lint`

## Verification
- [x] Verify `ai-spec-bridge keygen` can create a key with a role.
- [x] Verify a session can be started using a role that grants the necessary scopes for a tool.

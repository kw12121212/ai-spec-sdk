---
change: auth-and-authorization
type: tasks
---

## Implementation

- [x] Create `src/key-store.ts`: `StoredKey` type, `loadKeys`, `saveKeys`, `addKey`, `revokeKey` functions; keys file at `~/.ai-spec-sdk/keys.json`
- [x] Create `src/auth.ts`: `generateKey` (32-byte random → hex token + SHA-256 hash), `verifyKey` (hash lookup + expiry check), `METHOD_SCOPES` table, `checkScope` function
- [x] Add `keygen` subcommand to `src/cli.ts`: parse `--name`, `--scopes`, `--expires` flags; print raw token once; write hashed record via `key-store`
- [x] Add `keys list` subcommand to `src/cli.ts`: print `id`, `name`, `scopes`, `createdAt`, `expiresAt` for all stored keys
- [x] Add `keys revoke <id>` subcommand to `src/cli.ts`: remove key from store; exit non-zero with error if id not found
- [x] Add `noAuth?: boolean` to `HttpServerOptions` in `src/http-server.ts`; parse `--no-auth` flag in `src/cli.ts` and forward to `startHttpServer`
- [x] Add auth middleware to `src/http-server.ts` `POST /rpc` handler: extract `Authorization: Bearer <token>`, parse method from request body, call `checkScope`; skip if `noAuth` is set or method has `null` scope
- [x] Return JSON-RPC error `-32061` for invalid/missing/expired key; `-32060` for insufficient scope

## Testing

- [x] Unit tests for `key-store.ts`: add, list, revoke round-trip; file is written without raw tokens; revoke non-existent id returns error
- [x] Unit tests for `auth.ts`: `verifyKey` returns false for unknown hash; returns false for expired key; `checkScope` passes with matching scope; passes with `admin` scope; fails with insufficient scope; `null`-scope methods always pass
- [x] Integration tests for HTTP auth middleware: unauthenticated `POST /rpc` → `-32061`; valid key with correct scope → dispatch; valid key with wrong scope → `-32060`; `bridge.capabilities` with no key → success; `--no-auth` mode → all requests dispatched
- [x] Test that `GET /health` with no key always returns `200 ok`
- [x] Lint passes (`bun run lint` or equivalent)
- [x] All existing tests still pass (no regressions)

## Verification

- [x] `src/key-store.ts` and `src/auth.ts` exist and are TypeScript
- [x] `keys.json` never contains raw token strings (only SHA-256 hashes)
- [x] All bridge methods are covered in `METHOD_SCOPES` (no method missing from the table)
- [x] Stdio transport tests pass unchanged
- [x] Delta spec at `specs/security/authentication.md` matches implemented behavior

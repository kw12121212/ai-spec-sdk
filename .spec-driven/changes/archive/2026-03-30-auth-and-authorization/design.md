---
change: auth-and-authorization
type: design
---

## Approach

**Key lifecycle (`src/key-store.ts`):**
- Keys are stored as JSON in `~/.ai-spec-sdk/keys.json` as an array of `StoredKey` records: `{ id, name, hash, createdAt, expiresAt?, scopes[] }`.
- Raw keys are never stored. On `keygen`, generate a 32-byte cryptographically random value, hex-encode it as the bearer token, compute SHA-256, and store only the hash.
- On `keys revoke <id>`, remove the record by `id` and rewrite the file.

**Auth middleware (`src/auth.ts`):**
- Export `verifyRequest(authHeader, method, keyStore)`: parse `Bearer <token>`, SHA-256 hash the token, find the matching stored key, check expiry, check that the key's `scopes` covers the required scope for `method`.
- Export `METHOD_SCOPES`: a `Record<string, string | null>` mapping every bridge method name to its required scope (`null` = no auth required).
- Auth is enforced in `src/http-server.ts` after parsing the JSON-RPC request method name but before calling `bridge.handleMessage`.

**Scope table (method → scope):**
| Methods | Scope |
|---|---|
| `bridge.capabilities`, `bridge.ping`, `bridge.negotiateVersion` | `null` (no auth) |
| `models.list`, `tools.list`, `skills.list` | `null` (public discovery) |
| `session.start`, `session.resume`, `session.stop`, `session.delete`, `session.cleanup`, `session.approveTool`, `session.rejectTool`, `session.branch` | `session:write` |
| `session.status`, `session.list`, `session.history`, `session.events`, `session.export`, `session.search` | `session:read` |
| `workflow.run` | `workflow:run` |
| `config.get`, `config.list`, `context.read`, `context.list` | `config:read` |
| `config.set`, `context.write`, `workspace.register`, `workspace.list` | `config:write` |
| `mcp.*`, `hooks.*`, `bridge.setLogLevel` | `admin` |

**CLI subcommands (`src/cli.ts`):**
- If `process.argv[2]` is `keygen`, `keys`, or similar management verb, handle it before entering transport mode.
- `keygen` prints the raw token once (never again) and writes the hashed record.
- `keys list` prints `id`, `name`, `scopes`, `createdAt`, `expiresAt` for all stored keys (no hashes).
- `keys revoke <id>` removes the key and confirms deletion.

**`--no-auth` flag:**
- Parsed in `src/cli.ts` alongside `--transport` and `--port`.
- When set, auth middleware is skipped entirely in `src/http-server.ts`.
- `HttpServerOptions` gains an optional `noAuth?: boolean` field.

## Key Decisions

- **SHA-256, no bcrypt** — keys are long random tokens (256-bit entropy), not passwords. SHA-256 is fast enough and appropriate; bcrypt is designed for low-entropy passwords.
- **Null scope = no auth** — methods with `null` in `METHOD_SCOPES` skip auth entirely (no key required), keeping discovery endpoints accessible.
- **`admin` scope is all-inclusive** — a key with `admin` scope passes any scope check. Checked by `verifyRequest` before the per-method scope lookup.
- **Stdio trust model unchanged** — auth is injected only in the HTTP request path. `BridgeServer.handleMessage` itself has no concept of auth; this keeps the core bridge clean.
- **Key file lives next to sessions dir** — `~/.ai-spec-sdk/keys.json` is consistent with `~/.ai-spec-sdk/sessions/` used by `SessionStore`.

## Alternatives Considered

- **JWT** — stateless, but requires a secret key and expiry management; overkill for a local SDK.
- **bcrypt for key hashing** — appropriate for passwords but unnecessary here; SHA-256 is standard for opaque API tokens with high entropy.
- **Per-request auth in `BridgeServer`** — would require threading auth context through all dispatch paths; keeping it in the HTTP layer is cleaner and leaves stdio untouched.

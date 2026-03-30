---
change: auth-and-authorization
type: proposal
---

## What

Add API key authentication and scope-based authorization to the HTTP transport. Stdio transport remains unauthenticated (local process trust model). HTTP transport requires a `Bearer` token on all requests except `GET /health`, `bridge.capabilities`, `bridge.ping`, and `bridge.negotiateVersion`. A key management CLI (`keygen`, `keys list`, `keys revoke`) allows operators to manage keys without editing files.

## Why

The HTTP transport is now live and exposes the bridge over the network. Without authentication, any process on the same machine (or network, if the port is externally reachable) can issue arbitrary JSON-RPC calls — including starting agent sessions, modifying config, or deleting session data. Auth closes this surface before HTTP transport ships to production users.

## Scope

**In scope:**
- `src/key-store.ts` — key persistence to `~/.ai-spec-sdk/keys.json` (SHA-256 hashed, never plaintext)
- `src/auth.ts` — key generation, hash verification, method-to-scope mapping, scope check
- `src/http-server.ts` — auth middleware: validate `Authorization: Bearer <key>` before dispatch; `--no-auth` flag bypasses auth for local dev
- `src/cli.ts` — three key management subcommands: `keygen [--name <n>] [--scopes <s,...>] [--expires <date>]`, `keys list`, `keys revoke <id>`
- Error codes: `-32060` (insufficient scope), `-32061` (invalid or expired key)
- Scopes: `session:read`, `session:write`, `workflow:run`, `config:read`, `config:write`, `admin`
- Method-to-scope table covering all bridge methods

**Out of scope:**
- OAuth2 / OIDC / JWT with external IdP
- mTLS
- Rate limiting per key
- Key rotation automation
- Auth on stdio transport (stdio = local trust, no change)

## Unchanged Behavior

- Stdio transport behavior is entirely unchanged — no auth, no new flags required for stdio users.
- All existing JSON-RPC methods, their parameters, and their responses are unchanged.
- `GET /health` remains unauthenticated.
- `bridge.capabilities`, `bridge.ping`, `bridge.negotiateVersion` remain callable without a key.
- The `--no-auth` flag preserves the current (no-auth) behavior of the HTTP transport for local development.

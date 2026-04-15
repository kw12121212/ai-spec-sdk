---
mapping:
  implementation:
    - src/key-store.ts
    - src/auth.ts
    - src/http-server.ts
    - src/cli.ts
  tests:
    - test/key-store.test.ts
    - test/auth.test.ts
    - test/cli.test.ts
---

## MODIFIED Requirements

### Requirement: Key Storage
Previously: API keys MUST be stored in `~/.ai-spec-sdk/keys.json` as a JSON array. Each entry MUST contain: `id` (unique string), `name` (human label), `hash` (SHA-256 hex of the raw token), `createdAt` (ISO timestamp), `scopes` (array of scope strings), and optionally `expiresAt` (ISO timestamp). Raw key tokens MUST NOT be stored.
The system MUST store API keys in `~/.ai-spec-sdk/keys.json` as a JSON array. Each entry MUST contain: `id` (unique string), `name` (human label), `hash` (SHA-256 hex of the raw token), `createdAt` (ISO timestamp), `scopes` (array of scope strings), and optionally `expiresAt` (ISO timestamp) and `roles` (array of role string identifiers). Raw key tokens MUST NOT be stored.

### Requirement: Scope-Based Authorization
Previously: Each bridge method has a required scope. After authentication succeeds, the bridge MUST verify that the authenticated key's `scopes` array includes the method's required scope. Requests where the key lacks the required scope MUST receive a JSON-RPC error with code `-32060`. A key with scope `admin` MUST pass all scope checks.
The system MUST verify that the authenticated key's effective scopes (the union of its direct `scopes` array and the scopes granted by its assigned `roles`) includes the method's required scope. Requests where the key lacks the required scope MUST receive a JSON-RPC error with code `-32060`. A key with effective scope `admin` MUST pass all scope checks.

#### Scenario: Key with matching role is authorized
- GIVEN a key has role `operator` which grants `session:write` scope
- WHEN the client calls `session.start`
- THEN the request is dispatched normally

#### Scenario: Key with insufficient role and scopes is rejected
- GIVEN a key has role `viewer` (grants `session:read`) and direct scope `tool:read`
- WHEN the client calls `session.start` (requires `session:write`)
- THEN the response contains a JSON-RPC error with code `-32060`

### Requirement: Key Generation CLI
Previously: Running `ai-spec-bridge keygen` MUST generate a new 256-bit random API key, print the raw token exactly once to stdout, store the SHA-256 hash in `keys.json`, and never print or store the raw token again.
The system MUST generate a new 256-bit random API key, print the raw token exactly once to stdout, store the SHA-256 hash in `keys.json`, and never print or store the raw token again when running `ai-spec-bridge keygen`. It MUST accept an optional `--role <role_name>` flag, which can be provided multiple times to assign roles to the generated key.

#### Scenario: keygen with role
- GIVEN the operator runs `ai-spec-bridge keygen --role operator`
- WHEN the command completes
- THEN the raw token is printed to stdout
- AND the stored key entry contains `roles: ["operator"]`

### Requirement: Key Listing CLI
Previously: Running `ai-spec-bridge keys list` MUST print each stored key's `id`, `name`, `scopes`, `createdAt`, and `expiresAt` (if set). Raw tokens and hashes MUST NOT appear in the output.
The system MUST print each stored key's `id`, `name`, `scopes`, `roles` (if set), `createdAt`, and `expiresAt` (if set) when running `ai-spec-bridge keys list`. Raw tokens and hashes MUST NOT appear in the output.

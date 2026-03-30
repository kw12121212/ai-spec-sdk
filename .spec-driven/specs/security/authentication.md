### Requirement: API Key Authentication on HTTP Transport
When the bridge is running in HTTP mode and auth is enabled (default), every `POST /rpc` request MUST include an `Authorization: Bearer <key>` header. Requests missing this header or carrying an invalid or expired key MUST receive a JSON-RPC error response with code `-32061` and MUST NOT be dispatched to any bridge method.

#### Scenario: Valid bearer token is accepted
- GIVEN a client sends `POST /rpc` with `Authorization: Bearer <valid-key>`
- WHEN the bridge validates the key
- THEN the request is dispatched and a normal JSON-RPC response is returned

#### Scenario: Missing Authorization header is rejected
- GIVEN a client sends `POST /rpc` without an `Authorization` header
- WHEN the bridge checks authentication
- THEN the response contains a JSON-RPC error with code `-32061`

#### Scenario: Expired key is rejected
- GIVEN a stored key has an `expiresAt` timestamp in the past
- WHEN a client presents that key
- THEN the response contains a JSON-RPC error with code `-32061`

#### Scenario: Unknown key is rejected
- GIVEN a client sends a token not matching any stored key hash
- WHEN the bridge validates the key
- THEN the response contains a JSON-RPC error with code `-32061`

### Requirement: Scope-Based Authorization
Each bridge method has a required scope. After authentication succeeds, the bridge MUST verify that the authenticated key's `scopes` array includes the method's required scope. Requests where the key lacks the required scope MUST receive a JSON-RPC error with code `-32060`. A key with scope `admin` MUST pass all scope checks.

#### Scenario: Key with matching scope is authorized
- GIVEN a key has scope `session:write`
- WHEN the client calls `session.start`
- THEN the request is dispatched normally

#### Scenario: Key with insufficient scope is rejected
- GIVEN a key has scope `session:read` only
- WHEN the client calls `session.start` (requires `session:write`)
- THEN the response contains a JSON-RPC error with code `-32060`

#### Scenario: Admin key passes all scope checks
- GIVEN a key has scope `admin`
- WHEN the client calls any bridge method
- THEN the request is dispatched normally regardless of the method's required scope

### Requirement: Unauthenticated Methods
The following are exempt from authentication and MUST be callable without a key even when auth is enabled: `bridge.capabilities`, `bridge.ping`, `bridge.negotiateVersion`, `GET /health`. Additionally, `models.list`, `tools.list`, and `skills.list` MUST require no auth (public discovery endpoints).

#### Scenario: Capabilities called without key
- GIVEN auth is enabled
- WHEN a client calls `bridge.capabilities` via `POST /rpc` with no `Authorization` header
- THEN the bridge returns the capabilities response normally

### Requirement: Key Storage
API keys MUST be stored in `~/.ai-spec-sdk/keys.json` as a JSON array. Each entry MUST contain: `id` (unique string), `name` (human label), `hash` (SHA-256 hex of the raw token), `createdAt` (ISO timestamp), `scopes` (array of scope strings), and optionally `expiresAt` (ISO timestamp). Raw key tokens MUST NOT be stored.

### Requirement: Key Generation CLI
Running `ai-spec-bridge keygen` MUST generate a new 256-bit random API key, print the raw token exactly once to stdout, store the SHA-256 hash in `keys.json`, and never print or store the raw token again.

#### Scenario: keygen prints token once
- GIVEN the operator runs `ai-spec-bridge keygen`
- WHEN the command completes
- THEN the raw token is printed to stdout exactly once and is not stored in any file

### Requirement: Key Listing CLI
Running `ai-spec-bridge keys list` MUST print each stored key's `id`, `name`, `scopes`, `createdAt`, and `expiresAt` (if set). Raw tokens and hashes MUST NOT appear in the output.

### Requirement: Key Revocation CLI
Running `ai-spec-bridge keys revoke <id>` MUST remove the matching key record from `keys.json` and confirm deletion. If no key with that `id` exists, the command MUST exit with a non-zero code and print an error message.

### Requirement: No-Auth Mode
When the bridge is started with `--no-auth`, authentication and authorization MUST be skipped for all HTTP requests. This flag is intended for local development only.

#### Scenario: --no-auth disables auth middleware
- GIVEN the bridge is started with `--transport http --no-auth`
- WHEN a client sends `POST /rpc` with no `Authorization` header
- THEN the request is dispatched as if it were authenticated with full access

### Requirement: Stdio Transport Unchanged
The stdio transport MUST NOT require any authentication. All bridge methods MUST remain callable over stdio without credentials.

### Requirement: Diagnostic Metadata Authorization
When the bridge is running in HTTP mode with auth enabled, `bridge.info` MUST require a key authorized for admin-level methods. Requests without valid credentials, or with a key lacking the required scope, MUST be rejected using the existing authentication and authorization error codes.

#### Scenario: Unauthenticated bridge.info request is rejected
- GIVEN the bridge is running in HTTP mode with auth enabled
- WHEN a client calls `bridge.info` without an `Authorization` header
- THEN the response contains JSON-RPC error code `-32061`

#### Scenario: Admin-authorized bridge.info request succeeds
- GIVEN the bridge is running in HTTP mode with auth enabled
- AND the client presents a valid key with `admin` scope
- WHEN the client calls `bridge.info`
- THEN the bridge returns the runtime metadata response normally

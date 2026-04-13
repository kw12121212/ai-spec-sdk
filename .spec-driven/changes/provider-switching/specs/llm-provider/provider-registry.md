---
mapping:
  implementation:
    - src/session-store.ts
    - src/llm-provider/provider-registry.ts
    - src/claude-agent-runner.ts
    - src/bridge.ts
  tests:
    - test/provider-switching.test.ts
    - test/provider-switching-bridge.test.ts
---

## ADDED Requirements

### Requirement: Provider Switch Method
The SDK MUST expose a `provider.switch` method that changes the active LLM provider for a specific session without requiring session restart.

Parameters: `{ sessionId: string, providerId: string }`.

The bridge MUST:
1. Verify the `sessionId` exists; return error `-32011` if not
2. Verify the session's status allows switching (`idle`, `paused`, or `running`); return `-32602` with reason if not
3. Verify the target `providerId` is registered; return error `-32001` if not
4. Perform a health check on the target provider; return error `-32004` with message "Provider unhealthy" if the check fails
5. Update the session's `activeProviderId` to the target `providerId`
6. Persist the updated session record
7. Emit a `bridge/provider_switched` notification
8. Return `{ success: true, sessionId: string, previousProviderId: string | null, newProviderId: string }`

#### Scenario: Switch provider on idle session
- GIVEN a session with ID "sess-1" in `"idle"` status AND a registered provider "my-openai"
- WHEN the client calls `provider.switch` with `{ sessionId: "sess-1", providerId: "my-openai" }`
- THEN the session's `activeProviderId` becomes `"my-openai"`
- AND the response includes `previousProviderId: null` and `newProviderId: "my-openai"`
- AND a `bridge/provider_switched` notification is emitted

#### Scenario: Switch provider on running session
- GIVEN a session with ID "sess-1" in `"running"` status AND `activeProviderId: "my-anthropic"` AND a registered provider "my-openai"
- WHEN the client calls `provider.switch` with `{ sessionId: "sess-1", providerId: "my-openai" }`
- THEN the session's `activeProviderId` becomes `"my-openai"`
- AND the response includes `previousProviderId: "my-anthropic"`

#### Scenario: Switch to same provider is idempotent
- GIVEN a session with `activeProviderId: "my-anthropic"`
- WHEN the client calls `provider.switch` with `{ providerId: "my-anthropic" }`
- THEN the switch succeeds with `previousProviderId: "my-anthropic"` and `newProviderId: "my-anthropic"`
- AND no unnecessary provider initialization occurs

#### Scenario: Reject switch on completed session
- GIVEN a session with status `"completed"`
- WHEN the client calls `provider.switch`
- THEN error `-32602` is returned with reason indicating session state does not allow switching

#### Scenario: Reject switch on stopped session
- GIVEN a session with status `"stopped"`
- WHEN the client calls `provider.switch`
- THEN error `-32602` is returned

#### Scenario: Reject unknown session
- GIVEN no session with ID "unknown" exists
- WHEN the client calls `provider.switch` with `{ sessionId: "unknown" }`
- THEN error `-32011` is returned

#### Scenario: Reject unregistered provider
- GIVEN a provider "missing" is not registered
- WHEN the client calls `provider.switch` with `{ providerId: "missing" }`
- THEN error `-32001` is returned

#### Scenario: Reject unhealthy provider
- GIVEN a provider "broken" is registered but fails health check
- WHEN the client calls `provider.switch` with `{ providerId: "broken" }`
- THEN error `-32004` is returned with message "Provider unhealthy"

### Requirement: Session Set Provider Method
The SDK MUST expose a `session.setProvider` method as the primary session-scoped API for assigning a provider.

Parameters: `{ sessionId: string, providerId: string }`.

This method MUST behave identically to `provider.switch` — it validates, switches, notifies, and returns the same response shape. The two methods exist as aliases for ergonomic reasons: `session.setProvider` reads as a session operation, while `provider.switch` reads as a provider operation.

#### Scenario: Set provider via session method
- GIVEN a session with ID "sess-1" in `"idle"` status AND a registered provider "my-openai"
- WHEN the client calls `session.setProvider` with `{ sessionId: "sess-1", providerId: "my-openai" }`
- THEN the result is identical to calling `provider.switch` with the same parameters

### Requirement: Provider Switched Notification
The bridge MUST emit a `bridge/provider_switched` notification when a session's active provider changes.

Notification payload MUST include:
- `sessionId` (string)
- `previousProviderId` (string | null — the provider ID before the switch, or null if none was set)
- `newProviderId` (string — the provider ID after the switch)
- `timestamp` (string, ISO 8601)

#### Scenario: Notification carries correct before/after IDs
- GIVEN a session with `activeProviderId: "anthropic-primary"` is switched to `"openai-backup"`
- WHEN the switch completes
- THEN the emitted notification contains `previousProviderId: "anthropic-primary"` and `newProviderId: "openai-backup"`

#### Scenario: Notification carries null for first-time assignment
- GIVEN a session with no `activeProviderId` is assigned a provider
- WHEN the switch completes
- THEN the emitted notification contains `previousProviderId: null`

### Requirement: Session Provider Resolution
When a session starts or resumes a query, the bridge MUST resolve the effective LLM provider using the following priority order:

1. Session's `activeProviderId` (if set and the provider is registered and healthy)
2. Registry's default provider (if set and healthy)
3. Built-in Anthropic fallback (existing default behavior)

If the session's `activeProviderId` points to a provider that was removed or is unhealthy, the resolver MUST skip it and fall back to the next level. It MUST NOT throw an error — the session should always be able to execute with some provider.

#### Scenario: Session uses its overridden provider
- GIVEN a session with `activeProviderId: "my-openai"` AND "my-openai" is registered and healthy
- WHEN the session starts a query
- THEN the query executes using the "my-openai" provider instance

#### Scenario: Session falls back to registry default when override is unset
- GIVEN a session with no `activeProviderId` AND the registry default is "my-anthropic"
- WHEN the session starts a query
- THEN the query executes using the "my-anthropic" provider instance

#### Scenario: Session falls back to built-in when override provider is removed
- GIVEN a session with `activeProviderId: "removed-provider"` AND "removed-provider" is NOT registered
- WHEN the session starts a query
- THEN the query falls back to the registry default or built-in Anthropic

#### Scenario: Session falls back when override provider is unhealthy
- GIVEN a session with `activeProviderId: "broken-provider"` AND "broken-provider" fails health check
- WHEN the session starts a query
- THEN the query falls back to the next available provider in the resolution chain

### Requirement: Active Provider in Session Status
The `session.status` and `session.list` responses MUST include an `activeProviderId` field (string | null) indicating which provider the session is currently configured to use.

#### Scenario: Session status shows active provider
- GIVEN a session with `activeProviderId: "my-openai"`
- WHEN the client calls `session.status`
- THEN the response includes `activeProviderId: "my-openai"`

#### Scenario: Session list shows active provider per entry
- GIVEN multiple sessions with different `activeProviderId` values
- WHEN the client calls `session.list`
- THEN each entry includes its `activeProviderId`

### Requirement: Capabilities Advertisement
The `bridge.capabilities` response MUST include `"provider.switch"` and `"session.setProvider"` in the `methods` array.

#### Scenario: Capabilities list new methods
- GIVEN the bridge is running
- WHEN the client calls `bridge.capabilities`
- THEN the `methods` array includes both `"provider.switch"` and `"session.setProvider"`

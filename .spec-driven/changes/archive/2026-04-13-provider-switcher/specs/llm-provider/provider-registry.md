---
mapping:
  implementation:
    - src/llm-provider/provider-registry.ts
    - src/bridge.ts
    - src/session-store.ts
  tests:
    - test/provider-switching.test.ts
    - test/provider-switching-bridge.test.ts
---
## ADDED Requirements

### Requirement: Provider Switching
The SDK MUST allow clients to switch the active LLM provider for a running or idle session.

#### Scenario: Switch provider on idle session
- GIVEN a session with ID "sess-1" exists in "idle" execution state
- AND a provider with ID "my-anthropic" is registered and healthy
- WHEN the client calls `provider.switch` with `{ sessionId: "sess-1", providerId: "my-anthropic" }`
- THEN the bridge sets "my-anthropic" as the session's active provider
- AND returns `{ success: true, sessionId: "sess-1", previousProviderId: null, newProviderId: "my-anthropic" }`
- AND emits a `bridge/provider_switched` notification with `{ sessionId, previousProviderId, newProviderId, timestamp }`

#### Scenario: Switch provider on running session
- GIVEN a session with ID "sess-1" exists in "running" execution state
- AND a provider with ID "my-openai" is registered and healthy
- WHEN the client calls `provider.switch` with `{ sessionId: "sess-1", providerId: "my-openai" }`
- THEN the switch succeeds and returns the previous and new provider IDs

#### Scenario: Track previous provider ID on re-switch
- GIVEN a session has activeProviderId set to "provider-a"
- WHEN the client switches to "provider-b"
- THEN `previousProviderId` is "provider-a"
- AND `newProviderId` is "provider-b"

#### Scenario: Reject switch for non-existent session
- GIVEN no session with ID "unknown-sess" exists
- WHEN the client calls `provider.switch` with `{ sessionId: "unknown-sess", providerId: "some-provider" }`
- THEN the bridge returns error `-32011` with message "Session not found"

#### Scenario: Reject switch for non-existent provider
- GIVEN a session with ID "sess-1" exists
- AND no provider with ID "unknown-provider" is registered
- WHEN the client calls `provider.switch` with `{ sessionId: "sess-1", providerId: "unknown-provider" }`
- THEN the bridge returns error `-32001` with message "Provider not found"

#### Scenario: Reject switch for unhealthy provider
- GIVEN a session with ID "sess-1" exists
- AND a provider with ID "broken-provider" is registered but fails health check
- WHEN the client calls `provider.switch` with `{ sessionId: "sess-1", providerId: "broken-provider" }`
- THEN the bridge returns error `-32004` with message containing "unhealthy"

#### Scenario: Reject switch on session in error state
- GIVEN a session with ID "sess-1" is in "error" execution state
- WHEN the client calls `provider.switch` with `{ sessionId: "sess-1", providerId: "my-anthropic" }`
- THEN the bridge returns error `-32602` with message about invalid session state

#### Scenario: Require sessionId parameter
- WHEN the client calls `provider.switch` without `sessionId` or with non-string `sessionId`
- THEN the bridge returns error `-32602` with message about required 'sessionId'

#### Scenario: Require providerId parameter
- WHEN the client calls `provider.switch` without `providerId` or with non-string `providerId`
- THEN the bridge returns error `-32602` with message about required 'providerId'

### Requirement: Session Set Provider Alias
The SDK MUST provide `session.setProvider` as an alias for `provider.switch`.

#### Scenario: Alias behaves identically
- GIVEN valid sessionId and providerId
- WHEN the client calls `session.setProvider` with those parameters
- THEN the result is identical to calling `provider.switch` with the same parameters

### Requirement: Provider Resolution Fallback Chain
The SDK MUST resolve the active provider for a session using a deterministic fallback chain.

#### Scenario: Resolve to session's active provider
- GIVEN a session has `activeProviderId: "my-anthropic"`
- AND "my-anthropic" is registered and healthy
- WHEN the system resolves the provider for that session
- THEN the resolved provider instance is "my-anthropic"

#### Scenario: Fall back to default provider
- GIVEN a session has no `activeProviderId` or it points to an unregistered/unhealthy provider
- AND a default provider is set, registered, and healthy
- WHEN the system resolves the provider for that session
- THEN the resolved provider instance is the default provider

#### Scenario: Fall back to built-in provider
- GIVEN a session has no usable active or default provider
- WHEN the system resolves the provider for that session
- THEN the system returns the built-in Claude Agent SDK provider

#### Scenario: Unhealthy session provider falls through to default
- GIVEN a session has `activeProviderId: "sick-provider"` which is registered but unhealthy
- AND a healthy default provider exists
- WHEN the system resolves the provider for that session
- THEN the resolved provider is the default provider (not "sick-provider")

### Requirement: Session Status Reflects Active Provider
The SDK MUST include the current `activeProviderId` in session status responses.

#### Scenario: Status shows null before any switch
- GIVEN a session has never had a provider switched
- WHEN the client calls `session.status`
- THEN `activeProviderId` is `null`

#### Scenario: Status shows updated provider after switch
- GIVEN a session was switched to provider "my-anthropic"
- WHEN the client calls `session.status`
- THEN `activeProviderId` is `"my-anthropic"`

### Requirement: Provider Switch Notification
The SDK MUST emit a notification when a provider switch occurs.

#### Scenario: Notification includes full switch context
- GIVEN a successful provider switch from "old-p" to "new-p" on session "s1"
- THEN a `bridge/provider_switched` notification is emitted
- AND the notification contains: `sessionId`, `previousProviderId`, `newProviderId`, `timestamp`

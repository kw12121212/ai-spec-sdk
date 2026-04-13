---
mapping:
  implementation:
    - src/llm-provider/provider-registry.ts
    - src/token-tracking/counters/index.ts
  tests:
    - test/provider-registry.test.ts
    - test/token-tracking/counters.test.ts
---
## MODIFIED Requirements

### Requirement: Provider Registration (Extended)
The SDK MUST allow clients to register LLM provider configurations through the bridge AND associate a TokenCounter with each provider type.

#### Scenario: Register provider with automatic TokenCounter association
- GIVEN a client registers a provider with `type: "anthropic"`
- WHEN the registration completes
- THEN the system MUST associate the AnthropicTokenCounter with this provider
- AND future queries from this provider use the associated counter for token normalization

#### Scenario: Register unsupported provider type without built-in counter
- GIVEN a client registers a provider with `type: "custom-provider"`
- AND no built-in TokenCounter exists for "custom-provider"
- WHEN the registration completes
- THEN the system MUST register the provider with a default passthrough counter
- AND the default counter attempts to extract inputTokens/outputTokens from raw usage data

### Requirement: Provider Configuration Persistence (Extended)
The SDK MUST persist provider configurations AND their associated counter type to disk.

#### Scenario: Persist counter type on registration
- GIVEN a client registers an Anthropic provider
- WHEN persisted to ConfigStore
- THEN the stored configuration includes `counterType: "anthropic"` metadata

---

## ADDED Requirements

### Requirement: TokenCounter Registration
The SDK MUST support registering custom TokenCounter implementations for provider types.

#### Scenario: Register custom TokenCounter
- GIVEN a developer implements a TokenCounter for provider type "openai"
- WHEN they call `token.registerCounter({ providerType: "openai", counter: openaiCounter })`
- THEN subsequent registrations of type "openai" use this counter

#### Scenario: Override built-in counter
- GIVEN a built-in AnthropicTokenCounter is registered
- WHEN a client calls `token.registerCounter` with `providerType: "anthropic"` and a custom counter
- THEN the custom counter replaces the built-in one for all Anthropic providers

#### Scenario: List registered counters
- GIVEN multiple counters are registered (built-in and custom)
- WHEN the client calls `token.listCounters`
- THEN the bridge returns an array of `{ providerType, description }` for all registered counters
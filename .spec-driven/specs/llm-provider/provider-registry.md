---
mapping:
  implementation:
    - src/llm-provider/provider-registry.ts
    - src/bridge.ts
    - src/token-tracking/counters/index.ts
  tests:
    - test/provider-registry.test.ts
    - test/provider-registry-bridge.test.ts
    - test/token-tracking/counters.test.ts
---
## ADDED Requirements

### Requirement: Provider Registration
The SDK MUST allow clients to register LLM provider configurations through the bridge AND associate a TokenCounter with each provider type.

#### Scenario: Register a valid Anthropic provider
- GIVEN a client provides a valid provider configuration with `id`, `type: "anthropic"`, and `apiKey`
- WHEN the client calls `provider.register` with that configuration
- THEN the bridge stores the configuration and returns `{ success: true, providerId: "<id>" }`
- AND the system associates the AnthropicTokenCounter with this provider

#### Scenario: Register a provider with environment variable API key
- GIVEN a client provides a configuration with `type: "anthropic"` but no `apiKey`
- AND the `ANTHROPIC_API_KEY` environment variable is set
- WHEN the client calls `provider.register`
- THEN the registration succeeds using the environment variable

#### Scenario: Reject duplicate provider ID
- GIVEN a provider with ID "my-anthropic" is already registered
- WHEN the client attempts to register another provider with ID "my-anthropic"
- THEN the bridge returns error `-32002` with message "Provider already exists"

#### Scenario: Reject invalid configuration
- GIVEN a client provides a configuration missing required fields (e.g., no `id` or `type`)
- WHEN the client calls `provider.register`
- THEN the bridge returns error `-32602` (Invalid params) with details about missing fields

#### Scenario: Reject unsupported provider type
- GIVEN a client provides a configuration with `type: "unsupported-type"`
- WHEN the client calls `provider.register`
- THEN the bridge returns error `-32003` with message "Unsupported provider type"

#### Scenario: Register unsupported provider type without built-in counter
- GIVEN a client registers a provider with `type: "custom-provider"`
- AND no built-in TokenCounter exists for "custom-provider"
- WHEN the registration completes
- THEN the system MUST register the provider with a default passthrough counter
- AND the default counter attempts to extract inputTokens/outputTokens from raw usage data

### Requirement: Provider Listing
The SDK MUST allow clients to list all registered provider configurations.

#### Scenario: List all providers
- GIVEN multiple providers are registered
- WHEN the client calls `provider.list`
- THEN the bridge returns an array of provider configurations (excluding sensitive fields like API keys)

#### Scenario: List empty registry
- GIVEN no providers are registered
- WHEN the client calls `provider.list`
- THEN the bridge returns an empty array `[]`

### Requirement: Provider Retrieval
The SDK MUST allow clients to retrieve a specific provider's configuration by ID.

#### Scenario: Get existing provider
- GIVEN a provider with ID "my-anthropic" is registered
- WHEN the client calls `provider.get` with `{ providerId: "my-anthropic" }`
- THEN the bridge returns the provider configuration (excluding sensitive fields like API keys)

#### Scenario: Get non-existent provider
- GIVEN no provider with ID "unknown" exists
- WHEN the client calls `provider.get` with `{ providerId: "unknown" }`
- THEN the bridge returns error `-32001` with message "Provider not found"

### Requirement: Provider Update
The SDK MUST allow clients to update an existing provider's configuration.

#### Scenario: Update existing provider
- GIVEN a provider with ID "my-anthropic" is registered
- WHEN the client calls `provider.update` with `{ providerId: "my-anthropic", config: { model: "claude-opus-4-20250514" } }`
- THEN the bridge merges the new configuration and returns updated config

#### Scenario: Update non-existent provider
- GIVEN no provider with ID "unknown" exists
- WHEN the client calls `provider.update` with `{ providerId: "unknown", config: {...} }`
- THEN the bridge returns error `-32001` with message "Provider not found"

#### Scenario: Update invalidates cached instance
- GIVEN a provider has been initialized and its instance is cached
- WHEN the client updates that provider's configuration
- THEN the cached instance is destroyed and will be re-created on next use

### Requirement: Provider Removal
The SDK MUST allow clients to remove a registered provider.

#### Scenario: Remove existing provider
- GIVEN a provider with ID "my-anthropic" is registered
- WHEN the client calls `provider.remove` with `{ providerId: "my-anthropic" }`
- THEN the bridge removes the provider and returns `{ success: true, providerId: "my-anthropic" }`
- AND if the provider was initialized, its instance is destroyed

#### Scenario: Remove non-existent provider
- GIVEN no provider with ID "unknown" exists
- WHEN the client calls `provider.remove` with `{ providerId: "unknown" }`
- THEN the bridge returns error `-32001` with message "Provider not found"

#### Scenario: Remove default provider clears default
- GIVEN "my-anthropic" is the default provider
- WHEN the client removes "my-anthropic"
- THEN the default provider is cleared to null

### Requirement: Default Provider Management
The SDK MUST support setting and retrieving a default provider.

#### Scenario: Set default provider
- GIVEN a provider with ID "my-anthropic" is registered
- WHEN the client calls `provider.setDefault` with `{ providerId: "my-anthropic" }`
- THEN the bridge sets "my-anthropic" as the default and returns `{ success: true, providerId: "my-anthropic" }`

#### Scenario: Set default to non-existent provider fails
- GIVEN no provider with ID "unknown" exists
- WHEN the client calls `provider.setDefault` with `{ providerId: "unknown" }`
- THEN the bridge returns error `-32001` with message "Provider not found"

#### Scenario: Get current default provider
- GIVEN "my-anthropic" is set as the default provider
- WHEN the client calls `provider.getDefault`
- THEN the bridge returns `{ providerId: "my-anthropic", ...config }`

#### Scenario: Get default when none set
- GIVEN no default provider has been set
- WHEN the client calls `provider.getDefault`
- THEN the bridge returns `{ providerId: null }`

### Requirement: Provider Health Check
The SDK MUST allow clients to check the health of a registered provider.

#### Scenario: Health check on healthy provider
- GIVEN a provider with ID "my-anthropic" is registered and can be initialized
- WHEN the client calls `provider.healthCheck` with `{ providerId: "my-anthropic" }`
- THEN the bridge initializes the provider if needed, calls healthCheck(), and returns `{ healthy: true, providerId: "my-anthropic" }`

#### Scenario: Health check on unhealthy provider
- GIVEN a provider with ID "my-anthropic" is registered but initialization fails
- WHEN the client calls `provider.healthCheck` with `{ providerId: "my-anthropic" }`
- THEN the bridge returns `{ healthy: false, providerId: "my-anthropic", error: "<error message>" }`

#### Scenario: Health check on non-existent provider
- GIVEN no provider with ID "unknown" exists
- WHEN the client calls `provider.healthCheck` with `{ providerId: "unknown" }`
- THEN the bridge returns error `-32001` with message "Provider not found"

### Requirement: Provider Configuration Persistence
The SDK MUST persist provider configurations to disk so they survive restarts AND their associated counter type to disk.

#### Scenario: Persist on registration
- GIVEN a client registers a provider
- WHEN the registration completes
- THEN the provider configuration is saved to ConfigStore under key `llmProviders`
- AND the stored configuration includes `counterType: "<type>"` metadata

#### Scenario: Load on startup
- GIVEN the bridge is starting AND persisted provider configurations exist
- WHEN the bridge initializes the registry
- THEN all persisted providers are loaded into memory

#### Scenario: Persist on update/remove
- GIVEN a client updates or removes a provider
- WHEN the operation completes
- THEN the changes are persisted to ConfigStore

### Requirement: Sensitive Data Masking
The SDK MUST NOT return sensitive information (API keys, tokens) in list or get responses.

#### Scenario: API key masked in list response
- GIVEN a provider is registered with `apiKey: "sk-ant-..."`
- WHEN the client calls `provider.list`
- THEN the response does not include the `apiKey` field or shows it as masked

#### Scenario: API key masked in get response
- GIVEN a provider is registered with `apiKey: "sk-ant-..."`
- WHEN the client calls `provider.get`
- THEN the response does not include the full `apiKey` value

### Requirement: TokenCounter Registration
The SDK MUST support registering custom TokenCounter implementations for provider types.

#### Scenario: Register custom TokenCounter
- GIVEN a developer registers a counter for provider type "openai" via `token.registerCounter`
- WHEN subsequent providers of type "openai" are registered
- THEN queries from those providers use the registered openai counter

#### Scenario: Override built-in counter
- GIVEN a built-in AnthropicTokenCounter is registered
- WHEN a client calls `token.registerCounter` with `providerType: "anthropic"` and a custom description
- THEN a new PassthroughTokenCounter replaces the built-in one for all Anthropic providers

#### Scenario: List registered counters
- GIVEN multiple counters are registered (built-in and custom)
- WHEN the client calls `token.listCounters`
- THEN the bridge returns an array of `{ providerType, description }` for all registered counters

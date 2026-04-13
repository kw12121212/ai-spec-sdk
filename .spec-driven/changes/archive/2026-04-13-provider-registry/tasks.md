# Tasks: Provider Registry

## Implementation

### Core ProviderRegistry Class
- [x] Create `src/llm-provider/provider-registry.ts` with `ProviderRegistry` class
- [x] Implement in-memory storage using `Map<string, ProviderConfig>` for configurations
- [x] Implement in-memory storage using `Map<string, LLMProvider>` for initialized instances
- [x] Implement default provider tracking (`defaultProviderId: string | null`)
- [x] Implement adapter factory registry mapping types to constructor functions
- [x] Register `AnthropicAdapter` factory for `"anthropic"` type
- [x] Implement configuration validation logic:
  - [x] Validate required fields: `id` (non-empty string), `type` (supported value)
  - [x] Validate type-specific requirements (apiKey presence for anthropic/openai)
  - [x] Return structured validation errors with field names and reasons
- [x] Implement `register(config: ProviderConfig)` method:
  - [x] Validate configuration
  - [x] Check for duplicate ID
  - [x] Store in memory map
  - [x] Persist to ConfigStore
  - [x] Return success result
- [x] Implement `list()` method:
  - [x] Return array of all registered configs
  - [x] Mask sensitive fields (apiKey)
- [x] `get(providerId: string)` method:
  - [x] Look up by ID
  - [x] Return config with masked sensitive fields or throw if not found
- [x] `update(providerId: string, config: Partial<ProviderConfig>)` method:
  - [x] Validate provider exists
  - [x] Validate new config fields
  - [x] Merge new config into existing
  - [x] Destroy cached instance if exists
  - [x] Persist changes
  - [x] Return updated config
- [x] `remove(providerId: string)` method:
  - [x] Validate provider exists
  - [x] Destroy instance if initialized
  - [x] Remove from memory map
  - [x] Clear default if removing the default provider
  - [x] Persist changes
  - [x] Return success
- [x] `setDefault(providerId: string)` method:
  - [x] Validate provider exists
  - [x] Set defaultProviderId
  - [x] Return success
- [x] `getDefault()` method:
  - [x] Return default provider ID and config, or null if none set
- [x] `healthCheck(providerId: string)` method:
  - [x] Validate provider exists
  - [x] Get or create instance lazily
  - [x] Call `provider.initialize()` if not already initialized
  - [x] Call `provider.healthCheck()`
  - [x] Return health status with error details if unhealthy
- [x] Implement lazy instantiation helper:
  - [x] Check instance cache
  - [x] Create via adapter factory
  - [x] Initialize the instance
  - [x] Cache for future use
  - [x] Handle initialization errors gracefully
- [x] Implement persistence integration:
  - [x] `saveToStore()` - serialize all configs to ConfigStore under key `llmProviders`
  - [x] `loadFromStore()` - deserialize configs from ConfigStore on startup
  - [x] Call loadFromStore() in constructor or init method
- [x] Export singleton instance from `src/llm-provider/provider-registry.ts`

### JSON-RPC Bridge Integration
- [x] Modify `src/bridge.ts` to import ProviderRegistry singleton
- [x] Add `provider.register` method handler:
  - [x] Extract params and call `registry.register()`
  - [x] Return success or appropriate JSON-RPC error
- [x] Add `provider.list` method handler:
  - [x] Call `registry.list()`
  - [x] Return results array
- [x] Add `provider.get` method handler:
  - [x] Extract `providerId` param
  - [x] Call `registry.get()`
  - [x] Return config or not-found error
- [x] Add `provider.update` method handler:
  - [x] Extract `providerId` and `config` params
  - [x] Call `registry.update()`
  - [x] Return updated config or error
- [x] Add `provider.remove` method handler:
  - [x] Extract `providerId` param
  - [x] Call `registry.remove()`
  - [x] Return success or not-found error
- [x] Add `provider.setDefault` method handler:
  - [x] Extract `providerId` param
  - [x] Call `registry.setDefault()`
  - [x] Return success or not-found error
- [x] Add `provider.getDefault` method handler:
  - [x] Call `registry.getDefault()`
  - [x] Return default provider info
- [x] Add `provider.healthCheck` method handler:
  - [x] Extract `providerId` param
  - [x] Call `registry.healthCheck()`
  - [x] Return health status or not-found error
- [x] Ensure all handlers use proper JSON-RPC error codes as defined in design.md

### Sensitive Data Masking Utility
- [x] Create utility function to mask API keys in config objects
- [x] Replace apiKey with partial mask (e.g., "sk-ant-...") or omit entirely
- [x] Apply masking consistently in list() and get() responses

## Testing

- [x] Unit test `test/provider-registry.test.ts` (new file):
  - [x] Test registration of valid Anthropic provider with apiKey
  - [x] Test registration with environment variable API key (set/unset ANTHROPIC_API_KEY)
  - [x] Test rejection of duplicate provider ID
  - [x] Test rejection of invalid configurations (missing id, missing type, invalid type)
  - [x] Test rejection of unsupported provider type
  - [x] Test listing providers (multiple, single, empty)
  - [x] Test getting existing provider
  - [x] Test getting non-existent provider (error case)
  - [x] Test updating existing provider (partial update, full replace)
  - [x] Test updating non-existent provider (error case)
  - [x] Test that update destroys cached instance
  - [x] Test removing existing provider
  - [x] Test removing non-existent provider (error case)
  - [x] Test that removing default clears default
  - [x] Test setting default provider
  - [x] Test setting default to non-existent provider (error case)
  - [x] Test getting current default (set and unset cases)
  - [x] Test health check on healthy provider
  - [x] Test health check on unhealthy/failed initialization
  - [x] Test health check on non-existent provider (error case)
  - [x] Test lazy instantiation (instance created on first use)
  - [x] Test instance caching (reuse across multiple calls)
  - [x] Test sensitive data masking in list response
  - [x] Test sensitive data masking in get response
  - [x] Test persistence round-trip (register → save → load → verify)

- [x] Integration test `test/provider-registry-bridge.test.ts` (new file):
  - [x] Test `provider.register` through bridge (success and error cases)
  - [x] Test `provider.list` through bridge
  - [x] Test `provider.get` through bridge (success and not-found)
  - [x] Test `provider.update` through bridge (success and not-found)
  - [x] Test `provider.remove` through bridge (success and not-found)
  - [x] Test `provider.setDefault` through bridge (success and not-found)
  - [x] Test `provider.getDefault` through bridge
  - [x] Test `provider.healthCheck` through bridge (success, failure, not-found)
  - [x] Verify all error responses match expected JSON-RPC format and codes
  - [x] Clean up global state between tests (delete providers, reset defaults)

- [x] Persistence tests:
  - [x] Test that registrations persist to ConfigStore correctly
  - [x] Test that updates are persisted
  - [x] Test that removals are persisted
  - [x] Test loading persisted state on registry initialization
  - [x] Test handling of corrupted/invalid persisted data (graceful fallback)

- [x] Run `bun run lint` (tsc --noEmit) and ensure no type errors
- [x] Run `bun run test` to execute all tests including new provider-registry tests

## Verification

### Lint and Type Checking
- [x] Run `bun run lint` (tsc --noEmit) and ensure no type errors
- [x] Fix any type errors before proceeding to test execution

### Unit Test Execution
- [x] Run `bun run test` to execute all tests including new provider-registry tests
- [x] Ensure all new tests pass
- [x] Ensure existing tests still pass (no regressions)

### Manual Verification (Optional but Recommended)
- [x] Start the bridge with stdio transport
- [x] Use a JSON-RPC client to register an Anthropic provider
- [x] List providers and verify registration
- [x] Update the provider configuration
- [x] Perform a health check
- [x] Set and get the default provider
- [x] Remove the provider
- [x] Restart the bridge and verify persistence loaded the provider back

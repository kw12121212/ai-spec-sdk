---
mapping:
  implementation:
    - src/llm-provider/types.ts
    - src/llm-provider/index.ts
    - src/llm-provider/adapters/anthropic.ts
  tests:
    - test/llm-provider.test.ts
    - test/anthropic-adapter.test.ts
---

## ADDED Requirements

### Requirement: LLM Provider Interface Definition

The SDK MUST define a `LLMProvider` interface that specifies the contract for all LLM backend implementations.

The `LLMProvider` interface MUST include:

| Method | Return Type | Description |
|---|---|---|
| `initialize()` | `Promise<void>` | Initialize the provider (validate config, establish connections) |
| `healthCheck()` | `Promise<boolean>` | Check if the provider is reachable and functional |
| `getCapabilities()` | `ProviderCapabilities` | Return provider's supported features and limits |
| `query(options: QueryOptions)` | `Promise<QueryResult>` | Execute a non-streaming query |
| `queryStream(options, onEvent, signal?)` | `Promise<QueryResult>` | Execute a streaming query with event callbacks |
| `destroy()` | `void` | Clean up resources and connections |

The interface MUST be defined in `src/llm-provider/types.ts`.

#### Scenario: Interface is exported
- GIVEN the llm-provider module is imported
- WHEN accessing the LLMProvider type
- THEN the type is available and includes all required methods

#### Scenario: Interface methods are typed correctly
- GIVEN an object implements LLMProvider
- WHEN calling each method
- THEN TypeScript compiler accepts the call with correct parameter types and return types

### Requirement: Provider Configuration Schema

The SDK MUST define a `ProviderConfig` type that captures provider-specific configuration.

The `ProviderConfig` MUST include:

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Unique identifier for this provider instance |
| `type` | `"anthropic" \| "openai" \| "local"` | Yes | Provider type discriminator |
| `apiKey` | string | No | API authentication key |
| `model` | string | No | Model identifier to use |
| `temperature` | number | No | Sampling temperature (0.0–2.0) |
| `maxTokens` | number | No | Maximum tokens in response |

The type MUST allow additional provider-specific fields via index signature `[key: string]: unknown`.

#### Scenario: Valid config is accepted
- GIVEN a ProviderConfig with required fields `id` and `type`
- WHEN passed to provider initialization
- THEN the config is accepted without error

#### Scenario: Missing required fields rejected
- GIVEN a ProviderConfig missing `id` or `type`
- WHEN TypeScript validation occurs
- THEN a compile-time error occurs

#### Scenario: Extra fields are allowed
- GIVEN a ProviderConfig with custom field `customParam: "value"`
- WHEN used in provider initialization
- THEN no error occurs and the field is accessible via index signature

### Requirement: Provider Capabilities Discovery

The SDK MUST define a `ProviderCapabilities` type that providers use to declare their supported features.

The `ProviderCapabilities` MUST include:

| Field | Type | Required | Description |
|---|---|---|---|
| `streaming` | boolean | Yes | Whether the provider supports streaming responses |
| `tokenUsageTracking` | boolean | Yes | Whether the provider can report token usage |
| `functionCalling` | boolean | Yes | Whether the provider supports function/tool calling |
| `maxContextLength` | number | No | Maximum context window size in tokens |
| `supportedModels` | string[] | Yes | List of model identifiers this provider supports |

#### Scenario: Capabilities are returned by provider
- GIVEN an initialized LLMProvider instance
- WHEN calling `getCapabilities()`
- THEN a `ProviderCapabilities` object is returned with all required fields populated

#### Scenario: Anthropic adapter reports correct capabilities
- GIVEN an AnthropicAdapter instance
- WHEN calling `getCapabilities()`
- THEN capabilities indicate streaming=true, tokenUsageTracking=true, functionCalling=true

### Requirement: Query Options Schema

The SDK MUST define a `QueryOptions` type for standardizing query parameters across providers.

The `QueryOptions` MUST include:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `messages` | `QueryMessage[]` | Yes | - | Conversation messages array |
| `stream` | boolean | No | false | Enable streaming response |
| `temperature` | number | No | undefined | Sampling temperature |
| `maxTokens` | number | No | undefined | Max response tokens |
| `stopSequences` | string[] | No | undefined | Stop generation sequences |

The `QueryMessage` type MUST have:
- `role`: `"user" \| "assistant" \| "system"`
- `content`: string

#### Scenario: QueryOptions with minimal fields works
- GIVEN a QueryOptions with only `messages` array
- WHEN passed to provider.query()
- THEN the query executes successfully

#### Scenario: All optional fields are respected
- GIVEN a QueryOptions with stream=true, temperature=0.7, maxTokens=1000
- WHEN passed to provider.queryStream()
- THEN the query uses all specified parameters

### Requirement: Stream Event Types

The SDK MUST define a `StreamEvent` type for standardized streaming event communication.

The `StreamEvent` MUST have:
- `type`: `"text_delta" \| "usage_delta" \| "complete" \| "error"`
- `data`: unknown (event-specific payload)

Event types:
- `text_delta`: Partial text content chunk
- `usage_delta`: Token usage update
- `complete`: Stream finished successfully
- `error`: Stream encountered an error

#### Scenario: Stream events follow the type contract
- GIVEN a streaming query is executing
- WHEN events are emitted via onEvent callback
- THEN each event has valid `type` from the allowed set AND `data` payload

#### Scenario: Complete event signals end of stream
- GIVEN a streaming query finishes
- WHEN the final event is emitted
- THEN the event type is `"complete"`

### Requirement: Query Result Schema

The SDK MUST define a `QueryResult` type for standardized query response.

The `QueryResult` MUST have:
- `status`: `"completed" \| "stopped"`
- `result`: unknown (the actual response content)
- `usage`: `TokenUsage \| null`

The `TokenUsage` MUST have:
- `inputTokens`: number
- `outputTokens`: number

#### Scenario: Successful query returns completed status
- GIVEN a query completes normally
- WHEN inspecting the result
- THEN status is `"completed"` AND result contains response data

#### Scenario: Stopped query returns stopped status
- GIVEN a query is aborted via AbortSignal
- WHEN inspecting the result
- THEN status is `"stopped"` AND result is null

#### Scenario: Usage data included when available
- GIVEN a provider that tracks tokens
- WHEN a query completes
- THEN usage contains inputTokens and outputTokens

#### Scenario: Usage is null when unavailable
- GIVEN a provider that cannot track tokens
- WHEN a query completes
- THEN usage is null

### Requirement: Provider Lifecycle Management

Each LLMProvider implementation MUST support a three-phase lifecycle:
1. **Initialization** (`initialize()`): Validate configuration, establish connections
2. **Operation** (`query()`, `queryStream()`, `healthCheck()`): Handle requests
3. **Destruction** (`destroy()`): Release resources, close connections

The SDK MUST ensure `initialize()` is called before any query operations.
The SDK MUST call `destroy()` when the provider is no longer needed.

#### Scenario: Initialize before query succeeds
- GIVEN a newly created provider instance
- WHEN initialize() is called followed by query()
- THEN both operations complete without error

#### Scenario: Query before initialize fails gracefully
- GIVEN a newly created provider instance without calling initialize()
- WHEN query() is called
- THEN the operation fails with a clear error indicating uninitialized state

#### Scenario: Destroy cleans up resources
- GIVEN an initialized provider instance
- WHEN destroy() is called
- THEN all connections are closed and resources released

#### Scenario: Health check returns boolean
- GIVEN an initialized provider
- WHEN healthCheck() is called
- THEN it returns true if operational, false otherwise

### Requirement: Anthropic Adapter Implementation

The SDK MUST provide an `AnthropicAdapter` class that implements `LLMProvider` using the existing `@anthropic-ai/claude-agent-sdk` integration.

The `AnthropicAdapter` MUST:
- Wrap the existing `runClaudeQuery` logic from [claude-agent-runner.ts](src/claude-agent-runner.ts)
- Accept `ProviderConfig` with `type: "anthropic"`
- Map `QueryOptions.messages` to the prompt format expected by Claude Agent SDK
- Convert SDK message events to `StreamEvent` format
- Extract TokenUsage from SDK response metadata
- Support AbortSignal for cancellation

The adapter MUST be located at `src/llm-provider/adapters/anthropic.ts`.

#### Scenario: Adapter creates successful query
- GIVEN an AnthropicAdapter with valid config
- WHEN query() is called with valid options
- THEN a QueryResult with status="completed" is returned

#### Scenario: Adapter streams events correctly
- GIVEN an AnthropicAdapter with valid config
- WHEN queryStream() is called with onEvent callback
- THEN onEvent receives text_delta events during generation AND a complete event at the end

#### Scenario: Adapter respects abort signal
- GIVEN an active streaming query
- WHEN AbortSignal is triggered
- THEN the query stops and returns status="stopped"

#### Scenario: Adapter extracts token usage
- GIVEN a query completes with SDK usage data
- WHEN inspecting the result
- THEN usage contains inputTokens and outputTokens from the SDK response

#### Scenario: Adapter health check validates API key
- GIVEN an AnthropicAdapter with invalid apiKey
- WHEN healthCheck() is called
- THEN it returns false

#### Scenario: Adapter reports Anthropic-specific capabilities
- GIVEN an AnthropicAdapter instance
- WHEN getCapabilities() is called
- THEN capabilities include supportedModels like ["claude-sonnet-4-20250514", "claude-opus-4-20250514"]

### Requirement: Session Provider Association

The Session type MUST support an optional `providerId` field to associate sessions with specific LLM providers.

When `providerId` is set on session creation, the bridge MUST use that provider for all queries in that session.
When `providerId` is not set, the bridge MUST use the default provider (Anthropic).

The `providerId` field MUST be persisted to disk as part of the session JSON file.

#### Scenario: Session created with providerId uses specified provider
- GIVEN a client starts a session with `{ providerId: "my-openai-provider" }`
- WHEN the session executes queries
- THEN the queries are routed to the provider with id "my-openai-provider"

#### Scenario: Session without providerId uses default
- GIVEN a client starts a session without providerId
- WHEN the session executes queries
- THEN the queries use the default Anthropic provider

#### Scenario: ProviderId is persisted
- GIVEN a session with providerId exists
- WHEN the session is saved to disk
- THEN the JSON file includes the providerId field

### Requirement: Backward Compatibility

The introduction of the LLM provider interface MUST NOT break existing functionality.

Existing code paths that do not explicitly configure a provider MUST continue to work as before, using Anthropic as the implicit default provider.

All existing JSON-RPC method signatures and behaviors MUST remain unchanged.
Existing tests MUST continue to pass without modification (unless they specifically test provider functionality).

#### Scenario: Existing session.start still works
- GIVEN a client calls session.start without providerId
- WHEN the request is processed
- THEN the session starts successfully using the default Anthropic provider

#### Scenario: Existing tests pass unchanged
- GIVEN the test suite runs
- WHEN all non-provider tests execute
- THEN they pass without modification

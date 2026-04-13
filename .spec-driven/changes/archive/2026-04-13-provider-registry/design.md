# Design: Provider Registry

## Approach

### Architecture Overview
The provider registry follows a **centralized registry pattern** with these components:

1. **ProviderRegistry** (new class in `src/llm-provider/provider-registry.ts`)
   - In-memory store of provider configurations (Map<string, ProviderConfig>)
   - In-memory store of initialized provider instances (Map<string, LLMProvider>)
   - Default provider tracking (string | null)
   - Validation logic for configurations
   - CRUD operations with lifecycle management

2. **JSON-RPC Integration** (modifications to `src/bridge.ts`)
   - New `provider.*` method namespace
   - Delegates all provider operations to ProviderRegistry instance
   - Returns structured JSON-RPC responses or errors

3. **Persistence Layer** (integration with existing `ConfigStore`)
   - Save/load provider configs to `.claude/settings.json` under key `llmProviders`
   - Workspace-scoped defaults via session template config

4. **Session Template Integration** (optional enhancement)
   - Session templates can specify a `defaultProviderId` field
   - When a session is created from a template, it uses that template's default provider

### Data Flow

```
Client → JSON-RPC → Bridge → ProviderRegistry → LLMProvider instances
                                    ↓
                              ConfigStore (persistence)
```

### Key Operations

#### Registration Flow
1. Client sends `provider.register` with ProviderConfig
2. Bridge validates required fields (id, type)
3. Bridge validates type-specific requirements (e.g., apiKey for anthropic/openai)
4. Registry stores configuration in memory
5. Registry persists to ConfigStore
6. Returns success with provider ID

#### Provider Instantiation (Lazy)
1. Client requests operation requiring provider (e.g., health check)
2. Registry checks if instance exists for that ID
3. If not, creates adapter instance based on `config.type`
4. Calls `provider.initialize()`
5. Caches instance for reuse
6. Returns result

#### Default Provider Selection
- Explicit: `provider.setDefault(providerId)` sets global default
- Template-based: Session templates can override with `defaultProviderId`
- Fallback: First registered provider if no explicit default

## Key Decisions

### 1. Lazy Initialization Pattern
**Decision:** Provider instances are created lazily on first use, not at registration time.

**Rationale:**
- Avoids startup overhead and API key validation delays
- Allows registration of providers that may not be immediately available
- Consistent with the existing AnthropicAdapter pattern where initialization is separate from construction
- Prevents cascade failures if one provider is misconfigured

### 2. In-Memory Primary Store with ConfigStore Persistence
**Decision:** Use an in-memory Map as the primary store, with ConfigStore as the persistence layer.

**Rationale:**
- Fast access during runtime operations (no disk I/O on every read)
- Leverages existing ConfigStore infrastructure
- Simple serialization/deserialization of ProviderConfig objects
- Aligns with project's existing patterns (session-store, template-store)
- Persistence is write-through on mutations, read-on-startup

### 3. Type-Based Adapter Factory
**Decision:** Use a factory pattern where the registry maps `config.type` string to adapter constructors.

**Rationale:**
- Extensible: new providers can be added by registering a new adapter factory
- Clean separation between registry logic and provider-specific code
- Currently only supports `anthropic` type (mapping to AnthropicAdapter)
- Future types (`openai`, `local`) can be added without modifying registry core

**Implementation:**
```typescript
type ProviderAdapterFactory = (config: ProviderConfig) => LLMProvider;

const adapterFactories: Record<string, ProviderAdapterFactory> = {
  anthropic: (config) => new AnthropicAdapter(config),
  // openai: (config) => new OpenAIAdapter(config), // future
  // local: (config) => new LocalModelAdapter(config), // future
};
```

### 4. Validation Strategy
**Decision:** Validate at registration time with clear error messages, but allow some flexibility via the index signature.

**Rationale:**
- Fail fast: catch configuration errors before they cause runtime failures
- Required fields: `id` (string, non-empty), `type` (one of supported types)
- Type-specific validation:
  - `anthropic`/`openai`: requires `apiKey` either in config or environment variable
  - `local`: requires `baseUrl` or similar endpoint config
- Allow extra fields via `[key: string]: unknown` in ProviderConfig for future extensibility
- Return structured JSON-RPC errors with validation details

### 5. Global Singleton Registry Instance
**Decision:** Create a single ProviderRegistry instance shared across the bridge lifetime.

**Rationale:**
- Simplifies state management (no need to pass registry around)
- Consistent with other singletons in the codebase (session-store, config-store, etc.)
- All JSON-RPC methods access the same registry state
- Can be accessed from workflow execution context if needed

## Alternatives Considered

### Alternative A: Database-Backed Registry
**Approach:** Use SQLite or another embedded database instead of ConfigStore.

**Rejected because:**
- Adds a dependency (better-sqlite3, etc.) beyond current stack
- Overkill for configuration data (not high-volume transactions)
- Existing ConfigStore already handles this pattern well
- Would require migration infrastructure for schema changes

### Alternative B: Eager Initialization at Registration
**Approach:** Create and initialize provider instances immediately when registered.

**Rejected because:**
- Slows down registration, especially with network-dependent providers
- API key validation might fail even if the key works later
- Doesn't align with existing lazy patterns in the codebase
- Makes registration synchronous/blocking which complicates error handling

### Alternative C: Per-Workspace Provider Registries
**Approach:** Each workspace has its own isolated provider registry.

**Rejected because:**
- Adds complexity to session-provider association
- Duplicates provider configurations across workspaces
- Harder to manage shared API keys and quotas
- Workspace-scoped defaults via templates achieve similar goals without full isolation
- Could be revisited if multi-tenant requirements emerge

### Alternative D: Configuration File Only (No Runtime API)
**Approach:** Providers defined only in config files, no JSON-RPC management API.

**Rejected because:**
- Limits dynamic provider management (adding/removing at runtime)
- Requires restarts for configuration changes
- Less flexible for programmatic integrations
- Contradicts the goal of runtime configurability in milestone 08
- JSON-RPC API enables UI-based management in the future

## Error Handling Strategy

All JSON-RPC methods follow this pattern:
- **Validation errors**: Return `-32602` (Invalid params) with detailed message
- **Not found errors**: Return custom error code `-32001` (Provider not found)
- **Duplicate errors**: Return custom error code `-32002` (Provider already exists)
- **Initialization errors**: Return `-32603` (Internal error) with provider-specific message
- **Type unsupported**: Return custom error code `-32003` (Unsupported provider type)

## Testing Strategy

- **Unit tests for ProviderRegistry**: Test all CRUD operations, validation, lifecycle management in isolation
- **Integration tests for JSON-RPC methods**: Test through bridge layer with mock/stub dependencies
- **Persistence tests**: Verify save/load round-trip with ConfigStore
- **Edge cases**: Empty registry, duplicate IDs, invalid configs, missing defaults
- **Concurrency safety**: Although Node.js is single-threaded, test rapid sequential operations don't corrupt state

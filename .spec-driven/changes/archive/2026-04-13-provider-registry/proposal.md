# Proposal: Provider Registry

## What
Implement a centralized LLM provider registry that manages multiple provider configurations, enabling registration, discovery, validation, and lifecycle management of LLM provider instances.

The registry will:
- Store and retrieve provider configurations by ID
- Support registration of multiple providers (Anthropic, OpenAI, local models)
- Validate provider configurations before registration
- Provide a default provider mechanism
- Expose JSON-RPC methods for provider management
- Integrate with session templates for workspace-scoped defaults

## Why
The completed `provider-interface` change established the foundational `LLMProvider` abstraction and the `AnthropicAdapter` implementation. However, there is no system to manage multiple provider instances or their configurations.

A provider registry is essential because:
1. **Multi-provider support** is a core goal of milestone 08 (LLM Provider Abstraction Layer)
2. **Subsequent features depend on it**: provider switching (08), load balancing (08), token tracking (08), quota management (08), and provider fallback (08) all require a registry to store and access provider configurations
3. **Configuration management** needs a single source of truth rather than scattered config objects
4. **Session integration** requires associating sessions with specific providers from a managed set

Without this registry, the SDK can only use a single hardcoded provider, limiting its flexibility and preventing advanced features like failover and load distribution.

## Scope
### In Scope
- ProviderRegistry class with CRUD operations for provider configurations
- Configuration validation (required fields, type checking, API key presence)
- Default provider selection and retrieval
- Provider instance lifecycle management (initialize/destroy)
- JSON-RPC methods:
  - `provider.register` - register a new provider configuration
  - `provider.list` - list all registered providers
  - `provider.get` - get provider details by ID
  - `provider.update` - update an existing provider configuration
  - `provider.remove` - remove a provider
  - `provider.setDefault` - set the default provider
  - `provider.getDefault` - get the current default provider
  - `provider.healthCheck` - check health of a specific provider
- Integration with ConfigStore for persistence
- Workspace-scoped provider defaults via session template association
- Unit tests for all registry operations and JSON-RPC methods

### Out of Scope
- Runtime provider switching between active sessions (covered by `provider-switching`)
- Load balancing across multiple instances (covered by `load-balancer`)
- Token usage accounting (covered by `token-tracking`)
- Quota enforcement (covered by `quota-management`)
- Automatic failover logic (covered by `provider-fallback`)
- Provider adapter implementations beyond Anthropic (OpenAI, local model adapters are future work)
- UI for provider management (can be added later if needed)

## Unchanged Behavior
- Existing `LLMProvider` interface remains unchanged
- Existing `AnthropicAdapter` implementation remains unchanged
- Current single-provider usage pattern continues to work
- Session creation and management APIs remain unchanged (sessions will optionally accept a provider ID)
- Workflow execution remains unchanged
- All existing JSON-RPC methods retain their current behavior
- Bridge initialization and startup sequence unchanged

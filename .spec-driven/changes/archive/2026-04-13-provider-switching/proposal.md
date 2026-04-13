# provider-switching

## What

Add runtime LLM provider switching capability so that active agent sessions can change their backing LLM provider without session restart or context loss. This includes:

- A new `provider.switch` JSON-RPC bridge method for explicit provider switching
- A new `session.setProvider` method to assign a specific provider to a running session
- Session-level provider override that takes precedence over the registry default provider
- A `provider_switched` notification emitted when a session's provider changes
- Bridge-level validation that the target provider is registered and healthy before switching

## Why

The existing `provider-registry` and `provider-interface` changes established the foundation for managing multiple LLM providers (registration, listing, health checks, default management). However, there is no mechanism to actually **use** a different provider at runtime. Currently, the `model` parameter on `session.start`/`session.resume` only controls the model identifier within the single hardcoded Anthropic adapter — it cannot route to a completely different provider (e.g., OpenAI, local model).

This change is the critical bridge between "having multiple providers configured" and "being able to use them." It unblocks the subsequent Milestone 08 changes (`token-tracking`, `quota-management`, `load-balancer`, `provider-fallback`) which all assume sessions can be associated with different providers.

## Scope

### In Scope

- **`provider.switch` bridge method** — accepts `{ sessionId, providerId }`, validates the target provider exists and is healthy, switches the session's active provider, emits notification
- **`session.setProvider` bridge method** — alias/primary API for setting a session's provider; validates session state (must be `idle`, `paused`, or `running`)
- **Session-level provider tracking** — extend session records with an `activeProviderId` field that overrides the registry default
- **`provider_switched` notification** — emitted on the session's event stream when provider changes, carrying `{ sessionId, previousProviderId, newProviderId, timestamp }`
- **Provider resolution logic** — when launching/resuming a query, resolve the effective provider from: session override > registry default > fallback to built-in Anthropic
- **Bridge routing updates** — wire `provider.switch` and `session.setProvider` into the JSON-RPC method handler in [bridge.ts](src/bridge.ts)
- **Unit tests** for the switching logic, notification emission, and error cases

### Out of Scope

- Automatic/fallback provider selection (that is `provider-fallback`)
- Load balancing across providers (that is `load-balancer`)
- Per-provider token accounting (that is `token-tracking`)
- Quota enforcement (that is `quota-management`)
- Provider-specific request normalization or translation layers
- Changing provider mid-stream during an in-flight query (switch takes effect on next query turn)

## Unchanged Behavior

- `provider.register`, `provider.list`, `provider.get`, `provider.update`, `provider.remove`, `provider.setDefault`, `provider.getDefault`, `provider.healthCheck` — all existing registry methods remain unchanged
- Sessions without an explicit `activeProviderId` continue to use the registry default provider (or built-in Anthropic fallback) as before
- The `model` parameter on `session.start`/`session.resume` continues to work as a model selector within whatever provider is active
- Sessions that are `completed` or `stopped` cannot have their provider switched (same as other state-transition restrictions)

# provider-switcher

## What

Formalize the provider switching specification and ensure complete, tested implementation for runtime LLM provider switching on active sessions. This includes: session-scoped provider assignment via `provider.switch`/`session.setProvider`, provider resolution with fallback chains (`resolveForSession`), health-gated switching, switch event notifications, and session-status reflection of the active provider.

## Why

The existing `provider-registry.md` spec covers CRUD operations for provider configurations but does not define the **runtime switching** behavior that is already implemented in `ProviderRegistry.switchSessionProvider()`, `ProviderRegistry.resolveForSession()`, and the bridge's `provider.switch`/`session.setProvider` JSON-RPC methods. Without explicit spec coverage:

- Switching behavior is undocumented — consumers cannot rely on guaranteed contracts
- Edge cases around session-state validation, health gating, and fallback chains lack spec-level definition
- Test coverage cannot be verified against an authoritative spec

This change closes that gap by adding spec requirements that match (and validate) the existing implementation.

## Scope

### In Scope
- Delta spec for provider switching scenarios under `llm-provider/provider-registry.md`
- Spec coverage for: `provider.switch`, `session.setProvider`, `resolveForSession` fallback chain, health-gated switches, switch notifications, session status reflection
- Implementation verification and any fixes needed to align code with new spec requirements
- Comprehensive tests for all specified switching scenarios

### Out of Scope
- New transport layers or protocols
- Multi-session batch switching
- Provider-level load balancing or auto-failover policies
- UI changes
- Modifications to existing provider registration/list/update/remove specs

## Unchanged Behavior

- `provider.register` — registration validation, duplicate rejection, persistence
- `provider.list` / `provider.get` — listing and retrieval with sensitive field masking
- `provider.update` — config merging and cache invalidation
- `provider.remove` — removal with default clearing
- `provider.setDefault` / `provider.getDefault` — default provider management
- `provider.healthCheck` — standalone health checks
- Session lifecycle (start, stop, pause, resume, cancel) — unaffected by provider switching
- ConfigStore persistence format for `llmProviders`

# Design: provider-switcher

## Approach

The provider switching feature is already implemented across three layers. This change **formalizes the spec** and ensures implementation completeness through targeted verification and gap-fixing.

### Architecture Layers

1. **ProviderRegistry** (`src/llm-provider/provider-registry.ts`)
   - `switchSessionProvider(sessionId, targetProviderId)` — validates target exists, checks health, returns switch result
   - `resolveForSession(sessionId)` — resolves LLM provider for a session using fallback chain: session activeProviderId → defaultProviderId → built-in Claude SDK
   - `setSessionGetter(getter)` — allows injecting session store dependency

2. **BridgeServer** (`src/bridge.ts`)
   - `provider.switch` JSON-RPC method — validates sessionId/providerId params, checks session exists and is in switchable state, delegates to registry, updates `session.activeProviderId`, emits `bridge/provider_switched` notification
   - `session.setProvider` JSON-RPC method — alias for `provider.switch`
   - Error mapping: NOT_FOUND → -32001, UNHEALTHY → -32004, other → -32603

3. **SessionStore** (`src/session-store.ts`)
   - `updateActiveProviderId(sessionId, activeProviderId)` — persists the active provider on a session
   - `activeProviderId` field reflected in `session.status` responses

### Switch Flow

```
Client → provider.switch({sessionId, providerId})
  → Validate params (sessionId string, providerId string)
  → Check session exists (-32011 if not)
  → Check session executionState is switchable (-32602 if not)
  → Registry.switchSessionProvider()
    → Check provider registered (NOT_FOUND)
    → Health check target provider (UNHEALTHY if unhealthy)
    → Return {success, sessionId, previousProviderId, newProviderId}
  → sessionStore.updateActiveProviderId(sessionId, providerId)
  → Emit bridge/provider_switched notification
  → Return result
```

### Resolution Fallback Chain

```
resolveForSession(sessionId):
  1. Session activeProviderId → if set, registered, and healthy → use it
  2. Default provider → if set, registered, and healthy → use it
  3. Built-in Claude SDK provider → always available as last resort
```

## Key Decisions

1. **Health-gated switching**: A switch only succeeds if the target provider passes its health check. This prevents routing sessions to broken providers.
2. **Switchable session states**: Only sessions in `idle`, `running`, `paused`, `waiting_for_input`, or `completed` states can be switched. Sessions in `error` state are blocked.
3. **Notification on switch**: Every successful switch emits `bridge/provider_switched` so clients can track provider changes reactively.
4. **Alias method**: `session.setProvider` exists as an alias for `provider.switch` for API ergonomics — both route to the same handler.
5. **Fallback to built-in**: When no registered provider is available/healthy, the system falls back to the Claude Agent SDK's built-in provider rather than failing.

## Alternatives Considered

1. **Eager vs lazy health checking**: Could check health at switch time only (current) or proactively monitor all providers. Chose lazy checking to avoid overhead when switches are infrequent.
2. **Switch history table**: Could maintain an auditable log of all switches per session. Rejected as out of scope — existing audit-log subsystem can be extended separately if needed.
3. **Synchronous switch**: Could make switch synchronous without health check. Rejected because switching to an unhealthy provider would cause silent failures downstream.

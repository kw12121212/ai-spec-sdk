# Design: event-webhooks

## Approach

1. **New module `src/webhooks.ts`** — Contains `WebhookManager` class responsible for:
   - Loading/saving webhook registrations from/to a JSON file on disk
   - Subscribing and unsubscribing webhook URLs
   - Listening to session events and delivering POST requests to registered URLs
   - HMAC-SHA256 signing of payloads
   - Retry logic with exponential backoff

2. **Integration with BridgeServer** — The webhook manager hooks into the existing session event emission via the `notify` callback pattern already used by SSE and WebSocket managers. When a session event is emitted, the webhook manager receives it and queues delivery.

3. **New RPC methods** — `webhook.subscribe` and `webhook.unsubscribe` registered in the existing RPC method dispatch table, requiring `admin` scope.

4. **Persistence** — Webhook registrations stored in a JSON file alongside the sessions directory. Loaded at startup, saved on subscribe/unsubscribe.

## Key Decisions

- **HMAC-SHA256 over asymmetric signatures** — HMAC is simpler, symmetric, and sufficient for webhook verification. The shared secret is generated once at bridge startup and exposed via the `webhook.subscribe` response so the consumer can verify signatures.
- **In-memory retry state** — Retry queues are not persisted. If the bridge restarts mid-retry, pending deliveries are lost. This avoids complexity and matches the in-memory metrics approach.
- **No external dependencies** — Uses Node.js built-in `crypto` for HMAC and `fetch` for HTTP delivery, consistent with the zero-external-dep pattern (metrics, rate limiting).
- **Admin scope for webhook management** — Webhook registration is a privileged operation; `admin` scope prevents unauthorized URL registration.

## Alternatives Considered

- **Webhook management via REST endpoints (POST/DELETE /webhooks)** — Rejected in favor of RPC methods to stay consistent with the existing JSON-RPC API surface. All other management operations use RPC.
- **Persistent retry queue** — Considered but rejected for scope. Adds significant complexity (disk queue, crash recovery) for a v1 feature. In-memory retry is sufficient.
- **Configurable event types per subscription** — Considered but out of scope per milestone definition (no webhook filtering). All subscribers receive all session lifecycle events.

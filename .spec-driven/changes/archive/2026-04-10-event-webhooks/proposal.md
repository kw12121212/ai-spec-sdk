# event-webhooks

## What

Add HMAC-signed HTTP webhook delivery for session lifecycle events. Clients can register webhook URLs that receive POST requests when session events fire (started, completed, stopped, interrupted). Delivery is retried up to 3 times with exponential backoff. Unregistration stops further delivery.

## Why

External integrations (CI/CD pipelines, monitoring dashboards, Slack notifications) need to react to session lifecycle events without polling. Webhooks are the standard pattern for push-based event delivery. This completes the "enable external integrations" goal of milestone 05-developer-ecosystem.

## Scope

**In scope:**
- RPC methods `webhook.subscribe` and `webhook.unsubscribe` for registering/removing webhook URLs
- HMAC-SHA256 signed POST delivery to registered URLs on session lifecycle events (`session_started`, `session_completed`, `session_stopped`, `session_interrupted`)
- Retry logic: up to 3 delivery attempts with exponential backoff (1s, 2s, 4s)
- Webhook registration persisted to disk (JSON file) so registrations survive bridge restarts
- In-memory only retry state (no external queue)
- `admin` scope required for subscribe/unsubscribe operations

**Out of scope:**
- Webhook filtering by session or workspace (per milestone definition)
- Webhook delivery to authenticated endpoints (no OAuth, no API keys for outbound)
- Webhook event batching
- Signature verification endpoint on the consumer side (consumer responsibility)

## Unchanged Behavior

Behaviors that must not change as a result of this change (leave blank if nothing is at risk):
- Existing session lifecycle event emission and SSE/WebSocket fan-out must remain unchanged
- Existing auth, rate limiting, and metrics behavior must not be affected
- Bridge startup and shutdown must not be blocked by webhook delivery

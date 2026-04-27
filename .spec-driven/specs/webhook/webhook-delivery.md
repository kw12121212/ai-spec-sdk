---
mapping:
  implementation:
    - src/webhooks.ts
    - src/http-server.ts
    - src/bridge.ts
  tests:
    - test/webhooks.test.ts
---
## ADDED Requirements

### Requirement: Webhook Subscribe
The bridge MUST expose a `webhook.subscribe` RPC method that registers a URL to receive session lifecycle event deliveries.

Parameters: `{ url: string }`.

The `url` MUST be a valid HTTPS or HTTP URL. The bridge MUST return a `-32602` error if the URL is invalid.

The method MUST require `admin` scope.

On success, the response MUST include `{ id: string, url: string, secret: string }`. The `secret` is a bridge-level HMAC key shared across all webhook registrations. The bridge generates one secret at startup; all subscriptions return the same secret.

#### Scenario: Subscribe to webhook deliveries
- GIVEN a client with `admin` scope
- WHEN the client calls `webhook.subscribe` with `{ url: "https://example.com/hook" }`
- THEN the bridge registers the URL and returns an `id`, the `url`, and a `secret`

#### Scenario: Subscribe requires admin scope
- GIVEN a client with `session:read` scope only
- WHEN the client calls `webhook.subscribe`
- THEN the bridge returns a `-32010` scope error

#### Scenario: Invalid URL is rejected
- GIVEN a client calls `webhook.subscribe` with `{ url: "not-a-url" }`
- WHEN the bridge validates the request
- THEN the bridge returns a `-32602` error

### Requirement: Webhook Unsubscribe
The bridge MUST expose a `webhook.unsubscribe` RPC method that removes a previously registered webhook.

Parameters: `{ id: string }`.

The method MUST require `admin` scope.

On success, the response MUST include `{ removed: true }`. If the webhook ID does not exist, the bridge MUST return a `-32011` error.

After unsubscription, no further deliveries are sent to that URL.

#### Scenario: Unsubscribe stops delivery
- GIVEN a webhook is registered
- WHEN the client calls `webhook.unsubscribe` with the webhook `id`
- THEN the bridge removes the registration and returns `{ removed: true }`
- AND no further deliveries are sent to that URL

#### Scenario: Unsubscribe unknown webhook returns error
- GIVEN no webhook exists with the given ID
- WHEN the client calls `webhook.unsubscribe`
- THEN the bridge returns a `-32011` error

### Requirement: HMAC-SHA256 Signed Delivery
The bridge MUST deliver an HTTP POST to each registered webhook URL when a session lifecycle event occurs (`session_started`, `session_completed`, `session_stopped`, `session_interrupted`) OR when a session asks a question (`session_question`).

The POST body MUST be a JSON object with: `{ event: string, sessionId: string, timestamp: string, data: object }`.

The bridge MUST include an `X-Webhook-Signature` header containing the HMAC-SHA256 hex digest of the body, computed using the bridge-level shared secret.

The `Content-Type` header MUST be `application/json`.

#### Scenario: Delivery includes HMAC signature
- GIVEN a webhook is registered with secret "abc123"
- WHEN a session completes
- THEN the bridge sends POST to the webhook URL with `X-Webhook-Signature` header
- AND the signature matches HMAC-SHA256 of the body using "abc123"

#### Scenario: Delivery payload structure
- GIVEN a webhook is registered
- WHEN a session completes with session ID "sess-1"
- THEN the POST body contains `{ event: "session_completed", sessionId: "sess-1", timestamp: "<ISO 8601>", data: { ... } }`

#### Scenario: Delivery payload for question events
- GIVEN a webhook is registered
- WHEN an agent asks a question in a session
- THEN the POST body contains `{ event: "session_question", sessionId: "<session-id>", timestamp: "<ISO 8601>", data: { question: "...", impact: "...", recommendation: "..." } }`

### Requirement: Delivery Retry
When a webhook delivery fails (non-2xx response or network error), the bridge MUST retry up to 3 times with exponential backoff (1s, 2s, 4s).

The bridge MUST NOT retry on successful delivery (2xx response).

Retry state MUST be kept in memory only. If the bridge restarts, pending retries are lost.

#### Scenario: Successful delivery is not retried
- GIVEN a webhook URL returns 200
- WHEN the bridge delivers an event
- THEN no retry is attempted

#### Scenario: Failed delivery is retried up to 3 times
- GIVEN a webhook URL returns 500
- WHEN the bridge delivers an event
- THEN the bridge retries up to 3 times with increasing delays

#### Scenario: All retries exhausted
- GIVEN a webhook URL consistently returns 500
- WHEN all 3 retries fail
- THEN the bridge stops retrying and logs the failure

### Requirement: Webhook Persistence
Webhook registrations MUST be persisted to a JSON file on disk. The storage location MUST be configurable. When the bridge starts, it MUST load existing registrations from disk.

When the bridge has no persisted registrations, it MUST start with an empty registration list.

#### Scenario: Registrations survive bridge restart
- GIVEN a webhook is registered and the bridge is restarted
- WHEN the new bridge process starts
- THEN the webhook registration is loaded from disk and deliveries resume

#### Scenario: No registrations file on first start
- GIVEN no webhook registrations file exists
- WHEN the bridge starts
- THEN the bridge initializes with an empty registration list

### Requirement: Non-blocking Delivery
Webhook delivery MUST NOT block session event emission to SSE and WebSocket subscribers. Delivery failures and retries MUST NOT affect the main request/response cycle.

#### Scenario: Slow webhook does not block SSE delivery
- GIVEN a webhook URL takes 5 seconds to respond
- WHEN a session event fires
- THEN SSE subscribers receive the event immediately
- AND the webhook delivery happens asynchronously

### Requirement: Webhook Methods in Capabilities
The `bridge.capabilities` response MUST include `webhook.subscribe` and `webhook.unsubscribe` in its supported methods list.

#### Scenario: Capabilities list includes webhook methods
- GIVEN the bridge is running
- WHEN a client calls `bridge.capabilities`
- THEN the response includes `webhook.subscribe` and `webhook.unsubscribe`

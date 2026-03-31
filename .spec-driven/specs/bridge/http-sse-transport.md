### Requirement: HTTP Transport Entrypoint
When started with `--transport http` (or `AI_SPEC_SDK_TRANSPORT=http`), the bridge MUST listen for HTTP connections on the configured port instead of reading from stdin/stdout. The default port is `8765` and MUST be overridable via `--port <n>` or `AI_SPEC_SDK_PORT`.

#### Scenario: Bridge starts in HTTP mode
- GIVEN the bridge is launched with `--transport http --port 8765`
- WHEN the process starts
- THEN it accepts HTTP connections on port 8765 and does not read from stdin

### Requirement: POST /rpc Endpoint
The bridge MUST expose a `POST /rpc` endpoint that accepts a JSON-RPC 2.0 request body and returns a JSON-RPC 2.0 response. The endpoint MUST require `Content-Type: application/json`. Requests with a body exceeding 10 MB MUST be rejected with HTTP 413. Malformed JSON MUST be rejected with a JSON-RPC `-32700` parse error response.

#### Scenario: Valid JSON-RPC request over HTTP
- GIVEN the bridge is running in HTTP mode
- WHEN a client sends `POST /rpc` with a valid JSON-RPC 2.0 body
- THEN the bridge returns a JSON-RPC 2.0 response with HTTP 200

#### Scenario: Body too large
- GIVEN a client sends `POST /rpc` with a body exceeding 10 MB
- WHEN the bridge reads the request
- THEN the bridge responds with HTTP 413

#### Scenario: Wrong Content-Type
- GIVEN a client sends `POST /rpc` without `Content-Type: application/json`
- WHEN the bridge validates the request
- THEN the bridge responds with HTTP 415

### Requirement: GET /events SSE Endpoint
The bridge MUST expose a `GET /events?sessionId=<id>` endpoint that streams `bridge/session_event` and other session-scoped notifications as Server-Sent Events. The `sessionId` query parameter is required; its absence MUST result in HTTP 400. Multiple clients MAY subscribe to the same `sessionId` (fan-out). Notifications that do not carry a `sessionId` MUST NOT be sent to any SSE connection.

#### Scenario: SSE stream delivers session-scoped notifications
- GIVEN a client is subscribed to `GET /events?sessionId=abc`
- WHEN the bridge emits a `bridge/session_event` notification with `sessionId: "abc"`
- THEN the notification is written to the SSE stream as an `event: session_event` / `data: <json>` pair

#### Scenario: Multiple subscribers receive the same notification
- GIVEN two clients are both subscribed to `GET /events?sessionId=abc`
- WHEN the bridge emits a session-scoped notification for session `abc`
- THEN both clients receive the notification

#### Scenario: Missing sessionId query param returns 400
- GIVEN a client calls `GET /events` without a `sessionId` query param
- WHEN the bridge validates the request
- THEN the bridge responds with HTTP 400

#### Scenario: Notification without sessionId is dropped
- GIVEN a notification is emitted that does not include a `sessionId` field
- WHEN the bridge processes the notification
- THEN no SSE connection receives the notification

### Requirement: GET /health Endpoint
The bridge MUST expose a `GET /health` endpoint that returns `{ status: "ok", apiVersion }` with HTTP 200 and `Content-Type: application/json`. This endpoint requires no authentication.

#### Scenario: Health check responds
- GIVEN the bridge is running in HTTP mode
- WHEN a client calls `GET /health`
- THEN the bridge returns HTTP 200 with `{ status: "ok", apiVersion: "<semver>" }`

### Requirement: CORS Support
The bridge MUST include CORS response headers on all HTTP responses. The allowed origins MUST be configurable via the `AI_SPEC_SDK_CORS_ORIGINS` environment variable. When the env var is unset the bridge MUST default to `Access-Control-Allow-Origin: *`. Preflight `OPTIONS` requests MUST receive HTTP 204 with the appropriate CORS headers.

#### Scenario: CORS headers present on RPC response
- GIVEN the bridge is running in HTTP mode
- WHEN a client sends `POST /rpc`
- THEN the response includes `Access-Control-Allow-Origin` and `Access-Control-Allow-Methods` headers

### Requirement: Graceful Shutdown
When the bridge process receives `SIGTERM` in HTTP mode, it MUST stop accepting new connections, wait for all in-flight `POST /rpc` requests to complete, then close all open SSE connections before exiting.

#### Scenario: In-flight request completes before shutdown
- GIVEN a `POST /rpc` request is being processed when `SIGTERM` is received
- WHEN the bridge handles the signal
- THEN the response is sent before the process exits

### Requirement: Transport Field in Capabilities
The `bridge.capabilities` response MUST include a `transport` field whose value is `"stdio"` when running in stdio mode and `"http"` when running in HTTP mode.

#### Scenario: HTTP mode reports transport in capabilities
- GIVEN the bridge is running in HTTP mode
- WHEN a client calls `bridge.capabilities` via `POST /rpc`
- THEN the response includes `transport: "http"`

### Requirement: Static UI File Serving
When the bridge is running in HTTP mode, it MUST serve `src/ui/index.html` for `GET /` requests. The file MUST be served with `Content-Type: text/html; charset=utf-8`.

This serving behavior MUST be controlled by the `AI_SPEC_SDK_UI_ENABLED` environment variable. When unset or set to any value other than `"false"`, the UI MUST be served. When set to `"false"`, `GET /` MUST return HTTP 404.

Requests for `GET /` MUST NOT require authentication (the UI itself is public; authentication happens when the UI makes API calls).

#### Scenario: UI file served at root path
- GIVEN the bridge is running in HTTP mode with UI enabled
- WHEN a client requests `GET /`
- THEN the bridge returns the content of `src/ui/index.html` with `Content-Type: text/html; charset=utf-8` and HTTP 200

#### Scenario: UI disabled via env var
- GIVEN `AI_SPEC_SDK_UI_ENABLED` is set to `"false"`
- WHEN a client requests `GET /`
- THEN the bridge returns HTTP 404

#### Scenario: UI path does not conflict with API
- GIVEN the bridge is serving the UI at `GET /`
- WHEN a client requests `POST /rpc`, `GET /events`, or `GET /health`
- THEN those endpoints continue to function normally without interference from the UI serving


### Requirement: SSE Delivery of Stream Chunks
When a client is subscribed to `GET /events?sessionId=<id>` for a session with streaming enabled, `stream_chunk` events MUST be delivered over the SSE connection using the same `event: session_event` / `data: <json>` format as other session events.

#### Scenario: Stream chunk delivered via SSE
- GIVEN a client is subscribed to SSE for a streaming session
- WHEN the bridge emits a `stream_chunk` event for that session
- THEN the event is written to the SSE stream as `event: session_event` / `data: {"sessionId":"...","type":"agent_message","messageType":"stream_chunk","content":"...","index":0}`

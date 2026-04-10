## ADDED Requirements

### Requirement: Prometheus Metrics Endpoint
When the bridge is running in HTTP mode, `GET /metrics` MUST return bridge runtime counters in Prometheus text exposition format (`text/plain; version=0.0.4; charset=utf-8`).

The response MUST include the following metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| `bridge_requests_total` | counter | `method`, `status` | Total JSON-RPC requests processed |
| `bridge_rpc_duration_seconds` | summary | `method` | RPC request duration in seconds (count + sum) |
| `bridge_tokens_consumed_total` | counter | — | Total tokens consumed across all sessions |
| `bridge_sessions_active` | gauge | — | Number of currently active sessions |
| `bridge_rate_limit_rejections_total` | counter | — | Total requests rejected by rate limiter |

Each metric MUST include a `# HELP` comment with a human-readable description and a `# TYPE` comment declaring its type (counter, gauge, or summary).

#### Scenario: GET /metrics returns valid Prometheus text
- GIVEN the bridge is running in HTTP mode with auth enabled
- WHEN a client sends `GET /metrics` with a key having `session:read` scope
- THEN the response has status 200
- AND the `Content-Type` header is `text/plain; version=0.0.4; charset=utf-8`
- AND the body contains `# HELP` and `# TYPE` comments for each declared metric
- AND each counter value line has the format `<metric_name>{<labels>} <value>`

#### Scenario: Request counter increments per RPC call
- GIVEN the bridge has processed 3 `session.start` requests returning status 200
- WHEN a client reads `GET /metrics`
- THEN the body contains a line matching `bridge_requests_total{method="session.start",status="200"} 3`

#### Scenario: Duration summary accumulates count and sum
- GIVEN the bridge has processed RPC requests
- WHEN a client reads `GET /metrics`
- THEN the body contains `bridge_rpc_duration_seconds_count` and `bridge_rpc_duration_seconds_sum` entries

#### Scenario: Active sessions gauge reflects current count
- GIVEN 2 sessions are active and 1 session has been stopped
- WHEN a client reads `GET /metrics`
- THEN `bridge_sessions_active` has value 2

### Requirement: Metrics Authentication
When the bridge is running with auth enabled, `GET /metrics` MUST require a valid API key with at least `session:read` scope. When the bridge is started with `--no-auth`, `GET /metrics` MUST be accessible without credentials.

#### Scenario: Authenticated metrics access
- GIVEN the bridge is running with auth enabled
- WHEN a client sends `GET /metrics` without a Bearer token
- THEN the response has status 401

#### Scenario: No-auth mode allows unauthenticated metrics
- GIVEN the bridge is started with `--no-auth`
- WHEN a client sends `GET /metrics` without credentials
- THEN the response has status 200

### Requirement: Metrics Exempt from Rate Limiting
`GET /metrics` MUST NOT be subject to rate limiting, consistent with other read-only GET endpoints.

#### Scenario: Metrics not rate limited
- GIVEN a key has exceeded its `POST /rpc` rate limit
- WHEN the client sends `GET /metrics` with that key
- THEN the response has status 200 (not 429)

### Requirement: In-Memory Metrics State
All metric counters and gauges MUST be stored in process memory only. Metric values MUST reset to zero when the bridge process restarts. No external storage dependency is introduced.

### Requirement: Tokens Consumed Counter
When a session completes with token usage data available in the session result, the bridge MUST increment `bridge_tokens_consumed_total` by the reported token count.

#### Scenario: Token counter increments on session completion
- GIVEN a session completes with a result containing 1500 tokens consumed
- WHEN a client reads `GET /metrics`
- THEN `bridge_tokens_consumed_total` reflects the accumulated token count

### Requirement: Rate Limit Rejection Counter
When a `POST /rpc` request is rejected with HTTP 429 due to rate limiting, the bridge MUST increment `bridge_rate_limit_rejections_total`.

#### Scenario: Rejection counter increments on 429
- GIVEN a key has exceeded its rate limit and receives a 429 response
- WHEN a client reads `GET /metrics`
- THEN `bridge_rate_limit_rejections_total` has value at least 1

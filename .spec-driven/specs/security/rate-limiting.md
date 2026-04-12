---
mapping:
  implementation:
    - src/rate-limiter.ts
    - src/http-server.ts
    - src/auth.ts
  tests:
    - test/rate-limiter.test.ts
    - test/auth.test.ts
---
### Requirement: Per-Key Token Bucket Rate Limiting
When the bridge is running in HTTP mode with auth enabled, each `POST /rpc` request authenticated with a non-`admin` API key MUST be subject to per-key rate limiting using a token bucket algorithm. The default limit is 120 requests per minute per key. Keys with scope `admin` MUST bypass all rate limit checks. When the bridge is started with `--no-auth`, rate limiting MUST be disabled entirely. Public methods that remain callable without credentials MUST continue to work without requiring a key.

#### Scenario: Request within rate limit is allowed
- GIVEN a key has sent fewer than 120 requests in the current minute window
- WHEN the client sends another `POST /rpc` with that key
- THEN the request is dispatched normally

#### Scenario: Request exceeding rate limit is rejected
- GIVEN a key has already consumed its full token allowance of 120 requests within the current window
- WHEN the client sends another `POST /rpc` with that key
- THEN the bridge responds with HTTP 429, a JSON-RPC error body with code `-32029` and message `"Rate limit exceeded"`, and `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` response headers

#### Scenario: Admin key bypasses rate limiting
- GIVEN a key has scope `admin` and has sent more than 120 requests
- WHEN the client sends another `POST /rpc` with that key
- THEN the request is dispatched normally without a 429 response

#### Scenario: No-auth mode disables rate limiting
- GIVEN the bridge is started with `--no-auth`
- WHEN any client sends more than 120 `POST /rpc` requests
- THEN no 429 response is returned

#### Scenario: Public method remains callable without credentials
- GIVEN auth is enabled
- WHEN a client calls a public method such as `bridge.capabilities` without an API key
- THEN the bridge returns the normal response and does not require authentication for that request

### Requirement: Rate Limit Response Headers
When a `POST /rpc` request is rejected due to rate limiting, the response MUST include:
- `X-RateLimit-Limit`: the maximum number of requests allowed per minute (120)
- `X-RateLimit-Remaining`: the number of requests remaining in the current window (0 when rejected)
- `X-RateLimit-Reset`: the Unix timestamp in seconds when the next token becomes available

Successful `POST /rpc` requests that were checked against the rate limiter MUST include `X-RateLimit-Limit` and `X-RateLimit-Remaining` response headers.

#### Scenario: Successful rate-limited request includes quota headers
- GIVEN a non-`admin` key sends a `POST /rpc` request within its quota
- WHEN the bridge dispatches the request normally
- THEN the response includes `X-RateLimit-Limit` and `X-RateLimit-Remaining` headers

### Requirement: SSE and Non-RPC Endpoints Exempt
`GET /events`, `GET /health`, `GET /`, and `OPTIONS` preflight requests MUST NOT be subject to rate limiting.

#### Scenario: SSE connection not rate limited
- GIVEN a key has exceeded its `POST /rpc` rate limit
- WHEN the client opens a `GET /events` SSE connection
- THEN the connection is accepted normally without HTTP 429

### Requirement: In-Memory Rate Limit State
Rate limit state MUST be stored in process memory only. Rate limit counters MUST reset when the bridge process restarts. No external storage dependency is introduced.

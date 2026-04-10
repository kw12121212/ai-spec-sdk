# Design: opentelemetry-metrics

## Approach

Introduce a `MetricsCollector` class in `src/metrics.ts` that maintains in-memory counters and gauges. The HTTP server's fetch handler adds a `GET /metrics` route that calls `metricsCollector.render()` to produce Prometheus text output.

The collector is instantiated alongside the rate limiter and logger when the HTTP server starts. Key integration points:

1. **RPC dispatch** — after each `POST /rpc` completes, increment `bridge_requests_total{method,status}` and observe duration into `bridge_rpc_duration_seconds{method}`
2. **Token tracking** — after a session completes with token usage, increment `bridge_tokens_consumed_total`
3. **Session lifecycle** — increment/decrement `bridge_sessions_active` gauge on session start/stop
4. **Rate limiting** — increment `bridge_rate_limit_rejections_total` when a 429 is returned

The `render()` method produces standard Prometheus text exposition format with `TYPE` and `HELP` annotations. No external dependencies.

## Key Decisions

1. **No OpenTelemetry SDK** — the milestone scope is Prometheus text format only; adding the OTel SDK would introduce a large dependency for a single-format use case. Hand-rolling the text format keeps the bundle small and matches the approach called out in the milestone risks section.

2. **Auth requirement for /metrics** — metrics expose operational data (request rates, token counts) that could reveal usage patterns. Requiring `session:read` scope when auth is enabled keeps them protected. When `--no-auth` is used, metrics are publicly accessible like all other endpoints.

3. **Method and status labels only** — limiting labels to `method` (JSON-RPC method name) and `status` (HTTP status code string) keeps cardinality bounded. Session IDs, API key IDs, and other high-cardinality values are excluded to prevent metric explosion.

4. **Gauge for active sessions** — `bridge_sessions_active` uses a gauge (not counter) because it goes up and down. The session store already tracks active sessions; the gauge reflects the current count at render time.

5. **Duration as a simple summary** — `bridge_rpc_duration_seconds` accumulates count and sum to allow average computation, avoiding histogram bucket complexity while still providing useful latency data.

## Alternatives Considered

- **`prom-client` npm package** — adds a dependency for trivial text formatting; rejected to keep the runtime dependency-free for this feature, matching the milestone risk note about hand-rolled format.
- **OTLP export alongside Prometheus** — out of scope per milestone; can be added later without changing the collector interface.
- **Metrics on stdio transport** — stdio is a single-process, single-client pipe; metrics scraping doesn't apply. HTTP-only is the right boundary.
- **Unauthenticated /metrics always** — would leak operational data in production; the `session:read` scope requirement is a reasonable middle ground.

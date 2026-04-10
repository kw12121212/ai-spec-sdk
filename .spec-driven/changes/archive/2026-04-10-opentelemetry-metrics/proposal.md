# opentelemetry-metrics

## What

Expose a `GET /metrics` endpoint on the HTTP transport that returns bridge runtime counters in Prometheus text exposition format. Counters track request throughput, token consumption, active sessions, and rate-limit rejections.

## Why

Milestone 05 (Developer Ecosystem) requires completing the production observability story. Structured logging covers event-level debugging; runtime diagnostics cover ad-hoc health checks. Metrics fill the gap for continuous quantitative monitoring — operators and Prometheus scrapers need a machine-readable endpoint that tracks request rates, token usage, and session concurrency over time.

## Scope

- New `GET /metrics` endpoint returning Prometheus text format (`text/plain; version=0.0.4; charset=utf-8`)
- Counters: `bridge_requests_total`, `bridge_rpc_duration_seconds`, `bridge_tokens_consumed_total`, `bridge_sessions_active`, `bridge_rate_limit_rejections_total`
- Metrics are unauthenticated when `--no-auth` is used; otherwise require at least `session:read` scope
- In-memory counter state, reset on process restart (no external storage)
- New source module `src/metrics.ts` with a `MetricsCollector` class
- Tests using `node:test` and `node:assert/strict`

### Out of Scope

- OpenTelemetry SDK dependency or OTLP export
- Histograms or summary metric types (counters and gauges only)
- Custom/user-defined metrics
- Labels beyond `method` and `status` on request counters
- Metrics for WebSocket transport (HTTP only)
- Log shipping to an OpenTelemetry collector

## Unchanged Behavior

- Existing `GET /health`, `GET /events`, `POST /rpc`, and `GET /` endpoints unchanged
- Structured logging output and log levels unchanged
- Rate-limiting behavior and headers unchanged
- Session lifecycle and persistence unchanged
- Auth scope assignments for existing methods unchanged

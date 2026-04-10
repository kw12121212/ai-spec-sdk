# Tasks: opentelemetry-metrics

## Implementation

- [x] Create `src/metrics.ts` with `MetricsCollector` class: counters, gauges, and `render()` producing Prometheus text format
- [x] Add `# HELP` and `# TYPE` annotations for all five metrics in `render()` output
- [x] Integrate `MetricsCollector` instantiation into `src/http-server.ts` alongside rate limiter and logger
- [x] Add `GET /metrics` route in HTTP fetch handler with auth check (`session:read` scope when auth enabled, open when `--no-auth`)
- [x] Exempt `GET /metrics` from rate limiting (add to exempt path list alongside `/events`, `/health`)
- [x] Increment `bridge_requests_total{method,status}` after each `POST /rpc` dispatch
- [x] Accumulate `bridge_rpc_duration_seconds{method}` count and sum around RPC dispatch
- [x] Increment `bridge_tokens_consumed_total` on session completion when token data is available
- [x] Track `bridge_sessions_active` gauge: increment on session start, decrement on session stop/complete
- [x] Increment `bridge_rate_limit_rejections_total` when returning HTTP 429

## Testing

- [x] Run `bun run lint` — typecheck passes with no new errors
- [x] Run `bun test` — all existing and new tests pass
- [x] Unit test: `GET /metrics` returns 200 with correct `Content-Type` and Prometheus text body
- [x] Test: `GET /metrics` returns 200 with correct `Content-Type` and Prometheus text body
- [x] Test: `bridge_requests_total` increments per RPC call with correct method and status labels
- [x] Test: `bridge_rpc_duration_seconds` includes `_count` and `_sum` lines after RPC calls
- [x] Test: `bridge_sessions_active` reflects active session count after start and stop
- [x] Test: `bridge_tokens_consumed_total` increments on session completion with token data
- [x] Test: `bridge_rate_limit_rejections_total` increments on 429 response
- [x] Test: `GET /metrics` returns 401 when auth enabled and no token provided
- [x] Test: `GET /metrics` returns 200 without auth in `--no-auth` mode
- [x] Test: `GET /metrics` is exempt from rate limiting (not rejected with 429)

## Verification

- [x] Verify all delta spec requirements have corresponding test coverage
- [x] Verify no existing tests are broken
- [x] Verify `GET /metrics` output parses as valid Prometheus text exposition format
- [x] Verify metrics reset to zero on process restart

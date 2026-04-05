# Developer Ecosystem

## Goal
Complete the production observability story, enable external integrations via webhooks, add session configuration reuse, and deliver a JVM reference implementation.

## In Scope
- Prometheus metrics at GET /metrics (bridge_requests_total, bridge_tokens_consumed, etc.)
- HMAC-signed HTTP webhook delivery for session lifecycle events with retry
- Save and reuse named session configurations (templates)
## Out of Scope
- Log shipping to OpenTelemetry collector
- Distributed tracing across multiple bridges
- Webhook filtering by session or workspace
## Done Criteria
- GET /metrics returns valid Prometheus text format; counters increment correctly per request
- Webhook delivers HMAC-signed POST within 3 retry attempts; unsubscribe stops delivery
- session.start accepts template param; explicit params override template defaults

## Planned Changes
- `opentelemetry-metrics` - Prometheus metrics at GET /metrics
- `event-webhooks` - HMAC-signed HTTP webhook delivery with retry
- `session-templates` - save and reuse session configurations

## Dependencies
- 02-production-ready — metrics and webhooks require HTTP transport and auth; session-templates requires session persistence

## Risks
- Prometheus format is hand-rolled (no external dep); correctness must be validated against a real scraper.

## Status
- Declared: proposed

## Notes
java-cli-demo moved to 06-v1-stable.

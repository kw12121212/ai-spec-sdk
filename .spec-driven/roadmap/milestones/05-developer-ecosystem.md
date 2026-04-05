# Developer Ecosystem

## Goal
Complete the production observability story, enable external integrations via webhooks, add session configuration reuse, and deliver a JVM reference implementation.

## In Scope
- Prometheus metrics at GET /metrics (bridge_requests_total, bridge_tokens_consumed, etc.)
- HMAC-signed HTTP webhook delivery for session lifecycle events with retry
- Save and reuse named session configurations (templates)
- Java CLI REPL reference implementation matching go-cli feature parity

## Out of Scope
- Log shipping to OpenTelemetry collector
- Distributed tracing across multiple bridges
- Webhook filtering by session or workspace
- Kotlin/Scala CLI variants
- Gradle build for java-cli-demo (Maven only)

## Done Criteria
- GET /metrics returns valid Prometheus text format; counters increment correctly per request
- Webhook delivers HMAC-signed POST within 3 retry attempts; unsubscribe stops delivery
- session.start accepts template param; explicit params override template defaults
- Java CLI compiles with Maven 3+ and connects to bridge subprocess via stdio

## Planned Changes
- `opentelemetry-metrics` - Prometheus metrics at GET /metrics
- `event-webhooks` - HMAC-signed HTTP webhook delivery with retry
- `session-templates` - save and reuse session configurations
- `java-cli-demo` - Java CLI REPL reference implementation

## Dependencies
- 02-production-ready — metrics and webhooks require HTTP transport and auth; session-templates requires session persistence
- 03-platform-reach — java-cli-demo benefits from stable published artifacts

## Risks
- Prometheus format is hand-rolled (no external dep); correctness must be validated against a real scraper.
- java-cli-demo is P2 and can be deferred without blocking the other three items.

## Status
- Declared: proposed

## Notes
java-cli-demo is the lowest-priority item in this milestone; the three integration items (metrics, webhooks, templates) are higher priority and can ship independently.

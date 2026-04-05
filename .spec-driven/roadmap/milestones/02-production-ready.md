# Production Ready

## Goal
Add production-grade infrastructure — structured logging, HTTP/SSE transport, authentication, mobile web UI, and official client SDKs — bringing the bridge from local prototype to deployable service.

## In Scope
- Structured JSON logging with env-configurable level
- HTTP/SSE transport (POST /rpc, GET /events, GET /health)
- API key authentication with scope-based authorization
- Mobile-first web UI served at GET /
- TypeScript client SDK (@ai-spec-sdk/client npm package)

## Out of Scope
- WebSocket transport (see 04-advanced-runtime)
- Rate limiting (see 03-platform-reach)
- OpenTelemetry / Prometheus metrics (see 05-developer-ecosystem)

## Done Criteria
- Bridge logs structured JSON to stderr with level filtering
- HTTP mode starts with --transport http and serves all three endpoints
- API key lifecycle (keygen, list, revoke) fully operational
- Mobile web UI reachable at GET / from any browser
- TypeScript client package installable and tested against real bridge

## Planned Changes
- `structured-logging` - structured JSON logging with level filtering
- `http-sse-transport` - POST /rpc, GET /events, and GET /health endpoints
- `auth-and-authorization` - API key auth with scope-based authorization
- `mobile-web-ui` - mobile-first web UI served at GET /
- `ts-client-sdk` - @ai-spec-sdk/client TypeScript npm package

## Dependencies
- 01-bridge-foundation — HTTP/SSE and auth build on the core bridge

## Risks
None — all planned changes are archived.

## Status
- Declared: complete

## Notes
Additional archived changes not listed above: api-versioning (bridge.negotiateVersion), session-persistence (file-based crash recovery), improve-onboarding-and-diagnostics (doctor CLI, bridge.info), sync-spec-driven-interfaces, python-client-sdk (ai-spec-sdk PyPI package), streaming-token-output (bridge/stream_chunk).

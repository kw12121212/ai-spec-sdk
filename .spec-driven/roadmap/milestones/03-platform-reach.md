# Platform Reach

## Goal
Make the bridge distributable and production-safe: native binaries for all platforms, per-key HTTP rate limiting, and workspace-scoped custom tool registration.

## In Scope
- Multi-platform native binary builds via CI (linux-x64, linux-arm64, macos-x64, macos-arm64, windows-x64)
- Per-API-key token bucket rate limiting for HTTP transport
- Workspace-scoped custom tool registration (shell-command tools)

## Out of Scope
- WebSocket transport (see 04-advanced-runtime)
- OAuth2 / external identity providers
- Remote tool endpoints (HTTP callback tools)
- Tool sandboxing beyond process isolation

## Done Criteria
- GitHub Release contains binaries for all 5 target platforms with SHA-256 checksums
- HTTP requests return 429 with X-RateLimit-* headers when limit exceeded; admin scope bypasses limits
- tools.register and tools.unregister methods callable; custom tools appear in tools.list and work in sessions

## Planned Changes
- `cross-platform-release` - native binaries for all platforms via CI
- `rate-limiting` - per-key token bucket rate limiting for HTTP transport
- `custom-tool-registration` - workspace-scoped shell-command custom tools
- `sdk-publish-workflow` - automated npm and PyPI publish for client SDKs

## Dependencies
- 02-production-ready — rate-limiting requires auth-and-authorization; custom-tool-registration requires session persistence

## Risks
- Cross-platform bun compile requires platform-specific CI runners; Windows support may need extra validation.

## Status
- Declared: proposed

## Notes

# Platform Reach

## Goal
Make the bridge distributable and production-safe: native binaries for all platforms, per-key HTTP rate limiting, and workspace-scoped custom tool registration.

## In Scope
- Multi-platform native binary builds via CI (linux-x64, linux-arm64, macos-x64, macos-arm64, windows-x64)
- Local SDK packaging: `npm pack` for TypeScript client, `python -m build` for Python client
- Per-API-key token bucket rate limiting for HTTP transport
- Workspace-scoped custom tool registration (shell-command tools)

## Out of Scope
- WebSocket transport (see 04-advanced-runtime)
- OAuth2 / external identity providers
- Remote tool endpoints (HTTP callback tools)
- Tool sandboxing beyond process isolation

## Done Criteria
- Native binaries build successfully for all 5 target platforms with SHA-256 checksums
- `bun run build:pack` produces `.tgz` and `.whl` artifacts ready for manual distribution
- HTTP requests return 429 with X-RateLimit-* headers when limit exceeded; admin scope bypasses limits
- tools.register and tools.unregister methods callable; custom tools appear in tools.list and work in sessions

## Planned Changes
- `cross-platform-release` - Declared: complete - native binaries for all platforms plus local SDK pack scripts
- `rate-limiting` - Declared: planned - per-key token bucket rate limiting for HTTP transport
- `custom-tool-registration` - Declared: planned - workspace-scoped shell-command custom tools

## Dependencies
- 02-production-ready — rate-limiting requires auth-and-authorization; custom-tool-registration requires session persistence

## Risks
- Cross-platform bun compile requires platform-specific CI runners; Windows support may need extra validation.

## Status
- Declared: active

## Notes
SDK 分发方式：本地打包，人工复制。TypeScript 用 `npm pack` 生成 `.tgz`，Python 用 `python -m build` 生成 `.whl`，消费方通过 `npm install ./file.tgz` 或 `pip install ./file.whl` 安装。不使用任何注册中心。

# Tasks: improve-onboarding-and-diagnostics

## Implementation

- [x] Add a shared runtime-info/diagnostics helper that resolves version, transport, auth mode, sessions path, keys path, spec-driven script path, log level, and HTTP settings
- [x] Implement `bridge.info` in `src/bridge.ts` and advertise it from `src/capabilities.ts`
- [x] Update `bridge.capabilities.methods` to include all callable methods, including `session.export`, `session.delete`, `session.cleanup`, and `bridge.info`
- [x] Implement `ai-spec-bridge doctor` with human-readable default output and `--json` output
- [x] Implement `ai-spec-bridge --help` without starting stdio or HTTP transport
- [x] Update `docs/bridge-contract.yaml` so it matches the public method surface, auth requirements, startup modes, env vars, notifications, and diagnostics commands
- [x] Update `README.md` with onboarding guidance for stdio, HTTP, auth, discovery, and diagnostics
- [x] Bump `package.json` version to `0.2.0`

## Testing

- [x] Lint passes (`bun run lint`)
- [x] Unit tests pass (`bun run test`)
- [x] Build passes (`bun run build`)
- [x] Add unit tests for `bridge.info` response shape and capability advertisement
- [x] Add HTTP auth tests covering `bridge.info` authorization behavior
- [x] Add CLI tests for `ai-spec-bridge --help`, `doctor`, and `doctor --json`
- [x] Add regression coverage that package version and bridge version remain aligned

## Verification

- [x] Verify `README.md` onboarding steps match the implemented CLI and transport behavior
- [x] Verify `docs/bridge-contract.yaml` covers every method advertised by `bridge.capabilities.methods`
- [x] Verify `doctor --json` and `bridge.info` report the same core runtime metadata
- [x] Verify `package.json` version, `bridgeVersion`, and `apiVersion` are all `0.2.0`

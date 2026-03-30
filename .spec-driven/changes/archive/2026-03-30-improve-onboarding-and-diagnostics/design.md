# Design: improve-onboarding-and-diagnostics

## Approach

1. Add a shared runtime-info builder that resolves the bridge's current version, transport, auth mode, sessions directory, keys file, spec-driven script path, log level, and HTTP settings when applicable.

2. Expose that information through two entrypoints:
- `bridge.info` for programmatic callers over JSON-RPC
- `ai-spec-bridge doctor` for human operators, with `--json` returning the same core data plus diagnostic checks

3. Add CLI help output that documents the supported commands without starting the bridge transport.

4. Update the capabilities surface and contract docs together so the machine-readable method list, README onboarding instructions, and `docs/bridge-contract.yaml` all describe the same public API.

5. Align the published package version with `BRIDGE_VERSION` / `API_VERSION` so release metadata, runtime responses, and documentation all report `0.2.0` consistently.

## Key Decisions

- **Implement both `bridge.info` and `doctor`**: `bridge.info` gives integrators a machine-readable discovery method, while `doctor` gives operators a local human-readable workflow and a scriptable `--json` mode.
- **Keep diagnostics read-only**: the new entrypoints describe the current runtime state and simple health checks, but they do not create keys, rewrite config, or mutate sessions.
- **Require auth for `bridge.info` over authenticated HTTP**: the method exposes local runtime metadata such as resolved filesystem paths, so it should follow the admin scope path rather than being treated as a public discovery endpoint.
- **Use one runtime-info shape for all entrypoints**: `bridge.info` and `doctor --json` should share the same resolved metadata fields so docs and tests can describe one contract.
- **Treat docs alignment as a product change, not cleanup**: the README and contract file are user-facing parts of the bridge surface, so they are updated as first-class deliverables alongside the code.

## Alternatives Considered

- **Only add `doctor` and skip `bridge.info`**: rejected because integrators still need a programmatic way to inspect a running bridge.
- **Make `bridge.info` public over authenticated HTTP**: rejected because the response includes host-local runtime metadata that is better protected by existing admin auth.
- **Only update docs and skip runtime diagnostics**: rejected because users would still have no built-in way to confirm how a specific process is configured.
- **Fold diagnostics into `bridge.capabilities`**: rejected because capabilities are about supported features, while diagnostics are about one concrete running instance and its resolved environment.

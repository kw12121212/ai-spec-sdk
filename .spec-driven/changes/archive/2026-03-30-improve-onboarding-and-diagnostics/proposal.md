# Proposal: Improve Onboarding and Diagnostics

## What

Improve the user-facing integration surface so new consumers can trust the docs, discover the full public contract, and inspect a running bridge without reverse-engineering its environment.

This change will:
- Align `README.md` and `docs/bridge-contract.yaml` with the bridge's actual public methods, startup modes, auth behavior, and environment variables
- Add a `bridge.info` JSON-RPC method that returns resolved runtime metadata for the current bridge process
- Add an `ai-spec-bridge doctor` CLI command for human-readable diagnostics, plus `--json` output for automation
- Add `ai-spec-bridge --help` output that documents transport modes, auth flags, key-management commands, and diagnostics entrypoints
- Bump the package version to `0.2.0` so package metadata matches the bridge and API version already reported at runtime

## Why

The bridge has grown beyond the minimal methods listed in the README, and the machine-readable contract does not fully match the current runtime surface. From an integrator's perspective this creates two problems:

- The first-run path is incomplete, so users still have to inspect source code to learn how to start the bridge, authenticate HTTP requests, or subscribe to notifications
- There is no built-in way to ask a running bridge which transport, paths, auth mode, or script resolution it is using, which makes setup and support work slower than necessary

This change makes the bridge easier to adopt and safer to integrate by turning the current implicit behavior into explicit user-facing documentation and read-only diagnostics.

## Scope

- Update `README.md` with working onboarding guidance for stdio mode, HTTP mode, auth/no-auth behavior, discovery methods, and diagnostics commands
- Update `docs/bridge-contract.yaml` so it covers every public method advertised by `bridge.capabilities`, along with startup behavior, env vars, notifications, error codes, and auth requirements
- Update `bridge.capabilities.methods` so it accurately reflects all callable methods in the current bridge, including `session.export`, `session.delete`, `session.cleanup`, and `bridge.info`
- Implement `bridge.info` as a read-only runtime metadata method
- Implement `ai-spec-bridge doctor` and `ai-spec-bridge doctor --json`
- Implement `ai-spec-bridge --help`
- Bump `package.json` version to `0.2.0`

## Out of Scope

- Adding a first-party TypeScript client SDK
- Adding new transport modes or new session/workflow primitives
- Adding a Java CLI demo or other polyglot examples
- Making diagnostics mutate configuration or attempt repair actions automatically

## Unchanged Behavior

- Existing JSON-RPC request/response semantics remain unchanged
- Existing session, workflow, auth, and notification behavior remain unchanged except for more accurate capability and contract reporting
- `bridge.info` and `doctor` are read-only; they do not modify sessions, keys, workspaces, or config

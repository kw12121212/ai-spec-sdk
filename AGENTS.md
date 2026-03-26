# AGENTS

## Project overview

`ai-spec-sdk` provides a local JSON-RPC 2.0 over stdio bridge that packages Claude Agent SDK session orchestration with spec-driven workflows for external tool integration.

## Development workflow

- Use `bun` as the default package manager (`packageManager` is set in `package.json`).
- Run `bun run lint` before submitting changes.
- Run `bun run test` and keep tests deterministic and isolated.

## Architecture notes

- `src/cli.js` is the stdio entrypoint.
- `src/bridge.js` routes JSON-RPC methods and emits notifications.
- `src/workflow.js` executes spec-driven workflow scripts in a workspace.
- `src/claude-agent-runner.js` integrates with Claude Agent SDK query streaming.
- `src/session-store.js` owns in-memory session lifecycle state.

## Implementation rules

- Keep external behavior aligned with `.spec-driven/changes/.../specs/` requirements.
- Return structured JSON-RPC errors for boundary/input failures.
- Preserve workspace-scoped execution; do not introduce hidden global workspace assumptions.
- Avoid adding network transports (HTTP) unless explicitly scoped by a new spec-driven change.

## Testing guidance

- Add or update tests in `test/` for every behavior change.
- Prefer behavior-focused tests over implementation-detail assertions.
- Cover both success and failure paths for JSON-RPC methods and workflow/session operations.

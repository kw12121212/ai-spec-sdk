# AGENTS

## Project overview

`ai-spec-sdk` provides a local JSON-RPC 2.0 over stdio bridge that packages Claude Agent SDK session orchestration with spec-driven workflows for external tool integration.

## Development workflow

- Use `bun` as the default package manager (`packageManager` is set in `package.json`).
- Run `bun run lint` before submitting changes (runs `tsc --noEmit`).
- Run `bun run test` and keep tests deterministic and isolated.
- Run `bun run build` to compile TypeScript to `dist/`.

## Language and tooling

- All source files are TypeScript: `src/*.ts`. Do not add `.js` source files.
- All test files are TypeScript: `test/*.ts`.
- Compiled output goes to `dist/` via `tsc` (NodeNext module resolution, strict mode).
- `@anthropic-ai/claude-agent-sdk` is a **required** dependency — import it statically.
- Tests inject a stub query function via `globalThis.__AI_SPEC_SDK_QUERY__` to avoid real API calls; always clean up the stub after each test.

## Architecture notes

- `src/cli.ts` is the stdio entrypoint.
- `src/bridge.ts` routes JSON-RPC methods and emits notifications.
- `src/workflow.ts` executes spec-driven workflow scripts in a workspace.
- `src/claude-agent-runner.ts` integrates with Claude Agent SDK query streaming.
- `src/session-store.ts` owns in-memory session lifecycle state.

## Implementation rules

- Keep external behavior aligned with `.spec-driven/specs/` requirements.
- Return structured JSON-RPC errors for boundary/input failures.
- Preserve workspace-scoped execution; do not introduce hidden global workspace assumptions.
- Avoid adding network transports (HTTP) unless explicitly scoped by a new spec-driven change.

## Testing guidance

- Add or update tests in `test/` for every behavior change.
- Prefer behavior-focused tests over implementation-detail assertions.
- Cover both success and failure paths for JSON-RPC methods and workflow/session operations.

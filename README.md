# ai-spec-sdk

Polyglot local SDK bridge for Claude Agent SDK and spec-driven workflows.

## What it provides

- JSON-RPC 2.0 over stdio transport for tool integration
- Workflow execution for supported spec-driven commands
- Claude agent session lifecycle APIs (start, resume, stop, status)
- Structured progress/session notifications
- Built-in spec-driven skills discovery metadata

## Install and run

```bash
bun install
bun run build
bun run start
```

Or run the bridge directly from compiled output:

```bash
node dist/src/cli.js
```

## Development

```bash
bun run lint    # tsc --noEmit (type-check)
bun run test    # run test suite
bun run build   # compile to dist/
```

## JSON-RPC methods

- `bridge.capabilities`
- `workflow.run`
- `skills.list`
- `session.start`
- `session.resume`
- `session.stop`
- `session.status`

See `docs/bridge-contract.yaml` for the full integration contract (all methods, params, result shapes, error codes, notifications, and environment variables).

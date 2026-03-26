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
bun run start
```

You can also run the bridge process directly:

```bash
bun src/cli.js
```

## JSON-RPC methods

- `bridge.capabilities`
- `workflow.run`
- `skills.list`
- `session.start`
- `session.resume`
- `session.stop`
- `session.status`

See `docs/bridge-contract.md` for request/response examples.

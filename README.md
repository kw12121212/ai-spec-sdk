# ai-spec-sdk

Polyglot local SDK bridge for Claude Agent SDK and spec-driven workflows.

## What it provides

- JSON-RPC 2.0 over stdio or HTTP/SSE transport for tool integration
- Workflow execution for supported spec-driven commands
- Claude agent session lifecycle APIs (start, resume, stop, status, export, delete)
- Structured progress/session notifications
- Built-in spec-driven skills discovery metadata
- Runtime diagnostics via `bridge.info` RPC method and `doctor` CLI command

## Install and run

```bash
bun install
bun run build
```

### stdio transport (default)

```bash
node dist/src/cli.js
```

The bridge listens on stdin and writes JSON-RPC responses to stdout. Start one JSON object per line.

### HTTP/SSE transport

```bash
node dist/src/cli.js --transport http --port 8765
```

HTTP mode serves `POST /rpc` for requests and `GET /events?sessionId=<id>` for server-sent events. API key authentication is enabled by default in HTTP mode.

### Disable authentication (development only)

```bash
node dist/src/cli.js --transport http --no-auth
```

## API discovery

Once the bridge is running in stdio mode, send:

```json
{"jsonrpc":"2.0","id":1,"method":"bridge.capabilities"}
```

The response lists every callable method, supported models, tools, workflows, and notification types.

## Authentication (HTTP mode)

Generate an API key:

```bash
node dist/src/cli.js keygen --name mykey --scopes session:read,session:write,workflow:run
```

List keys:

```bash
node dist/src/cli.js keys list
```

Revoke a key:

```bash
node dist/src/cli.js keys revoke <id>
```

Use the token in requests:

```
Authorization: Bearer <token>
```

Available scopes: `session:read`, `session:write`, `workflow:run`, `config:read`, `config:write`, `admin`.

## Diagnostics

Check runtime health:

```bash
node dist/src/cli.js doctor
```

Machine-readable output:

```bash
node dist/src/cli.js doctor --json
```

The `doctor` command reports bridge version, transport, auth mode, paths, and per-check pass/fail status. It exits with code 0 when all checks pass, 1 when any check fails.

You can also retrieve runtime info from a running bridge via JSON-RPC (requires `admin` scope in HTTP auth mode):

```json
{"jsonrpc":"2.0","id":1,"method":"bridge.info"}
```

## Help

```bash
node dist/src/cli.js --help
```

## Development

```bash
bun run lint    # tsc --noEmit (type-check)
bun run test    # run test suite
bun run build   # compile to dist/
```

## JSON-RPC methods

See `docs/bridge-contract.yaml` for the full integration contract — all 39 methods, params, result shapes, error codes, notifications, auth scopes, and environment variables.

Key methods:

- `bridge.capabilities` — list all methods, models, tools, workflows (no auth required)
- `bridge.ping` — liveness check (no auth required)
- `bridge.info` — runtime metadata snapshot (requires `admin` scope)
- `workflow.run` — execute a spec-driven workflow
- `session.start` / `session.resume` / `session.stop` — manage agent sessions
- `session.status` / `session.list` / `session.history` — query session state
- `session.export` — export session transcript
- `session.delete` / `session.cleanup` — remove sessions
- `models.list` / `tools.list` / `skills.list` — enumerate available resources

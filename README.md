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
bun run release:check
```

`bun run release:check` is the deterministic release-readiness gate. It checks package, source, and contract version alignment, then runs lint, tests, build, TypeScript client build, and native build smoke coverage. It does not require live LLM provider credentials or Python packaging tools.

## JSON-RPC methods

See `docs/bridge-contract.yaml` for the full integration contract: transports, callable methods, auth scopes, notifications, error codes, and environment variables. The `bridge.capabilities` response is the runtime discovery surface and currently advertises 111 callable JSON-RPC methods.

Method groups:

- Bridge discovery and diagnostics: `bridge.capabilities`, `bridge.negotiateVersion`, `bridge.ping`, `bridge.info`
- Workflow and loop control: `workflow.run`, `loop.start`, `loop.pause`, `loop.resume`, `loop.stop`
- Sessions and streaming: `session.start`, `session.spawn`, `session.resume`, `session.pause`, `session.stop`, `stream.pause`, `stream.resume`, `stream.throttle`, `stream.backpressure`
- Resources and configuration: `models.list`, `tools.*`, `workspace.*`, `mcp.*`, `config.*`, `hooks.*`, `context.*`
- Higher-level runtime features: `template.*`, `taskTemplate.*`, `team.*`, `audit.query`, `provider.*`, `token.*`, `quota.*`, `budget.*`, `balancer.*`, `permissions.*`

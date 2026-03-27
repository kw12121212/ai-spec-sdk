# bridge-integrator-gaps

## What

Fill three integrator-facing gaps in the JSON-RPC bridge:

1. **Event schema formalization** — formally specify the `bridge/session_event` notification contract so integrators have a stable, machine-readable event surface rather than an opaque blob.
2. **Agent behavior control parameters** — expose `model`, `allowedTools`, `disallowedTools`, `permissionMode`, `maxTurns`, and `systemPrompt` as validated first-class parameters on `session.start` and `session.resume`.
3. **Session listing** — add a `session.list` bridge method that returns summaries of up to 100 most recent sessions so host tools can build session management UIs.

## Why

Any production-grade integrator (IDE plugin, Web UI, CI pipeline) requires three things the current bridge does not provide:

- A **stable event contract** — without it, integrators must reverse-engineer raw SDK messages and their logic will break on SDK updates.
- **Explicit agent controls** — tool permissions and model selection cannot safely be left to opaque `options` passthrough; they need validation and a known default (Full Access / `bypassPermissions`).
- **Session enumeration** — without `session.list`, a host tool cannot show the user what sessions exist or recover without side-channel storage.

## Scope

**In scope:**
- Spec for all `bridge/session_event` notification `type` values and per-type field schemas
- Spec for `agent_message` sub-types: `system_init`, `assistant_text`, `tool_use`, `tool_result`, `result`
- First-class parameters on `session.start` / `session.resume`: `model`, `allowedTools`, `disallowedTools`, `permissionMode`, `maxTurns`, `systemPrompt`
- `permissionMode` enumeration (`default`, `acceptEdits`, `bypassPermissions`) and default (`bypassPermissions`)
- `session.list` method with optional `status` filter (`active` | `all`) and 100-session cap
- Validation behavior for new parameters (invalid type or value → `-32602`)
- Implementation and tests for all new behaviors

**Out of scope:**
- Session disk persistence across bridge restarts
- Tool-call approval hooks / human-in-the-loop interception
- MCP server injection
- Health/ping method
- Pagination for `session.list`

## Unchanged Behavior

- Existing methods (`bridge.capabilities`, `skills.list`, `workflow.run`, `session.start`, `session.resume`, `session.stop`, `session.status`) retain their current request/response contracts
- Proxy parameter handling is unchanged
- Workspace validation and `cwd` rejection are unchanged
- Sessions not found still return `-32011`

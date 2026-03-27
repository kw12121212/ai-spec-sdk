# gui-important-gaps

## What

Add three capabilities to the Bridge that unblock important GUI quality features:
1. **`bridge.ping`** — health-check RPC method.
2. **`session.events`** — missed-event replay: returns buffered session events with a `since` cursor.
3. **Token usage** — propagate `usage` (input_tokens / output_tokens) from the SDK result message into `session_completed` notifications and `session.start`/`session.resume` responses.

## Why

GUI clients need to know if the Bridge process is alive (ping), need to recover events
after a reconnect (event replay), and need token counts to show cost/usage dashboards.
These three gaps were identified in the GUI integrator analysis (TODO.md items 3, 4, 6).

## Scope

### In Scope
- `bridge.ping` method: responds `{pong: true, ts: <ISO-8601>}`.
- `session.events` method: returns buffered events for a sessionId with `offset`/`limit`
  pagination (cap 500 events per session, default limit 50).
- Token usage: extract `usage` from the SDK `result` message; include in:
  - `session_completed` notification: `{..., usage: {inputTokens, outputTokens} | null}`
  - `session.start` / `session.resume` response: `{..., usage: {inputTokens, outputTokens} | null}`
- `bridge.capabilities` updated: methods list includes `bridge.ping` and `session.events`.

### Out of Scope
- Persistent event replay across Bridge process restarts.
- Tool approval flow (TODO item 10).
- Model listing, workspace registry, tool schema list (TODO items 7-9).
- Storing usage in the persisted session JSON on disk.

## Unchanged Behavior

Behaviors that must not change as a result of this change (leave blank if nothing is at risk):
- All existing RPC methods (`session.start`, `session.resume`, `session.stop`,
  `session.status`, `session.list`, `session.history`, `workflow.run`,
  `skills.list`, `bridge.capabilities`) continue to work identically.
- Session disk persistence is unchanged.
- Proxy forwarding is unchanged.
- Existing error codes and validation rules are unchanged.
- `session.history` (history of prompts/messages) is not replaced by `session.events`.

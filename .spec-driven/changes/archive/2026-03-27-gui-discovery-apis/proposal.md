# gui-discovery-apis

## What
Add three discovery APIs to the bridge that GUI clients need but currently lack:
`models.list`, `workspace.register`/`workspace.list`, and `tools.list`.

## Why
A full-featured Claude Code GUI needs to populate model selectors, display a
"recent projects" list, and show available tools. The bridge has no endpoints
for any of these today (TODO items 7, 8, 9).

## Scope

**In scope**
- `models.list` — return a static list of supported Claude model IDs and display names
- `workspace.register` — record a workspace path as recently used (idempotent, updates `lastUsedAt`)
- `workspace.list` — return workspaces sorted by `lastUsedAt` descending
- `tools.list` — return a static list of Claude Code tool names and short descriptions
- Update `bridge.capabilities` `methods` list to include the four new methods
- Optional `workspacesDir` in `BridgeServerOptions` for disk persistence of the workspace registry (parallel to existing `sessionsDir`)

**Out of scope**
- Tool approval / permission gate (TODO item 10 — deferred)
- Dynamic model discovery from the Anthropic API
- Workspace deletion or renaming
- Full tool parameter JSON Schema (names + descriptions only)

## Unchanged Behavior

Behaviors that must not change as a result of this change (leave blank if nothing is at risk):
- All existing methods (`session.*`, `bridge.*`, `skills.list`, `workflow.run`) behave identically
- Session persistence, history, and event buffering are unaffected
- `bridge.capabilities` still lists every pre-existing method; new methods are appended
- No changes to `claude-agent-runner.ts` behavior

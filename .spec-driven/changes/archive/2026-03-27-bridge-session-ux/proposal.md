# bridge-session-ux

## What

Add four UX-oriented features to the bridge to bring the SDK closer to a complete Claude Code CLI experience:

1. **Context management** — `context.read`, `context.write`, `context.list` methods for reading and writing CLAUDE.md files, memory files, and `.claude/` directory contents across workspace and user scopes.
2. **File change tracking** — `bridge/file_changed` notifications emitted when the agent uses Write or Edit tools, carrying path, action, and optional diff.
3. **Session branching** — `session.branch` method that forks a new session from a point in an existing session's history, attempting SDK-level resume when possible.
4. **Cross-session search** — `session.search` method for searching across session histories with workspace, status, and text filters.

## Why

GUI clients built on the SDK currently lack the ability to:
- Manage the context the agent sees (CLAUDE.md, memory files) without manual file access
- Track which files an agent modifies in real time
- Explore alternate conversation paths from a mid-session checkpoint
- Find relevant past conversations across sessions

These capabilities are standard in the Claude Code CLI and are needed by any downstream GUI or tool that wants to offer a comparable experience.

## Scope

**In scope:**
- `context.read`, `context.write`, `context.list` bridge methods
- Path sandboxing to `CLAUDE.md` (any depth) and `.claude/**` within workspace, plus `~/.claude/**` for user scope
- `bridge/file_changed` notification for Write and Edit tool calls
- `session.branch` method with optional `fromIndex` and `prompt`
- `session.search` method with `query`, `workspace?`, `status?`, `limit?` filters
- New `ContextStore` class for workspace and user context file operations
- Updates to `BridgeServer` dispatch, capabilities, and Go CLI example
- Unit tests for all new functionality

**Out of scope:**
- File change tracking from Bash tool calls (too opaque)
- Full-text search indexing (substring matching only)
- Context file watching / hot-reload notifications
- Merging or diffing context files across scopes

## Unchanged Behavior

- All existing bridge methods continue to work identically
- Session store, MCP store, config store, hooks store are unchanged
- `bridge/session_event` notification format and types are unchanged (file changes use a separate notification method)
- Agent control parameters, tool approval flow, and proxy handling are unaffected

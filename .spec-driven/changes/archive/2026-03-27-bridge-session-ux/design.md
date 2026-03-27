# Design: bridge-session-ux

## Approach

### Context Management

Introduce a `ContextStore` class that handles reading, writing, and listing files within allowed context paths. The store operates in two scopes:

- **Workspace scope**: paths under `<workspace>/CLAUDE.md`, `<workspace>/**/CLAUDE.md`, and `<workspace>/.claude/**`
- **User scope**: paths under `~/.claude/**`

Methods:
- `context.read({ scope, workspace?, path })` — read a context file's content. `scope` is `"project"` or `"user"`.
- `context.write({ scope, workspace?, path, content })` — write a context file. Creates parent directories as needed.
- `context.list({ workspace? })` — list all context files in both scopes. Returns `{ files: ContextFile[] }` where each entry has `scope`, `path` (relative), `size`, `modifiedAt`.

Path validation enforces sandboxing: all paths are resolved and checked against allowed base directories. Path traversal (`..`) outside the allowed directory is rejected.

### File Change Tracking

Extend the existing `_runQuery` onEvent handler in `BridgeServer`. When a `tool_use` message is classified and the tool name is `"Write"` or `"Edit"`, extract file path and action:

- **Write tool**: `input.file_path` gives the path. Check `fs.existsSync` before execution to determine `created` vs `modified`. Include `content` from input (not a diff, since it's the full content).
- **Edit tool**: `input.file_path` gives the path. Action is always `modified`. Include `old_string`/`new_string` from input as a lightweight diff.

Emit a `bridge/file_changed` notification with: `sessionId`, `path` (relative to workspace), `action`, `diff` (for Edit), `content` (for Write).

This is a best-effort signal — it captures intent from tool inputs, not filesystem verification.

### Session Branching

Add `session.branch` method:
- Parameters: `{ sessionId, fromIndex?, prompt? }`
- Creates a new session via `SessionStore.create()` with the original session's workspace
- Copies history entries from the original session up to `fromIndex` (default: all history, type `branch_from`)
- If the original session has an `sdkSessionId`, pass it as `resume` to the agent query so the SDK continues from that conversation state
- If `prompt` is provided, immediately start the branched session with that prompt
- The original session is unaffected

### Cross-Session Search

Add `session.search` method:
- Parameters: `{ query, workspace?, status?, limit? }`
- Iterates over sessions in the store, filtering by workspace and status if provided
- For each session, searches through history entries' `prompt` and `message` fields for substring matches
- Returns `{ results: SearchResult[] }` where each entry has `sessionId`, `workspace`, `status`, `matches` (array of `{ entry, snippet }`), capped at `limit` (default 20, max 100)

## Key Decisions

1. **Context paths are sandboxed** — no arbitrary file system access through context methods. This prevents the bridge from becoming a general-purpose file server.
2. **User scope includes `~/.claude/`** — GUI clients need access to global context (CLAUDE.md patterns, memory files) just like the CLI does.
3. **File tracking is tool-input-based** — we extract change info from Write/Edit tool inputs rather than using filesystem watchers. This is deterministic and has zero platform-specific behavior.
4. **Branching reuses SDK session ID** — when the original session has an `sdkSessionId`, the branch attempts to resume from that SDK context. This gives the branch the actual conversation context rather than just a history copy.
5. **Search is substring-only** — no full-text indexing. Sufficient for the expected dataset size (sessions are bounded, typically hundreds not millions).

## Alternatives Considered

1. **Filesystem watchers for file tracking** — rejected due to platform variability, performance overhead, and the inability to attribute changes to specific agent actions.
2. **Full-text search (e.g., SQLite FTS)** — rejected as over-engineering for the expected data volume. Can be added later if needed.
3. **Context watching with hot-reload notifications** — rejected for this change. Could be a future enhancement.
4. **Branching without SDK resume** — rejected per user preference; trying SDK resume preserves actual conversation context.

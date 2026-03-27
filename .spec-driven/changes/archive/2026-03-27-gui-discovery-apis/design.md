# Design: gui-discovery-apis

## Approach

### models.list
Return a static array of `{ id, displayName }` objects defined in `capabilities.ts`.
No dynamic API call — the supported models change infrequently and are well known.
The bridge advertises model IDs that are known to work with the Claude Agent SDK.

### workspace.register / workspace.list
Introduce a new `WorkspaceStore` class (new file `workspace-store.ts`) modelled
after the existing `SessionStore` pattern:
- In-memory `Map<path, WorkspaceEntry>` where `WorkspaceEntry = { path, registeredAt, lastUsedAt }`
- Optional `workspacesDir` constructor arg — persists a single `workspaces.json` file
  (not one file per entry, since the list is small and append-heavy)
- `register(workspacePath)` — upsert by resolved absolute path, update `lastUsedAt`
- `list()` — return sorted by `lastUsedAt` descending, capped at 50

`BridgeServer` accepts `workspacesDir?: string` in its options and constructs a
`WorkspaceStore`. The two new dispatch cases call through to `WorkspaceStore`.

### tools.list
Return a static array of `{ name, description }` objects listing the Claude Code
built-in tools. The list is defined in `capabilities.ts` alongside the model list.
No SDK introspection required.

## Key Decisions

1. **Static model + tool lists** — The Claude Agent SDK has no introspection API for
   either. Static lists are correct for the current SDK version and easy to update.

2. **Single `workspaces.json` file** — Workspaces are few and the store is
   append/upsert heavy; a single file avoids accumulating one-file-per-workspace
   clutter (contrast with sessions which can number in the hundreds).

3. **`workspacesDir` optional** — Matches `sessionsDir` convention; omitting it
   gives in-memory-only behavior (tests, ephemeral use).

4. **Cap `workspace.list` at 50** — Prevents unbounded growth; 50 recent workspaces
   is more than any GUI needs to display.

## Alternatives Considered

- **Dynamic model list via Anthropic API** — Would require network access and an API
  key at list time. Rejected: the bridge should work offline for model selection.
- **Store workspaces in session-store.ts** — Would conflate two distinct concerns.
  Rejected in favour of a dedicated `WorkspaceStore`.

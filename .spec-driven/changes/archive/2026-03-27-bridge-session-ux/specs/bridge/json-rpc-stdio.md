## ADDED Requirements

### Requirement: Context Management Methods
The bridge MUST expose the following methods for managing context files (CLAUDE.md files, memory files, and `.claude/` directory contents):

- `context.read` — Read a context file's content
- `context.write` — Write a context file's content
- `context.list` — List available context files

Context operations operate in two scopes: `project` (workspace-relative) and `user` (`~/.claude/`).

For project scope, allowed paths are: `CLAUDE.md` at any directory depth, and any file under `.claude/`. For user scope, allowed paths are any file under `~/.claude/`.

All paths MUST be resolved to absolute paths and validated against the allowed base directory. Path traversal outside the allowed directory MUST be rejected with a `-32602` error.

#### Scenario: Read a workspace CLAUDE.md
- GIVEN a workspace has a `CLAUDE.md` file at its root
- WHEN a client calls `context.read` with `{ scope: "project", workspace, path: "CLAUDE.md" }`
- THEN the response includes `{ scope, path, content }` with the file's content

#### Scenario: Read a user-scope context file
- GIVEN the user's `~/.claude/` directory contains a `settings.json` file
- WHEN a client calls `context.read` with `{ scope: "user", path: "settings.json" }`
- THEN the response includes the file content

#### Scenario: Read a non-existent file
- GIVEN a context file does not exist at the specified path
- WHEN a client calls `context.read`
- THEN the bridge returns a `-32001` error indicating the file was not found

#### Scenario: Write a context file
- GIVEN a client calls `context.write` with `{ scope: "project", workspace, path: "CLAUDE.md", content: "..." }`
- THEN the file is written and the response includes `{ scope, path, written: true }`

#### Scenario: Write creates parent directories
- GIVEN a client writes to `.claude/memory/my-notes.md` and the `.claude/memory/` directory does not exist
- WHEN the bridge processes the write
- THEN parent directories are created automatically

#### Scenario: Write rejects path traversal
- GIVEN a client calls `context.write` with `{ scope: "project", workspace, path: "../../etc/passwd", content: "..." }`
- WHEN the bridge validates the path
- THEN the bridge returns a `-32602` error indicating the path is outside the allowed directory

#### Scenario: List context files
- GIVEN a workspace has `CLAUDE.md` and `.claude/settings.json`
- WHEN a client calls `context.list` with `{ workspace }`
- THEN the response includes a `files` array with entries for both project and user scope files, each containing `scope`, `path` (relative), `size`, and `modifiedAt`

#### Scenario: List with user-only scope
- GIVEN a client calls `context.list` without a workspace
- WHEN the bridge processes the request
- THEN the response includes only user-scope files from `~/.claude/`

### Requirement: Context Capability Advertisement
The `bridge.capabilities` response MUST include `context.read`, `context.write`, and `context.list` in its supported methods list.

### Requirement: File Change Notification
The bridge MUST emit a `bridge/file_changed` notification when the agent uses a Write or Edit tool during a session.

For **Write** tool calls, the notification MUST include:
- `sessionId` (string)
- `path` (string, relative to workspace)
- `action` (`"created"` if the file did not exist before, `"modified"` if it did)

For **Edit** tool calls, the notification MUST include:
- `sessionId` (string)
- `path` (string, relative to workspace)
- `action` (`"modified"`)

The notification does NOT include file content or diff data to avoid leaking potentially sensitive information.

#### Scenario: Write tool emits file_changed with created action
- GIVEN a session is running and the agent uses the Write tool to create a new file
- WHEN the bridge detects the tool_use message
- THEN the bridge emits a `bridge/file_changed` notification with `action: "created"` and the relative file path

#### Scenario: Edit tool emits file_changed with modified action
- GIVEN a session is running and the agent uses the Edit tool on an existing file
- WHEN the bridge detects the tool_use message
- THEN the bridge emits a `bridge/file_changed` notification with `action: "modified"` and the relative file path

#### Scenario: Non-file tools do not emit file_changed
- GIVEN a session is running and the agent uses the Bash or Read tool
- WHEN the bridge processes the tool_use message
- THEN no `bridge/file_changed` notification is emitted

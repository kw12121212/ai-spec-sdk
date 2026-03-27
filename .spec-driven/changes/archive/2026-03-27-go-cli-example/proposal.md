# go-cli-example

## What

Create a complete Go CLI example (`example/go-cli/`) that demonstrates how to integrate with `ai-spec-sdk` via the stdio JSON-RPC bridge. The CLI provides an interactive REPL for free-form conversation with Claude, similar to a simplified Claude Code.

The example covers all bridge methods: `bridge.capabilities`, `bridge.ping`, `session.start`, `session.resume`, `session.stop`, `session.list`, `session.history`, `session.events`, `session.approveTool`, `session.rejectTool`, `models.list`, `tools.list`, `workspace.register`, `workspace.list`, and `workflow.run`.

## Why

Downstream developers need a working reference implementation that shows how to wire up the stdio JSON-RPC transport, handle streaming notifications, and implement tool approval. A Go CLI is a natural fit because Go produces static binaries, has a small runtime footprint, and is widely used in the CLI tooling ecosystem.

## Scope

### In Scope

- Go CLI that launches `ai-spec-bridge` as a subprocess and communicates via stdio JSON-RPC
- Interactive REPL loop: user input → session API → real-time event rendering → next input
- Tool approval flow: intercept `bridge/tool_approval_requested`, prompt user, respond via `session.approveTool`/`session.rejectTool`
- Multi-line input support (backslash-continuation or Shift+Enter via escape sequences)
- Built-in slash commands covering all bridge methods:
  - `/help` — list all commands
  - `/model <id>` — switch Claude model
  - `/models` — list available models (`models.list`)
  - `/sessions` — list sessions (`session.list`)
  - `/resume <id>` — resume a session (`session.resume`)
  - `/history` — show current session history (`session.history`)
  - `/workspace <path>` — register a workspace (`workspace.register`)
  - `/workspaces` — list workspaces (`workspace.list`)
  - `/tools` — list available tools (`tools.list`)
  - `/capabilities` — show bridge capabilities (`bridge.capabilities`)
  - `/ping` — health check (`bridge.ping`)
  - `/workflow <name>` — run a workflow (`workflow.run`)
  - `/quit` — exit
- Terminal rendering for session events: `assistant_text`, `tool_use`, `tool_result`, `system_init`, `result`
- English code comments explaining each JSON-RPC interaction
- `example/go-cli/README.md` with build and usage instructions

### Out of Scope

- Modifications to the SDK itself
- GUI or TUI framework (curses/etc.) — plain terminal output only
- Configuration file support
- Shell autocomplete integration
- Automated tests for the Go code (this is an example, not production code)

## Unchanged Behavior

The SDK source code, tests, and build artifacts remain unchanged. The example is a standalone Go module under `example/` with no effect on the main project's build or test pipeline.

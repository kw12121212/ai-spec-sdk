# go-cli — Example CLI for ai-spec-sdk

A Go CLI that demonstrates how to integrate with `ai-spec-sdk` via its stdio JSON-RPC bridge. Provides an interactive REPL for free-form conversation with Claude, similar to a simplified Claude Code.

## Prerequisites

1. **Go 1.25+** installed
2. **Node.js 20+** and **bun** installed (to run the bridge)
3. **ai-spec-sdk** built:
   ```bash
   cd ../..   # project root
   bun run build
   ```

## Build

```bash
cd example/go-cli
go build -o ai-cli .
```

## Run

```bash
# Use default bridge path (resolves to ../../dist/src/cli.js)
./ai-cli --workspace /path/to/project

# Or specify bridge path explicitly
./ai-cli --bridge /path/to/dist/src/cli.js --workspace /path/to/project

# Use a specific model
./ai-cli --model claude-opus-4-6 --workspace /path/to/project

# Bypass tool approval (no prompts for each tool call)
./ai-cli --permission-mode bypassPermissions --workspace /path/to/project
```

## Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/quit` | Exit the CLI |
| `/ping` | Health check (`bridge.ping`) |
| `/capabilities` | Show bridge capabilities (`bridge.capabilities`) |
| `/models` | List available Claude models (`models.list`) |
| `/model <id>` | Switch Claude model for new sessions |
| `/tools` | List available tools (`tools.list`) |
| `/sessions [active\|all]` | List sessions (`session.list`) |
| `/resume <id>` | Switch to an existing session |
| `/history [id]` | Show session history (`session.history`) |
| `/permission <mode>` | Change tool permission mode |
| `/workspace <path>` | Register a workspace (`workspace.register`) |
| `/workspaces` | List registered workspaces (`workspace.list`) |
| `/workflow [name]` | Run a workflow or list available (`workflow.run`) |

## Multi-line Input

End a line with `\` to continue on the next line:

```
> Please refactor this function:\
> func foo() { ... }\
> Make it more readable.
```

## Architecture

```
main.go              Entry point, CLI flags, REPL loop, command dispatch
bridge/client.go     JSON-RPC 2.0 client over stdio subprocess
session/session.go   Session manager (start, resume, stop, list, history)
workflow/workflow.go Workflow runner (list, execute)
ui/renderer.go       Terminal rendering, event formatting, multi-line input
```

## How It Works

1. The CLI spawns `ai-spec-bridge` as a subprocess (`node dist/src/cli.js`)
2. Communication happens via JSON-RPC 2.0 over stdin/stdout
3. A background goroutine reads stdout and dispatches notifications
4. Session events are rendered to the terminal in real time
5. When `permissionMode: "approve"` is active, tool calls prompt for user confirmation

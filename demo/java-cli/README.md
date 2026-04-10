# java-cli — Java CLI Demo for ai-spec-sdk

A Java CLI that demonstrates how to integrate with `ai-spec-sdk` via its stdio JSON-RPC bridge. Provides an interactive REPL for free-form conversation with Claude, similar to a simplified Claude Code.

## Prerequisites

1. **Java 17+** installed
2. **Maven 3.8+** installed
3. **Node.js 20+** and **bun** installed (to run the bridge)
4. **ai-spec-sdk** built:
   ```bash
   cd ../..   # project root
   bun run build
   ```

## Build

```bash
cd demo/java-cli
mvn compile
```

To create a runnable JAR:

```bash
mvn package
```

## Run

```bash
# Use default bridge path (resolves to ../../dist/src/cli.js)
mvn exec:java -Dexec.args="--workspace /path/to/project"

# Or specify bridge path explicitly
mvn exec:java -Dexec.args="--bridge /path/to/dist/src/cli.js --workspace /path/to/project"

# Use a specific model
mvn exec:java -Dexec.args="--model claude-opus-4-6 --workspace /path/to/project"

# Bypass tool approval (no prompts for each tool call)
mvn exec:java -Dexec.args="--permission-mode bypassPermissions --workspace /path/to/project"
```

Or with the packaged JAR:

```bash
java -jar target/java-cli-1.0.0-SNAPSHOT.jar --workspace /path/to/project
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
| `/permission [mode]` | Change tool permission mode |
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
src/main/java/com/aispec/
├── Main.java                    Entry point, CLI flags, REPL loop, command dispatch
├── bridge/
│   ├── JsonRpcClient.java       JSON-RPC 2.0 client over stdio subprocess
│   ├── Request.java             JSON-RPC request POJO
│   ├── Response.java            JSON-RPC response POJO
│   └── Notification.java        JSON-RPC notification POJO
├── session/
│   ├── SessionManager.java      Session manager (start, resume, stop, list, history)
│   ├── Session.java             Session entry data model
│   └── Usage.java               Token usage data model
├── workflow/
│   └── WorkflowRunner.java      Workflow runner (list, execute)
└── ui/
    ├── TerminalRenderer.java    Terminal rendering, event formatting
    └── MultiLineReader.java     Multi-line input with backslash continuation
```

## How It Works

1. The CLI spawns `ai-spec-bridge` as a subprocess (`node dist/src/cli.js`)
2. Communication happens via JSON-RPC 2.0 over stdin/stdout
3. A background thread reads stdout and dispatches notifications
4. Session events are rendered to the terminal in real time
5. When `permissionMode: "approve"` is active, tool calls prompt for user confirmation

## Testing

Run the unit tests:

```bash
mvn test
```

## Dependencies

- **Jackson** (2.16.1) — JSON serialization/deserialization
- **JUnit 5** (5.10.1) — Unit testing (test scope only)

## Project Structure

- `pom.xml` — Maven project configuration (Java 17, Jackson, JUnit 5)
- `src/main/java/` — Main source code
- `src/test/java/` — Test source code

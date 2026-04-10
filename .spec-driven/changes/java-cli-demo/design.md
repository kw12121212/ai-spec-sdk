# Design: java-cli-demo

## Approach

The Java CLI is a Maven project at `demo/java-cli/` with a standard package structure. It uses minimal external dependencies (Jackson for JSON) to balance simplicity with idiomatic Java code.

### Architecture

```
demo/java-cli/
├── pom.xml
├── README.md
└── src/main/java/com/aispec/
    ├── Main.java                    # Entry point: parse args, start REPL
    ├── bridge/
    │   ├── JsonRpcClient.java       # JSON-RPC client: spawn subprocess, send/receive
    │   ├── Request.java             # JSON-RPC request POJO
    │   ├── Response.java            # JSON-RPC response POJO
    │   └── Notification.java        # JSON-RPC notification POJO
    ├── session/
    │   ├── SessionManager.java      # Session manager: start, resume, stop, list, history
    │   ├── Session.java             # Session data model
    │   └── Usage.java               # Token usage data model
    ├── workflow/
    │   └── WorkflowRunner.java      # Workflow runner: list and execute
    └── ui/
        ├── TerminalRenderer.java    # Terminal rendering: events, tool approval
        └── MultiLineReader.java     # Multi-line input with backslash continuation
```

### JSON-RPC Client (`bridge/JsonRpcClient.java`)

- Spawns `ai-spec-bridge` as a subprocess using `ProcessBuilder`
- Implements `call(String method, Map<String, Object> params)` for request/response
- Runs a background thread reading stdout line-by-line via `BufferedReader`
- Dispatches notifications to registered handlers via a concurrent queue
- Tracks request IDs (auto-incrementing atomic long) and correlates responses using a concurrent map
- Exposes `onNotification(String method, Consumer<Notification> handler)` for registering callbacks
- Graceful shutdown: destroys process, waits for exit, interrupts reader thread

### Session Manager (`session/SessionManager.java`)

- Wraps the JSON-RPC client with session-specific methods
- Maintains current session ID, model, workspace, and permission mode state
- `start(String prompt)` → calls `session.start`, streams events via notification handler
- `resume(String sessionId, String prompt)` → calls `session.resume`
- `stop()` → calls `session.stop`
- `list(String status)` → calls `session.list`
- `history(String sessionId, int offset, int limit)` → calls `session.history`
- `approveTool(String requestId)` → calls `session.approveTool`
- `rejectTool(String requestId, String message)` → calls `session.rejectTool`

### Workflow Runner (`workflow/WorkflowRunner.java`)

- `list()` → returns available workflow names from capabilities
- `run(String name, String workspace)` → calls `workflow.run`, streams `bridge/progress` notifications

### Terminal Renderer (`ui/TerminalRenderer.java`)

- `renderEvent(Map<String, Object> event)` — formats session events:
  - `session_started` / `session_resumed` — green indicator with session ID
  - `session_completed` — completion with token usage and result summary
  - `session_stopped` — yellow indicator with status
  - `agent_message` with `system_init` — connection info
  - `agent_message` with `assistant_text` — text output
  - `agent_message` with `tool_use` — tool name and input summary
  - `agent_message` with `tool_result` — result summary (truncated if long)
- `promptToolApproval(Map<String, Object> request)` — prints tool details, prompts y/n, returns boolean
- ANSI color codes for terminal styling (matching go-cli colors)

### Multi-Line Reader (`ui/MultiLineReader.java`)

- `readLine(String prompt)` — reads single line with prompt
- `readMultiLine(String prompt)` — reads until non-continued line, returns concatenated input
- Backslash continuation: lines ending with `\` continue to next line

### Main Entry (`Main.java`)

1. Parse CLI arguments (`--bridge`, `--workspace`, `--model`, `--permission-mode`)
2. Resolve bridge path: flag → default (`../../dist/src/cli.js` relative to JAR)
3. Validate workspace directory exists
4. Start bridge subprocess via `JsonRpcClient`
5. Verify bridge responsive with `bridge.ping`
6. Print welcome banner with connection info
7. REPL loop:
   - Read input (with multi-line support)
   - If starts with `/`, dispatch to command handler
   - Otherwise, treat as prompt: call `session.start` or `session.resume`
   - Stream events to terminal renderer
   - On `bridge/tool_approval_requested`, prompt for approval and respond
8. On `/quit` or EOF, clean up and exit

## Key Decisions

1. **Jackson for JSON** — Jackson is the de facto standard for JSON in Java. While go-cli uses only standard library, Java's standard JSON support is weak. One external dependency is acceptable for readable, idiomatic code.

2. **Java 11 minimum** — Java 11 is an LTS release with modern features (var, improved Optional, HttpClient if needed later) while maintaining broad compatibility.

3. **Maven only** — The milestone explicitly excludes Gradle support. Maven is still the most common build tool in enterprise Java environments.

4. **Backslash continuation for multi-line** — Same approach as go-cli. Works in all terminals without requiring raw terminal mode or escape sequence handling.

5. **Flat package structure** — Four packages (`bridge`, `session`, `workflow`, `ui`) keeps code organized without over-engineering. Each package has clear responsibilities.

6. **Pre-built bridge prerequisite** — Like go-cli, the Java CLI expects the bridge to already be built. This is documented in the README.

7. **Synchronous calls with notification handlers** — JSON-RPC requests are synchronous (blocking), while notifications are handled via registered callbacks. This matches the go-cli pattern and is simple to understand.

## Alternatives Considered

- **Pure standard library (javax.json)** — Would avoid external dependencies but produces verbose, less idiomatic code. Jackson is nearly universal in Java projects.

- **JSON-P ( Jakarta JSON Processing)** — Standard API but requires a runtime dependency anyway. Jackson is more widely used and better documented.

- **Gson instead of Jackson** — Gson is simpler but less performant and less widely used in enterprise contexts. Jackson is the safer default choice.

- **Multi-line via JLine** — JLine provides readline-like functionality but adds a heavy dependency. Backslash continuation achieves the same goal portably.

- **Async/reactive JSON-RPC** — Could use CompletableFuture for async calls, but synchronous calls with notification handlers is simpler and matches the go-cli pattern.

- **Separate modules for each package** — Would be over-engineering for a demo CLI. Single module with packages is appropriate for this scope.

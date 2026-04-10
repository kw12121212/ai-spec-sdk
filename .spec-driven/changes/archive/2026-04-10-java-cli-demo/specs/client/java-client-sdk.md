## ADDED Requirements

### Requirement: Java CLI Demo Structure

The SDK MUST provide a Java CLI demo at `demo/java-cli/` that demonstrates integration with the ai-spec-sdk bridge via stdio JSON-RPC.

#### Scenario: Maven project structure exists
- GIVEN the ai-spec-sdk repository is cloned
- WHEN inspecting the `demo/java-cli/` directory
- THEN it contains a valid Maven `pom.xml`
- AND it defines Java 11 as the minimum source/target version
- AND it includes Jackson as a dependency for JSON handling
- AND it includes Maven Exec plugin for running the CLI

#### Scenario: Java source packages exist
- GIVEN the `demo/java-cli/` directory exists
- WHEN inspecting `src/main/java/com/aispec/`
- THEN it contains the following packages:
  - `bridge/` — JSON-RPC client implementation
  - `session/` — Session management
  - `workflow/` — Workflow runner
  - `ui/` — Terminal rendering and input

### Requirement: JSON-RPC Client

The Java CLI MUST implement a JSON-RPC 2.0 client that communicates with the bridge subprocess.

#### Scenario: Spawn bridge subprocess
- GIVEN the bridge binary exists at a known path
- WHEN the JsonRpcClient is instantiated with the bridge path
- THEN it spawns `node <bridge-path>` as a subprocess
- AND it captures stdin for writing requests
- AND it captures stdout for reading responses

#### Scenario: Send JSON-RPC requests
- GIVEN a JsonRpcClient is connected to a bridge subprocess
- WHEN `call(method, params)` is invoked
- THEN it sends a valid JSON-RPC 2.0 request with:
  - `jsonrpc: "2.0"`
  - Unique incrementing `id`
  - Specified `method` and `params`
- AND it blocks until a response is received
- AND it returns the result or throws an error

#### Scenario: Receive JSON-RPC responses
- GIVEN a request has been sent with ID `N`
- WHEN a response with matching ID `N` is received on stdout
- THEN the call returns the response result
- AND if the response contains an error, it throws with the error message

#### Scenario: Handle JSON-RPC notifications
- GIVEN notification handlers are registered
- WHEN a notification (JSON object with `method` but no `id`) is received
- THEN the matching handler is invoked with the notification params
- AND handlers can be registered via `onNotification(method, handler)`

### Requirement: Session Management

The Java CLI MUST provide session management matching the go-cli feature set.

#### Scenario: Start a session
- GIVEN a SessionManager with workspace and model configured
- WHEN `start(prompt)` is called
- THEN it calls `session.start` with the prompt, workspace, and model
- AND it registers a notification handler for `bridge/session_event`
- AND it registers a notification handler for `bridge/tool_approval_requested`
- AND it returns the session start result

#### Scenario: Resume a session
- GIVEN an existing session ID
- WHEN `resume(sessionId, prompt)` is called
- THEN it calls `session.resume` with the session ID and prompt
- AND session events continue to be streamed

#### Scenario: List sessions
- GIVEN the SessionManager is connected
- WHEN `list(status)` is called
- THEN it calls `session.list` with the optional status filter
- AND it returns the list of session entries

#### Scenario: Get session history
- GIVEN a session ID
- WHEN `history(sessionId, offset, limit)` is called
- THEN it calls `session.history` with pagination params
- AND it returns the history entries

#### Scenario: Approve or reject tools
- GIVEN a tool approval request has been received
- WHEN `approveTool(requestId)` is called
- THEN it calls `session.approveTool` with the request ID
- AND when `rejectTool(requestId, message)` is called
- THEN it calls `session.rejectTool` with the request ID and message

### Requirement: Terminal UI

The Java CLI MUST render session events and handle user input.

#### Scenario: Render session events
- GIVEN a session event notification is received
- WHEN it is passed to `TerminalRenderer.renderEvent()`
- THEN it formats the event with appropriate ANSI colors:
  - `session_started` / `session_resumed` — green
  - `session_completed` — green with token usage
  - `session_stopped` — yellow
  - `assistant_text` — plain text output
  - `tool_use` — yellow with tool name and input
  - `tool_result` — dimmed, truncated if long

#### Scenario: Prompt for tool approval
- GIVEN a `bridge/tool_approval_requested` notification
- WHEN `TerminalRenderer.promptToolApproval()` is called
- THEN it displays the tool name and input
- AND it prompts the user with `[approve? y/n]`
- AND it returns true for 'y' or false for 'n'

#### Scenario: Multi-line input
- GIVEN the user is at the REPL prompt
- WHEN they enter a line ending with `\`
- THEN the prompt continues on the next line
- AND lines are concatenated (without the backslash) until a non-continued line

### Requirement: REPL and Commands

The Java CLI MUST provide a REPL with command dispatch matching go-cli.

#### Scenario: REPL loop
- GIVEN the CLI is started with valid arguments
- WHEN the REPL begins
- THEN it displays a welcome banner with connection info
- AND it shows a `>` prompt
- AND it accepts user input

#### Scenario: Command dispatch
- GIVEN the user enters input starting with `/`
- WHEN the input matches a known command
- THEN it executes the corresponding command:
  - `/help` — show available commands
  - `/quit` — exit the CLI
  - `/ping` — call `bridge.ping`
  - `/capabilities` — call `bridge.capabilities`
  - `/models` — call `models.list`
  - `/tools` — call `tools.list`
  - `/sessions [active|all]` — call `session.list`
  - `/resume <id>` — switch to existing session
  - `/history [id]` — call `session.history`
  - `/permission <mode>` — change permission mode
  - `/workspace <path>` — call `workspace.register`
  - `/workspaces` — call `workspace.list`
  - `/workflow [name]` — run workflow or list available

#### Scenario: Free-form prompts
- GIVEN the user enters input not starting with `/`
- WHEN the input is non-empty
- THEN it treats the input as a prompt for Claude
- AND calls `session.start` (first time) or `session.resume` (subsequent)

### Requirement: Documentation

The Java CLI MUST include documentation for building and usage.

#### Scenario: README exists
- GIVEN the `demo/java-cli/` directory exists
- WHEN inspecting the directory
- THEN a `README.md` file exists with:
  - Prerequisites (Java 11+, Maven 3+, Node.js/bun for bridge)
  - Build instructions (`mvn compile`)
  - Run instructions with all CLI flags
  - Command reference table
  - Multi-line input explanation
  - Architecture overview

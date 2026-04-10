# Tasks: java-cli-demo

## Implementation

- [ ] Create Maven project structure with `pom.xml` (Java 11, Jackson dependency, exec plugin)
- [ ] Create `bridge/Request.java` — JSON-RPC request POJO with Jackson annotations
- [ ] Create `bridge/Response.java` — JSON-RPC response POJO with error handling
- [ ] Create `bridge/Notification.java` — JSON-RPC notification POJO
- [ ] Create `bridge/JsonRpcClient.java` — subprocess management, request/response, notification dispatch
- [ ] Create `session/Usage.java` — token usage data model
- [ ] Create `session/Session.java` — session entry data model
- [ ] Create `session/SessionManager.java` — session lifecycle methods with notification handlers
- [ ] Create `workflow/WorkflowRunner.java` — workflow list and run methods
- [ ] Create `ui/TerminalRenderer.java` — event formatting with ANSI colors
- [ ] Create `ui/MultiLineReader.java` — buffered input with backslash continuation
- [ ] Create `Main.java` — argument parsing, bridge initialization, REPL loop, command dispatch
- [ ] Create `README.md` — prerequisites, build instructions, usage, command reference

## Testing

- [ ] Run `bun run lint` to ensure no TypeScript issues in existing code
- [ ] Run `bun run test` to ensure all existing tests pass
- [ ] Build Java project: `cd demo/java-cli && mvn compile`
- [ ] Run Java unit tests: `cd demo/java-cli && mvn test`
- [ ] Test Java CLI starts and pings bridge: `mvn exec:java -Dexec.args="--workspace /tmp --bridge ../../dist/src/cli.js"` then `/quit`
- [ ] Test session start: enter a prompt and verify response
- [ ] Test tool approval flow: verify prompt appears and responds correctly
- [ ] Test multi-line input: verify backslash continuation works
- [ ] Test all commands: `/help`, `/ping`, `/capabilities`, `/models`, `/tools`, `/sessions`, `/history`, `/workspaces`, `/workflow`

## Verification

- [ ] Verify `demo/java-cli/pom.xml` exists and defines Java 11 source/target
- [ ] Verify `demo/java-cli/README.md` exists with build and usage instructions
- [ ] Verify all Java source files compile without errors (`mvn compile`)
- [ ] Verify CLI can start bridge subprocess and receive ping response
- [ ] Verify session events are rendered correctly with ANSI colors
- [ ] Verify tool approval prompts work and responses are sent to bridge
- [ ] Verify feature parity with go-cli (all commands work equivalently)

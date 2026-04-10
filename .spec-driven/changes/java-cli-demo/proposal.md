# java-cli-demo

## What

A Java CLI REPL reference implementation that demonstrates how to integrate with `ai-spec-sdk` via its stdio JSON-RPC bridge. The Java CLI provides an interactive REPL for free-form conversation with Claude, matching the feature parity of the existing Go CLI example.

The implementation includes:
- Maven-based Java project at `demo/java-cli/`
- JSON-RPC 2.0 client communicating with bridge subprocess via stdio
- Session management (start, resume, stop, list, history)
- Workflow runner for executing spec-driven workflows
- Terminal UI for rendering events and handling tool approval prompts
- REPL loop with command dispatch

## Why

This is the final planned change for Milestone 06-v1-stable. It establishes the first stable API guarantee by:

1. **Proving cross-language compatibility** — A working Java implementation demonstrates that the bridge contract is language-agnostic and the JSON-RPC stdio transport is universally accessible.

2. **Providing a reference for JVM integrators** — Java developers can use this as a starting point for building their own integrations, just as Go developers use the go-cli example.

3. **Completing the v1 Stable milestone** — With type generation already complete, the Java CLI demo is the last remaining item before the v1 Stable API guarantee can be declared.

4. **Following established patterns** — The existing go-cli example provides a proven architecture that the Java implementation will mirror, ensuring consistency across language examples.

## Scope

### In Scope

- Maven project structure with `pom.xml` (Java 11 minimum)
- JSON-RPC client package (`com.aispec.bridge`) with stdio subprocess communication
- Session management package (`com.aispec.session`) wrapping bridge methods
- Workflow runner package (`com.aispec.workflow`) for executing workflows
- Terminal UI package (`com.aispec.ui`) for event rendering and input handling
- Main entry point with REPL loop and command dispatch
- README with build and usage instructions
- Support for all go-cli commands: `/help`, `/quit`, `/ping`, `/capabilities`, `/models`, `/tools`, `/sessions`, `/resume`, `/history`, `/permission`, `/workspace`, `/workspaces`, `/workflow`
- Multi-line input support (backslash continuation)
- Tool approval flow when `permissionMode: "approve"`

### Out of Scope

- GUI or TUI framework (stays with plain terminal output like go-cli)
- Gradle build support (Maven only per milestone scope)
- Kotlin or Scala variants
- Packaging as a distributable JAR (build from source only)
- Automatic bridge building (assumes pre-built bridge like go-cli)

## Unchanged Behavior

- The bridge JSON-RPC protocol remains unchanged
- The go-cli example is not modified
- Existing client SDKs (TypeScript, Python) are not affected

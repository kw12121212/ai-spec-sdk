# Design: add-polyglot-agent-spec-bridge

## Approach

Build the first version of the SDK as a local bridge process that speaks JSON-RPC 2.0 over stdio. A host tool starts the bridge as a subprocess, sends structured requests, and receives structured responses plus notifications for streaming progress.

The bridge exposes a small high-level surface instead of mirroring every low-level primitive. One part of the surface manages Claude-backed agent sessions for prompt execution and session resumption. Another part manages spec-driven workflows so a host can invoke supported change-management operations without manually orchestrating skill files, scaffold scripts, or artifact paths.

Every request is bound to an explicit workspace path so host tools can decide which repository or project context they are operating on. Long-running operations emit notifications keyed by request or session identifiers so clients can render progress incrementally while still receiving a final terminal result.

## Key Decisions

- Use JSON-RPC 2.0 over stdio first so the bridge is easy to adopt from IDEs, CLIs, and agent hosts without requiring network deployment.
- Expose high-level workflow operations instead of raw skill prompt passthrough so the SDK contract stays stable even if the packaged skill internals evolve.
- Include session lifecycle APIs in the first release because most integrators need both structured workflow automation and direct Claude agent execution.
- Require explicit workspace targeting for workflow and session requests so repository boundaries are controlled by the caller rather than hidden global state.
- Support streaming notifications for long-running session and workflow activity so downstream tools can render progress without polling.
- Package built-in spec-driven skills as part of the SDK distribution and expose skill discovery metadata for hosts that want to present supported capabilities.

## Alternatives Considered

- HTTP API first: rejected for the initial change because it adds deployment, port management, and security concerns before validating the local integration contract.
- CLI-only wrapper: rejected because parsing human-oriented command output would make downstream integrations more brittle than a structured protocol.
- Full Claude Agent SDK passthrough: rejected because it would leak too much underlying complexity and reduce the value of the wrapper for non-Node tools.
- Workflow-only bridge: rejected because integrators would still need a second path for general Claude agent sessions, which weakens the value of a unified SDK.

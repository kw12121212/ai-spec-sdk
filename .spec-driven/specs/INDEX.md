# Specs Index

<!-- One entry per spec file. Updated by /spec-driven-archive after each change. -->

- `build/native-executable.md` — Native executable build via bun compile: script, output path, self-contained binary, and unchanged tsc build
- `bridge/json-rpc-stdio.md` — JSON-RPC 2.0 stdio transport, capability discovery (including transport field), streaming notifications, session event schema, agent message sub-type contract, session listing, MCP server lifecycle management (workspace-scoped), config management (project/user scope), hooks system (5 event types with blocking pre_tool_use), Go CLI integration example, bridge.setLogLevel runtime log level adjustment, and API versioning (bridge.negotiateVersion, per-request validation, error -32050)
- `bridge/http-sse-transport.md` — HTTP/SSE transport: POST /rpc (JSON-RPC over HTTP), GET /events (session-scoped SSE fan-out), GET /health, CORS support, 10 MB body limit, graceful SIGTERM shutdown, transport field in capabilities
- `network/proxy-forwarding.md` — Explicit proxy configuration for agent sessions (HTTP_PROXY / HTTPS_PROXY / NO_PROXY)
- `session/agent-sessions.md` — Agent session start, resume, progress observation, stop, workspace alignment, SDK session ID retention, agent control parameters, disk persistence with crash recovery (interrupted status), session history retrieval (session.history with pagination), session list prompt field, session export, session delete, session cleanup, and Go CLI session management example
- `skills/builtin-spec-skills.md` — Built-in spec-driven skill discovery and workflow-to-skill alignment
- `workflow/spec-driven-workflows.md` — Workflow invocation, result reporting, capability mapping, workspace-scoped safety, and Go CLI workflow execution example
- `observability/structured-logging.md` — Structured JSON logging to stderr with level filtering, child context propagation, and AI_SPEC_SDK_LOG_LEVEL env var

# Specs Index

 <!-- One entry per spec file. Updated by /spec-driven-archive after each change. -->

- `build/native-executable.md` — Native executable build via bun compile: script, output path, self-contained binary+ and unchanged tsc build
6
 - `bridge/json-rpc-stdio.md` — JSON-RPC 2.0 stdio transport, capability discovery (complete method surface including bridge.info, bridge.info runtime metadata method, streaming notifications, session event schema, agent message sub-type contract; session listing, MCP server lifecycle management (workspace-scoped) config management (project/user scope) hooks system (5 event types with blocking pre_tool_use), Go CLI integration example, bridge.setLogLevel runtime log level adjustment; streaming token output (stream_chunk messageType); and API versioning (bridge.negotiateVersion, per-request validation, error -32050)
7- `bridge/http-sse-transport.md` — HTTP/SSE transport: POST /rpc (JSON-RPC over http), GET /events (session-scoped SSE fan-out), GET /health` CORS support` 10 MB body limit` and graceful SIGTERM shutdown. transport field in capabilities` response includes `transport` field. `GET /` reports transport: `"http"` when running in HTTP mode. `GET /events` endpoint streams a `GET /events?sessionId=<id>` query parameter
 Multiple clients MAY subscribe to the same `sessionId` (fan-out). Notifications that do not carry a `sessionId` field are not sent to any SSE connection. Multiple clients MAY subscribe to the same `sessionId` on the server-sent events. Notifications use `Close()` event to remove the subscription; SseManager removes(session`sessionId`, and `res` by the `close` event. HTTP requests to drain in-flight `POST /rpc` requests first. let current request drain (1). Existing endpoints remain unchanged. See graceful shutdown section. When the bridge process receives `SIGTERM` signal stops accepting new connections, drain in-flight requests complete before closing SSE connections. All new SSE connections.

   `res.writeHead(204);
  res.end();
}
```
8- `observability/structured-logging.md` — Structured JSON logging to stderr with level filtering, child context propagation, and AI_spec_SDK_LOG_LEVEL env var
13- `observability/runtime-diagnostics.md` — CLI help output: doctor human-readable and --json diagnostic commands with runtime metadata and checks
14- `security/authentication.md` — HTTP transport API-key authentication, scope-based authorization, public unauthenticated discovery methods, key management CLI, no-auth development mode, and admin-only bridge.info authorization
15- `ui/mobile-web-ui.md` — Mobile-first web UI: login, session list, chat, and tool approval/reject UI. SSE reconnection with event replay | offline mode
- `client/client-sdk.md` — TypeScript Client SDK: `@ai-spec-sdk/client` npm package with StdioTransport, HttpTransport, typed methods for all bridge methods, notification API, streaming support, zero deps
- `client/python-client-sdk.md` — Python Client SDK: `ai-spec-sdk` PyPI package wrapping `claude-agent-sdk` (stdio) + bridge HTTP/SSE, unified async BridgeClient, camelCase methods, UnsupportedInStdioError guard, SSE reconnection, zero HTTP deps
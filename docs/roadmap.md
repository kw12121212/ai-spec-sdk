# ai-spec-sdk Roadmap

## Selected Directions

| # | Direction | Priority | Status | Depends On |
|---|-----------|----------|--------|------------|
| 1 | Structured Logging | P0 | ✅ Done | — |
| 2 | API Versioning | P0 | ✅ Done | Structured Logging |
| 3 | Session Persistence | P0 | ✅ Done | Structured Logging |
| 4 | HTTP/SSE Transport | P1 | ✅ Done | API Versioning |
| 5 | Authentication & Authorization | P1 | ✅ Done | HTTP/SSE Transport |
| 6 | **Mobile Web UI** | **P0** | Planned | HTTP/SSE Transport, Auth |
| 7 | Java CLI Demo | P2 | Planned | — |
| 8 | TypeScript Client SDK | P0 | Planned | Stable API |
| 9 | Python Client SDK | P1 | Planned | Stable API |
| 10 | Streaming Token Output | P0 | Planned | HTTP/SSE Transport |
| 11 | WebSocket Transport | P1 | Planned | HTTP/SSE Transport |
| 12 | Rate Limiting | P1 | Planned | Auth |
| 13 | Custom Tool Registration | P1 | Planned | — |
| 14 | Multi-Agent Orchestration | P1 | Planned | Session Persistence |
| 15 | OpenTelemetry / Metrics | P2 | Planned | Auth |
| 16 | Session Templates | P2 | Planned | Session Persistence |
| 17 | Cross-Platform Release | P1 | Planned | — |
| 18 | Event Webhooks | P2 | Planned | Auth |

---

## 1. Structured Logging

### Goal
Replace console.log / scattered error handling with a unified, structured logging system that supports JSON output, log levels, and session-scoped context.

### Scope
- Introduce a `Logger` module (`src/logger.ts`)
- Log levels: `trace`, `debug`, `info`, `warn`, `error`
- Each log entry includes: `timestamp`, `level`, `message`, `sessionId?`, `method?`, `durationMs?`, `error?`
- Output format: JSON lines to stderr (keeps stdout clean for JSON-RPC)
- Configurable via env var `AI_SPEC_SDK_LOG_LEVEL` (default: `info`)
- Integration points:
  - `bridge.ts` dispatch: log method call, duration, error
  - `session-store.ts`: log session lifecycle events
  - `claude-agent-runner.ts`: log SDK query start/stop/error
  - `mcp-store.ts`: log MCP server lifecycle
  - `workflow.ts`: log workflow execution
- Bridge method `bridge.setLogLevel` for runtime adjustment

### Out of Scope
- Log file rotation (use external tooling like `tee` or `systemd`)
- Remote log shipping
- OpenTelemetry integration (future phase)

### Key Decisions
- **No external dependency** — use a minimal hand-rolled logger to keep bundle small
- **JSON lines to stderr** — stdout is reserved for JSON-RPC; stderr is the standard log channel for CLI tools
- **Session-scoped context** — all logs within a session handler automatically include sessionId

### Estimated Spec Files
- `specs/observability/structured-logging.md`

### Tasks
1. [x] Create `src/logger.ts` with level filtering, JSON formatting, stderr output
2. [x] Integrate into `bridge.ts` dispatch (method call, duration, error)
3. [x] Integrate into `session-store.ts`, `claude-agent-runner.ts`, `mcp-store.ts`, `workflow.ts`
4. [x] Add `bridge.setLogLevel` JSON-RPC method
5. [x] Update tests: verify log output format and level filtering
6. [x] Add `AI_SPEC_SDK_LOG_LEVEL` env var support

---

## 2. API Versioning

### Goal
Add explicit API version negotiation so clients can declare which version they target, and the bridge can evolve without breaking existing consumers.

### Scope
- Add `apiVersion` field to `bridge.capabilities` response (e.g., `"0.1.0"`)
- New `bridge.negotiateVersion` method: client sends `{supportedVersions: ["0.1.0"]}`, bridge responds with `{negotiatedVersion, capabilities}`
- Version semantics:
  - **Major** (X.0.0): breaking changes (removed methods, changed param/result shapes)
  - **Minor** (0.X.0): new methods, new optional fields (backwards compatible)
  - **Patch** (0.0.X): bug fixes, no API changes
- Per-request version header: optional `apiVersion` field in JSON-RPC request params
- If client requests unsupported version → error code `-32050` with `supportedVersions` in data
- Version constant in `src/capabilities.ts`

### Out of Scope
- Running multiple API versions simultaneously (single-version bridge)
- Auto-migration of client requests between versions

### Key Decisions
- **Version is the bridge's package version** — avoids maintaining a separate versioning scheme
- **Opt-in** — clients that don't specify a version get the current version (no breaking change for existing clients)
- **Single active version** — bridge runs one version; negotiation is for future-proofing

### Estimated Spec Files
- `specs/bridge/api-versioning.md` (delta on `bridge/json-rpc-stdio.md`)

### Tasks
1. [x] Add `API_VERSION` constant to `src/capabilities.ts`
2. [x] Add `apiVersion` to `bridge.capabilities` response
3. [x] Implement `bridge.negotiateVersion` method
4. [x] Add version validation in `dispatch()` when `apiVersion` is present in params
5. [x] Define error code `-32050` for version mismatch
6. [x] Update tests
7. [x] Update `docs/bridge-contract.yaml`

---

## 3. Session Persistence

### Goal
Persist session state to disk so sessions survive bridge restarts and can be inspected after completion.

### Scope
- File-based storage in `<sessionsDir>/` (defaults to `~/.ai-spec-sessions/`)
- Each session is a JSON file: `<sessionId>.json`
- Persisted fields: `id`, `workspace`, `prompt`, `status`, `sdkSessionId`, `createdAt`, `updatedAt`, `history` (append-only event log)
- Write strategy:
  - **On create**: write initial session file
  - **On append event**: append to history array, flush to disk (debounced, 500ms)
  - **On complete/stop**: immediate flush (no debounce)
- Session recovery on bridge start:
  - Load all session files from `<sessionsDir>/`
  - Mark sessions that were `running` as `interrupted` (bridge crashed mid-query)
  - `interrupted` sessions can be `resume`d (creates a new SDK session)
- New JSON-RPC method `session.export`: dump full session history as JSON
- New JSON-RPC method `session.delete`: remove persisted session file
- Housekeeping: `session.cleanup` method to remove sessions older than N days

### Out of Scope
- Database storage (SQLite, etc.) — file-based is sufficient for local SDK
- Encryption at rest
- Cross-machine session sharing

### Key Decisions
- **Append-only history** — events are never modified, only appended; simplifies crash recovery
- **Debounced writes** — balance between durability and I/O overhead; final state always flushed immediately
- **Interrupted status** — explicitly different from `stopped` (user-initiated) vs `interrupted` (crash)

### Estimated Spec Files
- `specs/session/session-persistence.md` (delta on `session/agent-sessions.md`)

### Tasks
1. [x] ~~Refactor `SessionStore` to support pluggable storage backend~~ Skipped (YAGNI — only one storage backend needed)
2. [x] ~~Implement `FileSessionStorage` with JSON file per session~~ Already implemented in prior work
3. [x] ~~Add debounced write with immediate flush on complete/stop~~ Skipped (immediate flush is sufficient for local SDK)
4. [x] Implement session recovery on bridge start (scan dir, mark `interrupted`)
5. [x] Add `session.export`, `session.delete`, `session.cleanup` methods to bridge
6. [x] ~~Update `SessionStore` to use `FileSessionStorage` by default~~ Already done (constructor accepts `sessionsDir`)
7. [x] Update tests: test disk persistence, recovery, interrupted status
8. [x] Update `docs/bridge-contract.yaml`

---

## 4. HTTP/SSE Transport

### Goal
Add HTTP + Server-Sent Events as an alternative transport, enabling web clients and remote tool integration.

### Scope
- New entrypoint: `src/http-server.ts` (alongside existing `src/cli.ts` for stdio)
- Start mode: `ai-spec-bridge --transport http --port 8765` or env `AI_SPEC_SDK_TRANSPORT=http`
- Dual transport support: single bridge instance can serve both stdio and HTTP
- HTTP endpoints:
  - `POST /rpc` — JSON-RPC request/response (maps to `bridge.handleMessage`)
  - `GET /events?sessionId=...` — SSE stream for session events (maps to bridge notifications)
  - `GET /health` — health check (returns `{ status: "ok", apiVersion }`)
- SSE event format:
  ```
  event: session_event
  data: {"jsonrpc":"2.0","method":"bridge/session_event","params":{...}}
  ```
- CORS support: configurable origins via `AI_SPEC_SDK_CORS_ORIGINS` (default: `*`)
- Request validation: Content-Type checking, body size limit (10MB)
- Graceful shutdown: drain in-flight requests, close SSE connections

### Out of Scope
- WebSocket transport (SSE is simpler, unidirectional from server, sufficient for notifications)
- HTTPS/TLS (terminate TLS at reverse proxy level)
- Rate limiting (covered in auth phase)

### Key Decisions
- **SSE over WebSocket** — SSE is simpler, HTTP-compatible, and sufficient for server→client streaming; client→server uses POST /rpc
- **No external HTTP framework** — use Node.js built-in `http` module to keep dependencies minimal
- **Same `BridgeServer` core** — HTTP is just a transport layer; all business logic remains in `BridgeServer`

### Estimated Spec Files
- `specs/bridge/http-sse-transport.md` (new spec file)

### Tasks
1. Create `src/http-server.ts` with Node.js `http` module
2. Implement `POST /rpc` handler mapping to `BridgeServer.handleMessage`
3. Implement SSE manager: connection registry, event fan-out per session
4. Implement `GET /events` with session-scoped SSE streams
5. Implement `GET /health` endpoint
6. Add CORS handling
7. Update `src/cli.ts` to support `--transport` and `--port` flags
8. Add `transport` field to `bridge.capabilities` response
9. Integration tests: HTTP transport lifecycle, SSE streaming, concurrent sessions
10. Update `docs/bridge-contract.yaml`

---

## 5. Authentication & Authorization

### Goal
Secure HTTP transport with API key authentication and method-level authorization.

### Scope
- **Authentication**:
  - API Key based: `Authorization: Bearer <key>` header on HTTP requests
  - Key storage: `~/.ai-spec-sessions/keys.json` (hashed with SHA-256)
  - Key management CLI: `ai-spec-bridge keygen`, `ai-spec-bridge keys list`, `ai-spec-bridge keys revoke <id>`
  - Each key has: `id`, `name`, `hash`, `createdAt`, `expiresAt?`, `scopes[]`
- **Authorization**:
  - Scopes: `session:read`, `session:write`, `workflow:run`, `config:read`, `config:write`, `admin`
  - Method-to-scope mapping in `src/auth.ts`:
    - `session.start`, `session.resume`, `session.stop` → `session:write`
    - `session.status`, `session.list`, `session.history` → `session:read`
    - `workflow.run` → `workflow:run`
    - `config.get`, `config.list` → `config:read`
    - `config.set` → `config:write`
    - `mcp.*`, `hooks.*` → `admin`
    - `bridge.capabilities`, `bridge.ping` → no auth required
  - Scope check before dispatch; return error `-32060` on insufficient scope
- **Stdio transport**: no auth required (local process trust model)
- **HTTP transport**: auth required by default, can be disabled with `--no-auth` for local dev

### Out of Scope
- OAuth2 / OIDC integration
- mTLS
- JWT with external identity provider
- Rate limiting per key (future enhancement)

### Key Decisions
- **API Key simplicity** — local SDK use case doesn't need OAuth; Bearer token is sufficient
- **Stdio = no auth** — stdio implies local trust; only HTTP needs authentication
- **SHA-256 hashed storage** — keys are never stored in plaintext
- **Scope-based authorization** — coarse-grained scopes keep it simple; fine-grained permissions can be added later

### Estimated Spec Files
- `specs/security/authentication.md` (new spec file)
- `specs/security/authorization.md` (new spec file)

### Tasks
1. Create `src/auth.ts` with key generation, hashing, verification, scope checking
2. Create `src/key-store.ts` for key persistence (`keys.json`)
3. Implement method-to-scope mapping table
4. Integrate auth middleware into HTTP transport (before dispatch)
5. Add CLI subcommands: `keygen`, `keys list`, `keys revoke`
6. Add `--no-auth` flag for local development
7. Return error `-32060` for insufficient scope, `-32061` for invalid/expired key
8. Tests: auth flow, scope enforcement, key lifecycle
9. Update `docs/bridge-contract.yaml`

---

## 6. Mobile Web UI

### Goal
Add a mobile-friendly web interface served by the bridge, so users can connect from any phone browser to chat with the agent, monitor sessions, and manage workflows — no app install needed.

### Why Web over Native App
- **Zero install** — open URL in any mobile browser, works on iOS/Android
- **Bridge already has HTTP/SSE + Auth** — minimal new infrastructure
- **Single codebase** — responsive web UI covers all platforms
- **Instant updates** — deploy by restarting bridge, no app store review

### Scope
- **Static SPA** served by bridge at `GET /` (or `GET /ui/`)
  - Built as a single HTML file with inline CSS/JS (no build step, no framework)
  - Or a pre-built bundle in `src/ui/` served as static files
- **Login page**: API key input → stored in `localStorage` → auto-used as Bearer token
- **Chat view** (primary screen):
  - Start new session: workspace selector + prompt input
  - Real-time agent output via SSE (`GET /events`)
  - Agent message rendering (text, tool_use summaries, results)
  - Tool approval prompts with approve/reject buttons
  - Session history scrollback
- **Session list view**:
  - Active and past sessions with status badges
  - Resume or view completed sessions
- **Mobile-first design**:
  - Touch-friendly (large tap targets, swipe gestures)
  - Dark mode support (`prefers-color-scheme`)
  - Responsive: works on phones (375px+) and tablets
  - No horizontal scroll
- **Bridge changes**:
  - Serve static files from `src/ui/` via HTTP server
  - New env `AI_SPEC_SDK_UI_ENABLED` (default: `true` when HTTP transport is active)
  - SSE reconnection with `Last-Event-ID` for mobile network drops
  - Session event buffering for brief disconnections

### Out of Scope
- Native iOS/Android app (web covers both)
- Push notifications (can add later via service worker)
- Voice input/output
- File upload from phone
- Offline mode / PWA (can add later)

### Key Decisions
- **No framework** — vanilla HTML/CSS/JS keeps it dependency-free and fast on mobile; the UI is a thin client (chat + list), not a complex app
- **Served by bridge** — no separate web server; `GET /` serves the UI, `POST /rpc` and `GET /events` are the API
- **API key auth** — reuse existing auth; user enters key once, stored in browser
- **Mobile-first CSS** — design for phone first, scale up for tablet/desktop

### Estimated Spec Files
- `specs/ui/mobile-web-ui.md` (new spec file)

### Tasks
1. [ ] Create `src/ui/index.html` with mobile-first layout (chat + session list)
2. [ ] Implement API key login flow with `localStorage` persistence
3. [ ] Implement chat view: prompt input, SSE event rendering, session lifecycle
4. [ ] Implement tool approval UI (approve/reject buttons)
5. [ ] Implement session list view with status filtering
6. [ ] Add CSS: dark mode, responsive breakpoints, touch-friendly sizing
7. [ ] Integrate static file serving into `src/http-server.ts` (`GET /` → `src/ui/`)
8. [ ] Add `AI_SPEC_SDK_UI_ENABLED` env var
9. [ ] Test on Chrome Mobile, Safari Mobile, Firefox Mobile
10. [ ] Update `docs/bridge-contract.yaml`

---

## 7. Java CLI Demo

### Goal
Provide a Java counterpart to the existing `demo/go-cli`, demonstrating how to integrate with ai-spec-sdk from the JVM ecosystem. This serves as both a reference implementation and a starting point for Java/Kotlin/Scala developers.

### Scope
- Directory: `demo/java-cli/`
- Build tool: Maven (most universally understood in Java world)
- Java version: 17+ (LTS, widely adopted)
- Package structure: `org.example.aispeccli`

Package layout (mirrors go-cli):
```
demo/java-cli/
├── pom.xml
├── README.md
├── src/main/java/org/example/aispeccli/
│   ├── Main.java                 # REPL entry point, flag parsing
│   ├── bridge/
│   │   └── BridgeClient.java     # JSON-RPC 2.0 stdio client (spawn bridge subprocess)
│   ├── session/
│   │   └── SessionManager.java   # Session start/resume/stop/status operations
│   ├── workflow/
│   │   └── WorkflowRunner.java   # Workflow discovery and execution
│   └── ui/
│       ├── TerminalColors.java   # ANSI color constants
│       └── LineReader.java       # Multi-line input with backslash continuation
└── src/test/java/org/example/aispeccli/
    └── bridge/
        └── BridgeClientTest.java # Unit tests for JSON-RPC client
```

Feature parity with go-cli:
- Spawn bridge as subprocess, communicate over stdio (stdin/stdout JSON-RPC)
- REPL with all slash commands: `/help`, `/quit`, `/ping`, `/capabilities`, `/models`, `/model`, `/tools`, `/sessions`, `/resume`, `/stop`, `/status`, `/history`, `/events`, `/permission`, `/workspace`, `/workspaces`, `/workflow`, `/skills`, `/mcp`, `/config`, `/hooks`, `/context`, `/branch`, `/search`
- Notification handling (session events, tool approval requests)
- ANSI color output
- Multi-line input with trailing `\` continuation
- CLI flags: `--bridge`, `--workspace`, `--model`, `--permission-mode`

Dependencies (minimal):
- `com.fasterxml.jackson.core:jackson-databind` — JSON serialization (industry standard)
- `info.picocli:picocli` — CLI flag parsing
- JUnit 5 + Mockito for tests

### Out of Scope
- Gradle build variant (Maven only for simplicity)
- HTTP transport demo (use stdio only, matching go-cli)
- Kotlin/Scala variants (Java is the baseline)
- Publishing as a Maven artifact (local build only)

### Key Decisions
- **Maven over Gradle** — more declarative, easier to read for non-Java devs browsing the demo
- **Java 17** — current LTS, covers most enterprise environments
- **Jackson over Gson** — better performance, more widely used in production
- **Picocli** — lightweight, annotation-based, generates help automatically
- **Feature parity with go-cli** — same commands, same behavior, same user experience

### Estimated Spec Files
- `specs/demo/java-cli.md` (new spec file)

### Tasks
1. Create `demo/java-cli/pom.xml` with dependencies (Jackson, Picocli, JUnit 5)
2. Implement `BridgeClient.java`: subprocess spawn, JSON-RPC request/response, notification dispatch
3. Implement `SessionManager.java`: start, resume, stop, status, history, events, list, branch, search
4. Implement `WorkflowRunner.java`: available workflows, run
5. Implement `ui/TerminalColors.java` and `ui/LineReader.java`
6. Implement `Main.java` with REPL loop and all slash commands
7. Add `BridgeClientTest.java` with unit tests (mock subprocess)
8. Write `demo/java-cli/README.md` with build/run instructions
9. Verify feature parity against go-cli command set

---

## 8. TypeScript Client SDK

### Goal
Provide an official npm package (`@ai-spec-sdk/client`) so Node.js/Bun consumers can integrate with the bridge without hand-writing JSON-RPC transport code.

### Scope
- Package: `@ai-spec-sdk/client` (separate npm package in monorepo or `packages/client/`)
- Auto-generated client methods matching all 39+ bridge methods
- Type-safe request/response types derived from bridge contract
- Transport abstraction: `StdioTransport` (spawn bridge subprocess) and `HttpTransport` (HTTP/SSE)
- Event listener API: `client.on('session_event', handler)`
- Reconnection logic for HTTP transport
- Zero external dependencies (uses Node.js built-in `fetch`, `EventSource`, `child_process`)

### Out of Scope
- Code generation from OpenAPI/JSON Schema (hand-written types are sufficient)
- Bundle size optimization for browser usage
- React/Vue framework bindings

### Key Decisions
- **Separate package** — keeps bridge core dependency-free; client is opt-in
- **Type-safe** — every method has typed params and return values
- **Dual transport** — same client API works over stdio or HTTP

### Tasks
1. [ ] Create `packages/client/` with `package.json`, `tsconfig.json`
2. [ ] Implement `StdioTransport`: spawn bridge, JSON-RPC over stdin/stdout
3. [ ] Implement `HttpTransport`: POST /rpc + GET /events SSE
4. [ ] Define typed method interfaces for all 39+ bridge methods
5. [ ] Implement `BridgeClient` class with method dispatch and event handling
6. [ ] Add reconnection logic for HTTP transport
7. [ ] Write unit tests with mock transport
8. [ ] Write integration tests against real bridge
9. [ ] Publish README with usage examples

---

## 9. Python Client SDK

### Goal
Provide an official PyPI package (`ai-spec-sdk`) for the Python ecosystem, covering AI/ML developers who are the largest audience for agent tooling.

### Scope
- Package: `ai-spec-sdk` on PyPI
- Python 3.10+ (matches Claude Agent SDK Python requirements)
- Synchronous and asynchronous client (`BridgeClient` + `AsyncBridgeClient`)
- Type-safe with full type annotations (PEP 484)
- Transport: subprocess stdio (sync/async) and HTTP/SSE (async)
- Event listener via callbacks or async iterators
- Zero external dependencies for stdio transport; `httpx` for HTTP transport

### Out of Scope
- Django/Flask/FastAPI framework integration
- Jupyter notebook magic commands
- Code generation from bridge contract

### Key Decisions
- **Python 3.10+** — `match` statements, `ParamSpec`, wide compatibility
- **Dual sync/async** — some Python users prefer sync, some async; provide both
- **httpx over requests** — async-native, HTTP/2 support, modern API

### Tasks
1. [ ] Create `clients/python/` with `pyproject.toml`, `src/ai_spec_sdk/`
2. [ ] Implement `StdioTransport` (sync + async subprocess)
3. [ ] Implement `HttpTransport` (async httpx, SSE via `aiohttp-sse-client`)
4. [ ] Define typed method interfaces matching bridge contract
5. [ ] Implement `BridgeClient` and `AsyncBridgeClient`
6. [ ] Add reconnection and error handling
7. [ ] Write tests with mock transport
8. [ ] Publish to PyPI

---

## 10. Streaming Token Output

### Goal
Enable token-by-token real-time streaming for agent text responses, so web GUIs and interactive clients can render output as it is generated.

### Scope
- New session start option: `stream: true` (default: `false`, backward compatible)
- When streaming is enabled, `assistant_text` events are emitted per-token-chunk instead of per-message
- New SSE event type: `stream_chunk` with `{ sessionId, type, content, index }`
- New notification: `bridge/stream_chunk` for HTTP transport
- Token chunks include partial text; client concatenates for full output
- Streaming session still emits `session_completed` with full result and usage

### Out of Scope
- Changing the default non-streaming behavior
- Streaming for tool_use/tool_result events (only text streaming)
- Server-side text transformation (markdown rendering, etc.)

### Key Decisions
- **Opt-in** — `stream: true` must be explicitly requested; existing clients unaffected
- **Chunk boundaries** — chunks follow SDK iterator yields; no artificial splitting
- **Backward compatible** — non-streaming sessions work exactly as before

### Tasks
1. [ ] Add `stream` option parsing in `session.start` and `session.resume`
2. [ ] Modify `claude-agent-runner.ts` to emit per-chunk events when streaming
3. [ ] Add `bridge/stream_chunk` notification type
4. [ ] Integrate streaming into SSE fan-out (`GET /events`)
5. [ ] Update `bridge.capabilities` to advertise streaming support
6. [ ] Update tests
7. [ ] Update `docs/bridge-contract.yaml`

---

## 11. WebSocket Transport

### Goal
Add WebSocket as a third transport option, enabling bidirectional real-time communication for interactive web GUIs.

### Scope
- Start mode: `--transport ws --port 8766` or `AI_SPEC_SDK_TRANSPORT=ws`
- Single WebSocket connection carries both requests (client→server) and notifications (server→client)
- Message format: JSON-RPC 2.0 over WebSocket frames (text frames only)
- Connection lifecycle: ping/pong keepalive (30s interval), reconnect advisory on server shutdown
- Session-scoped subscriptions: client subscribes to specific session events
- Graceful shutdown: send close frame with `code=1001` to all connected clients

### Out of Scope
- Binary WebSocket frames
- Message compression (permessage-deflate)
- WebSocket over TLS (terminate at reverse proxy)
- Multi-server clustering

### Key Decisions
- **Native WebSocket** — use `ws` npm package (de-facto standard, lightweight)
- **Same BridgeServer core** — WebSocket is a transport layer only
- **Frame-per-message** — each JSON-RPC message is one WebSocket text frame

### Tasks
1. [ ] Add `ws` dependency to package.json
2. [ ] Create `src/ws-server.ts` with WebSocket server
3. [ ] Implement bidirectional JSON-RPC over WebSocket
4. [ ] Add ping/pong keepalive
5. [ ] Add session-scoped event subscriptions
6. [ ] Update `src/cli.ts` for `--transport ws`
7. [ ] Update `bridge.capabilities` to advertise WebSocket
8. [ ] Write tests
9. [ ] Update `docs/bridge-contract.yaml`

---

## 12. Rate Limiting

### Goal
Add per-key rate limiting to the HTTP transport to prevent abuse and ensure fair resource allocation.

### Scope
- Token bucket algorithm per API key
- Configurable limits: requests per minute (default: 60), concurrent sessions (default: 5)
- Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Error response: HTTP 429 with `Retry-After` header
- Admin scope bypasses rate limits
- Configuration via env: `AI_SPEC_SDK_RATE_LIMIT_RPM`, `AI_SPEC_SDK_RATE_LIMIT_CONCURRENT`

### Out of Scope
- Global rate limiting (per-IP, etc.)
- Sliding window or leaky bucket algorithms
- Redis/external rate limit store (in-memory only)

### Key Decisions
- **Token bucket** — simple, well-understood, allows burst traffic
- **Per-key only** — matches auth model; unauthenticated requests are already limited to public methods
- **In-memory** — single-process bridge; no shared state needed

### Tasks
1. [ ] Implement token bucket rate limiter in `src/rate-limiter.ts`
2. [ ] Integrate into HTTP auth middleware (after key verification, before dispatch)
3. [ ] Add rate limit response headers
4. [ ] Add `AI_SPEC_SDK_RATE_LIMIT_*` env vars
5. [ ] Admin scope bypass logic
6. [ ] Write tests
7. [ ] Update `docs/bridge-contract.yaml`

---

## 13. Custom Tool Registration

### Goal
Allow users to register custom tools that become available to agent sessions, beyond the 14 built-in tools.

### Scope
- New methods: `tools.register({ name, description, parameters })`, `tools.unregister({ name })`
- Registered tools are persisted per-workspace in `<workspace>/.claude/custom-tools.json`
- `tools.list` returns both built-in and custom tools with a `source` field (`builtin` | `custom`)
- Custom tools are passed to `session.start` via `allowedTools` by name
- Tool implementation: custom tools are shell commands (similar to hooks); input passed as JSON via stdin, output read from stdout
- Error handling: tool execution timeout (30s default), non-zero exit code → tool error

### Out of Scope
- Remote tool endpoints (HTTP callback tools)
- Tool versioning or dependency management
- Tool sandboxing beyond process isolation

### Key Decisions
- **Shell-command tools** — matches hooks model; simple, universal, no language lock-in
- **Per-workscope persistence** — tools are workspace-specific, not global
- **stdin/stdout protocol** — JSON in, JSON out; same pattern as MCP

### Tasks
1. [ ] Create `src/custom-tools-store.ts` for tool persistence
2. [ ] Implement `tools.register` and `tools.unregister` bridge methods
3. [ ] Update `tools.list` to merge built-in + custom tools
4. [ ] Implement tool execution (spawn command, pipe JSON, capture output)
5. [ ] Integrate custom tools into session agent options
6. [ ] Update `bridge.capabilities` tool listing
7. [ ] Write tests
8. [ ] Update `docs/bridge-contract.yaml`

---

## 14. Multi-Agent Orchestration

### Goal
Enable sessions to spawn sub-agents, delegate tasks, and coordinate results, supporting complex multi-step workflows.

### Scope
- New session option: `subagents: true` (default: `false`)
- New method: `session.spawn({ parentSessionId, prompt, options })` — creates a child agent session
- Parent-child relationship: parent receives `child_completed` / `child_failed` notifications
- New notification: `bridge/subagent_event` with `{ parentSessionId, childSessionId, type, data }`
- `session.list` gains optional `parentSessionId` filter to find children
- Child sessions inherit parent workspace and can optionally inherit model/config
- Result propagation: child session result is available via `session.status` → `childResult`

### Out of Scope
- Agent-to-agent direct communication (all coordination via bridge)
- Persistent agent networks / agent pools
- Cost allocation per sub-agent

### Key Decisions
- **Bridge-mediated** — bridge orchestrates parent-child relationships; agents don't communicate directly
- **Opt-in** — sub-agents must be explicitly enabled per session
- **Independent sessions** — each child is a full session with its own history and lifecycle

### Tasks
1. [ ] Add parent-child session tracking to `SessionStore`
2. [ ] Implement `session.spawn` bridge method
3. [ ] Add sub-agent event propagation (child → parent notifications)
4. [ ] Update `session.list` with `parentSessionId` filter
5. [ ] Update `session.start` with `subagents` option
6. [ ] Write tests
7. [ ] Update `docs/bridge-contract.yaml`

---

## 15. OpenTelemetry / Metrics

### Goal
Add OpenTelemetry-compatible metrics and tracing for production observability of bridge performance and token consumption.

### Scope
- Metrics endpoint: `GET /metrics` (Prometheus text format)
- Tracked metrics:
  - `bridge_requests_total` (method, status)
  - `bridge_request_duration_seconds` (method)
  - `bridge_sessions_active` (gauge)
  - `bridge_tokens_consumed` (model, type: input/output)
  - `bridge_errors_total` (code)
- Optional OpenTelemetry tracing: span per JSON-RPC method call
- Configuration via env: `AI_SPEC_SDK_OTEL_ENABLED`, `AI_SPEC_SDK_OTEL_ENDPOINT`
- Metrics endpoint requires admin scope on HTTP transport

### Out of Scope
- Log shipping to OpenTelemetry collector
- Custom metric dashboards
- Distributed tracing across multiple bridges

### Key Decisions
- **Prometheus format** — most widely supported; works with Grafana, Datadog, etc.
- **Opt-in** — metrics disabled by default; env var to enable
- **No external dependency** — hand-roll Prometheus text format (simple format, ~100 LOC)

### Tasks
1. [ ] Create `src/metrics.ts` with in-memory counters and histograms
2. [ ] Instrument bridge dispatch with metrics collection
3. [ ] Implement `GET /metrics` endpoint in HTTP server
4. [ ] Add token consumption tracking in session completion
5. [ ] Add `AI_SPEC_SDK_OTEL_*` env vars
6. [ ] Write tests
7. [ ] Update `docs/bridge-contract.yaml`

---

## 16. Session Templates

### Goal
Save and reuse common session configurations to reduce repetitive parameter passing.

### Scope
- New methods: `templates.save({ name, config })`, `templates.load({ name })`, `templates.list`, `templates.delete({ name })`
- Template config includes: `model`, `permissionMode`, `systemPrompt`, `allowedTools`, `disallowedTools`, `maxTurns`
- Storage: `<workspace>/.ai-spec-templates/<name>.json`
- `session.start` gains optional `template` param; template values serve as defaults, explicit params override
- Templates are workspace-scoped; user can also save to `~/.ai-spec-templates/` for global access

### Out of Scope
- Template versioning
- Template sharing/marketplace
- Template validation beyond schema check

### Key Decisions
- **Workspace-scoped** — templates are project-specific by default
- **Override semantics** — explicit params always win over template
- **Simple JSON** — no templating language, just key-value defaults

### Tasks
1. [ ] Create `src/template-store.ts` for template persistence
2. [ ] Implement `templates.save`, `templates.load`, `templates.list`, `templates.delete` bridge methods
3. [ ] Update `session.start` to accept `template` param with override logic
4. [ ] Write tests
5. [ ] Update `docs/bridge-contract.yaml`

---

## 17. Cross-Platform Release

### Goal
Automate building and publishing native binaries for all major platforms via CI.

### Scope
- Build matrix: linux-x64, linux-arm64, macos-x64, macos-arm64, windows-x64
- GitHub Release with all binaries + SHA-256 checksums
- Homebrew tap for macOS (`brew install ai-spec-sdk/tap/ai-spec-bridge`)
- npm package with postinstall hint for native binary

### Out of Scope
- Snap/Flatpak/AppImage packaging
- Signed binaries (code signing)
- Auto-update mechanism

### Key Decisions
- **GitHub Release** — standard distribution for open-source binaries
- **Bun compile** — existing `build:native` script; just needs per-OS runners
- **Checksums** — SHA-256 for integrity verification

### Tasks
1. [ ] Add cross-platform build steps to release workflow
2. [ ] Generate SHA-256 checksums for all binaries
3. [ ] Set up Homebrew tap repository
4. [ ] Test binaries on each target platform
5. [ ] Document installation methods in README

---

## 18. Event Webhooks

### Goal
Allow external systems to subscribe to bridge events via HTTP webhooks.

### Scope
- New methods: `webhooks.subscribe({ url, events[], secret? })`, `webhooks.unsubscribe({ id })`, `webhooks.list`
- Supported events: `session_completed`, `session_failed`, `session_stopped`, `tool_approval_requested`
- Webhook delivery: HTTP POST with JSON payload, HMAC-SHA256 signature in `X-AI-Spec-Signature` header
- Retry: 3 attempts with exponential backoff (1s, 5s, 15s)
- Webhook storage: `~/.ai-spec-sdk/webhooks.json`
- Admin scope required for webhook management

### Out of Scope
- Webhook filtering by session/workspace
- Webhook response processing
- Dead letter queue

### Key Decisions
- **HMAC signatures** — standard webhook security; subscriber verifies with shared secret
- **Admin-only** — webhooks are infrastructure-level, not session-level
- **Simple retry** — 3 attempts is sufficient for reliable delivery without complexity

### Tasks
1. [ ] Create `src/webhook-store.ts` for webhook persistence
2. [ ] Implement webhook delivery with HTTP POST and HMAC signing
3. [ ] Add retry logic with exponential backoff
4. [ ] Implement `webhooks.subscribe`, `webhooks.unsubscribe`, `webhooks.list`
5. [ ] Integrate webhook triggers into session lifecycle
6. [ ] Write tests
7. [ ] Update `docs/bridge-contract.yaml`

---

## Implementation Timeline

```
Phase 1 (v0.2.0): ✅ Structured Logging + ✅ API Versioning
  └── ✅ Logging: foundation, all modules get log instrumentation
  └── ✅ Versioning: bridge.capabilities + negotiateVersion

Phase 2 (v0.3.0): ✅ Session Persistence
  └── ✅ File-based storage, crash recovery, cleanup

Phase 3 (v0.4.0): ✅ HTTP/SSE Transport
  └── ✅ POST /rpc + GET /events + health check

Phase 4 (v0.5.0): ✅ Authentication & Authorization
  └── ✅ API keys, scopes, method-level access control

Phase 5 (v0.6.0): Mobile Web UI
  └── Mobile-first chat interface, served by bridge, API key login

Phase 6 (v0.7.0): TS Client SDK + Streaming
  ├── TS Client SDK: official npm client package
  └── Streaming Token Output: real-time agent response

Phase 7 (v0.8.0): Cross-Platform Release + Custom Tools + Rate Limiting
  ├── Cross-Platform Release: native binaries for all OSes
  ├── Custom Tool Registration: extensible tool surface
  └── Rate Limiting: per-key token bucket

Phase 8 (v0.9.0): WebSocket + Multi-Agent + Python Client
  ├── WebSocket Transport: bidirectional real-time
  ├── Multi-Agent Orchestration: parent-child sessions
  └── Python Client SDK: PyPI package

Phase 9 (v0.10.0): Observability + Templates + Webhooks + Java CLI Demo
  ├── OpenTelemetry / Metrics: Prometheus endpoint
  ├── Session Templates: reusable configs
  ├── Event Webhooks: external system integration
  └── Java CLI Demo: JVM reference implementation

v1.0.0: All above stabilized
  └── First stability guarantee
```

---

## Version Milestones

| Version | Includes | Breaking Changes |
|---------|----------|-----------------|
| v0.2.0 | ✅ Structured Logging, ✅ API Versioning | None (additive) |
| v0.3.0 | ✅ Session Persistence | `SessionStore` internal refactor (no API break) |
| v0.4.0 | ✅ HTTP/SSE Transport | None (new transport, stdio unchanged) |
| v0.5.0 | ✅ Auth | HTTP requests now require Bearer token by default |
| v0.6.0 | **Mobile Web UI** | None (additive, static files served by bridge) |
| v0.7.0 | TS Client SDK, Streaming | None (additive) |
| v0.8.0 | Cross-Platform Release, Custom Tools, Rate Limiting | None (additive) |
| v0.9.0 | WebSocket, Multi-Agent, Python Client | None (new transport, sub-agents opt-in) |
| v0.10.0 | OpenTelemetry, Templates, Webhooks, Java CLI Demo | None (additive) |
| v1.0.0 | All above stabilized | First stability guarantee |

---

## Dependency Graph

```
Structured Logging ──┬──> ✅ Session Persistence
                     │
                     └──> ✅ API Versioning ──> ✅ HTTP/SSE ──> ✅ Auth
                                                                │
                                                                ├──> Rate Limiting
                                                                ├──> Webhooks
                                                                └──> OpenTelemetry Metrics

Mobile Web UI (depends on HTTP/SSE Transport + Auth)
Java CLI Demo (independent, low priority)
TS Client SDK (depends on stable API)
Python Client SDK (depends on stable API + TS Client patterns)
Streaming Output (depends on HTTP/SSE transport)
WebSocket Transport (depends on HTTP/SSE patterns)
Custom Tools (independent)
Multi-Agent (depends on Session Persistence)
Session Templates (depends on Session Persistence)
Cross-Platform Release (independent)
Event Webhooks (depends on Auth)
```

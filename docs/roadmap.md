# ai-spec-sdk Roadmap

## Selected Directions

| # | Direction | Priority | Depends On |
|---|-----------|----------|------------|
| 1 | ✅ Structured Logging | P0 | — |
| 2 | ✅ API Versioning | P0 | Structured Logging |
| 3 | ✅ Session Persistence | P0 | Structured Logging |
| 4 | HTTP/SSE Transport | P1 | API Versioning |
| 5 | Authentication & Authorization | P1 | HTTP/SSE Transport |
| 6 | Java CLI Demo | P0 | — |

## Dependency Graph

```
Structured Logging ──┬──> Session Persistence
                     │
                     └──> API Versioning ──> HTTP/SSE ──> Auth

Java CLI Demo (independent, can start immediately)
```

Three parallel tracks after logging is done:
- **Track A**: Session Persistence (independent, can run in parallel with Track B)
- **Track B**: API Versioning → HTTP/SSE → Auth (sequential chain)

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

## 6. Java CLI Demo

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

## Implementation Timeline

```
Phase 1 (v0.2.0): Java CLI Demo + ✅ Structured Logging + API Versioning
  ├── Java CLI Demo: independent, can ship immediately
  ├── ✅ Logging: foundation, all modules get log instrumentation
  └── Versioning: bridge.capabilities + negotiateVersion

Phase 2 (v0.3.0): ✅ Session Persistence
  └── File-based storage, crash recovery, cleanup

Phase 3 (v0.4.0): HTTP/SSE Transport
  └── POST /rpc + GET /events + health check

Phase 4 (v0.5.0): Authentication & Authorization
  └── API keys, scopes, method-level access control
```

Phases 2 and 3 can overlap — persistence and HTTP transport are independent once logging and versioning are in place.

---

## Version Milestones

| Version | Includes | Breaking Changes |
|---------|----------|-----------------|
| v0.2.0 | Java CLI Demo, ✅ Structured Logging, API Versioning | None (additive) |
| v0.3.0 | ✅ Session Persistence | `SessionStore` internal refactor (no API break) |
| v0.4.0 | HTTP/SSE Transport | None (new transport, stdio unchanged) |
| v0.5.0 | Auth | HTTP requests now require Bearer token by default |
| v1.0.0 | All above stabilized | First stability guarantee |

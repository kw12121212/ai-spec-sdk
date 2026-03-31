# Tasks: python-client-sdk

## Implementation

- [x] Create `clients/python/` with `pyproject.toml` (Python 3.10+, dependency on `claude-agent-sdk`, dev deps: pytest, pytest-asyncio)
- [x] Create `src/ai_spec_sdk/errors.py` with `UnsupportedInStdioError`, `BridgeClientError`, `TransportError` exception classes
- [x] Create `src/ai_spec_sdk/types.py` with typed dataclasses for request/response params (SessionStartParams, SessionResult, EventPayload, etc.)
- [x] Create `src/ai_spec_sdk/events.py` with event listener registry (`EventEmitter` class supporting `on`, `off`, `emit`)
- [x] Create `src/ai_spec_sdk/transports/base.py` with abstract `Transport` base class (connect, disconnect, request, on_event)
- [x] Implement `src/ai_spec_sdk/transports/stdio.py` — `StdioTransport` wrapping `claude-agent-sdk`'s `ClaudeSDKClient` for session start/resume/stop, streaming event mapping, agent control param mapping
- [x] Implement `src/ai_spec_sdk/transports/http.py` — `HttpTransport` with JSON-RPC 2.0 over `POST /rpc`, SSE parsing for `GET /events`, Bearer token auth, reconnection with exponential backoff
- [x] Implement `src/ai_spec_sdk/client.py` — `BridgeClient` with unified API, transport selection, camelCase method names matching TS Client SDK, `UnsupportedInStdioError` guard for stdio mode, async context manager, non-blocking sessionStart/sessionResume with event streaming via `on()`
- [x] Create `src/ai_spec_sdk/__init__.py` with public API exports (`BridgeClient`, `StdioTransport`, `HttpTransport`, error classes, type classes)

## Testing

- [x] Unit tests for `StdioTransport`: mock `ClaudeSDKClient`, verify session start/resume/stop param mapping, streaming event translation, `UnsupportedInStdioError` for bridge-only methods
- [x] Unit tests for `HttpTransport`: mock HTTP responses, verify JSON-RPC request format, SSE parsing, auth header, reconnection logic, error code handling
- [x] Unit tests for `BridgeClient`: verify transport selection, method routing, event listener registration, context manager lifecycle
- [x] Unit tests for `types.py`: verify dataclass construction and field validation
- [x] All tests pass with `pytest`

## Verification

- [ ] Verify package installs cleanly (`pip install -e .`) — requires `claude-agent-sdk` install, manual
- [ ] Verify stdio mode can start a session with a real Claude CLI (manual smoke test)
- [ ] Verify HTTP mode can connect to a running bridge and call methods (manual smoke test)
- [x] Verify `UnsupportedInStdioError` is raised for bridge-only methods in stdio mode
- [x] Verify no external HTTP dependencies — only `claude-agent-sdk` as required dependency

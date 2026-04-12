---
mapping:
  implementation: []
  tests: []
---
## ADDED Requirements

### Requirement: Python BridgeClient Dual Transport
The `ai-spec-sdk` Python package MUST provide a `BridgeClient` that supports two transport modes: `"stdio"` and `"http"`.

When `transport="stdio"`, the client MUST use `claude-agent-sdk` to spawn Claude Code CLI as a subprocess and communicate via its native stdin/stdout JSON-lines protocol.

When `transport="http"`, the client MUST connect to a running ai-spec-sdk bridge via HTTP POST `/rpc` for JSON-RPC requests and GET `/events` for SSE event streaming.

#### Scenario: Create client with stdio transport
- GIVEN a Python developer installs `ai-spec-sdk`
- WHEN they create `BridgeClient(transport="stdio")`
- THEN the client uses `claude-agent-sdk` to communicate with Claude CLI

#### Scenario: Create client with HTTP transport
- GIVEN a bridge is running on `localhost:8765`
- WHEN a Python developer creates `BridgeClient(transport="http", host="localhost", port=8765, api_key="...")`
- THEN the client connects to the bridge via HTTP/SSE

### Requirement: Python Async-Only API
The `BridgeClient` MUST be async-only. All public methods MUST be coroutines (`async def`). The client MUST support the `async with` context manager protocol for lifecycle management.

#### Scenario: Use as async context manager
- GIVEN a `BridgeClient` instance
- WHEN used with `async with BridgeClient() as client:`
- THEN the client connects on entry and disconnects on exit

### Requirement: Python Method Naming Convention
All `BridgeClient` public methods MUST use camelCase naming to match the TypeScript Client SDK convention (e.g., `sessionStart`, `sessionList`, `bridgeCapabilities`).

#### Scenario: Method names match TS Client SDK
- GIVEN both the Python and TypeScript Client SDKs
- WHEN comparing their method signatures
- THEN the Python method names match the TypeScript names exactly (e.g., `sessionStart` in both)

### Requirement: Python Stdio Session Lifecycle
In stdio mode, `BridgeClient` MUST support `sessionStart`, `sessionResume`, and `sessionStop` by mapping to `claude-agent-sdk`'s `ClaudeSDKClient` methods.

- `sessionStart(workspace, prompt, **options)` → `ClaudeSDKClient.connect(prompt)` with `ClaudeAgentOptions` mapped from options
- `sessionResume(sessionId, prompt, **options)` → `ClaudeSDKClient.query(prompt, session_id=..., resume=True)`
- `sessionStop(sessionId)` → `ClaudeSDKClient.interrupt()`

`sessionStart` and `sessionResume` MUST return immediately with a result containing the session ID. Agent output MUST be delivered asynchronously via `on("session_event", handler)` callbacks, not by blocking until completion.

Agent control parameters MUST map as follows:

| BridgeClient param | ClaudeAgentOptions field |
|---|---|
| `model` | `model` |
| `allowedTools` | `allowed_tools` |
| `disallowedTools` | `disallowed_tools` |
| `permissionMode` | `permission_mode` |
| `maxTurns` | `max_turns` |
| `systemPrompt` | `system_prompt` |
| `stream` | `stream` |

#### Scenario: Start session with model and tools in stdio mode
- GIVEN a `BridgeClient` with stdio transport
- WHEN `await client.sessionStart(workspace="/project", prompt="Fix the bug", model="claude-sonnet-4-6", allowedTools=["Read", "Edit"])`
- THEN `claude-agent-sdk` spawns Claude CLI with the specified model and tool allowlist

#### Scenario: Start session returns immediately
- GIVEN a `BridgeClient` with stdio transport
- WHEN `result = await client.sessionStart(workspace="/project", prompt="Hello")`
- THEN `result` is returned immediately and subsequent agent output arrives via `on("session_event", handler)` callbacks

#### Scenario: Resume session in stdio mode
- GIVEN a `BridgeClient` with stdio transport and a previous session ID
- WHEN `await client.sessionResume(sessionId="abc-123", prompt="Continue")`
- THEN `claude-agent-sdk` resumes the session with the given ID

### Requirement: Python HTTP Full Method Surface
In HTTP mode, `BridgeClient` MUST support all bridge JSON-RPC methods by sending requests to `POST /rpc` and returning the parsed response.

Methods MUST use camelCase naming matching the TS Client SDK (e.g., `sessionList` maps to `session.list` JSON-RPC method).

#### Scenario: List sessions via HTTP
- GIVEN a `BridgeClient` with HTTP transport connected to a bridge
- WHEN `await client.sessionList()`
- THEN the client sends a JSON-RPC request for `session.list` and returns the sessions array

#### Scenario: Get config via HTTP
- GIVEN a `BridgeClient` with HTTP transport
- WHEN `await client.configGet(key="logLevel")`
- THEN the client sends a JSON-RPC request for `config.get` with the key parameter

### Requirement: Python Stdio Unsupported Method Guard
When a bridge-only method is called in stdio mode, the `BridgeClient` MUST raise `UnsupportedInStdioError` with a message indicating which methods are available in stdio mode and suggesting HTTP transport for full functionality.

Bridge-only methods include: `sessionStatus`, `sessionList`, `sessionHistory`, `sessionSearch`, `sessionBranch`, `sessionExport`, `sessionDelete`, `sessionCleanup`, `sessionEvents`, `sessionApproveTool`, `sessionRejectTool`, `configGet`, `configSet`, `configList`, `toolsList`, `modelsList`, `workspaceRegister`, `workspaceList`, `bridgeCapabilities`, `bridgePing`, `bridgeInfo`, `bridgeSetLogLevel`, `bridgeNegotiateVersion`, `mcpAdd`, `mcpRemove`, `mcpStart`, `mcpStop`, `mcpList`, `hooksAdd`, `hooksRemove`, `hooksList`, `contextRead`, `contextWrite`, `contextList`, `workflowRun`, `skillsList`.

#### Scenario: Call bridge-only method in stdio mode
- GIVEN a `BridgeClient` with stdio transport
- WHEN `await client.sessionList()`
- THEN the client raises `UnsupportedInStdioError` suggesting HTTP transport

### Requirement: Python Event Listener
The `BridgeClient` MUST provide an `on(event_name, callback)` method for subscribing to session events.

In stdio mode, events from `claude-agent-sdk`'s `receive_messages()` MUST be mapped to `session_event` notifications matching the bridge's event schema.

In HTTP mode, SSE events MUST be parsed and delivered to registered callbacks.

#### Scenario: Listen for session events in stdio mode
- GIVEN a `BridgeClient` with stdio transport and a registered event handler
- WHEN the agent produces messages during a session
- THEN the handler receives mapped `session_event` notifications with `type` and `messageType` fields

#### Scenario: Listen for session events in HTTP mode
- GIVEN a `BridgeClient` with HTTP transport subscribed to a session's events
- WHEN the bridge emits an SSE event
- THEN the registered handler receives the parsed event

### Requirement: Python HTTP Authentication
When `api_key` is provided to `BridgeClient` in HTTP mode, the client MUST include `Authorization: Bearer <key>` header on all HTTP requests.

#### Scenario: API key is sent with requests
- GIVEN a `BridgeClient` with HTTP transport and `api_key="my-key"`
- WHEN any method is called
- THEN the HTTP request includes `Authorization: Bearer my-key` header

### Requirement: Python HTTP SSE Reconnection
The `HttpTransport` MUST automatically reconnect to the SSE event stream if the connection is lost, using exponential backoff starting at 1 second, capped at 30 seconds.

#### Scenario: SSE reconnects after disconnect
- GIVEN a `BridgeClient` with HTTP transport is receiving SSE events
- WHEN the connection is lost
- THEN the client retries with exponential backoff and resumes event delivery upon reconnection

### Requirement: Python Custom Tools in Stdio Mode
In stdio mode, the `BridgeClient` MUST allow registering custom tools that are passed to `claude-agent-sdk`'s `ClaudeAgentOptions(tools=...)`.

#### Scenario: Register custom tool for stdio session
- GIVEN a `BridgeClient` with stdio transport
- WHEN a custom tool is registered and `sessionStart` is called
- THEN the tool is available to the agent during the session

### Requirement: Python Dependency Declaration
The package MUST declare `claude-agent-sdk` as a required dependency. The package MUST NOT declare any HTTP-specific external dependencies (httpx, aiohttp, requests, etc.).

#### Scenario: Package installs with claude-agent-sdk
- GIVEN a Python environment with `pip`
- WHEN `pip install ai-spec-sdk` is run
- THEN `claude-agent-sdk` is installed as a dependency

#### Scenario: HTTP transport works without extra dependencies
- GIVEN only `ai-spec-sdk` and its declared dependencies are installed
- WHEN a `BridgeClient` is created with `transport="http"`
- THEN the client connects and communicates successfully using only Python stdlib
# Delta Specification: python-client-sdk.md

## MODIFIED Requirements

### Requirement: Modify `client/python-client-sdk.md` to include a `WebSocketTransport` class in the `ai-spec-sdk` Python package.
This modifies the Python SDK specification to define a new asynchronous transport implementation utilizing a suitable Python WebSocket client library.

### Requirement: The `WebSocketTransport` MUST implement the `Transport` interface (or Python equivalent).
The new Python transport MUST adhere strictly to the internal Python transport abstraction to ensure seamless substitutability within the `BridgeClient`.

### Requirement: The `WebSocketTransport` MUST support automatic reconnection with exponential backoff on disconnect.
The Python client MUST autonomously attempt to re-establish dropped WebSocket connections, utilizing an exponential backoff strategy to ensure robust long-running sessions.

### Requirement: The `WebSocketTransport` MUST multiplex JSON-RPC 2.0 requests and notifications over the single connection.
The Python transport MUST handle sending requests and routing asynchronous responses and notifications over the same underlying WebSocket stream.

### Requirement: Update `BridgeClient` to support instantiating `WebSocketTransport` using `ws://` URIs.
The Python `BridgeClient` initialization logic MUST be updated to recognize `ws://` and `wss://` URI schemes and instantiate the `WebSocketTransport` accordingly.

### Requirement: Python Client Session Spawn Support
In HTTP mode, the Python `BridgeClient` MUST expose `sessionSpawn(parentSessionId=..., prompt=..., ...)` and send the `session.spawn` JSON-RPC request.

In stdio mode, `sessionSpawn` MUST raise `UnsupportedInStdioError`.

#### Scenario: Spawn a child session through the Python client
- GIVEN a Python client is connected to the bridge over HTTP
- WHEN the caller invokes `await client.sessionSpawn(parentSessionId="parent-1", prompt="Delegate")`
- THEN the client sends a `session.spawn` request with those params

### Requirement: Python Parent Session Filtering
The Python client helper types and method surface MUST support passing `parentSessionId` to `sessionList`.

#### Scenario: Filter child sessions by parent from Python
- GIVEN a Python client calls `await client.sessionList(parentSessionId="parent-1")`
- WHEN the request is sent to the bridge
- THEN the JSON-RPC params include `parentSessionId`

### Requirement: Python Subagent Notification Handlers
The Python client event system MUST allow handlers to subscribe to `bridge/subagent_event`.

Method-specific handlers MUST receive the notification params, including `sessionId`, `subagentId`, and `type`.

#### Scenario: Subscribe to child notifications from Python
- GIVEN a Python client registers `client.on("bridge/subagent_event", handler)`
- WHEN the bridge emits a subagent notification
- THEN the handler receives the notification params

### Requirement: JSON-RPC Stdio Bridge
The SDK MUST expose a local JSON-RPC 2.0 interface over standard input and standard output so external tools can call it as a subprocess.

#### Scenario: Handle a valid bridge request
- GIVEN a client starts the SDK bridge as a local process
- WHEN the client sends a valid JSON-RPC 2.0 request to standard input
- THEN the bridge returns a JSON-RPC 2.0 response on standard output

#### Scenario: Reject an unsupported method
- GIVEN a client sends a JSON-RPC 2.0 request for an unsupported method
- WHEN the bridge validates the request
- THEN the bridge returns a structured JSON-RPC error response that identifies the failure

### Requirement: Capability Discovery
The SDK MUST provide a bridge capability response that tells clients which workflow operations, session features, and streaming behaviors are supported by the current SDK version.

#### Scenario: Discover bridge capabilities
- GIVEN a client connects to the bridge without prior version-specific assumptions
- WHEN the client requests bridge capabilities
- THEN the bridge returns machine-readable capability metadata for the current process

### Requirement: Streaming Notifications
The SDK MUST emit machine-readable notifications for long-running workflow and session activity so clients can present progress before a final result is available.

#### Scenario: Stream progress for a long-running request
- GIVEN a client starts a workflow or session operation that does not complete immediately
- WHEN the bridge produces intermediate progress events
- THEN the bridge sends notifications correlated to the originating request or session identifier

### Requirement: Session Event Notification Schema
The bridge MUST emit `bridge/session_event` notifications with a `type` field whose value is one of the defined event types, and MUST include exactly the fields specified for that type. Integrators MUST be able to identify any event solely from its `type` field without inspecting the `message` sub-object.

Defined event types and their required fields:

| `type` | Additional required fields |
|---|---|
| `session_started` | `sessionId` |
| `session_resumed` | `sessionId` |
| `session_completed` | `sessionId`, `result` |
| `session_stopped` | `sessionId`, `status` |
| `agent_message` | `sessionId`, `messageType`, `message` |

#### Scenario: Notification carries the correct type label
- GIVEN a bridge event is emitted during a session lifecycle transition or agent message
- WHEN an integrator reads the `bridge/session_event` notification
- THEN the notification contains a `type` field matching one of the defined type values above

### Requirement: Agent Message Sub-type Contract
The bridge MUST classify each `agent_message` notification with a stable `messageType` label. The label MUST correspond to the observable shape of the SDK-emitted message as follows:

| `messageType` | Observable shape |
|---|---|
| `system_init` | `type === "system"` AND `subtype === "init"` — carries `session_id` and `model` |
| `assistant_text` | `type === "assistant"` with at least one `"text"` content block AND no `"tool_use"` blocks |
| `tool_use` | `type === "assistant"` with at least one `"tool_use"` content block (takes precedence over `"text"` blocks) — carries `name` and `input` |
| `tool_result` | `type === "user"` with at least one content block of type `"tool_result"` |
| `result` | `type === "result"` — carries `subtype` (`"success"` or `"error"`) and `result` |
| `other` | Any message shape not matching the above — forwarded as-is without transformation |

The bridge MUST inspect content blocks from `message.message.content` when the SDK wraps the message in a nested `message` object (standard SDK format), and MUST fall back to `message.content` when the content array is at the top level.

When an assistant message contains both `"tool_use"` and `"text"` content blocks, the bridge MUST classify it as `tool_use`.

#### Scenario: assistant_text event carries text content
- GIVEN the agent emits a message of type `"assistant"` with a text content block and no tool_use blocks
- WHEN the bridge forwards it as an `agent_message` notification
- THEN the notification has `messageType === "assistant_text"` and the `message` field contains the text content block

#### Scenario: tool_use event carries tool name and input
- GIVEN the agent emits a message of type `"assistant"` with a tool_use content block
- WHEN the bridge forwards it as an `agent_message` notification
- THEN the notification has `messageType === "tool_use"` and the `message.content` array contains a block with the tool `name` and `input`

#### Scenario: tool_use takes precedence over text in mixed content
- GIVEN the agent emits a message of type `"assistant"` containing both `"tool_use"` and `"text"` content blocks
- WHEN the bridge classifies the message
- THEN the notification has `messageType === "tool_use"`

#### Scenario: result event marks session outcome
- GIVEN the agent emits a terminal result message
- WHEN the bridge forwards it as an `agent_message` notification
- THEN the notification has `messageType === "result"` and the `message` field includes `subtype` and `result`

#### Scenario: unrecognized message is forwarded as other
- GIVEN the agent emits a message that does not match any defined shape
- WHEN the bridge forwards it as an `agent_message` notification
- THEN the notification has `messageType === "other"` and the full message is forwarded without transformation

### Requirement: Session Listing
The bridge MUST expose a `session.list` method that returns summaries of sessions known to the current bridge process.

#### Scenario: List all sessions
- GIVEN a client calls `session.list` without a `status` filter
- WHEN the bridge processes the request
- THEN the response contains a `sessions` array with up to 100 entries, ordered by `createdAt` descending, each including: `sessionId`, `status`, `workspace`, `createdAt`, `updatedAt`

#### Scenario: Filter by active status
- GIVEN a client calls `session.list` with `{ "status": "active" }`
- WHEN the bridge processes the request
- THEN the response `sessions` array contains only sessions whose `status` is `"active"`, up to 100 entries

#### Scenario: Response is capped at 100 entries
- GIVEN more than 100 sessions exist in the bridge process
- WHEN the client calls `session.list`
- THEN the response contains at most 100 entries (the most recent by `createdAt`)

#### Scenario: Unknown status filter is rejected
- GIVEN a client calls `session.list` with an unrecognized `status` value
- WHEN the bridge validates the request
- THEN the bridge returns a `-32602` error

### Requirement: Session History Method in Capabilities
The bridge capability response MUST advertise `session.history` as a supported method so clients can discover it without trial and error.

#### Scenario: Capabilities include session.history
- GIVEN a client calls `bridge.capabilities`
- WHEN the bridge returns its capability metadata
- THEN the response identifies `session.history` as a supported method

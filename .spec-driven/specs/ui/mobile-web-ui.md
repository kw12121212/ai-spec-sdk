## ADDED Requirements

### Requirement: Mobile Web UI Served at Root
When the bridge is running in HTTP mode and `AI_SPEC_SDK_UI_ENABLED` is not set to `"false"`, a `GET /` request MUST return the content of `src/ui/index.html` with `Content-Type: text/html; charset=utf-8` and HTTP 200.

When `AI_SPEC_SDK_UI_ENABLED` is set to `"false"`, `GET /` MUST return HTTP 404.

#### Scenario: UI served when enabled
- GIVEN the bridge is running in HTTP mode and `AI_SPEC_SDK_UI_ENABLED` is not `"false"`
- WHEN a client requests `GET /`
- THEN the bridge returns the content of `src/ui/index.html` with HTTP 200

#### Scenario: UI disabled returns 404
- GIVEN the bridge is running with `AI_SPEC_SDK_UI_ENABLED=false`
- WHEN a client requests `GET /`
- THEN the bridge returns HTTP 404

### Requirement: Login View
The UI MUST display a login view when no API key is stored in `localStorage`. The view MUST accept an API key string input and a submit button. On submit, the UI MUST store the key in `localStorage` under a `ai_spec_sdk_api_key` key and transition to the session list view.

The UI MUST validate the key by calling `bridge.capabilities` via `POST /rpc` with the key as a Bearer token. If the call returns an auth error, the UI MUST display an error message and remain on the login view.

#### Scenario: First visit shows login
- GIVEN a user opens the bridge URL in a mobile browser for the first time
- WHEN the page loads
- THEN the login view is displayed with an API key input field

#### Scenario: Valid key transitions to session list
- GIVEN a user enters a valid API key and submits
- WHEN the UI calls `bridge.capabilities` with the Bearer token and gets a success response
- THEN the key is stored in `localStorage` and the session list view is shown

#### Scenario: Invalid key shows error
- GIVEN a user enters an invalid API key and submits
- WHEN the UI calls `bridge.capabilities` and gets an auth error
- THEN an error message is displayed and the login view remains visible

#### Scenario: Returning user skips login
- GIVEN a user has previously entered a valid API key
- WHEN the page loads and a key exists in `localStorage`
- THEN the login view is skipped and the session list view is shown

### Requirement: Session List View
The UI MUST display a session list view showing all sessions returned by `session.list`. Each session entry MUST show: status badge (color-coded), prompt preview (first 100 characters), workspace path, and relative timestamp.

Status badges MUST use distinct colors: `active` (green), `completed` (blue), `stopped` (gray), `interrupted` (orange).

Tapping an `active` session MUST open the chat view for that session. Tapping a `completed` or `stopped` session MUST open the chat view in read-only mode showing session history. Tapping an `interrupted` session MUST prompt to resume.

The view MUST include a "New Session" button that transitions to the chat view's new session form.

#### Scenario: Session list displays all sessions
- GIVEN the user has past sessions
- WHEN the session list view loads
- THEN each session is displayed with its status badge, prompt preview, workspace, and timestamp

#### Scenario: Tap active session opens chat
- GIVEN an active session exists in the list
- WHEN the user taps on it
- THEN the chat view opens showing real-time output for that session

#### Scenario: Tap interrupted session prompts resume
- GIVEN an interrupted session exists in the list
- WHEN the user taps on it
- THEN the UI offers to resume the session

### Requirement: Chat View — New Session
The UI MUST provide a form to start a new session with: a workspace input field (free text with an optional picker from `workspace.list`), a prompt text input, and a permission mode selector defaulting to `bypassPermissions`.

On submit, the UI MUST call `session.start` via `POST /rpc` with the provided workspace, prompt, and selected permission mode. On success, the UI MUST open an SSE connection to `GET /events?sessionId=<id>` and begin rendering events.

#### Scenario: Start new session
- GIVEN the user fills in workspace and prompt and submits
- WHEN `session.start` returns successfully
- THEN an SSE connection is opened and events begin rendering in the chat view

#### Scenario: Workspace picker shows registered workspaces
- GIVEN the user taps the workspace picker button
- WHEN `workspace.list` returns workspaces
- THEN the workspaces are shown as selectable options

### Requirement: Chat View — Real-Time Event Rendering
The UI MUST render `bridge/session_event` notifications received via SSE, classified by `type` and `messageType`:

| Event | Rendering |
|---|---|
| `agent_message` with `messageType: "assistant_text"` | Text content in a chat bubble |
| `agent_message` with `messageType: "tool_use"` | Tool call card showing tool name and input summary |
| `agent_message` with `messageType: "tool_result"` | Tool result summary (truncated if long) |
| `agent_message` with `messageType: "result"` | Final result in a prominent card |
| `session_completed` | Session completion indicator with usage stats |
| `session_stopped` | Session stopped indicator |

The chat view MUST auto-scroll to the latest event as events arrive. The user MUST be able to scroll up to view history; auto-scroll pauses when the user scrolls up and resumes when they scroll to the bottom.

#### Scenario: Assistant text renders as chat bubble
- GIVEN an SSE event with `type: "agent_message"` and `messageType: "assistant_text"` is received
- WHEN the UI processes the event
- THEN the text content is rendered in a styled chat bubble

#### Scenario: Tool use renders as card
- GIVEN an SSE event with `messageType: "tool_use"` is received
- WHEN the UI processes the event
- THEN a card showing the tool name and input summary is rendered

### Requirement: Chat View — Tool Approval
When a `bridge/tool_approval_requested` notification is received via SSE, the UI MUST render an approval card showing: tool name, input summary, and two buttons — "Approve" and "Reject".

Tapping "Approve" MUST call `session.approveTool` with the notification's `sessionId` and `requestId`. Tapping "Reject" MUST call `session.rejectTool` with the same parameters and an optional denial reason.

After the user responds, the approval card MUST be visually marked as resolved (approved or rejected) and MUST NOT accept further input.

#### Scenario: Tool approval card appears
- GIVEN a session is running with `permissionMode: "default"` or `"approve"`
- WHEN a `bridge/tool_approval_requested` notification is received
- THEN an approval card with approve/reject buttons is rendered in the chat view

#### Scenario: User approves tool use
- GIVEN an approval card is displayed
- WHEN the user taps "Approve"
- THEN `session.approveTool` is called and the card is marked as approved

#### Scenario: User rejects tool use
- GIVEN an approval card is displayed
- WHEN the user taps "Reject"
- THEN `session.rejectTool` is called and the card is marked as rejected

### Requirement: Chat View — Resume and Follow-Up
When the user is in an active chat session and types a new prompt, the UI MUST call `session.resume` with the current `sessionId` and the new prompt.

When resuming an `interrupted` session from the session list, the UI MUST call `session.resume` with the session's ID and any provided prompt, then open an SSE connection.

#### Scenario: Follow-up prompt resumes session
- GIVEN the user is viewing an active session
- WHEN the user types a new prompt and submits
- THEN `session.resume` is called with the session ID and new prompt

#### Scenario: Resume interrupted session
- GIVEN the user taps an interrupted session and confirms resume
- WHEN `session.resume` returns successfully
- THEN an SSE connection is opened and the chat view shows real-time output

### Requirement: SSE Reconnection
When the SSE connection is closed or errors (e.g., mobile network drop), the UI MUST attempt to reconnect with exponential backoff (1s, 2s, 4s, capped at 30s).

After reconnecting, the UI MUST call `session.events` with `since` set to the last seen event sequence number to replay missed events. Replayed events MUST be rendered only if they are not already present in the chat view (deduplicated by sequence number).

#### Scenario: Reconnection replays missed events
- GIVEN the SSE connection drops and reconnects
- WHEN the UI calls `session.events` with the last seen sequence number
- THEN any events that occurred during the disconnection are rendered

### Requirement: Mobile-First Responsive Design
The UI MUST use a mobile-first CSS approach:
- Minimum viewport: 375px wide
- Minimum touch target size: 44x44px
- Font sizes: minimum 16px for body text to prevent iOS auto-zoom on input focus
- Dark mode: MUST respect `prefers-color-scheme: dark` media query with appropriate color scheme
- Light mode: default color scheme for `prefers-color-scheme: light` or no preference
- No horizontal scroll at any viewport width
- Layout adapts from phone (375px) to tablet (768px+) to desktop (1024px+)

#### Scenario: Dark mode applies on supporting devices
- GIVEN a user's device is set to dark mode
- WHEN the UI loads
- THEN the color scheme uses dark backgrounds and light text

#### Scenario: Touch targets are accessible
- GIVEN the UI is displayed on a mobile device
- WHEN interactive elements (buttons, inputs, session cards) are rendered
- THEN each interactive element has a minimum touch target of 44x44px

### Requirement: Logout
The UI MUST provide a logout action that clears the API key from `localStorage` and returns to the login view. Any active SSE connections MUST be closed on logout.

#### Scenario: Logout clears key and returns to login
- GIVEN a user is logged in and viewing any screen
- WHEN the user taps the logout button
- THEN the API key is removed from `localStorage`, SSE connections are closed, and the login view is shown

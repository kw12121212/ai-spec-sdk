# mobile-web-ui

## What

Add a mobile-first web UI served by the bridge at `GET /`, implemented as a single self-contained HTML file with inline CSS and JS. The UI provides a login screen, chat view with real-time agent output via SSE, tool approval/reject buttons, and a session list view — all optimized for phone browsers (375px+) with dark mode support.

## Why

The bridge already has HTTP/SSE transport and API key authentication. A web UI is the simplest way to let users interact with the agent from any phone or tablet without installing anything. Zero install, zero framework, zero build step — just open the URL and chat.

## Scope

- Single `src/ui/index.html` file served at `GET /` by the bridge's HTTP server
- **Login view**: API key input, stored in `localStorage`, sent as `Authorization: Bearer <key>` on all subsequent requests
- **Chat view** (primary screen):
  - New session: workspace input (free text + `workspace.list` picker) + prompt input
  - Resume existing session from session list
  - Real-time agent output via `GET /events?sessionId=<id>` SSE stream
  - Render `agent_message` events by `messageType`: `assistant_text`, `tool_use`, `tool_result`, `result`, `system_init`, `other`
  - Tool approval UI: render `bridge/tool_approval_requested` notifications with approve/reject buttons calling `session.approveTool` / `session.rejectTool`
  - Session history scrollback
  - Permission mode selector (default: `bypassPermissions`)
- **Session list view**:
  - Active and past sessions with status badges (`active`, `completed`, `stopped`, `interrupted`)
  - Tap to resume `interrupted` sessions or view completed session history
  - Pull to refresh / manual refresh button
- **Mobile-first CSS**:
  - Touch-friendly: 44px minimum tap targets, appropriate font sizes
  - Dark mode via `prefers-color-scheme`
  - Responsive: works on phones (375px+) and scales up for tablets/desktop
  - No horizontal scroll
- **Bridge changes**:
  - Serve `src/ui/index.html` for `GET /` requests in HTTP mode
  - `AI_SPEC_SDK_UI_ENABLED` env var (default: `true` when HTTP transport is active)
  - When disabled, `GET /` returns 404
- **SSE reconnection**:
  - Use `session.events` method with `since` parameter to replay missed events after reconnection
  - Track last seen event sequence number in the UI

## Unchanged Behavior

- All existing bridge JSON-RPC methods remain unchanged
- HTTP transport endpoints (`POST /rpc`, `GET /events`, `GET /health`) remain unchanged
- Authentication and authorization rules remain unchanged
- Stdio transport is unaffected
- SSE fan-out behavior is unaffected

# Tasks: mobile-web-ui

## Implementation

- [x] Create `src/ui/index.html` with HTML structure for login, session list, and chat views
- [x] Implement CSS: mobile-first layout, dark mode via `prefers-color-scheme`, responsive breakpoints, touch-friendly sizing (44px min targets, 16px min font)
- [x] Implement login view: API key input, `localStorage` persistence, `bridge.capabilities` validation, error display
- [x] Implement `rpc()` helper: JSON-RPC 2.0 `POST /rpc` wrapper with Bearer token from `localStorage`
- [x] Implement session list view: `session.list` call, status badges, prompt preview, timestamp display, tap handlers
- [x] Implement chat view — new session form: workspace input (free text + `workspace.list` picker), prompt input, permission mode selector
- [x] Implement chat view — SSE event rendering: `EventSource` connection, render `agent_message` by `messageType` (assistant_text, tool_use, tool_result, result), auto-scroll with scroll-up pause
- [x] Implement chat view — follow-up prompts: `session.resume` with new prompt on existing session
- [x] Implement chat view — session resume: tap interrupted session from list, call `session.resume`, open SSE
- [x] Implement tool approval UI: render `bridge/tool_approval_requested` notifications, approve/reject buttons calling `session.approveTool`/`session.rejectTool`
- [x] Implement SSE reconnection: exponential backoff reconnect, `session.events` replay with `since` parameter, deduplication by sequence number
- [x] Implement logout: clear `localStorage`, close SSE, return to login view
- [x] Add `GET /` static file handler to `src/http-server.ts`: serve `src/ui/index.html`, respect `AI_SPEC_SDK_UI_ENABLED` env var, no auth required for `GET /`
- [x] Update `src/capabilities.ts` to advertise UI support in `bridge.capabilities` response

## Testing

- [x] Lint passes (`bun run lint`)
- [x] Unit test: `GET /` returns `src/ui/index.html` content when UI enabled
- [x] Unit test: `GET /` returns 404 when `AI_SPEC_SDK_UI_ENABLED=false`
- [x] Unit test: `GET /` does not require authentication
- [x] Unit test: `GET /` does not interfere with `POST /rpc`, `GET /events`, `GET /health`

## Verification

- [x] Verify UI is served at `GET /` on HTTP transport
- [x] Verify login → session list → chat → tool approval → logout flow
- [ ] Verify dark mode activates on `prefers-color-scheme: dark`
- [ ] Verify mobile viewport (375px) renders correctly with no horizontal scroll
- [ ] Verify SSE reconnection replays missed events after network drop

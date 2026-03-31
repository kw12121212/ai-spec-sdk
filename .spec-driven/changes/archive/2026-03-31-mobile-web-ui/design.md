# Design: mobile-web-ui

## Approach

A single `src/ui/index.html` file containing all HTML structure, CSS styles, and JavaScript logic inline. The bridge's HTTP server gains a static file handler that serves this file for `GET /` requests.

The UI is a single-page application with three views managed by showing/hiding DOM sections:

1. **Login view** — shown when no API key is stored in `localStorage`
2. **Session list view** — shown after login and when no active chat session is selected
3. **Chat view** — shown when a session is active (new or resumed)

All API calls go through `POST /rpc` with JSON-RPC 2.0 bodies. Real-time updates use `EventSource` on `GET /events?sessionId=<id>`. The SSE connection is the primary driver for updating the chat view.

### State management

Minimal in-memory state object:
- `apiKey`: loaded from `localStorage`, cleared on logout
- `currentView`: `"login"` | `"sessions"` | `"chat"`
- `activeSessionId`: currently viewed session (null when in session list)
- `eventSeq`: last seen event sequence number for reconnection

### API interaction

A thin `rpc(method, params)` helper wraps `fetch("POST /rpc", ...)` with the stored Bearer token. Returns the JSON-RPC `result` on success, throws on error.

An `EventSource` wrapper manages SSE connection lifecycle:
- Opens on entering chat view
- Tracks `eventSeq` from SSE event data
- On error/close: reconnects, replays missed events via `session.events({ sessionId, since: eventSeq })`

### Rendering

No templating library — direct DOM manipulation:
- Chat messages are appended as `<div>` elements with class-based styling
- Tool approval cards render as inline cards with approve/reject buttons
- Session list is a scrollable list of session cards

## Key Decisions

1. **Single HTML file** — No build step, no bundler, no node_modules for the UI. The entire UI is one file that the bridge serves directly. Keeps the project dependency-free for UI concerns.

2. **No framework** — The UI is a thin client (chat + list + login). Vanilla JS is sufficient and avoids framework bundle size, compatibility concerns, and build complexity.

3. **Served at `GET /`** — Simplest URL for mobile users to type. API endpoints remain at their existing paths (`/rpc`, `/events`, `/health`).

4. **`session.events` for reconnection** — The bridge already supports `session.events` with `since` parameter for missed-event replay. The UI uses this instead of `Last-Event-ID` SSE headers, avoiding changes to the SSE server.

5. **Permission mode defaults to `bypassPermissions`** — Consistent with bridge default. Users who want tool approval can select `"default"` or `"approve"` from a permission mode picker in the chat view.

6. **Workspace: free text + picker** — Text input for manual path entry, plus a button to fetch `workspace.list` and show a selectable list.

## Alternatives Considered

- **React/Vue/Preact SPA** — Rejected: adds build tooling, dependencies, and complexity for what is essentially a chat interface. Vanilla JS keeps it simple and fast-loading on mobile.

- **Separate CSS/JS files** — Rejected: would require serving a directory of static files instead of a single file. Single file is simpler to serve and has zero latency from additional HTTP requests.

- **Service Worker / PWA** — Deferred to a future change: would add offline capability and push notifications, but significantly increases complexity for the first iteration.

- **WebSocket transport** — Not yet available (roadmap item #11). SSE is sufficient for the server-to-client streaming use case; client-to-server uses POST /rpc.

- **`Last-Event-ID` SSE reconnection** — Requires changes to the SSE server to set `id:` fields and buffer events. Using `session.events` API for replay avoids modifying the SSE transport layer.

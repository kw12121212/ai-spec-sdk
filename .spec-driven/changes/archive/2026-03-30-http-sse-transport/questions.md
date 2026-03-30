# Questions: http-sse-transport

## Open

<!-- No open questions -->

## Resolved

- [x] Q: Should stdio and HTTP transports run simultaneously in one process?
  Context: Affects CLI design and whether `BridgeServer` needs to support multiple notification sinks.
  A: No — they are separate launch modes. Use `--transport http` for HTTP, default is stdio.

- [x] Q: Which notifications should SSE connections receive?
  Context: Some notifications (e.g. `mcp/server_started`) do not carry a `sessionId`.
  A: All notifications that carry a `sessionId` are routed to matching SSE subscribers. Notifications without a `sessionId` are dropped (not sent to any SSE connection).

- [x] Q: Can multiple HTTP clients subscribe to the same sessionId via `GET /events`?
  Context: Determines whether fan-out is needed in the SSE manager.
  A: Yes — multiple subscribers per sessionId are supported (fan-out).

- [x] Q: Should graceful shutdown drain in-flight requests or close immediately?
  Context: Affects perceived reliability for clients mid-request during restarts.
  A: Yes — drain in-flight `POST /rpc` requests before closing SSE connections.

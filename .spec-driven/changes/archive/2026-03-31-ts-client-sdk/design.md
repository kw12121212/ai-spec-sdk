# Design: ts-client-sdk

## Approach

Create `packages/client/` as a standalone npm package. The client is structured in three layers:

1. **Types** (`types.ts`) — hand-written TypeScript interfaces for every bridge method's params and result shapes, derived from `docs/bridge-contract.yaml`
2. **Transport** (`transport.ts`, `stdio-transport.ts`, `http-transport.ts`) — abstract `Transport` interface with two implementations:
   - `StdioTransport`: spawns bridge as subprocess, writes JSON-RPC requests to stdin, reads responses and notifications from stdout, matches by request id
   - `HttpTransport`: sends requests via `POST /rpc`, subscribes to events via `GET /events` SSE, handles reconnection with exponential backoff
3. **Client** (`client.ts`) — `BridgeClient` class that holds a transport instance, exposes typed methods for each bridge method, and emits notifications via an EventEmitter pattern

```
packages/client/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Public API re-exports
│   ├── types.ts              # All typed interfaces
│   ├── errors.ts             # BridgeClientError
│   ├── transport.ts          # Transport interface
│   ├── stdio-transport.ts    # StdioTransport impl
│   ├── http-transport.ts     # HttpTransport impl
│   └── client.ts             # BridgeClient class
└── test/
    ├── stdio-transport.test.ts
    ├── http-transport.test.ts
    ├── client.test.ts
    └── integration.test.ts
```

## Key Decisions

- **Standalone package** — keeps bridge core dependency-free; client is opt-in. Not part of the root workspace to avoid coupling build processes.
- **Hand-written types over code generation** — the bridge contract is stable and small enough that hand-written types are simpler and more maintainable than a code generator.
- **EventEmitter pattern for notifications** — `client.on('session_event', handler)` is idiomatic Node.js. Avoids callback soup and supports multiple listeners.
- **Zero external deps** — uses Node.js built-in `fetch`, `EventSource` (available since Node 20), and `child_process`. No axios, no eventsource polyfill.
- **Reconnection in HttpTransport only** — stdio is a local subprocess; reconnection doesn't apply. HTTP transport reconnects SSE with exponential backoff (1s, 2s, 4s, ..., 30s cap).

## Alternatives Considered

- **Callback-based notification API** — rejected in favor of EventEmitter; less flexible, doesn't support multiple listeners naturally.
- **Axios for HTTP** — rejected to keep zero deps; Node 20+ has built-in fetch.
- **Code generation from bridge-contract.yaml** — rejected; the contract is small and stable, manual types are simpler to maintain.
- **Including client in root package** — rejected to keep bridge core lightweight and allow independent versioning.

# Delta: client-sdk

## ADDED Requirements

### Requirement: @ai-spec-sdk/client package structure
The `@ai-spec-sdk/client` npm package at `packages/client/` MUST provide a type-safe TypeScript client for the ai-spec-sdk bridge with zero external runtime dependencies.

### Requirement: BridgeClient class
The package MUST export a `BridgeClient` class that accepts a `Transport` implementation and exposes typed methods for all bridge methods listed in `bridge.capabilities().methods`.

### Requirement: Transport abstraction
The package MUST export a `Transport` interface with `request(method, params?)`, `onNotification(handler)`, `close()`, and `readonly isClosed` members.

### Requirement: StdioTransport
The package MUST export `StdioTransport` that spawns a bridge subprocess, communicates JSON-RPC over stdin/stdout, and handles request/response matching by id and notification dispatch.

### Requirement: HttpTransport
The package MUST export `HttpTransport` that sends requests via `POST /rpc`, subscribes to SSE events per sessionId, and reconnects with exponential backoff (1s initial, 30s cap, doubling on each retry).

### Requirement: Notification subscription
`BridgeClient` MUST support `on(method, handler)` and `off(method, handler)` for method-specific notification subscription, plus `on('*', handler)` for wildcard subscription.

### Requirement: Error handling
The package MUST export `BridgeClientError` with `code: number`, `message: string`, and optional `data: unknown`.

### Requirement: Zero runtime dependencies
The package MUST NOT have any external runtime dependencies. It MUST use only Node.js built-in `fetch`, `EventSource`, and `child_process`. Target: Node.js >= 20. TypeScript strict mode with NodeNext module resolution.

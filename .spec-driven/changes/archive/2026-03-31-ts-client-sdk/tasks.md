# Tasks: ts-client-sdk

## Setup

- [x] Create `packages/client/package.json` with name `@ai-spec-sdk/client`, type module, Node.js >= 20, zero deps
- [x] Create `packages/client/tsconfig.json` with strict mode, NodeNext module resolution, outDir `dist`
- [x] Create `packages/client/src/errors.ts` with `BridgeClientError` class

## Types

- [x] Create `packages/client/src/types.ts` with typed request params and response interfaces for all 39 bridge methods (derived from `docs/bridge-contract.yaml`)

## Transport

- [x] Create `packages/client/src/transport.ts` with `Transport` interface
- [x] Implement `StdioTransport`: spawn bridge subprocess, JSON-RPC over stdin/stdout, request/response matching by id, notification dispatch
- [x] Implement `HttpTransport`: POST /rpc with optional Bearer token, SSE event stream per sessionId, reconnection with exponential backoff (1s to 30s cap)

## Client

- [x] Implement `BridgeClient` class in `packages/client/src/client.ts` with typed methods for all bridge methods, EventEmitter-based notification API, and lifecycle management (connect, close, isClosed)
- [x] Create `packages/client/src/index.ts` with public API exports

## Testing

- [x] Write unit tests for StdioTransport: request/response matching, notification dispatch, subprocess lifecycle, error handling
- [x] Write unit tests for HttpTransport: request/response, SSE parsing, reconnection logic, auth header
- [x] Write unit tests for BridgeClient: typed method dispatch, event emission, error wrapping
- [x] Write integration tests against real bridge: start bridge subprocess, call methods, verify responses, handle notifications

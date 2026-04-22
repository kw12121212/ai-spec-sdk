# Design: stream-control

## Approach
We will introduce stream control methods (pause, resume, throttle) to the session management layer. When a stream is active, clients can send out-of-band JSON-RPC control messages referencing the stream/session ID. The `SessionStore` and `AgentStateMachine` will coordinate to buffer LLM output when paused and flush it when resumed.

## Key Decisions
- **Out-of-band Control:** Stream control signals will be sent via the standard transport as JSON-RPC requests, identifying the active stream by ID, rather than requiring an active duplex stream for HTTP/SSE.
- **Buffering Strategy:** The system will buffer tokens in memory during a pause up to a configurable backpressure limit. If the limit is reached, it will halt the underlying provider stream (if the provider API supports flow control) or drop/error depending on policy.
- **Throttling:** Throttle commands will set a maximum tokens-per-second rate, implemented via a token bucket or leaky bucket algorithm on the emission side.

## Alternatives Considered
- **In-band Control:** Requires full duplex communication (e.g., WebSockets only), which breaks compatibility with HTTP/SSE transports. We chose out-of-band to ensure compatibility.
- **No Buffering (Drop Tokens):** Simpler to implement but violates the "without data loss" requirement. We chose to buffer.
# Design: Backpressure Handling

## Approach
We will rely on the underlying transport layer (e.g., the `ws` library for WebSockets) to detect when a client is a slow consumer. By monitoring properties like `bufferedAmount`, we can determine if the network buffer is growing too large. 

When the buffer exceeds a configurable high-water mark, we will attempt to apply backpressure to the LLM provider. This involves pausing or delaying the consumption of the provider's async stream iterator until the transport buffer drains below a low-water mark.

If the LLM provider SDK buffers internally and cannot be effectively paused (causing our internal memory usage to grow regardless), or if the transport buffer exceeds a critical hard limit, we will terminate the connection to protect the server from out-of-memory (OOM) errors.

## Key Decisions
- **Transport-level detection:** Use existing transport metrics (`bufferedAmount` for WebSockets, or standard Node stream events) rather than introducing a custom application-level acknowledgment protocol. This keeps the client interaction simple and leverages built-in flow control.
- **Iterator blocking:** Attempt to block the async iterator from the LLM provider to propagate backpressure upstream.

## Alternatives Considered
- **Application-level ACKs:** We considered requiring clients to send ACKs for token chunks to manage flow control. This was rejected because it significantly increases protocol complexity and overhead for streaming, and most transport layers already provide backpressure indicators.
- **Dropping tokens:** We considered dropping tokens if the buffer is full, but this would result in an invalid or corrupted response for the client, which is unacceptable for LLM generation. Terminating the connection is safer and more explicit about the failure.

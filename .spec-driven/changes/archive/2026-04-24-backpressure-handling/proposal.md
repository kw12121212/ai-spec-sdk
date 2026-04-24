# Backpressure Handling

## What
Implement flow control for slow consumers during streaming operations. When a client reads tokens slower than the LLM provider generates them, the system will apply backpressure to avoid unbounded memory buffering and out-of-memory errors.

## Why
Currently, if a client's network connection is slow or it processes tokens slowly, the server must buffer all generated tokens in memory. This can lead to resource exhaustion and server crashes under load. Applying backpressure ensures system stability by pacing the LLM provider or forcefully closing the connection if the buffer limit is reached.

## Scope
- Monitor the transport layer's buffer (e.g., WebSocket `bufferedAmount` or HTTP chunk writes) to detect when a client is falling behind.
- Apply backpressure to the LLM provider's token stream (e.g., blocking the async iterator) when the transport buffer is full.
- Define a hard disconnect threshold for the transport if the buffer exceeds a maximum limit and the provider cannot be paused effectively.

## Unchanged Behavior
- The core streaming functionality (pause, resume, throttle, reasoning streams) remains the same.
- Clients that consume streams fast enough will see no difference in behavior.
- Standard JSON-RPC and REST requests that are not streaming are unaffected.

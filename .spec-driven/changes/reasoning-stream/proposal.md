# Proposal: reasoning-stream

## What
Implement support for outputting reasoning/thinking process from the LLM provider as a separate stream event, allowing clients to distinguish between final response text and intermediate reasoning steps.

## Why
This implements the `reasoning-stream` planned change from the `12-streaming-token.md` milestone. With models increasingly supporting "thinking" phases, exposing this stream separately is critical for providing transparency into the agent's problem-solving process without conflating it with final output intended for the user.

## Scope
- Add JSON-RPC event types to represent reasoning/thinking stream chunks.
- Update the LLM provider interface and adapters to surface reasoning tokens when available.
- Stream reasoning tokens to the client over the active transport.
- Update bridge serialization to correctly format reasoning events.

## Unchanged Behavior
- Regular response token streaming remains unchanged.
- Existing stream control methods (pause, resume, throttle) apply to the entire session stream uniformly.
# Design: reasoning-stream

## Approach
Extend the JSON-RPC event payload for streaming tokens to distinguish between standard `text` and `reasoning` chunks. 
For instance, introducing a `type` field or sending a distinct method such as `agent.reasoning` vs `agent.token`.
We will modify `src/bridge.ts` to handle formatting these new events.
The LLM provider abstraction in `src/llm-provider/` will be updated to emit reasoning chunks where supported by the underlying Anthropic Agent SDK or generic provider adapter.

## Key Decisions
- **Event separation:** Emit reasoning stream events as a separate JSON-RPC notification (e.g., `agent.reasoning`) to ensure backward compatibility for clients that only listen for standard output tokens.

## Alternatives Considered
- Emitting reasoning text as standard text with a special metadata flag: Rejected because it forces clients to implement filtering logic to avoid displaying reasoning as final output. A distinct event type makes the integration boundary clearer.
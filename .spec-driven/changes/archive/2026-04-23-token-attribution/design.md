# Design: token-attribution

## Approach
The token recording data model (`TokenRecord`) will be extended (if not already fully leveraged) to reliably capture and expose a `messageId` field. The `claude-agent-runner` or equivalent orchestration layer will ensure that when an LLM message or query resolves, its generated `messageId` (either from the provider or self-generated for tracing) is logged alongside the tokens.

## Key Decisions
- The `messageId` should be the unique identifier provided by the downstream client or the LLM provider for a specific message turn. If one is not natively provided by the event, the runner should synthesize a trace ID.
- The retrieval function `token.getMessageUsage` will filter `TokenStore` records directly by `messageId`. 

## Alternatives Considered
- Creating a separate nested structure mapping `sessionId -> messageId -> usage` was considered, but keeping `TokenRecord` flat with `sessionId` and `messageId` columns reduces query complexity and simplifies the storage model.

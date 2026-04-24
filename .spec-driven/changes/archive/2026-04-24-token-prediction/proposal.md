# token-prediction

## What
This change introduces pre-execution token usage estimates for LLM requests. It allows consumers to predict the token cost of a request before streaming output starts.

## Why
This is the final planned feature of the `12-streaming-token.md` milestone. Providing token predictions allows for budget management, quota enforcement, and flow control before incurring the cost of an actual LLM API call.

## Scope
- In scope: Adding a `predictTokens()` method to the `ProviderAdapter` interface, with a generic heuristic fallback, and exposing this prediction via the `ProviderRegistry` and `TokenStore`.
- Out of scope: Predicting exact output tokens (since output tokens depend on LLM generation).

## Unchanged Behavior
- Existing token tracking and budget alerts during or after execution must continue to function normally without disruption.

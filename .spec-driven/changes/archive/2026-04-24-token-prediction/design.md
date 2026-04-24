# Design: token-prediction

## Approach
We will add an optional `predictTokens()` method to the `ProviderAdapter` interface in `src/llm-provider/types.ts`.
If a specific provider adapter implements this (e.g. using Anthropic's count tokens API), it will be used. If not, the `ProviderRegistry` will fallback to a generic token counting heuristic (e.g., character count / 4) before executing a request.

## Key Decisions
- **Prediction Method**: We will use a "Provider & Fallback" approach, as confirmed by the user. Providers can natively support token counting if their APIs allow it, while a generic fallback heuristic ensures estimates are always available.

## Alternatives Considered
- **Generic Heuristic Only**: Rejected because some providers offer exact token counts for inputs, which are more accurate.
- **Native Only**: Rejected because not all providers expose a token counting API, which would lead to missing predictions for some models.

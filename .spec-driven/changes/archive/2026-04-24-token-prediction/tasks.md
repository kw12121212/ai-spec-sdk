# Tasks: token-prediction

## Implementation
- [x] Add `TokenPrediction` type to `src/llm-provider/types.ts`
- [x] Add optional `predictTokens()` method to `ProviderAdapter` interface
- [x] Implement generic fallback token prediction logic in `src/llm-provider/provider-registry.ts`
- [x] Expose prediction results in the streaming session lifecycle

## Testing

- [x] Run `bun run lint` — validate TypeScript interfaces and code style
- [x] Run `bun test` — unit test task for the token prediction logic

## Verification
- [x] Verify implementation matches proposal scope and correctly predicts token usage

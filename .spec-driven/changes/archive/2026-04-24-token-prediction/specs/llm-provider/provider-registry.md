---
mapping:
  implementation:
    - src/llm-provider/types.ts
    - src/llm-provider/provider-registry.ts
  tests:
    - test/provider-registry.test.ts
---

## ADDED Requirements

### Requirement: provider-token-prediction
The system MUST support token prediction via provider adapters or fallback heuristics.

#### Scenario: success with provider API
- GIVEN a provider adapter that implements `predictTokens`
- WHEN the registry is asked for a token prediction
- THEN the registry MUST return the exact prediction from the provider.

#### Scenario: fallback heuristic
- GIVEN a provider adapter that does not implement `predictTokens`
- WHEN the registry is asked for a token prediction
- THEN the registry MUST return a heuristically estimated token count.
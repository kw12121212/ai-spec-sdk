# Tasks: provider-interface

## Implementation

- [ ] Create `src/llm-provider/types.ts` with all interface and type definitions (LLMProvider, ProviderConfig, ProviderCapabilities, QueryOptions, QueryMessage, StreamEvent, QueryResult, TokenUsage)
- [ ] Create `src/llm-provider/index.ts` as the module export entry point
- [ ] Implement `src/llm-provider/adapters/anthropic.ts` - AnthropicAdapter class that wraps existing `@anthropic-ai/claude-agent-sdk` integration
- [ ] Refactor `src/claude-agent-runner.ts` to use LLMProvider interface internally (maintain backward compatibility)
- [ ] Update `src/session-store.ts` Session interface to include optional `providerId?: string` field
- [ ] Update `src/session-store.ts` create() method to accept and store providerId from session options
- [ ] Ensure providerId is persisted in session JSON files (already handled by existing persistence logic)

## Testing

- [ ] Run lint validation: `bun run lint` to verify type correctness across all new and modified files
- [ ] Run unit tests: `bun run test` to execute the full test suite including new provider interface tests
- [ ] Create unit test file: `test/llm-provider.test.ts` with comprehensive type and interface definition tests
- [ ] Create unit test file: `test/anthropic-adapter.test.ts` with AnthropicAdapter behavior tests using globalThis.__AI_SPEC_SDK_QUERY__ stub
- [ ] Verify backward compatibility: ensure all existing tests pass without modification

## Verification

- [ ] Verify all interface methods match design.md specifications
- [ ] Verify AnthropicAdapter correctly wraps existing runClaudeQuery logic
- [ ] Verify Session.providerId is optional and defaults to undefined (backward compatible)
- [ ] Verify no existing JSON-RPC method signatures changed
- [ ] Verify TypeScript strict mode compilation succeeds with `bun run lint`
- [ ] Verify all new code follows existing code style conventions

# Tasks: token-tracking

## Implementation

### Core Types and Interfaces
- [x] Create `src/token-tracking/types.ts` with TokenUsage, TokenRecord, SessionTokenSummary, ProviderTokenSummary interfaces
- [x] Define TokenCounter interface with providerType and count() method
- [x] Define TokenStore interface with record(), getSessionUsage(), getMessageUsage(), getProviderUsage(), clearSession(), clearAll() methods
- [x] Add data validation logic (reject negative tokens, auto-compute totalTokens, auto-generate timestamp)

### TokenCounter System
- [x] Create `src/token-tracking/counters/index.ts` with CounterRegistry class (register, get, list operations)
- [x] Implement `src/token-tracking/counters/anthropic.ts` (AnthropicTokenCounter)
  - Handle SDK format: { input_tokens, output_tokens }
  - Handle Provider format: { inputTokens, outputTokens }
  - Normalize to standard TokenUsage
- [x] Implement default PassthroughTokenCounter for unknown provider types
- [x] Register built-in counters on module initialization

### InMemoryTokenStore Implementation
- [x] Create `src/token-tracking/store.ts` with InMemoryTokenStore class
- [x] Implement record() method with Map<sessionId, TokenRecord[]> storage
- [x] Implement getSessionUsage() with aggregation logic (sum by session, group by provider)
- [x] Implement getMessageUsage() lookup by sessionId + messageId
- [x] Implement getProviderUsage() aggregation across all sessions
- [x] Implement clearSession() and clearAll() lifecycle methods
- [x] Export singleton getTokenStore() / setTokenStore() for dependency injection

### Integration with Claude Agent Runner
- [x] Modify `src/claude-agent-runner.ts` to import TokenStore and CounterRegistry
- [x] Add token recording logic after successful query completion (SDK path)
- [x] Add token recording logic after Provider.queryStream completion (Provider path)
- [x] Extract sessionId and optional messageId from options/context
- [x] Ensure recording is silent failure (log warning but don't throw) to not break queries
- [x] Skip recording when usage is null or undefined

### Bridge JSON-RPC Methods
- [x] Add `token.getUsage(sessionId)` method in `src/bridge.ts`
  - Return all records for a session (raw detail view)
  - Error code -32051 for missing session
- [x] Add `token.getSessionSummary(sessionId)` method
  - Return aggregated SessionTokenSummary
  - Include providerBreakdown array
- [x] Add `token.getMessageUsage(sessionId, messageId)` method
  - Return single TokenRecord
  - Error code -32052 for missing message
- [x] Add `token.getProviderUsage(providerId?)` method
  - Return ProviderTokenSummary[] array
  - Support filtering by providerId or return all
- [x] Add `token.clearAll()` admin method (consider auth check if available)
  - Return { success: true, clearedCount: number }

### Provider Registry Integration
- [x] Modify `src/llm-provider/provider-registry.ts` to associate counter type on registration
- [x] Persist counterType metadata in ConfigStore alongside provider config
- [x] Add `token.registerCounter()` JSON-RPC method for custom counters
- [x] Add `token.listCounters()` JSON-RPC method for discovery

## Testing

- [x] Run `bun run lint` (tsc --noEmit) to validate TypeScript types and fix all errors
- [x] Run `bun run test` to execute unit tests and ensure all new tests pass
- [x] Verify test coverage for new token-tracking modules (counters, store, integration)

### Unit Tests: TokenCounter System
- [x] Test AnthropicTokenCounter correctly normalizes SDK format ({ input_tokens, output_tokens })
- [x] Test AnthropicTokenCounter correctly normalizes Provider format ({ inputTokens, outputTokens })
- [x] Test AnthropicTokenCounter handles null/undefined usage gracefully
- [x] Test CounterRegistry.register() adds counter for provider type
- [x] Test CounterRegistry.get() returns correct counter or default passthrough
- [x] Test CounterRegistry.list() returns all registered counters with metadata
- [x] Test CounterRegistry allows overriding built-in counters

### Unit Tests: InMemoryTokenStore
- [x] Test record() stores entry with correct structure
- [x] Test record() rejects negative token values
- [x] Test record() auto-generates timestamp when missing
- [x] Test record() auto-computes totalTokens
- [x] Test getSessionUsage() aggregates multiple records correctly
- [x] Test getSessionUsage() returns null for non-existent session
- [x] Test getSessionUsage() includes correct providerBreakdown
- [x] Test getMessageUsage() returns correct single record
- [x] Test getMessageUsage() returns null for non-existent message
- [x] Test getProviderUsage() filters by providerId when specified
- [x] Test getProviderUsage() returns all providers when no filter
- [x] Test getProviderUsage() returns zero-entry for unused provider
- [x] Test clearSession() removes only target session's records
- [x] Test clearAll() removes all records and returns count
- [ ] Test concurrent access safety (if applicable)

### Unit Tests: Integration Points
- [x] Test runClaudeQuery records tokens after successful SDK query
- [x] Test runClaudeQuery does NOT record when usage is null
- [x] Test runClaudeQuery handles recording failure gracefully (no throw)
- [ ] Test Provider path also triggers recording via associated counter
- [x] Test sessionId extraction from options context
- [x] Test messageId optional inclusion in TokenRecord

### Unit Tests: Bridge Methods
- [x] Test token.getUsage returns raw records array for valid session
- [x] Test token.getUsage returns error -32051 for invalid session
- [x] Test token.getSessionSummary returns correct aggregation
- [x] Test token.getSessionSummary provider breakdown accuracy
- [x] Test token.getMessageUsage returns single record
- [x] Test token.getMessageUsage returns error -32052 for invalid message
- [x] Test token.getProviderUsage with and without filter
- [x] Test token.clearAll clears and returns count

### Lint and Type Validation
- [x] Run `bun run lint` (tsc --noEmit) and fix all type errors
- [ ] Ensure no new `any` types introduced (use unknown where needed)
- [x] Verify all new files follow existing TypeScript strict mode conventions

## Verification

### Functional Verification
- [ ] Manual test: Start bridge, register Anthropic provider, execute query, call token.getSessionSummary() and verify correct totals
- [ ] Manual test: Execute multiple queries across sessions, verify token.getProviderUsage() shows correct breakdown
- [ ] Manual test: Destroy session, verify token records are cleaned up
- [x] Verify all delta spec scenarios pass (cross-reference with specs/token-tracking/token-usage.md)

### Spec Alignment Verification
- [x] Confirm implementation covers all ADDED requirements in delta specs
- [x] Confirm MODIFIED requirements in provider-registry delta are addressed
- [x] Confirm Unchanged Behavior list from proposal.md is respected
- [x] Confirm Out of Scope items are NOT implemented

## Stretch Goals (Optional Enhancements)
- [ ] Implement toolCallId tracking in tool execution pipeline
- [ ] Add token usage notification event on each record (for real-time monitoring hooks)
- [ ] Implement simple rate-limiting based on token usage per minute (prototype for quota-management)

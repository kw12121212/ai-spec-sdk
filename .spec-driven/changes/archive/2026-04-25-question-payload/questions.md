## Resolved

### Testing approach
**Question**: Should the verification for this initial change strictly focus on unit tests for the payload types and session state transitions, or should we also include an end-to-end integration test through the local bridge transport?
**Explanation**: The proposal includes unit testing, but end-to-end testing may catch edge cases in the bridge transport.
**Impact**: Affects the scope of the testing tasks.
**Resolution**: Started with strict unit testing and bridge method tests, deferred full e2e to the next change (`session-resumption`).

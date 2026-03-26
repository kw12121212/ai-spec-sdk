# Tasks: add-polyglot-agent-spec-bridge

## Implementation

- [x] Define the JSON-RPC stdio bridge API surface, including capabilities discovery, request envelopes, notifications, and structured errors.
- [x] Implement workflow operations that let clients run supported spec-driven commands against an explicit workspace and receive machine-readable results.
- [x] Implement Claude agent session operations for starting, resuming, stopping, and observing sessions through the bridge.
- [x] Package built-in spec-driven skills and expose discovery metadata for supported workflows and bundled skills.
- [x] Document the bridge contract with usage examples for external tool integrators.

## Testing

- [x] Lint passes
- [x] Unit tests pass
- [x] Integration tests verify JSON-RPC stdio request/response behavior and streaming notifications.
- [x] Integration tests verify workflow execution against a fixture workspace with `.spec-driven/` artifacts.
- [x] Integration tests verify agent session start and resume flows with controlled test doubles or supported SDK test harnesses.

## Verification

- [x] Verify implementation matches proposal and delta specs.
- [x] Manually validate that a non-Node host can invoke the bridge through stdio using the documented protocol.

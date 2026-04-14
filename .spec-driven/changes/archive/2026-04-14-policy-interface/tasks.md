# Tasks: policy-interface

## Implementation
- [x] Create `src/permission-policy.ts` with `PolicyResult` type (`allow` | `deny` | `pass`), `PolicyContext` interface (toolName, toolInput, sessionId), `PermissionPolicy` interface (async `check()`), `PolicyDescriptor` type (name + optional config), and `PolicyChain` class (ordered execution, deny/allow short-circuit)
- [x] Create a built-in policy registry in `src/permission-policy.ts` with `registerPolicy(name, factory)` and `resolvePolicies(descriptors)` functions
- [x] Add `policies` field to session data in `src/session-store.ts`
- [x] Add `policies` parameter validation in `bridge.ts` `validateAgentControlParams()` — reject unknown policy names with `-32602`
- [x] Wire `policies` into `session.start`, `session.spawn`, `session.resume` in `bridge.ts`
- [x] Insert `PolicyChain.run()` call in `bridge.ts` tool_use handler before the existing `isScopeDenied` check (around line 1249)
- [x] Emit `bridge/policy_denied` notification and write `policy_decision` audit entries on deny
- [x] Implement `permissions.policies.list` JSON-RPC method in `bridge.ts`
- [x] Export new types and functions from `src/index.ts`

## Testing
- [x] Lint: run `bun run typecheck` — must pass with no errors
- [x] Unit tests: run `bun test` — all existing and new tests must pass
- [x] Create `test/permission-policy.test.ts` covering: PolicyChain deny short-circuit, allow short-circuit, all-pass fallthrough, unknown policy rejection, audit logging, notification emission, execution order relative to scope check

## Verification
- [x] Verify policy chain executes before scope check and before pre_tool_use hooks
- [x] Verify sessions without policies behave identically to before (no regression)
- [x] Verify `permissions.policies.list` returns correct policy descriptors for a session
- [x] Verify unknown policy name in session.start/session.spawn/session.resume returns `-32602`

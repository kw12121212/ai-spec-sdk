## Implementation
- [x] No implementation changes needed; `src/bridge.ts` already emits the correct audit logs.

## Testing
- [x] Add unit tests in `test/bridge.test.ts` to verify `scope_denied` audit entries are created correctly when a tool is blocked by scopes.
- [x] Add unit tests in `test/bridge.test.ts` to verify `policy_decision` audit entries are created correctly for allow, deny, and pass policy results.
- [x] Run the validation command: `./scripts/check.sh`
- [x] Run the unit test command: `bun test`

## Verification
- [x] Run `bun test` to ensure all tests pass.

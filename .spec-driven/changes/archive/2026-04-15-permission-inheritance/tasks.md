# Tasks: permission-inheritance

## Implementation
- [x] Update `SessionStore` (or `bridge.ts` `session.spawn` handler) to accept parent session context and calculate the intersection of `allowedScopes` and union of `blockedScopes`.
- [x] Add validation in `session.spawn` to throw `-32602` if the child requests `allowedScopes` not present in the restricted parent's `allowedScopes`.
- [x] Update `SessionStore` (or `bridge.ts` `session.spawn` handler) to append the parent's policies to the beginning of the child's `policies` list during creation.

## Testing
- [x] Add unit test verifying a child inherits parent `allowedScopes` when none are requested.
- [x] Add unit test verifying a child can request a subset of the parent's `allowedScopes`.
- [x] Add unit test verifying a `-32602` error is thrown when a child requests `allowedScopes` exceeding the parent's.
- [x] Add unit test verifying `blockedScopes` are unioned between parent and child.
- [x] Add unit test verifying parent policies execute before child policies.
- [x] Run `bun run test` to verify changes.
- [x] Run `bun run typecheck` to perform lint and validation.

## Verification
- [x] Run unit tests: `bun run test`
- [x] Run linting and type checking: `bun run typecheck`

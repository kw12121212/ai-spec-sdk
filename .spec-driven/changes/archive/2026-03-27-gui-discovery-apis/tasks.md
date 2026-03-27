# Tasks: gui-discovery-apis

## Implementation

- [x] Add `SUPPORTED_MODELS` and `BUILTIN_TOOLS` static arrays to `capabilities.ts`; add four new method names to the `methods` list in `getCapabilities()`
- [x] Create `src/workspace-store.ts` with `WorkspaceStore` class (`register`, `list`, persistence to `workspaces.json`)
- [x] Add `workspacesDir` option to `BridgeServerOptions`; wire `WorkspaceStore` into `BridgeServer`
- [x] Add dispatch cases in `bridge.ts`: `models.list`, `workspace.register`, `workspace.list`, `tools.list`
- [x] Update `TODO.md`: mark items 7, 8, 9 as `[x]`

## Testing

- [x] Add unit tests for `WorkspaceStore` in `test/session-store.test.ts` or a new `test/workspace-store.test.ts`
- [x] Add bridge integration tests for `models.list`, `workspace.register`, `workspace.list`, `tools.list` in `test/bridge.test.ts`
- [x] Lint passes (`bun run check` or equivalent)
- [x] Unit tests pass (`bun test`)

## Verification

- [x] Verify implementation matches proposal

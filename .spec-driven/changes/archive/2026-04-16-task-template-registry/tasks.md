# Tasks

## Implementation
- [x] Define the `TaskTemplate` interface and types in `src/types.ts` or a new file `src/task-template-types.ts`.
- [x] Create `TaskTemplateStore` in `src/task-template-store.ts` implementing create, get, update, delete, and list operations using disk storage.
- [x] Add JSON-RPC bridge methods for task template operations (e.g., `taskTemplate.create`, `taskTemplate.get`) in `src/bridge.ts` or a new bridge handler.
- [x] Register the new bridge methods with the JSON-RPC server in `src/index.ts`.

## Testing
- [x] Write unit tests for `TaskTemplateStore` in `test/task-template-store.test.ts`.
- [x] Write integration/bridge tests for the new JSON-RPC endpoints in `test/task-template-bridge.test.ts`.
- [x] Run `bun run lint` to verify type checking and linting pass.
- [x] Run `bun test` to ensure all tests pass.

## Verification
- [x] Verify the task templates are successfully written to disk as JSON files.
- [x] Verify that restarting the server reloads the saved task templates from disk.
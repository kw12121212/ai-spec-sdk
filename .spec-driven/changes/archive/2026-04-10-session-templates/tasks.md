# Tasks: session-templates

## Implementation

- [x] Create `TemplateStore` class in `src/template-store.ts`
  - [x] Define `SessionTemplate` interface
  - [x] Implement constructor with persistence directory
  - [x] Implement `create()` method (upsert)
  - [x] Implement `get()` method
  - [x] Implement `list()` method
  - [x] Implement `delete()` method
  - [x] Implement `_persist()` for disk storage
  - [x] Implement `_loadFromDisk()` for startup recovery

- [x] Integrate TemplateStore into BridgeServer
  - [x] Add `templateStore` property to `BridgeServer`
  - [x] Initialize in constructor with `templatesDir` option
  - [x] Wire up to `dispatch()` method

- [x] Implement JSON-RPC methods in `src/bridge.ts`
  - [x] `template.create` handler
  - [x] `template.get` handler
  - [x] `template.list` handler
  - [x] `template.delete` handler

- [x] Extend `session.start` with template support
  - [x] Accept optional `template` parameter
  - [x] Implement parameter merge logic
  - [x] Return `-32021` error for missing template

- [x] Add new error codes to `src/bridge.ts`
  - [x] `TEMPLATE_NOT_FOUND = -32021`

- [x] Update capabilities to include template methods
  - [x] Add template methods to `getCapabilities()`

## Testing

- [x] Unit tests for `TemplateStore`
  - [x] Create and persist template
  - [x] Get existing template
  - [x] Get non-existent template returns null
  - [x] List returns all templates sorted
  - [x] Delete removes template
  - [x] Load from disk on startup

- [x] Integration tests for JSON-RPC methods
  - [x] `template.create` with valid parameters
  - [x] `template.create` with invalid name
  - [x] `template.get` returns correct template
  - [x] `template.list` returns array
  - [x] `template.delete` removes template

- [x] Integration tests for `session.start` with templates
  - [x] Start session with template applies template params
  - [x] Explicit params override template params
  - [x] Missing template returns `-32021` error
  - [x] Session without template works as before

- [x] Run lint: `bun run lint`
- [x] Run tests: `bun run test`

## Verification

- [x] Verify template persistence across bridge restarts
- [x] Verify template parameters are correctly merged with explicit params
- [x] Verify all new error codes are properly returned
- [x] Verify existing session behavior is unchanged

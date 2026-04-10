# Proposal: contract-type-generation

## What

Auto-generate TypeScript and Python type stubs from `bridge-contract.yaml`, replacing the current hand-written type files.

## Why

- **Single source of truth**: The `bridge-contract.yaml` is the authoritative integration reference, but TypeScript (`packages/client/src/types.ts`) and Python (`clients/python/src/ai_spec_sdk/types.py`) types are currently maintained manually.
- **Synchronization risk**: Manual type files drift from the contract over time, leading to integration bugs and mismatched expectations.
- **v1 stability guarantee**: Before declaring v1 stable, we need machine-verifiable alignment between the contract and all client SDK types.
- **Developer productivity**: Auto-generation eliminates tedious manual updates when the contract evolves.

## Scope

### In Scope

- Parse `bridge-contract.yaml` and extract type definitions for:
  - All method params and result types
  - All notification payloads
  - All error data structures
  - Enums and literal types
- Generate TypeScript interfaces in `packages/client/src/types.ts`
- Generate Python dataclasses in `clients/python/src/ai_spec_sdk/types.py`
- Add a Node.js-based generator script at `scripts/generate-types.ts`
- Add npm script `generate:types` to run the generator
- Add generated-file header comments warning against manual edits
- Preserve existing exports and backward compatibility where possible

### Out of Scope

- Runtime validation of types (only static type generation)
- JSON Schema generation (may be added later)
- OpenAPI spec generation
- Breaking changes to the contract itself (this change only affects type generation)
- Kotlin/Scala type generation (JVM clients can use the Java types when available)

## Unchanged Behavior

- The bridge runtime behavior remains identical
- All existing JSON-RPC method signatures remain unchanged
- Client SDK public APIs remain source-compatible (types may be regenerated but semantics stay the same)
- The `bridge-contract.yaml` file itself is not modified
# Tasks: contract-type-generation

## Implementation

- [x] Add YAML parser dependency (yaml package)
- [x] Create `scripts/lib/contract-parser.ts` to parse bridge-contract.yaml
- [x] Create `scripts/lib/type-mappings.ts` for contract-to-language type mappings
- [x] Create `scripts/lib/ts-generator.ts` for TypeScript code generation
- [x] Create `scripts/lib/py-generator.ts` for Python code generation
- [x] Create `scripts/generate-types.ts` main entry point
- [x] Add `generate:types` npm script to package.json
- [x] Run generator and verify output compiles (TypeScript)
- [x] Run generator and verify output passes Python type checks

## Testing

- [x] Run `bun run lint` (TypeScript type check)
- [x] Run `bun run test` (unit tests)
- [x] Run Python client tests to verify generated types work correctly
- [x] Verify generated TypeScript types match hand-written types semantically
- [x] Verify generated Python types match hand-written types semantically

## Verification

- [x] Verify `packages/client/src/types.ts` is regenerated correctly
- [x] Verify `clients/python/src/ai_spec_sdk/types.py` is regenerated correctly
- [x] Verify both files contain auto-generated header comments
- [x] Verify no hand-written type files remain (they should be replaced)
- [x] Verify backward compatibility: existing imports still work

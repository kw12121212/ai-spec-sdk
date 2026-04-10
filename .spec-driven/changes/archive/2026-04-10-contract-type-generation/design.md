# Design: contract-type-generation

## Approach

### Generator Architecture

The type generator will be a TypeScript Node.js script (`scripts/generate-types.ts`) that:

1. **Parse Phase**: Load and parse `docs/bridge-contract.yaml` using a YAML parser
2. **Extract Phase**: Walk the contract structure to collect type definitions:
   - Method params and results from `methods.*.params` and `methods.*.result`
   - Notification payloads from `envelope.notification.params`
   - Error data structures from `error_codes.*.data`
   - Enum values from `enum` fields
3. **Transform Phase**: Convert contract types to target language types:
   - Contract `type: string` → TypeScript `string` / Python `str`
   - Contract `type: number` → TypeScript `number` / Python `int | float`
   - Contract `type: boolean` → TypeScript `boolean` / Python `bool`
   - Contract `type: array` → TypeScript array / Python `list[T]`
   - Contract `type: object` with `fields` → TypeScript interface / Python `@dataclass`
   - Contract `enum` → TypeScript union of literals / Python `Literal[...]`
   - Contract `nullable: true` → TypeScript union with `null` / Python `| None`
4. **Generate Phase**: Write formatted output files with generated headers

### File Structure

```
scripts/
  generate-types.ts          # Main generator entry point
  lib/
    contract-parser.ts       # YAML parsing and contract extraction
    ts-generator.ts          # TypeScript code generation
    py-generator.ts          # Python code generation
    type-mappings.ts         # Contract-to-language type mappings
```

### Generated File Headers

Both output files will include auto-generated warnings:

**TypeScript (`packages/client/src/types.ts`)**:
```typescript
// AUTO-GENERATED from bridge-contract.yaml
// Do not edit manually. Run `bun run generate:types` to regenerate.
// Generated at: <timestamp>
```

**Python (`clients/python/src/ai_spec_sdk/types.py`)**:
```python
# AUTO-GENERATED from bridge-contract.yaml
# Do not edit manually. Run type generator to regenerate.
# Generated at: <timestamp>
```

### Backward Compatibility Strategy

- Preserve existing export names where semantics match
- Add deprecated aliases for any renamed types
- Keep hand-written utility types (if any) in separate files

## Key Decisions

1. **Use TypeScript for the generator** (not Python):
   - The main project is TypeScript; keeps tooling consistent
   - Easier to share type definitions between generator and runtime
   - Single language for build pipeline

2. **Generate both languages from the same parse**:
   - Ensures consistency between TypeScript and Python types
   - Single source of truth in the contract file

3. **Preserve existing file paths**:
   - TypeScript: `packages/client/src/types.ts`
   - Python: `clients/python/src/ai_spec_sdk/types.py`
   - Maintains backward compatibility with existing imports

4. **No runtime validation**:
   - This change is purely for static type checking
   - Runtime validation can be added later if needed

## Alternatives Considered

1. **JSON Schema as intermediate format**:
   - Ruled out: Adds complexity without benefit; YAML is already structured
   - Would require maintaining schema-to-type converters

2. **Separate generators per language**:
   - Ruled out: Risk of divergence between TypeScript and Python types
   - Unified generator ensures consistency

3. **Template-based generation (Handlebars, EJS)**:
   - Ruled out: String concatenation is sufficient for this use case
   - Templates add dependency without significant readability benefit

4. **Python-based generator**:
   - Ruled out: Would require Python in the build pipeline
   - TypeScript generator can be run with `bun`/`node` already in use

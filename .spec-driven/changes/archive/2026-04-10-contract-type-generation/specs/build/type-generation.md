## ADDED Requirements

### Requirement: Type Generation from Bridge Contract

The SDK MUST provide an automated type generation system that produces TypeScript and Python type definitions from the authoritative `bridge-contract.yaml` file.

#### Scenario: Generate TypeScript types from contract
- GIVEN the `bridge-contract.yaml` file exists and is valid YAML
- WHEN the type generator script is executed
- THEN it produces a valid TypeScript file at `packages/client/src/types.ts`
- AND the file contains interfaces for all method params and results
- AND the file contains type definitions for all notification payloads
- AND the file contains a header comment indicating it is auto-generated

#### Scenario: Generate Python types from contract
- GIVEN the `bridge-contract.yaml` file exists and is valid YAML
- WHEN the type generator script is executed
- THEN it produces a valid Python file at `clients/python/src/ai_spec_sdk/types.py`
- AND the file contains dataclasses for all method params
- AND the file contains type aliases for all result types
- AND the file contains a header comment indicating it is auto-generated

#### Scenario: Type mappings are correct
- GIVEN a contract type definition
- WHEN it is transformed to TypeScript
- THEN `string` maps to `string`, `number` to `number`, `boolean` to `boolean`
- AND `array` maps to array syntax with element types
- AND `object` with fields maps to an interface
- AND `enum` maps to a union of literal types
- AND `nullable: true` maps to union with `null`

#### Scenario: Type mappings to Python are correct
- GIVEN a contract type definition
- WHEN it is transformed to Python
- THEN `string` maps to `str`, `number` to `int | float`, `boolean` to `bool`
- AND `array` maps to `list[T]` with element types
- AND `object` with fields maps to a `@dataclass`
- AND `enum` maps to `Literal[...]`
- AND optional fields map to `| None` with `None` default

#### Scenario: Generated TypeScript compiles without errors
- GIVEN the type generator has produced `packages/client/src/types.ts`
- WHEN `bun run typecheck` is executed
- THEN the TypeScript compiler reports no type errors in the generated file

#### Scenario: Generated Python passes type checks
- GIVEN the type generator has produced `clients/python/src/ai_spec_sdk/types.py`
- WHEN `mypy` or equivalent type checker is run
- THEN the Python type checker reports no errors in the generated file

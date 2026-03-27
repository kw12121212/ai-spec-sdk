# Tasks: compile-native-executable

## Implementation

- [x] Add `build:native` script to `package.json` using `bun build --compile src/cli.ts --outfile dist/ai-spec-bridge-native`
- [x] Update `.gitignore` to exclude `dist/ai-spec-bridge-native` and `dist/ai-spec-bridge-native.exe` (no-op: `dist/` already excluded)
- [x] Write `test/native-build.test.ts` — smoke test that builds the native binary and verifies it responds to a JSON-RPC `capabilities/list` call (gated on `NATIVE_BUILD_TEST=1`)

## Testing

- [x] Run `bun run lint` — typecheck passes with no errors
- [x] Run `bun test` — all existing tests pass (native smoke test skipped without env var)
- [x] Run `NATIVE_BUILD_TEST=1 bun test test/native-build.test.ts` — native smoke test builds binary and passes

## Verification

- [x] Verify implementation matches proposal

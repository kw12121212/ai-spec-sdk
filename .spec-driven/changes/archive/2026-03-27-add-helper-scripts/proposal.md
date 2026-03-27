# add-helper-scripts

## What

Create a `scripts/` directory containing bash helper scripts for common development operations: building, testing, linting, cleaning, and running all checks.

## Why

Currently all dev commands must be run via `bun run <script>` from package.json. Helper scripts provide:
- Single-command access without remembering `bun run` prefixes
- Composable workflows (e.g., clean + build + test in one step)
- Consistent entry points for CI and local development

## Scope

**In scope:**
- `scripts/build.sh` — clean build (remove dist/, run tsc)
- `scripts/test.sh` — run test suite with optional filter
- `scripts/check.sh` — run all checks: lint + typecheck + test
- `scripts/clean.sh` — remove dist/ and other build artifacts

**Out of scope:**
- Modifying existing package.json scripts
- Adding a Makefile
- CI pipeline configuration
- Watch mode or dev server scripts

## Unchanged Behavior

- All existing `bun run` scripts in package.json continue to work identically
- Build output path (`dist/`) remains unchanged
- Test runner behavior (bun test) remains unchanged
- Native build (`build:native`) remains unchanged

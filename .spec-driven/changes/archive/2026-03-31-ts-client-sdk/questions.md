# Questions: ts-client-sdk

## Open

## Resolved

- [x] Q: Should `packages/client/` be part of the root `bun` workspace, or fully standalone with its own `bun test` command?
      Context: A standalone client keeps the client build decoupled from the bridge build, Integration tests use `describe.skip`.
      A: Standalone (own `bun test`). Integration tests are skipped by default and use `describe.skip`.

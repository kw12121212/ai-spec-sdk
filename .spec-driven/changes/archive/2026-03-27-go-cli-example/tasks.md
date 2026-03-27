# Tasks: go-cli-example

## Implementation

- [x] Create `example/go-cli/` directory structure with `go.mod`
- [x] Implement `bridge/client.go` — JSON-RPC client over stdio subprocess (spawn, call, notification dispatch, shutdown)
- [x] Implement `ui/renderer.go` — terminal event rendering and multi-line input reader
- [x] Implement `session/session.go` — session manager wrapping bridge client (start, resume, stop, list, history, approve/reject)
- [x] Implement `workflow/workflow.go` — workflow list and run
- [x] Implement `main.go` — CLI entry point, flag parsing, REPL loop, slash command dispatch
- [x] Write `example/go-cli/README.md` — build prerequisites, usage instructions, command reference

## Testing

- [x] `go vet ./...` passes (no lint errors)
- [x] `go build ./...` compiles successfully
- [x] Manual smoke test: launch CLI, send a prompt, receive streamed response
- [x] Manual test: tool approval prompt appears and approve/reject works
- [x] Manual test: all slash commands execute without errors
- [x] Manual test: multi-line input (backslash continuation) works

## Verification

- [x] Verify implementation matches proposal scope
- [x] Verify all bridge methods are covered by at least one command or code path
- [x] Verify README instructions are accurate (build and run from `example/go-cli/`)

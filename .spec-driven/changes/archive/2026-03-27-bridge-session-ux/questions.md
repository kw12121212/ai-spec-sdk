# Questions: bridge-session-ux

## Open

<!-- No open questions — all resolved -->

## Resolved

- [x] Q: Should context.read also allow reading `~/.claude/` (user global context), or be strictly workspace-scoped?
  Context: Determines whether GUI clients can manage global context files or only per-workspace ones.
  A: Yes — allow both workspace and user scope for context operations.

- [x] Q: Should session branching try to reuse the original session's `sdkSessionId` for SDK-level resume, or always start fresh?
  Context: SDK resume preserves actual conversation state; fresh start only copies bridge-level history.
  A: Try SDK resume when `sdkSessionId` is available from the original session.

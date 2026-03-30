---
change: auth-and-authorization
type: questions
---

## Open

<!-- No open questions -->

## Resolved

- [x] Q: Where should `keys.json` live?
  Context: Roadmap said `~/.ai-spec-sessions/keys.json`, but existing code uses `~/.ai-spec-sdk/sessions/`.
  A: Use `~/.ai-spec-sdk/keys.json` to stay consistent with the existing `sessionsDir` at `~/.ai-spec-sdk/sessions/`.

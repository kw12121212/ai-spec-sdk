# Proposal: agent-session-sdk-wiring

## What

Wire the bridge's session model correctly to the Claude Agent SDK's `query()` call by:
1. Passing `cwd` derived from the validated `workspace` to every SDK query
2. Capturing the SDK-assigned `session_id` from the `system/init` event and storing it per bridge session
3. Using the stored SDK `session_id` when resuming a session (not the bridge's internal UUID)
4. Accepting an optional `proxy` parameter on `session.start` and `session.resume` that is translated into `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` entries merged into the SDK `env` option
5. Rejecting any caller-supplied `cwd` in `options` with a `-32602` error, since `cwd` is bridge-managed

## Why

The bridge currently passes the wrong working directory to the SDK (defaults to bridge process cwd, not the workspace) and the wrong session ID when resuming (bridge UUID instead of SDK session_id). These two bugs mean sessions run in the wrong directory and resume is silently broken. The proxy gap means the SDK cannot reach the Anthropic API behind a corporate HTTP proxy unless the bridge process already has the right environment, which is not always controllable by callers.

## Scope

**In scope:**
- `claude-agent-runner.ts`: accept and forward `cwd` and `env` to `query()` options; merge proxy env vars when provided
- `session-store.ts`: add `sdkSessionId` field; expose a method to set it after `system/init`
- `bridge.ts` `startSession` / `resumeSession`: pass `cwd: resolvedWorkspace`; capture SDK `session_id` from first `system/init` event; pass `resume: sdkSessionId` on resume; validate and translate `proxy` param; reject `cwd` in `options`
- Additions to `session/agent-sessions.md` delta spec (cwd alignment, SDK session_id retention)
- New delta spec `network/proxy-forwarding.md`
- Tests for all new observable behaviors

**Out of scope:**
- `workflow.run` (execFile already inherits process env)
- capabilities / skills / CLI entry point
- accepting proxy config at bridge construction time
- proxy authentication schemes beyond standard URL-embedded credentials

## Unchanged Behavior

- All existing JSON-RPC methods, error codes, and response shapes remain unchanged
- Sessions without a `proxy` param behave identically to today (after cwd and resume fixes)
- `session.stop` and `session.status` are unaffected
- Workflow execution path is unaffected

# Design: team-quotas

## Approach
We will extend the existing `QuotaScope` type in `src/quota/types.ts` to include `"team"`. When setting up a team quota rule, the `scopeId` will correspond to the team's identifier. 

To link usage to the correct team, the `Session` interface and `SessionStore.create` method will be updated to accept an optional `teamId`. During quota enforcement, if a session has a `teamId`, the enforcer will tally the session's token usage against any rules matching `scope: "team"` and `scopeId: session.teamId`. 

## Key Decisions
- **Explicit `teamId` on Session:** Rather than inferring the team dynamically from the workspace, we add `teamId` directly to the `Session` object. This makes it deterministic and decouples quota enforcement from workspace resolution.
- **Shared Token Pool:** Team quotas aggregate token usage across all sessions running for that team.

## Alternatives Considered
- **Implicit workspace-to-team mapping:** Look up the team based on the session's workspace during enforcement. Rejected because workspaces might be shared or might not map 1:1 to billing teams. Explicit `teamId` provides better flexibility.

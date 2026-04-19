# Proposal: team-quotas

## What
Add team-level quota enforcement for agent sessions, allowing organizations to restrict token usage and resource consumption across all sessions associated with a specific team.

## Why
Currently, quotas can only be enforced globally, per-provider, or per-session. In a collaborative environment with team registries, organizations need to manage resource budgets at the team level so that multiple agents working for the same team share a single token pool.

## Scope
- Add `"team"` to the list of valid `QuotaScope` values.
- Allow agent sessions to optionally associate themselves with a `teamId` at creation.
- Enforce token usage limits across all sessions that share the same `teamId`.
- Return the `teamId` in session metadata and session lists.

## Unchanged Behavior
- Existing global, session, and provider quotas remain unchanged and continue to operate normally.
- Sessions without a `teamId` are not subject to team quotas.

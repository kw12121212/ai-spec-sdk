# Tasks: team-quotas

## Implementation
- [x] Add `"team"` to `QuotaScope` and update validation in `src/quota/types.ts`.
- [x] Add optional `teamId` to `Session` interface and `SessionStore.create` method in `src/session-store.ts`.
- [x] Update `src/quota/enforcer.ts` to accumulate and enforce usage for `scope: "team"` when `session.teamId` is present.
- [x] Ensure `teamId` is persisted to disk and exported in session data.

## Testing

- [x] Run `bun run typecheck` — lint and typecheck validation.
- [x] Run `bun test` — unit test task for quota enforcement and session creation.

## Verification
- [x] Verify implementation matches proposal scope and correctly blocks queries when a team limit is exceeded.

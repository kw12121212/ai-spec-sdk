# Tasks: team-registry

## Implementation

- [x] Create `src/team-types.ts` with Team, TeamMember, CreateTeamParams, UpdateTeamParams interfaces
- [x] Create `src/team-store.ts` with TeamStore class (CRUD + member management + file persistence)
- [x] Add TeamStore initialization in `src/bridge.ts` constructor (persist under `<sessionsDir>/teams/`)
- [x] Add `team.create` bridge method with name/description/members/workspaces validation
- [x] Add `team.get` bridge method with name lookup and `-32031` error for not found
- [x] Add `team.update` bridge method with partial update support
- [x] Add `team.delete` bridge method with file cleanup
- [x] Add `team.list` bridge method returning sorted teams
- [x] Add `team.addMember` bridge method with duplicate and role validation
- [x] Add `team.removeMember` bridge method with membership check
- [x] Register all team methods in `src/capabilities.ts` methods array
- [x] Export new types from `src/index.ts` if needed

## Testing

- [x] Run `bun run lint` lint validation command
- [x] Write unit tests in `test/team-store.test.ts` covering all CRUD operations, member management, file persistence, corrupt file tolerance, and edge cases
- [x] Write unit tests in `test/team-bridge.test.ts` covering all seven JSON-RPC methods, parameter validation, error codes, and capability advertisement
- [x] Run unit test command `bun test` to ensure all tests pass

## Verification

- [x] Verify all team JSON-RPC methods return correct response shapes
- [x] Verify file persistence matches the atomic-write pattern (tmp + rename)
- [x] Verify capabilities advertisement includes all seven team methods
- [x] Verify no regressions in existing tests

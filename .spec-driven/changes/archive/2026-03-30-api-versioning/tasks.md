# Tasks: api-versioning

## Implementation

- [x] Add `API_VERSION` constant to `src/capabilities.ts` (equal to `BRIDGE_VERSION`)
- [x] Add `apiVersion` field to `Capabilities` interface and `getCapabilities()` return value
- [x] Implement `bridge.negotiateVersion` dispatch case in `src/bridge.ts`
- [x] Add per-request version validation in `dispatch()` — check `params.apiVersion` before method switch, throw `-32050` on mismatch
- [x] Add `bridge.negotiateVersion` to capabilities methods list
- [x] Update `docs/bridge-contract.yaml` with new method, `apiVersion` field, and error code `-32050`

## Testing

- [x] Lint passes (`bun run lint`)
- [x] Unit test: `bridge.capabilities` response includes `apiVersion`
- [x] Unit test: `bridge.negotiateVersion` returns `{negotiatedVersion, capabilities}` on match
- [x] Unit test: `bridge.negotiateVersion` returns `-32050` when no version matches
- [x] Unit test: `bridge.negotiateVersion` validates `supportedVersions` param (must be non-empty string array)
- [x] Unit test: request with matching `apiVersion` in params succeeds normally
- [x] Unit test: request with unsupported `apiVersion` in params returns `-32050`
- [x] Unit test: request without `apiVersion` in params succeeds (opt-in behavior)

## Verification

- [x] Verify `bridge.capabilities` response shape matches spec
- [x] Verify error code `-32050` data includes `supportedVersions`
- [x] Verify no regression in existing tests

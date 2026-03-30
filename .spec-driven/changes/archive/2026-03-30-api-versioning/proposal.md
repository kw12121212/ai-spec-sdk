# Proposal: API Versioning

## What

Add explicit API version negotiation to the bridge so clients can declare which version they target, and the bridge can evolve without breaking existing consumers.

The bridge will:
- Include an `apiVersion` field in `bridge.capabilities` responses (e.g., `"0.2.0"`)
- Expose a `bridge.negotiateVersion` method: client sends `{supportedVersions: ["0.2.0"]}`, bridge responds with `{negotiatedVersion, capabilities}`
- Validate an optional `apiVersion` field in any JSON-RPC request params; if the requested version is unsupported, return error code `-32050` with `supportedVersions` in data
- Use semantic versioning: Major = breaking, Minor = backwards-compatible additions, Patch = bug fixes

## Why

The bridge API is growing (session persistence, HTTP transport, auth are next). Without version negotiation, any change risks silently breaking existing clients. An explicit version handshake lets clients verify compatibility at startup and fail fast on mismatch, while keeping the bridge free to evolve.

## Scope

- Add `API_VERSION` constant to `src/capabilities.ts` (initially equals `BRIDGE_VERSION`)
- Add `apiVersion` to `bridge.capabilities` response
- Implement `bridge.negotiateVersion` JSON-RPC method
- Add per-request version validation when `apiVersion` is present in params
- Define error code `-32050` for version mismatch
- Update `docs/bridge-contract.yaml`

## Out of Scope

- Running multiple API versions simultaneously (single-version bridge)
- Auto-migration of client requests between versions
- Version-specific method dispatch or parameter transformation

## Unchanged Behavior

- Clients that do not send an `apiVersion` field continue to work exactly as before (no breaking change)
- All existing JSON-RPC methods retain their current parameter shapes and response shapes
- `bridge.capabilities` gains one new field (`apiVersion`) but all existing fields remain unchanged
- The version constant equals the existing `BRIDGE_VERSION` — no separate versioning scheme

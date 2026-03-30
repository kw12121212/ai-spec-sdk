# Design: API Versioning

## Approach

1. **Define `API_VERSION`** in `src/capabilities.ts` — a semver string (`"0.2.0"`) that is initially identical to `BRIDGE_VERSION`. This is the single source of truth for the API contract version.

2. **Extend `bridge.capabilities`** — add an `apiVersion` field to the response. The `Capabilities` interface and `getCapabilities()` function get one new field.

3. **Add `bridge.negotiateVersion` method** — the client sends `{supportedVersions: ["0.2.0"]}`. The bridge finds the highest matching version from the client's list and responds with `{negotiatedVersion, capabilities}` (full capabilities object). If no version matches, return error `-32050`.

4. **Per-request version validation** — in `dispatch()`, before the method switch, check if `params.apiVersion` is present. If it is, validate it against `API_VERSION`. On mismatch, throw `BridgeError(-32050, ...)` with `supportedVersions` in data. This is opt-in: requests without `apiVersion` skip validation entirely.

5. **Error code `-32050`** — reserved for version mismatch. Error data includes `{supportedVersions: [API_VERSION]}`.

6. **Update bridge-contract.yaml** — document the new method, error code, and `apiVersion` field.

## Key Decisions

- **Version equals BRIDGE_VERSION** — avoids maintaining two separate versioning schemes. The API version tracks the bridge package version since they evolve together.
- **Opt-in validation** — clients that don't send `apiVersion` are never rejected. This is backwards compatible with all existing clients.
- **Single active version** — the bridge runs one version at a time. `negotiateVersion` is for future-proofing, not for running multiple versions.
- **Semver semantics only as documentation** — the bridge does not parse or compare semver ranges. It does exact string matching. Major/Minor/Patch semantics are a contract for developers, not enforced in code.

## Alternatives Considered

- **Separate API version from package version** — rejected: adds complexity with no current benefit since there's only one version. Can be split later if needed.
- **Range-based version matching** — rejected: YAGNI. Exact match is sufficient for a single-version bridge. Range support can be added when multi-version support is needed.
- **Version header in JSON-RPC metadata** — rejected: using a params field is simpler, more visible, and consistent with how other per-request data (like `sessionId`) is passed.

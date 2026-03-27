# Questions: bridge-integrator-gaps

## Open

<!-- No open questions -->

## Resolved

- [x] Q: Does `session.list` need pagination?
  Context: In-memory storage means session counts are bounded by process lifetime; pagination adds API complexity.
  A: No pagination. Cap the response at the 100 most recent sessions.

- [x] Q: How detailed should the `agent_message` event schema be?
  Context: More detail gives integrators a stable contract; less detail reduces coupling to SDK internals.
  A: Very detailed — enumerate all observable message sub-types with field-level descriptions and map each to a stable `messageType` label.

- [x] Q: Should `permissionMode` valid values be enumerated in the spec?
  Context: An open string allows future extension but removes the contract value of the parameter.
  A: Yes — enumerate `"default"`, `"acceptEdits"`, `"bypassPermissions"`. Unknown values return `-32602`.

- [x] Q: What is the default value for `permissionMode`?
  Context: Programmatic integrators typically do not want interactive permission prompts.
  A: `"bypassPermissions"` (Full Access). When the caller omits `permissionMode`, the bridge applies this default.

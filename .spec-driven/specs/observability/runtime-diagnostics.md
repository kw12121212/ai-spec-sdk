### Requirement: CLI Help Output
Running `ai-spec-bridge --help` MUST print usage information to stdout and exit successfully without starting stdio or HTTP transport.

The help output MUST describe:
- transport startup flags
- HTTP auth-related flags
- key-management commands
- the `doctor` command

#### Scenario: Help prints usage without starting the bridge
- GIVEN an operator runs `ai-spec-bridge --help`
- WHEN the CLI processes the command line
- THEN usage text is written to stdout
- AND the process exits with code `0`

### Requirement: Doctor CLI Command
Running `ai-spec-bridge doctor` MUST print a human-readable diagnostic summary of the bridge's resolved runtime configuration and basic checks.

The summary MUST include the same core runtime metadata exposed by `bridge.info`, plus a list of checks containing machine-readable `name`, `ok` (boolean), and `detail` (string) values for at least the sessions directory, key configuration, and spec-driven script resolution.

Warnings MAY be reported without failing the command. If any diagnostic check reports `ok: false`, the command MUST exit with a non-zero status.

#### Scenario: doctor prints a readable summary
- GIVEN an operator runs `ai-spec-bridge doctor`
- WHEN the command completes
- THEN stdout contains a human-readable summary of runtime metadata and diagnostic checks

### Requirement: Doctor JSON Output
Running `ai-spec-bridge doctor --json` MUST write a JSON object to stdout containing the bridge runtime metadata and diagnostic checks.

The JSON output MUST include:
- `info` — the same core runtime metadata fields returned by `bridge.info`
- `checks` — an array of objects with `name` (string), `ok` (boolean), and `detail` (string)

#### Scenario: doctor --json is scriptable
- GIVEN an operator runs `ai-spec-bridge doctor --json`
- WHEN the command completes
- THEN stdout contains valid JSON with `info` and `checks`
- AND the `info` object contains the same fields as `bridge.info` (`bridgeVersion`, `apiVersion`, `transport`, `authMode`, `logLevel`, `sessionsPath`, `keysPath`, `specDrivenScriptPath`, `nodeVersion`)

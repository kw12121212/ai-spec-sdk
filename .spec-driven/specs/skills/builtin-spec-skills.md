### Requirement: Built-in Skill Discovery
The SDK MUST let clients discover which spec-driven skills are bundled and available through the current SDK distribution.

#### Scenario: List bundled skills
- GIVEN a client wants to understand the spec-driven capabilities packaged with the SDK
- WHEN the client requests bundled skill information
- THEN the bridge returns machine-readable metadata describing the bundled spec-driven skills

### Requirement: Workflow and Skill Alignment
The SDK SHOULD report which bundled skills back the supported high-level workflow operations so host tools can present understandable capability descriptions without depending on internal file layouts.

#### Scenario: Describe workflow support
- GIVEN a client inspects the bridge capability metadata
- WHEN the bridge reports supported workflow operations
- THEN the response identifies the related bundled spec-driven capabilities in a machine-readable form

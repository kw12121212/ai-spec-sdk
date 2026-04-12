---
mapping:
  implementation:
    - src/bridge.ts
  tests: []
---
### Requirement: Explicit Proxy Configuration
The SDK MUST accept an optional `proxy` parameter on session start and resume requests and MUST translate it into the agent process environment so the agent can reach the Anthropic API through a corporate HTTP proxy.

#### Scenario: Proxy settings are applied to the agent environment
- GIVEN a client starts or resumes a session with a `proxy` parameter containing one or more of `http`, `https`, or `noProxy`
- WHEN the bridge launches the agent query
- THEN the agent process environment contains `HTTP_PROXY`, `HTTPS_PROXY`, and/or `NO_PROXY` entries corresponding to the supplied proxy values

#### Scenario: Proxy fields are merged with other caller-provided env entries
- GIVEN a client supplies both a `proxy` parameter and additional entries in `options.env`
- WHEN the bridge builds the agent environment
- THEN proxy entries overwrite matching env keys and all other caller-provided env entries are preserved

#### Scenario: Session without proxy is unaffected
- GIVEN a client starts or resumes a session without a `proxy` parameter
- WHEN the bridge launches the agent query
- THEN no proxy-related entries are added to the agent environment beyond what the caller provided in `options.env`

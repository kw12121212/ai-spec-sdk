## MODIFIED Requirements

### Requirement: Session History Method in Capabilities
The bridge capability response MUST advertise `session.history` as a supported method so clients can discover it without trial and error.

#### Scenario: Capabilities include session.history
- GIVEN a client calls `bridge.capabilities`
- WHEN the bridge returns its capability metadata
- THEN the response identifies `session.history` as a supported method

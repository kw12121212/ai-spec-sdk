---
implementation:
  - src/session-store.ts
tests:
  - test/session-store-audit.test.ts
---

# Delta Specification: agent-sessions.md

## ADDED Requirements

### Requirement: Session Store Audit Integration

The `SessionStore` MUST accept an `AuditLog` instance via its constructor and use it to write audit entries for state transitions.

When `transitionExecutionState` is called and the state machine transition succeeds, the `SessionStore` MUST additionally write a `state_transition` audit entry through the `AuditLog` instance (if provided). If no `AuditLog` instance is provided, state transitions MUST still function normally without audit entries.

When `create` is called and a new session is initialized, the `SessionStore` MUST write a `session_created` audit entry through the `AuditLog` instance (if provided).

#### Scenario: SessionStore writes audit on state transition
- GIVEN a SessionStore is constructed with an AuditLog instance
- AND a session is created
- WHEN transitionExecutionState moves the session from "idle" to "running"
- THEN the AuditLog receives a write call with eventType "state_transition"

#### Scenario: SessionStore works without AuditLog
- GIVEN a SessionStore is constructed without an AuditLog instance
- WHEN a session is created and transitions states
- THEN operations succeed normally and no error is thrown

#### Scenario: SessionStore writes audit on create
- GIVEN a SessionStore is constructed with an AuditLog instance
- WHEN create() is called with a workspace and prompt
- THEN the AuditLog receives a write call with eventType "session_created"

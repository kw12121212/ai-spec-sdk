# Proposal: permission-audit

## What
Add formal spec definitions and automated test coverage for permission audit events (`scope_denied` and `policy_decision`).

## Why
While the runtime implementation currently emits audit events when a tool is blocked by a scope or when a policy makes a decision, these events are not formally listed in the `audit-logging.md` schema definitions, and they lack explicit coverage in the automated test suite. Formalizing these events is required to complete the "Permissions Model and Execution Hooks" milestone.

## Scope
- Update `audit-logging.md` to define the payload schemas for `scope_denied` and `policy_decision` events.
- Update the test suite to assert that these audit events are correctly emitted by the bridge with the expected payloads.

## Unchanged Behavior
- Existing permission checks, scope resolution, and policy evaluation logic remain unchanged.
- Existing audit logging mechanisms remain unchanged.

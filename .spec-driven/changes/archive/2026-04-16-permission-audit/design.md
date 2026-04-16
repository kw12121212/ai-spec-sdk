# Design: permission-audit

## Approach
The code currently emits `scope_denied` and `policy_decision` audit events from the bridge execution loop. We will update the `audit-logging.md` delta spec to add these to the "Defined Event Types" table and add their corresponding Scenarios to that central location. 
For verification, we will update `test/bridge.test.ts` (or relevant permission test files) to assert that the correct events are written when scopes are denied or policies are evaluated.

## Key Decisions
- **Rely on existing bridge implementation:** The bridge already correctly passes the audit context. We are elevating this to an officially supported and tested spec feature.
- **Test location:** The tests will be added alongside the existing permission tests where the scenarios are naturally triggered.

## Alternatives Considered
- **N/A:** Formalizing existing implementation behavior is the most direct path to fulfilling the milestone.

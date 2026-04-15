---
mapping:
  implementation:
    - src/permission-policy.ts
  tests:
    - test/permission-policy.test.ts
---

## MODIFIED Requirements

### Requirement: policy-evaluation
Previously: The system MUST evaluate a chain of `PermissionPolicy` instances in order and return the first explicit `allow` or `deny` decision, or `pass` if no policy makes a decision.
The system MUST evaluate a chain of `PermissionPolicy` instances in order and return the first explicit `allow`, `deny`, or `approval_required` decision, or `pass` if no policy makes a decision.

## ADDED Requirements

### Requirement: approval-required-decision
The system MUST support an `approval_required` decision from a `PermissionPolicy`.

#### Scenario: policy requires approval
- GIVEN a policy that returns `approval_required` for a specific tool and input
- WHEN the policy is evaluated in a chain
- THEN the chain evaluation MUST halt and return the `approval_required` decision along with any context provided by the policy.

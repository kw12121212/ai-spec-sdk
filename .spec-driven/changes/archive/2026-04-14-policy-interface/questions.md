# Questions: policy-interface

## Open
<!-- No open questions — all resolved during recommendation phase -->

## Resolved
- [x] Q: Should policy checks be sync or async?
  Context: Determines the PermissionPolicy interface method signature and affects bridge execution flow.
  A: Async interface (`Promise<PolicyResult>`). Sync implementations simply return resolved promises. Consistent with existing async hook model. Avoids breaking change when external policy services are needed.

- [x] Q: How should multiple policies combine decisions?
  Context: Determines PolicyResult type, chain execution logic, and future compatibility with approval-chains and rbac-system.
  A: Ordered chain with deny-short-circuit. Policies return `allow`, `deny`, or `pass`. `deny` stops chain immediately. `allow` short-circuits in allow direction. All `pass` means default allow. Consistent with existing hook sequential execution pattern.

- [x] Q: Can policies be dynamically registered/deregistered during session execution?
  Context: Determines whether runtime JSON-RPC methods for policy management are needed and whether concurrency controls are required.
  A: Static binding — policies are set at session creation only. Eliminates concurrency risks. Dynamic capability can be added as a future extension without breaking the static interface.

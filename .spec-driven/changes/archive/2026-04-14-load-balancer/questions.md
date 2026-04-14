# Questions: load-balancer

## Open

<!-- No open questions -->

## Resolved

- [x] Q: Which balancing strategies are in scope for v1?
  Context: Determines implementation surface and `balancer.create` parameter schema.
  A: Round-robin is required; weighted is optional (supported if `weights` provided,
     defaults to equal weights otherwise).

- [x] Q: Should the load balancer use proactive health-poll or reactive exclusion?
  Context: Proactive polling needs a background interval process; reactive exclusion
  is simpler and consistent with the existing fallback chain model.
  A: Reactive exclusion only at v1. A provider is excluded after a live-request failure
     and re-admitted after a configurable cool-down (default 30 s). No polling background
     process.

- [x] Q: How does the load balancer relate to the existing per-provider fallback chain?
  Context: Affects data model — should the balancer manage fallback internally or defer
  to each provider's own `fallbackProviderIds`?
  A: Composable. The balancer selects which provider to call; if that provider has a
     `fallbackProviderIds` chain, fallback activates independently on error. The two
     mechanisms are orthogonal.

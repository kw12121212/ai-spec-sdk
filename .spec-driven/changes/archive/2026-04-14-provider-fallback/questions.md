# Questions: provider-fallback

## Open

<!-- No open questions -->

## Resolved

- [x] Q: What triggers a fallback — errors only, or also health-check failures proactively?
  Context: Determines whether a background health-check loop is in scope for this change or deferred to `load-balancer`.
  A: Reactive only (on live request error). No background polling. Consistent with the existing on-demand `healthCheck` method.

- [x] Q: Is the fallback chain ordered and exhaustive, or just "primary + one backup"?
  Context: Shapes the schema for fallback config and the retry loop logic.
  A: Ordered array (`fallbackProviderIds: string[]`) — not significantly harder to implement and avoids a second design round when users want more than one backup.

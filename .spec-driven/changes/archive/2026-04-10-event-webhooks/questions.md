# Questions: event-webhooks

## Open

<!-- No open questions -->

## Resolved

- [x] Q: Webhook secret 生命周期 — 是每次 subscribe 生成独立密钥还是整个 bridge 共用一个密钥？
  Context: 影响签名验证和密钥管理复杂度。共用密钥更简单，独立密钥更安全。
  A: 共用一个 bridge 级密钥。v1 只有 admin 权限能订阅，信任边界相同，无需独立密钥。

- [x] Q: Webhook 注册数量上限 — 是否需要限制单个 bridge 可注册的 webhook 数量？
  Context: 防止资源滥用。无限注册可能导致大量并发出站请求。
  A: v1 不设上限。admin 权限信任边界内不太可能滥用，后续可按需添加。

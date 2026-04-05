# Questions: rate-limiting

## Open

<!-- No open questions -->

## Resolved

- [x] Q: 默认限流阈值是多少？
  Context: 需要在 spec 和实现中硬编码默认值
  A: 每 Key 每分钟 120 次请求

- [x] Q: 限流粒度是按 Key 还是按 Key+端点？
  Context: 影响令牌桶的 Map key 设计
  A: 仅按 Key，不区分端点

- [x] Q: 429 响应体格式是 JSON-RPC 错误还是普通 HTTP 错误？
  Context: 客户端错误处理方式不同
  A: JSON-RPC 错误格式（code `-32029`）

- [x] Q: `GET /events` SSE 连接是否纳入限流？
  Context: SSE 是长连接，限流语义与 RPC 请求不同
  A: 不纳入，仅 `POST /rpc` 受限流约束

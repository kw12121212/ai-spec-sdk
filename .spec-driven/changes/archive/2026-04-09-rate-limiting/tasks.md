# Tasks: rate-limiting

## Implementation

- [x] 新建 `src/rate-limiter.ts`：实现 `RateLimiter` 类，令牌桶算法，`consume(keyId: string): { allowed: boolean; remaining: number; resetAt: number }` 接口，桶容量 120/分钟
- [x] 在 `src/http-server.ts`（或等效 HTTP 入口文件）中，在认证/授权中间件之后、方法分发之前插入限流检查
- [x] 限流中间件：admin Key 和 `--no-auth` 模式直接跳过
- [x] 超限时返回 HTTP 429，响应体为 JSON-RPC 错误（code `-32029`, message `"Rate limit exceeded"`），并附带 `X-RateLimit-Limit`、`X-RateLimit-Remaining`、`X-RateLimit-Reset` 响应头
- [x] 正常放行请求时，在响应上附带 `X-RateLimit-Limit` 和 `X-RateLimit-Remaining` 头（可选，但有助于客户端感知剩余额度）

## Testing

- [x] Unit tests: run `bun test test/rate-limiter.test.ts` for the token bucket limiter behavior
- [x] 单元测试 `test/rate-limiter.test.ts`：令牌补充逻辑、消耗逻辑、边界（恰好用完、超限第一次、时间流逝后恢复）
- [x] 集成测试：同一 Key 连续请求 121 次，第 121 次收到 429 + JSON-RPC 错误体 + 正确响应头
- [x] 集成测试：admin Key 超过 120 次请求后不返回 429
- [x] 集成测试：`--no-auth` 模式下超量请求不触发 429
- [x] 集成测试：`GET /events` SSE 端点高频连接不触发 429
- [x] 运行 `bun test test/rate-limiter.test.ts`，确认限流器单元测试通过
- [x] 运行 `bun test`，确认全部测试通过
- [x] 运行 `bun run lint`，确认类型检查通过

## Verification

- [x] 确认 `POST /rpc` 超限返回 HTTP 429 + code `-32029` JSON-RPC 错误
- [x] 确认响应包含 `X-RateLimit-Limit: 120`、`X-RateLimit-Remaining`、`X-RateLimit-Reset` 三个头
- [x] 确认 admin Key 不受限流
- [x] 确认 `--no-auth` 模式不启用限流
- [x] 确认 `GET /events` 不受限流
- [x] 确认现有认证/授权错误码路径（`-32061`、`-32060`）未受影响
- [x] 确认 stdio 传输行为无变化
- [x] 确认 delta spec 与实际实现一致

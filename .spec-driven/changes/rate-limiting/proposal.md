# rate-limiting

## What

为 HTTP 传输层添加基于令牌桶算法的按 API Key 限流机制。每个 Key 默认每分钟最多发起 120 次 `POST /rpc` 请求；超限时返回 HTTP 429 和 JSON-RPC 错误响应，并附带 `X-RateLimit-*` 响应头。`admin` 范围的 Key 绕过所有限流检查。

## Why

Bridge 已具备 API Key 认证和范围授权（里程碑 02），但缺乏速率保护。没有限流时，单个恶意或失控的客户端可以耗尽 Claude Agent SDK 配额或使 Bridge 进程过载。在开放自定义工具注册（`custom-tool-registration`）之前，先锁住 HTTP 入口的速率是更安全的顺序。

## Scope

**在范围内：**
- 令牌桶限流：每 Key、每分钟 120 次请求（默认值，不可配置）
- 限流仅作用于 `POST /rpc` 端点
- 超限响应：HTTP 429 + JSON-RPC 错误体（code `-32029`）+ `X-RateLimit-Limit`、`X-RateLimit-Remaining`、`X-RateLimit-Reset` 响应头
- `admin` 范围的 Key 跳过限流检查
- `--no-auth` 模式下不启用限流
- 限流状态存储在进程内存中（重启后重置）

**不在范围内：**
- `GET /events` SSE 连接不纳入限流
- `GET /health`、`GET /` 等非 RPC 端点不纳入限流
- 可配置的限流阈值（后续里程碑可扩展）
- 持久化限流状态（跨进程/重启）
- 按端点粒度的独立限流规则

## Unchanged Behavior

- 所有现有认证和授权逻辑不变（`-32061` 和 `-32060` 错误码路径）
- stdio 传输不受任何影响
- SSE 事件流（`GET /events`）行为不变
- 未超限的正常请求响应路径不变
- `--no-auth` 模式下 Bridge 行为整体不变（仅额外跳过限流）

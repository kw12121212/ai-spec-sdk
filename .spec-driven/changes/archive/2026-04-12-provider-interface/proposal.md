# provider-interface

## What

定义 LLM 提供商抽象层接口，采用适配器模式支持多个 LLM 后端（Anthropic Claude、OpenAI、本地模型等）。实现提供商接口契约、生命周期管理、能力发现机制，并提供基于现有 `@anthropic-ai/claude-agent-sdk` 的 Anthropic 适配器作为参考实现。

## Why

当前代码库硬编码依赖 `@anthropic-ai/claude-agent-sdk`，所有 LLM 调用都通过 [claude-agent-runner.ts](src/claude-agent-runner.ts) 中的 `runClaudeQuery` 函数直接与 Anthropic API 交互。这种紧耦合导致：

1. **无法切换提供商**：生产环境可能需要使用 OpenAI、本地模型或其他 LLM 服务
2. **无法做负载均衡**：单一提供商无法满足高可用性和成本优化需求
3. **无法统一 Token 管理**：不同提供商的 Token 计费和限制各不相同
4. **阻碍后续功能**：里程碑 12（流式 Token 增强）和 14（持久化缓存）都需要提供商感知的架构

引入提供商接口是里程碑 08 的基础，为后续的注册表、切换、Token 追踪等功能奠定基础。

## Scope

### In Scope
- 定义 `LLMProvider` TypeScript 接口（异步方法 + 流式支持）
- 实现提供商配置模式（API 密钥、模型名称、温度、max_tokens 等参数）
- 实现提供商生命周期管理（初始化、健康检查、销毁）
- 实现提供商能力发现接口（支持的特性、Token 限制、流式支持等）
- 实现 Anthropic 适配器（包装现有的 `@anthropic-ai/claude-agent-sdk` 集成）
- 更新 [session-store.ts](src/session-store.ts) 以支持提供商选择配置
- 添加单元测试覆盖接口定义、适配器行为、错误处理

### Out of Scope
- 多提供商注册表（属于 `provider-registry` 变更）
- 运行时提供商切换（属于 `provider-switching` 变更）
- Token 使用量追踪（属于 `token-tracking` 变更）
- 负载均衡（属于 `load-balancer` 变更）
- 故障转移（属于 `provider-fallback` 变更）
- 其他提供商的具体实现（OpenAI、本地模型等）

## Unchanged Behavior

- 现有的 JSON-RPC 方法签名和行为保持不变
- 会话创建和管理流程保持不变（仅扩展配置选项）
- 现有测试套件的行为不受影响
- 默认情况下仍使用 Anthropic 作为唯一提供商（向后兼容）

# token-tracking

## What

实现按会话和按提供商的 token 使用量核算系统，包括：
- 自定义 Token Counter 接口，支持多提供商的 token 统计标准化
- 会话级和消息级的 token 使用追踪
- Token 使用数据的内存存储与查询 API
- 与现有 provider 抽象层的集成
- 为工具调用级粒度预留扩展点（stretch goal）

## Why

### 业务动机
1. **成本可观测性**：用户需要了解每个会话、每条消息消耗了多少 token，以便进行成本控制和预算管理
2. **计费基础**：为后续的 `quota-management`（配额限制）和 `token-budget`（预算分配）提供数据基础
3. **多提供商一致性**：里程碑 08 的目标是支持多个 LLM 提供商（Anthropic、OpenAI、本地模型等），不同提供商的 token 计数方式不同，需要统一抽象层
4. **运营分析**：支持按提供商、按会话、按时间维度的使用量分析

### 技术背景
- 当前 `src/claude-agent-runner.ts` 已从 Claude Agent SDK 和自定义 Provider 获取 `TokenUsage`（inputTokens/outputTokens）
- 但这些数据仅在单次查询返回时临时存在，没有持久化存储或聚合统计
- 现有的 `provider-registry` 规范已完成，provider 抽象层已就绪
- 里程碑 08 的前 3 个变更（provider-interface、provider-registry、provider-switching）已完成，`token-tracking` 是该里程碑中第一个未完成的 planned 项目

## Scope

### In Scope
1. **TokenCounter 接口定义**
   - 定义 `TokenCounter` 接口，每个 LLM Provider 实现自己的计数逻辑
   - 为 Anthropic 提供默认实现（基于 SDK 返回值）
   - 预留 OpenAI 和其他提供商的实现扩展点

2. **TokenStore 接口与内存实现**
   - 定义 `TokenStore` 接口用于存储 token 使用记录
   - 提供 `InMemoryTokenStore` 默认实现
   - 明确标注持久化接口，为里程碑 14 的持久化实现预留路径

3. **会话级 token 追踪**
   - 记录每个会话的总 inputTokens / outputTokens
   - 支持按 sessionId 查询累计使用量
   - 支持按 providerId 维度聚合

4. **消息级 token 追踪**
   - 记录每次用户/助手交互（消息轮次）的 token 消耗
   - 支持 messageId 关联查询
   - 数据模型预留 toolCallId 字段（可选填充）

5. **JSON-RPC 查询方法**
   - `token.getUsage(sessionId)` - 获取指定会话的使用情况
   - `token.getSessionSummary(sessionId)` - 获取会话级汇总
   - `token.getProviderUsage(providerId?)` - 获取提供商维度统计
   - `token.getMessageUsage(sessionId, messageId)` - 获取消息级详情

6. **集成到现有流程**
   - 在 `runClaudeQuery` 完成后自动记录 token 使用
   - 在 Provider queryStream 完成后自动记录
   - 与 session-store 的生命周期关联

### Out of Scope
1. **工具调用级 token 归因**（标记为 stretch goal，可在 tasks.md 中作为增强任务）
2. **token 数据持久化**（归属里程碑 14 的 persistence-policies）
3. **配额管理和强制执行**（归属同里程碑的 quota-management）
4. **负载均衡相关的 token 分配**（归属 load-balancer）
5. **token 使用预测**（归属里程碑 12 的 token-prediction）
6. **实时流式 token 计数**（归属里程碑 12 的 stream-control）

## Unchanged Behavior

以下行为必须保持不变：
- `runClaudeQuery` 函数签名和返回值结构（仅增加副作用：记录 token）
- Provider.queryStream 的接口和行为
- Session store 的现有 CRUD 操作
- Bridge 的现有 JSON-RPC 方法（新增方法不影响已有方法）
- Provider registry 的注册/列表/更新/删除流程
- 错误码体系（新增错误码不冲突已有码段）
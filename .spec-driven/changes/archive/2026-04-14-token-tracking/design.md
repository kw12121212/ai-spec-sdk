# Design: token-tracking

## Approach

采用**接口驱动 + 内存存储 + 自动集成**的三层架构：

### 1. TokenCounter 接口层（标准化多提供商计数）

```
src/token-tracking/
├── types.ts              # TokenUsage, TokenRecord, TokenCounter 接口
├── counters/
│   ├── index.ts          # Counter 注册表
│   └── anthropic.ts      # Anthropic 默认实现
└── store.ts              # TokenStore 接口 + InMemoryTokenStore 实现
```

**核心接口设计：**

```typescript
interface TokenCounter {
  providerType: string;
  count(usage: unknown): TokenUsage;
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number; // computed
}
```

每个 Provider 类型注册自己的 `TokenCounter`，将提供商原始的 usage 数据转换为标准化的 `TokenUsage`。

### 2. TokenStore 存储层（内存优先，可替换）

```typescript
interface TokenStore {
  record(entry: TokenRecord): void;
  getSessionUsage(sessionId: string): SessionTokenSummary | null;
  getMessageUsage(sessionId: string, messageId: string): TokenRecord | null;
  getProviderUsage(providerId?: string): ProviderTokenSummary[];
  clearSession(sessionId: string): void;
  clearAll(): void;
}

interface TokenRecord {
  sessionId: string;
  messageId?: string;        // 可选：消息级追踪
  providerId: string;
  providerType: string;
  timestamp: number;         // Date.now()
  inputTokens: number;
  outputTokens: number;
  toolCallId?: string;       // 预留：工具调用级扩展
}
```

默认实现使用 `Map<sessionId, TokenRecord[]>` 结构，支持 O(1) 的会话级查询和 O(n) 的消息级/提供商级聚合。

### 3. 集成层（自动记录，无侵入）

在 `runClaudeQuery` 返回前插入记录逻辑：
- 检测返回值中的 `usage` 字段
- 通过 Provider 获取对应的 TokenCounter
- 标准化后写入 TokenStore
- 不改变原有返回值结构（纯副作用）

Bridge 层新增 JSON-RPC 方法路由到 TokenStore 查询。

## Key Decisions

### Decision 1: 使用自定义 TokenCounter 接口而非硬编码 SDK 解析

**选择**：定义 `TokenCounter` 接口，按 providerType 注册实现

**理由**：
1. 里程碑 08 已完成 provider 抽象层，支持多提供商是既定目标
2. 不同提供商的 token 计数语义不同（Anthropic 按 token，OpenAI 可能按字符）
3. 现在投入接口设计比后期返工成本更低
4. Anthropic 实现可以作为默认，其他按需添加

**影响**：
- 新增 `src/token-tracking/counters/` 目录
- 需要在 provider 初始化时关联 counter
- 增加约 15% 的代码量，但大幅提升扩展性

### Decision 2: 会话级 + 消息级双粒度，预留工具调用级

**选择**：MVP 实现会话级和消息级，数据模型预留 toolCallId 字段但不强制填充

**理由**：
1. 80/20 法则：会话+消息级覆盖主要计费和分析场景
2. 工具调用级需要更复杂的 pipeline 集成，适合作为增强任务
3. 预留字段避免后续 schema migration
4. 保持当前变更范围可控

**影响**：
- TokenRecord.messageId 为可选字段
- TokenRecord.toolCallId 为可选字段且标注 @optional
- tasks.md 中标记工具调用级为 stretch goal

### Decision 3: InMemoryTokenStore 作为默认实现，暴露可替换接口

**选择**：定义 TokenStore 接口，提供内存实现，明确标注持久化归属里程碑 14

**理由**：
1. 当前阶段不需要跨重启持久化
2. 接口抽象使得里程碑 14 可以无缝替换为 SQLite/文件存储
3. 避免引入新的依赖（如 better-sqlite3）导致范围膨胀
4. 符合 YAGNI 原则

**影响**：
- 重启后历史 token 数据丢失（预期行为）
- 无法生成跨时间段的使用报告（直到 14 完成）
- 设计文档中明确说明此限制

### Decision 4: 在 runClaudeQuery 返回前自动记录，而非要求调用方手动触发

**选择**：作为副作用自动记录，不改变函数签名或返回值

**理由**：
1. 最小化对现有代码的侵入性
2. 所有查询路径统一覆盖（SDK path 和 Provider path）
3. 不需要修改 workflow 或 session-store 的调用代码
4. 符合"横切关注点"的最佳实践（类似 logging）

**影响**：
- runClaudeQuery 内部增加 ~10 行记录逻辑
- 需要注入 TokenStore 实例（通过模块级单例或参数传递）
- 测试时需要 mock TokenStore 或使用 InMemoryTokenStore

### Decision 5: 新增独立 JSON-RPC 命名空间 `token.*` 而非扩展现有方法

**选择**：新增 `token.getUsage`, `token.getSessionSummary`, `token.getProviderUsage`, `token.getMessageUsage`

**理由**：
1. token 查询是独立的关注点，不属于 session 或 provider 的 CRUD
2. 未来可能新增更多 token 相关方法（预算、配额等），需要命名空间
3. 与现有的 `provider.*` 命名空间风格一致
4. 避免现有方法的参数膨胀

**影响**：
- bridge.ts 新增 method router 分支
- 错误码使用 -32600~-32699 的自定义区间（如 -32050 系列）

## Alternatives Considered

### Alternative A: 直接解析 SDK 返回值，不做抽象层

**方案**：在 runClaudeQuery 中直接提取 usage.input_tokens/output_tokens，硬编码 Anthropic 格式

**优点**：
- 实现最简单，代码量最少
- 无需新接口或注册机制

**缺点**：
❌ 与多提供商目标矛盾
❌ 切换到 OpenAI 时必须重构
❌ 无法处理不同提供商的格式差异
❌ 不符合里程碑 08 的架构方向

**结论**：拒绝，因为牺牲了长期可维护性换取短期便利

### Alternative B: 包含工具调用级 token 归因

**方案**：在 MVP 中就实现完整的 toolCallId 追踪

**优点**：
- 一步到位，功能完整
- 为 permission-scopes 提供即时数据支持

**缺点**：
❌ 需要修改 tool execution pipeline 的多个入口点
❌ 复杂度增加约 40%
❌ 当前没有明确的业务需求驱动
❌ 可能延迟交付核心功能

**结论**：推迟到 stretch goal 或后续变更，遵循增量交付原则

### Alternative C: 直接使用 SQLite 持久化

**方案**：引入 better-sqlite3，立即实现持久化存储

**优点**：
- 数据不丢失
- 支持复杂查询（GROUP BY、时间范围过滤）
- 为运营分析提供完整能力

**缺点**：
❌ 引入原生依赖，增加构建复杂度
❌ 超出当前里程碑范围（14 专门处理持久化）
❌ 可能与 14 的设计方案冲突
❌ 增加测试复杂度（需要文件系统或内存数据库）

**结论**：拒绝，遵循依赖顺序，让 14 统一解决持久化问题

### Alternative D: 将 token 方法合并到 session.* 命名空间

**方案**：在 session.get 中追加 usage 字段，或在 session 下新增子方法

**优点**：
- 减少顶层命名空间数量
- session 和 usage 天然关联

**缺点**：
❌ session 方法变得臃肿（CRUD + usage + templates...）
❌ token 查询有独立的维度（按 provider、全局统计）
❌ 未来 quota/budget 方法难以归类
❌ 违反单一职责原则

**结论**：拒绝，独立命名空间更清晰、更可扩展
# Design: provider-interface

## Approach

采用**适配器模式（Adapter Pattern）**实现 LLM 提供商抽象层。核心设计思路：

1. **定义统一接口**：创建 `LLMProvider` TypeScript 接口，规定所有提供商必须实现的方法
2. **实现 Anthropic 适配器**：将现有的 `runClaudeQuery` 逻辑封装为 `AnthropicAdapter` 类，实现 `LLMProvider` 接口
3. **配置驱动**：通过 `ProviderConfig` 类型定义配置模式，支持运行时参数化
4. **能力发现**：每个适配器声明自身支持的能力，便于上层逻辑做特性检测
5. **生命周期管理**：提供初始化、健康检查、销毁的标准方法

### 核心类型定义

```typescript
// src/llm-provider/types.ts

export interface ProviderConfig {
  id: string;
  type: "anthropic" | "openai" | "local"; // 可扩展
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: unknown; // 提供商特定参数
}

export interface ProviderCapabilities {
  streaming: boolean;
  tokenUsageTracking: boolean;
  functionCalling: boolean;
  maxContextLength?: number;
  supportedModels: string[];
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface QueryMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface QueryOptions {
  messages: QueryMessage[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  [key: string]: unknown;
}

export interface StreamEvent {
  type: "text_delta" | "usage_delta" | "complete" | "error";
  data: unknown;
}

export interface LLMProvider {
  readonly id: string;
  readonly config: ProviderConfig;

  initialize(): Promise<void>;
  healthCheck(): Promise<boolean>;
  getCapabilities(): ProviderCapabilities;

  query(options: QueryOptions): Promise<QueryResult>;
  queryStream(options: QueryOptions, onEvent: (event: StreamEvent) => void, signal?: AbortSignal): Promise<QueryResult>;

  destroy(): void;
}

export interface QueryResult {
  status: "completed" | "stopped";
  result: unknown;
  usage: TokenUsage | null;
}
```

### 文件结构

```
src/
  llm-provider/
    types.ts              # 接口和类型定义
    index.ts              # 导出入口
    adapters/
      anthropic.ts        # Anthropic 适配器实现
```

### 集成点

- [claude-agent-runner.ts](src/claude-agent-runner.ts)：重构为使用 `LLMProvider` 接口而非直接调用 SDK
- [session-store.ts](src/session-store.ts)：Session 对象增加可选的 `providerId` 字段
- 测试文件通过 `globalThis.__AI_SPEC_SDK_QUERY__` 注入 stub（保持现有模式）

## Key Decisions

### 决策 1：选择适配器模式而非统一协议模式

**决策**：采用适配器模式，每个提供商包装其原生 API

**理由**：
- 更容易添加新提供商（只需实现接口，无需转换到中间格式）
- 允许暴露提供商特有功能（通过 `[key: string]: unknown` 扩展）
- 减少抽象层带来的性能开销
- 符合现有代码库的务实风格

**权衡**：
- 上层调用者需要了解不同提供商的行为差异
- Token 计数格式可能不统一（后续由 `token-tracking` 变更处理）

### 决策 2：异步接口 + 内置流式支持

**决策**：所有方法返回 Promise，流式查询通过回调模式实现

**理由**：
- 与现有 `runClaudeQuery` 的异步迭代器模式一致
- 为里程碑 12（流式增强）预留扩展点
- Node.js 环境下异步 I/O 是标准做法
- 回调式流式事件比 Observable/RxJS 更轻量

**权衡**：
- 不支持背压控制（由里程碑 12 的 `backpressure-handling` 处理）
- 调用者需手动管理 AbortSignal

### 决策 3：Anthropic 适配器作为唯一实现

**决策**：此变更仅包含 Anthropic 适配器，其他提供商留待后续变更

**理由**：
- 保持变更范围可控，聚焦于接口设计和集成
- Anthropic 适配器可验证接口设计的合理性
- 降低测试复杂度（无需模拟多个 API）
- 遵循 YAGNI 原则

**权衡**：
- 无法立即验证多提供商场景
- OpenAI 等热门提供商需要等待后续变更

## Alternatives Considered

### 替代方案 A：统一协议模式（Protocol Buffer 风格）

**描述**：定义标准的请求/响应协议，所有提供商必须转换为该格式

**优点**：
- 上层调用者完全屏蔽提供商差异
- 易于实现负载均衡和故障转移
- Token 追踪格式天然统一

**缺点**：
- 转换层增加复杂度和性能开销
- 可能丢失提供商特有功能
- 需要维护协议版本兼容性
- 过度工程化，当前阶段不需要

**结论**：拒绝。适配器模式更符合项目当前的务实风格和规模需求。

### 替代方案 B：依赖注入 + 工厂模式

**描述**：通过工厂函数动态创建提供商实例，配合 DI 容器管理生命周期

**优点**：
- 高度灵活，易于测试
- 支持复杂的提供商创建逻辑
- 便于未来添加 AOP 拦截器

**缺点**：
- 引入 DI 框架增加学习成本
- 当前项目规模不需要如此重的抽象
- 与现有简单架构风格不一致

**结论**：拒绝。简单的工厂函数即可满足需求，避免过度设计。

### 替代方案 C：事件驱动架构（EventEmitter）

**描述**：使用 Node.js EventEmitter 实现流式输出，而非回调模式

**优点**：
- 符合 Node.js 惯例
- 支持多监听者
- 内置错误处理机制

**缺点**：
- 需要管理 EventEmitter 生命周期（防止内存泄漏）
- 与现有 `onEvent` 回调模式不一致
- 增加解耦复杂度（调用者需订阅/取消订阅）

**结论**：拒绝。保持与现有代码库一致的回调模式，降低认知负担。

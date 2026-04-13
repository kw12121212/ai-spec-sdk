# Questions: token-tracking

## Open

<!-- No open questions at proposal time -->

## Resolved

- [x] Q: Token 数据来源 - 应该依赖 Claude Agent SDK 返回值还是支持自定义计数器？
  Context: 影响架构设计、多提供商支持能力、后续扩展成本
  A: **使用自定义 TokenCounter 接口**（用户确认）
  Rationale: 符合里程碑 08 多提供商目标；Anthropic 作为默认实现；避免后期返工

- [x] Q: 粒度级别 - 需要追踪到工具调用级还是仅会话/消息级？
  Context: 影响实现复杂度、数据模型设计、pipeline 集成点
  A: **会话级 + 消息级作为 MVP，预留工具调用级扩展点**（用户确认）
  Rationale: 80/20 法则覆盖主要场景；TokenRecord.toolCallId 字段预留但不强制填充；工具调用级标记为 stretch goal

- [x] Q: 持久化需求 - token 数据需要跨重启保留还是仅内存维护？
  Context: 影响存储后端选择、与里程碑 14 的依赖关系、功能完整性
  A: **内存优先 + 接口抽象，持久化归属里程碑 14**（用户确认）
  Rationale: 定义 TokenStore 接口 + InMemoryTokenStore 默认实现；明确标注限制（重启丢失历史）；里程碑 14 可无缝替换为持久化实现
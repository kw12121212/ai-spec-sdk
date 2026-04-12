# Questions: provider-interface

## Open

<!-- No open questions -->

## Resolved

- [x] Q: 提供商接口设计应采用适配器模式还是统一协议模式？
  Context: 影响添加新提供商的复杂度 vs 跨提供商行为标准化程度
  A: 采用**适配器模式** —— 更容易添加新提供商，允许暴露提供商特有功能，符合项目务实风格

- [x] Q: 此变更是否应包含其他提供商的具体实现，还是仅定义接口 + 一个参考实现？
  Context: 决定范围大小和测试方法
  A: 仅实现 **Anthropic 适配器**作为概念验证（使用现有 `@anthropic-ai/claude-agent-sdk`）—— 保持范围聚焦，降低测试复杂度，遵循 YAGNI 原则

- [x] Q: 提供商方法应该是异步的（返回 Promise）还是原生支持流式传输？
  Context: 影响调用者交互方式和后续里程碑 12 的集成方式
  A: **异步 + 内置流式支持** —— 与现有代码库模式一致，为里程碑 12 预留扩展点

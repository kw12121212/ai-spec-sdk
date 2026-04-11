# Questions: agent-state-machine

## Open

<!-- No open questions -->

## Resolved

- [x] Q: 新的 agent 状态转换是否应通过新的 JSON-RPC 方法暴露给客户端？
  Context: 决定本变更的范围边界——是否需要定义新方法签名
  A: 仅定义内部状态机，新方法推迟到 `pause-resume` 变更。状态机定义是独立于传输层的核心契约，先稳定核心，后续再添加控制入口。

- [x] Q: 现有 `session.stop` 是否应重新映射到新状态机中某个具体转换路径？
  Context: 影响是否需要区分"执行状态"和"持久化状态"两个概念
  A: 明确区分两层状态。执行状态（idle, running, paused, waiting_for_input, error）由状态机管理；持久化状态（active, completed, stopped, interrupted）保持不变。`session.stop` → 执行状态转 completed → 持久化状态更新为 stopped。

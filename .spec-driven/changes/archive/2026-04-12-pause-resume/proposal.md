# pause-resume

## What

为 Bridge 和 Agent 会话添加优雅的暂停和恢复功能。允许客户端在 Agent 执行过程中暂停会话，保存完整的执行状态（包括当前消息历史、执行状态、上下文等），然后在稍后的时间点从精确的中断点恢复执行。新增 JSON-RPC 方法 `session.pause` 和 `session.resume`，并完善 `executionState` 状态机以支持 "paused" 状态的转换。

## Why

当前 Agent 会话只能启动、停止或自然完成。在长运行任务、需要人工审核中间结果、或资源受限需要临时释放资源的场景中，暂停/恢复是非常有用的功能：

1. **长任务管理**：长时间运行的任务可以暂停以释放资源，稍后继续
2. **人工审核**：Agent 执行过程中可以暂停，让用户检查当前状态后再继续
3. **资源调度**：多个会话之间可以分时复用计算资源
4. **状态保存**：暂停时保存的完整状态可以用于调试和分析

此变更建立在已完成的 agent-state-machine、execution-hooks 和 audit-logging 基础上，是 07-agent-lifecycle 里程碑的关键组成部分。

## Scope

**在范围内：**
- 新增 `session.pause` 方法：暂停正在执行的会话
  - 参数：`{ sessionId: string, reason?: string }`
  - 只能在 `executionState` 为 "running" 或 "waiting_for_input" 时调用
- 新增 `session.resume` 方法增强：支持从暂停状态恢复
  - 现有的 `session.resume` 方法保持相同参数，但新增对 "paused" 状态的处理
- 扩展 AgentStateMachine 支持 "paused" 状态的转换
- 暂停时保存完整状态：消息历史、当前执行状态、SDK 会话 ID、工作区等
- 暂停状态持久化到磁盘（与现有会话持久化一致）
- 暂停/恢复时触发相应的执行钩子和审计日志
- 状态转换事件通知（bridge/execution_state_changed）

**不在范围内：**
- 执行到特定断点的暂停（需要 Agent SDK 支持）
- 暂停状态的版本控制或差异比较
- 暂停会话的导入/导出功能
- 分布式环境下的暂停/恢复
- 暂停超时或自动恢复

## Unchanged Behavior

- 不使用暂停功能的会话行为完全不变
- 现有的 `session.start`、`session.stop` 方法行为不变
- 现有的 `session.resume` 用于恢复中断/完成会话的功能保持不变
- 状态机中除 "paused" 相关转换外的其他状态转换不变
- 会话持久化格式的其他字段保持不变

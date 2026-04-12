# Tasks: pause-resume

## Implementation

- [x] 扩展 `src/session-store.ts`：
  - [x] 在 Session 接口中添加 `pausedAt?: string` 和 `pauseReason?: string` 字段
  - [x] 确保这些字段在序列化/反序列化时被正确处理
  - [x] 在 `create` 方法中初始化这些字段为 undefined
- [x] 修改 `src/capabilities.ts`：
  - [x] 在 `methods` 数组中添加 `session.pause`
- [x] 修改 `src/bridge.ts`：
  - [x] 在 `dispatch` 方法中添加 `session.pause` 的 case 处理
  - [x] 实现 `pauseSession(params)` 私有方法：
    - [x] 参数校验：验证 sessionId 存在且类型正确
    - [x] 验证 executionState 为 "running" 或 "waiting_for_input"
    - [x] 调用状态机 transition 到 "paused"，trigger: "user_pause"
    - [x] 设置 pausedAt 为当前时间
    - [x] 如果提供了 reason，保存 pauseReason
    - [x] 触发审计日志：session_paused 事件
    - [x] 返回 { success: true, sessionId, pausedAt }
  - [x] 修改 `resumeSession` 方法：
    - [x] 检查 executionState 是否为 "paused"
    - [x] 如果是：调用状态机 transition 到 "running"，trigger: "user_resume"
    - [x] 清除 pausedAt 和 pauseReason 字段
    - [x] 触发审计日志：session_resumed 事件
    - [x] 继续执行查询
    - [x] 否则保持现有行为
  - [x] 修改 `_getStatus` 和 `_listSessions` 方法，确保返回 pausedAt 和 pauseReason 字段（如果存在）

## Testing

- [x] Unit test `test/session-store.test.ts`：
  - [x] 测试 pausedAt 和 pauseReason 字段的序列化/反序列化
  - [x] 测试创建会话时这些字段初始化为 undefined
- [x] Unit test `test/bridge.test.ts`：
  - [x] 测试 `session.pause` 成功暂停 running 状态的会话
  - [x] 测试 `session.pause` 成功暂停 waiting_for_input 状态的会话
  - [x] 测试 `session.pause` 从 idle 状态返回错误
  - [x] 测试 `session.pause` 从 paused 状态返回错误
  - [x] 测试 `session.pause` 从 completed/error 状态返回错误
  - [x] 测试 `session.pause` 未知会话返回 -32011 错误
  - [x] 测试 `session.pause` 保存 reason 字段
  - [x] 测试 `session.resume` 从 paused 状态恢复
  - [x] 测试 `session.resume` 后 pausedAt 和 pauseReason 被清除
  - [x] 测试 `session.status` 和 `session.list` 返回暂停字段
  - [x] 测试 `bridge.capabilities` 包含 session.pause
- [x] `bun run lint` 通过
- [x] `bun test` 全部通过

## Verification

- [x] 确认 `session.pause` 返回正确的响应格式
- [x] 确认 `session.pause` 只能从 "running" 或 "waiting_for_input" 状态调用
- [x] 确认暂停时 executionState 正确转换为 "paused"
- [x] 确认 pausedAt 和 pauseReason 被正确保存
- [x] 确认暂停状态被持久化到磁盘
- [x] 确认 `session.resume` 可以从 "paused" 状态恢复
- [x] 确认恢复后 pausedAt 和 pauseReason 被清除
- [x] 确认恢复后 executionState 正确转换为 "running"
- [x] 确认暂停和恢复都写入了审计日志
- [x] 确认 `bridge.capabilities` 包含 "session.pause"
- [x] 确认 lint 和测试全部通过

---
implementation:
  - src/session-store.ts
  - src/bridge.ts
tests:
  - test/session-store.test.ts
  - test/bridge.test.ts
---

# Delta Specification: pause-resume

## ADDED Requirements

### Requirement: 暂停会话

Bridge 必须暴露 `session.pause` 方法，允许客户端暂停正在执行的会话。

参数：`{ sessionId: string, reason?: string }`。

Bridge 必须：
1. 验证 `sessionId` 存在，不存在返回 `-32011` 错误
2. 检查会话的 `executionState`：只能从 `"running"` 或 `"waiting_for_input"` 状态暂停
3. 如果状态无效，返回 `-32602` 错误并说明原因
4. 将 `executionState` 转换为 `"paused"`
5. 记录 `pausedAt` 时间戳（ISO 8601）
6. 如果提供了 `reason`，保存该原因
7. 将会话状态持久化到磁盘
8. 返回 `{ success: true, sessionId: string, pausedAt: string }`

#### Scenario: 暂停正在运行的会话
- GIVEN 一个 `executionState` 为 `"running"` 的会话
- WHEN 客户端调用 `session.pause` 并传入该会话 ID
- THEN 会话的 `executionState` 变为 `"paused"`
- AND 返回 `pausedAt` 时间戳

#### Scenario: 暂停等待输入的会话
- GIVEN 一个 `executionState` 为 `"waiting_for_input"` 的会话
- WHEN 客户端调用 `session.pause`
- THEN 会话成功暂停

#### Scenario: 暂停无效状态返回错误
- GIVEN 一个 `executionState` 为 `"idle"` 的会话
- WHEN 客户端调用 `session.pause`
- THEN 返回 `-32602` 错误

#### Scenario: 暂停未知会话返回错误
- GIVEN 没有会话存在
- WHEN 客户端调用 `session.pause` 并传入无效 ID
- THEN 返回 `-32011` 错误

## MODIFIED Requirements

### Requirement: 从暂停状态恢复会话

现有的 `session.resume` 方法必须支持从 `"paused"` 状态恢复会话。

当 `executionState` 为 `"paused"` 时调用 `session.resume`，Bridge 必须：
1. 将 `executionState` 转换为 `"running"`
2. 清除 `pausedAt` 和 `pauseReason` 字段
3. 继续执行 Agent 查询（使用保存的 `sdkSessionId` 和消息历史）
4. 返回与现有 `session.resume` 相同的响应格式

#### Scenario: 从暂停状态恢复
- GIVEN 一个 `executionState` 为 `"paused"` 的会话
- WHEN 客户端调用 `session.resume`
- THEN 会话的 `executionState` 变为 `"running"`
- AND Agent 查询继续执行

### Requirement: 执行状态机补充

状态机必须支持以下暂停相关的转换，已在 VALID_TRANSITIONS 中定义：
- `running` → `paused` (trigger: "user_pause")
- `waiting_for_input` → `paused` (trigger: "user_pause")
- `paused` → `running` (trigger: "user_resume")

#### Scenario: 从 running 转换到 paused 成功
- GIVEN 状态机状态为 `"running"`
- WHEN 调用 transition("paused", "user_pause")
- THEN 转换成功并返回 true

#### Scenario: 从 paused 转换到 running 成功
- GIVEN 状态机状态为 `"paused"`
- WHEN 调用 transition("running", "user_resume")
- THEN 转换成功并返回 true

#### Scenario: 无效转换被拒绝
- GIVEN 状态机状态为 `"idle"`
- WHEN 调用 transition("paused", "user_pause")
- THEN 转换失败并返回 false

### Requirement: 会话持久化补充

会话持久化必须包含暂停相关字段：
- `pausedAt?: string` - ISO 8601 时间戳
- `pauseReason?: string` - 用户提供的暂停原因

#### Scenario: 暂停字段被持久化
- GIVEN 一个已暂停的会话
- WHEN 会话被保存到磁盘
- THEN JSON 文件包含 `pausedAt` 字段（可能包含 `pauseReason`）

#### Scenario: 暂停字段被恢复
- GIVEN 磁盘上有一个包含 `pausedAt` 的会话文件
- WHEN 桥启动并加载该会话
- THEN 会话的 `pausedAt` 和 `pauseReason` 被正确恢复

### Requirement: 会话元数据包含暂停信息

`session.status`、`session.list` 和 `session.export` 响应必须包含暂停相关字段（如果存在）：
- `pausedAt?: string`
- `pauseReason?: string`

#### Scenario: 状态响应包含暂停信息
- GIVEN 一个已暂停的会话
- WHEN 客户端调用 `session.status`
- THEN 响应包含 `pausedAt`（可能包含 `pauseReason`）

### Requirement: 暂停/恢复审计日志

Bridge 必须为暂停和恢复操作写入审计日志条目：
- `session_paused` 事件（category: "lifecycle"），payload 包含 `reason`（如果有）、`pausedAt`
- `session_resumed` 事件（category: "lifecycle"），payload 包含 `resumedAt`

#### Scenario: 暂停写入审计日志
- GIVEN 客户端暂停一个会话
- WHEN 暂停操作完成
- THEN 存在 `session_paused` 审计条目

#### Scenario: 恢复写入审计日志
- GIVEN 客户端恢复一个暂停的会话
- WHEN 恢复操作完成
- THEN 存在 `session_resumed` 审计条目

### Requirement: capabilities 方法包含 session.pause

`bridge.capabilities` 响应必须在支持的方法列表中包含 `session.pause`。

#### Scenario: capabilities 包含 session.pause
- GIVEN 客户端调用 `bridge.capabilities`
- THEN 响应中的 `methods` 数组包含 `"session.pause"`

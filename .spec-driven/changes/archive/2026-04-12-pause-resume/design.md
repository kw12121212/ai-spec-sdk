# Design: pause-resume

## Approach

### 1. 状态机扩展

好消息是 `AgentStateMachine` 已经支持 "paused" 状态和相关转换：
- `running` → `paused` (trigger: "user_pause")
- `waiting_for_input` → `paused` (trigger: "user_pause")
- `paused` → `running` (trigger: "user_resume")

无需修改状态机的核心逻辑。

### 2. 会话数据模型扩展

在 Session 数据模型中添加暂停相关字段：

```typescript
interface Session {
  // 现有字段保持不变
  id: string;
  workspace: string;
  sdkSessionId?: string;
  status: SessionStatus;
  executionState: AgentExecutionState;
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
  result?: unknown;
  
  // 新增暂停相关字段
  pausedAt?: string;          // ISO 8601 暂停时间戳
  pauseReason?: string;       // 用户提供的暂停原因
}
```

### 3. JSON-RPC 方法实现

在 `BridgeServer` 类中新增方法：

**`session.pause`**
1. 校验参数：`sessionId`（必需）、`reason`（可选，字符串）
2. 查找会话，不存在返回 `-32011` 错误
3. 检查执行状态：只能从 "running" 或 "waiting_for_input" 状态暂停，否则返回错误
4. 调用状态机 transition 到 "paused"，trigger: "user_pause"
5. 保存暂停时间和原因到会话
6. 如果会话正在执行查询，需要优雅地中断（方案见下方）
7. 触发审计日志：`session_paused` 事件
8. 触发钩子：`session_paused` 事件
9. 返回 `{ success: true, sessionId, pausedAt }`

**`session.resume`（增强）**
现有 `session.resume` 方法保持相同参数，但新增：
1. 如果 `executionState` 为 "paused"：
   - 调用状态机 transition 到 "running"，trigger: "user_resume"
   - 清除 `pausedAt` 和 `pauseReason`
   - 触发审计日志：`session_resumed` 事件
   - 触发钩子：`session_resumed` 事件
   - 恢复查询执行（方案见下方）
2. 否则保持现有行为（从 completed/interrupted 恢复）

### 4. 查询中断与恢复方案（核心）

由于 Claude Agent SDK 的 `query()` 函数是 Promise 驱动的，无法真正"暂停"执行中的查询。我们采用**协作式暂停**方案：

**暂停流程：**
1. 当调用 `session.pause` 时，设置会话的 `executionState` 为 "paused"
2. 如果查询正在运行，标记会话为 "pending_pause"（内部标志）
3. 在工具执行前检查暂停标志（利用已有的 `pre_tool_use` 钩子）
4. 如果检测到暂停标志，保存当前状态（消息历史），然后让查询自然完成（或通过 `session.stop` 中断）
5. 保存完整状态到磁盘

**恢复流程：**
1. 当调用 `session.resume` 且状态为 "paused" 时
2. 从保存的消息历史恢复上下文
3. 使用保存的 `sdkSessionId` 调用 `query()` 继续执行
4. 状态机转换到 "running"

### 5. 与现有系统的集成

**审计日志**
- `session_paused` 事件：包含 `reason`、`pausedAt`
- `session_resumed` 事件：包含 `resumedAt`
- 状态转换自动记录（已有机制）

**钩子系统**
- `session_paused` 事件：非阻塞
- `session_resumed` 事件：非阻塞
- 复用现有的钩子执行机制

**会话持久化**
- `pausedAt` 和 `pauseReason` 字段自动序列化和反序列化
- 与现有持久化机制一致

## Key Decisions

### 1. 协作式暂停而非抢占式暂停

**决策：** 采用协作式暂停，在工具执行点检查暂停标志，而非强制中断正在运行的查询。

**理由：**
- Claude Agent SDK 不支持真正的暂停/恢复
- 强制中断可能导致不一致的状态
- 在工具执行点暂停是自然的断点，用户可以理解
- 后续可根据 SDK 更新改进实现

### 2. 复用现有 session.resume 方法

**决策：** 不新增 `session.resumeFromPause` 方法，而是增强现有 `session.resume` 支持多种恢复场景。

**理由：**
- API 更简洁，一个方法处理所有恢复情况
- 客户端无需区分不同的恢复场景
- 向后兼容

### 3. 暂停状态持久化

**决策：** 暂停状态完整持久化到磁盘，包括消息历史和暂停元数据。

**理由：**
- 与现有会话持久化一致
- 支持桥重启后恢复暂停的会话
- 提供更好的可靠性

### 4. 状态转换验证

**决策：** 严格限制暂停/恢复的状态转换，不符合时返回明确错误。

**理由：**
- 避免无效的状态组合
- 客户端可以明确处理错误情况
- 符合状态机的设计原则

## Alternatives Considered

### 方案 A：真正的抢占式暂停（通过 AbortController）

考虑使用 AbortController 强制中断正在运行的查询，然后在恢复时重新发送完整历史。

**拒绝理由：**
- 会丢失当前正在执行的工具的状态
- 用户体验不好（需要重新运行已执行的部分）
- 实现复杂度高

### 方案 B：新增独立的暂停/恢复方法

考虑新增 `session.pause` 和 `session.resumeFromPause` 两个独立方法。

**拒绝理由：**
- API 更复杂
- 客户端需要知道当前状态来选择方法
- 现有 `session.resume` 可以自然扩展

### 方案 C：仅内存暂停，不持久化

考虑暂停状态不保存在磁盘，桥重启后丢失。

**拒绝理由：**
- 与现有会话持久化不一致
- 用户预期暂停的会话应该在重启后仍然存在
- 降低可靠性

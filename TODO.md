# GUI 接入方缺口分析 TODO

> 从打造全功能 Claude Code GUI 的角度，梳理当前 SDK 的能力缺口。
> 日期：2026-03-27

---

## 现有能力

- JSON-RPC 2.0 stdio 传输
- `session.start` / `session.resume` / `session.stop` / `session.status` / `session.list`
- `bridge/session_event` 流式通知（含消息类型分类）
- Agent 控制参数（model、tools、permissionMode、maxTurns、systemPrompt）
- Proxy 透传
- 能力发现（`bridge.capabilities`）+ 技能列表（`skills.list`）

---

## 🔴 关键缺口（直接阻塞 GUI 核心功能）

### [x] 1. 会话历史读取
`session.status` 只返回 `historyLength`，不返回实际内容。GUI 无法：
- 展示完整对话记录
- 重新加载已有会话的消息流
- 缺少 `session.history` 方法

### [x] 2. 会话持久化
所有会话存储在内存的 `SessionStore` 中，Bridge 进程重启后全部丢失。GUI 通常需要：
- 重启后恢复会话列表
- 跨进程生命周期的会话状态

---

## 🟡 重要缺口（影响 GUI 体验质量）

### [x] 3. Heartbeat / Ping
GUI 不知道 Bridge 进程是否还存活，没有健康检查机制。

### [x] 4. 错过事件的回放
GUI 进程崩溃重连后，中间的 `bridge/session_event` 通知已丢失，
没有事件历史回放接口。

### [x] 5. `session.list` 缺少初始 Prompt
会话列表只有 workspace + 状态，没有初始 prompt，GUI 的会话列表无法显示有意义的标题。

### [x] 6. 使用量 / Token 费用
会话结果中没有 token 用量数据，GUI 无法展示费用统计。

---

## 🟢 加分项（完整体验）

### [ ] 7. 模型列表
没有 `models.list` 接口，GUI 不能动态展示可选 Claude 模型。

### [ ] 8. Workspace 注册表
没有 workspace 管理，GUI 不能追踪"最近使用的项目"。

### [ ] 9. 工具 Schema 列表
GUI 没有途径获知哪些工具可用、参数是什么。

### [ ] 10. 工具审批流（Tool Approval）
当前 `permissionMode` 默认 `bypassPermissions`，Bridge 没有任何机制让 GUI 弹出
"Claude 要执行此命令，是否批准？"对话框。GUI 无法：
- 收到"待审批"事件
- 回复批准 / 拒绝
- 让 Agent 等待用户响应

---

## 待确认方向

- [ ] **工具审批流** 是否在 GUI 计划中？（如果默认 bypassPermissions 可接受则可延后）
- [ ] **持久化** 是否必要？还是 GUI 进程与 Bridge 进程生命周期绑定就够？
- [ ] 优先攻哪个缺口？单点做深 vs 一批小缺口打包？

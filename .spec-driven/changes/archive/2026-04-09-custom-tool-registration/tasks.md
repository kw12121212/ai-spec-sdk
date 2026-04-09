# Tasks: custom-tool-registration

## Implementation

- [x] 扩展 `src/workspace-store.ts`：
  - [x] 新增 `CustomTool` 接口定义
  - [x] 新增 `private customTools: Map<string, Map<string, CustomTool>>` 存储
  - [x] 实现 `registerTool(workspace, tool)` 方法
  - [x] 实现 `unregisterTool(workspace, name)` 方法
  - [x] 实现 `listTools(workspace)` 方法
  - [x] 实现 `getTool(workspace, name)` 方法
- [x] 修改 `src/capabilities.ts`：
  - [x] 在 `methods` 数组中添加 `tools.register` 和 `tools.unregister`
- [x] 修改 `src/bridge.ts`：
  - [x] 在 `dispatch` 方法中添加 `tools.register` 和 `tools.unregister` 的 case 处理
  - [x] 修改 `tools.list` case，支持可选的 `workspace` 参数
  - [x] 实现 `registerTool(params)` 私有方法：参数校验、名称前缀校验、工作区存在性校验
  - [x] 实现 `unregisterTool(params)` 私有方法：参数校验、删除工具
  - [x] 实现 `listTools(params)` 私有方法：合并内置工具和自定义工具
  - [x] 实现 `_getAvailableCustomTools` 辅助方法：根据 allowed/disallowed 过滤工具
  - [x] 实现 `_buildCustomToolInstructions` 辅助方法：构建系统提示词
  - [x] 修改 `startSession` 和 `resumeSession`：注入自定义工具到系统提示词
  - [x] 修改 `_runQuery`：接受 `customTools` 参数并注入系统提示词

## Testing

- [x] Unit test `test/workspace-store.test.ts`（新建）：
  - [x] `registerTool` 正常注册工具
  - [x] `registerTool` 重复注册覆盖旧工具
  - [x] `unregisterTool` 删除已存在工具
  - [x] `unregisterTool` 删除不存在工具返回 false
  - [x] `listTools` 返回工作区所有自定义工具
  - [x] `getTool` 获取指定工具
  - [x] 工作区隔离测试
- [x] Unit test `test/bridge-tools.test.ts`（新建）：
  - [x] `tools.register` 成功注册自定义工具
  - [x] `tools.register` 名称不以 `custom.` 开头返回错误
  - [x] `tools.register` 未注册工作区返回错误
  - [x] `tools.register` 参数类型错误返回 `-32602`
  - [x] `tools.unregister` 成功删除工具
  - [x] `tools.unregister` 删除不存在工具返回 `{ success: false }`
  - [x] `tools.list` 无 `workspace` 参数返回仅内置工具
  - [x] `tools.list` 有 `workspace` 参数返回内置 + 自定义工具
  - [x] `tools.register` 和 `tools.unregister` 在 capabilities 中
- [x] `bun run lint` 通过
- [x] `bun test` 全部通过

## Verification

- [x] 确认 `tools.register` 返回完整工具定义（含 `registeredAt`）
- [x] 确认 `tools.unregister` 返回 `{ success: boolean }`
- [x] 确认 `tools.list` 无参数时仅返回内置工具
- [x] 确认 `tools.list` 带 `workspace` 参数时返回合并列表
- [x] 确认自定义工具名称强制以 `custom.` 开头
- [x] 确认未注册工作区无法注册工具
- [x] 确认自定义工具可在 `session.start`/`session.resume` 的 `allowedTools` 中使用
- [x] 确认自定义工具受 `allowedTools` 和 `disallowedTools` 过滤
- [x] 确认自定义工具信息通过系统提示词注入给 Agent
- [x] 确认 lint 和测试全部通过

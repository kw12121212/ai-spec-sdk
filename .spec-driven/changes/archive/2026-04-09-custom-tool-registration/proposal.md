# custom-tool-registration

## What

为 Bridge 添加工作区作用域的自定义工具注册功能。允许客户端通过 `tools.register` 方法注册 shell-command 类型的自定义工具，通过 `tools.unregister` 方法注销，并通过 `tools.list` 查看合并后的工具列表（内置工具 + 当前工作区的自定义工具）。自定义工具仅对注册时指定的工作区可见，不同工作区的自定义工具相互隔离。

## Why

当前 Bridge 仅支持固定的内置工具集（Bash、Read、Write 等）。实际使用场景中，用户经常需要针对特定项目定义重复使用的命令行操作（如运行特定测试脚本、构建命令、代码检查工具等）。将这些命令注册为自定义工具后：

1. Agent 可以直接调用这些工具，无需通过 Bash 工具手动输入长命令
2. 工具调用可以被权限系统管控（配合 `allowedTools`/`disallowedTools`）
3. 项目特定的知识（命令参数、工作目录等）被封装在工具定义中

在开放自定义工具注册之前，`rate-limiting` 已为 HTTP 入口添加了速率保护，这是正确的安全顺序。

## Scope

**在范围内：**
- 新增 `tools.register` 方法：注册 shell-command 类型的自定义工具
  - 参数：`workspace`（必需，工作区路径）、`name`（必需，工具名称）、`description`（必需，工具描述）、`command`（必需，要执行的 shell 命令）、`args`（可选，默认参数数组）
  - 工具名称必须以 `custom.` 为前缀（如 `custom.build`），避免与内置工具冲突
  - 同一工作区内工具名称唯一，重复注册覆盖旧定义
- 新增 `tools.unregister` 方法：注销指定工作区的自定义工具
  - 参数：`workspace`（必需）、`name`（必需）
- 修改 `tools.list` 方法：返回内置工具 + 当前工作区自定义工具的合并列表
  - 新增可选参数 `workspace`，指定时返回该工作区的工具列表；未指定时仅返回内置工具
- 自定义工具在 `session.start`/`session.resume` 的 `allowedTools`/`disallowedTools` 中可用
- 自定义工具执行时：在工作区目录下运行指定的 shell 命令，捕获 stdout/stderr 作为工具结果
- 自定义工具定义存储在进程内存中（WorkspaceStore 管理），进程重启后丢失
- 自定义工具执行受 hooks 系统管控（`pre_tool_use` 事件）

**不在范围内：**
- 自定义工具的持久化存储（跨进程/重启保留）
- 自定义工具的参数校验 schema 定义
- 除 shell-command 外的其他工具类型（如 HTTP 回调工具）
- 自定义工具的版本管理或升级机制
- 全局（跨工作区）自定义工具
- 内置工具的覆盖或修改

## Unchanged Behavior

- 不指定 `workspace` 时，`tools.list` 行为与之前一致（仅返回内置工具）
- 内置工具的名称、描述、行为完全不变
- 未使用自定义工具的会话行为不变
- `allowedTools`/`disallowedTools` 中引用内置工具的方式不变
- stdio 传输和 HTTP 传输的工具调用流程不变
- hooks 系统的 `pre_tool_use` 事件触发逻辑不变

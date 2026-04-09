# Questions: custom-tool-registration

## Open

<!-- No open questions -->

## Resolved

**Question:** 自定义工具的工作区作用域具体如何定义？是基于文件系统路径还是通过 workspace 参数显式指定？

**Resolution:** 通过 `workspace` 参数字符串显式指定，必须与 `workspace.register` 注册的工作区路径一致。复用现有 WorkspaceStore 的工作区概念。

---

**Question:** 自定义工具是否需要持久化存储，还是仅保存在内存中？

**Resolution:** 第一阶段采用内存存储（存储在 WorkspaceStore 中），进程重启后丢失。与 rate-limiting 实现保持一致，简化设计。

---

**Question:** 自定义工具与内置工具的命名空间如何处理？是否允许覆盖内置工具？

**Resolution:** 自定义工具名称必须以 `custom.` 为前缀（如 `custom.build`），不允许覆盖内置工具。这明确区分了两类工具，避免未来冲突。

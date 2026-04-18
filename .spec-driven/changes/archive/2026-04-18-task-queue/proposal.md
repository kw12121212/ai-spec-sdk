# Proposal: task-queue

## What
实现一个带有优先级和重试逻辑的任务队列（Task Queue），用于管理代理执行任务，确保可靠的异步执行和从临时故障中恢复。

## Why
任务模板（Task Templates）和 Cron 调度器（Cron Scheduler）现已完成。在实现跨会话任务依赖（Cross-session task dependencies）或团队配额（Team quotas）之前，需要一个健壮的执行队列，将调度与立即执行解耦，以防止并发任务耗尽系统资源。

## Scope
- 实现基于简单 JSON 文件的持久化任务队列存储。
- 提供任务入队（push）、出队（pop/poll）、状态查询（status）等 API。
- 支持任务优先级和重试机制。
- 修改现有的 Cron 调度器，使其将任务放入队列，而不是直接立即执行。

## Unchanged Behavior
- 任务模板的定义和版本控制方式保持不变。
- 团队注册表和权限模型保持不变。
- 直接通过 API 同步启动代理会话的现有方式（非通过调度器）保持不变。

# Tasks: task-queue

## Implementation
- [x] 创建 `src/task-queue-store.ts`，实现基于 JSON 文件持久化的任务队列存储。
- [x] 在 `src/task-queue-store.ts` 中实现按优先级出队和失败重试机制。
- [x] 修改 `src/cron-scheduler.ts`，使其在触发时将任务推入队列，而不是直接启动代理会话。
- [x] 实现队列消费工作线程（Worker），定期轮询并执行队列中的任务。

## Testing
- [x] Run lint checks using `bash scripts/check.sh`
- [x] Run unit tests using `bun test test/task-queue-store.test.ts`
- [x] Run unit tests using `bun test test/cron-scheduler.test.ts`

## Verification
- [x] 验证任务可以按优先级被正确调度。
- [x] 验证任务执行失败后可以根据配置的策略进行重试。
- [x] 验证队列配置可以在服务器重启后通过 JSON 文件恢复。

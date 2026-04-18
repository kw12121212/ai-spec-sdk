# Design: task-queue

## Approach
- **存储层**: 实现一个 `TaskQueueStore`（位于 `src/task-queue-store.ts`），利用简单的 JSON 文件进行持久化存储（参考现有的 `TaskTemplateStore`），以确保队列项在服务器重启后能够保留。
- **调度解耦**: 更新 `CronScheduler`（位于 `src/cron-scheduler.ts`），当定时任务触发时，将其以队列项的形式推入 `TaskQueueStore`，而非直接拉起代理会话。
- **执行引擎**: 引入一个后台队列工作线程（Worker），轮询或监听队列，按照优先级提取任务并执行（启动 `AgentSession`），同时处理执行失败后的重试逻辑。

## Key Decisions
- **队列持久化机制**: 为了满足即时的持久化需求，同时在 M14（持久化层重构）之前保持简单，决定采用基于 JSON 文件的存储方式。
- **Cron 集成策略**: 修改现有的 Cron 调度器，让其仅负责入队操作，将“何时运行”和“如何运行”彻底解耦。

## Alternatives Considered
- **内存存储 (In-memory store)**: 曾考虑仅使用内存队列以降低复杂度，但这样在服务重启或崩溃时会导致未处理的任务丢失，无法满足生产环境对调度执行的可靠性要求，因此被否决。
- **直接使用外部消息队列中间件**: 例如 Redis 或 RabbitMQ。考虑到当前系统作为一个可通过 CLI 独立运行的 SDK 和代理环境，强依赖外部重型中间件会增加部署成本，与当前架构定位不符，因此选择先实现轻量级的文件持久化队列。

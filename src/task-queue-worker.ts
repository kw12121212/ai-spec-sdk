import { TaskQueueStore, TaskQueueItem } from "./task-queue-store.js";
import { defaultLogger as logger } from "./logger.js";

export class TaskQueueWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private intervalMs: number;

  constructor(
    private taskQueueStore: TaskQueueStore,
    private executeTask: (item: TaskQueueItem) => Promise<void>,
  ) {
    this.intervalMs = 5000;
  }

  start(intervalMs = 5000): void {
    if (this.running) return;
    this.running = true;
    this.intervalMs = intervalMs;
    this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private loop(): void {
    if (!this.running) return;

    this.tick().finally(() => {
      if (this.running) {
        this.timer = setTimeout(() => this.loop(), this.intervalMs);
        this.timer.unref();
      }
    });
  }

  private async tick(): Promise<void> {
    const item = this.taskQueueStore.dequeue();
    if (!item) return;

    try {
      await this.executeTask(item);
      this.taskQueueStore.markCompleted(item.id);
    } catch (err: any) {
      this.taskQueueStore.markFailed(item.id, err.message ?? String(err));
    }

    if (this.running) {
      await this.tick();
    }
  }
}

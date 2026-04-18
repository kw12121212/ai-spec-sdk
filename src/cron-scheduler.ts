import { CronExpressionParser } from "cron-parser";
import { TaskTemplateStore } from "./task-template-store.js";
import { TaskQueueStore } from "./task-queue-store.js";
import { defaultLogger as logger } from "./logger.js";

export class CronScheduler {
  private timer: NodeJS.Timeout | null = null;
  private lastCheck: Date;

  constructor(
    private taskTemplateStore: TaskTemplateStore,
    private taskQueueStore: TaskQueueStore,
  ) {
    this.lastCheck = new Date();
  }

  start(intervalMs = 60000): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.lastCheck = new Date();
    this.timer = setInterval(() => this.tick(), intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  tick(): void {
    const now = new Date();
    const templates = this.taskTemplateStore.list();

    for (const template of templates) {
      if (!template.cronSchedule) continue;

      let due = false;
      try {
        const iter = CronExpressionParser.parse(template.cronSchedule, {
          currentDate: this.lastCheck,
          endDate: now,
        });

        // Loop until "Out of the time span range" is thrown
        while (true) {
          iter.next();
          due = true;
        }
      } catch (err: any) {
        if (err.message !== "Out of the time span range") {
          logger.error("error parsing cron schedule", {
            name: template.name,
            error: err.message,
          });
        }
      }

      if (due) {
        logger.info("enqueuing scheduled task template", { name: template.name });
        try {
          this.taskQueueStore.enqueue({
            templateName: template.name,
            priority: 0,
            templateSnapshot: template,
          });
        } catch (error) {
          logger.error("error enqueuing scheduled task", {
            name: template.name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    this.lastCheck = now;
  }
}

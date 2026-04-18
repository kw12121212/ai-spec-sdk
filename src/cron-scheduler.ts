import { CronExpressionParser } from "cron-parser";
import { TaskTemplateStore } from "./task-template-store.js";
import { TaskTemplate } from "./task-template-types.js";
import { defaultLogger as logger } from "./logger.js";

export class CronScheduler {
  private timer: NodeJS.Timeout | null = null;
  private lastCheck: Date;

  constructor(
    private taskTemplateStore: TaskTemplateStore,
    private onDue: (template: TaskTemplate) => void | Promise<void>,
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
        logger.info("triggering scheduled task template", { name: template.name });
        try {
          const result = this.onDue(template);
          if (result instanceof Promise) {
            result.catch((e) => {
              logger.error("error triggering scheduled task (async)", {
                name: template.name,
                error: e instanceof Error ? e.message : String(e),
              });
            });
          }
        } catch (error) {
          logger.error("error triggering scheduled task", {
            name: template.name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    this.lastCheck = now;
  }
}

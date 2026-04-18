import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { defaultLogger as logger } from "./logger.js";
import { TaskTemplate } from "./task-template-types.js";

export type TaskStatus = "pending" | "running" | "completed" | "failed";

export interface TaskQueueItem {
  id: string;
  templateName: string;
  priority: number;
  status: TaskStatus;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
  templateSnapshot?: TaskTemplate;
}

export interface EnqueueParams {
  templateName: string;
  priority?: number;
  maxRetries?: number;
  templateSnapshot?: TaskTemplate;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class TaskQueueStore {
  private items: Map<string, TaskQueueItem>;
  private queueDir: string | undefined;

  constructor(queueDir?: string) {
    this.items = new Map();
    this.queueDir = queueDir;

    if (queueDir) {
      fs.mkdirSync(queueDir, { recursive: true });
      this._loadFromDisk(queueDir);
    }
  }

  private _loadFromDisk(dir: string): void {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = fs.readFileSync(path.join(dir, file), "utf8");
        const item = JSON.parse(raw) as TaskQueueItem;
        if (item && typeof item.id === "string") {
          this.items.set(item.id, item);
        }
      } catch {
        // skip corrupt files
      }
    }
  }

  private _persist(item: TaskQueueItem): void {
    if (!this.queueDir) return;
    const tmpPath = path.join(this.queueDir, `${item.id}.json.tmp`);
    const finalPath = path.join(this.queueDir, `${item.id}.json`);
    fs.writeFileSync(tmpPath, JSON.stringify(item, null, 2), "utf8");
    fs.renameSync(tmpPath, finalPath);
  }

  enqueue(params: EnqueueParams): TaskQueueItem {
    const id = `task-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const now = nowIso();

    const item: TaskQueueItem = {
      id,
      templateName: params.templateName,
      priority: params.priority ?? 0,
      status: "pending",
      retryCount: 0,
      maxRetries: params.maxRetries ?? 3,
      createdAt: now,
      updatedAt: now,
      templateSnapshot: params.templateSnapshot,
    };

    this.items.set(id, item);
    this._persist(item);
    logger.info("task enqueued", { id, templateName: item.templateName });
    return item;
  }

  dequeue(): TaskQueueItem | null {
    let highestPriorityItem: TaskQueueItem | null = null;

    for (const item of this.items.values()) {
      if (item.status === "pending") {
        if (!highestPriorityItem || item.priority > highestPriorityItem.priority) {
          highestPriorityItem = item;
        } else if (item.priority === highestPriorityItem.priority && item.createdAt < highestPriorityItem.createdAt) {
          highestPriorityItem = item;
        }
      }
    }

    if (highestPriorityItem) {
      highestPriorityItem.status = "running";
      highestPriorityItem.updatedAt = nowIso();
      this._persist(highestPriorityItem);
      return highestPriorityItem;
    }

    return null;
  }

  markCompleted(id: string): void {
    const item = this.items.get(id);
    if (!item) return;

    item.status = "completed";
    item.updatedAt = nowIso();
    this._persist(item);
    logger.info("task completed", { id });
  }

  markFailed(id: string, errorMsg?: string): void {
    const item = this.items.get(id);
    if (!item) return;

    if (item.retryCount < item.maxRetries) {
      item.retryCount++;
      item.status = "pending";
      item.error = errorMsg;
      item.updatedAt = nowIso();
      logger.info("task failed, scheduling retry", { id, retryCount: item.retryCount });
    } else {
      item.status = "failed";
      item.error = errorMsg;
      item.updatedAt = nowIso();
      logger.error("task failed max retries", { id, errorMsg });
    }
    this._persist(item);
  }

  get(id: string): TaskQueueItem | null {
    return this.items.get(id) ?? null;
  }

  list(): TaskQueueItem[] {
    return Array.from(this.items.values());
  }
}

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { defaultLogger as logger } from "./logger.js";
import { TaskTemplate } from "./task-template-types.js";

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "blocked";

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
  dependsOn?: string[];
}

export interface EnqueueParams {
  id?: string;
  templateName: string;
  priority?: number;
  maxRetries?: number;
  templateSnapshot?: TaskTemplate;
  dependsOn?: string[];
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

  private _checkCircularDependency(newTaskId: string, dependsOn: string[]): void {
    const visited = new Set<string>();
    const stack = [...dependsOn];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === newTaskId) {
        throw new Error("Circular dependency detected");
      }
      if (!visited.has(current)) {
        visited.add(current);
        const task = this.items.get(current);
        if (task && task.dependsOn) {
          stack.push(...task.dependsOn);
        }
      }
    }
  }

  private _failDependents(failedTaskId: string): void {
    for (const item of this.items.values()) {
      if (item.status === "blocked" && item.dependsOn?.includes(failedTaskId)) {
        item.status = "failed";
        item.error = `Parent task ${failedTaskId} failed`;
        item.updatedAt = nowIso();
        this._persist(item);
        logger.error("task failed due to parent failure", { id: item.id, parentId: failedTaskId });
        this._failDependents(item.id);
      }
    }
  }

  private _unblockDependents(completedTaskId: string): void {
    for (const item of this.items.values()) {
      if (item.status === "blocked" && item.dependsOn?.includes(completedTaskId)) {
        let allCompleted = true;
        let anyFailed = false;
        let failedParentId = "";
        
        for (const parentId of item.dependsOn) {
          const parent = this.items.get(parentId);
          if (!parent) {
            allCompleted = false;
          } else if (parent.status === "failed") {
            anyFailed = true;
            failedParentId = parentId;
            break;
          } else if (parent.status !== "completed") {
            allCompleted = false;
          }
        }
        
        if (anyFailed) {
           item.status = "failed";
           item.error = `Parent task ${failedParentId} failed`;
           item.updatedAt = nowIso();
           this._persist(item);
           this._failDependents(item.id);
        } else if (allCompleted) {
          item.status = "pending";
          item.updatedAt = nowIso();
          this._persist(item);
          logger.info("task unblocked", { id: item.id });
        }
      }
    }
  }

  enqueue(params: EnqueueParams): TaskQueueItem {
    const id = params.id ?? `task-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    if (this.items.has(id)) {
      throw new Error(`Task with id ${id} already exists`);
    }
    const now = nowIso();

    let initialStatus: TaskStatus = "pending";
    let error: string | undefined;
    let isBlocked = false;

    if (params.dependsOn && params.dependsOn.length > 0) {
      this._checkCircularDependency(id, params.dependsOn);
      
      for (const parentId of params.dependsOn) {
        const parentTask = this.items.get(parentId);
        if (parentTask) {
          if (parentTask.status === "failed") {
            initialStatus = "failed";
            error = `Parent task ${parentId} failed`;
            isBlocked = false;
            break;
          } else if (parentTask.status !== "completed") {
            isBlocked = true;
          }
        } else {
          isBlocked = true;
        }
      }
      
      if (initialStatus !== "failed" && isBlocked) {
        initialStatus = "blocked";
      }
    }

    const item: TaskQueueItem = {
      id,
      templateName: params.templateName,
      priority: params.priority ?? 0,
      status: initialStatus,
      retryCount: 0,
      maxRetries: params.maxRetries ?? 3,
      createdAt: now,
      updatedAt: now,
      error,
      templateSnapshot: params.templateSnapshot,
      dependsOn: params.dependsOn,
    };

    this.items.set(id, item);
    this._persist(item);
    logger.info("task enqueued", { id, templateName: item.templateName, status: initialStatus });
    
    if (initialStatus === "failed") {
      this._failDependents(id);
    }
    
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
    
    this._unblockDependents(id);
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
      this._persist(item);
    } else {
      item.status = "failed";
      item.error = errorMsg;
      item.updatedAt = nowIso();
      logger.error("task failed max retries", { id, errorMsg });
      this._persist(item);
      
      this._failDependents(id);
    }
  }

  get(id: string): TaskQueueItem | null {
    return this.items.get(id) ?? null;
  }

  list(): TaskQueueItem[] {
    return Array.from(this.items.values());
  }
}

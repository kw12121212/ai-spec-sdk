import { test, expect, beforeEach, afterEach, setSystemTime } from "bun:test";
import { CronScheduler } from "../src/cron-scheduler.js";
import { TaskTemplateStore } from "../src/task-template-store.js";
import { TaskQueueStore } from "../src/task-queue-store.js";
import type { TaskTemplate } from "../src/task-template-types.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

class MockTaskTemplateStore extends TaskTemplateStore {
  private templatesList: TaskTemplate[] = [];
  constructor() {
    super();
  }
  override list() {
    return this.templatesList;
  }
  setTemplates(t: TaskTemplate[]) {
    this.templatesList = t;
  }
}

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cron-test-"));
});

afterEach(() => {
  setSystemTime(); // reset system time
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("cron scheduler enqueues tasks that are due", () => {
  setSystemTime(new Date("2026-04-18T12:00:00Z"));

  const store = new MockTaskTemplateStore();
  store.setTemplates([
    { name: "task1", version: 1, createdAt: "", updatedAt: "", cronSchedule: "* * * * *" },
    { name: "task2", version: 1, createdAt: "", updatedAt: "", cronSchedule: "0 * * * *" },
  ]);

  const queueStore = new TaskQueueStore(tempDir);
  const scheduler = new CronScheduler(store, queueStore);

  // No time elapsed since creation
  scheduler.tick();
  expect(queueStore.list().length).toBe(0);

  // 1 minute elapsed
  setSystemTime(new Date("2026-04-18T12:01:00Z"));
  scheduler.tick();
  
  const queued1 = queueStore.list();
  expect(queued1.length).toBe(1);
  expect(queued1[0].templateName).toBe("task1");

  // 59 minutes elapsed (now 13:00:00)
  setSystemTime(new Date("2026-04-18T13:00:00Z"));
  scheduler.tick();
  
  const queued2 = queueStore.list();
  // task1 triggered again, task2 triggered once. Total items = 3.
  expect(queued2.length).toBe(3);
  const names = queued2.map(q => q.templateName);
  expect(names.filter(n => n === "task1").length).toBe(2);
  expect(names.filter(n => n === "task2").length).toBe(1);
});

test("cron scheduler handles invalid cron safely", () => {
  setSystemTime(new Date("2026-04-18T12:00:00Z"));

  const store = new MockTaskTemplateStore();
  store.setTemplates([
    { name: "task1", version: 1, createdAt: "", updatedAt: "", cronSchedule: "invalid cron" },
  ]);

  const queueStore = new TaskQueueStore(tempDir);
  const scheduler = new CronScheduler(store, queueStore);

  setSystemTime(new Date("2026-04-18T12:01:00Z"));
  scheduler.tick();
  
  expect(queueStore.list().length).toBe(0);
});

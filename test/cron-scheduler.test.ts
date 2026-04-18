import { test, expect, beforeEach, afterEach, setSystemTime } from "bun:test";
import { CronScheduler } from "../src/cron-scheduler.js";
import { TaskTemplateStore } from "../src/task-template-store.js";
import type { TaskTemplate } from "../src/task-template-types.js";

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

afterEach(() => {
  setSystemTime(); // reset system time
});

test("cron scheduler triggers tasks that are due", () => {
  setSystemTime(new Date("2026-04-18T12:00:00Z"));

  const store = new MockTaskTemplateStore();
  store.setTemplates([
    { name: "task1", version: 1, createdAt: "", updatedAt: "", cronSchedule: "* * * * *" },
    { name: "task2", version: 1, createdAt: "", updatedAt: "", cronSchedule: "0 * * * *" },
  ]);

  const triggered: string[] = [];
  const scheduler = new CronScheduler(store, (t) => triggered.push(t.name));

  // No time elapsed since creation
  scheduler.tick();
  expect(triggered).toEqual([]);

  // 1 minute elapsed
  setSystemTime(new Date("2026-04-18T12:01:00Z"));
  scheduler.tick();
  expect(triggered).toEqual(["task1"]);

  // Reset triggered
  triggered.length = 0;

  // 59 minutes elapsed (now 13:00:00)
  setSystemTime(new Date("2026-04-18T13:00:00Z"));
  scheduler.tick();
  // Both tasks should be triggered once.
  expect(triggered.includes("task1")).toBe(true);
  expect(triggered.includes("task2")).toBe(true);
});

test("cron scheduler handles invalid cron safely", () => {
  setSystemTime(new Date("2026-04-18T12:00:00Z"));

  const store = new MockTaskTemplateStore();
  store.setTemplates([
    { name: "task1", version: 1, createdAt: "", updatedAt: "", cronSchedule: "invalid cron" },
  ]);

  const triggered: string[] = [];
  const scheduler = new CronScheduler(store, (t) => triggered.push(t.name));

  setSystemTime(new Date("2026-04-18T12:01:00Z"));
  scheduler.tick();
  
  expect(triggered).toEqual([]);
});

test("cron scheduler handles async onDue errors gracefully", async () => {
  setSystemTime(new Date("2026-04-18T12:00:00Z"));

  const store = new MockTaskTemplateStore();
  store.setTemplates([
    { name: "task1", version: 1, createdAt: "", updatedAt: "", cronSchedule: "* * * * *" },
  ]);

  let called = false;
  const scheduler = new CronScheduler(store, async () => {
    called = true;
    throw new Error("async error");
  });

  setSystemTime(new Date("2026-04-18T12:01:00Z"));
  // Tick should not throw
  expect(() => scheduler.tick()).not.toThrow();
  // Wait a tick for async rejection
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(called).toBe(true);
});

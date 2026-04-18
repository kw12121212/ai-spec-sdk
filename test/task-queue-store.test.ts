import { test, expect, beforeEach, afterEach, setSystemTime } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { TaskQueueStore } from "../src/task-queue-store.js";

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "task-queue-test-"));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("enqueue adds a task and persists it", () => {
  const store = new TaskQueueStore(tempDir);
  const task = store.enqueue({ templateName: "test-task", priority: 5 });

  expect(task.id).toBeDefined();
  expect(task.status).toBe("pending");
  expect(task.priority).toBe(5);

  const files = fs.readdirSync(tempDir);
  expect(files.length).toBe(1);
  expect(files[0]).toBe(`${task.id}.json`);
});

test("dequeue returns the highest priority pending task", () => {
  const store = new TaskQueueStore(tempDir);
  
  store.enqueue({ templateName: "low", priority: 1 });
  store.enqueue({ templateName: "high", priority: 10 });
  store.enqueue({ templateName: "med", priority: 5 });

  const first = store.dequeue();
  expect(first?.templateName).toBe("high");
  expect(first?.status).toBe("running");

  const second = store.dequeue();
  expect(second?.templateName).toBe("med");

  const third = store.dequeue();
  expect(third?.templateName).toBe("low");

  const fourth = store.dequeue();
  expect(fourth).toBeNull();
});

test("markFailed retries if under maxRetries", () => {
  const store = new TaskQueueStore(tempDir);
  const task = store.enqueue({ templateName: "test", maxRetries: 2 });
  
  store.dequeue(); // now running
  
  store.markFailed(task.id, "first error");
  const failed1 = store.get(task.id);
  expect(failed1?.status).toBe("pending");
  expect(failed1?.retryCount).toBe(1);
  expect(failed1?.error).toBe("first error");

  store.dequeue(); // run again
  store.markFailed(task.id, "second error");
  const failed2 = store.get(task.id);
  expect(failed2?.status).toBe("pending");
  expect(failed2?.retryCount).toBe(2);

  store.dequeue(); // run again
  store.markFailed(task.id, "final error");
  const failed3 = store.get(task.id);
  expect(failed3?.status).toBe("failed");
  expect(failed3?.retryCount).toBe(2);
});

test("markCompleted sets status to completed", () => {
  const store = new TaskQueueStore(tempDir);
  const task = store.enqueue({ templateName: "test" });
  
  store.dequeue();
  store.markCompleted(task.id);
  
  const completed = store.get(task.id);
  expect(completed?.status).toBe("completed");
});

test("loads from disk on init", () => {
  const store1 = new TaskQueueStore(tempDir);
  const task = store1.enqueue({ templateName: "test-task" });

  const store2 = new TaskQueueStore(tempDir);
  const loaded = store2.get(task.id);
  
  expect(loaded?.templateName).toBe("test-task");
  expect(loaded?.status).toBe("pending");
});

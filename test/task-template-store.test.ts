import { test, expect } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { TaskTemplateStore } from "../src/task-template-store.js";

test("TaskTemplateStore with templatesDir writes template to disk on create", () => {
  const templatesDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-task-templates-"));

  try {
    const store = new TaskTemplateStore(templatesDir);
    const template = store.create({
      name: "test-task",
      description: "A test task",
      systemPrompt: "You are a helpful task assistant",
    });

    const filePath = path.join(templatesDir, "test-task.json");
    expect(fs.existsSync(filePath), "template file should exist on disk").toBeTruthy();

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
    expect(parsed["name"]).toBe("test-task");
    expect(parsed["description"]).toBe("A test task");
    expect(parsed["version"]).toBe(1);
  } finally {
    fs.rmSync(templatesDir, { recursive: true, force: true });
  }
});

test("TaskTemplateStore reloads templates from disk on construction", () => {
  const templatesDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-task-templates-reload-"));

  try {
    const store1 = new TaskTemplateStore(templatesDir);
    store1.create({
      name: "persisted-task",
      description: "persisted",
    });

    const store2 = new TaskTemplateStore(templatesDir);
    const loaded = store2.get("persisted-task");

    expect(loaded, "template should be reloaded from disk").toBeTruthy();
    expect(loaded!.name).toBe("persisted-task");
    expect(loaded!.description).toBe("persisted");
    expect(loaded!.version).toBe(1);
  } finally {
    fs.rmSync(templatesDir, { recursive: true, force: true });
  }
});

test("TaskTemplateStore update increments version and writes to disk", () => {
  const store = new TaskTemplateStore();

  const template1 = store.create({
    name: "update-test",
    description: "initial",
  });
  const createdAt = template1.createdAt;

  const template2 = store.update({
    name: "update-test",
    description: "updated",
    systemPrompt: "new prompt",
  });

  expect(template2.name).toBe("update-test");
  expect(template2.description).toBe("updated");
  expect(template2.systemPrompt).toBe("new prompt");
  expect(template2.version).toBe(2);
  expect(template2.createdAt).toBe(createdAt, "createdAt should be preserved");
  expect(template2.updatedAt >= template1.updatedAt, "updatedAt should be updated").toBeTruthy();
});

test("TaskTemplateStore get returns null for non-existent template", () => {
  const store = new TaskTemplateStore();
  const result = store.get("does-not-exist");
  expect(result).toBe(null);
});

test("TaskTemplateStore list returns all templates sorted by name", () => {
  const store = new TaskTemplateStore();

  store.create({ name: "zebra-task" });
  store.create({ name: "alpha-task" });
  store.create({ name: "beta-task" });

  const list = store.list();
  expect(list.length).toBe(3);
  expect(list[0].name).toBe("alpha-task");
  expect(list[1].name).toBe("beta-task");
  expect(list[2].name).toBe("zebra-task");
});

test("TaskTemplateStore delete removes template", () => {
  const templatesDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-task-templates-delete-"));

  try {
    const store = new TaskTemplateStore(templatesDir);
    store.create({ name: "to-delete" });

    expect(store.get("to-delete"), "template should exist before delete").toBeTruthy();

    const removed = store.delete("to-delete");
    expect(removed).toBe(true);
    expect(store.get("to-delete")).toBe(null);

    const filePath = path.join(templatesDir, "to-delete.json");
    expect(!fs.existsSync(filePath), "template file should be removed from disk").toBeTruthy();
  } finally {
    fs.rmSync(templatesDir, { recursive: true, force: true });
  }
});

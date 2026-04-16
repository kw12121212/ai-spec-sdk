import test from "node:test";
import assert from "node:assert/strict";
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
    assert.ok(fs.existsSync(filePath), "template file should exist on disk");

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
    assert.equal(parsed["name"], "test-task");
    assert.equal(parsed["description"], "A test task");
    assert.equal(parsed["version"], 1);
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

    assert.ok(loaded, "template should be reloaded from disk");
    assert.equal(loaded!.name, "persisted-task");
    assert.equal(loaded!.description, "persisted");
    assert.equal(loaded!.version, 1);
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

  assert.equal(template2.name, "update-test");
  assert.equal(template2.description, "updated");
  assert.equal(template2.systemPrompt, "new prompt");
  assert.equal(template2.version, 2);
  assert.equal(template2.createdAt, createdAt, "createdAt should be preserved");
  assert.ok(template2.updatedAt >= template1.updatedAt, "updatedAt should be updated");
});

test("TaskTemplateStore get returns null for non-existent template", () => {
  const store = new TaskTemplateStore();
  const result = store.get("does-not-exist");
  assert.equal(result, null);
});

test("TaskTemplateStore list returns all templates sorted by name", () => {
  const store = new TaskTemplateStore();

  store.create({ name: "zebra-task" });
  store.create({ name: "alpha-task" });
  store.create({ name: "beta-task" });

  const list = store.list();
  assert.equal(list.length, 3);
  assert.equal(list[0].name, "alpha-task");
  assert.equal(list[1].name, "beta-task");
  assert.equal(list[2].name, "zebra-task");
});

test("TaskTemplateStore delete removes template", () => {
  const templatesDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-task-templates-delete-"));

  try {
    const store = new TaskTemplateStore(templatesDir);
    store.create({ name: "to-delete" });

    assert.ok(store.get("to-delete"), "template should exist before delete");

    const removed = store.delete("to-delete");
    assert.equal(removed, true);
    assert.equal(store.get("to-delete"), null);

    const filePath = path.join(templatesDir, "to-delete.json");
    assert.ok(!fs.existsSync(filePath), "template file should be removed from disk");
  } finally {
    fs.rmSync(templatesDir, { recursive: true, force: true });
  }
});

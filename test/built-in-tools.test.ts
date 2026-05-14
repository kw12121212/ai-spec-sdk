import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { getBuiltInTools } from "../src/built-in-tools.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("built-in-tools", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "built-in-tools-test-"));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test("write_file and read_file", async () => {
    const tools = getBuiltInTools(tempDir);
    const writeTool = tools.find(t => t.name === "builtin_write_file")!;
    const readTool = tools.find(t => t.name === "builtin_read_file")!;
    
    expect(writeTool).toBeDefined();
    expect(readTool).toBeDefined();

    const writeResult = await writeTool.call({ path: "test.txt", content: "hello world" });
    expect(writeResult.isError).toBeUndefined();

    const readResult = await readTool.call({ path: "test.txt" });
    expect(readResult.content[0].text).toBe("hello world");
  });

  test("replace text in file", async () => {
    const tools = getBuiltInTools(tempDir);
    const writeTool = tools.find(t => t.name === "builtin_write_file")!;
    const replaceTool = tools.find(t => t.name === "builtin_replace")!;
    const readTool = tools.find(t => t.name === "builtin_read_file")!;

    await writeTool.call({ path: "test2.txt", content: "old text here" });
    
    const replaceResult = await replaceTool.call({ path: "test2.txt", oldText: "old text", newText: "new text" });
    expect(replaceResult.isError).toBeUndefined();

    const readResult = await readTool.call({ path: "test2.txt" });
    expect(readResult.content[0].text).toBe("new text here");
  });

  test("list directory", async () => {
    const tools = getBuiltInTools(tempDir);
    const listTool = tools.find(t => t.name === "builtin_list_directory")!;

    const result = await listTool.call({ path: "." });
    expect(result.content[0].text).toContain("test.txt");
    expect(result.content[0].text).toContain("test2.txt");
  });

  test("run shell command", async () => {
    const tools = getBuiltInTools(tempDir);
    const shellTool = tools.find(t => t.name === "builtin_run_shell_command")!;

    const result = await shellTool.call({ command: "echo hello", cwd: "." });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("hello");
  });
});

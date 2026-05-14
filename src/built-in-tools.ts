import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export function getBuiltInTools(workspaceRoot: string) {
  return [
    {
      name: "builtin_read_file",
      description: "Read file contents",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file to read, relative to workspace root" },
        },
        required: ["path"],
      },
      call: async (input: any) => {
        const p = path.resolve(workspaceRoot, input.path);
        if (!p.startsWith(workspaceRoot)) throw new Error("Path outside workspace");
        try {
          const content = await fs.readFile(p, "utf-8");
          return { content: [{ type: "text", text: content }] };
        } catch (err: any) {
          return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
      },
    },
    {
      name: "builtin_write_file",
      description: "Write content to a file. Overwrites if exists, creates if not.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file to write, relative to workspace root" },
          content: { type: "string", description: "The content to write" },
        },
        required: ["path", "content"],
      },
      call: async (input: any) => {
        const p = path.resolve(workspaceRoot, input.path);
        if (!p.startsWith(workspaceRoot)) throw new Error("Path outside workspace");
        await fs.mkdir(path.dirname(p), { recursive: true });
        await fs.writeFile(p, input.content, "utf-8");
        return { content: [{ type: "text", text: `Successfully wrote to ${input.path}` }] };
      },
    },
    {
      name: "builtin_replace",
      description: "Replace exact string matches in a file",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file to modify, relative to workspace root" },
          oldText: { type: "string", description: "The exact literal text to replace" },
          newText: { type: "string", description: "The new text to insert" },
        },
        required: ["path", "oldText", "newText"],
      },
      call: async (input: any) => {
        const p = path.resolve(workspaceRoot, input.path);
        if (!p.startsWith(workspaceRoot)) throw new Error("Path outside workspace");
        try {
          let content = await fs.readFile(p, "utf-8");
          if (!content.includes(input.oldText)) {
            return { content: [{ type: "text", text: "Error: oldText not found in file" }], isError: true };
          }
          content = content.replace(input.oldText, input.newText);
          await fs.writeFile(p, content, "utf-8");
          return { content: [{ type: "text", text: `Successfully replaced text in ${input.path}` }] };
        } catch (err: any) {
          return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
      },
    },
    {
      name: "builtin_list_directory",
      description: "List files in a directory",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the directory, relative to workspace root" },
        },
        required: ["path"],
      },
      call: async (input: any) => {
        const p = path.resolve(workspaceRoot, input.path || ".");
        if (!p.startsWith(workspaceRoot)) throw new Error("Path outside workspace");
        try {
          const files = await fs.readdir(p);
          return { content: [{ type: "text", text: files.join("\n") }] };
        } catch (err: any) {
          return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
      },
    },
    {
      name: "builtin_run_shell_command",
      description: "Run a shell command",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string", description: "The bash command to run" },
          cwd: { type: "string", description: "Optional working directory relative to workspace root" },
        },
        required: ["command"],
      },
      call: async (input: any) => {
        const p = path.resolve(workspaceRoot, input.cwd || ".");
        if (!p.startsWith(workspaceRoot)) throw new Error("Path outside workspace");
        try {
          const { stdout, stderr } = await execAsync(input.command, { cwd: p });
          return { content: [{ type: "text", text: `stdout:\n${stdout}\nstderr:\n${stderr}` }] };
        } catch (err: any) {
          return { content: [{ type: "text", text: `Error: ${err.message}\nstdout:\n${err.stdout}\nstderr:\n${err.stderr}` }], isError: true };
        }
      },
    },
  ];
}

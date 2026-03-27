import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

export interface ContextFile {
  scope: "project" | "user";
  path: string;
  size: number;
  modifiedAt: string;
}

export class ContextStore {
  /**
   * Resolve and validate a path against allowed base directories.
   * Project scope: CLAUDE.md at any depth, .claude/** under workspace.
   * User scope: anything under ~/.claude/**.
   */
  private _resolvePath(
    scope: "project" | "user",
    relativePath: string,
    workspace?: string,
  ): string {
    if (scope === "user") {
      const base = path.join(os.homedir(), ".claude");
      const resolved = path.resolve(base, relativePath);
      if (!resolved.startsWith(base + path.sep) && resolved !== base) {
        throw new Error(`Path '${relativePath}' is outside the allowed user context directory`);
      }
      return resolved;
    }

    // Project scope
    if (!workspace) {
      throw new Error("'workspace' is required for project scope");
    }

    const absWorkspace = path.resolve(workspace);
    const resolved = path.resolve(absWorkspace, relativePath);

    // Must be under workspace
    if (!resolved.startsWith(absWorkspace + path.sep) && resolved !== absWorkspace) {
      throw new Error(`Path '${relativePath}' is outside the allowed project context directory`);
    }

    // Must be CLAUDE.md at any depth, or under .claude/
    const relative = path.relative(absWorkspace, resolved);
    const parts = relative.split(path.sep);

    const isClaudeMd = parts[parts.length - 1] === "CLAUDE.md";
    const isUnderDotClaude = parts[0] === ".claude";

    if (!isClaudeMd && !isUnderDotClaude) {
      throw new Error(
        `Path '${relativePath}' is not an allowed context path. Allowed: CLAUDE.md at any depth, or files under .claude/`,
      );
    }

    return resolved;
  }

  read(
    scope: "project" | "user",
    relativePath: string,
    workspace?: string,
  ): { scope: string; path: string; content: string } {
    const absPath = this._resolvePath(scope, relativePath, workspace);

    if (!fs.existsSync(absPath)) {
      throw Object.assign(new Error("File not found"), { code: -32001 });
    }

    const content = fs.readFileSync(absPath, "utf8");
    return { scope, path: relativePath, content };
  }

  write(
    scope: "project" | "user",
    relativePath: string,
    content: string,
    workspace?: string,
  ): { scope: string; path: string; written: true } {
    const absPath = this._resolvePath(scope, relativePath, workspace);

    // Create parent directories
    const dir = path.dirname(absPath);
    fs.mkdirSync(dir, { recursive: true });

    // Atomic write with unique temp file to avoid collisions
    const tmpPath = absPath + `.tmp-${crypto.randomUUID()}`;
    fs.writeFileSync(tmpPath, content, "utf8");
    fs.renameSync(tmpPath, absPath);

    return { scope, path: relativePath, written: true as const };
  }

  list(workspace?: string): ContextFile[] {
    const files: ContextFile[] = [];

    // User scope
    const userBase = path.join(os.homedir(), ".claude");
    if (fs.existsSync(userBase)) {
      this._collectFiles(userBase, userBase, "user", files);
    }

    // Project scope
    if (workspace) {
      const absWorkspace = path.resolve(workspace);
      if (fs.existsSync(absWorkspace)) {
        // Collect CLAUDE.md files at any depth
        this._collectClaudeMdFiles(absWorkspace, absWorkspace, files);
        // Collect .claude/** files
        const dotClaude = path.join(absWorkspace, ".claude");
        if (fs.existsSync(dotClaude)) {
          this._collectFiles(dotClaude, absWorkspace, "project", files);
        }
      }
    }

    return files;
  }

  private _collectFiles(
    dir: string,
    base: string,
    scope: "project" | "user",
    files: ContextFile[],
  ): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this._collectFiles(fullPath, base, scope, files);
      } else if (entry.isFile()) {
        const stat = fs.statSync(fullPath);
        files.push({
          scope,
          path: path.relative(base, fullPath),
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      }
    }
  }

  private _collectClaudeMdFiles(
    dir: string,
    base: string,
    files: ContextFile[],
  ): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        this._collectClaudeMdFiles(path.join(dir, entry.name), base, files);
      } else if (entry.isFile() && entry.name === "CLAUDE.md") {
        const fullPath = path.join(dir, entry.name);
        const stat = fs.statSync(fullPath);
        files.push({
          scope: "project",
          path: path.relative(base, fullPath),
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      }
    }
  }
}

import fs from "node:fs";
import path from "node:path";

export interface WorkspaceEntry {
  path: string;
  registeredAt: string;
  lastUsedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class WorkspaceStore {
  private entries: Map<string, WorkspaceEntry>;
  private filePath: string | undefined;

  constructor(workspacesDir?: string) {
    this.entries = new Map();
    if (workspacesDir) {
      fs.mkdirSync(workspacesDir, { recursive: true });
      this.filePath = path.join(workspacesDir, "workspaces.json");
      this._loadFromDisk();
    }
  }

  private _loadFromDisk(): void {
    if (!this.filePath) return;
    try {
      const raw = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      for (const item of parsed) {
        if (
          item !== null &&
          typeof item === "object" &&
          typeof (item as WorkspaceEntry).path === "string" &&
          typeof (item as WorkspaceEntry).registeredAt === "string" &&
          typeof (item as WorkspaceEntry).lastUsedAt === "string"
        ) {
          const entry = item as WorkspaceEntry;
          this.entries.set(entry.path, entry);
        }
      }
    } catch {
      // skip missing or corrupt file
    }
  }

  private _persist(): void {
    if (!this.filePath) return;
    const list = Array.from(this.entries.values());
    const tmpPath = this.filePath + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(list), "utf8");
    fs.renameSync(tmpPath, this.filePath);
  }

  register(workspacePath: string): WorkspaceEntry {
    const now = nowIso();
    const existing = this.entries.get(workspacePath);
    const entry: WorkspaceEntry = {
      path: workspacePath,
      registeredAt: existing?.registeredAt ?? now,
      lastUsedAt: now,
    };
    this.entries.set(workspacePath, entry);

    // cap at 50 oldest-evicted entries
    if (this.entries.size > 50) {
      const sorted = Array.from(this.entries.values()).sort((a, b) =>
        a.lastUsedAt < b.lastUsedAt ? -1 : 1,
      );
      this.entries.delete(sorted[0].path);
    }

    this._persist();
    return entry;
  }

  list(): WorkspaceEntry[] {
    return Array.from(this.entries.values()).sort((a, b) =>
      a.lastUsedAt > b.lastUsedAt ? -1 : 1,
    );
  }
}

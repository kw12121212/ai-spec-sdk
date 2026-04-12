import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface AuditEntry {
  eventId: string;
  timestamp: string;
  sessionId: string;
  eventType: string;
  category: "lifecycle" | "execution" | "security" | "system";
  payload: Record<string, unknown>;
  metadata: {
    bridgeVersion: string;
    workspace?: string;
    parentSessionId?: string;
  };
}

export interface AuditQueryFilters {
  sessionId?: string;
  category?: string;
  eventType?: string;
  since?: string;
  until?: string;
  limit?: number;
}

type NotifyFn = (message: unknown) => void;

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export class AuditLog {
  private auditDir: string;
  private notify: NotifyFn;
  private bridgeVersion: string;

  constructor(auditDir: string, notify: NotifyFn = () => {}, bridgeVersion: string = "unknown") {
    this.auditDir = auditDir;
    this.notify = notify;
    this.bridgeVersion = bridgeVersion;
    fs.mkdirSync(auditDir, { recursive: true });
  }

  write(entry: AuditEntry): void {
    try {
      const filePath = path.join(this.auditDir, `${entry.sessionId}.auditl`);
      const line = JSON.stringify(entry) + "\n";
      fs.appendFileSync(filePath, line, "utf8");
    } catch {
      // directory may have been cleaned up; skip write
    }
    this.notify({
      jsonrpc: "2.0",
      method: "bridge/audit_event",
      params: entry,
    });
  }

  createEntry(
    sessionId: string,
    eventType: string,
    category: AuditEntry["category"],
    payload: Record<string, unknown>,
    options: { workspace?: string; parentSessionId?: string } = {},
  ): AuditEntry {
    return {
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      sessionId,
      eventType,
      category,
      payload,
      metadata: {
        bridgeVersion: this.bridgeVersion,
        ...options,
      },
    };
  }

  query(filters: AuditQueryFilters): { total: number; entries: AuditEntry[] } {
    const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    let allEntries: Array<{ entry: AuditEntry; filePath: string }> = [];

    if (filters.sessionId) {
      const filePath = path.join(this.auditDir, `${filters.sessionId}.auditl`);
      allEntries = this._readFileEntries(filePath).map((e) => ({ entry: e, filePath }));
    } else {
      if (!fs.existsSync(this.auditDir)) {
        return { total: 0, entries: [] };
      }
      for (const file of fs.readdirSync(this.auditDir)) {
        if (!file.endsWith(".auditl")) continue;
        const filePath = path.join(this.auditDir, file);
        const fileEntries = this._readFileEntries(filePath).map((e) => ({ entry: e, filePath }));
        allEntries = allEntries.concat(fileEntries);
      }
    }

    let filtered = allEntries;

    if (filters.category) {
      filtered = filtered.filter(({ entry }) => entry.category === filters.category);
    }

    if (filters.eventType) {
      filtered = filtered.filter(({ entry }) => entry.eventType === filters.eventType);
    }

    if (filters.since) {
      const sinceTime = new Date(filters.since).getTime();
      filtered = filtered.filter(({ entry }) => new Date(entry.timestamp).getTime() >= sinceTime);
    }

    if (filters.until) {
      const untilTime = new Date(filters.until).getTime();
      filtered = filtered.filter(({ entry }) => new Date(entry.timestamp).getTime() < untilTime);
    }

    const total = filtered.length;

    filtered.sort((a, b) =>
      new Date(b.entry.timestamp).getTime() - new Date(a.entry.timestamp).getTime(),
    );

    const entries = filtered.slice(0, limit).map(({ entry }) => entry);

    return { total, entries };
  }

  cleanup(retentionDays: number, activeSessionIds: Set<string>): number {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    let removedCount = 0;

    if (!fs.existsSync(this.auditDir)) return 0;

    for (const file of fs.readdirSync(this.auditDir)) {
      if (!file.endsWith(".auditl")) continue;

      const sessionId = file.replace(/\.auditl$/, "");
      if (activeSessionIds.has(sessionId)) continue;

      const filePath = path.join(this.auditDir, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
          removedCount++;
        }
      } catch {
        // skip files that can't be read
      }
    }

    return removedCount;
  }

  private _readFileEntries(filePath: string): AuditEntry[] {
    if (!fs.existsSync(filePath)) return [];
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      if (!raw.trim()) return [];
      return raw
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as AuditEntry);
    } catch {
      return [];
    }
  }
}

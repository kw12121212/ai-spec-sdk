import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { defaultLogger as logger } from "./logger.js";

export interface SessionHistoryEntry {
  type: string;
  at: string;
  prompt?: string;
  message?: unknown;
}

export interface Session {
  id: string;
  workspace: string;
  sdkSessionId: string | null;
  createdAt: string;
  updatedAt: string;
  status: "active" | "completed" | "stopped";
  stopRequested: boolean;
  history: SessionHistoryEntry[];
  result: unknown;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class SessionStore {
  private sessions: Map<string, Session>;
  private sessionsDir: string | undefined;

  constructor(sessionsDir?: string) {
    this.sessions = new Map();
    this.sessionsDir = sessionsDir;

    if (sessionsDir) {
      fs.mkdirSync(sessionsDir, { recursive: true });
      this._loadFromDisk(sessionsDir);
    }
  }

  private _loadFromDisk(dir: string): void {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = fs.readFileSync(path.join(dir, file), "utf8");
        const session = JSON.parse(raw) as Session;
        if (session && typeof session.id === "string" && Array.isArray(session.history)) {
          this.sessions.set(session.id, session);
        }
      } catch {
        // skip corrupt files
      }
    }
  }

  private _persist(session: Session): void {
    if (!this.sessionsDir) return;
    const tmpPath = path.join(this.sessionsDir, `${session.id}.json.tmp`);
    const finalPath = path.join(this.sessionsDir, `${session.id}.json`);
    fs.writeFileSync(tmpPath, JSON.stringify(session), "utf8");
    fs.renameSync(tmpPath, finalPath);
  }

  create(workspace: string, prompt: string): Session {
    const sessionId = crypto.randomUUID();
    const createdAt = nowIso();

    const session: Session = {
      id: sessionId,
      workspace,
      sdkSessionId: null,
      createdAt,
      updatedAt: createdAt,
      status: "active",
      stopRequested: false,
      history: [
        {
          type: "user_prompt",
          prompt,
          at: createdAt,
        },
      ],
      result: null,
    };

    this.sessions.set(sessionId, session);
    this._persist(session);
    logger.info("session created", { sessionId, workspace });
    return session;
  }

  get(sessionId: string): Session | null {
    return this.sessions.get(sessionId) ?? null;
  }

  setSdkSessionId(sessionId: string, sdkSessionId: string): Session | null {
    const session = this.get(sessionId);
    if (!session) {
      return null;
    }

    session.sdkSessionId = sdkSessionId;
    session.updatedAt = nowIso();
    this._persist(session);
    return session;
  }

  appendEvent(sessionId: string, event: Omit<SessionHistoryEntry, "at">): Session | null {
    const session = this.get(sessionId);
    if (!session) {
      return null;
    }

    const now = nowIso();
    session.history.push({ ...event, at: now });
    session.updatedAt = now;
    this._persist(session);
    return session;
  }

  complete(sessionId: string, result: unknown): Session | null {
    const session = this.get(sessionId);
    if (!session) {
      return null;
    }

    if (session.stopRequested || session.status === "stopped") {
      return session;
    }

    session.status = "completed";
    session.result = result;
    session.updatedAt = nowIso();
    this._persist(session);
    logger.info("session completed", { sessionId });
    return session;
  }

  stop(sessionId: string): Session | null {
    const session = this.get(sessionId);
    if (!session) {
      return null;
    }

    session.stopRequested = true;
    session.status = "stopped";
    session.updatedAt = nowIso();
    this._persist(session);
    logger.info("session stopped", { sessionId });
    return session;
  }

  list(filter?: "active" | "all"): Session[] {
    const all = Array.from(this.sessions.values());
    const filtered = filter === "active" ? all.filter((s) => s.status === "active") : all;
    return filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 100);
  }
}

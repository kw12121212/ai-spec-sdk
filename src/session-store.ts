import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { defaultLogger as logger } from "./logger.js";
import { AgentStateMachine, type AgentExecutionState } from "./agent-state-machine.js";
import type { AuditLog } from "./audit-log.js";

export interface SessionHistoryEntry {
  type: string;
  at: string;
  prompt?: string;
  message?: unknown;
}

export interface Session {
  id: string;
  workspace: string;
  parentSessionId?: string;
  sdkSessionId: string | null;
  createdAt: string;
  updatedAt: string;
  status: "active" | "completed" | "stopped" | "interrupted";
  executionState: AgentExecutionState;
  stopRequested: boolean;
  stream: boolean;
  history: SessionHistoryEntry[];
  result: unknown;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class SessionStore {
  private sessions: Map<string, Session>;
  private stateMachines: Map<string, AgentStateMachine>;
  private sessionsDir: string | undefined;
  private auditLog: AuditLog | undefined;

  constructor(sessionsDir?: string, auditLog?: AuditLog) {
    this.sessions = new Map();
    this.stateMachines = new Map();
    this.sessionsDir = sessionsDir;
    this.auditLog = auditLog;

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
          // Backfill executionState for sessions persisted before this feature
          if (!session.executionState) {
            session.executionState = "idle";
          }
          if (session.status === "active") {
            session.status = "interrupted";
            session.executionState = "error";
            this._persist(session);
            logger.info("session recovered as interrupted", { sessionId: session.id });
          }
          this.sessions.set(session.id, session);
          this.stateMachines.set(session.id, new AgentStateMachine(session.id, session.executionState));
          if (this.auditLog) {
            this.stateMachines.get(session.id)?.onTransition((event) => {
              this.auditLog?.write(
                this.auditLog!.createEntry(event.sessionId, "state_transition", "lifecycle", {
                  from: event.from,
                  to: event.to,
                  trigger: event.trigger,
                }),
              );
            });
          }
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

  create(
    workspace: string,
    prompt: string,
    stream: boolean = false,
    parentSessionId?: string,
  ): Session {
    const sessionId = crypto.randomUUID();
    const createdAt = nowIso();

    const session: Session = {
      id: sessionId,
      workspace,
      ...(parentSessionId !== undefined ? { parentSessionId } : {}),
      sdkSessionId: null,
      createdAt,
      updatedAt: createdAt,
      status: "active",
      executionState: "idle",
      stopRequested: false,
      stream,
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
    this.stateMachines.set(sessionId, new AgentStateMachine(sessionId));
    this._persist(session);
    logger.info("session created", { sessionId, workspace });
    if (this.auditLog) {
      this.auditLog.write(
        this.auditLog.createEntry(sessionId, "session_created", "lifecycle", { workspace }, { workspace, parentSessionId }),
      );
      this.stateMachines.get(sessionId)?.onTransition((event) => {
        this.auditLog?.write(
          this.auditLog!.createEntry(event.sessionId, "state_transition", "lifecycle", {
            from: event.from,
            to: event.to,
            trigger: event.trigger,
          }),
        );
      });
    }
    return session;
  }

  get(sessionId: string): Session | null {
    return this.sessions.get(sessionId) ?? null;
  }

  transitionExecutionState(sessionId: string, to: AgentExecutionState, trigger: string): boolean {
    const sm = this.stateMachines.get(sessionId);
    const session = this.get(sessionId);
    if (!sm || !session) {
      return false;
    }
    const ok = sm.transition(to, trigger);
    if (ok) {
      session.executionState = sm.state;
      session.updatedAt = nowIso();
      this._persist(session);
    }
    return ok;
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
    session.executionState = "completed";
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

    for (const child of this.getActiveDescendants(sessionId)) {
      child.stopRequested = true;
      child.status = "stopped";
      child.executionState = "completed";
      child.updatedAt = nowIso();
      this._persist(child);
      logger.info("session stopped", { sessionId: child.id, parentSessionId: sessionId });
    }

    session.stopRequested = true;
    session.status = "stopped";
    session.executionState = "completed";
    session.updatedAt = nowIso();
    this._persist(session);
    logger.info("session stopped", { sessionId });
    return session;
  }

  list(options: { status?: "active" | "all"; parentSessionId?: string } = {}): Session[] {
    const all = Array.from(this.sessions.values());
    const filtered = all.filter((session) => {
      if (options.status === "active" && session.status !== "active") {
        return false;
      }
      if (
        options.parentSessionId !== undefined &&
        session.parentSessionId !== options.parentSessionId
      ) {
        return false;
      }
      return true;
    });
    return filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 100);
  }

  getActiveDescendants(sessionId: string): Session[] {
    const descendants: Session[] = [];
    const queue = [sessionId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const parentId = queue.shift();
      if (!parentId || visited.has(parentId)) {
        continue;
      }
      visited.add(parentId);

      for (const session of this.sessions.values()) {
        if (session.parentSessionId !== parentId) {
          continue;
        }
        queue.push(session.id);
        if (session.status === "active") {
          descendants.push(session);
        }
      }
    }

    return descendants;
  }

  export(sessionId: string): Session | null {
    return this.get(sessionId);
  }

  delete(sessionId: string): "ok" | "active" | "not_found" {
    const session = this.sessions.get(sessionId);
    if (!session) return "not_found";
    if (session.status === "active") return "active";

    this.sessions.delete(sessionId);

    if (this.sessionsDir) {
      const filePath = path.join(this.sessionsDir, `${sessionId}.json`);
      try {
        fs.unlinkSync(filePath);
      } catch {
        // file may not exist in in-memory-only tests
      }
    }

    logger.info("session deleted", { sessionId });
    return "ok";
  }

  cleanup(olderThanDays: number = 30): number {
    const days = Math.min(olderThanDays, 365);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let removedCount = 0;

    for (const [id, session] of this.sessions) {
      if (session.status === "active") continue;
      const updatedMs = new Date(session.updatedAt).getTime();
      if (updatedMs < cutoff) {
        this.sessions.delete(id);
        if (this.sessionsDir) {
          try {
            fs.unlinkSync(path.join(this.sessionsDir, `${id}.json`));
          } catch {
            // file may not exist
          }
        }
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.info("session cleanup completed", { removedCount, olderThanDays });
    }
    return removedCount;
  }
}

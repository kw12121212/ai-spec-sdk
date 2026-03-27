import crypto from "node:crypto";

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

  constructor() {
    this.sessions = new Map();
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
    return session;
  }

  list(filter?: "active" | "all"): Session[] {
    const all = Array.from(this.sessions.values());
    const filtered = filter === "active" ? all.filter((s) => s.status === "active") : all;
    return filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 100);
  }
}

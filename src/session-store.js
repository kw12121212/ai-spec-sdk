import crypto from "node:crypto";

function nowIso() {
  return new Date().toISOString();
}

export class SessionStore {
  constructor() {
    this.sessions = new Map();
  }

  create(workspace, prompt) {
    const sessionId = crypto.randomUUID();
    const createdAt = nowIso();

    const session = {
      id: sessionId,
      workspace,
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

  get(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  appendEvent(sessionId, event) {
    const session = this.get(sessionId);
    if (!session) {
      return null;
    }

    session.history.push({ ...event, at: nowIso() });
    session.updatedAt = nowIso();
    return session;
  }

  complete(sessionId, result) {
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

  requestStop(sessionId) {
    const session = this.get(sessionId);
    if (!session) {
      return null;
    }

    session.stopRequested = true;
    session.status = "stopped";
    session.updatedAt = nowIso();
    return session;
  }

  stop(sessionId) {
    const session = this.get(sessionId);
    if (!session) {
      return null;
    }

    session.stopRequested = true;
    session.status = "stopped";
    session.updatedAt = nowIso();
    return session;
  }
}

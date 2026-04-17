import { test, expect } from "bun:test";
import { AgentStateMachine, type AgentExecutionState, type StateTransitionEvent } from "../src/agent-state-machine.js";

// --- AgentStateMachine: valid transitions ---

test("AgentStateMachine starts in idle state by default", () => {
  const sm = new AgentStateMachine("test-session");
  expect(sm.state).toBe("idle");
});

test("AgentStateMachine starts in custom initial state", () => {
  const sm = new AgentStateMachine("test-session", "running");
  expect(sm.state).toBe("running");
});

test("AgentStateMachine transitions idle → running", () => {
  const sm = new AgentStateMachine("test-session");
  const ok = sm.transition("running", "query_started");
  expect(ok).toBe(true);
  expect(sm.state).toBe("running");
});

test("AgentStateMachine transitions idle → error", () => {
  const sm = new AgentStateMachine("test-session");
  const ok = sm.transition("error", "query_failed");
  expect(ok).toBe(true);
  expect(sm.state).toBe("error");
});

test("AgentStateMachine transitions running → completed", () => {
  const sm = new AgentStateMachine("test-session", "running");
  const ok = sm.transition("completed", "query_completed");
  expect(ok).toBe(true);
  expect(sm.state).toBe("completed");
});

test("AgentStateMachine transitions running → waiting_for_input", () => {
  const sm = new AgentStateMachine("test-session", "running");
  const ok = sm.transition("waiting_for_input", "tool_approval_needed");
  expect(ok).toBe(true);
  expect(sm.state).toBe("waiting_for_input");
});

test("AgentStateMachine transitions running → paused", () => {
  const sm = new AgentStateMachine("test-session", "running");
  const ok = sm.transition("paused", "pause_requested");
  expect(ok).toBe(true);
  expect(sm.state).toBe("paused");
});

test("AgentStateMachine transitions running → error", () => {
  const sm = new AgentStateMachine("test-session", "running");
  const ok = sm.transition("error", "query_error");
  expect(ok).toBe(true);
  expect(sm.state).toBe("error");
});

test("AgentStateMachine transitions waiting_for_input → running", () => {
  const sm = new AgentStateMachine("test-session", "waiting_for_input");
  const ok = sm.transition("running", "approval_received");
  expect(ok).toBe(true);
  expect(sm.state).toBe("running");
});

test("AgentStateMachine transitions waiting_for_input → error", () => {
  const sm = new AgentStateMachine("test-session", "waiting_for_input");
  const ok = sm.transition("error", "timeout");
  expect(ok).toBe(true);
  expect(sm.state).toBe("error");
});

test("AgentStateMachine transitions paused → running", () => {
  const sm = new AgentStateMachine("test-session", "paused");
  const ok = sm.transition("running", "resume_requested");
  expect(ok).toBe(true);
  expect(sm.state).toBe("running");
});

test("AgentStateMachine transitions paused → error", () => {
  const sm = new AgentStateMachine("test-session", "paused");
  const ok = sm.transition("error", "resume_failed");
  expect(ok).toBe(true);
  expect(sm.state).toBe("error");
});

test("AgentStateMachine transitions error → idle", () => {
  const sm = new AgentStateMachine("test-session", "error");
  const ok = sm.transition("idle", "reset");
  expect(ok).toBe(true);
  expect(sm.state).toBe("idle");
});

// --- AgentStateMachine: invalid transitions ---

test("AgentStateMachine rejects transition from completed", () => {
  const sm = new AgentStateMachine("test-session", "completed");
  const ok = sm.transition("running", "unexpected");
  expect(ok).toBe(false);
  expect(sm.state).toBe("completed");
});

test("AgentStateMachine rejects idle → paused", () => {
  const sm = new AgentStateMachine("test-session");
  const ok = sm.transition("paused", "invalid");
  expect(ok).toBe(false);
  expect(sm.state).toBe("idle");
});

test("AgentStateMachine rejects idle → completed", () => {
  const sm = new AgentStateMachine("test-session");
  const ok = sm.transition("completed", "invalid");
  expect(ok).toBe(false);
  expect(sm.state).toBe("idle");
});

test("AgentStateMachine rejects idle → waiting_for_input", () => {
  const sm = new AgentStateMachine("test-session");
  const ok = sm.transition("waiting_for_input", "invalid");
  expect(ok).toBe(false);
  expect(sm.state).toBe("idle");
});

test("AgentStateMachine rejects idle → idle", () => {
  const sm = new AgentStateMachine("test-session");
  const ok = sm.transition("idle", "noop");
  expect(ok).toBe(false);
  expect(sm.state).toBe("idle");
});

// --- AgentStateMachine: event emission ---

test("AgentStateMachine emits transition event", () => {
  const sm = new AgentStateMachine("test-session");
  const events: StateTransitionEvent[] = [];
  sm.onTransition((event) => events.push(event));

  sm.transition("running", "query_started");

  expect(events.length).toBe(1);
  expect(events[0].sessionId).toBe("test-session");
  expect(events[0].from).toBe("idle");
  expect(events[0].to).toBe("running");
  expect(events[0].trigger).toBe("query_started");
  expect(events[0].timestamp).toBeTruthy();
});

test("AgentStateMachine does not emit event on rejected transition", () => {
  const sm = new AgentStateMachine("test-session", "completed");
  const events: StateTransitionEvent[] = [];
  sm.onTransition((event) => events.push(event));

  sm.transition("running", "invalid");

  expect(events.length).toBe(0);
});

test("AgentStateMachine emits multiple events for chained transitions", () => {
  const sm = new AgentStateMachine("test-session");
  const events: StateTransitionEvent[] = [];
  sm.onTransition((event) => events.push(event));

  sm.transition("running", "query_started");
  sm.transition("waiting_for_input", "tool_approval_needed");
  sm.transition("running", "approval_received");
  sm.transition("completed", "query_completed");

  expect(events.length).toBe(4);
  expect(events[0].to).toBe("running");
  expect(events[1].to).toBe("waiting_for_input");
  expect(events[2].to).toBe("running");
  expect(events[3].to).toBe("completed");
});

// --- SessionStore integration: executionState on session creation ---

test("SessionStore.create sets executionState to idle", async () => {
  const { SessionStore } = await import("../src/session-store.js");
  const store = new SessionStore();
  const session = store.create("/tmp/test", "hello");
  expect(session.executionState).toBe("idle");
});

// --- SessionStore: transitionExecutionState ---

test("SessionStore.transitionExecutionState updates execution state and persists", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const os = await import("node:os");
  const { SessionStore } = await import("../src/session-store.js");

  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-sm-"));
  try {
    const store = new SessionStore(sessionsDir);
    const session = store.create("/tmp/test", "hello");

    const ok = store.transitionExecutionState(session.id, "running", "query_started");
    expect(ok).toBe(true);

    const updated = store.get(session.id);
    expect(updated!.executionState).toBe("running");

    // Verify persisted
    const filePath = path.join(sessionsDir, `${session.id}.json`);
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
    expect(parsed["executionState"]).toBe("running");
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

test("SessionStore.transitionExecutionState rejects invalid transition", async () => {
  const { SessionStore } = await import("../src/session-store.js");
  const store = new SessionStore();
  const session = store.create("/tmp/test", "hello");

  // Try idle → completed (invalid)
  const ok = store.transitionExecutionState(session.id, "completed", "invalid");
  expect(ok).toBe(false);

  const updated = store.get(session.id);
  expect(updated!.executionState).toBe("idle");
});

test("SessionStore.transitionExecutionState returns false for unknown session", async () => {
  const { SessionStore } = await import("../src/session-store.js");
  const store = new SessionStore();
  const ok = store.transitionExecutionState("nonexistent", "running", "test");
  expect(ok).toBe(false);
});

// --- SessionStore: executionState on complete/stop ---

test("SessionStore.complete sets executionState to completed", async () => {
  const { SessionStore } = await import("../src/session-store.js");
  const store = new SessionStore();
  const session = store.create("/tmp/test", "hello");
  store.complete(session.id, "done");

  const updated = store.get(session.id);
  expect(updated!.executionState).toBe("completed");
});

test("SessionStore.stop sets executionState to completed", async () => {
  const { SessionStore } = await import("../src/session-store.js");
  const store = new SessionStore();
  const session = store.create("/tmp/test", "hello");
  store.stop(session.id);

  const updated = store.get(session.id);
  expect(updated!.executionState).toBe("completed");
});

// --- SessionStore: executionState persistence and reload ---

test("SessionStore persists executionState and reloads it", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const os = await import("node:os");
  const { SessionStore } = await import("../src/session-store.js");

  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-persist-"));
  try {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws-p-"));
    const store1 = new SessionStore(sessionsDir);
    const session = store1.create(ws, "persist execution state");
    store1.transitionExecutionState(session.id, "running", "query_started");
    store1.transitionExecutionState(session.id, "paused", "pause_requested");

    // Reload
    const store2 = new SessionStore(sessionsDir);
    // Session was active (status=active) but got paused — on reload it becomes interrupted
    // However, since we paused it (executionState=paused) and never completed/stopped,
    // on reload: status becomes interrupted, executionState becomes error
    const loaded = store2.get(session.id);
    expect(loaded).toBeTruthy();
    expect(loaded!.status).toBe("interrupted");
    expect(loaded!.executionState).toBe("error");
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

test("SessionStore reloads completed session with executionState preserved", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const os = await import("node:os");
  const { SessionStore } = await import("../src/session-store.js");

  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-reload-"));
  try {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws-r-"));
    const store1 = new SessionStore(sessionsDir);
    const session = store1.create(ws, "complete this");
    store1.transitionExecutionState(session.id, "running", "query_started");
    store1.complete(session.id, "done");

    // Reload
    const store2 = new SessionStore(sessionsDir);
    const loaded = store2.get(session.id);
    expect(loaded).toBeTruthy();
    expect(loaded!.status).toBe("completed");
    expect(loaded!.executionState).toBe("completed");
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

// --- SessionStore: backfill executionState for old sessions ---

test("SessionStore backfills executionState to idle for sessions without it", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const os = await import("node:os");
  const { SessionStore } = await import("../src/session-store.js");

  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-backfill-"));
  try {
    // Write a session JSON without executionState (simulating old format)
    const sessionId = "backfill-test-id";
    const oldSession = {
      id: sessionId,
      workspace: "/tmp/test",
      sdkSessionId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "completed",
      stopRequested: false,
      stream: false,
      history: [{ type: "user_prompt", prompt: "old session", at: new Date().toISOString() }],
      result: null,
    };
    fs.writeFileSync(
      path.join(sessionsDir, `${sessionId}.json`),
      JSON.stringify(oldSession),
      "utf8",
    );

    const store = new SessionStore(sessionsDir);
    const loaded = store.get(sessionId);
    expect(loaded).toBeTruthy();
    expect(loaded!.executionState).toBe("idle");
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

// --- SessionStore: executionState for interrupted sessions ---

test("SessionStore sets executionState to error for interrupted sessions on reload", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const os = await import("node:os");
  const { SessionStore } = await import("../src/session-store.js");

  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-int-"));
  try {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-ws-i-"));
    const store1 = new SessionStore(sessionsDir);
    const session = store1.create(ws, "crash me");
    // Don't complete or stop — simulates crash

    const store2 = new SessionStore(sessionsDir);
    const loaded = store2.get(session.id);
    expect(loaded).toBeTruthy();
    expect(loaded!.status).toBe("interrupted");
    expect(loaded!.executionState).toBe("error");
  } finally {
    fs.rmSync(sessionsDir, { recursive: true, force: true });
  }
});

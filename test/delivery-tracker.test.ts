import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from "bun:test";
import { DeliveryTracker } from "../src/delivery-tracker.js";
import { SessionStore } from "../src/session-store.js";
import { WebhookManager } from "../src/webhooks.js";
import { defaultLogger } from "../src/logger.js";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

describe("DeliveryTracker", () => {
  let sessionStore: SessionStore;
  let webhookManager: WebhookManager;
  let notifyClient: ReturnType<typeof mock>;
  let tracker: DeliveryTracker;
  const tmpDir = path.join(process.cwd(), "tmp-test-sessions-tracker-" + crypto.randomUUID());

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    sessionStore = new SessionStore(tmpDir);
    webhookManager = new WebhookManager(tmpDir);
    notifyClient = mock(() => {});
    tracker = new DeliveryTracker(sessionStore, webhookManager, notifyClient);
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it("should mark as delivered immediately if no webhooks are registered", () => {
    const session = sessionStore.create("ws1", "hello");
    const questionId = "q1";
    
    tracker.trackAndDeliver(session.id, questionId, { text: "msg" });
    
    expect(notifyClient).toHaveBeenCalledWith({ text: "msg" });
    
    const sess = sessionStore.get(session.id);
    expect(sess?.deliveryAttempts?.[questionId]).toBeDefined();
    expect(sess?.deliveryAttempts?.[questionId].status).toBe("delivered");
  });

  it("should attempt webhook delivery if registered", async () => {
    const session = sessionStore.create("ws1", "hello");
    const questionId = "q1";
    
    webhookManager.subscribe("http://localhost:9999/hook");
    
    let mockNotifyAsync = mock(() => Promise.resolve());
    webhookManager.notifyAsync = mockNotifyAsync;
    
    tracker.trackAndDeliver(session.id, questionId, { text: "msg" });
    
    expect(notifyClient).toHaveBeenCalledWith({ text: "msg" });
    expect(mockNotifyAsync).toHaveBeenCalledWith({ text: "msg" });
    
    // Wait for promise resolution
    await Promise.resolve();
    await Promise.resolve();
    
    const sess = sessionStore.get(session.id);
    expect(sess?.deliveryAttempts?.[questionId]).toBeDefined();
    expect(sess?.deliveryAttempts?.[questionId].status).toBe("delivered");
    expect(sess?.deliveryAttempts?.[questionId].attemptCount).toBe(0);
  });

  it("should retry and mark failed after max attempts", async () => {
    const session = sessionStore.create("ws1", "hello");
    const questionId = "q2";
    
    webhookManager.subscribe("http://localhost:9999/hook");
    
    let mockNotifyAsync = mock(() => Promise.reject(new Error("Network failed")));
    webhookManager.notifyAsync = mockNotifyAsync;
    
    // Fast-forward timers or just rely on the fallback logic
    // Actually, testing setTimeout in Bun is tricky, let's mock global setTimeout
    const originalSetTimeout = global.setTimeout;
    let timeoutCb: any;
    global.setTimeout = ((cb: any, ms: number) => {
      timeoutCb = cb;
      return 1 as any;
    }) as any;

    tracker.trackAndDeliver(session.id, questionId, { text: "msg" });
    
    await Promise.resolve();
    await Promise.resolve();
    
    let sess = sessionStore.get(session.id);
    expect(sess?.deliveryAttempts?.[questionId].status).toBe("pending");
    expect(sess?.deliveryAttempts?.[questionId].attemptCount).toBe(1);
    
    // Fire retry 1
    timeoutCb();
    await Promise.resolve();
    await Promise.resolve();
    
    sess = sessionStore.get(session.id);
    expect(sess?.deliveryAttempts?.[questionId].status).toBe("pending");
    expect(sess?.deliveryAttempts?.[questionId].attemptCount).toBe(2);
    
    // Fire retry 2
    timeoutCb();
    await Promise.resolve();
    await Promise.resolve();
    
    sess = sessionStore.get(session.id);
    expect(sess?.deliveryAttempts?.[questionId].status).toBe("pending");
    expect(sess?.deliveryAttempts?.[questionId].attemptCount).toBe(3);
    
    // Fire retry 3 (final)
    timeoutCb();
    await Promise.resolve();
    await Promise.resolve();
    
    sess = sessionStore.get(session.id);
    expect(sess?.deliveryAttempts?.[questionId].status).toBe("failed");
    expect(sess?.deliveryAttempts?.[questionId].attemptCount).toBe(3);
    
    global.setTimeout = originalSetTimeout;
  });
});

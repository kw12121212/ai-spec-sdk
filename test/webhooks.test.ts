import { test, expect } from "bun:test";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { WebhookManager } from "../src/webhooks.js";
import { startHttpServer } from "../src/http-server.js";
import { addKey } from "../src/key-store.js";
import { generateKey } from "../src/auth.js";
import type { StoredKey } from "../src/key-store.js";

// ── helpers ───────────────────────────────────────────────────────────────────

async function rpc(
  port: number,
  body: unknown,
  overrideHeaders?: Record<string, string>,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "localhost",
        port,
        path: "/rpc",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          ...overrideHeaders,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString();
          let parsed: unknown;
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = text;
          }
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      },
    );
    req.on("error", reject);
    req.end(data);
  });
}

function queryStub() {
  return async function* () {
    yield { type: "system", subtype: "init", session_id: "stub" };
    yield { result: "done" };
  };
}

function makeTempKeysFile(): { file: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "webhook-test-keys-"));
  const file = path.join(dir, "keys.json");
  fs.writeFileSync(file, "[]", "utf8");
  return { file, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

function makeKey(
  keysFile: string,
  scopes: string[] = ["admin"],
): { token: string; key: StoredKey } {
  const { token, hash } = generateKey();
  const key: StoredKey = {
    id: crypto.randomUUID(),
    name: "test-key",
    hash,
    scopes,
    createdAt: new Date().toISOString(),
  };
  addKey(key, keysFile);
  return { token, key };
}

// ── Unit tests: subscribe/unsubscribe lifecycle ────────────────────────────────

test("WebhookManager: subscribe returns registration with id, url, secret", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "webhook-test-"));
  try {
    const mgr = new WebhookManager(dir);
    const reg = mgr.subscribe("https://example.com/hook");
    expect(typeof reg.id === "string" && reg.id.length > 0).toBeTruthy();
    expect(reg.url).toBe("https://example.com/hook");
    expect(typeof mgr.getSecret() === "string" && mgr.getSecret().length > 0).toBeTruthy();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("WebhookManager: unsubscribe removes registration", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "webhook-test-"));
  try {
    const mgr = new WebhookManager(dir);
    const reg = mgr.subscribe("https://example.com/hook");
    expect(mgr.getRegistrations().length).toBe(1);
    const removed = mgr.unsubscribe(reg.id);
    expect(removed).toBe(true);
    expect(mgr.getRegistrations().length).toBe(0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("WebhookManager: unsubscribe unknown id returns false", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "webhook-test-"));
  try {
    const mgr = new WebhookManager(dir);
    const removed = mgr.unsubscribe("nonexistent");
    expect(removed).toBe(false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── Unit tests: HMAC-SHA256 signature ─────────────────────────────────────────

test("WebhookManager: HMAC signature is verifiable", { timeout: 30000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "webhook-test-"));
  try {
    const mgr = new WebhookManager(dir);
    const secret = mgr.getSecret();

    let receivedBody = "";
    let receivedSig = "";
    let resolveDelivery: () => void;
    const deliveryPromise = new Promise<void>((r) => { resolveDelivery = r; });

    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        receivedBody = Buffer.concat(chunks).toString();
        receivedSig = req.headers["x-webhook-signature"] as string;
        res.writeHead(200);
        res.end("ok");
        resolveDelivery();
      });
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const serverPort = (server.address() as any).port;

    mgr.subscribe(`http://localhost:${serverPort}/hook`);

    mgr.notify({
      jsonrpc: "2.0",
      method: "bridge/session_event",
      params: { type: "session_started", sessionId: "test-1" },
    });

    // Wait for async delivery with a generous timeout
    await Promise.race([
      deliveryPromise,
      new Promise<void>((r) => setTimeout(r, 10000)),
    ]);

    const expectedSig = crypto.createHmac("sha256", secret).update(receivedBody).digest("hex");
    expect(receivedSig).toBe(expectedSig);

    server.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("WebhookManager: delivers session_question event when notified with session.question", { timeout: 30000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "webhook-test-"));
  try {
    const mgr = new WebhookManager(dir);
    const secret = mgr.getSecret();

    let receivedBody = "";
    let receivedSig = "";
    let resolveDelivery: () => void;
    const deliveryPromise = new Promise<void>((r) => { resolveDelivery = r; });

    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        receivedBody = Buffer.concat(chunks).toString();
        receivedSig = req.headers["x-webhook-signature"] as string;
        res.writeHead(200);
        res.end("ok");
        resolveDelivery();
      });
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const serverPort = (server.address() as any).port;

    mgr.subscribe(`http://localhost:${serverPort}/hook`);

    const payload = {
      question: "Is this correct?",
      impact: "Will determine the flow",
      recommendation: "Yes",
    };

    mgr.notify({
      jsonrpc: "2.0",
      method: "session.question",
      params: {
        sessionId: "test-1",
        questionId: "q-123",
        ...payload
      }
    });

    await Promise.race([
      deliveryPromise,
      new Promise<void>((r) => setTimeout(r, 10000)),
    ]);

    const expectedSig = crypto.createHmac("sha256", secret).update(receivedBody).digest("hex");
    expect(receivedSig).toBe(expectedSig);
    
    const parsedBody = JSON.parse(receivedBody);
    expect(parsedBody.event).toBe("session_question");
    expect(parsedBody.sessionId).toBe("test-1");
    expect(parsedBody.data.questionId).toBe("q-123");
    expect(parsedBody.data.question).toBe("Is this correct?");

    server.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── Unit tests: retry logic ───────────────────────────────────────────────────

test("WebhookManager: does not retry on success", { timeout: 30000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "webhook-test-"));
  try {
    const mgr = new WebhookManager(dir);
    let callCount = 0;
    let resolveDelivery: () => void;
    const deliveryPromise = new Promise<void>((r) => { resolveDelivery = r; });

    const server = http.createServer((req, res) => {
      callCount++;
      res.writeHead(200);
      res.end("ok");
      resolveDelivery();
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const serverPort = (server.address() as any).port;

    mgr.subscribe(`http://localhost:${serverPort}/hook`);
    mgr.notify({
      jsonrpc: "2.0",
      method: "bridge/session_event",
      params: { type: "session_completed", sessionId: "test-1" },
    });

    await Promise.race([
      deliveryPromise,
      new Promise<void>((r) => setTimeout(r, 10000)),
    ]);
    expect(callCount).toBe(1);
    server.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("WebhookManager: retries on failure up to 3 times", { timeout: 30000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "webhook-test-"));
  try {
    const mgr = new WebhookManager(dir);
    let callCount = 0;
    let resolveFirstCall: () => void;
    const firstCallPromise = new Promise<void>((r) => { resolveFirstCall = r; });

    const server = http.createServer((req, res) => {
      callCount++;
      if (callCount === 1) resolveFirstCall();
      res.writeHead(500);
      res.end("error");
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const serverPort = (server.address() as any).port;

    mgr.subscribe(`http://localhost:${serverPort}/hook`);
    mgr.notify({
      jsonrpc: "2.0",
      method: "bridge/session_event",
      params: { type: "session_completed", sessionId: "test-1" },
    });

    // Wait for the initial delivery to arrive
    await Promise.race([
      firstCallPromise,
      new Promise<void>((r) => setTimeout(r, 5000)),
    ]);
    expect(callCount >= 1, `Expected at least 1 call, got ${callCount}`).toBeTruthy();

    // Wait for first retry (1s delay) with generous buffer
    await new Promise((r) => setTimeout(r, 5000));
    const countAfterFirstRetry = callCount;
    expect(countAfterFirstRetry >= 2, `Expected at least 2 calls after first retry, got ${countAfterFirstRetry}`).toBeTruthy();
    server.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── Unit tests: persistence ───────────────────────────────────────────────────

test("WebhookManager: registrations survive restart", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "webhook-test-"));
  try {
    const mgr1 = new WebhookManager(dir);
    mgr1.subscribe("https://example.com/hook1");
    mgr1.subscribe("https://example.com/hook2");
    expect(mgr1.getRegistrations().length).toBe(2);

    // Simulate restart — secret will be different, but registrations persist
    const mgr2 = new WebhookManager(dir);
    expect(mgr2.getRegistrations().length).toBe(2);
    expect(mgr2.getRegistrations()[0].url).toBe("https://example.com/hook1");
    expect(mgr2.getRegistrations()[1].url).toBe("https://example.com/hook2");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("WebhookManager: starts with empty list when no file exists", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "webhook-test-"));
  try {
    const mgr = new WebhookManager(dir);
    expect(mgr.getRegistrations().length).toBe(0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── Unit tests: unsubscribe stops delivery ────────────────────────────────────

test("WebhookManager: unsubscribed webhook receives no delivery", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "webhook-test-"));
  try {
    const mgr = new WebhookManager(dir);
    let callCount = 0;

    const server = http.createServer((req, res) => {
      callCount++;
      res.writeHead(200);
      res.end("ok");
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const serverPort = (server.address() as any).port;

    const reg = mgr.subscribe(`http://localhost:${serverPort}/hook`);
    mgr.unsubscribe(reg.id);

    mgr.notify({
      jsonrpc: "2.0",
      method: "bridge/session_event",
      params: { type: "session_started", sessionId: "test-1" },
    });

    await new Promise((r) => setTimeout(r, 200));
    expect(callCount).toBe(0);
    server.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── HTTP integration tests: auth and scope enforcement ─────────────────────────

test("webhook.subscribe requires admin scope", async () => {
  globalThis.__AI_SPEC_SDK_QUERY__ = queryStub();
  try {
    const { file: keysFile, cleanup } = makeTempKeysFile();
    try {
      const { token } = makeKey(keysFile, ["session:read"]);
      const { shutdown, port } = await startHttpServer({ port: 0, noAuth: false, keysFile });
      try {
        const { status, body } = await rpc(
          port,
          { jsonrpc: "2.0", id: 1, method: "webhook.subscribe", params: { url: "https://example.com/hook" } },
          { Authorization: `Bearer ${token}` },
        );
        expect(status).toBe(200);
        const err = (body as any).error;
        expect(err).toBeTruthy();
        expect(err.message).toMatch(/scope/i);
      } finally {
        await shutdown();
      }
    } finally {
      cleanup();
    }
  } finally {
    delete globalThis.__AI_SPEC_SDK_QUERY__;
  }
});

test("webhook.subscribe succeeds with admin scope", async () => {
  globalThis.__AI_SPEC_SDK_QUERY__ = queryStub();
  try {
    const { file: keysFile, cleanup } = makeTempKeysFile();
    try {
      const { token } = makeKey(keysFile, ["admin"]);
      const { shutdown, port } = await startHttpServer({ port: 0, noAuth: false, keysFile });
      try {
        const { status, body } = await rpc(
          port,
          { jsonrpc: "2.0", id: 1, method: "webhook.subscribe", params: { url: "https://example.com/hook" } },
          { Authorization: `Bearer ${token}` },
        );
        expect(status).toBe(200);
        const result = (body as any).result;
        expect(result.id).toBeTruthy();
        expect(result.url).toBe("https://example.com/hook");
        expect(typeof result.secret === "string").toBeTruthy();
      } finally {
        await shutdown();
      }
    } finally {
      cleanup();
    }
  } finally {
    delete globalThis.__AI_SPEC_SDK_QUERY__;
  }
});

test("webhook.unsubscribe returns removed: true", async () => {
  globalThis.__AI_SPEC_SDK_QUERY__ = queryStub();
  try {
    const { file: keysFile, cleanup } = makeTempKeysFile();
    try {
      const { token } = makeKey(keysFile, ["admin"]);
      const { shutdown, port } = await startHttpServer({ port: 0, noAuth: false, keysFile });
      try {
        const { body: subBody } = await rpc(
          port,
          { jsonrpc: "2.0", id: 1, method: "webhook.subscribe", params: { url: "https://example.com/hook" } },
          { Authorization: `Bearer ${token}` },
        );
        const webhookId = (subBody as any).result.id;

        const { body: unsubBody } = await rpc(
          port,
          { jsonrpc: "2.0", id: 2, method: "webhook.unsubscribe", params: { id: webhookId } },
          { Authorization: `Bearer ${token}` },
        );
        expect((unsubBody as any).result.removed).toBe(true);
      } finally {
        await shutdown();
      }
    } finally {
      cleanup();
    }
  } finally {
    delete globalThis.__AI_SPEC_SDK_QUERY__;
  }
});

test("webhook.unsubscribe unknown id returns error", async () => {
  globalThis.__AI_SPEC_SDK_QUERY__ = queryStub();
  try {
    const { file: keysFile, cleanup } = makeTempKeysFile();
    try {
      const { token } = makeKey(keysFile, ["admin"]);
      const { shutdown, port } = await startHttpServer({ port: 0, noAuth: false, keysFile });
      try {
        const { body } = await rpc(
          port,
          { jsonrpc: "2.0", id: 1, method: "webhook.unsubscribe", params: { id: "nonexistent" } },
          { Authorization: `Bearer ${token}` },
        );
        const err = (body as any).error;
        expect(err).toBeTruthy();
        expect(err.code).toBe(-32011);
      } finally {
        await shutdown();
      }
    } finally {
      cleanup();
    }
  } finally {
    delete globalThis.__AI_SPEC_SDK_QUERY__;
  }
});

test("bridge.capabilities includes webhook methods", async () => {
  const { shutdown, port } = await startHttpServer({ port: 0, noAuth: true });
  try {
    const { body } = await rpc(port, { jsonrpc: "2.0", id: 1, method: "bridge.capabilities" });
    const methods = (body as any).result.methods as string[];
    expect(methods.includes("webhook.subscribe")).toBeTruthy();
    expect(methods.includes("webhook.unsubscribe")).toBeTruthy();
  } finally {
    await shutdown();
  }
});

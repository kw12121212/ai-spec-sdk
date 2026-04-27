import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface WebhookRegistration {
  id: string;
  url: string;
}

interface WebhookPayload {
  event: string;
  sessionId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

const LIFECYCLE_EVENTS = new Set([
  "session_started",
  "session_completed",
  "session_stopped",
  "session_interrupted",
  "session_question",
]);

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

export class WebhookManager {
  private registrations: WebhookRegistration[] = [];
  private secret: string;
  private filePath: string;

  constructor(sessionsDir?: string) {
    this.secret = crypto.randomBytes(32).toString("hex");
    const dir = sessionsDir ?? path.join(process.cwd(), ".ai-spec-sessions");
    this.filePath = path.join(dir, "webhooks.json");
    this.load();
  }

  private load(): void {
    try {
      const data = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        this.registrations = parsed;
      }
    } catch {
      this.registrations = [];
    }
  }

  private save(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(this.registrations, null, 2), "utf8");
  }

  subscribe(url: string): WebhookRegistration {
    const id = crypto.randomUUID();
    const reg: WebhookRegistration = { id, url };
    this.registrations.push(reg);
    this.save();
    return reg;
  }

  unsubscribe(id: string): boolean {
    const idx = this.registrations.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    this.registrations.splice(idx, 1);
    this.save();
    return true;
  }

  getRegistrations(): readonly WebhookRegistration[] {
    return this.registrations;
  }

  getSecret(): string {
    return this.secret;
  }

  notify(message: unknown): void {
    if (message === null || typeof message !== "object") return;
    const msg = message as Record<string, unknown>;
    const params = msg["params"];
    if (params === null || typeof params !== "object") return;
    const p = params as Record<string, unknown>;

    let eventType: string;
    if (msg["method"] === "session.question") {
      eventType = "session_question";
    } else {
      eventType = typeof p["type"] === "string" ? p["type"] : "";
    }
    
    if (!LIFECYCLE_EVENTS.has(eventType)) return;

    const sessionId = p["sessionId"];
    if (typeof sessionId !== "string") return;

    const payload: WebhookPayload = {
      event: eventType,
      sessionId,
      timestamp: new Date().toISOString(),
      data: p,
    };

    for (const reg of this.registrations) {
      this.deliver(reg, payload);
    }
  }

  private deliver(reg: WebhookRegistration, payload: WebhookPayload): void {
    const body = JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", this.secret).update(body).digest("hex");

    this.attemptDelivery(reg.url, body, signature, 0);
  }

  private attemptDelivery(url: string, body: string, signature: string, attempt: number): void {
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
      },
      body,
    })
      .then((res) => {
        if (!res.ok && attempt < MAX_RETRIES - 1) {
          setTimeout(() => this.attemptDelivery(url, body, signature, attempt + 1), RETRY_DELAYS_MS[attempt]);
        }
      })
      .catch(() => {
        if (attempt < MAX_RETRIES - 1) {
          setTimeout(() => this.attemptDelivery(url, body, signature, attempt + 1), RETRY_DELAYS_MS[attempt]);
        }
      });
  }
}

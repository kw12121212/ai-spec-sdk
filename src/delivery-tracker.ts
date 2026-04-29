import { SessionStore, DeliveryAttempt } from "./session-store.js";
import { WebhookManager } from "./webhooks.js";
import { defaultLogger as logger } from "./logger.js";

const MAX_RETRIES = 3;
const BACKOFF_MS = [5000, 15000, 45000];

export class DeliveryTracker {
  constructor(
    private sessionStore: SessionStore,
    private webhookManager: WebhookManager,
    private notifyClient: (msg: unknown) => void
  ) {}

  trackAndDeliver(sessionId: string, questionId: string, notification: unknown): void {
    const attempt: DeliveryAttempt = {
      questionId,
      status: "pending",
      attemptCount: 0,
      nextRetryAt: null,
      lastError: null,
    };
    this.sessionStore.updateDeliveryAttempt(sessionId, attempt);

    try {
      this.notifyClient(notification);
    } catch (err) {
      logger.error("Failed to notify local client", { error: err });
    }

    // Determine if webhooks are available.
    const hasWebhooks = this.webhookManager.getRegistrations().length > 0;
    if (!hasWebhooks) {
      this.updateStatus(sessionId, questionId, { status: "delivered" });
      return;
    }

    this.attemptDelivery(sessionId, questionId, notification, 0);
  }

  private attemptDelivery(sessionId: string, questionId: string, notification: unknown, attemptCount: number): void {
    // Notify using the webhook manager asynchronously.
    this.webhookManager.notifyAsync(notification)
      .then(() => {
        this.updateStatus(sessionId, questionId, {
          status: "delivered",
          attemptCount,
          lastError: null,
          nextRetryAt: null,
        });
      })
      .catch((err) => {
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (attemptCount < MAX_RETRIES) {
          const delay = BACKOFF_MS[attemptCount] || BACKOFF_MS[BACKOFF_MS.length - 1];
          this.updateStatus(sessionId, questionId, {
            status: "pending",
            attemptCount: attemptCount + 1,
            lastError: errorMsg,
            nextRetryAt: new Date(Date.now() + delay).toISOString(),
          });
          
          setTimeout(() => {
            this.attemptDelivery(sessionId, questionId, notification, attemptCount + 1);
          }, delay);
        } else {
          this.updateStatus(sessionId, questionId, {
            status: "failed",
            attemptCount: attemptCount, // already maxed
            lastError: errorMsg,
            nextRetryAt: null,
          });
        }
      });
  }

  private updateStatus(sessionId: string, questionId: string, updates: Partial<DeliveryAttempt>): void {
    const session = this.sessionStore.get(sessionId);
    if (!session || !session.deliveryAttempts || !session.deliveryAttempts[questionId]) {
      return;
    }
    const current = session.deliveryAttempts[questionId];
    this.sessionStore.updateDeliveryAttempt(sessionId, { ...current, ...updates });
  }
}

import type { Transport } from "./transport.js";
import type { JsonRpcNotification } from "./types.js";
import { BridgeClientError } from "./errors.js";

export interface HttpTransportOptions {
  /** Bridge HTTP URL, e.g. "http://localhost:8765". */
  url: string;
  /** Optional Bearer token for authentication. */
  token?: string;
  /** SSE session ID to subscribe to. If provided, auto-subscribes on connect. */
  sessionId?: string;
}

export class HttpTransport implements Transport {
  private nextId = 1;
  private notificationHandlers: Array<(n: JsonRpcNotification) => void> = [];
  private _isClosed = false;
  private eventSource: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30_000;

  constructor(private readonly options: HttpTransportOptions) {}

  get isClosed(): boolean {
    return this._isClosed;
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.options.token) {
      h["Authorization"] = `Bearer ${this.options.token}`;
    }
    return h;
  }

  private buildUrl(path: string): string {
    const base = this.options.url.replace(/\/+$/, "");
    return `${base}${path}`;
  }

  async request(
    method: string,
    params?: unknown,
  ): Promise<unknown> {
    if (this._isClosed) {
      throw new BridgeClientError(-32603, "Transport is closed");
    }

    const id = this.nextId++;
    const body: Record<string, unknown> = { jsonrpc: "2.0", id, method };
    if (params !== undefined && params !== null) {
      body["params"] = params;
    }

    const response = await fetch(this.buildUrl("/rpc"), {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new BridgeClientError(-32700, "Failed to parse response");
    }

    if (msg["error"]) {
      const err = msg["error"] as { code: number; message: string; data?: unknown };
      throw new BridgeClientError(err.code, err.message, err.data);
    }

    return msg["result"];
  }

  onNotification(handler: (notification: JsonRpcNotification) => void): void {
    this.notificationHandlers.push(handler);
  }

  /** Subscribe to SSE events for a given session. */
  subscribe(sessionId: string): void {
    this.closeEventSource();
    this.reconnectDelay = 1000;
    this.connectEventSource(sessionId);
  }

  private connectEventSource(sessionId: string): void {
    if (this._isClosed) return;

    const url = this.buildUrl(`/events?sessionId=${encodeURIComponent(sessionId)}`);
    const es = new EventSource(url);
    this.eventSource = es;

    const eventTypes = [
      "session_event",
      "subagent_event",
      "progress",
      "tool_approval_requested",
      "hook_triggered",
      "file_changed",
    ];

    for (const eventType of eventTypes) {
      es.addEventListener(eventType, (event) => {
        if (eventType === "session_event") {
          this.reconnectDelay = 1000; // reset on successful message
        }
        try {
          const notification = JSON.parse((event as MessageEvent).data) as JsonRpcNotification;
          for (const handler of this.notificationHandlers) {
            handler(notification);
          }
        } catch {
          // ignore parse errors
        }
      });
    }

    es.onerror = () => {
      es.close();
      this.eventSource = null;
      if (!this._isClosed) {
        this.scheduleReconnect(sessionId);
      }
    };
  }

  private scheduleReconnect(sessionId: string): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this._isClosed) {
        this.connectEventSource(sessionId);
      }
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  private closeEventSource(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  close(): void {
    this._isClosed = true;
    this.closeEventSource();
  }
}

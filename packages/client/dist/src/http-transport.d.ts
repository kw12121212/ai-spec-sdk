import type { Transport } from "./transport.js";
import type { JsonRpcNotification } from "./types.js";
export interface HttpTransportOptions {
    /** Bridge HTTP URL, e.g. "http://localhost:8765". */
    url: string;
    /** Optional Bearer token for authentication. */
    token?: string;
    /** SSE session ID to subscribe to. If provided, auto-subscribes on connect. */
    sessionId?: string;
}
export declare class HttpTransport implements Transport {
    private readonly options;
    private nextId;
    private notificationHandlers;
    private _isClosed;
    private eventSource;
    private reconnectTimer;
    private reconnectDelay;
    private readonly maxReconnectDelay;
    constructor(options: HttpTransportOptions);
    get isClosed(): boolean;
    private get headers();
    private buildUrl;
    request(method: string, params?: unknown): Promise<unknown>;
    onNotification(handler: (notification: JsonRpcNotification) => void): void;
    /** Subscribe to SSE events for a given session. */
    subscribe(sessionId: string): void;
    private connectEventSource;
    private scheduleReconnect;
    private closeEventSource;
    close(): void;
}
//# sourceMappingURL=http-transport.d.ts.map
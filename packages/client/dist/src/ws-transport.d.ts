import type { Transport } from "./transport.js";
import type { JsonRpcNotification } from "./types.js";
export interface WebSocketTransportOptions {
    /** Bridge WebSocket URL, e.g. "ws://localhost:8765/ws". */
    url: string;
    /** Optional Bearer token for authentication. */
    token?: string;
}
export declare class WebSocketTransport implements Transport {
    private readonly options;
    private nextId;
    private notificationHandlers;
    private _isClosed;
    private ws;
    private reconnectTimer;
    private reconnectDelay;
    private readonly maxReconnectDelay;
    private pendingRequests;
    private connectionPromise;
    constructor(options: WebSocketTransportOptions);
    get isClosed(): boolean;
    private connect;
    private rejectPending;
    private scheduleReconnect;
    request(method: string, params?: unknown): Promise<unknown>;
    onNotification(handler: (notification: JsonRpcNotification) => void): void;
    close(): void;
}
//# sourceMappingURL=ws-transport.d.ts.map
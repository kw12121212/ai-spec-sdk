import type { Transport } from "./transport.js";
import type { JsonRpcNotification } from "./types.js";
export interface StdioTransportOptions {
    /** Path to the bridge binary. Defaults to "ai-spec-bridge". */
    command?: string;
    /** Arguments forwarded to the bridge process. */
    args?: string[];
    /** Environment variables for the bridge process. */
    env?: Record<string, string>;
    /** Current working directory for the bridge process. */
    cwd?: string;
}
export declare class StdioTransport implements Transport {
    private readonly options;
    private process;
    private nextId;
    private pending;
    private notificationHandlers;
    private _isClosed;
    constructor(options?: StdioTransportOptions);
    get isClosed(): boolean;
    private ensureProcess;
    request(method: string, params?: unknown): Promise<unknown>;
    onNotification(handler: (notification: JsonRpcNotification) => void): void;
    close(): void;
}
//# sourceMappingURL=stdio-transport.d.ts.map
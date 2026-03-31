import type { JsonRpcNotification } from "./types.js";
export interface Transport {
    /** Send a JSON-RPC request and return the parsed response. */
    request(method: string, params?: unknown): Promise<unknown>;
    /** Subscribe to server-initiated notifications. */
    onNotification(handler: (notification: JsonRpcNotification) => void): void;
    /** Clean up resources (kill subprocess, close connections). */
    close(): void;
    /** Whether the transport has been closed. */
    readonly isClosed: boolean;
}
//# sourceMappingURL=transport.d.ts.map
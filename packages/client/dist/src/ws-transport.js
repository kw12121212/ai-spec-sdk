import { BridgeClientError } from "./errors.js";
export class WebSocketTransport {
    options;
    nextId = 1;
    notificationHandlers = [];
    _isClosed = false;
    ws = null;
    reconnectTimer = null;
    reconnectDelay = 1000;
    maxReconnectDelay = 30_000;
    pendingRequests = new Map();
    connectionPromise = null;
    constructor(options) {
        this.options = options;
        this.connect().catch(() => { });
    }
    get isClosed() {
        return this._isClosed;
    }
    connect() {
        if (this.connectionPromise)
            return this.connectionPromise;
        this.connectionPromise = new Promise((resolve, reject) => {
            try {
                const wsUrl = new URL(this.options.url);
                if (this.options.token) {
                    wsUrl.searchParams.set("token", this.options.token);
                }
                this.ws = new WebSocket(wsUrl.toString());
                this.ws.onopen = () => {
                    this.reconnectDelay = 1000;
                    resolve();
                };
                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data.toString());
                        if ("id" in data && data.id !== null && this.pendingRequests.has(data.id)) {
                            const { resolve, reject } = this.pendingRequests.get(data.id);
                            this.pendingRequests.delete(data.id);
                            if (data.error) {
                                reject(new BridgeClientError(data.error.code, data.error.message, data.error.data));
                            }
                            else {
                                resolve(data.result);
                            }
                        }
                        else if (!("id" in data) || data.id === null) {
                            for (const handler of this.notificationHandlers) {
                                handler(data);
                            }
                        }
                    }
                    catch {
                        // ignore
                    }
                };
                this.ws.onclose = () => {
                    this.ws = null;
                    this.connectionPromise = null;
                    this.rejectPending(new BridgeClientError(-32000, "WebSocket connection closed"));
                    if (!this._isClosed) {
                        this.scheduleReconnect();
                    }
                };
                this.ws.onerror = (err) => {
                    reject(err);
                };
            }
            catch (err) {
                reject(err);
            }
        });
        return this.connectionPromise;
    }
    rejectPending(error) {
        for (const { reject } of this.pendingRequests.values()) {
            reject(error);
        }
        this.pendingRequests.clear();
    }
    scheduleReconnect() {
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            if (!this._isClosed) {
                this.connect().catch(() => { });
            }
        }, this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }
    async request(method, params) {
        if (this._isClosed) {
            throw new BridgeClientError(-32603, "Transport is closed");
        }
        await this.connect();
        const id = this.nextId++;
        const body = { jsonrpc: "2.0", id, method };
        if (params !== undefined && params !== null) {
            body["params"] = params;
        }
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            try {
                this.ws.send(JSON.stringify(body));
            }
            catch (err) {
                this.pendingRequests.delete(id);
                reject(new BridgeClientError(-32603, "Failed to send request over WebSocket"));
            }
        });
    }
    onNotification(handler) {
        this.notificationHandlers.push(handler);
    }
    close() {
        this._isClosed = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.rejectPending(new BridgeClientError(-32603, "Transport closed intentionally"));
    }
}
//# sourceMappingURL=ws-transport.js.map
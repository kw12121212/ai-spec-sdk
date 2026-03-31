import { BridgeClientError } from "./errors.js";
export class HttpTransport {
    options;
    nextId = 1;
    notificationHandlers = [];
    _isClosed = false;
    eventSource = null;
    reconnectTimer = null;
    reconnectDelay = 1000;
    maxReconnectDelay = 30_000;
    constructor(options) {
        this.options = options;
    }
    get isClosed() {
        return this._isClosed;
    }
    get headers() {
        const h = { "Content-Type": "application/json" };
        if (this.options.token) {
            h["Authorization"] = `Bearer ${this.options.token}`;
        }
        return h;
    }
    buildUrl(path) {
        const base = this.options.url.replace(/\/+$/, "");
        return `${base}${path}`;
    }
    async request(method, params) {
        if (this._isClosed) {
            throw new BridgeClientError(-32603, "Transport is closed");
        }
        const id = this.nextId++;
        const body = { jsonrpc: "2.0", id, method };
        if (params !== undefined && params !== null) {
            body["params"] = params;
        }
        const response = await fetch(this.buildUrl("/rpc"), {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify(body),
        });
        const text = await response.text();
        let msg;
        try {
            msg = JSON.parse(text);
        }
        catch {
            throw new BridgeClientError(-32700, "Failed to parse response");
        }
        if (msg["error"]) {
            const err = msg["error"];
            throw new BridgeClientError(err.code, err.message, err.data);
        }
        return msg["result"];
    }
    onNotification(handler) {
        this.notificationHandlers.push(handler);
    }
    /** Subscribe to SSE events for a given session. */
    subscribe(sessionId) {
        this.closeEventSource();
        this.reconnectDelay = 1000;
        this.connectEventSource(sessionId);
    }
    connectEventSource(sessionId) {
        if (this._isClosed)
            return;
        const url = this.buildUrl(`/events?sessionId=${encodeURIComponent(sessionId)}`);
        const es = new EventSource(url);
        this.eventSource = es;
        es.addEventListener("session_event", (event) => {
            this.reconnectDelay = 1000; // reset on successful message
            try {
                const notification = JSON.parse(event.data);
                for (const handler of this.notificationHandlers) {
                    handler(notification);
                }
            }
            catch {
                // ignore parse errors
            }
        });
        es.addEventListener("progress", (event) => {
            try {
                const notification = JSON.parse(event.data);
                for (const handler of this.notificationHandlers) {
                    handler(notification);
                }
            }
            catch {
                // ignore
            }
        });
        es.addEventListener("tool_approval_requested", (event) => {
            try {
                const notification = JSON.parse(event.data);
                for (const handler of this.notificationHandlers) {
                    handler(notification);
                }
            }
            catch {
                // ignore
            }
        });
        es.addEventListener("hook_triggered", (event) => {
            try {
                const notification = JSON.parse(event.data);
                for (const handler of this.notificationHandlers) {
                    handler(notification);
                }
            }
            catch {
                // ignore
            }
        });
        es.addEventListener("file_changed", (event) => {
            try {
                const notification = JSON.parse(event.data);
                for (const handler of this.notificationHandlers) {
                    handler(notification);
                }
            }
            catch {
                // ignore
            }
        });
        es.onerror = () => {
            es.close();
            this.eventSource = null;
            if (!this._isClosed) {
                this.scheduleReconnect(sessionId);
            }
        };
    }
    scheduleReconnect(sessionId) {
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            if (!this._isClosed) {
                this.connectEventSource(sessionId);
            }
        }, this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }
    closeEventSource() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    }
    close() {
        this._isClosed = true;
        this.closeEventSource();
    }
}
//# sourceMappingURL=http-transport.js.map
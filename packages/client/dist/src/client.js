export class BridgeClient {
    transport;
    handlers = new Map();
    wildcardHandlers = new Set();
    constructor(transport) {
        this.transport = transport;
        this.transport.onNotification((n) => this.dispatchNotification(n));
    }
    dispatchNotification(notification) {
        const method = notification.method;
        for (const handler of this.wildcardHandlers) {
            try {
                handler(notification);
            }
            catch { /* swallow */ }
        }
        const specific = this.handlers.get(method);
        if (specific) {
            for (const handler of specific) {
                try {
                    handler(notification);
                }
                catch { /* swallow */ }
            }
        }
    }
    // ── Event API ────────────────────────────────────────────────────────────
    on(method, handler) {
        if (method === "*") {
            this.wildcardHandlers.add(handler);
        }
        else {
            let set = this.handlers.get(method);
            if (!set) {
                set = new Set();
                this.handlers.set(method, set);
            }
            set.add(handler);
        }
    }
    off(method, handler) {
        if (method === "*") {
            this.wildcardHandlers.delete(handler);
        }
        else {
            this.handlers.get(method)?.delete(handler);
        }
    }
    // ── Lifecycle ────────────────────────────────────────────────────────────
    close() {
        this.transport.close();
    }
    get isClosed() {
        return this.transport.isClosed;
    }
    // ── Bridge methods ───────────────────────────────────────────────────────
    async capabilities() {
        return this.transport.request("bridge.capabilities");
    }
    async ping() {
        return this.transport.request("bridge.ping");
    }
    async negotiateVersion(params) {
        return this.transport.request("bridge.negotiateVersion", params);
    }
    async info() {
        return this.transport.request("bridge.info");
    }
    async setLogLevel(params) {
        return this.transport.request("bridge.setLogLevel", params);
    }
    // ── Session methods ──────────────────────────────────────────────────────
    async sessionStart(params) {
        return this.transport.request("session.start", params);
    }
    async sessionResume(params) {
        return this.transport.request("session.resume", params);
    }
    async sessionStop(params) {
        return this.transport.request("session.stop", params);
    }
    async sessionStatus(params) {
        return this.transport.request("session.status", params);
    }
    async sessionList(params) {
        return this.transport.request("session.list", params);
    }
    async sessionHistory(params) {
        return this.transport.request("session.history", params);
    }
    async sessionEvents(params) {
        return this.transport.request("session.events", params);
    }
    async sessionExport(params) {
        return this.transport.request("session.export", params);
    }
    async sessionDelete(params) {
        return this.transport.request("session.delete", params);
    }
    async sessionCleanup(params) {
        return this.transport.request("session.cleanup", params);
    }
    async sessionApproveTool(params) {
        return this.transport.request("session.approveTool", params);
    }
    async sessionRejectTool(params) {
        return this.transport.request("session.rejectTool", params);
    }
    async sessionBranch(params) {
        return this.transport.request("session.branch", params);
    }
    async sessionSearch(params) {
        return this.transport.request("session.search", params);
    }
    // ── Workflow methods ─────────────────────────────────────────────────────
    async workflowRun(params) {
        return this.transport.request("workflow.run", params);
    }
    // ── Skills ───────────────────────────────────────────────────────────────
    async skillsList() {
        return this.transport.request("skills.list");
    }
    // ── Model / Tool / Workspace ─────────────────────────────────────────────
    async modelsList() {
        return this.transport.request("models.list");
    }
    async toolsList() {
        return this.transport.request("tools.list");
    }
    async workspaceRegister(params) {
        return this.transport.request("workspace.register", params);
    }
    async workspaceList() {
        return this.transport.request("workspace.list");
    }
    // ── MCP methods ──────────────────────────────────────────────────────────
    async mcpAdd(params) {
        return this.transport.request("mcp.add", params);
    }
    async mcpRemove(params) {
        return this.transport.request("mcp.remove", params);
    }
    async mcpStart(params) {
        return this.transport.request("mcp.start", params);
    }
    async mcpStop(params) {
        return this.transport.request("mcp.stop", params);
    }
    async mcpList(params) {
        return this.transport.request("mcp.list", params);
    }
    // ── Config methods ───────────────────────────────────────────────────────
    async configGet(params) {
        return this.transport.request("config.get", params);
    }
    async configSet(params) {
        return this.transport.request("config.set", params);
    }
    async configList(params) {
        return this.transport.request("config.list", params);
    }
    // ── Hooks methods ────────────────────────────────────────────────────────
    async hooksAdd(params) {
        return this.transport.request("hooks.add", params);
    }
    async hooksRemove(params) {
        return this.transport.request("hooks.remove", params);
    }
    async hooksList(params) {
        return this.transport.request("hooks.list", params);
    }
    // ── Context methods ──────────────────────────────────────────────────────
    async contextRead(params) {
        return this.transport.request("context.read", params);
    }
    async contextWrite(params) {
        return this.transport.request("context.write", params);
    }
    async contextList(params) {
        return this.transport.request("context.list", params);
    }
}
//# sourceMappingURL=client.js.map
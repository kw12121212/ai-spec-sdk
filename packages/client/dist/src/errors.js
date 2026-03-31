export class BridgeClientError extends Error {
    code;
    data;
    constructor(code, message, data) {
        super(message);
        this.code = code;
        this.data = data;
        this.name = "BridgeClientError";
    }
}
//# sourceMappingURL=errors.js.map
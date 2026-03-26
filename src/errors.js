export class BridgeError extends Error {
  constructor(code, message, data = undefined) {
    super(message);
    this.name = "BridgeError";
    this.code = code;
    this.data = data;
  }

  toJsonRpcError() {
    const error = {
      code: this.code,
      message: this.message,
    };

    if (this.data !== undefined) {
      error.data = this.data;
    }

    return error;
  }
}

export function isJsonRpcRequest(input) {
  return (
    input &&
    typeof input === "object" &&
    input.jsonrpc === "2.0" &&
    typeof input.method === "string"
  );
}

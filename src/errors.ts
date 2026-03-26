export class BridgeError extends Error {
  code: number;
  data: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = "BridgeError";
    this.code = code;
    this.data = data;
  }

  toJsonRpcError(): { code: number; message: string; data?: unknown } {
    const error: { code: number; message: string; data?: unknown } = {
      code: this.code,
      message: this.message,
    };

    if (this.data !== undefined) {
      error.data = this.data;
    }

    return error;
  }
}

export function isJsonRpcRequest(input: unknown): boolean {
  return (
    input !== null &&
    typeof input === "object" &&
    (input as Record<string, unknown>)["jsonrpc"] === "2.0" &&
    typeof (input as Record<string, unknown>)["method"] === "string"
  );
}

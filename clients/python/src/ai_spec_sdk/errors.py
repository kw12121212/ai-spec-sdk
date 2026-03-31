"""Custom exception classes for the ai-spec-sdk Python client."""


class BridgeClientError(Exception):
    """Base exception for all ai-spec-sdk client errors."""


class TransportError(BridgeClientError):
    """Error raised when a transport-level failure occurs."""


class UnsupportedInStdioError(BridgeClientError):
    """Raised when a bridge-only method is called in stdio transport mode."""

    def __init__(self, method: str) -> None:
        self.method = method
        super().__init__(
            f"Method '{method}' is not available in stdio mode. "
            "Use HTTP transport (transport='http') for full bridge functionality."
        )


class JsonRpcError(BridgeClientError):
    """Error raised when the bridge returns a JSON-RPC error response."""

    def __init__(self, code: int, message: str, data: object = None) -> None:
        self.code = code
        self.data = data
        super().__init__(f"JSON-RPC error {code}: {message}")

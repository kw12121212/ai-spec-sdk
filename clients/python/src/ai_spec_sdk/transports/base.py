"""Abstract transport base class."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Callable


class Transport(ABC):
    """Abstract transport interface for BridgeClient."""

    @abstractmethod
    async def connect(self) -> None:
        """Establish the transport connection."""

    @abstractmethod
    async def disconnect(self) -> None:
        """Close the transport connection."""

    @abstractmethod
    async def request(self, method: str, params: dict[str, Any] | None = None) -> Any:
        """Send a JSON-RPC request and return the response."""

    @abstractmethod
    def on_event(self, callback: Callable[..., Any]) -> None:
        """Register a callback for incoming events/notifications."""

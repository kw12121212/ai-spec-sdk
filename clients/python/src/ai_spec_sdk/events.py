"""Event listener registry for the ai-spec-sdk client."""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Callable


class EventEmitter:
    """Simple event emitter supporting on/off/emit with wildcard handlers."""

    def __init__(self) -> None:
        self._handlers: dict[str, set[Callable[..., Any]]] = defaultdict(set)
        self._wildcard_handlers: set[Callable[..., Any]] = set()

    def on(self, event: str, handler: Callable[..., Any]) -> None:
        """Register a handler for a specific event or '*' for all events."""
        if event == "*":
            self._wildcard_handlers.add(handler)
        else:
            self._handlers[event].add(handler)

    def off(self, event: str, handler: Callable[..., Any]) -> None:
        """Remove a previously registered handler."""
        if event == "*":
            self._wildcard_handlers.discard(handler)
        else:
            self._handlers[event].discard(handler)

    def emit(self, event: str, *args: Any, **kwargs: Any) -> None:
        """Emit an event, calling all registered handlers."""
        for handler in self._wildcard_handlers:
            try:
                handler(*args, **kwargs)
            except Exception:
                pass

        for handler in self._handlers.get(event, set()):
            try:
                handler(*args, **kwargs)
            except Exception:
                pass

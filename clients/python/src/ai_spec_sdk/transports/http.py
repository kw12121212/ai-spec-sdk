"""HTTP/SSE transport for connecting to the ai-spec-sdk bridge."""

from __future__ import annotations

import asyncio
import json
from typing import Any, Callable
from urllib.parse import urlencode

from ..errors import JsonRpcError, TransportError
from ..events import EventEmitter
from .base import Transport


class HttpTransport(Transport):
    """Transport that connects to the bridge via HTTP POST /rpc + GET /events SSE."""

    def __init__(
        self,
        host: str = "localhost",
        port: int = 8765,
        api_key: str | None = None,
    ) -> None:
        self._host = host
        self._port = port
        self._api_key = api_key
        self._emitter = EventEmitter()
        self._sse_task: asyncio.Task | None = None
        self._connected = False
        self._request_id = 0

    # ── Transport interface ──────────────────────────────────────────────

    async def connect(self) -> None:
        if self._connected:
            return
        self._connected = True

    async def disconnect(self) -> None:
        if self._sse_task is not None:
            self._sse_task.cancel()
            try:
                await self._sse_task
            except asyncio.CancelledError:
                pass
            self._sse_task = None
        self._connected = False

    async def request(self, method: str, params: dict[str, Any] | None = None) -> Any:
        if not self._connected:
            raise TransportError("Transport not connected")

        self._request_id += 1
        request_body: dict[str, Any] = {
            "jsonrpc": "2.0",
            "id": self._request_id,
            "method": method,
        }
        if params:
            request_body["params"] = params

        body_bytes = json.dumps(request_body).encode("utf-8")

        import http.client

        conn = http.client.HTTPConnection(self._host, self._port, timeout=60)
        try:
            headers: dict[str, str] = {
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
            if self._api_key:
                headers["Authorization"] = f"Bearer {self._api_key}"

            conn.request("POST", "/rpc", body=body_bytes, headers=headers)
            response = conn.getresponse()
            response_body = response.read().decode("utf-8")

            if response.status >= 400:
                raise TransportError(
                    f"HTTP {response.status}: {response_body[:200]}"
                )

            result = json.loads(response_body)

            if "error" in result:
                error = result["error"]
                raise JsonRpcError(
                    code=error.get("code", -1),
                    message=error.get("message", "Unknown error"),
                    data=error.get("data"),
                )

            return result.get("result")
        finally:
            conn.close()

    def on_event(self, callback: Callable[..., Any]) -> None:
        self._emitter.on("session_event", callback)

    # ── SSE subscription ─────────────────────────────────────────────────

    def start_sse(self, session_id: str | None = None) -> None:
        """Start the SSE event stream in a background task."""
        if self._sse_task is not None and not self._sse_task.done():
            return
        self._sse_task = asyncio.create_task(self._sse_loop(session_id))

    async def _sse_loop(self, session_id: str | None) -> None:
        """Connect to GET /events and parse SSE stream with reconnection."""
        backoff = 1.0

        while self._connected:
            try:
                await self._connect_sse(session_id)
                backoff = 1.0  # reset on successful connection
            except asyncio.CancelledError:
                return
            except Exception:
                pass

            if not self._connected:
                return

            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30.0)

    async def _connect_sse(self, session_id: str | None) -> None:
        """Open a single SSE connection and dispatch events."""
        import http.client

        path = "/events"
        if session_id:
            path = f"/events?sessionId={session_id}"

        conn = http.client.HTTPConnection(self._host, self._port, timeout=120)
        try:
            headers: dict[str, str] = {
                "Accept": "text/event-stream",
                "Cache-Control": "no-cache",
            }
            if self._api_key:
                headers["Authorization"] = f"Bearer {self._api_key}"

            conn.request("GET", path, headers=headers)
            response = conn.getresponse()

            if response.status != 200:
                raise TransportError(f"SSE connection failed: HTTP {response.status}")

            buffer = ""
            event_type = ""
            data_buffer = ""

            while self._connected:
                chunk = response.read(4096)
                if not chunk:
                    break
                buffer += chunk.decode("utf-8", errors="replace")

                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    line = line.rstrip("\r")

                    if line.startswith("event:"):
                        event_type = line[len("event:"):].strip()
                    elif line.startswith("data:"):
                        data_buffer += line[len("data:"):].strip() + "\n"
                    elif line == "":
                        if data_buffer.strip():
                            self._dispatch_sse_event(event_type, data_buffer.strip())
                        event_type = ""
                        data_buffer = ""
        finally:
            conn.close()

    def _dispatch_sse_event(self, event_type: str, data: str) -> None:
        """Parse SSE data and emit as a session_event."""
        try:
            payload = json.loads(data)
        except json.JSONDecodeError:
            return

        if isinstance(payload, dict) and payload.get("method") == "bridge/session_event":
            params = payload.get("params", {})
            self._emitter.emit("session_event", params)
        elif isinstance(payload, dict):
            self._emitter.emit("session_event", payload)

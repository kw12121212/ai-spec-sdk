"""WebSocket transport for connecting to the ai-spec-sdk bridge."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Callable

import websockets
from websockets.exceptions import ConnectionClosed

from ..errors import JsonRpcError, TransportError
from ..events import EventEmitter
from .base import Transport

logger = logging.getLogger(__name__)


class WebSocketTransport(Transport):
    """Transport that connects to the bridge via WebSocket with JSON-RPC 2.0 framing."""

    def __init__(
        self,
        url: str,
        api_key: str | None = None,
    ) -> None:
        self._url = url
        if api_key:
            sep = "&" if "?" in self._url else "?"
            self._url += f"{sep}token={api_key}"
        
        self._emitter = EventEmitter()
        self._ws: websockets.WebSocketClientProtocol | None = None
        self._connected = False
        self._request_id = 0
        self._pending_requests: dict[int, asyncio.Future[Any]] = {}
        self._receive_task: asyncio.Task | None = None
        self._reconnect_task: asyncio.Task | None = None
        self._reconnect_delay = 1.0
        self._max_reconnect_delay = 30.0

    async def connect(self) -> None:
        if self._connected:
            return
        
        try:
            self._ws = await websockets.connect(self._url)
            self._connected = True
            self._reconnect_delay = 1.0
            self._receive_task = asyncio.create_task(self._receive_loop())
        except Exception as e:
            raise TransportError(f"WebSocket connection failed: {e}")

    async def disconnect(self) -> None:
        self._connected = False
        if self._reconnect_task:
            self._reconnect_task.cancel()
            try:
                await self._reconnect_task
            except asyncio.CancelledError:
                pass
            self._reconnect_task = None
            
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
            self._receive_task = None
            
        if self._ws:
            await self._ws.close()
            self._ws = None

        self._reject_all(TransportError("Transport disconnected"))

    def _reject_all(self, error: Exception) -> None:
        for future in self._pending_requests.values():
            if not future.done():
                future.set_exception(error)
        self._pending_requests.clear()

    async def request(self, method: str, params: dict[str, Any] | None = None) -> Any:
        if not self._connected or not self._ws:
            await self.connect()

        self._request_id += 1
        req_id = self._request_id
        
        request_body: dict[str, Any] = {
            "jsonrpc": "2.0",
            "id": req_id,
            "method": method,
        }
        if params is not None:
            request_body["params"] = params

        future: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
        self._pending_requests[req_id] = future

        try:
            await self._ws.send(json.dumps(request_body))
        except Exception as e:
            self._pending_requests.pop(req_id, None)
            raise TransportError(f"Failed to send request: {e}")

        return await future

    def on_event(self, callback: Callable[..., Any]) -> None:
        self._emitter.on("session_event", callback)

    async def _receive_loop(self) -> None:
        if not self._ws:
            return
            
        try:
            async for message in self._ws:
                try:
                    payload = json.loads(message)
                except json.JSONDecodeError:
                    continue

                if "id" in payload and payload["id"] is not None:
                    req_id = payload["id"]
                    if req_id in self._pending_requests:
                        future = self._pending_requests.pop(req_id)
                        if not future.done():
                            if "error" in payload:
                                error = payload["error"]
                                future.set_exception(
                                    JsonRpcError(
                                        code=error.get("code", -1),
                                        message=error.get("message", "Unknown error"),
                                        data=error.get("data"),
                                    )
                                )
                            else:
                                future.set_result(payload.get("result"))
                else:
                    # Notification
                    if isinstance(payload, dict):
                        self._emitter.emit("session_event", payload)
        except ConnectionClosed:
            pass
        except Exception as e:
            logger.error(f"WebSocket receive error: {e}")
        finally:
            self._handle_disconnect()

    def _handle_disconnect(self) -> None:
        self._ws = None
        self._connected = False
        self._reject_all(TransportError("WebSocket connection lost"))
        if self._reconnect_task is None:
            self._reconnect_task = asyncio.create_task(self._reconnect_loop())

    async def _reconnect_loop(self) -> None:
        while not self._connected:
            await asyncio.sleep(self._reconnect_delay)
            self._reconnect_delay = min(self._reconnect_delay * 2, self._max_reconnect_delay)
            try:
                await self.connect()
            except Exception:
                pass
        self._reconnect_task = None

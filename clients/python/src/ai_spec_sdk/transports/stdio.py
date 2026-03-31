"""Stdio transport wrapping claude-agent-sdk's ClaudeSDKClient."""

from __future__ import annotations

import asyncio
import uuid
from typing import Any, Callable

from claude_agent_sdk import ClaudeAgentOptions
from claude_agent_sdk import ClaudeSDKClient  # type: ignore[import-untyped]

from ..events import EventEmitter
from ..errors import TransportError
from .base import Transport


def _map_options(
    model: str | None = None,
    allowedTools: list[str] | None = None,
    disallowedTools: list[str] | None = None,
    permissionMode: str | None = None,
    maxTurns: int | None = None,
    systemPrompt: str | None = None,
    stream: bool = False,
    **_extra: Any,
) -> ClaudeAgentOptions:
    """Map BridgeClient camelCase params to ClaudeAgentOptions fields."""
    kwargs: dict[str, Any] = {}
    if model is not None:
        kwargs["model"] = model
    if allowedTools is not None:
        kwargs["allowed_tools"] = allowedTools
    if disallowedTools is not None:
        kwargs["disallowed_tools"] = disallowedTools
    if permissionMode is not None:
        kwargs["permission_mode"] = permissionMode
    if maxTurns is not None:
        kwargs["max_turns"] = maxTurns
    if systemPrompt is not None:
        kwargs["system_prompt"] = systemPrompt
    kwargs["stream"] = stream
    return ClaudeAgentOptions(**kwargs)


def _classify_message_type(message: Any) -> str:
    """Classify a claude-agent-sdk message into a bridge messageType string."""
    msg_type = getattr(message, "type", None)

    if msg_type == "system":
        subtype = getattr(message, "subtype", None)
        if subtype == "init":
            return "system_init"
        return "other"

    if msg_type == "result":
        return "result"

    if msg_type == "assistant":
        content = getattr(message, "content", None) or []
        has_tool_use = any(
            getattr(block, "type", None) == "tool_use" for block in content
        )
        if has_tool_use:
            return "tool_use"
        has_text = any(
            getattr(block, "type", None) == "text" for block in content
        )
        if has_text:
            return "assistant_text"
        return "other"

    if msg_type == "user":
        content = getattr(message, "content", None) or []
        has_tool_result = any(
            getattr(block, "type", None) == "tool_result" for block in content
        )
        if has_tool_result:
            return "tool_result"
        return "other"

    return "other"


class StdioTransport(Transport):
    """Transport that wraps claude-agent-sdk for direct CLI communication."""

    def __init__(
        self,
        workspace: str | None = None,
        bridge_path: str | None = None,
    ) -> None:
        self._workspace = workspace
        self._bridge_path = bridge_path
        self._emitter = EventEmitter()
        self._client: ClaudeSDKClient | None = None
        self._session_id: str | None = None
        self._receive_task: asyncio.Task | None = None

    async def connect(self) -> None:
        if self._client is not None:
            return

        options = ClaudeAgentOptions()
        if self._workspace:
            options.cwd = self._workspace
        if self._bridge_path:
            options.cli_path = self._bridge_path

        self._client = ClaudeSDKClient(options=options)

    async def disconnect(self) -> None:
        if self._receive_task is not None:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
            self._receive_task = None

        if self._client is not None:
            try:
                await self._client.disconnect()
            except Exception:
                pass
            self._client = None

    async def request(self, method: str, params: dict[str, Any] | None = None) -> Any:
        if self._client is None:
            raise TransportError("Transport not connected")

        params = params or {}

        if method == "session.start":
            return await self._session_start(params)
        if method == "session.resume":
            return await self._session_resume(params)
        if method == "session.stop":
            return await self._session_stop(params)

        raise TransportError(
            f"Method '{method}' is not supported in stdio mode"
        )

    def on_event(self, callback: Callable[..., Any]) -> None:
        self._emitter.on("session_event", callback)

    # ── Session lifecycle ────────────────────────────────────────────────

    async def _session_start(self, params: dict[str, Any]) -> dict[str, Any]:
        assert self._client is not None

        options = _map_options(
            **{
                k: params[k]
                for k in (
                    "model",
                    "allowedTools",
                    "disallowedTools",
                    "permissionMode",
                    "maxTurns",
                    "systemPrompt",
                    "stream",
                )
                if k in params
            }
        )
        if self._workspace and not options.cwd:
            options.cwd = self._workspace

        prompt = params.get("prompt", "")
        await self._client.connect(prompt=prompt)

        self._session_id = str(uuid.uuid4())

        self._receive_task = asyncio.create_task(self._receive_loop())

        return {"sessionId": self._session_id, "status": "active"}

    async def _session_resume(self, params: dict[str, Any]) -> dict[str, Any]:
        assert self._client is not None

        session_id = params.get("sessionId", self._session_id)
        prompt = params.get("prompt", "")

        options = _map_options(
            **{
                k: params[k]
                for k in (
                    "model",
                    "allowedTools",
                    "disallowedTools",
                    "permissionMode",
                    "maxTurns",
                    "systemPrompt",
                    "stream",
                )
                if k in params
            }
        )

        await self._client.query(
            prompt=prompt,
            session_id=session_id or "default",
        )

        if session_id:
            self._session_id = session_id

        if self._receive_task is None or self._receive_task.done():
            self._receive_task = asyncio.create_task(self._receive_loop())

        return {"sessionId": self._session_id, "status": "active"}

    async def _session_stop(self, params: dict[str, Any]) -> dict[str, Any]:
        assert self._client is not None
        await self._client.interrupt()
        return {"sessionId": params.get("sessionId", self._session_id), "status": "stopped"}

    # ── Background receive loop ──────────────────────────────────────────

    async def _receive_loop(self) -> None:
        if self._client is None:
            return
        try:
            async for message in self._client.receive_messages():
                event = self._message_to_event(message)
                self._emitter.emit("session_event", event)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            self._emitter.emit(
                "session_event",
                {
                    "type": "session_stopped",
                    "sessionId": self._session_id,
                    "status": "error",
                    "error": str(exc),
                },
            )

    def _message_to_event(self, message: Any) -> dict[str, Any]:
        message_type = _classify_message_type(message)
        event: dict[str, Any] = {
            "type": "agent_message",
            "sessionId": self._session_id,
            "messageType": message_type,
            "message": message,
        }

        if message_type == "result":
            event["type"] = "session_completed"
            event["result"] = getattr(message, "result", None)

        return event

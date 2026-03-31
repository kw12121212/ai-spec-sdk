"""Unified BridgeClient for ai-spec-sdk — supports stdio and HTTP transports."""

from __future__ import annotations

from typing import Any, Callable, Literal

from .errors import UnsupportedInStdioError
from .events import EventEmitter
from .transports.base import Transport
from .transports.stdio import StdioTransport
from .transports.http import HttpTransport


_BRIDGE_ONLY_METHODS: set[str] = {
    "sessionStatus",
    "sessionList",
    "sessionHistory",
    "sessionSearch",
    "sessionBranch",
    "sessionExport",
    "sessionDelete",
    "sessionCleanup",
    "sessionEvents",
    "sessionApproveTool",
    "sessionRejectTool",
    "configGet",
    "configSet",
    "configList",
    "toolsList",
    "modelsList",
    "workspaceRegister",
    "workspaceList",
    "bridgeCapabilities",
    "bridgePing",
    "bridgeInfo",
    "bridgeSetLogLevel",
    "bridgeNegotiateVersion",
    "mcpAdd",
    "mcpRemove",
    "mcpStart",
    "mcpStop",
    "mcpList",
    "hooksAdd",
    "hooksRemove",
    "hooksList",
    "contextRead",
    "contextWrite",
    "contextList",
    "workflowRun",
    "skillsList",
}


class BridgeClient:
    """Unified async client for ai-spec-sdk bridge.

    Supports two transport modes:
    - ``"stdio"``: wraps ``claude-agent-sdk`` for direct CLI communication
    - ``"http"``: connects to a running bridge via HTTP/SSE

    Usage::

        async with BridgeClient(transport="stdio") as client:
            result = await client.sessionStart(
                workspace="/path/to/project",
                prompt="Fix the bug",
            )
    """

    def __init__(
        self,
        transport: Literal["stdio", "http"] = "stdio",
        *,
        # HTTP options
        host: str = "localhost",
        port: int = 8765,
        api_key: str | None = None,
        # Stdio options
        bridge_path: str | None = None,
        workspace: str | None = None,
    ) -> None:
        self._transport_type = transport
        self._emitter = EventEmitter()
        self._transport = self._create_transport(
            transport, host=host, port=port, api_key=api_key,
            bridge_path=bridge_path, workspace=workspace,
        )
        # Wire transport events to emitter once
        self._transport.on_event(lambda data: self._emitter.emit("session_event", data))

    @staticmethod
    def _create_transport(
        transport: str,
        *,
        host: str,
        port: int,
        api_key: str | None,
        bridge_path: str | None,
        workspace: str | None,
    ) -> Transport:
        if transport == "stdio":
            return StdioTransport(workspace=workspace, bridge_path=bridge_path)
        if transport == "http":
            return HttpTransport(host=host, port=port, api_key=api_key)
        raise ValueError(f"Unknown transport: {transport!r}")

    # ── Context manager ──────────────────────────────────────────────────

    async def __aenter__(self) -> BridgeClient:
        await self._transport.connect()
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self._transport.disconnect()

    # ── Event API ────────────────────────────────────────────────────────

    def on(self, event: str, callback: Callable[..., Any]) -> None:
        """Register a handler for session events.

        Use ``event="session_event"`` to receive bridge session notifications.
        """
        self._emitter.on(event, callback)

    def off(self, event: str, callback: Callable[..., Any]) -> None:
        """Remove a previously registered event handler."""
        self._emitter.off(event, callback)

    # ── Helpers ──────────────────────────────────────────────────────────

    def _require_http(self, method: str) -> None:
        if self._transport_type == "stdio":
            raise UnsupportedInStdioError(method)

    async def _rpc(self, method: str, params: dict[str, Any] | None = None) -> Any:
        return await self._transport.request(method, params)

    # ── Session methods (both transports) ────────────────────────────────

    async def sessionStart(self, **params: Any) -> Any:
        return await self._rpc("session.start", params)

    async def sessionResume(self, **params: Any) -> Any:
        return await self._rpc("session.resume", params)

    async def sessionStop(self, sessionId: str) -> Any:
        return await self._rpc("session.stop", {"sessionId": sessionId})

    # ── Bridge-only session methods ──────────────────────────────────────

    async def sessionStatus(self, **params: Any) -> Any:
        self._require_http("sessionStatus")
        return await self._rpc("session.status", params)

    async def sessionList(self, **params: Any) -> Any:
        self._require_http("sessionList")
        return await self._rpc("session.list", params)

    async def sessionHistory(self, **params: Any) -> Any:
        self._require_http("sessionHistory")
        return await self._rpc("session.history", params)

    async def sessionSearch(self, **params: Any) -> Any:
        self._require_http("sessionSearch")
        return await self._rpc("session.search", params)

    async def sessionBranch(self, **params: Any) -> Any:
        self._require_http("sessionBranch")
        return await self._rpc("session.branch", params)

    async def sessionExport(self, **params: Any) -> Any:
        self._require_http("sessionExport")
        return await self._rpc("session.export", params)

    async def sessionDelete(self, **params: Any) -> Any:
        self._require_http("sessionDelete")
        return await self._rpc("session.delete", params)

    async def sessionCleanup(self, **params: Any) -> Any:
        self._require_http("sessionCleanup")
        return await self._rpc("session.cleanup", params)

    async def sessionEvents(self, **params: Any) -> Any:
        self._require_http("sessionEvents")
        return await self._rpc("session.events", params)

    async def sessionApproveTool(self, **params: Any) -> Any:
        self._require_http("sessionApproveTool")
        return await self._rpc("session.approveTool", params)

    async def sessionRejectTool(self, **params: Any) -> Any:
        self._require_http("sessionRejectTool")
        return await self._rpc("session.rejectTool", params)

    # ── Bridge methods ───────────────────────────────────────────────────

    async def bridgeCapabilities(self) -> Any:
        self._require_http("bridgeCapabilities")
        return await self._rpc("bridge.capabilities")

    async def bridgePing(self) -> Any:
        self._require_http("bridgePing")
        return await self._rpc("bridge.ping")

    async def bridgeInfo(self) -> Any:
        self._require_http("bridgeInfo")
        return await self._rpc("bridge.info")

    async def bridgeSetLogLevel(self, **params: Any) -> Any:
        self._require_http("bridgeSetLogLevel")
        return await self._rpc("bridge.setLogLevel", params)

    async def bridgeNegotiateVersion(self, **params: Any) -> Any:
        self._require_http("bridgeNegotiateVersion")
        return await self._rpc("bridge.negotiateVersion", params)

    # ── Config methods ───────────────────────────────────────────────────

    async def configGet(self, **params: Any) -> Any:
        self._require_http("configGet")
        return await self._rpc("config.get", params)

    async def configSet(self, **params: Any) -> Any:
        self._require_http("configSet")
        return await self._rpc("config.set", params)

    async def configList(self, **params: Any) -> Any:
        self._require_http("configList")
        return await self._rpc("config.list", params)

    # ── MCP methods ──────────────────────────────────────────────────────

    async def mcpAdd(self, **params: Any) -> Any:
        self._require_http("mcpAdd")
        return await self._rpc("mcp.add", params)

    async def mcpRemove(self, **params: Any) -> Any:
        self._require_http("mcpRemove")
        return await self._rpc("mcp.remove", params)

    async def mcpStart(self, **params: Any) -> Any:
        self._require_http("mcpStart")
        return await self._rpc("mcp.start", params)

    async def mcpStop(self, **params: Any) -> Any:
        self._require_http("mcpStop")
        return await self._rpc("mcp.stop", params)

    async def mcpList(self, **params: Any) -> Any:
        self._require_http("mcpList")
        return await self._rpc("mcp.list", params)

    # ── Hooks methods ────────────────────────────────────────────────────

    async def hooksAdd(self, **params: Any) -> Any:
        self._require_http("hooksAdd")
        return await self._rpc("hooks.add", params)

    async def hooksRemove(self, **params: Any) -> Any:
        self._require_http("hooksRemove")
        return await self._rpc("hooks.remove", params)

    async def hooksList(self, **params: Any) -> Any:
        self._require_http("hooksList")
        return await self._rpc("hooks.list", params)

    # ── Context methods ──────────────────────────────────────────────────

    async def contextRead(self, **params: Any) -> Any:
        self._require_http("contextRead")
        return await self._rpc("context.read", params)

    async def contextWrite(self, **params: Any) -> Any:
        self._require_http("contextWrite")
        return await self._rpc("context.write", params)

    async def contextList(self, **params: Any) -> Any:
        self._require_http("contextList")
        return await self._rpc("context.list", params)

    # ── Workspace methods ────────────────────────────────────────────────

    async def workspaceRegister(self, **params: Any) -> Any:
        self._require_http("workspaceRegister")
        return await self._rpc("workspace.register", params)

    async def workspaceList(self) -> Any:
        self._require_http("workspaceList")
        return await self._rpc("workspace.list")

    # ── Model / Tool / Workflow / Skills ─────────────────────────────────

    async def modelsList(self) -> Any:
        self._require_http("modelsList")
        return await self._rpc("models.list")

    async def toolsList(self) -> Any:
        self._require_http("toolsList")
        return await self._rpc("tools.list")

    async def workflowRun(self, **params: Any) -> Any:
        self._require_http("workflowRun")
        return await self._rpc("workflow.run", params)

    async def skillsList(self) -> Any:
        self._require_http("skillsList")
        return await self._rpc("skills.list")

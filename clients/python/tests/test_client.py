"""Unit tests for BridgeClient."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from ai_spec_sdk.client import BridgeClient
from ai_spec_sdk.errors import UnsupportedInStdioError


# ── Transport selection ──────────────────────────────────────────────────


def test_creates_stdio_transport():
    client = BridgeClient(transport="stdio")
    assert client._transport_type == "stdio"


def test_creates_http_transport():
    client = BridgeClient(transport="http", port=9999)
    assert client._transport_type == "http"


def test_invalid_transport_raises():
    with pytest.raises(ValueError, match="Unknown transport"):
        BridgeClient(transport="websocket")


# ── Context manager ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_context_manager_lifecycle():
    client = BridgeClient(transport="http", port=8765)

    mock_transport = AsyncMock()
    mock_transport.connect = AsyncMock()
    mock_transport.disconnect = AsyncMock()
    client._transport = mock_transport

    async with client:
        mock_transport.connect.assert_called_once()

    mock_transport.disconnect.assert_called_once()


# ── Stdio mode guard ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_stdio_raises_for_bridge_only_method():
    client = BridgeClient(transport="stdio")
    with pytest.raises(UnsupportedInStdioError, match="sessionSpawn"):
        await client.sessionSpawn(parentSessionId="parent", prompt="child")

    with pytest.raises(UnsupportedInStdioError, match="sessionList"):
        await client.sessionList()

    with pytest.raises(UnsupportedInStdioError, match="bridgeCapabilities"):
        await client.bridgeCapabilities()

    with pytest.raises(UnsupportedInStdioError, match="configGet"):
        await client.configGet(key="test")

    with pytest.raises(UnsupportedInStdioError, match="mcpAdd"):
        await client.mcpAdd(workspace="/tmp", name="server", command="cmd")

    with pytest.raises(UnsupportedInStdioError, match="toolsList"):
        await client.toolsList()


# ── HTTP mode dispatches to transport ────────────────────────────────────


@pytest.mark.asyncio
async def test_http_session_start():
    client = BridgeClient(transport="http", port=8765)

    mock_transport = AsyncMock()
    mock_transport.request = AsyncMock(return_value={"sessionId": "abc-123", "status": "active"})
    client._transport = mock_transport

    result = await client.sessionStart(workspace="/project", prompt="Hello")
    assert result["sessionId"] == "abc-123"
    mock_transport.request.assert_called_once_with("session.start", {
        "workspace": "/project",
        "prompt": "Hello",
    })


@pytest.mark.asyncio
async def test_http_session_spawn():
    client = BridgeClient(transport="http", port=8765)

    mock_transport = AsyncMock()
    mock_transport.request = AsyncMock(return_value={"sessionId": "child-123", "status": "active"})
    client._transport = mock_transport

    result = await client.sessionSpawn(parentSessionId="parent-123", prompt="Delegate")
    assert result["sessionId"] == "child-123"
    mock_transport.request.assert_called_once_with("session.spawn", {
        "parentSessionId": "parent-123",
        "prompt": "Delegate",
    })


@pytest.mark.asyncio
async def test_http_bridge_ping():
    client = BridgeClient(transport="http", port=8765)

    mock_transport = AsyncMock()
    mock_transport.request = AsyncMock(return_value={"pong": True})
    client._transport = mock_transport

    result = await client.bridgePing()
    assert result["pong"] is True
    mock_transport.request.assert_called_once_with("bridge.ping", None)


@pytest.mark.asyncio
async def test_http_session_list():
    client = BridgeClient(transport="http", port=8765)

    mock_transport = AsyncMock()
    mock_transport.request = AsyncMock(return_value={"sessions": []})
    client._transport = mock_transport

    result = await client.sessionList(status="active")
    assert result["sessions"] == []
    mock_transport.request.assert_called_once_with("session.list", {"status": "active"})


# ── Event listener ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_on_registers_handler():
    client = BridgeClient(transport="http")
    handler = MagicMock()
    client.on("session_event", handler)
    assert handler in client._emitter._handlers.get("session_event", set())


@pytest.mark.asyncio
async def test_off_removes_handler():
    client = BridgeClient(transport="http")
    handler = MagicMock()
    client.on("session_event", handler)
    client.off("session_event", handler)
    assert handler not in client._emitter._handlers.get("session_event", set())


def test_bridge_subagent_event_handlers_receive_notification_params():
    client = BridgeClient(transport="http")
    handler = MagicMock()
    client.on("bridge/subagent_event", handler)

    client._handle_transport_event({
        "jsonrpc": "2.0",
        "method": "bridge/subagent_event",
        "params": {
            "sessionId": "parent",
            "subagentId": "child",
            "type": "session_completed",
            "status": "completed",
        },
    })

    handler.assert_called_once_with({
        "sessionId": "parent",
        "subagentId": "child",
        "type": "session_completed",
        "status": "completed",
    })

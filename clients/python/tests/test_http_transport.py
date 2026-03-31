"""Unit tests for HttpTransport."""

from __future__ import annotations

import asyncio
import json
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from ai_spec_sdk.errors import JsonRpcError, TransportError
from ai_spec_sdk.transports.http import HttpTransport


# ── Connect / disconnect ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_connect_sets_connected():
    transport = HttpTransport(host="localhost", port=8765)
    await transport.connect()
    assert transport._connected is True
    await transport.disconnect()
    assert transport._connected is False


@pytest.mark.asyncio
async def test_request_without_connect_raises():
    transport = HttpTransport()
    with pytest.raises(TransportError, match="not connected"):
        await transport.request("bridge.ping")


# ── JSON-RPC request ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_successful_request():
    transport = HttpTransport(host="localhost", port=8765, api_key="test-key")
    await transport.connect()

    mock_conn = MagicMock()
    mock_response = MagicMock()
    mock_response.status = 200
    mock_response.read.return_value = json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "result": {"pong": True, "ts": "2026-01-01T00:00:00Z"},
    }).encode()
    mock_conn.getresponse.return_value = mock_response

    with patch("http.client.HTTPConnection", return_value=mock_conn):
        result = await transport.request("bridge.ping")

    assert result["pong"] is True
    # Verify auth header was sent
    call_kwargs = mock_conn.request.call_args
    assert call_kwargs[1]["headers"]["Authorization"] == "Bearer test-key"
    await transport.disconnect()


@pytest.mark.asyncio
async def test_request_without_api_key():
    transport = HttpTransport(host="localhost", port=8765)
    await transport.connect()

    mock_conn = MagicMock()
    mock_response = MagicMock()
    mock_response.status = 200
    mock_response.read.return_value = json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "result": {"pong": True},
    }).encode()
    mock_conn.getresponse.return_value = mock_response

    with patch("http.client.HTTPConnection", return_value=mock_conn):
        result = await transport.request("bridge.ping")

    call_kwargs = mock_conn.request.call_args
    assert "Authorization" not in call_kwargs[1]["headers"]
    await transport.disconnect()


@pytest.mark.asyncio
async def test_jsonrpc_error_response():
    transport = HttpTransport(host="localhost", port=8765)
    await transport.connect()

    mock_conn = MagicMock()
    mock_response = MagicMock()
    mock_response.status = 200
    mock_response.read.return_value = json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "error": {"code": -32602, "message": "Invalid params"},
    }).encode()
    mock_conn.getresponse.return_value = mock_response

    with patch("http.client.HTTPConnection", return_value=mock_conn):
        with pytest.raises(JsonRpcError) as exc_info:
            await transport.request("session.start", {"workspace": 123})
        assert exc_info.value.code == -32602
    await transport.disconnect()


@pytest.mark.asyncio
async def test_http_error_response():
    transport = HttpTransport(host="localhost", port=8765)
    await transport.connect()

    mock_conn = MagicMock()
    mock_response = MagicMock()
    mock_response.status = 500
    mock_response.read.return_value = b"Internal Server Error"
    mock_conn.getresponse.return_value = mock_response

    with patch("http.client.HTTPConnection", return_value=mock_conn):
        with pytest.raises(TransportError, match="HTTP 500"):
            await transport.request("bridge.ping")
    await transport.disconnect()


@pytest.mark.asyncio
async def test_request_body_format():
    transport = HttpTransport(host="localhost", port=8765)
    await transport.connect()

    mock_conn = MagicMock()
    mock_response = MagicMock()
    mock_response.status = 200
    mock_response.read.return_value = json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "result": {},
    }).encode()
    mock_conn.getresponse.return_value = mock_response

    with patch("http.client.HTTPConnection", return_value=mock_conn):
        await transport.request("session.list", {"status": "active"})

    call_args = mock_conn.request.call_args
    body = json.loads(call_args[1]["body"].decode())
    assert body["jsonrpc"] == "2.0"
    assert body["method"] == "session.list"
    assert body["params"] == {"status": "active"}
    assert "id" in body
    await transport.disconnect()


# ── SSE parsing ──────────────────────────────────────────────────────────


def test_dispatch_sse_session_event():
    transport = HttpTransport()
    received: list[dict] = []
    transport.on_event(lambda data: received.append(data))

    data = json.dumps({
        "jsonrpc": "2.0",
        "method": "bridge/session_event",
        "params": {"type": "agent_message", "sessionId": "abc", "messageType": "assistant_text"},
    })

    transport._dispatch_sse_event("session_event", data)
    assert len(received) == 1
    assert received[0]["messageType"] == "assistant_text"


def test_dispatch_sse_invalid_json_ignored():
    transport = HttpTransport()
    received: list[dict] = []
    transport.on_event(lambda data: received.append(data))

    transport._dispatch_sse_event("session_event", "not-json")
    assert len(received) == 0


def test_dispatch_sse_generic_payload():
    transport = HttpTransport()
    received: list[dict] = []
    transport.on_event(lambda data: received.append(data))

    data = json.dumps({"type": "session_completed", "sessionId": "abc"})
    transport._dispatch_sse_event("session_event", data)
    assert len(received) == 1
    assert received[0]["type"] == "session_completed"

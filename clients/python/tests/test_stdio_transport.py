"""Unit tests for StdioTransport."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch, call

import pytest

from ai_spec_sdk.errors import TransportError
from ai_spec_sdk.transports.stdio import StdioTransport, _classify_message_type


# ── _classify_message_type tests ─────────────────────────────────────────


def test_classify_system_init():
    msg = MagicMock(type="system", subtype="init")
    assert _classify_message_type(msg) == "system_init"


def test_classify_result():
    msg = MagicMock(type="result")
    assert _classify_message_type(msg) == "result"


def test_classify_assistant_text():
    block = MagicMock(type="text")
    msg = MagicMock(type="assistant", content=[block])
    assert _classify_message_type(msg) == "assistant_text"


def test_classify_tool_use():
    block = MagicMock(type="tool_use")
    msg = MagicMock(type="assistant", content=[block])
    assert _classify_message_type(msg) == "tool_use"


def test_classify_tool_use_precedence_over_text():
    text_block = MagicMock(type="text")
    tool_block = MagicMock(type="tool_use")
    msg = MagicMock(type="assistant", content=[text_block, tool_block])
    assert _classify_message_type(msg) == "tool_use"


def test_classify_tool_result():
    block = MagicMock(type="tool_result")
    msg = MagicMock(type="user", content=[block])
    assert _classify_message_type(msg) == "tool_result"


def test_classify_other():
    msg = MagicMock(type="unknown")
    assert _classify_message_type(msg) == "other"


# ── StdioTransport tests ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_connect_creates_client():
    transport = StdioTransport(workspace="/tmp/test")
    with patch("ai_spec_sdk.transports.stdio.ClaudeSDKClient") as MockClient:
        await transport.connect()
        MockClient.assert_called_once()
    await transport.disconnect()


@pytest.mark.asyncio
async def test_connect_idempotent():
    transport = StdioTransport()
    with patch("ai_spec_sdk.transports.stdio.ClaudeSDKClient"):
        await transport.connect()
        await transport.connect()
    await transport.disconnect()


@pytest.mark.asyncio
async def test_request_without_connect_raises():
    transport = StdioTransport()
    with pytest.raises(TransportError, match="not connected"):
        await transport.request("session.start", {"prompt": "hi"})


@pytest.mark.asyncio
async def test_unsupported_method_raises():
    transport = StdioTransport()
    with patch("ai_spec_sdk.transports.stdio.ClaudeSDKClient"):
        await transport.connect()
    with pytest.raises(TransportError, match="not supported"):
        await transport.request("session.list", {})
    await transport.disconnect()


@pytest.mark.asyncio
async def test_session_start():
    transport = StdioTransport()
    mock_client = AsyncMock()
    mock_client.connect = AsyncMock()
    mock_client.receive_messages = MagicMock(return_value=AsyncMock(__aiter__=MagicMock(return_value=iter([]))))

    with patch("ai_spec_sdk.transports.stdio.ClaudeSDKClient", return_value=mock_client):
        await transport.connect()
        result = await transport.request("session.start", {
            "workspace": "/project",
            "prompt": "Hello",
            "model": "claude-sonnet-4-6",
        })

    assert result["status"] == "active"
    assert "sessionId" in result
    mock_client.connect.assert_called_once_with(prompt="Hello")
    await transport.disconnect()


@pytest.mark.asyncio
async def test_session_resume():
    transport = StdioTransport()
    mock_client = AsyncMock()
    mock_client.query = AsyncMock()
    mock_client.receive_messages = MagicMock(return_value=AsyncMock(__aiter__=MagicMock(return_value=iter([]))))

    with patch("ai_spec_sdk.transports.stdio.ClaudeSDKClient", return_value=mock_client):
        await transport.connect()
        result = await transport.request("session.resume", {
            "sessionId": "abc-123",
            "prompt": "Continue",
        })

    assert result["sessionId"] == "abc-123"
    mock_client.query.assert_called_once_with(prompt="Continue", session_id="abc-123")
    await transport.disconnect()


@pytest.mark.asyncio
async def test_session_stop():
    transport = StdioTransport()
    mock_client = AsyncMock()
    mock_client.interrupt = AsyncMock()

    with patch("ai_spec_sdk.transports.stdio.ClaudeSDKClient", return_value=mock_client):
        await transport.connect()
        result = await transport.request("session.stop", {"sessionId": "abc-123"})

    assert result["status"] == "stopped"
    mock_client.interrupt.assert_called_once()
    await transport.disconnect()


@pytest.mark.asyncio
async def test_event_emission():
    transport = StdioTransport()
    mock_client = AsyncMock()
    mock_client.connect = AsyncMock()

    msg = MagicMock(type="assistant", content=[MagicMock(type="text")])

    async def mock_receive():
        yield msg

    mock_client.receive_messages = MagicMock(return_value=mock_receive())

    received_events: list[dict] = []

    def handler(event: dict) -> None:
        received_events.append(event)

    transport.on_event(handler)

    with patch("ai_spec_sdk.transports.stdio.ClaudeSDKClient", return_value=mock_client):
        await transport.connect()
        await transport.request("session.start", {"prompt": "Hello"})
        await asyncio.sleep(0.1)

    assert len(received_events) >= 1
    assert received_events[0]["messageType"] == "assistant_text"
    await transport.disconnect()


@pytest.mark.asyncio
async def test_result_event_type():
    transport = StdioTransport()
    msg = MagicMock(type="result", result="done")

    event = transport._message_to_event(msg)
    assert event["type"] == "session_completed"
    assert event["result"] == "done"

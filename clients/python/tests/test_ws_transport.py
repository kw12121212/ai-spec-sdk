import asyncio
import json
import pytest
from unittest.mock import AsyncMock, patch
from ai_spec_sdk.transports.ws import WebSocketTransport
from ai_spec_sdk.errors import TransportError, JsonRpcError

@pytest.fixture
def mock_websockets():
    with patch("ai_spec_sdk.transports.ws.websockets.connect") as mock_connect:
        mock_ws = AsyncMock()
        
        # We need an async generator for receiving messages
        async def mock_receive():
            while True:
                msg = await mock_ws.receive_queue.get()
                if msg is None:
                    break
                yield msg
                
        mock_ws.__aiter__.return_value = mock_receive()
        mock_ws.receive_queue = asyncio.Queue()
        mock_connect.return_value = mock_ws
        yield mock_connect

@pytest.mark.asyncio
async def test_ws_transport_connect(mock_websockets):
    transport = WebSocketTransport(url="ws://localhost/ws", api_key="secret")
    assert "token=secret" in transport._url
    
    await transport.connect()
    mock_websockets.assert_called_once_with(transport._url)
    assert transport._connected
    
    # Clean up
    await mock_websockets.return_value.receive_queue.put(None)
    await transport.disconnect()

@pytest.mark.asyncio
async def test_ws_transport_request(mock_websockets):
    transport = WebSocketTransport(url="ws://localhost/ws")
    await transport.connect()
    
    mock_ws = mock_websockets.return_value
    
    # Schedule sending a response
    async def simulate_response():
        await asyncio.sleep(0.01)
        # get the sent request
        call_args = mock_ws.send.call_args[0][0]
        req = json.loads(call_args)
        # put response in queue
        res = {"jsonrpc": "2.0", "id": req["id"], "result": "ok"}
        await mock_ws.receive_queue.put(json.dumps(res))
        
    asyncio.create_task(simulate_response())
    
    result = await transport.request("test.method", {"foo": "bar"})
    assert result == "ok"
    
    # Clean up
    await mock_ws.receive_queue.put(None)
    await transport.disconnect()

@pytest.mark.asyncio
async def test_ws_transport_notification(mock_websockets):
    transport = WebSocketTransport(url="ws://localhost/ws")
    await transport.connect()
    mock_ws = mock_websockets.return_value
    
    events = []
    transport.on_event(lambda e: events.append(e))
    
    notification = {"method": "bridge/session_event", "params": {"type": "test"}}
    await mock_ws.receive_queue.put(json.dumps(notification))
    
    await asyncio.sleep(0.05)
    
    assert len(events) == 1
    assert events[0] == {"type": "test"}
    
    # Clean up
    await mock_ws.receive_queue.put(None)
    await transport.disconnect()

@pytest.mark.asyncio
async def test_ws_transport_reconnect(mock_websockets):
    transport = WebSocketTransport(url="ws://localhost/ws")
    transport._reconnect_delay = 0.01 # fast reconnect for test
    await transport.connect()
    assert mock_websockets.call_count == 1
    
    # Simulate disconnect
    mock_ws = mock_websockets.return_value
    transport._handle_disconnect()
    
    await asyncio.sleep(0.05)
    
    assert mock_websockets.call_count > 1
    assert transport._connected
    
    # Clean up
    await mock_websockets.return_value.receive_queue.put(None)
    await transport.disconnect()

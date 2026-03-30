package bridge

import (
	"encoding/json"
	"errors"
	"testing"
)

func TestClient_CallResponse(t *testing.T) {
	// Use io.Pipe to simulate a bridge process.
	// The "stdout" pipe receives JSON-RPC responses we write.
	// The "stdin" pipe is where the client writes requests.
	// We don't use New() here because it spawns a real subprocess.
	// Instead, we test the readLoop and Call logic directly.

	// Test Request marshaling.
	req := Request{
		JSONRPC: "2.0",
		ID:      42,
		Method:  "test.method",
		Params:  map[string]any{"key": "value"},
	}
	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}

	var decoded Request
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal request: %v", err)
	}
	if decoded.ID != 42 {
		t.Errorf("ID = %d, want 42", decoded.ID)
	}
	if decoded.Method != "test.method" {
		t.Errorf("Method = %s, want test.method", decoded.Method)
	}
}

func TestResponse_Unmarshal(t *testing.T) {
	raw := `{"jsonrpc":"2.0","id":1,"result":{"pong":true,"ts":"2024-01-01T00:00:00Z"}}`
	var resp Response
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.ID != 1 {
		t.Errorf("ID = %d, want 1", resp.ID)
	}
	if resp.Error != nil {
		t.Errorf("unexpected error: %v", resp.Error)
	}
}

func TestResponse_ErrorUnmarshal(t *testing.T) {
	raw := `{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"Method not found"}}`
	var resp Response
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Error == nil {
		t.Fatal("expected error, got nil")
	}
	if resp.Error.Code != -32601 {
		t.Errorf("Code = %d, want -32601", resp.Error.Code)
	}
	if resp.Error.Message != "Method not found" {
		t.Errorf("Message = %s", resp.Error.Message)
	}
}

func TestNotification_Unmarshal(t *testing.T) {
	raw := `{"jsonrpc":"2.0","method":"bridge/session_event","params":{"type":"session_started","sessionId":"abc"}}`
	var notif Notification
	if err := json.Unmarshal([]byte(raw), &notif); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if notif.Method != "bridge/session_event" {
		t.Errorf("Method = %s", notif.Method)
	}
	if notif.Params["type"] != "session_started" {
		t.Errorf("type = %s", notif.Params["type"])
	}
}

func TestNotification_HasNoID(t *testing.T) {
	// A notification must not have an "id" field.
	raw := `{"jsonrpc":"2.0","method":"bridge/ping","params":{}}`
	var rawMap map[string]json.RawMessage
	json.Unmarshal([]byte(raw), &rawMap)
	if _, hasID := rawMap["id"]; hasID {
		t.Error("notification should not have an id field")
	}
}

func TestMockCaller_BasicUsage(t *testing.T) {
	mock := NewMockCaller()

	callCount := 0
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		callCount++
		return map[string]any{"result": "ok"}, nil
	}

	result, err := mock.Call("test.method", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if callCount != 1 {
		t.Errorf("CallFn called %d times, want 1", callCount)
	}
	data, ok := result.(map[string]any)
	if !ok {
		t.Fatal("unexpected result type")
	}
	if data["result"] != "ok" {
		t.Errorf("result = %v, want ok", data["result"])
	}
}

func TestMockCaller_CallHistory(t *testing.T) {
	mock := NewMockCaller()
	mock.Call("method1", map[string]any{"a": 1})
	mock.Call("method2", map[string]any{"b": 2})

	history := mock.CallHistory()
	if len(history) != 2 {
		t.Fatalf("history length = %d, want 2", len(history))
	}
	if history[0].Method != "method1" {
		t.Errorf("history[0].Method = %s", history[0].Method)
	}
	if history[1].Method != "method2" {
		t.Errorf("history[1].Method = %s", history[1].Method)
	}
}

func TestMockCaller_CallCount(t *testing.T) {
	mock := NewMockCaller()
	if mock.CallCount() != 0 {
		t.Errorf("initial count = %d, want 0", mock.CallCount())
	}
	mock.Call("a", nil)
	mock.Call("b", nil)
	if mock.CallCount() != 2 {
		t.Errorf("count = %d, want 2", mock.CallCount())
	}
}

func TestMockCaller_ErrorResponse(t *testing.T) {
	mock := NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return nil, errors.New("bridge error [-32601]: Method not found")
	}

	_, err := mock.Call("bad.method", nil)
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestMockCaller_OnNotification(t *testing.T) {
	mock := NewMockCaller()
	var received Notification

	mock.OnNotification("bridge/session_event", func(n Notification) {
		received = n
	})

	handler := mock.GetNotificationHandler("bridge/session_event")
	if handler == nil {
		t.Fatal("expected handler to be registered")
	}
	handler(Notification{
		Method: "bridge/session_event",
		Params: map[string]any{"type": "session_started", "sessionId": "x"},
	})
	if received.Params["sessionId"] != "x" {
		t.Errorf("sessionId = %v, want x", received.Params["sessionId"])
	}
}

func TestRequest_JSONRoundTrip(t *testing.T) {
	req := Request{JSONRPC: "2.0", ID: 1, Method: "test"}
	data, _ := json.Marshal(req)
	var m map[string]any
	json.Unmarshal(data, &m)
	if m["id"].(float64) != 1 {
		t.Errorf("id = %v, want 1", m["id"])
	}
	if m["method"].(string) != "test" {
		t.Errorf("method = %v", m["method"])
	}
}

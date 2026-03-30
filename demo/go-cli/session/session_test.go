package session

import (
	"errors"
	"testing"

	"go-cli/bridge"
)

func TestNewManager(t *testing.T) {
	mock := bridge.NewMockCaller()
	m := NewManager(mock, "/workspace", "claude-sonnet-4-6", "approve")

	if m.CurrentWorkspace != "/workspace" {
		t.Errorf("CurrentWorkspace = %s, want /workspace", m.CurrentWorkspace)
	}
	if m.CurrentModel != "claude-sonnet-4-6" {
		t.Errorf("CurrentModel = %s", m.CurrentModel)
	}
	if m.PermissionMode != "approve" {
		t.Errorf("PermissionMode = %s, want approve", m.PermissionMode)
	}
	if m.CurrentSessionID != "" {
		t.Errorf("CurrentSessionID = %q, want empty", m.CurrentSessionID)
	}
}

func TestStart_Success(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		if method == "session.start" {
			return map[string]any{
				"sessionId": "sess-123",
				"status":    "completed",
				"result":    "done",
				"usage": map[string]any{
					"inputTokens":  100,
					"outputTokens": 50,
				},
			}, nil
		}
		return nil, nil
	}

	m := NewManager(mock, "/ws", "claude-sonnet-4-6", "bypassPermissions")
	result, err := m.Start("hello")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.SessionID != "sess-123" {
		t.Errorf("SessionID = %s, want sess-123", result.SessionID)
	}
	if result.Status != "completed" {
		t.Errorf("Status = %s, want completed", result.Status)
	}
	if result.Usage == nil {
		t.Fatal("expected usage")
	}
	if result.Usage.InputTokens != 100 {
		t.Errorf("InputTokens = %d, want 100", result.Usage.InputTokens)
	}
	if result.Usage.OutputTokens != 50 {
		t.Errorf("OutputTokens = %d, want 50", result.Usage.OutputTokens)
	}
}

func TestStart_SetsSessionID(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{"sessionId": "sess-abc", "status": "completed"}, nil
	}

	m := NewManager(mock, "/ws", "", "bypassPermissions")
	m.Start("prompt")
	if m.CurrentSessionID != "sess-abc" {
		t.Errorf("CurrentSessionID = %s, want sess-abc", m.CurrentSessionID)
	}
}

func TestStart_WithModel(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{"sessionId": "s1", "status": "completed"}, nil
	}

	m := NewManager(mock, "/ws", "claude-opus-4-6", "bypassPermissions")
	m.Start("test")

	history := mock.CallHistory()
	found := false
	for _, call := range history {
		if call.Method == "session.start" {
			if call.Params["model"] != "claude-opus-4-6" {
				t.Errorf("model param = %v, want claude-opus-4-6", call.Params["model"])
			}
			found = true
		}
	}
	if !found {
		t.Error("session.start not called")
	}
}

func TestStart_PassesPermissionMode(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{"sessionId": "s1", "status": "completed"}, nil
	}

	m := NewManager(mock, "/ws", "", "approve")
	m.Start("test")

	for _, call := range mock.CallHistory() {
		if call.Method == "session.start" {
			if call.Params["permissionMode"] != "approve" {
				t.Errorf("permissionMode = %v, want approve", call.Params["permissionMode"])
			}
		}
	}
}

func TestStart_Error(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return nil, errors.New("bridge error [-32602]: 'workspace' must be provided")
	}

	m := NewManager(mock, "/ws", "", "approve")
	_, err := m.Start("test")
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestStart_RegistersNotificationHandlers(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{"sessionId": "s1", "status": "completed"}, nil
	}

	m := NewManager(mock, "/ws", "", "bypassPermissions")
	m.Start("test")

	if mock.GetNotificationHandler("bridge/session_event") == nil {
		t.Error("expected bridge/session_event handler to be registered")
	}
	if mock.GetNotificationHandler("bridge/tool_approval_requested") == nil {
		t.Error("expected bridge/tool_approval_requested handler to be registered")
	}
}

func TestResume_Success(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{"sessionId": "sess-456", "status": "completed"}, nil
	}

	m := NewManager(mock, "/ws", "claude-sonnet-4-6", "bypassPermissions")
	result, err := m.Resume("sess-456", "continue")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.SessionID != "sess-456" {
		t.Errorf("SessionID = %s", result.SessionID)
	}
}

func TestResume_SetsSessionID(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{"sessionId": "r1", "status": "completed"}, nil
	}

	m := NewManager(mock, "/ws", "", "bypassPermissions")
	m.Resume("r1", "prompt")
	if m.CurrentSessionID != "r1" {
		t.Errorf("CurrentSessionID = %s, want r1", m.CurrentSessionID)
	}
}

func TestResume_PassesSessionID(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{"sessionId": "r1", "status": "completed"}, nil
	}

	m := NewManager(mock, "/ws", "", "bypassPermissions")
	m.Resume("my-session", "prompt")

	found := false
	for _, call := range mock.CallHistory() {
		if call.Method == "session.resume" {
			if call.Params["sessionId"] != "my-session" {
				t.Errorf("sessionId = %v, want my-session", call.Params["sessionId"])
			}
			found = true
		}
	}
	if !found {
		t.Error("session.resume not called")
	}
}

func TestStop_Success(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{"sessionId": "s1", "status": "stopped"}, nil
	}

	m := NewManager(mock, "/ws", "", "approve")
	m.CurrentSessionID = "s1"
	err := m.Stop()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if m.CurrentSessionID != "" {
		t.Errorf("CurrentSessionID = %q, want empty after stop", m.CurrentSessionID)
	}
}

func TestStop_NoActiveSession(t *testing.T) {
	mock := bridge.NewMockCaller()
	m := NewManager(mock, "/ws", "", "approve")
	err := m.Stop()
	if err == nil {
		t.Fatal("expected error when no active session")
	}
}

func TestList_Success(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{
			"sessions": []any{
				map[string]any{
					"sessionId": "s1", "status": "completed",
					"workspace": "/ws", "createdAt": "2024-01-01", "updatedAt": "2024-01-01",
					"prompt": "hello",
				},
			},
		}, nil
	}

	m := NewManager(mock, "/ws", "", "approve")
	result, err := m.List("")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Sessions) != 1 {
		t.Fatalf("len(Sessions) = %d, want 1", len(result.Sessions))
	}
	if result.Sessions[0].SessionID != "s1" {
		t.Errorf("SessionID = %s, want s1", result.Sessions[0].SessionID)
	}
	if result.Sessions[0].Prompt != "hello" {
		t.Errorf("Prompt = %v, want hello", result.Sessions[0].Prompt)
	}
}

func TestList_Empty(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{"sessions": []any{}}, nil
	}

	m := NewManager(mock, "/ws", "", "approve")
	result, err := m.List("all")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Sessions) != 0 {
		t.Errorf("len(Sessions) = %d, want 0", len(result.Sessions))
	}
}

func TestList_WithStatusFilter(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{"sessions": []any{}}, nil
	}

	m := NewManager(mock, "/ws", "", "approve")
	m.List("active")

	for _, call := range mock.CallHistory() {
		if call.Method == "session.list" {
			if call.Params["status"] != "active" {
				t.Errorf("status = %v, want active", call.Params["status"])
			}
		}
	}
}

func TestHistory_Success(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{
			"sessionId": "s1",
			"total":     3,
			"entries": []any{
				map[string]any{"type": "user_prompt", "prompt": "hello"},
				map[string]any{"type": "agent_message"},
			},
		}, nil
	}

	m := NewManager(mock, "/ws", "", "approve")
	result, err := m.History("s1", 0, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.SessionID != "s1" {
		t.Errorf("SessionID = %s", result.SessionID)
	}
	if result.Total != 3 {
		t.Errorf("Total = %d, want 3", result.Total)
	}
	if len(result.Entries) != 2 {
		t.Errorf("len(Entries) = %d, want 2", len(result.Entries))
	}
}

func TestHistory_WithPagination(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{"sessionId": "s1", "total": 10, "entries": []any{}}, nil
	}

	m := NewManager(mock, "/ws", "", "approve")
	m.History("s1", 5, 20)

	for _, call := range mock.CallHistory() {
		if call.Method == "session.history" {
			if call.Params["offset"] != 5 {
				t.Errorf("offset = %v, want 5", call.Params["offset"])
			}
			if call.Params["limit"] != 20 {
				t.Errorf("limit = %v, want 20", call.Params["limit"])
			}
		}
	}
}

// --- Helper function tests ---

func TestStatus_Success(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{
			"sessionId":     "s1",
			"status":        "active",
			"createdAt":     "2024-01-01T00:00:00Z",
			"updatedAt":     "2024-01-01T00:01:00Z",
			"historyLength": 5,
			"result":        nil,
		}, nil
	}

	m := NewManager(mock, "/ws", "", "approve")
	result, err := m.Status("s1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.SessionID != "s1" {
		t.Errorf("SessionID = %s, want s1", result.SessionID)
	}
	if result.Status != "active" {
		t.Errorf("Status = %s, want active", result.Status)
	}
	if result.HistoryLength != 5 {
		t.Errorf("HistoryLength = %d, want 5", result.HistoryLength)
	}
}

func TestStatus_Error(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return nil, errors.New("session not found")
	}

	m := NewManager(mock, "/ws", "", "approve")
	_, err := m.Status("nonexistent")
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestEvents_Success(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{
			"sessionId": "s1",
			"total":     2,
			"events": []any{
				map[string]any{"seq": 0, "type": "session_started"},
				map[string]any{"seq": 1, "type": "agent_message", "messageType": "assistant_text"},
			},
		}, nil
	}

	m := NewManager(mock, "/ws", "", "approve")
	result, err := m.Events("s1", 0, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Total != 2 {
		t.Errorf("Total = %d, want 2", result.Total)
	}
	if len(result.Events) != 2 {
		t.Errorf("len(Events) = %d, want 2", len(result.Events))
	}
}

func TestEvents_WithSinceAndLimit(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{"sessionId": "s1", "total": 10, "events": []any{}}, nil
	}

	m := NewManager(mock, "/ws", "", "approve")
	m.Events("s1", 5, 20)

	for _, call := range mock.CallHistory() {
		if call.Method == "session.events" {
			if call.Params["since"] != 5 {
				t.Errorf("since = %v, want 5", call.Params["since"])
			}
			if call.Params["limit"] != 20 {
				t.Errorf("limit = %v, want 20", call.Params["limit"])
			}
		}
	}
}

func TestEvents_Error(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return nil, errors.New("session not found")
	}

	m := NewManager(mock, "/ws", "", "approve")
	_, err := m.Events("nonexistent", 0, 0)
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestToString(t *testing.T) {
	tests := []struct {
		name string
		in   any
		want string
	}{
		{"nil", nil, ""},
		{"string", "hello", "hello"},
		{"int", 42, "42"},
		{"float", 3.14, "3.14"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := toString(tt.in); got != tt.want {
				t.Errorf("toString(%v) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestToInt(t *testing.T) {
	tests := []struct {
		name string
		in   any
		want int
	}{
		{"nil", nil, 0},
		{"float64", float64(42), 42},
		{"int", 42, 42},
		{"string", "not a number", 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := toInt(tt.in); got != tt.want {
				t.Errorf("toInt(%v) = %d, want %d", tt.in, got, tt.want)
			}
		})
	}
}

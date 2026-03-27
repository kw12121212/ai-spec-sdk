package workflow

import (
	"errors"
	"testing"

	"go-cli/bridge"
)

func TestNewRunner(t *testing.T) {
	mock := bridge.NewMockCaller()
	r := NewRunner(mock)
	if r == nil {
		t.Fatal("expected non-nil runner")
	}
}

func TestAvailableWorkflows_Success(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{
			"workflows": []any{"init", "propose", "apply"},
		}, nil
	}

	r := NewRunner(mock)
	names, err := r.AvailableWorkflows()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(names) != 3 {
		t.Fatalf("len = %d, want 3", len(names))
	}
	if names[0] != "init" || names[1] != "propose" || names[2] != "apply" {
		t.Errorf("workflows = %v", names)
	}
}

func TestAvailableWorkflows_Empty(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{"workflows": []any{}}, nil
	}

	r := NewRunner(mock)
	names, err := r.AvailableWorkflows()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(names) != 0 {
		t.Errorf("len = %d, want 0", len(names))
	}
}

func TestAvailableWorkflows_CallsCapabilities(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{"workflows": []any{"list"}}, nil
	}

	r := NewRunner(mock)
	r.AvailableWorkflows()

	if mock.CallCount() != 1 {
		t.Errorf("call count = %d, want 1", mock.CallCount())
	}
	if mock.CallHistory()[0].Method != "bridge.capabilities" {
		t.Errorf("method = %s, want bridge.capabilities", mock.CallHistory()[0].Method)
	}
}

func TestRun_Success(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{
			"success":  true,
			"message":   "Workflow completed",
			"artifact":  ".spec-driven/changes/test",
		}, nil
	}

	r := NewRunner(mock)
	result, err := r.Run("init", "/workspace", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Success {
		t.Error("expected Success = true")
	}
	if result.Message != "Workflow completed" {
		t.Errorf("Message = %s", result.Message)
	}
	if result.Artifact != ".spec-driven/changes/test" {
		t.Errorf("Artifact = %s", result.Artifact)
	}
}

func TestRun_WithArgs(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{"success": true}, nil
	}

	r := NewRunner(mock)
	r.Run("propose", "/workspace", []string{"my-change"})

	for _, call := range mock.CallHistory() {
		if call.Method == "workflow.run" {
			args, ok := call.Params["args"].([]any)
			if !ok {
				t.Fatal("args is not []any")
			}
			if len(args) != 1 || args[0] != "my-change" {
				t.Errorf("args = %v, want [my-change]", args)
			}
		}
	}
}

func TestRun_PassesWorkspaceAndName(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{"success": true}, nil
	}

	r := NewRunner(mock)
	r.Run("verify", "/my-project", nil)

	for _, call := range mock.CallHistory() {
		if call.Method == "workflow.run" {
			if call.Params["workspace"] != "/my-project" {
				t.Errorf("workspace = %v, want /my-project", call.Params["workspace"])
			}
			if call.Params["workflow"] != "verify" {
				t.Errorf("workflow = %v, want verify", call.Params["workflow"])
			}
		}
	}
}

func TestRun_Error(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return nil, errors.New("workspace not found")
	}

	r := NewRunner(mock)
	_, err := r.Run("init", "/nonexistent", nil)
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestRun_RegistersProgressHandler(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{"success": true}, nil
	}

	r := NewRunner(mock)
	r.Run("init", "/workspace", nil)

	if mock.GetNotificationHandler("bridge/progress") == nil {
		t.Error("expected bridge/progress handler to be registered")
	}
}

func TestRun_FailedWorkflow(t *testing.T) {
	mock := bridge.NewMockCaller()
	mock.CallFn = func(method string, params map[string]any) (any, error) {
		return map[string]any{
			"success": false,
			"message": "Prerequisites not met",
		}, nil
	}

	r := NewRunner(mock)
	result, err := r.Run("apply", "/workspace", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Success {
		t.Error("expected Success = false")
	}
	if result.Message != "Prerequisites not met" {
		t.Errorf("Message = %s", result.Message)
	}
}

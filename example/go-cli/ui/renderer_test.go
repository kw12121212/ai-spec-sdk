package ui

import (
	"bytes"
	"io"
	"os"
	"strings"
	"testing"
)

// --- Pure function tests ---

func TestTruncate(t *testing.T) {
	tests := []struct {
		name   string
		input  string
		maxLen int
		want   string
	}{
		{"short string", "hello", 10, "hello"},
		{"exact length", "hello", 5, "hello"},
		{"over length", "hello world", 5, "hello..."},
		{"empty string", "", 10, ""},
		{"maxLen zero", "abc", 0, "..."},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := truncate(tt.input, tt.maxLen)
			if got != tt.want {
				t.Errorf("truncate(%q, %d) = %q, want %q", tt.input, tt.maxLen, got, tt.want)
			}
		})
	}
}

func TestPrettyPrint(t *testing.T) {
	got := prettyPrint(map[string]any{"key": "value"})
	if !strings.Contains(got, `"key"`) || !strings.Contains(got, `"value"`) {
		t.Errorf("prettyPrint missing expected content: %s", got)
	}
	if !strings.Contains(got, "\n") {
		t.Error("prettyPrint should produce multi-line output")
	}
}

func TestPrettyPrint_NonJSONable(t *testing.T) {
	// Functions can't be marshaled; prettyPrint should fall back to fmt.Sprintf.
	got := prettyPrint(func() {})
	if got == "" {
		t.Error("prettyPrint should return something for non-JSONable input")
	}
}

func TestGetContentArray_Nested(t *testing.T) {
	msg := map[string]any{
		"message": map[string]any{
			"content": []any{
				map[string]any{"type": "text", "text": "hello"},
			},
		},
	}
	content := getContentArray(msg)
	if len(content) != 1 {
		t.Fatalf("len = %d, want 1", len(content))
	}
	block, ok := content[0].(map[string]any)
	if !ok || block["type"] != "text" {
		t.Errorf("unexpected block: %v", content[0])
	}
}

func TestGetContentArray_TopLevel(t *testing.T) {
	msg := map[string]any{
		"content": []any{
			map[string]any{"type": "text", "text": "direct"},
		},
	}
	content := getContentArray(msg)
	if len(content) != 1 {
		t.Fatalf("len = %d, want 1", len(content))
	}
}

func TestGetContentArray_NestedPreferred(t *testing.T) {
	// When both nested and top-level content exist, nested should win.
	msg := map[string]any{
		"message": map[string]any{
			"content": []any{map[string]any{"type": "text", "text": "nested"}},
		},
		"content": []any{map[string]any{"type": "text", "text": "top"}},
	}
	content := getContentArray(msg)
	if len(content) != 1 {
		t.Fatalf("len = %d, want 1", len(content))
	}
	block := content[0].(map[string]any)
	if block["text"] != "nested" {
		t.Errorf("expected nested content, got %v", block["text"])
	}
}

func TestGetContentArray_Missing(t *testing.T) {
	content := getContentArray(map[string]any{"other": "value"})
	if content != nil {
		t.Errorf("expected nil, got %v", content)
	}
}

func TestGetContentArray_NonArray(t *testing.T) {
	content := getContentArray(map[string]any{"content": "not an array"})
	if content != nil {
		t.Errorf("expected nil for non-array content, got %v", content)
	}
}

func TestExtractText_Nested(t *testing.T) {
	msg := map[string]any{
		"message": map[string]any{
			"content": []any{
				map[string]any{"type": "text", "text": "Hello, world!"},
			},
		},
	}
	got := extractText(msg)
	if got != "Hello, world!" {
		t.Errorf("extractText = %q, want %q", got, "Hello, world!")
	}
}

func TestExtractText_TopLevel(t *testing.T) {
	msg := map[string]any{
		"content": []any{
			map[string]any{"type": "text", "text": "direct text"},
		},
	}
	got := extractText(msg)
	if got != "direct text" {
		t.Errorf("extractText = %q, want %q", got, "direct text")
	}
}

func TestExtractText_NoTextBlock(t *testing.T) {
	msg := map[string]any{
		"message": map[string]any{
			"content": []any{
				map[string]any{"type": "tool_use", "name": "Bash"},
			},
		},
	}
	got := extractText(msg)
	if got != "" {
		t.Errorf("extractText = %q, want empty", got)
	}
}

func TestExtractText_MultipleBlocks(t *testing.T) {
	msg := map[string]any{
		"message": map[string]any{
			"content": []any{
				map[string]any{"type": "tool_use", "name": "Bash"},
				map[string]any{"type": "text", "text": "second"},
			},
		},
	}
	got := extractText(msg)
	if got != "second" {
		t.Errorf("extractText = %q, want second", got)
	}
}

func TestExtractToolUse(t *testing.T) {
	msg := map[string]any{
		"message": map[string]any{
			"content": []any{
				map[string]any{
					"type":  "tool_use",
					"name":  "Read",
					"input": map[string]any{"file_path": "/tmp/test.txt"},
				},
			},
		},
	}
	name, input := extractToolUse(msg)
	if name != "Read" {
		t.Errorf("name = %q, want Read", name)
	}
	inputMap, ok := input.(map[string]any)
	if !ok || inputMap["file_path"] != "/tmp/test.txt" {
		t.Errorf("input = %v, want file_path=/tmp/test.txt", input)
	}
}

func TestExtractToolUse_NoToolUse(t *testing.T) {
	msg := map[string]any{
		"message": map[string]any{
			"content": []any{
				map[string]any{"type": "text", "text": "just text"},
			},
		},
	}
	name, input := extractToolUse(msg)
	if name != "" {
		t.Errorf("name = %q, want empty", name)
	}
	if input != nil {
		t.Errorf("input = %v, want nil", input)
	}
}

func TestExtractToolResult_String(t *testing.T) {
	msg := map[string]any{
		"message": map[string]any{
			"content": []any{
				map[string]any{"type": "tool_result", "content": "file contents here"},
			},
		},
	}
	got := extractToolResult(msg)
	if got != "file contents here" {
		t.Errorf("extractToolResult = %q, want %q", got, "file contents here")
	}
}

func TestExtractToolResult_NestedContent(t *testing.T) {
	msg := map[string]any{
		"message": map[string]any{
			"content": []any{
				map[string]any{"type": "tool_result", "content": "result data"},
			},
		},
	}
	got := extractToolResult(msg)
	if !strings.Contains(got, "result data") {
		t.Errorf("extractToolResult = %q", got)
	}
}

func TestExtractToolResult_NoToolResult(t *testing.T) {
	msg := map[string]any{
		"message": map[string]any{
			"content": []any{
				map[string]any{"type": "text", "text": "no result here"},
			},
		},
	}
	got := extractToolResult(msg)
	if got != "" {
		t.Errorf("extractToolResult = %q, want empty", got)
	}
}

// --- RenderEvent tests (capture stdout) ---

func captureStdout(t *testing.T, fn func()) string {
	t.Helper()
	old := os.Stdout
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe: %v", err)
	}
	os.Stdout = w

	fn()

	w.Close()
	os.Stdout = old

	var buf bytes.Buffer
	io.Copy(&buf, r)
	return buf.String()
}

func TestRenderEvent_SessionStarted(t *testing.T) {
	out := captureStdout(t, func() {
		RenderEvent(map[string]any{
			"type":      "session_started",
			"sessionId": "sess-123",
		})
	})
	if !strings.Contains(out, "sess-123") {
		t.Errorf("expected session ID in output, got: %s", out)
	}
	if !strings.Contains(out, "Session started") {
		t.Errorf("expected 'Session started' in output, got: %s", out)
	}
}

func TestRenderEvent_SessionResumed(t *testing.T) {
	out := captureStdout(t, func() {
		RenderEvent(map[string]any{
			"type":      "session_resumed",
			"sessionId": "sess-456",
		})
	})
	if !strings.Contains(out, "sess-456") {
		t.Errorf("expected session ID in output, got: %s", out)
	}
}

func TestRenderEvent_SessionCompleted(t *testing.T) {
	out := captureStdout(t, func() {
		RenderEvent(map[string]any{
			"type":      "session_completed",
			"sessionId": "sess-789",
			"result":    "all good",
			"usage": map[string]any{
				"inputTokens":  200,
				"outputTokens": 100,
			},
		})
	})
	if !strings.Contains(out, "Session completed") {
		t.Errorf("expected 'Session completed', got: %s", out)
	}
	if !strings.Contains(out, "200") || !strings.Contains(out, "100") {
		t.Errorf("expected token counts, got: %s", out)
	}
}

func TestRenderEvent_SessionStopped(t *testing.T) {
	out := captureStdout(t, func() {
		RenderEvent(map[string]any{
			"type":   "session_stopped",
			"status": "stopped",
		})
	})
	if !strings.Contains(out, "Session stopped") {
		t.Errorf("expected 'Session stopped', got: %s", out)
	}
}

func TestRenderEvent_AgentMessage_AssistantText(t *testing.T) {
	out := captureStdout(t, func() {
		RenderEvent(map[string]any{
			"type":         "agent_message",
			"messageType":  "assistant_text",
			"message": map[string]any{
				"message": map[string]any{
					"content": []any{
						map[string]any{"type": "text", "text": "Hello from Claude"},
					},
				},
			},
		})
	})
	if !strings.Contains(out, "Hello from Claude") {
		t.Errorf("expected text in output, got: %s", out)
	}
}

func TestRenderEvent_AgentMessage_ToolUse(t *testing.T) {
	out := captureStdout(t, func() {
		RenderEvent(map[string]any{
			"type":         "agent_message",
			"messageType":  "tool_use",
			"message": map[string]any{
				"message": map[string]any{
					"content": []any{
						map[string]any{
							"type":  "tool_use",
							"name":  "Bash",
							"input": map[string]any{"command": "ls"},
						},
					},
				},
			},
		})
	})
	if !strings.Contains(out, "Bash") {
		t.Errorf("expected tool name in output, got: %s", out)
	}
	if !strings.Contains(out, "Tool:") {
		t.Errorf("expected 'Tool:' in output, got: %s", out)
	}
}

func TestRenderEvent_AgentMessage_SystemInit(t *testing.T) {
	out := captureStdout(t, func() {
		RenderEvent(map[string]any{
			"type":         "agent_message",
			"messageType":  "system_init",
			"message": map[string]any{
				"model":      "claude-opus-4-6",
				"session_id": "sdk-session-1",
			},
		})
	})
	if !strings.Contains(out, "claude-opus-4-6") {
		t.Errorf("expected model in output, got: %s", out)
	}
	if !strings.Contains(out, "sdk-session-1") {
		t.Errorf("expected session_id in output, got: %s", out)
	}
}

func TestRenderEvent_AgentMessage_Result(t *testing.T) {
	out := captureStdout(t, func() {
		RenderEvent(map[string]any{
			"type":         "agent_message",
			"messageType":  "result",
			"message": map[string]any{
				"subtype": "success",
				"result":  "done",
			},
		})
	})
	if !strings.Contains(out, "Done") {
		t.Errorf("expected 'Done' in output, got: %s", out)
	}
}

func TestRenderEvent_AgentMessage_ResultError(t *testing.T) {
	out := captureStdout(t, func() {
		RenderEvent(map[string]any{
			"type":         "agent_message",
			"messageType":  "result",
			"message": map[string]any{
				"subtype": "error",
				"result":  "something went wrong",
			},
		})
	})
	if !strings.Contains(out, "Error") {
		t.Errorf("expected 'Error' in output, got: %s", out)
	}
}

func TestRenderEvent_UnknownType(t *testing.T) {
	out := captureStdout(t, func() {
		RenderEvent(map[string]any{
			"type": "unknown_type",
		})
	})
	// Unknown types should produce no output (no case match in the switch).
	if out != "" {
		t.Errorf("expected empty output for unknown type, got: %s", out)
	}
}

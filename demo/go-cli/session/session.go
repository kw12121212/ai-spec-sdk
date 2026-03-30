// Package session provides a high-level session manager that wraps the
// JSON-RPC bridge client with methods for starting, resuming, stopping,
// listing, and inspecting agent sessions.
package session

import (
	"fmt"

	"go-cli/bridge"
	"go-cli/ui"
)

// Manager manages agent sessions via the bridge.
type Manager struct {
	client   bridge.Caller
	// CurrentSessionID holds the session ID of the most recently started/resumed session.
	CurrentSessionID string
	// CurrentModel holds the Claude model ID to use for new sessions.
	CurrentModel string
	// CurrentWorkspace holds the workspace path.
	CurrentWorkspace string
	// PermissionMode controls tool approval behavior.
	PermissionMode string
}

// NewManager creates a new session manager.
func NewManager(client bridge.Caller, workspace, model, permissionMode string) *Manager {
	return &Manager{
		client:          client,
		CurrentModel:    model,
		CurrentWorkspace: workspace,
		PermissionMode:  permissionMode,
	}
}

// StartResult is the response from session.start.
type StartResult struct {
	SessionID string `json:"sessionId"`
	Status    string `json:"status"`
	Result    any    `json:"result"`
	Usage     *Usage `json:"usage"`
}

// Usage contains token usage statistics.
type Usage struct {
	InputTokens  int `json:"inputTokens"`
	OutputTokens int `json:"outputTokens"`
}

// SessionEntry is a summary entry from session.list.
type SessionEntry struct {
	SessionID  string `json:"sessionId"`
	Status     string `json:"status"`
	Workspace  string `json:"workspace"`
	CreatedAt  string `json:"createdAt"`
	UpdatedAt  string `json:"updatedAt"`
	Prompt     any    `json:"prompt"`
}

// SessionListResult is the response from session.list.
type SessionListResult struct {
	Sessions []SessionEntry `json:"sessions"`
}

// HistoryResult is the response from session.history.
type HistoryResult struct {
	SessionID string `json:"sessionId"`
	Total     int    `json:"total"`
	Entries   []any  `json:"entries"`
}

// StatusResult is the response from session.status.
type StatusResult struct {
	SessionID    string `json:"sessionId"`
	Status       string `json:"status"`
	CreatedAt    string `json:"createdAt"`
	UpdatedAt    string `json:"updatedAt"`
	HistoryLength int    `json:"historyLength"`
	Result       any    `json:"result"`
}

// EventsResult is the response from session.events.
type EventsResult struct {
	SessionID string `json:"sessionId"`
	Events    []any  `json:"events"`
	Total     int    `json:"total"`
}

// Start creates a new agent session with the given prompt.
// Before calling session.start, it registers a notification handler so
// streaming events are rendered to the terminal in real time.
func (m *Manager) Start(prompt string) (*StartResult, error) {
	// Set up notification handler for session events.
	m.client.OnNotification("bridge/session_event", func(n bridge.Notification) {
		ui.RenderEvent(n.Params)
	})

	// Set up notification handler for tool approval requests.
	m.client.OnNotification("bridge/tool_approval_requested", func(n bridge.Notification) {
		params := n.Params
		sessionID, _ := params["sessionId"].(string)
		requestID, _ := params["requestId"].(string)

		if ui.PromptToolApproval(params) {
			// User approved — call session.approveTool.
			_, err := m.client.Call("session.approveTool", map[string]any{
				"sessionId": sessionID,
				"requestId": requestID,
			})
			if err != nil {
				fmt.Printf("  Error approving tool: %v\n", err)
			}
		} else {
			// User rejected — call session.rejectTool.
			_, err := m.client.Call("session.rejectTool", map[string]any{
				"sessionId": sessionID,
				"requestId": requestID,
				"message":   "Rejected by user",
			})
			if err != nil {
				fmt.Printf("  Error rejecting tool: %v\n", err)
			}
		}
	})

	params := map[string]any{
		"workspace":      m.CurrentWorkspace,
		"prompt":         prompt,
		"permissionMode": m.PermissionMode,
	}
	if m.CurrentModel != "" {
		params["model"] = m.CurrentModel
	}

	result, err := m.client.Call("session.start", params)
	if err != nil {
		return nil, fmt.Errorf("session.start: %w", err)
	}

	// Parse the result into a typed struct.
	data, _ := result.(map[string]any)
	if data == nil {
		return nil, fmt.Errorf("unexpected session.start response")
	}

	sr := &StartResult{
		SessionID: toString(data["sessionId"]),
		Status:    toString(data["status"]),
		Result:    data["result"],
	}
	if u, ok := data["usage"].(map[string]any); ok {
		sr.Usage = &Usage{
			InputTokens:  toInt(u["inputTokens"]),
			OutputTokens: toInt(u["outputTokens"]),
		}
	}

	m.CurrentSessionID = sr.SessionID
	return sr, nil
}

// Resume continues an existing session with a new prompt.
func (m *Manager) Resume(sessionID, prompt string) (*StartResult, error) {
	// Re-register notification handlers (same as Start).
	m.client.OnNotification("bridge/session_event", func(n bridge.Notification) {
		ui.RenderEvent(n.Params)
	})
	m.client.OnNotification("bridge/tool_approval_requested", func(n bridge.Notification) {
		params := n.Params
		sid, _ := params["sessionId"].(string)
		rid, _ := params["requestId"].(string)

		if ui.PromptToolApproval(params) {
			m.client.Call("session.approveTool", map[string]any{
				"sessionId": sid,
				"requestId": rid,
			})
		} else {
			m.client.Call("session.rejectTool", map[string]any{
				"sessionId": sid,
				"requestId": rid,
				"message":   "Rejected by user",
			})
		}
	})

	params := map[string]any{
		"sessionId":     sessionID,
		"prompt":        prompt,
		"permissionMode": m.PermissionMode,
	}
	if m.CurrentModel != "" {
		params["model"] = m.CurrentModel
	}

	result, err := m.client.Call("session.resume", params)
	if err != nil {
		return nil, fmt.Errorf("session.resume: %w", err)
	}

	data, _ := result.(map[string]any)
	if data == nil {
		return nil, fmt.Errorf("unexpected session.resume response")
	}

	sr := &StartResult{
		SessionID: toString(data["sessionId"]),
		Status:    toString(data["status"]),
		Result:    data["result"],
	}
	if u, ok := data["usage"].(map[string]any); ok {
		sr.Usage = &Usage{
			InputTokens:  toInt(u["inputTokens"]),
			OutputTokens: toInt(u["outputTokens"]),
		}
	}

	m.CurrentSessionID = sr.SessionID
	return sr, nil
}

// Stop requests cooperative termination of the current session.
func (m *Manager) Stop() error {
	if m.CurrentSessionID == "" {
		return fmt.Errorf("no active session")
	}

	_, err := m.client.Call("session.stop", map[string]any{
		"sessionId": m.CurrentSessionID,
	})
	if err != nil {
		return fmt.Errorf("session.stop: %w", err)
	}
	m.CurrentSessionID = ""
	return nil
}

// List returns sessions from the bridge. If status is empty, all sessions are returned.
func (m *Manager) List(status string) (*SessionListResult, error) {
	params := map[string]any{}
	if status != "" {
		params["status"] = status
	}

	result, err := m.client.Call("session.list", params)
	if err != nil {
		return nil, fmt.Errorf("session.list: %w", err)
	}

	data, _ := result.(map[string]any)
	if data == nil {
		return nil, fmt.Errorf("unexpected session.list response")
	}

	slr := &SessionListResult{}
	if sessions, ok := data["sessions"].([]any); ok {
		for _, s := range sessions {
			if entry, ok := s.(map[string]any); ok {
				slr.Sessions = append(slr.Sessions, SessionEntry{
					SessionID:  toString(entry["sessionId"]),
					Status:     toString(entry["status"]),
					Workspace:  toString(entry["workspace"]),
					CreatedAt:  toString(entry["createdAt"]),
					UpdatedAt:  toString(entry["updatedAt"]),
					Prompt:     entry["prompt"],
				})
			}
		}
	}
	return slr, nil
}

// History retrieves the event history for a session.
func (m *Manager) History(sessionID string, offset, limit int) (*HistoryResult, error) {
	params := map[string]any{"sessionId": sessionID}
	if offset > 0 {
		params["offset"] = offset
	}
	if limit > 0 {
		params["limit"] = limit
	}

	result, err := m.client.Call("session.history", params)
	if err != nil {
		return nil, fmt.Errorf("session.history: %w", err)
	}

	data, _ := result.(map[string]any)
	if data == nil {
		return nil, fmt.Errorf("unexpected session.history response")
	}

	hr := &HistoryResult{
		SessionID: toString(data["sessionId"]),
		Total:     toInt(data["total"]),
	}
	if entries, ok := data["entries"].([]any); ok {
		hr.Entries = entries
	}
	return hr, nil
}

// Status retrieves the status of a session: calls session.status.
func (m *Manager) Status(sessionID string) (*StatusResult, error) {
	result, err := m.client.Call("session.status", map[string]any{
		"sessionId": sessionID,
	})
	if err != nil {
		return nil, fmt.Errorf("session.status: %w", err)
	}

	data, _ := result.(map[string]any)
	if data == nil {
		return nil, fmt.Errorf("unexpected session.status response")
	}

	return &StatusResult{
		SessionID:    toString(data["sessionId"]),
		Status:       toString(data["status"]),
		CreatedAt:    toString(data["createdAt"]),
		UpdatedAt:    toString(data["updatedAt"]),
		HistoryLength: toInt(data["historyLength"]),
		Result:       data["result"],
	}, nil
}

// Events retrieves buffered events for a session: calls session.events.
// since filters to events with seq >= since (default 0).
// limit caps the number of events returned (default 50, cap 500).
func (m *Manager) Events(sessionID string, since, limit int) (*EventsResult, error) {
	params := map[string]any{"sessionId": sessionID}
	if since > 0 {
		params["since"] = since
	}
	if limit > 0 {
		params["limit"] = limit
	}

	result, err := m.client.Call("session.events", params)
	if err != nil {
		return nil, fmt.Errorf("session.events: %w", err)
	}

	data, _ := result.(map[string]any)
	if data == nil {
		return nil, fmt.Errorf("unexpected session.events response")
	}

	er := &EventsResult{
		SessionID: toString(data["sessionId"]),
		Total:     toInt(data["total"]),
	}
	if events, ok := data["events"].([]any); ok {
		er.Events = events
	}
	return er, nil
}

// --- Helpers ---

func toString(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

func toInt(v any) int {
	if v == nil {
		return 0
	}
	switch n := v.(type) {
	case float64:
		return int(n)
	case int:
		return n
	}
	return 0
}

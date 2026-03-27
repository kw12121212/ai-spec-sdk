// Package workflow provides methods to list and execute spec-driven workflows
// via the bridge's workflow.run JSON-RPC method.
package workflow

import (
	"encoding/json"
	"fmt"
	"strings"

	"go-cli/bridge"
)

// Runner executes spec-driven workflows through the bridge.
type Runner struct {
	client bridge.Caller
}

// NewRunner creates a new workflow runner.
func NewRunner(client bridge.Caller) *Runner {
	return &Runner{client: client}
}

// AvailableWorkflows returns the list of supported workflow names from capabilities.
func (r *Runner) AvailableWorkflows() ([]string, error) {
	result, err := r.client.Call("bridge.capabilities", nil)
	if err != nil {
		return nil, fmt.Errorf("bridge.capabilities: %w", err)
	}

	data, _ := result.(map[string]any)
	if data == nil {
		return nil, fmt.Errorf("unexpected capabilities response")
	}

	var names []string
	if workflows, ok := data["workflows"].([]any); ok {
		for _, w := range workflows {
			if name, ok := w.(string); ok {
				names = append(names, name)
			}
		}
	}
	return names, nil
}

// WorkflowResult is the response from workflow.run.
type WorkflowResult struct {
	Success  bool   `json:"success"`
	Message  string `json:"message"`
	Artifact string `json:"artifact,omitempty"`
}

// Run executes a workflow with the given name and workspace path.
// Progress notifications from the bridge are printed to stdout.
func (r *Runner) Run(name, workspace string, args []string) (*WorkflowResult, error) {
	// Register a handler for workflow progress notifications.
	r.client.OnNotification("bridge/progress", func(n bridge.Notification) {
		pretty, _ := json.MarshalIndent(n.Params, "  ", "  ")
		fmt.Printf("  %s\n", strings.TrimSpace(string(pretty)))
	})

	params := map[string]any{
		"workspace": workspace,
		"workflow":  name,
	}
	if len(args) > 0 {
		// Convert args to []any for JSON-RPC.
		a := make([]any, len(args))
		for i, arg := range args {
			a[i] = arg
		}
		params["args"] = a
	}

	result, err := r.client.Call("workflow.run", params)
	if err != nil {
		return nil, fmt.Errorf("workflow.run: %w", err)
	}

	data, _ := result.(map[string]any)
	if data == nil {
		return nil, fmt.Errorf("unexpected workflow.run response")
	}

	wr := &WorkflowResult{}
	if success, ok := data["success"].(bool); ok {
		wr.Success = success
	}
	if msg, ok := data["message"].(string); ok {
		wr.Message = msg
	}
	if artifact, ok := data["artifact"].(string); ok {
		wr.Artifact = artifact
	}
	return wr, nil
}

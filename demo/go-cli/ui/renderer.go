// Package ui provides terminal rendering for session events,
// tool approval prompts, and multi-line input reading.
package ui

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

// Color codes for terminal output (ANSI escape sequences).
const (
	colorReset  = "\033[0m"
	colorBold   = "\033[1m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
	colorCyan   = "\033[36m"
	colorRed    = "\033[31m"
	colorDim    = "\033[2m"
)

// RenderEvent formats a session event notification for terminal display.
// The event is a map with "type", "messageType", "message", and other fields.
func RenderEvent(params map[string]any) {
	switch params["type"] {
	case "session_started":
		fmt.Printf("%s● Session started%s: %s\n", colorGreen, colorReset, params["sessionId"])

	case "session_resumed":
		fmt.Printf("%s● Session resumed%s: %s\n", colorGreen, colorReset, params["sessionId"])

	case "session_completed":
		result := params["result"]
		usage := params["usage"]
		fmt.Printf("%s● Session completed%s\n", colorGreen, colorReset)
		if usage != nil {
			if u, ok := usage.(map[string]any); ok {
				fmt.Printf("  %sTokens:%s input=%v output=%v\n", colorDim, colorReset,
					u["inputTokens"], u["outputTokens"])
			}
		}
		if result != nil {
			fmt.Printf("  %sResult:%s %v\n", colorDim, colorReset, truncate(fmt.Sprintf("%v", result), 200))
		}

	case "session_stopped":
		fmt.Printf("%s● Session stopped%s: %s\n", colorYellow, colorReset, params["status"])

	case "agent_message":
		renderAgentMessage(params)
	}
}

func renderAgentMessage(params map[string]any) {
	messageType, _ := params["messageType"].(string)
	msg, _ := params["message"].(map[string]any)

	switch messageType {
	case "system_init":
		// System init message carries model and session info.
		model, _ := msg["model"].(string)
		sessionID, _ := msg["session_id"].(string)
		fmt.Printf("%s%sConnected%s — model: %s, session: %s\n", colorBold, colorCyan, colorReset, model, sessionID)

	case "assistant_text":
		// Text response from Claude. Extract text from nested content blocks.
		text := extractText(msg)
		if text != "" {
			fmt.Println()
			fmt.Println(text)
		}

	case "tool_use":
		// Claude wants to call a tool. Show tool name and input summary.
		name, input := extractToolUse(msg)
		fmt.Printf("\n%s⚡ Tool:%s %s\n", colorYellow, colorReset, name)
		prettyInput := prettyPrint(input)
		for _, line := range strings.Split(prettyInput, "\n") {
			fmt.Printf("  %s%s\n", colorDim, line)
		}

	case "tool_result":
		// Result from a tool execution. Show a brief summary.
		resultStr := extractToolResult(msg)
		lines := strings.Split(resultStr, "\n")
		if len(lines) > 5 {
			fmt.Printf("  %s%s\n", colorDim, strings.Join(lines[:5], "\n"))
			fmt.Printf("  %s... (%d more lines)%s\n", colorDim, len(lines)-5, colorReset)
		} else {
			for _, line := range lines {
				fmt.Printf("  %s%s\n", colorDim, line)
			}
		}

	case "result":
		subtype, _ := msg["subtype"].(string)
		result, _ := msg["result"].(string)
		if subtype == "error" {
			fmt.Printf("\n%s✗ Error:%s %s\n", colorRed, colorReset, result)
		} else {
			fmt.Printf("\n%s✓ Done%s\n", colorGreen, colorReset)
		}

	default:
		// Forward unrecognized messages as-is.
		fmt.Printf("\n%s[%s]%s %v\n", colorDim, messageType, colorReset, truncate(fmt.Sprintf("%v", msg), 200))
	}
}

// PromptToolApproval prints a tool approval request and asks the user for a decision.
// Returns true if approved, false if rejected.
func PromptToolApproval(params map[string]any) bool {
	toolName, _ := params["toolName"].(string)
	input := params["input"]
	title, _ := params["title"].(string)
	displayName, _ := params["displayName"].(string)
	description, _ := params["description"].(string)

	fmt.Println()
	if displayName != "" {
		fmt.Printf("%s%s%s wants to use tool:%s %s\n", colorBold, colorYellow, displayName, colorReset, toolName)
	} else if title != "" {
		fmt.Printf("%s%s%s\n", colorBold, colorYellow, title+colorReset)
		fmt.Printf("  Tool: %s\n", toolName)
	} else {
		fmt.Printf("%s⚡ Tool approval required:%s %s\n", colorYellow, colorReset, toolName)
	}

	if description != "" {
		fmt.Printf("  %s%s%s\n", colorDim, description, colorReset)
	}

	if input != nil {
		fmt.Printf("  %sInput:%s\n", colorDim, colorReset)
		pretty := prettyPrint(input)
		for _, line := range strings.Split(pretty, "\n") {
			fmt.Printf("    %s%s\n", colorDim, line)
		}
	}

	fmt.Printf("  %sApprove?%s [y/N]: ", colorBold, colorReset)
	reader := bufio.NewReader(os.Stdin)
	answer, _ := reader.ReadString('\n')
	answer = strings.TrimSpace(strings.ToLower(answer))
	return answer == "y" || answer == "yes"
}

// ReadMultiLine reads user input from stdin, supporting multi-line continuation
// via a trailing backslash. If a line ends with '\', the next line is appended
// (with the backslash and newline removed).
// Returns the input string and whether EOF was reached.
func ReadMultiLine(prompt string) (string, bool) {
	fmt.Print(prompt)
	reader := bufio.NewReader(os.Stdin)

	var lines []string
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			// EOF (Ctrl+D) — return what we have.
			line = strings.TrimRight(line, "\n")
			if line != "" {
				lines = append(lines, line)
			}
			return strings.Join(lines, "\n"), true
		}

		line = strings.TrimRight(line, "\n")

		// Check for continuation: trailing backslash.
		if trimmed, ok := strings.CutSuffix(line, "\\"); ok {
			// Remove the backslash and continue reading.
			lines = append(lines, trimmed)
			// Show continuation prompt.
			fmt.Print("> ")
			continue
		}

		lines = append(lines, line)
		break
	}

	return strings.Join(lines, "\n"), false
}

// --- Helper functions ---

func extractText(msg map[string]any) string {
	content := getContentArray(msg)
	for _, block := range content {
		if b, ok := block.(map[string]any); ok && b["type"] == "text" {
			if text, ok := b["text"].(string); ok {
				return text
			}
		}
	}
	return ""
}

func extractToolUse(msg map[string]any) (name string, input any) {
	content := getContentArray(msg)
	for _, block := range content {
		if b, ok := block.(map[string]any); ok && b["type"] == "tool_use" {
			if n, ok := b["name"].(string); ok {
				name = n
			}
			input = b["input"]
			return
		}
	}
	return
}

func extractToolResult(msg map[string]any) string {
	content := getContentArray(msg)
	for _, block := range content {
		if b, ok := block.(map[string]any); ok && b["type"] == "tool_result" {
			// The result content may be a string or nested content blocks.
			if content, ok := b["content"].(string); ok {
				return content
			}
			// Fallback: JSON-encode the content.
			data, _ := json.Marshal(b["content"])
			return string(data)
		}
	}
	return ""
}

// getContentArray extracts the content array from a message.
// The SDK may nest the content under a "message" key or place it at the top level.
func getContentArray(msg map[string]any) []any {
	// Try nested message.content first (standard SDK format).
	if inner, ok := msg["message"].(map[string]any); ok {
		if content, ok := inner["content"].([]any); ok {
			return content
		}
	}
	// Fallback to top-level content.
	if content, ok := msg["content"].([]any); ok {
		return content
	}
	return nil
}

func prettyPrint(v any) string {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Sprintf("%v", v)
	}
	return string(data)
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

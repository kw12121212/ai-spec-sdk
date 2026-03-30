// go-cli is an example CLI that demonstrates how to integrate with ai-spec-sdk
// via its stdio JSON-RPC bridge. It provides an interactive REPL for free-form
// conversation with Claude, similar to a simplified Claude Code.
//
// Usage:
//
//	go build -o ai-cli && ./ai-cli --workspace /path/to/project
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"go-cli/bridge"
	"go-cli/session"
	"go-cli/ui"
	"go-cli/workflow"
)

const (
	// colorReset resets all terminal styling.
	colorReset = "\033[0m"
	// colorBold sets bold text.
	colorBold = "\033[1m"
	// colorCyan sets cyan text.
	colorCyan = "\033[36m"
	// colorDim sets dim text.
	colorDim = "\033[2m"
)

func main() {
	// Parse CLI flags.
	bridgePath := flag.String("bridge", "", "Path to ai-spec-bridge CLI (e.g. ../../dist/src/cli.js)")
	workspace := flag.String("workspace", ".", "Workspace directory for agent sessions")
	model := flag.String("model", "claude-sonnet-4-6", "Claude model to use")
	permMode := flag.String("permission-mode", "approve", "Tool permission mode (default, acceptEdits, bypassPermissions, approve)")
	flag.Parse()

	// Resolve bridge path: flag > default (../../dist/src/cli.js relative to this binary).
	bp := *bridgePath
	if bp == "" {
		exe, err := os.Executable()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error resolving executable: %v\n", err)
			os.Exit(1)
		}
		exeDir := filepath.Dir(exe)
		bp = filepath.Join(exeDir, "..", "..", "dist", "src", "cli.js")
	}

	// Validate workspace.
	absWorkspace, err := filepath.Abs(*workspace)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error resolving workspace: %v\n", err)
		os.Exit(1)
	}
	if _, err := os.Stat(absWorkspace); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "Workspace does not exist: %s\n", absWorkspace)
		os.Exit(1)
	}

	// Start the bridge subprocess.
	client, err := bridge.New(bp)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error starting bridge: %v\n", err)
		os.Exit(1)
	}
	defer client.Close()

	// Verify bridge is responsive by calling bridge.ping.
	pingResult, err := client.Call("bridge.ping", nil)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Bridge ping failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("%s%sai-spec-cli%s — connected to bridge\n", colorBold, colorCyan, colorReset)
	if data, ok := pingResult.(map[string]any); ok {
		fmt.Printf("  ping: %v, ts: %v\n", data["pong"], data["ts"])
	}
	fmt.Printf("  workspace: %s\n", absWorkspace)
	fmt.Printf("  model: %s\n", *model)
	fmt.Printf("  permission: %s\n", *permMode)
	fmt.Println()
	fmt.Printf("Type a message to chat with Claude. Use %s/help%s for commands.\n\n", colorBold, colorReset)

	// Create managers.
	sm := session.NewManager(client, absWorkspace, *model, *permMode)
	wr := workflow.NewRunner(client)

	// REPL loop.
	for {
		input, eof := ui.ReadMultiLine("> ")
		if eof {
			break
		}
		if input == "" {
			continue
		}

		// Dispatch slash commands.
		if strings.HasPrefix(input, "/") {
			if handleCommand(client, sm, wr, absWorkspace, input) {
				// /quit returns true.
				return
			}
			continue
		}

		// Regular prompt: start a new session or resume the existing one.
		if sm.CurrentSessionID != "" {
			// Resume the existing session with the new prompt.
			_, err := sm.Resume(sm.CurrentSessionID, input)
			if err != nil {
				fmt.Fprintf(os.Stderr, "%sError:%s %v\n", "\033[31m", colorReset, err)
				sm.CurrentSessionID = ""
			}
		} else {
			// Start a new session.
			_, err := sm.Start(input)
			if err != nil {
				fmt.Fprintf(os.Stderr, "%sError:%s %v\n", "\033[31m", colorReset, err)
			}
		}
		fmt.Println()
	}
}

// handleCommand dispatches a slash command. Returns true if the CLI should exit.
func handleCommand(client *bridge.Client, sm *session.Manager, wr *workflow.Runner, absWorkspace string, input string) bool {
	parts := strings.Fields(input)
	cmd := parts[0]
	args := parts[1:]

	switch cmd {
	case "/help":
		printHelp()

	case "/quit", "/exit":
		fmt.Println("Goodbye!")
		return true

	case "/ping":
		// Health check: calls bridge.ping.
		result, err := client.Call("bridge.ping", nil)
		if err != nil {
			fmt.Printf("Ping failed: %v\n", err)
		} else {
			pretty, _ := json.MarshalIndent(result, "", "  ")
			fmt.Println(string(pretty))
		}

	case "/capabilities":
		// Show bridge capabilities: calls bridge.capabilities.
		result, err := client.Call("bridge.capabilities", nil)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
		} else {
			pretty, _ := json.MarshalIndent(result, "", "  ")
			fmt.Println(string(pretty))
		}

	case "/models":
		// List available models: calls models.list.
		result, err := client.Call("models.list", nil)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
		} else {
			pretty, _ := json.MarshalIndent(result, "", "  ")
			fmt.Println(string(pretty))
		}

	case "/model":
		// Switch the Claude model for subsequent sessions.
		if len(args) == 0 {
			fmt.Printf("Current model: %s\nUsage: /model <model-id>\n", sm.CurrentModel)
			return false
		}
		sm.CurrentModel = args[0]
		fmt.Printf("Model set to: %s\n", sm.CurrentModel)

	case "/tools":
		// List available tools: calls tools.list.
		result, err := client.Call("tools.list", nil)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
		} else {
			pretty, _ := json.MarshalIndent(result, "", "  ")
			fmt.Println(string(pretty))
		}

	case "/sessions":
		// List sessions: calls session.list.
		status := ""
		if len(args) > 0 {
			status = args[0]
		}
		result, err := sm.List(status)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
		} else if len(result.Sessions) == 0 {
			fmt.Println("No sessions found.")
		} else {
			pretty, _ := json.MarshalIndent(result.Sessions, "", "  ")
			fmt.Println(string(pretty))
		}

	case "/resume":
		// Resume an existing session.
		if len(args) == 0 {
			if sm.CurrentSessionID != "" {
				fmt.Printf("Current session: %s\nUsage: /resume <session-id> to switch sessions\n", sm.CurrentSessionID)
			} else {
				fmt.Println("No current session. Usage: /resume <session-id>")
			}
			return false
		}
		sm.CurrentSessionID = args[0]
		fmt.Printf("Switched to session: %s\n", sm.CurrentSessionID)
		fmt.Println("Send a message to resume the conversation.")

	case "/history":
		// Show current session history: calls session.history.
		sid := sm.CurrentSessionID
		if len(args) > 0 {
			sid = args[0]
		}
		if sid == "" {
			fmt.Println("No session selected. Start a session or use /resume <id>.")
			return false
		}
		result, err := sm.History(sid, 0, 0)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
		} else {
			pretty, _ := json.MarshalIndent(result.Entries, "", "  ")
			fmt.Printf("Session %s — %d entries:\n%s\n", sid, result.Total, string(pretty))
		}

	case "/workspace":
		// Register a workspace: calls workspace.register.
		if len(args) == 0 {
			fmt.Printf("Current workspace: %s\nUsage: /workspace <path>\n", sm.CurrentWorkspace)
			return false
		}
		path := args[0]
		result, err := client.Call("workspace.register", map[string]any{"workspace": path})
		if err != nil {
			fmt.Printf("Error: %v\n", err)
		} else {
			pretty, _ := json.MarshalIndent(result, "", "  ")
			fmt.Println(string(pretty))
		}

	case "/workspaces":
		// List registered workspaces: calls workspace.list.
		result, err := client.Call("workspace.list", nil)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
		} else {
			pretty, _ := json.MarshalIndent(result, "", "  ")
			fmt.Println(string(pretty))
		}

	case "/workflow":
		// Run a workflow: calls workflow.run.
		if len(args) == 0 {
			// No workflow name specified — list available workflows.
			names, err := wr.AvailableWorkflows()
			if err != nil {
				fmt.Printf("Error: %v\n", err)
			} else {
				fmt.Printf("Available workflows: %s\n", strings.Join(names, ", "))
			}
			return false
		}
		name := args[0]
		fmt.Printf("Running workflow: %s\n", name)
		result, err := wr.Run(name, sm.CurrentWorkspace, args[1:])
		if err != nil {
			fmt.Printf("Error: %v\n", err)
		} else {
			fmt.Printf("Success: %v\n", result.Success)
			if result.Message != "" {
				fmt.Printf("Message: %s\n", result.Message)
			}
			if result.Artifact != "" {
				fmt.Printf("Artifact: %s\n", result.Artifact)
			}
		}

	case "/permission":
		// Switch permission mode.
		if len(args) == 0 {
			fmt.Printf("Current permission mode: %s\nUsage: /permission <default|acceptEdits|bypassPermissions|approve>\n", sm.PermissionMode)
			return false
		}
		sm.PermissionMode = args[0]
		fmt.Printf("Permission mode set to: %s\n", sm.PermissionMode)

	case "/stop":
		// Stop the current session: calls session.stop.
		err := sm.Stop()
		if err != nil {
			fmt.Printf("Error: %v\n", err)
		} else {
			fmt.Println("Session stopped.")
		}

	case "/status":
		// Show session status: calls session.status.
		sid := sm.CurrentSessionID
		if len(args) > 0 {
			sid = args[0]
		}
		if sid == "" {
			fmt.Println("No session selected. Start a session or use /resume <id>.")
			return false
		}
		result, err := sm.Status(sid)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
		} else {
			pretty, _ := json.MarshalIndent(result, "", "  ")
			fmt.Println(string(pretty))
		}

	case "/events":
		// Show buffered session events: calls session.events.
		sid := sm.CurrentSessionID
		if len(args) > 0 {
			sid = args[0]
		}
		if sid == "" {
			fmt.Println("No session selected. Start a session or use /resume <id>.")
			return false
		}
		result, err := sm.Events(sid, 0, 0)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
		} else {
			pretty, _ := json.MarshalIndent(result.Events, "", "  ")
			fmt.Printf("Session %s — %d buffered events:\n%s\n", sid, result.Total, string(pretty))
		}

	case "/skills":
		// List built-in spec-driven skills: calls skills.list.
		result, err := client.Call("skills.list", nil)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
		} else {
			pretty, _ := json.MarshalIndent(result, "", "  ")
			fmt.Println(string(pretty))
		}

	case "/mcp":
		// MCP server management.
		if len(args) == 0 {
			// List MCP servers for the workspace.
			result, err := client.Call("mcp.list", map[string]any{"workspace": absWorkspace})
			if err != nil {
				fmt.Printf("Error: %v\n", err)
			} else {
				pretty, _ := json.MarshalIndent(result, "", "  ")
				fmt.Println(string(pretty))
			}
			return false
		}
		switch args[0] {
		case "add":
			if len(args) < 3 {
				fmt.Println("Usage: /mcp add <name> <command> [args...]")
				return false
			}
			mcpArgs := []string{}
			if len(args) > 3 {
				mcpArgs = args[3:]
			}
			result, err := client.Call("mcp.add", map[string]any{
				"workspace": absWorkspace,
				"name":      args[1],
				"command":   args[2],
				"args":      mcpArgs,
			})
			if err != nil {
				fmt.Printf("Error: %v\n", err)
			} else {
				pretty, _ := json.MarshalIndent(result, "", "  ")
				fmt.Printf("MCP server added:\n%s\n", string(pretty))
			}
		case "remove":
			if len(args) < 2 {
				fmt.Println("Usage: /mcp remove <name>")
				return false
			}
			result, err := client.Call("mcp.remove", map[string]any{
				"workspace": absWorkspace,
				"name":      args[1],
			})
			if err != nil {
				fmt.Printf("Error: %v\n", err)
			} else {
				pretty, _ := json.MarshalIndent(result, "", "  ")
				fmt.Println(string(pretty))
			}
		case "start":
			if len(args) < 2 {
				fmt.Println("Usage: /mcp start <name>")
				return false
			}
			result, err := client.Call("mcp.start", map[string]any{
				"workspace": absWorkspace,
				"name":      args[1],
			})
			if err != nil {
				fmt.Printf("Error: %v\n", err)
			} else {
				pretty, _ := json.MarshalIndent(result, "", "  ")
				fmt.Println(string(pretty))
			}
		case "stop":
			if len(args) < 2 {
				fmt.Println("Usage: /mcp stop <name>")
				return false
			}
			result, err := client.Call("mcp.stop", map[string]any{
				"workspace": absWorkspace,
				"name":      args[1],
			})
			if err != nil {
				fmt.Printf("Error: %v\n", err)
			} else {
				pretty, _ := json.MarshalIndent(result, "", "  ")
				fmt.Println(string(pretty))
			}
		default:
			fmt.Printf("Unknown MCP subcommand: %s\nUse: /mcp [add|remove|start|stop] or /mcp to list\n", args[0])
		}

	case "/config":
		// Configuration management.
		if len(args) == 0 {
			// List all config.
			result, err := client.Call("config.list", map[string]any{"workspace": absWorkspace})
			if err != nil {
				fmt.Printf("Error: %v\n", err)
			} else {
				pretty, _ := json.MarshalIndent(result, "", "  ")
				fmt.Println(string(pretty))
			}
			return false
		}
		switch args[0] {
		case "get":
			if len(args) < 2 {
				fmt.Println("Usage: /config get <key>")
				return false
			}
			result, err := client.Call("config.get", map[string]any{
				"key":       args[1],
				"workspace": absWorkspace,
			})
			if err != nil {
				fmt.Printf("Error: %v\n", err)
			} else {
				pretty, _ := json.MarshalIndent(result, "", "  ")
				fmt.Println(string(pretty))
			}
		case "set":
			if len(args) < 4 {
				fmt.Println("Usage: /config set <key> <value> <project|user>")
				return false
			}
			var value any = args[2]
			// Try to parse as number or bool for non-string values.
			if n, err := strconv.Atoi(args[2]); err == nil {
				value = n
			} else if b, err := strconv.ParseBool(args[2]); err == nil {
				value = b
			}
			result, err := client.Call("config.set", map[string]any{
				"key":       args[1],
				"value":     value,
				"scope":     args[3],
				"workspace": absWorkspace,
			})
			if err != nil {
				fmt.Printf("Error: %v\n", err)
			} else {
				pretty, _ := json.MarshalIndent(result, "", "  ")
				fmt.Println(string(pretty))
			}
		default:
			fmt.Printf("Unknown config subcommand: %s\nUse: /config [get|set] or /config to list\n", args[0])
		}

	case "/hooks":
		// Hooks management.
		if len(args) == 0 {
			result, err := client.Call("hooks.list", map[string]any{"workspace": absWorkspace})
			if err != nil {
				fmt.Printf("Error: %v\n", err)
			} else {
				pretty, _ := json.MarshalIndent(result, "", "  ")
				fmt.Println(string(pretty))
			}
			return false
		}
		switch args[0] {
		case "add":
			if len(args) < 4 {
				fmt.Println("Usage: /hooks add <event> <command> <project|user> [matcher]")
				return false
			}
			params := map[string]any{
				"event":   args[1],
				"command": args[2],
				"scope":   args[3],
			}
			if len(args) > 4 {
				params["matcher"] = args[4]
			}
			params["workspace"] = absWorkspace
			result, err := client.Call("hooks.add", params)
			if err != nil {
				fmt.Printf("Error: %v\n", err)
			} else {
				pretty, _ := json.MarshalIndent(result, "", "  ")
				fmt.Printf("Hook added:\n%s\n", string(pretty))
			}
		case "remove":
			if len(args) < 2 {
				fmt.Println("Usage: /hooks remove <hook-id>")
				return false
			}
			result, err := client.Call("hooks.remove", map[string]any{"hookId": args[1]})
			if err != nil {
				fmt.Printf("Error: %v\n", err)
			} else {
				pretty, _ := json.MarshalIndent(result, "", "  ")
				fmt.Println(string(pretty))
			}
		default:
			fmt.Printf("Unknown hooks subcommand: %s\nUse: /hooks [add|remove] or /hooks to list\n", args[0])
		}

	case "/context":
		// Context file management.
		if len(args) == 0 {
			// List context files.
			result, err := client.Call("context.list", map[string]any{"workspace": absWorkspace})
			if err != nil {
				fmt.Printf("Error: %v\n", err)
			} else {
				pretty, _ := json.MarshalIndent(result, "", "  ")
				fmt.Println(string(pretty))
			}
			return false
		}
		switch args[0] {
		case "read":
			if len(args) < 3 {
				fmt.Println("Usage: /context read <project|user> <path>")
				return false
			}
			params := map[string]any{
				"scope": args[1],
				"path":  args[2],
			}
			if args[1] == "project" {
				params["workspace"] = absWorkspace
			}
			result, err := client.Call("context.read", params)
			if err != nil {
				fmt.Printf("Error: %v\n", err)
			} else {
				pretty, _ := json.MarshalIndent(result, "", "  ")
				fmt.Println(string(pretty))
			}
		case "write":
			if len(args) < 4 {
				fmt.Println("Usage: /context write <project|user> <path> <content>")
				return false
			}
			params := map[string]any{
				"scope":   args[1],
				"path":    args[2],
				"content": strings.Join(args[3:], " "),
			}
			if args[1] == "project" {
				params["workspace"] = absWorkspace
			}
			result, err := client.Call("context.write", params)
			if err != nil {
				fmt.Printf("Error: %v\n", err)
			} else {
				pretty, _ := json.MarshalIndent(result, "", "  ")
				fmt.Println(string(pretty))
			}
		default:
			fmt.Printf("Unknown context subcommand: %s\nUse: /context [read|write] or /context to list\n", args[0])
		}

	case "/branch":
		// Branch a session.
		sid := sm.CurrentSessionID
		if len(args) > 0 {
			sid = args[0]
		}
		if sid == "" {
			fmt.Println("No session to branch from. Start a session or provide a session ID.")
			return false
		}
		params := map[string]any{"sessionId": sid}
		if len(args) > 1 {
			// args[1] = fromIndex
			if n, err := strconv.Atoi(args[1]); err == nil {
				params["fromIndex"] = n
			}
		}
		if len(args) > 2 {
			params["prompt"] = strings.Join(args[2:], " ")
		}
		result, err := client.Call("session.branch", params)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
		} else {
			pretty, _ := json.MarshalIndent(result, "", "  ")
			fmt.Printf("Branched session:\n%s\n", string(pretty))
		}

	case "/search":
		// Search across sessions.
		if len(args) == 0 {
			fmt.Println("Usage: /search <query> [workspace] [status]")
			return false
		}
		params := map[string]any{"query": args[0]}
		if len(args) > 1 {
			params["workspace"] = args[1]
		}
		if len(args) > 2 {
			params["status"] = args[2]
		}
		result, err := client.Call("session.search", params)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
		} else {
			pretty, _ := json.MarshalIndent(result, "", "  ")
			fmt.Println(string(pretty))
		}

	default:
		fmt.Printf("Unknown command: %s\nType /help for available commands.\n", cmd)
	}
	return false
}

func printHelp() {
	help := `
%sai-spec-cli — Example CLI for ai-spec-sdk%s

%sCommands:%s
  %s/help%s                          Show this help message
  %s/quit%s, %s/exit%s                    Exit the CLI

%sSession:%s
  %s/sessions%s [active|all]           List sessions (default: all)
  %s/resume%s <session-id>            Switch to a session
  %s/stop%s                          Stop the current session
  %s/status%s [session-id]           Show session status
  %s/history%s [session-id]           Show session history
  %s/events%s [session-id]            Show buffered session events
  %s/permission%s <mode>              Set tool permission mode

%sBridge:%s
  %s/ping%s                          Health check
  %s/capabilities%s                  Show bridge capabilities
  %s/skills%s                        List built-in spec-driven skills

%sConfiguration:%s
  %s/model%s <model-id>               Switch Claude model
  %s/models%s                        List available models
  %s/tools%s                         List available tools
  %s/workspace%s <path>              Register a workspace
  %s/workspaces%s                    List registered workspaces
  %s/config%s [get|set]              Manage configuration
  %s/hooks%s [add|remove]             Manage automation hooks

%sMCP:%s
  %s/mcp%s [add|remove|start|stop]   Manage MCP servers
  %s/mcp add%s <name> <cmd> [args]   Add and start an MCP server
  %s/mcp stop%s <name>              Stop an MCP server

%sContext:%s
  %s/context%s [read|write]           List/read/write context files
  %s/context read%s <scope> <path>   Read a context file
  %s/context write%s <scope> <path> <content>  Write a context file

%sSession UX:%s
  %s/branch%s [session-id] [from-idx] [prompt]  Branch a session
  %s/search%s <query> [workspace] [status]  Search sessions

%sWorkflow:%s
  %s/workflow%s [name] [args...]      Run a workflow (no name = list available)

%sInput:%s
  Any text not starting with '/' is sent as a prompt to Claude.
  Use trailing %s\\%s for multi-line input.

`
	fmt.Printf(help,
		colorBold, colorReset, // title
		colorBold, colorReset, // Commands:
		colorCyan, colorReset, // /help
		colorCyan, colorReset, colorCyan, colorReset, // /quit, /exit
		colorBold, colorReset, // Session:
		colorCyan, colorReset, colorCyan, colorReset, colorCyan, colorReset, colorCyan, colorReset, colorCyan, colorReset, colorCyan, colorReset, colorCyan, colorReset, // 7 session cmds
		colorBold, colorReset, // Bridge:
		colorCyan, colorReset, colorCyan, colorReset, colorCyan, colorReset, // 3 bridge cmds
		colorBold, colorReset, // Configuration:
		colorCyan, colorReset, colorCyan, colorReset, colorCyan, colorReset, colorCyan, colorReset, colorCyan, colorReset, colorCyan, colorReset, colorCyan, colorReset, // 7 config cmds
		colorBold, colorReset, // MCP:
		colorCyan, colorReset, colorCyan, colorReset, colorCyan, colorReset, // 3 mcp cmds
		colorBold, colorReset, // Context:
		colorCyan, colorReset, colorCyan, colorReset, colorCyan, colorReset, // 3 context cmds
		colorBold, colorReset, // Session UX:
		colorCyan, colorReset, colorCyan, colorReset, // 2 session ux cmds
		colorBold, colorReset, // Workflow:
		colorCyan, colorReset, // /workflow
		colorBold, colorReset, // Input:
		colorBold, colorReset, // \\
	)
}

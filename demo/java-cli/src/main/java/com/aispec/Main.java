package com.aispec;

import com.aispec.bridge.JsonRpcClient;
import com.aispec.session.Session;
import com.aispec.session.SessionManager;
import com.aispec.ui.MultiLineReader;
import com.aispec.ui.TerminalRenderer;
import com.aispec.workflow.WorkflowRunner;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;

/**
 * Java CLI entry point for ai-spec-sdk integration.
 * Provides an interactive REPL for free-form conversation with Claude.
 */
public class Main {

    // ANSI color codes
    private static final String RESET = "\033[0m";
    private static final String BOLD = "\033[1m";
    private static final String CYAN = "\033[36m";
    private static final String DIM = "\033[2m";

    public static void main(String[] args) {
        // Parse arguments
        String bridgePath = null;
        String workspace = ".";
        String model = "claude-sonnet-4-6";
        String permissionMode = "approve";

        for (int i = 0; i < args.length; i++) {
            switch (args[i]) {
                case "--bridge" -> {
                    if (i + 1 < args.length) bridgePath = args[++i];
                }
                case "--workspace" -> {
                    if (i + 1 < args.length) workspace = args[++i];
                }
                case "--model" -> {
                    if (i + 1 < args.length) model = args[++i];
                }
                case "--permission-mode" -> {
                    if (i + 1 < args.length) permissionMode = args[++i];
                }
                case "--help", "-h" -> {
                    printUsage();
                    return;
                }
            }
        }

        // Resolve bridge path
        if (bridgePath == null) {
            // Default: ../../dist/src/cli.js relative to this class
            Path classPath = Paths.get(Main.class.getProtectionDomain()
                .getCodeSource().getLocation().getPath()).getParent();
            bridgePath = classPath.resolve(Paths.get("..", "..", "dist", "src", "cli.js"))
                .normalize().toString();
        }

        // Validate workspace
        Path workspacePath = Paths.get(workspace).toAbsolutePath().normalize();
        if (!Files.exists(workspacePath)) {
            System.err.println("Error: Workspace does not exist: " + workspacePath);
            System.exit(1);
        }
        if (!Files.isDirectory(workspacePath)) {
            System.err.println("Error: Workspace is not a directory: " + workspacePath);
            System.exit(1);
        }

        // Validate bridge path
        if (!Files.exists(Paths.get(bridgePath))) {
            System.err.println("Error: Bridge not found at: " + bridgePath);
            System.err.println("Please build the bridge first with 'bun run build'");
            System.exit(1);
        }

        // Start the bridge
        JsonRpcClient client;
        try {
            client = new JsonRpcClient(bridgePath);
        } catch (IOException e) {
            System.err.println("Error starting bridge: " + e.getMessage());
            System.exit(1);
            return;
        }

        // Verify bridge is responsive
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> pingResult = (Map<String, Object>) client.call("bridge.ping", null);

            System.out.printf("%s%sai-spec-cli%s — connected to bridge%n",
                BOLD, CYAN, RESET);
            if (pingResult != null) {
                System.out.printf("  ping: %s, ts: %s%n",
                    pingResult.get("pong"), pingResult.get("ts"));
            }
            System.out.printf("  workspace: %s%n", workspacePath);
            System.out.printf("  model: %s%n", model);
            System.out.printf("  permission: %s%n", permissionMode);
            System.out.println();
            System.out.printf("Type a message to chat with Claude. Use %s/help%s for commands.%n%n",
                BOLD, RESET);
        } catch (Exception e) {
            System.err.println("Error: Bridge ping failed: " + e.getMessage());
            client.close();
            System.exit(1);
            return;
        }

        // Create managers
        SessionManager sessionManager = new SessionManager(client, workspacePath.toString(), model, permissionMode);
        WorkflowRunner workflowRunner = new WorkflowRunner(client);
        MultiLineReader reader = new MultiLineReader();

        // REPL loop
        boolean running = true;
        while (running) {
            String input;
            try {
                input = reader.readMultiLine("> ");
            } catch (IOException e) {
                System.err.println("Error reading input: " + e.getMessage());
                break;
            }

            if (input == null) {
                // EOF
                break;
            }

            input = input.trim();
            if (input.isEmpty()) {
                continue;
            }

            // Check for commands
            if (input.startsWith("/")) {
                String[] parts = input.substring(1).split("\\s+", 2);
                String command = parts[0];
                String arg = parts.length > 1 ? parts[1] : null;

                switch (command) {
                    case "help" -> printHelp();
                    case "quit", "exit" -> running = false;
                    case "ping" -> {
                        try {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> result = (Map<String, Object>) client.call("bridge.ping", null);
                            System.out.println("pong: " + result.get("pong"));
                        } catch (Exception e) {
                            System.err.println("Ping failed: " + e.getMessage());
                        }
                    }
                    case "capabilities" -> {
                        try {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> caps = (Map<String, Object>) client.call("bridge.capabilities", null);
                            System.out.println("Capabilities:");
                            System.out.println("  methods: " + caps.get("methods"));
                            System.out.println("  notifications: " + caps.get("notifications"));
                            System.out.println("  workflows: " + caps.get("workflows"));
                        } catch (Exception e) {
                            System.err.println("Error: " + e.getMessage());
                        }
                    }
                    case "models" -> {
                        try {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> result = (Map<String, Object>) client.call("models.list", null);
                            @SuppressWarnings("unchecked")
                            List<String> models = (List<String>) result.get("models");
                            System.out.println("Available models:");
                            for (String m : models) {
                                String marker = m.equals(sessionManager.getCurrentModel()) ? " *" : "";
                                System.out.println("  " + m + marker);
                            }
                        } catch (Exception e) {
                            System.err.println("Error: " + e.getMessage());
                        }
                    }
                    case "tools" -> {
                        try {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> result = (Map<String, Object>) client.call("tools.list", null);
                            @SuppressWarnings("unchecked")
                            List<Map<String, Object>> tools = (List<Map<String, Object>>) result.get("tools");
                            System.out.println("Available tools:");
                            for (Map<String, Object> tool : tools) {
                                System.out.println("  " + tool.get("name") + " - " + tool.get("description"));
                            }
                        } catch (Exception e) {
                            System.err.println("Error: " + e.getMessage());
                        }
                    }
                    case "sessions" -> {
                        try {
                            String status = arg != null ? arg : "all";
                            List<Session> sessions = sessionManager.list(status);
                            System.out.println("Sessions:");
                            for (Session s : sessions) {
                                String marker = s.getSessionId().equals(sessionManager.getCurrentSessionId()) ? " *" : "";
                                System.out.printf("  %s [%s]%s%n",
                                    s.getSessionId(), s.getStatus(), marker);
                            }
                        } catch (Exception e) {
                            System.err.println("Error: " + e.getMessage());
                        }
                    }
                    case "resume" -> {
                        if (arg == null) {
                            System.err.println("Usage: /resume <session-id>");
                        } else {
                            sessionManager.setCurrentSessionId(arg);
                            System.out.println("Switched to session: " + arg);
                        }
                    }
                    case "history" -> {
                        try {
                            String sessionId = arg != null ? arg : sessionManager.getCurrentSessionId();
                            if (sessionId == null) {
                                System.err.println("No active session. Use /history <session-id> or start a session first.");
                            } else {
                                SessionManager.HistoryResult history = sessionManager.history(sessionId, 0, 50);
                                System.out.println("History for " + sessionId + " (" + history.getTotal() + " total):");
                                for (Object entry : history.getEntries()) {
                                    System.out.println("  " + entry);
                                }
                            }
                        } catch (Exception e) {
                            System.err.println("Error: " + e.getMessage());
                        }
                    }
                    case "permission" -> {
                        if (arg == null) {
                            System.out.println("Current permission mode: " + sessionManager.getPermissionMode());
                        } else {
                            sessionManager.setPermissionMode(arg);
                            System.out.println("Permission mode set to: " + arg);
                        }
                    }
                    case "workspace" -> {
                        if (arg == null) {
                            System.err.println("Usage: /workspace <path>");
                        } else {
                            Path newWorkspace = Paths.get(arg).toAbsolutePath().normalize();
                            if (!Files.exists(newWorkspace) || !Files.isDirectory(newWorkspace)) {
                                System.err.println("Error: Invalid workspace: " + arg);
                            } else {
                                sessionManager.setCurrentWorkspace(newWorkspace.toString());
                                System.out.println("Workspace set to: " + newWorkspace);
                            }
                        }
                    }
                    case "workspaces" -> {
                        try {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> result = (Map<String, Object>) client.call("workspace.list", null);
                            @SuppressWarnings("unchecked")
                            List<Map<String, Object>> workspaces = (List<Map<String, Object>>) result.get("workspaces");
                            System.out.println("Registered workspaces:");
                            for (Map<String, Object> ws : workspaces) {
                                System.out.println("  " + ws.get("path"));
                            }
                        } catch (Exception e) {
                            System.err.println("Error: " + e.getMessage());
                        }
                    }
                    case "workflow" -> {
                        if (arg == null) {
                            // List workflows
                            List<String> workflows = workflowRunner.list();
                            System.out.println("Available workflows:");
                            for (String w : workflows) {
                                System.out.println("  " + w);
                            }
                        } else {
                            // Run workflow
                            try {
                                System.out.println("Running workflow: " + arg);
                                workflowRunner.run(arg, sessionManager.getCurrentWorkspace());
                            } catch (Exception e) {
                                System.err.println("Error running workflow: " + e.getMessage());
                            }
                        }
                    }
                    case "model" -> {
                        if (arg == null) {
                            System.out.println("Current model: " + sessionManager.getCurrentModel());
                        } else {
                            sessionManager.setCurrentModel(arg);
                            System.out.println("Model set to: " + arg);
                        }
                    }
                    default -> System.err.println("Unknown command: /" + command + " (try /help)");
                }
            } else {
                // Free-form prompt
                try {
                    if (sessionManager.getCurrentSessionId() == null) {
                        // Start new session
                        sessionManager.start(input);
                    } else {
                        // Resume existing session
                        sessionManager.resume(sessionManager.getCurrentSessionId(), input);
                    }
                } catch (Exception e) {
                    System.err.println("Error: " + e.getMessage());
                }
            }
        }

        // Cleanup
        System.out.println("\nGoodbye!");
        client.close();
    }

    private static void printUsage() {
        System.out.println("Usage: java -jar java-cli.jar [options]");
        System.out.println();
        System.out.println("Options:");
        System.out.println("  --bridge <path>        Path to ai-spec-bridge CLI");
        System.out.println("  --workspace <path>     Workspace directory (default: .)");
        System.out.println("  --model <id>           Claude model to use (default: claude-sonnet-4-6)");
        System.out.println("  --permission-mode <m>  Tool permission mode (default: approve)");
        System.out.println("  --help, -h             Show this help message");
    }

    private static void printHelp() {
        System.out.println("Commands:");
        System.out.println("  /help              Show this help");
        System.out.println("  /quit, /exit       Exit the CLI");
        System.out.println("  /ping              Health check (bridge.ping)");
        System.out.println("  /capabilities      Show bridge capabilities");
        System.out.println("  /models            List available Claude models");
        System.out.println("  /model <id>        Switch Claude model");
        System.out.println("  /tools             List available tools");
        System.out.println("  /sessions [status] List sessions (active/all)");
        System.out.println("  /resume <id>       Switch to an existing session");
        System.out.println("  /history [id]      Show session history");
        System.out.println("  /permission [mode] Change tool permission mode");
        System.out.println("  /workspace <path>  Register a workspace");
        System.out.println("  /workspaces        List registered workspaces");
        System.out.println("  /workflow [name]   Run a workflow or list available");
        System.out.println();
        System.out.println("Multi-line input: End a line with \\ to continue on the next line.");
    }
}
